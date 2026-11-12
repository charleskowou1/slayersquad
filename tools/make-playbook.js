// Builds "Slayer Squad - Roster Playbook.docx" (in the Slayer Squad Docs folder, next to the repo): every card and helper, how to win with it
// and how to beat it, plus fundamentals, best pairs, tested squads and a counter table. Numbers come from simulated
// Hard drafts with the game's own rules; the words come from tools/playbook-text.js.
// Rebuild with every push (CK, Oct 28, 2026), together with the guide:   node tools/make-playbook.js
// N=8000 drafts per budget by default (well under a minute); needs the docx package once: (cd tools && npm install)
const fs = require('fs'), path = require('path');
const { loadGame } = require('./load-game');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType,
        LevelFormat, BorderStyle, PageBreak, Footer, PageNumber } = require('docx');
const TXT = require('./playbook-text');
const N = +process.env.N || 8000, SQUAD_N = +process.env.SQUAD_N || 600, BUDGETS = [10, 20, 30];
const OUT = path.join(__dirname, '..', '..', 'Slayer Squad Docs', 'Slayer Squad - Roster Playbook.docx');
fs.mkdirSync(path.dirname(OUT), {recursive:true});
const VERSION = +(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8').match(/squad-draft-v(\d+)/) || [])[1];

/* ---------- simulation ---------- */
const g = loadGame(['roster.js', 'engine.js'], `
function play(){ startBattle(); while(S.phase!=='over'){ cpuBothSides(); resolve(); if(S.phase==='result') S.round++; } return S.winner; }
// one drafted match: per card games, wins, damage, knockouts, survived, pick number; pairs and matchups
function drafts(n, budget){ const C={}, pair={}, vs={}; S.budget=budget; S.unlockAll=true;
  const card=id=>C[id]||(C[id]={g:0,w:0,dmg:0,kos:0,alive:0,pick:0});
  const add=(o,k,w)=>{ o[k]=o[k]||[0,0]; o[k][0]++; if(w) o[k][1]++; };
  for(let i=0;i<n;i++){ S.mode='cpu'; S.n=2; S.names=['A','B']; newDraft(i%2); let k=0; while(S.phase==='draft'&&k++<80) cpuDraftStep('hard');
    const order=S.history.filter(h=>h.id).map(h=>h.id), t=[S.picks[0].slice(),S.picks[1].slice()], w=play();
    t.forEach((team,p)=>team.forEach(id=>{ const c=card(id); c.g++; if(w===p) c.w++; c.pick+=order.indexOf(id)+1;
      team.forEach(o=>{ if(o!==id) add(pair,id+'|'+o,w===p); }); t[1-p].forEach(e=>add(vs,id+'|'+e,w===p)); }));
    S.teams.flat().forEach(u=>{ if(u.spawn) return; const c=card(u.id), s=S.stats[u.uid]||{}; c.dmg+=s.dmg||0; c.kos+=s.kos||0; if(u.alive) c.alive++; }); }
  return {C, pair, vs}; }
// a fixed squad against a computer that drafts the rest of the pool at the same budget
function squad(ids, n, budget){ let w=0; S.budget=budget; S.unlockAll=true;
  for(let i=0;i<n;i++){ S.mode='cpu'; S.n=2; S.names=['A','B']; newDraft(1); S.picks[0]=ids.slice(); S.locked[0]=true;
    let k=0; while(S.phase==='draft'&&k++<80) cpuDraftStep('hard'); if(S.phase==='draft') continue; if(play()===0) w++; }
  return w/n; }
function data(){ return {ROSTER, BYID}; }`);
const { ROSTER, BYID } = g.data();
const t0 = Date.now(), SIM = {};
for (const b of BUDGETS) { SIM[b] = g.drafts(N, b); console.error(`${b} pts: ${N} drafts (${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
const SQUADS = TXT.squads.map(([b, name, ids, why]) => ({ b, name, ids, why, wr: g.squad(ids, SQUAD_N, b) }));
console.error(`squads done (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

const short = id => BYID[id].short || BYID[id].name;
const rate = (o, k) => o[k] && o[k][0] ? o[k][1] / o[k][0] : null;
const MIN_PAIR = b => b === 10 ? 50 : 60;
function cardNums(id, b) { const c = SIM[b].C[id]; return c && c.g >= 30 ? { g: c.g, wr: c.w / c.g, dmg: c.dmg / c.g, kos: c.kos / c.g, alive: c.alive / c.g, pick: c.pick / c.g } : null; }
function partners(id, b) { const own = (cardNums(id, b) || { wr: .5 }).wr;
  return Object.entries(SIM[b].pair).filter(([k, v]) => k.startsWith(id + '|') && v[0] >= MIN_PAIR(b)).map(([k, v]) => [k.split('|')[1], v[1] / v[0]])
    .filter(([o, r]) => !BYID[o].helper && r >= own + .05).sort((a, z) => z[1] - a[1]).slice(0, 3); }
function threats(id, b) { const own = (cardNums(id, b) || { wr: .5 }).wr;
  return Object.entries(SIM[b].vs).filter(([k, v]) => k.startsWith(id + '|') && v[0] >= MIN_PAIR(b)).map(([k, v]) => [k.split('|')[1], v[1] / v[0]])
    .filter(([o, r]) => !BYID[o].helper && r <= own - .05).sort((a, z) => a[1] - z[1]).slice(0, 3); }
const pct = x => Math.round(x * 100) + '%';

/* ---------- synergies and counters (mirrors synergies() in engine.js) ---------- */
const SYN = [
  { name: 'Kamaboko Squad', test: c => ['tanjiro', 'zenitsu', 'inosuke'].includes(c.fam), text: 'Any two of Tanjiro, Zenitsu, Inosuke: those two +1 SPD. All three: the whole team +2 SPD.' },
  { name: 'Siblings', fams: ['tanjiro', 'nezuko'], all: true, text: 'Tanjiro + Nezuko: when one is hit, the other counter-hits the attacker for 3.' },
  { name: 'Hashira', test: c => c.hashira, text: 'Two or more Hashira: each +1 PWR.' },
  { name: 'Upper Moons', test: c => c.upper, text: 'Two or more Upper Moons: each +1 regeneration.' },
  { name: "Muzan's Blood", fams: ['muzan'], plus: c => c.demon && c.fam !== 'muzan' && c.fam !== 'nezuko', text: 'Muzan + another demon (not Nezuko): every demon on the team +1 PWR.' },
  { name: 'Marks', test: c => c.mark, text: 'Two or more Mark cards: each +1 SPD.' },
  { name: 'Devoted', fams: ['tamayo', 'yushiro'], all: true, text: 'Tamayo + Yushiro: Yushiro +2 PWR.' },
  { name: 'Sun Lineage', fams: ['yoriichi', 'tanjiro'], all: true, text: 'Yoriichi + Tanjiro: Tanjiro +2 PWR.' },
  { name: 'Mentor', fams: ['urokodaki', 'tanjiro', 'giyu', 'sabito'], anchor: 'urokodaki', text: 'Urokodaki + Tanjiro, Giyu or Sabito: those pupils +1 DEF.' },
  { name: 'Corps Master', fams: ['kagaya'], plus: c => c.hashira, text: 'Kagaya + any Hashira: Hashira +1 DEF.' },
  { name: 'Two as One', fams: ['gyutaro', 'daki'], all: true, text: 'Gyutaro + Daki: Gyutaro +2 PWR, and each gets back up once at 30% while the other stands.' },
  { name: 'Temari & Arrows', fams: ['susamaru', 'yahaba'], all: true, text: 'Susamaru + Yahaba: Susamaru\'s hits go through Defend.' },
  { name: 'Kocho Sisters', fams: ['kanae', 'shinobu'], all: true, text: 'Kanae + Shinobu: poison lasts 4 rounds.' },
  { name: "Kanae's student", fams: ['kanae', 'kanao'], all: true, text: 'Kanae + Kanao: Kanao +1 PWR.' },
  { name: 'Training partner', fams: ['typezero', 'muichiro'], all: true, text: 'Type Zero + Muichiro: Muichiro +1 PWR.' },
  { name: 'Brothers', fams: ['sanemi', 'genya'], all: true, text: 'Sanemi + Genya: both +2 PWR.' },
  { name: 'Love Hashira', fams: ['obanai', 'mitsuri'], all: true, text: 'Obanai + Mitsuri: both +1 PWR, +1 SPD.' },
  { name: 'Set Your Heart Ablaze', fams: ['rengoku', 'tanjiro'], all: true, text: 'Rengoku + Tanjiro: Tanjiro +1 PWR, Rengoku +1 DEF.' },
  { name: 'Old Friends', fams: ['giyu', 'sabito'], all: true, text: 'Giyu + Sabito: Giyu +2 PWR +1 DEF, Sabito +1 SPD.' },
  { name: 'For Nezuko!', fams: ['zenitsu', 'nezuko'], all: true, text: 'Zenitsu + Nezuko: Zenitsu +1 PWR.' },
  { name: 'Butterfly Mansion', fams: ['shinobu', 'kanao'], all: true, text: 'Shinobu + Kanao: Kanao +1 SPD.' },
  { name: "Gyomei's student", fams: ['gyomei', 'genya'], all: true, text: 'Gyomei + Genya: Genya +1 DEF.' },
  { name: "Tengen's Family", fams: ['tengen'], plus: c => ['hinatsuru', 'makio', 'suma'].includes(c.fam), text: 'Tengen + his wives: Tengen +1 PWR per wife, each wife +1 SPD.' },
];
const VERSUS = [
  { fams: ['muzan', 'yoriichi'], text: 'Muzan fears the Sun: against Yoriichi, Muzan −3 PWR −2 SPD.' },
  { fams: ['kokushibo', 'yoriichi'], text: 'Against Yoriichi, Kokushibo −1 DEF.' },
  { fams: ['muzan', 'tamayo'], text: "Tamayo's medicine: against Tamayo, Muzan −2 regeneration." },
  { fams: ['zenitsu', 'kaigaku'], text: 'Rival: against Kaigaku, Zenitsu +2 PWR.' },
  { fams: ['rengoku', 'akaza'], text: 'Rival: against Akaza, Rengoku +2 PWR.' },
  { fams: ['muichiro', 'gyokko'], text: 'Rival: against Gyokko, Muichiro +2 PWR.' },
  { fams: ['mitsuri', 'hantengu'], text: 'Rival: against Hantengu, Mitsuri +2 PWR.' },
  { fams: ['kanao', 'inosuke', 'doma'], text: 'Revenge on Doma: against Doma, Kanao and Inosuke +2 SPD, and +4 damage on Doma through his DEF.' },
  { fams: ['shinobu'], demonFoe: true, text: "Shinobu's wisteria: a demon (not Akaza) that knocks her out loses 5 HP every round." },
];
function synergiesOf(c) {
  const s = SYN.filter(x => x.test ? x.test(c) : x.fams.includes(c.fam) || (x.plus && x.plus(c)) || false).map(x => x.name + ': ' + x.text.replace(/^[^:]+: /, ''));
  const v = VERSUS.filter(x => x.fams.includes(c.fam) || (x.demonFoe && c.demon && c.fam !== 'akaza')).map(x => x.text);
  return { s, v };
}

/* ---------- document helpers ---------- */
const FONT = 'Arial', INK = '2B2420', MUTED = '6B625A', ACCENT = 'B8432F', GREEN = '2E7D57';
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 21, bold: o.bold, italics: o.italics, color: o.color });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [run(children)], spacing: { after: o.after ?? 80, before: o.before ?? 0 }, keepNext: o.keepNext });
const bullet = (text, lead) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 }, children: lead ? [run(lead, { bold: true }), run(text)] : [run(text)] });
const label = (text, color) => para([run(text, { bold: true, color, size: 20 })], { before: 100, after: 40, keepNext: true });
const h1 = text => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 120, after: 100 }, children: [run(text, { bold: true, size: 34, color: INK })] });
const h2 = (text, tail) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 60 }, keepNext: true, children: [run(text, { bold: true, size: 28, color: INK }), ...(tail ? [run('   ' + tail, { size: 20, color: MUTED })] : [])] });
const h3 = text => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 60 }, keepNext: true, children: [run(text, { bold: true, size: 24, color: INK })] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const border = { style: BorderStyle.SINGLE, size: 4, color: 'D8CFC3' }, borders = { top: border, bottom: border, left: border, right: border };
function table(widths, head, rows, align = []) {
  const cell = (text, w, i, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders, margins: { top: 50, bottom: 50, left: 90, right: 90 },
    shading: o.head ? { fill: '2B2420', type: ShadingType.CLEAR, color: 'auto' } : o.alt ? { fill: 'F6F1EA', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({ alignment: align[i] === 'r' ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(String(text), { bold: o.head, color: o.head ? 'FFFFFF' : INK, size: 18 })] })] });
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, widths[i], i, { head: true })) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, widths[i], i, { alt: ri % 2 })) }))] });
}
const kindOf = c => c.helper ? 'Helper' : c.legend ? 'Legend' : c.demon ? (c.upper ? 'Upper Moon' : c.fam === 'muzan' || c.id === 'tanjiro_demon' ? 'Demon King' : 'Demon') : c.hashira ? 'Hashira' : 'Slayer / ally';

/* ---------- one card ---------- */
function cardBlock(id) {
  const c = BYID[id], t = TXT.cards[id] || {}, d = TXT.depth[id] || {}, out = [];
  out.push(h2(c.name, `${c.cost} pts · ${kindOf(c)}`));
  if (d.role) out.push(para([run('Role: ', { bold: true }), run(d.role)], { after: 40 }));
  out.push(para([run(`HP ${c.hp} · PWR ${c.pow}${(c.strikes || 1) > 1 ? ` ×${c.strikes}` : ''} · SPD ${c.spd} · DEF ${c.def}${c.regen ? ` · regenerates ${c.regen} a round` : ''}`, { color: MUTED, size: 19 })], { after: 40 }));
  if (c.sig) out.push(para([run('Special: ', { bold: true }), run(`${c.sig.name}. `, { italics: true }), run(c.sig.desc + (c.sig.cd ? ` Recharges in ${c.sig.cd} rounds.` : ''))], { after: 40 }));
  if (c.sig2) out.push(para([run('Second special: ', { bold: true }), run(`${c.sig2.name}. `, { italics: true }), run((c.sig2.desc || '') + (c.sig3 ? '' : ' Alternates with the first after each use.'))], { after: 40 }));
  if (c.sig3) out.push(para([run('Third special: ', { bold: true }), run(`${c.sig3.name}. `, { italics: true }), run((c.sig3.desc || '') + ' The three take turns, in this order.')], { after: 40 }));
  if (c.passive) out.push(para([run('Passive: ', { bold: true }), run(c.passive)], { after: 40 }));
  const { s, v } = synergiesOf(c);
  if (s.length) { out.push(label('Synergies', INK)); s.forEach(x => out.push(bullet(x))); }
  if (v.length) { out.push(label('Matchup rules', INK)); v.forEach(x => out.push(bullet(x))); }
  // numbers per budget
  const rows = BUDGETS.map(b => { const n = cardNums(id, b); if (!n) return [b + ' pts', c.cost > (b === 10 ? 6 : 99) ? 'not dealt' : 'too few games', '', '', '', ''];
    return [b + ' pts', pct(n.wr) + (n.g < 200 ? ' *' : ''), n.dmg.toFixed(0), n.kos.toFixed(1), pct(n.alive), '#' + n.pick.toFixed(1)]; });
  out.push(label('In the simulation', INK));
  out.push(table([1100, 1500, 1700, 1500, 1500, 2000], ['Budget', 'Win rate', 'Damage / game', 'KOs / game', 'Still up at end', 'Usually drafted'], rows, ['l', 'r', 'r', 'r', 'r', 'r']));
  if (d.draft) { out.push(label('Drafting', INK)); d.draft.forEach(x => out.push(bullet(x))); }
  if (d.plan) { out.push(label('Game plan', INK)); d.plan.forEach(x => out.push(bullet(x))); }
  if (t.win) { out.push(label('Win with it', GREEN)); t.win.forEach(x => out.push(bullet(x))); }
  if (t.beat) { out.push(label('Beat it', ACCENT)); t.beat.forEach(x => out.push(bullet(x))); }
  const lines = BUDGETS.map(b => { const p = partners(id, b), th = threats(id, b); if (!p.length && !th.length) return null;
    return [run(`${b} pts. `, { bold: true, size: 18, color: MUTED }),
      ...(p.length ? [run(`Best partners: ${p.map(([o, r]) => `${short(o)} ${pct(r)}`).join(', ')}. `, { size: 18, color: MUTED })] : []),
      ...(th.length ? [run(`Toughest matchups: ${th.map(([o, r]) => `${short(o)} ${pct(r)}`).join(', ')}.`, { size: 18, color: MUTED })] : [])]; }).filter(Boolean);
  if (lines.length) { out.push(label('Partners and matchups (win rate with that partner / against that enemy)', MUTED)); lines.forEach(l => out.push(para(l, { after: 30 }))); }
  return out;
}

/* ---------- the document ---------- */
const C = [];
C.push(para([run('Slayer Squad', { bold: true, size: 52, color: INK })], { after: 40 }));
C.push(para([run('Roster Playbook', { bold: true, size: 36, color: ACCENT })], { after: 80 }));
C.push(para([run(`Version ${VERSION} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · how to draft, play, win with and beat every card`, { color: MUTED, size: 20 })], { after: 240 }));

C.push(h1('How to read this'));
C.push(para(`Every card has its stats, special and synergies, a game plan, how to win with it and how to beat it, and its numbers from ${(N * BUDGETS.length).toLocaleString()} simulated Hard computer-vs-computer drafts (${N.toLocaleString()} each at 10, 20 and 30 points). The numbers show how a card does on average; a human who plays it well can do better.`));
[['Win rate: ', 'how often a team with that card won (50% is average). * = under 200 games, so less certain. Cheap cards can look strong because they ride along with big ones.'],
 ['Damage / game, KOs / game: ', 'raw damage dealt and knockouts landed per match.'],
 ['Still up at end: ', 'how often it was standing when the match ended.'],
 ['Usually drafted: ', 'the average pick number (#1 = first pick of the draft). Low numbers mean the computer grabs it early.'],
 ['Partners and matchups: ', 'only the ones that change the card\'s win rate by 5 points or more.']].forEach(([a, b]) => C.push(bullet(b, a)));

C.push(pageBreak()); C.push(h1('Fundamentals'));
TXT.fundamentals.forEach(([title, items]) => { C.push(h3(title)); items.forEach(([a, b]) => C.push(bullet(b, a))); });

C.push(pageBreak()); C.push(h1('Strongest picks'));
C.push(para('The ten best cards at each budget (cards seen in 200+ games). 10-point games only deal cards of 6 points or less.'));
const top = b => Object.entries(SIM[b].C).filter(([id, c]) => c.g >= 200 && !BYID[id].helper).map(([id, c]) => [id, c.w / c.g]).sort((a, z) => z[1] - a[1]).slice(0, 10);
const T = BUDGETS.map(top);
C.push(table([500, 2400, 800, 2400, 800, 2400, 800], ['#', '10 points', 'Win', '20 points', 'Win', '30 points', 'Win'],
  T[0].map((_, i) => [i + 1, ...T.flatMap(t => t[i] ? [`${short(t[i][0])} (${BYID[t[i][0]].cost})`, pct(t[i][1])] : ['', ''])]), ['l', 'l', 'r', 'l', 'r', 'l', 'r']));

C.push(h1('Best pairs'));
C.push(para('Two cards on the same team that won together most often (pairs seen together in 80+ games).'));
const pairs = b => { const seen = new Set(), out = [];
  Object.entries(SIM[b].pair).forEach(([k, v]) => { const [a, z] = k.split('|'); const key = [a, z].sort().join('|');
    if (seen.has(key) || v[0] < 80 || BYID[a].helper || BYID[z].helper) return; seen.add(key); out.push([a, z, v[1] / v[0], BYID[a].cost + BYID[z].cost]); });
  return out.sort((p, q) => q[2] - p[2]).slice(0, 8); };
BUDGETS.forEach(b => { const P = pairs(b); if (!P.length) return; C.push(h3(`${b} points`));
  C.push(table([4600, 1800, 1600], ['Pair', 'Points together', 'Win rate'], P.map(([a, z, r, pts]) => [`${short(a)} + ${short(z)}`, pts, pct(r)]), ['l', 'r', 'r'])); });

C.push(h1('Squads to try'));
C.push(para(`Ready-made teams, each played ${SQUAD_N} times against a Hard computer that drafted the rest of the pool at the same budget.`));
BUDGETS.forEach(b => { const S = SQUADS.filter(s => s.b === b); if (!S.length) return; C.push(h3(`${b} points`));
  C.push(table([2200, 4100, 900, 1200], ['Squad', 'Cards', 'Points', 'Win rate'], S.map(s => [s.name, s.ids.map(short).join(' + '), s.ids.reduce((a, id) => a + BYID[id].cost, 0), pct(s.wr)]), ['l', 'l', 'r', 'r']));
  S.forEach(s => C.push(bullet(s.why, s.name + ': '))); });

C.push(h1('Counter table'));
C.push(para('They drafted a big card? These are the cards it does worst against at 20 points (its win rate when facing them).'));
const bigs = Object.entries(SIM[20].C).filter(([id, c]) => c.g >= 300 && BYID[id].cost >= 8 && !BYID[id].helper).map(([id]) => id).sort((a, z) => BYID[z].cost - BYID[a].cost);
C.push(table([3000, 5600], ['If they take', 'Answer with'], bigs.map(id => [`${short(id)} (${BYID[id].cost})`, threats(id, 20).slice(0, 3).map(([o, r]) => `${short(o)} (${pct(r)})`).join(', ') || 'no clear counter in the sim']), ['l', 'l']));

for (const [title, intro, ids] of TXT.groups) {
  C.push(pageBreak()); C.push(h1(title)); C.push(para([run(intro, { italics: true, color: MUTED })], { after: 120 }));
  ids.forEach(id => C.push(...cardBlock(id)));
}
C.push(pageBreak()); C.push(h1('Back-pocket helpers'));
C.push(para([run('1 point each, one per player, used once on any round (they act first that round, except Hotaru, who works at the end). 3 of the 5 are offered in every draft.', { italics: true, color: MUTED })], { after: 120 }));
for (const [id, h] of Object.entries(TXT.helpers)) {
  const c = BYID[id];
  C.push(h2(c.name, '1 pt · Helper'));
  C.push(para([run(`${c.sig.name}: `, { bold: true }), run(h.what)], { after: 40 }));
  C.push(table([1100, 1500], ['Budget', 'Win rate'], BUDGETS.map(b => { const n = cardNums(id, b); return [b + ' pts', n ? pct(n.wr) : '-']; }), ['l', 'r']));
  C.push(label('Win with it', GREEN)); h.win.forEach(x => C.push(bullet(x)));
  C.push(label('Beat it', ACCENT)); h.beat.forEach(x => C.push(bullet(x)));
}

const doc = new Document({
  creator: 'Slayer Squad', title: 'Slayer Squad - Roster Playbook',
  styles: { default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 34, bold: true }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true }, paragraph: { outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true }, paragraph: { outlineLevel: 2 } }] },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, bottom: 1200, left: 1100, right: 1100 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`Slayer Squad v${VERSION} · Roster Playbook · page `, { size: 16, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED })] })] }) },
    children: C }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUT, b); console.log('Wrote ' + OUT); });
