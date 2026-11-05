// Builds the search pages (plain HTML, separate from the game; nothing in the game loads them):
//   how-to-play/index.html, characters/index.html, characters/<id>/index.html, characters/thumbs/<id>.jpg, sitemap.xml
// Run `node tools/make-pages.js` before every push. Words come from js/roster.js (stats, specials, lore), js/notes.js
// (synergies) and tools/playbook-text.js (role, drafting, game plan). Endless Dream cards are left out (no spoilers).
// Links are relative so the pages also work on the old address; canonical links point to slayersquad.app.
// sitemap.xml: a page's <lastmod> only changes when its HTML changed. The home page's date is set by the
// slayersquad.app workflow on every deploy. Thumbnails use macOS `sips` and are only remade when the picture changes.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { loadGame } = require('./load-game');
const TEXT = require('./playbook-text');

const ROOT = path.join(__dirname, '..'), SITE = 'https://slayersquad.app/';
const TODAY = new Date().toISOString().slice(0, 10);
const g = loadGame(['roster.js', 'engine.js', 'story.js', 'notes.js'],
  'globalThis.X = {ROSTER, BYID, LORE, allNotesFor, unlockStage, MAIN_STAGES, DREAM_CARDS, DREAM_HELPERS, SUNRISE_ROUND, MARK_PASSIVE, SELFLESS};').X;

/* ---------- which cards get a page ---------- */
const HIDDEN = new Set([...g.DREAM_CARDS, ...g.DREAM_HELPERS, 'dojo_fighter']);
const cards = g.ROSTER.filter(c => !c.spawn && !HIDDEN.has(c.id));
const shown = new Set(cards.map(c => c.id));
const GROUPS = TEXT.groups.map(([name, blurb, ids]) => [name, blurb, ids.filter(id => shown.has(id))]);
const grouped = new Set(GROUPS.flatMap(gr => gr[2]));
const rest = cards.filter(c => !c.helper && !grouped.has(c.id)).map(c => c.id);
if (rest.length) GROUPS.push(['More fighters', 'Trainers, allies and more.', rest]);
GROUPS.push(['Back-pocket helpers', '1 pt each and no fighter slot: use one once, on any round, and it acts first.', cards.filter(c => c.helper).map(c => c.id)]);

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const imgOf = c => ['jpg', 'png', 'webp'].flatMap(x => [c.id, c.id.replace(/_mark$/, ''), c.fam].map(n => `img/${n}.${x}`)).find(f => fs.existsSync(path.join(ROOT, f)));
const sideOf = c => c.helper ? 'Helper' : c.id === 'typezero' ? 'Training puppet' : c.legend ? 'Legend' : c.demon ? (/Demon ally/.test(c.type) ? 'Demon ally' : 'Demon') : 'Demon Slayer';
const stageName = c => { const i = g.unlockStage(c.id); return i >= 0 && g.MAIN_STAGES[i] ? g.MAIN_STAGES[i].title : null; };
const write = (rel, html) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); const old = fs.existsSync(f) && fs.readFileSync(f, 'utf8'); if (old !== html) fs.writeFileSync(f, html); return old !== html; };

function thumb(c) {
  const src = imgOf(c); if (!src) return null;
  const rel = `characters/thumbs/${c.id}.jpg`, out = path.join(ROOT, rel), inp = path.join(ROOT, src);
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(inp).mtimeMs) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '-Z', '360', inp, '--out', out], { stdio: 'ignore' });
  }
  return rel;
}

/* ---------- page shell ---------- */
const CSS = `:root{--bg:#1a1714;--surface:#23201b;--raise:#2b2721;--ink:#f3ece0;--muted:#b4a996;--line:#3a332b;--accent:#e0533d;--gold:#d6a54d;--mark:#d8434f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 'Zen Kaku Gothic New',system-ui,sans-serif}
a{color:var(--gold)}h1,h2,h3{font-family:'Shippori Mincho B1',serif;line-height:1.25;margin:1.6em 0 .5em}h1{font-size:2rem;margin-top:.4em}
header,main,footer{max-width:860px;margin:0 auto;padding:0 16px}
header{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding-top:14px;padding-bottom:12px;border-bottom:1px solid var(--line)}
header .logo{font-family:'Shippori Mincho B1',serif;font-weight:800;font-size:1.15rem;color:var(--ink);text-decoration:none;margin-right:auto}
header .logo b{color:var(--accent)}header nav{display:flex;gap:14px;flex-wrap:wrap}header nav a{color:var(--muted);text-decoration:none}header nav a[aria-current]{color:var(--ink)}
.play{display:inline-block;background:var(--accent);color:#fff;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:999px;margin:8px 0}
.lead{color:var(--muted);font-size:1.05rem}.crumbs{color:var(--muted);font-size:.85rem;margin-top:14px}.crumbs a{color:var(--muted)}
.hero{display:grid;grid-template-columns:minmax(0,220px) 1fr;gap:20px;align-items:start;margin-top:10px}
.hero img{width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;border-radius:14px;border:1px solid var(--line);background:var(--surface)}
.tag{display:inline-block;font-size:.78rem;padding:2px 10px;border-radius:999px;background:var(--raise);color:var(--muted);margin:0 6px 6px 0}
.tag.mark{color:#fff;background:var(--mark)}.tag.leg{color:#1a1714;background:var(--gold)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:8px;margin:14px 0}
.stats div{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center}.stats b{display:block;font-size:1.3rem}.stats small{color:var(--muted)}
.box{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:10px 0}.box h3{margin:.2em 0}.box p{margin:.4em 0}
blockquote{margin:12px 0;padding:4px 14px;border-left:3px solid var(--accent);color:var(--muted);font-style:italic}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px;padding:0;list-style:none}
.grid a{display:block;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;color:var(--ink);text-decoration:none}
.grid img{width:100%;height:auto;aspect-ratio:1;object-fit:cover;display:block;background:var(--raise)}.grid span{display:block;padding:6px 8px 8px;font-size:.88rem;line-height:1.3}.grid small{color:var(--muted)}
.pager{display:flex;justify-content:space-between;gap:12px;margin:28px 0}
footer{color:var(--muted);font-size:.8rem;border-top:1px solid var(--line);margin-top:40px;padding-top:14px;padding-bottom:40px}
@media(max-width:560px){.hero{grid-template-columns:1fr}.hero img{max-width:200px}h1{font-size:1.7rem}}`;

function page({ rel, title, desc, body, here, ld, image }) {
  const up = '../'.repeat(rel.split('/').length - 1), url = SITE + rel.replace(/index\.html$/, '');
  const nav = [['how-to-play/', 'How to play'], ['characters/', 'Characters']].map(([h, t]) => `<a href="${up}${h}"${here === h ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Slayer Squad">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${image ? SITE + image : SITE + 'og-image.jpg?v=4'}"><meta name="twitter:card" content="${image ? 'summary' : 'summary_large_image'}">
<meta name="theme-color" content="#1a1714"><link rel="icon" href="${up}icons/icon-192.png"><link rel="apple-touch-icon" href="${up}icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<style>${CSS}</style>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head><body>
<header><a class="logo" href="${up}"><b>滅</b> Slayer Squad</a><nav>${nav}<a href="${up}">Play free</a></nav></header>
<main>
${body}
</main>
<footer><p>Slayer Squad is a free, unofficial fan game, not affiliated with or endorsed by the creators. Demon Slayer: Kimetsu no Yaiba belongs to Koyoharu Gotouge, Shueisha, Aniplex and ufotable.</p></footer>
</body></html>
`;
}
const crumbs = (up, items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + p })) });

/* ---------- character pages ---------- */
const order = GROUPS.flatMap(gr => gr[2]);
const pages = [];   // [rel, html]
order.forEach((id, i) => {
  const c = g.BYID[id], lore = g.LORE[c.id] || g.LORE[c.fam], depth = TEXT.depth[id], tips = TEXT.cards[id];
  const rel = `characters/${id}/index.html`, pic = imgOf(c), th = thumb(c);
  const sig2 = c.sig2 || (c.selfless ? g.SELFLESS : null);
  const passives = [c.passive, c.mark ? g.MARK_PASSIVE : ''].filter(Boolean);
  const notes = g.allNotesFor(id).filter(n => n.ids.every(x => !HIDDEN.has(x)));
  const versions = cards.filter(x => x.fam === c.fam && x.id !== id);
  const unlock = stageName(c);
  const stat = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;
  const special = (s, label) => `<div class="box"><h3>${label}: ${esc(s.name)}</h3><p>${esc(s.desc)}</p>${s.cd ? `<p><small>Recharges in ${s.cd} round${s.cd > 1 ? 's' : ''}${s.prio ? ' · moves early' : ''}.</small></p>` : ''}${s.quote ? `<blockquote>“${esc(s.quote)}”</blockquote>` : ''}</div>`;
  const list = (h, a) => a && a.length ? `<h2>${h}</h2><ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const nameOf = x => esc(g.BYID[x].name);
  const desc = `${c.name} in Slayer Squad, the free Demon Slayer fan game: ${c.cost} pt${c.cost > 1 ? 's' : ''}${c.helper ? ' back-pocket helper' : `, ${c.hp} HP, ${c.pow} PWR`}. Special: ${c.sig.name}. ${c.sig.desc}`.slice(0, 300);
  const prev = order[i - 1], next = order[i + 1];
  const body = `<p class="crumbs"><a href="../../">Slayer Squad</a> › <a href="../">Characters</a> › ${esc(c.name)}</p>
<div class="hero">${pic ? `<img src="../../${pic}" alt="${esc(c.name)}" width="440" height="586">` : ''}<div>
<h1>${esc(c.name)}</h1>
<p><span class="tag${c.mark ? ' mark' : c.legend ? ' leg' : ''}">${c.mark ? 'Mark ✦' : esc(sideOf(c))}</span><span class="tag">${esc(c.type)}</span><span class="tag">${c.cost} pt${c.cost > 1 ? 's' : ''}</span></p>
${lore ? `<blockquote>“${esc(lore[0])}”</blockquote><p class="lead">${esc(lore[1])}</p>` : ''}
${depth ? `<p><b>Role:</b> ${esc(depth.role)}</p>` : ''}
<a class="play" href="../../">Play ${esc(c.name.split(' (')[0])} free</a>
</div></div>
${c.helper ? '' : `<div class="stats">${stat(c.hp, 'HP')}${stat(c.pow, 'PWR')}${stat(c.spd, 'SPD')}${stat(c.def, 'DEF')}${c.regen ? stat(c.regen, 'Regen / round') : ''}${c.strikes > 1 ? stat('×' + c.strikes, 'Strikes') : ''}${c.cap ? stat(c.cap, 'Max damage taken / round') : ''}</div>`}
${c.basic ? `<div class="box"><h3>Basic move: ${esc(c.basic.name)}</h3><p>${esc(c.basic.desc)}</p></div>` : ''}
${special(c.sig, c.helper ? 'When used' : 'Special')}
${sig2 ? special(sig2, 'Second special') : ''}
${passives.length ? `<h2>Passive</h2>${passives.map(p => `<p>${esc(p)}</p>`).join('')}` : ''}
${depth ? list('How to draft', depth.draft) + list('Game plan', depth.plan) : ''}
${tips ? list('Win with it', tips.win) + list('How to beat it', tips.beat) : ''}
${notes.length ? `<h2>Synergies and matchups</h2>${notes.map(n => `<div class="box"><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><p><small>${n.kind === 'team' ? 'Same team' : 'Against'}: ${[...new Set(n.ids)].filter(x => x !== id && shown.has(x)).map(x => `<a href="../${x}/">${nameOf(x)}</a>`).join(', ')}</small></p></div>`).join('')}` : ''}
${versions.length ? `<h2>Other versions</h2><p>One version of each character is dealt per draft.</p><ul>${versions.map(v => `<li><a href="../${v.id}/">${esc(v.name)}</a> (${v.cost} pts)</li>`).join('')}</ul>` : ''}
${unlock ? `<p><b>Unlock:</b> win the Story battle “${esc(unlock)}”.</p>` : g.unlockStage(c.id) === -1 ? '<p><b>Unlock:</b> available from the start.</p>' : ''}
<div class="pager">${prev ? `<a href="../${prev}/">← ${nameOf(prev)}</a>` : '<span></span>'}${next ? `<a href="../${next}/">${nameOf(next)} →</a>` : ''}</div>`;
  pages.push([rel, page({ rel, title: `${c.name} – Slayer Squad character`, desc, body, here: 'characters/', image: th,
    ld: crumbs('../../', [['Slayer Squad', ''], ['Characters', 'characters/'], [c.name, `characters/${id}/`]]) })]);
});

/* ---------- characters index ---------- */
{
  const rel = 'characters/index.html';
  const body = `<h1>Characters</h1>
<p class="lead">Every character you can draft in Slayer Squad: ${cards.filter(c => !c.helper).length} fighters and ${cards.filter(c => c.helper).length} back-pocket helpers. Tap one for their stats, specials, synergies and how to win with them.</p>
<a class="play" href="../">Play free in your browser</a>
${GROUPS.map(([name, blurb, ids]) => `<h2>${esc(name)}</h2><p>${esc(blurb)}</p><ul class="grid">${ids.map(id => { const c = g.BYID[id], th = thumb(c);
    return `<li><a href="${id}/">${th ? `<img src="thumbs/${id}.jpg" alt="" loading="lazy" decoding="async" width="360" height="360">` : ''}<span>${esc(c.name)}<br><small>${c.cost} pt${c.cost > 1 ? 's' : ''}${c.mark ? ' · Mark ✦' : ''}</small></span></a></li>`; }).join('')}</ul>`).join('\n')}`;
  pages.push([rel, page({ rel, title: 'All characters – Slayer Squad, the free Demon Slayer fan game', desc: 'Every Hashira, Upper Moon, slayer and helper in Slayer Squad, with stats, specials, synergies and drafting tips.', body, here: 'characters/',
    ld: crumbs('../', [['Slayer Squad', ''], ['Characters', 'characters/']]) })]);
}

/* ---------- how to play ---------- */
{
  const rel = 'how-to-play/index.html';
  const faq = [
    ['Is Slayer Squad free?', 'Yes. It runs in your browser on iPhone, Android or a computer, with nothing to buy and nothing to download. You can add it to your Home Screen to play it like an app.'],
    ['Can I play with friends?', 'Yes: Play Friends online with a code or invite link (2 to 4 players), Quick Match to find an opponent, co-op against the computer, or Same Phone to pass one phone between two players.'],
    ['Do I need an account?', 'No. Your progress saves on your device, and Settings gives you a recovery code to back it up or move it to another device.'],
    ['I found a bug. Where do I report it?', 'Slayer Squad is brand new, so thank you! Tap ⚙ Settings → Found a bug? in the game, or email slayersquadgame@gmail.com.'],
    ['Is it an official Demon Slayer game?', 'No. Slayer Squad is an unofficial fan game, not affiliated with or endorsed by the creators.'],
  ];
  const body = `<h1>How to play Slayer Squad</h1>
<p class="lead">Slayer Squad is a free Demon Slayer fan game for your browser. Draft a squad of slayers and demons within a points budget, then choose every fighter's move in secret each round. Last team standing wins.</p>
<a class="play" href="../">Play now</a>
<h2>1. Pick a mode</h2>
<ul><li><b>Story:</b> ${g.MAIN_STAGES.length} battles from Final Selection to the fight against Muzan, with cutscenes, Mark awakenings and three star goals per battle. Winning unlocks new characters for every mode.</li>
<li><b>Quickplay:</b> battle the computer on Easy, Normal or Hard, or try a Game Mode: Final Form (a really hard fight against Final Form Muzan and the Upper Moons), Gauntlet, Upper Moon Rush and Random Squads.</li>
<li><b>Online:</b> Play Friends with a code or invite link, Quick Match against a stranger, or team up in co-op. Two-player games can be played at your own pace.</li>
<li><b>Same Phone:</b> two players pass one phone, with private screens so neither sees the other's moves.</li>
<li><b>Daily challenge:</b> the same puzzle for everyone each day: build a squad that beats a set enemy team.</li></ul>
<h2>2. Draft a squad</h2>
<p>Each team gets a points budget (10, 20 or 30, or Unlimited). Every character costs points: cheap 2–4 pt fighters, Hashira around 5–8, Mark ✦ versions and Upper Moons higher, and Legends like Yoriichi near the top. Characters are dealt into a shared pool, and only one version of each character is dealt.</p>
<p>Who picks first is decided by a quick number game. Picks then snake (A, B, B, A, A, B…) until both teams lock in. The draft's Pool notes list every synergy and counter still possible with the cards dealt. You can also take one back-pocket helper for 1 pt.</p>
<h2>3. Choose moves in secret</h2>
<p>Every round, each of your fighters picks one move and a target:</p>
<ul><li><b>Attack:</b> damage is the attacker's PWR minus the target's DEF, but never less than half the PWR (rounded up).</li>
<li><b>Defend:</b> take half damage this round.</li>
<li><b>Special:</b> the fighter's signature move, like Hinokami Kagura, Dead Calm or Destructive Death. It then recharges for a few rounds.</li></ul>
<h2>4. Watch the clash</h2>
<p>Moves resolve together: specials that move early go first, then the fastest fighters (SPD). Health shows as a percent and turns red at 25%. At the end of each round poison ticks, demons regenerate and specials recharge. From round ${g.SUNRISE_ROUND} the sun rises: it burns every demon and stops their regeneration.</p>
<h2>5. Last team standing wins</h2>
<p>Knock out every fighter on the other team. Win with the right synergies: two Hashira hit harder, two Upper Moons regenerate faster, and pairs like Tanjiro and Nezuko or Gyutaro and Daki have their own bonuses.</p>
${(TEXT.fundamentals || []).map(([h, items]) => `<h2>Tips: ${esc(h.toLowerCase())}</h2><ul>${items.map(([b, t]) => `<li><b>${esc(b.trim())}</b> ${esc(t)}</li>`).join('')}</ul>`).join('\n')}
<h2>Card types</h2>
<ul><li><b>Mark ✦ versions</b> have more HP, PWR, SPD and DEF, and their special recharges a round faster. They cost more.</li>
<li><b>Legends</b> (Yoriichi) strike twice every Attack and cap the damage they take each round.</li>
<li><b>Demons</b> regenerate health every round until the sun rises.</li>
<li><b>Back-pocket helpers</b> take no fighter slot: use one once, on any round, and it acts first.</li></ul>
<p>See every card on the <a href="../characters/">Characters</a> page.</p>
<h2>Questions</h2>
${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}
<a class="play" href="../">Play Slayer Squad free</a>`;
  pages.push([rel, page({ rel, title: 'How to play Slayer Squad – the free Demon Slayer fan game', desc: 'Learn Slayer Squad in a minute: draft slayers and demons within your points, choose moves in secret, and be the last team standing. Modes, rules and drafting tips.', body, here: 'how-to-play/',
    ld: [crumbs('../', [['Slayer Squad', ''], ['How to play', 'how-to-play/']]), { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] })]);
}

/* ---------- write pages, remove pages for cards that are gone ---------- */
const changed = new Set(pages.filter(([rel, html]) => write(rel, html)).map(([rel]) => rel));
const keep = new Set(order);
for (const d of fs.readdirSync(path.join(ROOT, 'characters'))) {
  if (d === 'thumbs' || d === 'index.html' || keep.has(d)) continue;
  fs.rmSync(path.join(ROOT, 'characters', d), { recursive: true }); console.log(`Removed characters/${d}/`);
}
for (const f of fs.readdirSync(path.join(ROOT, 'characters/thumbs'))) if (!keep.has(f.replace(/\.jpg$/, ''))) fs.rmSync(path.join(ROOT, 'characters/thumbs', f));

/* ---------- sitemap ---------- */
const smFile = path.join(ROOT, 'sitemap.xml');
const oldDates = Object.fromEntries([...(fs.existsSync(smFile) ? fs.readFileSync(smFile, 'utf8') : '').matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map(m => [m[1], m[2]]));
const entry = (rel, pri) => { const loc = SITE + rel.replace(/index\.html$/, ''); const date = rel === '' || changed.has(rel) || !oldDates[loc] ? TODAY : oldDates[loc];
  return `  <url><loc>${loc}</loc><lastmod>${date}</lastmod><priority>${pri}</priority></url>`; };
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Made by tools/make-pages.js. The home page's date is also set on every deploy by .github/workflows/slayersquad-site.yml. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[entry('', '1.0'), entry('how-to-play/index.html', '0.8'), entry('characters/index.html', '0.8'), ...order.map(id => entry(`characters/${id}/index.html`, '0.6'))].join('\n')}
</urlset>
`;
fs.writeFileSync(smFile, sitemap);
console.log(`Pages: ${pages.length} (${changed.size} changed), ${order.length} characters, sitemap ${order.length + 3} URLs.`);
