// Own-pace online check: two phones and an in-memory "database" that works like the Firebase game node (each action
// is one transaction on the stored state; there's no host). Plays full matches, including bans, crows and rematches,
// and checks that both phones agree, out-of-turn actions do nothing, a phone never sees the other's moves before the
// round resolves, and each finished match is reported for the shared stats exactly once.
// Usage: node tools/check-async.js [matches]
const { loadGame } = require('./load-game');
const FILES = ['roster.js', 'engine.js', 'story.js', 'daily.js', 'online.js', 'notes.js', 'effects.js', 'views.js', 'sound.js'];
const EXTRA = `function S_(){ return S; } function OL(){ return ONLINE; } function fam(id){ return BYID[id].fam; } function fids(p){ return fighterIds(p); } function alv(p){ return alive(p); } function cban(p,id){ return canBan(p,id); }`;

function match(seed) {
  let s = seed * 7 + 1; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const names = ['CK', 'Mia'], phones = [0, 1].map(() => loadGame(FILES, EXTRA)), problems = [];
  let leaks = 0, ended = 0, rounds = 0;
  // the stored game (what Firebase would hold): created by phone 0 in the lobby
  const lobby = { phase: 'lobby', n: 2, names: [names[0]], budget: [10, 20, 30][seed % 3], poolType: seed % 4 ? 'random' : 'all', maxTeam: 6,
    bansOn: seed % 2 === 0, async: true, hostSeat: -1, duo: false, unlockAll: true, gm: seed % 5 === 1 ? 'random' : seed % 5 === 2 ? 'mirror' : undefined };
  const dealt = st0 => { if (st0.phase !== 'plan') problems.push('dealt game did not go straight to the fight (' + st0.phase + ')');
    if (lobby.gm === 'mirror' && st0.picks[0].join() !== st0.picks[1].join()) problems.push('mirror squads differ');
    if (lobby.gm === 'random' && st0.picks[0].some(a => st0.picks[1].some(b => phones[0].fam(a) === phones[0].fam(b)))) problems.push('random put a character on both teams'); };
  const db = { s: JSON.stringify(lobby), meta: null };
  const show = () => phones.forEach((ph, q) => { ph.applySnapshot(ph.asyncView(db.s, q)); });
  phones.forEach((ph, q) => {
    Object.assign(ph.S_(), { mode: 'online', async: true, me: q, planFor: q, hostSeat: -1, unlockAll: true, names: names.slice(), phase: 'lobby' });
    ph.OL().net = { send(msg) { const r = ph.asyncApply(db.s, msg); if (!r) return; db.s = r.json; db.meta = r.meta; if (r.ended) ended++; show(); } };
  });
  const st = () => JSON.parse(db.s);
  phones[1].OL().net.send({ a: 'join', p: 1, name: names[1] });
  if (lobby.gm) dealt(st()); else if (st().phase !== 'spin') problems.push('join did not start the number game');
  // the number game: each phone takes a different number, then either phone starts the draft
  const numbers = () => {
    const b4 = db.s; phones[0].OL().net.send({ a: 'todraft', p: 0 }); if (db.s !== b4) problems.push('draft started before the numbers were in');
    phones[0].onlineGuess(4);
    const after = db.s; phones[1].OL().net.send({ a: 'guess', p: 1, n: 4 }); if (db.s !== after) problems.push('two players took the same number');
    phones[0].OL().net.send({ a: 'guess', p: 0, n: 6 }); if (db.s !== after) problems.push('a player changed their number');
    const q = db.meta.turn; if (q.length !== 1 || q[0] !== 1) problems.push('home-screen summary missed whose number it is');
    phones[1].onlineGuess(6);
    if (st().spin.state === 'coin') { const b4c = db.s; phones[0].OL().net.send({ a: 'todraft', p: 0 }); if (db.s !== b4c) problems.push('draft started before the coin was called'); phones[1].onlineCoin('tails'); }   // a tie: call the coin
    const g = st().spin; if (g.state !== 'done' || g.r === undefined) problems.push('the number game did not finish');
    const d = g.picks.map(n => Math.abs(n - g.secret));
    if (d[g.r] !== Math.min(...d) || (d[0] === d[1] && !g.call)) problems.push('the wrong player won the number game');
    phones[1].OL().net.send({ a: 'todraft', p: 1 });
    if (st().phase !== 'draft' || st().first !== g.r) problems.push('the number game\'s winner does not pick first');
  };
  phones[1].OL().net.send({ a: 'join', p: 1, name: 'Third' });   // a second join must do nothing
  if (st().names[1] !== names[1]) problems.push('a second join replaced the player');
  if (!lobby.gm) numbers();

  for (let game = 0; game < 2; game++) {
    // bans and draft: only the phone whose turn it is acts; the other one tries and must change nothing
    for (let k = 0; k < 150 && st().phase === 'draft'; k++) {
      const p = phones[0].turn(), ph = phones[p], o = phones[1 - p], S = ph.S_();
      if (phones[1].turn() !== p) problems.push('phones disagree on whose turn it is');
      if (!db.meta.turn.includes(p)) problems.push('home-screen summary has the wrong turn');
      const before = db.s, any = o.S_().pool.find(id => o.canPick(1 - p, id));
      if (any) { o.onlinePick(any); o.OL().net.send({ a: 'pick', p: 1 - p, id: any }); if (db.s !== before) problems.push('picked out of turn'); }   // the stored game rejects it too
      if (S.banning) { ph.onlineBan(S.pool.find(id => ph.cban(p, id))); continue; }
      const can = S.pool.filter(id => ph.canPick(p, id));
      if (can.length && !(ph.fids(p).length >= 2 && Math.random() < .25)) ph.onlinePick(can[Math.floor(Math.random() * can.length)]);
      else if (ph.fids(p).length) ph.onlineLockTeam();
      else problems.push('stuck in the draft');
    }
    if (st().phase !== 'plan') { problems.push('battle did not start (' + st().phase + ')'); break; }
    // rounds: each phone chooses on its own copy, then locks in; sometimes the second phone locks first
    for (let r = 0; r < 60 && !st().final; r++) {
      const order = Math.random() < .5 ? [0, 1] : [1, 0];
      for (const q of order) {
        const ph = phones[q], S = ph.S_();
        if (S.phase !== 'plan' || S.movesLocked[q] || !ph.alv(q).length) continue;
        // the other phone's moves must never be visible before the round resolves
        const other = S.plans[1 - q] || {}; if (Object.keys(other).length) leaks++;
        if (st().movesLocked[1 - q]) { const b4 = db.s; phones[1 - q].OL().net.send({ a: 'moves', p: 1 - q, plans: {} });   // already locked: can't lock again
          if (db.s !== b4) problems.push('locked moves twice'); }
        ph.cpuPlan(q, 'hard'); ph.cpuHelpers(q);
        ph.onlineLockMoves();
      }
      // a crow report: the scouting phone keeps its moves or re-plans
      for (let c = 0; c < 3 && st().phase === 'scout'; c++) {
        const q = st().scoutP, ph = phones[q];
        if (!Object.keys(ph.S_().plans[1 - q] || {}).length && ph.alv(1 - q).length) problems.push('crow owner could not see the other moves');
        if (Math.random() < .5) ph.onlineKeepMoves(); else { ph.S_().scouting = true; ph.cpuPlan(q, 'hard'); ph.onlineLockMoves(); }
      }
      rounds++;
      // a new round starts clean: yesterday's moves can't carry over, and a special still recharging can't be fired
      if (!st().final && st().phase === 'plan') {
        const s2 = st(); if (Object.keys(s2.plans[0] || {}).length || Object.keys(s2.plans[1] || {}).length) problems.push('last round\'s moves carried over');
        phones.forEach((ph, q) => { if (Object.keys(ph.S_().plans[q] || {}).length) problems.push('a phone kept last round\'s moves'); });
      }
      if (!st().final && st().phase !== 'plan') problems.push('round did not move on (' + st().phase + ')');
    }
    if (!st().final) { problems.push('match did not finish'); break; }
    if ((st().matchLog || []).length !== st().roundId) problems.push('battle log is missing rounds');
    if (JSON.stringify(phones[0].S_().teams) !== JSON.stringify(phones[1].S_().teams)) problems.push('phones disagree at the end');
    if (game === 0) { const loser = st().winner === 0 ? 1 : 0; phones[1].onlineRematch(); const r = st();
      if (r.final) problems.push('rematch did not start'); else if (lobby.gm) dealt(r); else if (r.phase !== 'draft' || r.first !== loser) problems.push('rematch: the loser should pick first, straight in the draft'); }
  }
  if (ended !== (lobby.gm ? 0 : 2)) problems.push('finished matches reported ' + ended + ' times (want 2)');
  return { problems, leaks, rounds };
}

const N = +process.argv[2] || 150;
let bad = 0, leaks = 0, rounds = 0, first = '';
for (let i = 1; i <= N; i++) {
  try { const r = match(i); rounds += r.rounds; leaks += r.leaks; if (r.problems.length) { bad++; if (!first) first = 'match ' + i + ': ' + [...new Set(r.problems)].join('; '); } }
  catch (e) { bad++; if (!first) first = 'match ' + i + ': ' + e.stack; }
}
console.log(bad ? `${bad} of ${N} own-pace matches had problems. First: ${first}` : `All ${N} own-pace matches (2 games each, ${rounds} rounds) played correctly on both phones.`);
console.log(leaks ? `Privacy: ${leaks} times a phone saw the other's moves early!` : 'Privacy: no phone ever saw the other\'s moves before the round resolved.');
process.exitCode = bad || leaks ? 1 : 0;
