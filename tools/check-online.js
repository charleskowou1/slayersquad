// Online play check: a host phone and 1–3 guest phones joined by an in-memory connection that behaves like the
// Firebase room (the host sends each guest its own copy of the state). Each phone only uses its own actions. Plays
// full matches with 2, 3 and 4 players and checks that every phone agrees, picks happen only on your turn, and no
// guest receives anyone else's moves while choosing (except when that guest's Kasugai Crow is scouting).
// Some matches also hand hosting off mid-match (the host goes quiet, seat 1 takes over, the old host carries on as a guest).
// Usage: node tools/check-online.js [matches]
const { loadGame } = require('./load-game');
const FILES = ['roster.js', 'engine.js', 'story.js', 'daily.js', 'online.js', 'notes.js', 'effects.js', 'views.js', 'sound.js'];
const EXTRA = `function S_(){ return S; } function OL(){ return ONLINE; } function api(){ return {isHelper, fighterIds, alive, players, canBan}; } function iAmHost_(){ return iAmHost(); }`;

function match(seed, opts = {}) {
  const n = opts.n || 2, names = ['CK', 'Mia', 'Tom', 'Ana'].slice(0, n);
  const phones = Array.from({length: n}, () => loadGame(FILES, EXTRA));
  let hi = 0, host = phones[0];   // the hosting phone (changes on a hand-off)
  let s = seed * 7 + 1; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;   // seeded, shared by every phone
  const problems = [];
  let leaks = 0;
  // the connection: the host publishes a copy for each guest; a guest's action goes to the host, then the host publishes
  const publish = () => phones.forEach((ph, q) => { if (q !== hi) ph.applySnapshot(host.snapshotFor(q)); });
  const wire = () => phones.forEach((ph, q) => { ph.OL().net = q === hi ? { send() {} } : { send(msg) { host.hostHandle(msg); publish(); } }; });
  wire();
  let H = host.S_();
  Object.assign(H, { mode: 'online', me: 0, planFor: 0, n: 2, names: [names[0]], budget: opts.budget || 20, poolType: 'random',
    lobby: { code: 'TEST', seats: [1, 2, 3].map(i => i < n ? { name: names[i], on: true } : null) }, phase: 'lobby' });
  phones.forEach((ph, q) => { if (q) Object.assign(ph.S_(), { mode: 'online', me: q, planFor: q, names: [names[0], names[q]], phase: 'lobby' }); });
  H.cfg = { duo: seed % 3 === 0 };   // some 4-phone matches are 2v2
  if (!host.hostStartMatch()) problems.push('host could not start with ' + n + ' players');
  if (n === 4 && H.duo !== H.cfg.duo) problems.push('2v2 setting not applied');
  publish();
  // host spins and starts the draft
  H.bansOn = seed % 2 === 0;   // half the matches start with a ban round: each phone bans on its own turn
  // who picks first: every phone takes a number (guests send theirs to the host); a repeated number does nothing
  H.phase = 'spin'; H.spin = host.newGuess(); publish();
  phones.forEach((ph, q) => { const taken = H.spin.picks.filter(Boolean), n0 = [1,2,3,4,5,6,7,8,9].find(x => !taken.includes(x));
    if (taken.length) { ph.onlineGuess(taken[0]); if (q === hi) publish(); if (H.spin.picks[q]) problems.push('a number was taken twice'); }
    ph.onlineGuess(n0); if (q === hi) publish(); });
  if (H.spin.state === 'coin') { const q = H.spin.tied.who[0]; phones[q].onlineCoin('heads'); publish(); }   // a tie: that player calls the coin
  if (H.spin.state !== 'done') problems.push('number game did not finish');
  { const d = H.spin.picks.map(x => Math.abs(x - H.spin.secret)); if (d[H.spin.r] !== Math.min(...d)) problems.push('closest number did not pick first'); }
  phones.forEach((ph, q) => { if (q !== hi && (!ph.S_().spin || ph.S_().spin.r !== H.spin.r)) problems.push('phones disagree on who picks first'); });
  host.newDraft(H.spin.r); publish();
  for (let b = 0; b < n && H.banning; b++) { const p = host.turn(), ctx = phones[p], id = ctx.S_().pool.find(x => ctx.api().canBan(p, x)); ctx.onlineBan(id); if (p === hi) publish(); }
  if (H.bansOn && (H.banning || H.bans.length !== n)) problems.push('ban round did not finish');
  for (let k = 0; k < 120 && H.phase === 'draft'; k++) {
    const p = host.turn(), ctx = phones[p], S = ctx.S_();
    phones.forEach((ph, q) => { if (q !== hi && (ph.S_().phase !== 'draft' || ph.turn() !== p)) problems.push('phones disagree on whose turn it is'); });
    // another phone trying to pick must do nothing
    const o = (p + 1) % n, before = JSON.stringify(H.picks), anyId = phones[o].S_().pool.find(id => phones[o].canPick(o, id));
    if (anyId) { phones[o].onlinePick(anyId); if (o === hi) publish(); if (JSON.stringify(H.picks) !== before) problems.push('picked out of turn'); }
    const options = S.pool.filter(id => ctx.canPick(p, id));
    const helper = options.find(id => ctx.api().isHelper(id)), fighter = options.find(id => !ctx.api().isHelper(id));
    const choice = (k % 5 === 3 && helper) || fighter || helper;
    if (choice && (ctx.api().fighterIds(p).length < 3 || ctx.Math.random() < .7)) ctx.onlinePick(choice); else ctx.onlineLockTeam();
    if (p === hi) publish();
  }
  if (H.phase !== 'plan') problems.push('draft did not finish (phase ' + H.phase + ')');
  if (H.teams && H.teams.length !== n) problems.push('wrong number of teams');
  for (let r = 0; r < 45 && !H.final; r++) {
    if (H.phase !== 'plan') { problems.push('expected plan, got ' + H.phase); break; }
    // hand-off: the host goes quiet at the start of round 2 and seat 1 takes over hosting
    if (opts.handoff && r === 1 && hi === 0) {
      const lockedBefore = phones[1].S_().movesLocked.slice();
      phones[1].takeOverHost(names[0]); hi = 1; host = phones[1]; H = host.S_(); wire(); publish();
      if (phones[0].iAmHost_()) problems.push('old host still thinks it is hosting');
      if (!phones[1].iAmHost_()) problems.push('new host does not think it is hosting');
      if (phones.some(ph => ph.S_().hostSeat !== 1)) problems.push('not every phone knows the new host');
    }
    // each phone still in the fight plans its own side and maybe uses its helper; then locks, one at a time
    const live = host.api().players().filter(p => host.api().alive(p).length);
    live.forEach(p => { const ctx = phones[p], S = ctx.S_(); ctx.cpuPlan(p); const h = (S.helpers[p] || [])[0];
      if (h && r >= 1 && (h === 'crow' || ctx.Math.random() < .5)) S.helperPlan[p] = [h]; });
    live.forEach((p, i) => {
      phones[p].onlineLockMoves(); if (p === hi) publish();
      // privacy: while others are still choosing, no guest may hold anyone else's moves
      if (H.phase === 'plan') phones.forEach((ph, q) => { if (q !== hi && ph.S_().plans.some((pl, x) => x !== q && Object.keys(pl || {}).length)) leaks++; });
    });
    for (let k = 0; k < 6 && H.phase === 'scout'; k++) {
      const sp = H.scoutP, ctx = phones[sp];
      const canSee = host.api().players().some(x => x !== sp && host.api().alive(x).some(u => !u.stun));   // someone else has a move to see
      if (sp !== hi && canSee && !ctx.S_().plans.some((pl, x) => x !== sp && Object.keys(pl || {}).length)) problems.push("a guest's crow saw no moves");
      if (k % 2 === 0) { ctx.S_().scouting = true; ctx.onlineLockMoves(); } else ctx.onlineKeepMoves();
      if (sp === hi) publish();
    }
    if (H.phase !== 'result') { problems.push('expected result, got ' + H.phase); break; }
    phones.forEach((ph, q) => { if (q === hi) return; const G = ph.S_();
      if (G.phase !== 'result' || G.roundId !== H.roundId) problems.push('a guest did not get the round');
      if (JSON.stringify(G.teams) !== JSON.stringify(H.teams)) problems.push('phones disagree on the teams after round ' + H.round); });
    if (H.final) break;
    // "Next round" waits for every phone, including knocked-out players who are watching
    phones.forEach((ph, q) => { if (q === n - 1) return; ph.onlineNext(); if (q === hi) publish(); if (H.phase !== 'result') problems.push('round advanced before every phone was ready'); });
    phones[n - 1].onlineNext(); if (n - 1 === hi) publish();
  }
  if (!H.final) problems.push('match did not finish');
  phones.forEach((ph, q) => { if (q !== hi && ph.S_().winner !== H.winner) problems.push('phones disagree on the winner'); });
  phones[n - 1].onlineRematch(); if (n - 1 === hi) publish();
  phones.forEach(ph => { if (ph.S_().phase !== 'spin') problems.push('rematch did not reach the wheel on every phone'); });
  return { problems, leaks, rounds: H.round, winner: H.winner, handed: hi !== 0 };
}

let bad = 0, leaks = 0, rounds = 0, handoffs = 0;
const N = +process.argv[2] || 200;
for (let i = 1; i <= N; i++) {
  const r = match(i, { budget: [10, 20, 30][i % 3], n: [2, 3, 4][i % 3 === 0 ? 0 : i % 4 % 3], handoff: i % 4 === 1 });
  leaks += r.leaks; rounds += r.rounds; if (r.handed) handoffs++;
  if (r.problems.length) { bad++; if (bad <= 3) console.log('match ' + i + ': ' + [...new Set(r.problems)].join('; ')); }
}
console.log(bad ? `${bad} of ${N} online matches had problems.` : `All ${N} online matches (2, 3 and 4 phones) played correctly on every phone (${rounds} rounds, ${handoffs} with a host hand-off).`);
console.log(leaks ? `PRIVACY: a guest held someone else's moves ${leaks} times.` : "Privacy: no guest ever received anyone else's moves while choosing.");
