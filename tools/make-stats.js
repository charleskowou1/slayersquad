// Builds "Slayer Squad - Character Stats.xlsx" (in the Slayer Squad Docs folder, next to the repo): every card's
// stats from js/roster.js, plus an HP → percent converter. Run `node tools/make-stats.js` after any stat change.
// Needs `(cd tools && npm install)` once (exceljs).
const fs = require('fs'), path = require('path');
const ExcelJS = require('exceljs');
const { loadGame } = require('./load-game');

const OUT = path.join(__dirname, '..', '..', 'Slayer Squad Docs', 'Slayer Squad - Character Stats.xlsx');
const VERSION = +(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8').match(/squad-draft-v(\d+)/) || [])[1];
const g = loadGame(['roster.js'], 'globalThis.OUT = {ROSTER, SELFLESS, MARK_PASSIVE};').OUT;

/* ---------- rows ---------- */
const VERSION_NAME = { muzan_final: 'Final Form', tanjiro_demon: 'Demon King', nezuko_awakened: 'Awakened', tengen_retired: 'Retired',
  michikatsu: 'Human past', hakuji: 'Human past', hantengu_true: 'True form' };
const HUMANS = new Set(['michikatsu', 'hakuji', 'tanjuro']);
const versionOf = c => c.helper ? 'Helper' : c.legend ? 'Legend' : c.mark ? 'Mark' : VERSION_NAME[c.id] || (c.spawn ? 'Split form' : 'Base');
const sideOf = c => c.helper ? 'Helper' : c.id === 'typezero' ? 'Puppet' : HUMANS.has(c.id) ? 'Human'
  : c.demon ? (/Demon ally/.test(c.type) ? 'Demon ally' : 'Demon') : 'Slayer';
const secondOf = c => c.sig2 || (c.selfless ? g.SELFLESS : null);
const passiveOf = c => [c.passive, c.mark ? g.MARK_PASSIVE : ''].filter(Boolean).join(' ') || null;

// Legends, then demons (strongest first, battle-only forms last), then everyone else, then helpers
const cards = g.ROSTER.filter(c => c.id !== 'dojo_fighter');   // a nameless one-off enemy, never dealt
const group = c => c.legend ? 0 : c.helper ? 3 : sideOf(c) === 'Demon' ? 1 : 2;
const order = cards.map((c, i) => [c, i]).sort(([a, i], [b, j]) => group(a) - group(b) || (a.spawn - b.spawn) || b.cost - a.cost || i - j).map(([c]) => c);

/* ---------- styles ---------- */
const NAVY = 'FF1D2239', BLUE = 'FF0000FF', GREY = 'FF555555', LINE = 'FFD0D0D0';
const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const ROW_FILL = { Legend: 'FFF7EBC8', Mark: 'FFF6DCDD' };

const wb = new ExcelJS.Workbook();
wb.creator = 'Slayer Squad';
wb.calcProperties.fullCalcOnLoad = true;   // formulas work out their values when the file is opened

/* ---------- Roster sheet ---------- */
const ws = wb.addWorksheet('Roster', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
const COLS = [
  ['Character', 22], ['Version', 11], ['Side', 11], ['Type', 24], ['Cost (pts)', 9], ['Max HP', 8], ['PWR', 7], ['SPD', 7], ['DEF', 7],
  ['Regen / round', 9], ['1 HP = % of bar', 10], ['Regen as % of bar', 10], ['Strikes per Attack', 9], ['Max damage taken / round', 11],
  ['Max damage as % of bar', 11], ['Special', 26], ['Special effect', 46], ['Cooldown (rounds)', 10],
  ['Second special', 26], ['Second special effect', 46], ['Passive', 46],
];
ws.columns = COLS.map(([header, width]) => ({ header, width }));
const INPUT = new Set([5, 6, 7, 8, 9, 10, 13, 14, 18]);   // blue: numbers straight from the game
const WRAP = new Set([17, 20, 21]);
const PCT = new Set([11, 12, 15]);

const head = ws.getRow(1);
head.height = 31.5;
head.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(NAVY); c.alignment = { vertical: 'middle', wrapText: true }; });

order.forEach((c, i) => {
  const r = i + 2, fighter = !c.helper, s2 = secondOf(c);
  const row = ws.getRow(r);
  row.values = [
    c.name, versionOf(c), sideOf(c), c.type, c.cost,
    fighter ? c.hp : null, fighter ? c.pow : null, fighter ? c.spd : null, fighter ? c.def : null, fighter ? c.regen || 0 : null,
    fighter ? { formula: `1/F${r}` } : null, fighter ? { formula: `J${r}/F${r}` } : null,
    fighter ? c.strikes || 1 : null, fighter ? c.cap || null : null,
    fighter ? { formula: `IF(N${r}="","",N${r}/F${r})` } : null,
    c.sig.name, c.sig.desc, c.sig.cd || null,
    s2 ? s2.name : null, s2 ? s2.desc : null, passiveOf(c),
  ];
  for (let k = 1; k <= COLS.length; k++) {
    const cell = row.getCell(k);
    cell.alignment = { vertical: 'top', wrapText: WRAP.has(k) };
    cell.border = { bottom: { style: 'thin', color: { argb: LINE } } };
    if (INPUT.has(k)) cell.font = { color: { argb: BLUE } };
    if (PCT.has(k)) cell.numFmt = '0.0%';
    if (ROW_FILL[versionOf(c)] && k <= 2) cell.fill = fill(ROW_FILL[versionOf(c)]);
  }
});
const last = order.length + 1;
ws.autoFilter = { from: 'A1', to: { row: last, column: COLS.length } };
ws.addConditionalFormatting({ ref: `F2:F${last}`, rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF8FA8D8' } }] });

const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const NOTES = [
  `Blue numbers are the game's current stats (from Slayer Squad v${VERSION}, built ${today} by tools/make-stats.js). Black cells are formulas.`,
  '"1 HP = % of bar": how much of a fighter\'s bar one point of damage removes. Smaller = tankier.',
  'Pink rows are Mark-awakened versions (+8 HP, +4 PWR, +2 SPD, +1 DEF, special 1 round faster; cost set per character). Gold rows are Legends.',
  'Second special: the special takes turns with the first one after each use (Mark Tanjiro\'s Selfless State comes once per match).',
  'Split forms (cost 0) are never drafted: when Hantengu falls his four emotions appear, and when the last of them falls they merge into Zohakuten beside the real Hantengu. '
    + 'Second versions share a character slot (one or the other is dealt): Old Yoriichi, Final-Form Muzan, Demon King Tanjiro, Mark versions, Awakened Nezuko, Retired Tengen, Michikatsu (Kokushibo), Hakuji (Akaza). '
    + 'Helpers (1 pt) sit in the back pocket and have no fighting stats.',
];
ws.getCell(`A${last + 2}`).value = 'Notes';
ws.getCell(`A${last + 2}`).font = { bold: true };
NOTES.forEach((t, i) => { const c = ws.getCell(`A${last + 3 + i}`); c.value = t; c.font = { color: { argb: GREY } }; });

/* ---------- HP % Calculator sheet ---------- */
const calc = wb.addWorksheet('HP % Calculator');
calc.columns = [{ width: 28 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 18 }];
calc.getCell('A1').value = 'HP → Percent converter';
calc.getCell('A1').font = { bold: true, size: 14 };
calc.getCell('A2').value = 'Pick a character and type the HP they have left (blue cells). The bar shows what players will see.';
calc.getCell('A2').font = { color: { argb: GREY } };
['Character', 'HP left', 'Max HP', 'Health %', 'Shown to player'].forEach((t, i) => {
  const c = calc.getRow(4).getCell(i + 1); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(NAVY);
});
const EXAMPLES = [['Tanjiro Kamado', 14], ['Yoriichi Tsugikuni', 26], ['Muzan Kibutsuji', 12], ['Murata', 5], ['Gyomei Himejima (Mark)', 30]];
const names = `Roster!$A$2:$A$${last}`, hps = `Roster!$F$2:$F$${last}`;
for (let r = 5; r <= 14; r++) {
  const [name, hp] = EXAMPLES[r - 5] || [null, null];
  if (name && !order.some(c => c.name === name)) throw new Error(`Calculator example "${name}" is not in the roster`);
  const row = calc.getRow(r);
  row.values = [name, hp,
    { formula: `IF(A${r}="","",INDEX(${hps},MATCH(A${r},${names},0)))` },
    { formula: `IF(OR(A${r}="",B${r}=""),"",MAX(0,MIN(1,B${r}/C${r})))` },
    { formula: `IF(D${r}="","",ROUND(D${r}*100,0)&"% Health")` }];
  [1, 2].forEach(k => { const c = row.getCell(k); c.font = { color: { argb: BLUE } }; c.fill = fill('FFFFF7D6'); });
  row.getCell(4).numFmt = '0%';
  calc.getCell(`A${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [names] };
}
calc.addConditionalFormatting({ ref: 'D5:D14', rules: [
  { type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FF5FAE6E' } },
  { type: 'expression', formulae: ['AND(D5<>"",D5<=0.25)'], style: { font: { color: { argb: 'FFC8414B' }, bold: true } } },
] });
calc.getCell('A16').value = 'Rule for the UI: Health % = HP left ÷ Max HP, rounded to the nearest whole percent. Show red at 25% or less.';
calc.getCell('A16').font = { color: { argb: GREY } };

wb.xlsx.writeFile(OUT).then(() => console.log(`Wrote ${OUT}: ${order.length} cards (v${VERSION}).`));
