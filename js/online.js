/* ================= ONLINE PLAY (2–4 phones) =================
   One phone hosts (player 0) and runs the game; up to three others join with a 4-letter room code (players 1–3,
   in the order they took a seat). The host sends each phone its own copy of the shared game state after every change;
   the guests draw it and send their actions back (picks, locks, moves, "next round"…), tagged with their seat.
   Privacy: while everyone is choosing, each phone's copy leaves out the other players' moves and helpers, unless that
   phone's Kasugai Crow is scouting.
   No DOM here: the transport is plugged in as ONLINE.net (Firebase in the browser, an in-memory bus in
   tools/check-online.js), and app.js supplies ONLINE.hooks.roundPlayed (start the playback animation). */
const ONLINE = { net:null, hooks:{ roundPlayed(){} } };
const isOnline = () => S.mode==='online';
// The host is the phone that runs the game: the room creator (seat 0) unless hosting was handed off (S.hostSeat)
const hostSeat = () => S.hostSeat||0;
const iAmHost = () => isOnline() && S.me===hostSeat();
// which side this phone plays: 0 except for an online guest
const myP = () => isOnline() ? S.me : 0;
const ROOM_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newRoomCode = () => Array.from({length:4}, ()=>ROOM_LETTERS[Math.floor(Math.random()*ROOM_LETTERS.length)]).join('');

// Game fields shared through the room. Everything else (menus, playback, selections, settings) stays on each phone.
const SHARED = ['phase','hostSeat','hostNote','n','duo','names','budget','poolType','maxTeam','banning','bans','first','lastPicker','history','picks','locked','k','pool','spin',
  'teams','sib','twins','syn','place','round','plans','helpers','helperPlan','log','matchLog','stats','winner','final','movesLocked','readyNext',
  'scoutQueue','scoutP','roundId','lobby','outOrder','gm','coop','series'];
// What the host sends to player q. While everyone is choosing, the other players' moves and helpers are left out
// (unless q's crow is scouting: then q sees everyone's moves).
function snapshotFor(q=1){
  const o={}; SHARED.forEach(k=>{ if(S[k]!==undefined) o[k]=S[k]; });
  const choosing = S.phase==='plan' || S.phase==='scout';
  const scouting = S.phase==='scout' && S.scoutP===q;
  if(choosing && !scouting){
    if(o.plans) o.plans=o.plans.map((pl,p)=>p===q ? pl : {});
    if(o.helperPlan) o.helperPlan=o.helperPlan.map((h,p)=>p===q ? h : []);
  }
  return JSON.stringify(o);
}
// Guest: take the host's state, but keep the moves this phone is still choosing
function applySnapshot(json){
  const o=JSON.parse(json), prevRound=S.roundId, me=S.me;
  // a new round starts clean: last round's moves must never carry over (CK: specials repeated, targets already down)
  const sameRound = o.round===S.round && o.roundId===S.roundId;
  const stillChoosing = sameRound && ((o.phase==='plan' && !(o.movesLocked&&o.movesLocked[me])) || S.scouting);
  const mine = stillChoosing && S.plans ? {plans:S.plans[me], helpers:S.helperPlan&&S.helperPlan[me]} : null;
  Object.assign(S, o); if(S.gm||S.coop) S.unlockAll=true;   // dealt games use every character
  S.planFor=me; S.lastPlans=S.lastPlans||players().map(()=>null);
  if(mine){ S.plans[me]=mine.plans||{}; S.helperPlan[me]=mine.helpers||[]; }
  if(S.phase!=='result') S.localOver=false;
  if(S.phase==='result' && S.roundId!==prevRound) ONLINE.hooks.roundPlayed();   // a new round to play back
}

/* ---------- host: game flow ---------- */
// Everyone still standing has locked their moves: crow reports first (each in turn), then the round
const choosers = () => players().filter(p=>alive(p).length);
function hostAfterLocks(){
  if(!choosers().every(p=>S.movesLocked[p])) return;
  if(S.coop) cpuPlan(foeSeat(),'hard');   // the computer moves last, without seeing anyone's moves: cpuPlan never reads them
  S.scoutQueue=choosers().filter(p=>(S.helperPlan[p]||[]).includes('crow'));
  hostNextScout();
}
function hostNextScout(){
  if(S.scoutQueue.length){ S.scoutP=S.scoutQueue.shift(); S.phase='scout'; return; }
  S.scoutP=null; hostFight();
}
function hostFight(){
  S.info=null; resolve(); S.final = S.phase==='over'; S.phase='result';
  S.roundId=(S.roundId||0)+1; S.readyNext=players().map(coopFoe);
  ONLINE.hooks.roundPlayed();
}
// Every phone tapped "Next round" (knocked-out players keep watching, so they tap too)
function hostMaybeNextRound(){
  if(!S.readyNext.every(Boolean) || S.final) return;
  S.round++; S.phase='plan'; S.movesLocked=players().map(p=>!alive(p).length || coopFoe(p)); S.readyNext=players().map(coopFoe); S.hostNote=null;
  S.plans=players().map(()=>({})); S.helperPlan=players().map(()=>[]);
}
function hostRematch(){ if(S.coop) return coopAgain(); S.final=false; S.localOver=false; S.winner=undefined; if(S.gm && !S.async) return dealMatch(); S.phase='spin'; S.spin=newGuess(); }
// What a phone sent is only a request: a special still recharging becomes Attack, Defend is Attack for anyone who can't
// guard, and a target that's already down is dropped (resolve() picks a live one)
function cleanPlans(p, plans){
  const out={}; if(plans && plans.ambush) out.ambush=plans.ambush;
  alive(p).forEach(u=>{ const pl=plans&&plans[u.uid]; if(!pl) return out[u.uid]=restPlan(u);
    const q={...pl}; if(q.type==='special' && u.cd>0) q.type='attack'; if(q.type==='defend' && u.noDefend) q.type='attack';
    if(q.t){ const t=findU(q.t); if(!t || !t.alive) delete q.t; } out[u.uid]=q; });
  return out;
}
// A fighter with no move: Block, or Attack for anyone who can't guard (Awakened Nezuko)
const restPlan = u => u.noDefend ? {type:'attack', t:(foes(u.p).slice().sort((a,b)=>a.hp-b.hp)[0]||{}).uid} : {type:'defend'};
/* ---------- the clock (CK): 1 minute per pick, 2 for moves, 1 to watch a round ----------
   Each phone counts from when it saw this step begin; a timeout names the step, so a late one does nothing.
   The clock only runs when everyone's there: an own-pace game with one player away still waits for them. */
const CLOCK_LIMIT = {d:60, s:60, p:120, c:60, r:60};
const clockKey = () => S.phase==='draft' ? `d${S.k}.${(S.bans||[]).length}.${S.banning?1:0}.${allPicks().length}`
  : S.phase==='spin' ? 's'+(S.spin&&S.spin.state) : S.phase==='plan' ? 'p'+S.round : S.phase==='scout' ? `c${S.round}.${S.scoutP}` : '';
function timeoutRun(){
  if(S.phase==='draft') return S.banning ? cpuBan() : cpuDraftStep('normal');
  if(S.phase==='spin'){ if(S.spin.state==='done') return newDraft(S.spin.r); if(S.spin.state==='coin') return cpuCall(); players().forEach(q=>{ if(!S.spin.picks[q]) cpuGuess(q); }); return; }
  if(S.phase==='scout') return hostNextScout();
  if(S.phase==='plan'){ players().filter(q=>alive(q).length && !S.movesLocked[q]).forEach(q=>{ S.plans[q]=cleanPlans(q,null); S.helperPlan[q]=[]; S.movesLocked[q]=true; }); hostAfterLocks(); }
}
// An action from a guest phone (msg.p = its seat). Anything out of turn is ignored.
function hostHandle(msg){
  const p=msg.p;
  if(!(p>=0 && p<nPlayers()) || p===hostSeat()) return;
  switch(msg.a){
    case 'pick': if(S.phase==='draft' && turn()===p && canPick(p,msg.id)) doPick(msg.id); break;
    case 'ban': if(S.phase==='draft' && canBan(p,msg.id)) doBan(msg.id); break;
    case 'lock': if(S.phase==='draft' && turn()===p && fighterIds(p).length) doLock(p); break;
    case 'undo': { const u=undoable(); if(u && u.p===p) undoPick(); break; }
    case 'moves':
      if(msg.scout){ if(S.phase==='scout' && S.scoutP===p){ S.plans[p]=cleanPlans(p,msg.plans); hostNextScout(); } break; }
      if(S.phase==='plan' && !S.movesLocked[p]){
        S.plans[p]=cleanPlans(p,msg.plans);
        S.helperPlan[p]=(msg.helperPlan||[]).filter(h=>(S.helpers[p]||[]).includes(h));
        S.movesLocked[p]=true; hostAfterLocks();
      }
      break;
    case 'guess': if(S.phase==='spin') guessPick(p, msg.n); break;   // who picks first: this phone's number
    case 'coin': if(S.phase==='spin') guessCall(p, msg.v); break;   // a tie: this phone calls the coin
    case 'keep': if(S.phase==='scout' && S.scoutP===p) hostNextScout(); break;
    case 'next': if(S.phase==='result'){ S.readyNext[p]=true; hostMaybeNextRound(); } break;
    case 'rematch': if(S.phase==='result' && S.final) hostRematch(); break;
    case 'timeout': if(msg.key===clockKey()) timeoutRun(); break;
  }
}
// Host hand-off: when the host has been away a long time, the next player still in the room takes over hosting.
// Their copy of the game is complete except for moves still being chosen (hidden from them), so the current round's
// choices are reopened: everyone keeps their own moves and just locks in again. The old host rejoins as a player.
const HANDOFF_MS = (typeof window!=="undefined" && window.HANDOFF_TEST_MS) || 3*60*1000;   // tests can shorten it
function takeOverHost(oldName){
  S.hostSeat=S.me;
  S.hostNote=`${oldName||'The host'} was away, so ${S.names[S.me]} is hosting now.`;
  if(S.phase==='plan' || S.phase==='scout'){
    S.phase='plan'; S.scouting=false; S.scoutQueue=[]; S.scoutP=null;
    S.movesLocked=players().map(p=>!alive(p).length || coopFoe(p) || (p===S.me && !!S.movesLocked[p]));
    S.plans=players().map((pl,p)=>p===S.me ? (S.plans[p]||{}) : {}); S.helperPlan=players().map((h,p)=>p===S.me ? (S.helperPlan[p]||[]) : []);
  }
}
// Host lobby: start with the players seated now (seats 0..n-1; an empty seat in the middle has to be filled first)
function hostStartMatch(){
  const seats=S.lobby.seats||[], n=1+seats.filter(x=>x&&x.on).length;
  if(n<2 || seats.slice(0,n-1).some(x=>!x||!x.on)) return false;
  S.n=n; S.duo=n===4 && !!(S.cfg||{}).duo; S.names=[S.names[0], ...seats.slice(0,n-1).map(x=>x.name)];
  const g=(S.cfg||{}).gm; S.coop=g==='final'||g==='gauntlet' ? g : undefined;
  if(S.coop){ S.n=n+1; S.duo=false; S.names.push(g==='final'?'Muzan':'The wave'); }
  return true;
}

/* ---------- actions from this phone (host applies them, guests send them) ---------- */
// every action is addressed to the current host (so a host who was away and is catching up leaves it for the new one)
const send = msg => ONLINE.net && ONLINE.net.send(Object.assign({p:S.me, to:hostSeat()}, msg));
function onlineBan(id){
  if(!canBan(S.me,id)) return;
  if(iAmHost()) doBan(id); else send({a:'ban', id});
}
function onlinePick(id){
  if(S.phase!=='draft' || turn()!==S.me || !canPick(S.me,id)) return;
  if(iAmHost()) doPick(id); else send({a:'pick', id});
}
function onlineLockTeam(){
  if(S.phase!=='draft' || turn()!==S.me || !fighterIds(S.me).length) return;
  if(iAmHost()) doLock(S.me); else send({a:'lock'});
}
function onlineUndo(){
  const u=undoable(); if(!u || u.p!==S.me) return;
  if(iAmHost()) undoPick(); else send({a:'undo'});
}
function onlineLockMoves(){
  const me=S.me;
  S.lastPlans=S.lastPlans||players().map(()=>null); S.lastPlans[me]=JSON.parse(JSON.stringify(S.plans[me]));
  if(S.scouting){                                   // re-planned after a crow report
    S.scouting=false;
    if(iAmHost()) hostNextScout(); else send({a:'moves', scout:true, plans:S.plans[me]});
    return;
  }
  S.movesLocked[me]=true;
  if(iAmHost()){ S.plans[me]=cleanPlans(me,S.plans[me]); hostAfterLocks(); } else send({a:'moves', plans:S.plans[me], helperPlan:S.helperPlan[me]||[]});
}
function onlineKeepMoves(){ if(iAmHost()) hostNextScout(); else send({a:'keep'}); }
function onlineNext(){
  S.readyNext[S.me]=true;
  if(iAmHost()) hostMaybeNextRound(); else send({a:'next'});
}
function onlineGuess(n){ if(S.phase!=='spin') return; if(iAmHost()) guessPick(S.me,n); else send({a:'guess', n}); }
function onlineCoin(v){ if(S.phase!=='spin') return; if(iAmHost()) guessCall(S.me,v); else send({a:'coin', v}); }
function onlineRematch(){ if(iAmHost()) hostRematch(); else send({a:'rematch'}); }

/* ---------- play at your own pace (2 phones, no host) ----------
   A game lives in Firebase at games/<6-letter code>: the whole shared state (s, JSON) plus a small summary (meta) for
   the home screen. There's no host: the phone that acts loads the state, applies its action with the same rules the
   host uses (hostHandle), and writes it back in one transaction, so either phone can be closed between turns.
   When a round resolves the game moves straight on to the next round's choices; each phone plays the round back
   the next time it's opened (it remembers the last round it watched).
   Privacy: each phone only draws the other player's moves once the round has resolved (asyncView = snapshotFor),
   but they are in the database, so this is "no peeking in the game", not a lock against someone reading the data. */
const ASYNC_EXTRA = ['bansOn','async','first','matchNo','gm'];
const isAsync = () => isOnline() && !!S.async;
const asyncJSON = () => { const o={}; SHARED.concat(ASYNC_EXTRA).forEach(k=>{ if(S[k]!==undefined) o[k]=S[k]; }); return JSON.stringify(o); };
// A new match in a 2-player game: the number game decides who picks first, or in a rematch the loser does (`first`, no number
// game: straight back to the draft, CK Nov 2, 2026). S.gm games ('random' or 'mirror') are dealt with no draft at all.
function dealMatch(){ Object.assign(S,{picks:dealSquads(S.gm,nPlayers()), locked:players().map(()=>true), pool:[], history:[], k:0, first:0, lastPicker:null, banning:false, bans:[], sel:null}); startBattle(); }
function asyncBegin(first){
  Object.assign(S,{final:false, localOver:false, winner:undefined, spin:null, matchLog:[], roundId:0, matchNo:(S.matchNo||0)+1});
  if(S.gm) return dealMatch();
  if(first!==undefined) return newDraft(first);
  Object.assign(S,{phase:'spin', spin:newGuess()});   // the number game, one phone at a time; a tie is a coin flip
}
// Who has to do something now (seats), from the shared state in S
function asyncTurnOf(){
  if(S.phase==='spin') return S.spin.state==='done' ? [S.spin.r] : S.spin.state==='coin' ? S.spin.tied.who : players().filter(p=>!S.spin.picks[p]);
  if(S.phase==='draft') return [turn()];
  if(S.phase==='plan') return players().filter(p=>alive(p).length && !S.movesLocked[p]);
  if(S.phase==='scout') return [S.scoutP];
  return [];
}
const asyncMeta = () => ({names:S.names, matchNo:S.matchNo||0, phase:S.phase, turn:asyncTurnOf(), round:S.round||0, roundId:S.roundId||0, final:!!S.final, winner:S.winner===undefined?null:S.winner, updated:Date.now()});
// Apply one action (msg.p = the acting seat) to the stored state. Returns {json, meta, ended} or null if it doesn't
// apply (out of turn, already taken…). `ended` holds the finished match for the shared stats (only the phone whose
// action ended it reports it, so a match is counted once).
function asyncApply(json, msg){
  const keep=S, hook=ONLINE.hooks.roundPlayed;
  S=Object.assign(JSON.parse(json), {mode:'online', async:true, hostSeat:-1, unlockAll:keep.unlockAll});
  if(S.gm) S.unlockAll=true;   // dealt modes use every character, like Quickplay's Game Modes
  ONLINE.hooks.roundPlayed=()=>{};
  try{
    const wasFinal=!!S.final;
    if(msg.a==='join'){ if(S.phase!=='lobby' || S.names[1]) return null; S.names=[S.names[0], msg.name]; asyncBegin(); }
    else if(msg.a==='rematch'){ if(!(S.phase==='result' && S.final)) return null; const loser=S.winner===0?1:0; hostRematch(); asyncBegin(loser); }
    else if(msg.a==='guess'){ if(S.phase!=='spin' || !guessPick(msg.p, msg.n)) return null; }
    else if(msg.a==='coin'){ if(S.phase!=='spin' || !guessCall(msg.p, msg.v)) return null; }
    else if(msg.a==='todraft'){ if(S.phase!=='spin' || S.spin.state!=='done') return null; newDraft(S.spin.r); }
    else {
      const before=JSON.stringify([S.phase, S.k, S.picks, S.bans, S.locked, S.movesLocked, S.scoutP, S.roundId, S.spin]);
      hostHandle(msg);
      if(JSON.stringify([S.phase, S.k, S.picks, S.bans, S.locked, S.movesLocked, S.scoutP, S.roundId, S.spin])===before) return null;
      if(S.phase==='result' && !S.final){ S.readyNext=players().map(()=>true); hostMaybeNextRound(); }   // straight on to the next round
    }
    const ended = !wasFinal && S.final && !S.gm ? {pool:S.pool, poolType:S.poolType, teams:players().map(p=>S.teams[p].filter(u=>!u.spawn).map(u=>u.id)),
      helpers:players().map(p=>(S.picks[p]||[]).filter(isHelper)), won:players().map(p=>S.winner>=0 && sameSide(S.winner,p)), humans:players()} : null;
    return {json:asyncJSON(), meta:asyncMeta(), ended};
  } finally { S=keep; ONLINE.hooks.roundPlayed=hook; }
}
// What seat `me` may see of the stored state (the other player's moves are left out while choosing)
function asyncView(json, me){
  const keep=S; S=JSON.parse(json);
  try{ const o=JSON.parse(snapshotFor(me)); ASYNC_EXTRA.forEach(k=>{ if(S[k]!==undefined) o[k]=S[k]; }); return JSON.stringify(o); } finally { S=keep; }
}

/* ---------- this phone's own-pace games (the home screen list) ----------
   squad-draft-games: [{code, seat, meta (the game's latest summary), seen:{m, r} (match and round last watched),
   scored (match already counted in this phone's records)}] */
const GAMES_KEY = 'squad-draft-games';
function loadGames(){ try{ return JSON.parse(localStorage.getItem(GAMES_KEY))||[] }catch(e){ return [] } }
function saveGames(g){ try{ localStorage.setItem(GAMES_KEY, JSON.stringify(g)) }catch(e){} }
const myGame = code => loadGames().find(g=>g.code===code);
function setGame(code, patch){ const g=loadGames(), i=g.findIndex(x=>x.code===code); if(i<0) g.unshift(Object.assign({code},patch)); else Object.assign(g[i],patch); saveGames(g); }
function dropGame(code){ saveGames(loadGames().filter(g=>g.code!==code)); }
const QUEUE = 'QUEUED', QUEUE_TTL = 2*864e5;   // Quick Match: games/QUEUED holds the one game waiting for an opponent, for up to 2 days (js/app.js)
// the last round this phone has watched in the game's current match (0 = none yet)
const seenRound = (g, matchNo) => g && g.seen && g.seen.m===matchNo ? g.seen.r : 0;
// One line for the home screen list; mine = this phone has something to do
function gameStatus(g){
  const m=g.meta, me=g.seat, opp=m && m.names && m.names[1-me];
  if(g.gone) return {t:'This game no longer exists'};
  if(!m) return {t:'Loading…'};
  if(m.phase==='lobby') return g.qm ? {t:Date.now()-(m.updated||0)<QUEUE_TTL?'Looking for an opponent…':'Nobody joined. Tap × and try again.'} : {t:`Waiting for someone to join · code ${g.code}`};
  const unseen=(m.roundId||0) > seenRound(g, m.matchNo);
  if(m.final) return unseen ? {t:'The last round is ready to watch', mine:true} : {t: m.winner===me ? 'You won' : m.winner===null||m.winner<0 ? 'Nobody won' : `${opp} won`};
  if(unseen) return {t:'New round to watch', mine:true};
  if((m.turn||[]).includes(me)) return {t: m.phase==='spin' ? 'Pick your number' : m.phase==='draft' ? 'Your pick' : m.phase==='scout' ? 'Your crow is back' : 'Your turn', mine:true};
  return {t:`Waiting for ${opp}`};
}
const gamesToPlay = () => loadGames().filter(g=>gameStatus(g).mine).length;

/* ---------- shared stats: every finished game adds to anonymous counts in Firebase (stats/) ----------
   stats/games = matches counted; stats/chars/<card id> = {d: dealt (Random pool games), r: picked by a player in
   those games, p: picked in any game, w: won}. Only players' squads count (in Quickplay, not the computer's), and
   not Story, Practice or the daily challenge. Pick rate = r/d, win rate = w/p. */
let GLOBAL_STATS = null;   // {games, chars, at} once loaded (app.js)
function globalOf(id){ const c=GLOBAL_STATS && GLOBAL_STATS.chars[id]; return c ? {d:c.d||0, r:c.r||0, p:c.p||0, w:c.w||0} : {d:0,r:0,p:0,w:0}; }
const GLOBAL_MIN = 5;   // games before a win rate is shown
