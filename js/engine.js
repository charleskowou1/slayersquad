/* ================= ENGINE =================
   Game state, draft rules and battle rules. No DOM in this file: tools/balance-sim.js runs it in Node. */
const MAXTEAM = 6;
// Fighters allowed per team in this match: 1–6, chosen per mode on the main menu (story is always 6)
const teamCap = () => S.maxTeam || MAXTEAM;
// Points per team: chosen per mode (10, 20, 30 or Unlimited) and remembered on this phone. Unlimited is a very high
// budget, so every rule keeps working: only the fighter limit stops a team.
const UNLIMITED = 999, BUDGETS = [10, 20, 30, UNLIMITED], DEFAULT_BUDGET = 20;
const budgetName = b => b>=UNLIMITED ? 'Unlimited' : b;
const budget = () => S.budget || DEFAULT_BUDGET;
// How a draft is dealt at each team budget:
//  size    = characters dealt
//  maxCost = most one card may cost. 10-point games stop at 6 so every team gets at least two fighters
//            (one 9–10 point card alone against two or three cheap ones was a coin flip decided by matchups).
//  strong  = favour stronger characters: pricier characters come up more, Mark versions beat base versions 2 to 1
const DEALS = {
  10: {size:12, maxCost:6},    // 12 dealt since Oct 26, 2026 (was 10; CK)
  20: {size:12, maxCost:20},
  30: {size:14, maxCost:30, strong:true},
  [UNLIMITED]: {size:16, maxCost:99, strong:true},
};
const deal = () => DEALS[budget()] || DEALS[DEFAULT_BUDGET];
const poolSize = () => deal().size + (nPlayers()-2)*(deal().strong?5:4);   // more players, more characters dealt
// Free-for-all (3–4 players) deals nothing over 12 points: single big cards (Yoriichi, Muzan, Kokushibo…) shrug off
// small hits while the other teams wear each other down, so the first picker won 55–65%. With the cap: 40/33/26%.
const FFA_MAX_COST = 12;
// The 10-point cap is for Random deals of 2+ fighters: it doesn't apply when you asked for a whole pool or a 1 v 1
const maxCardCost = () => { const m=fullPool()||teamCap()<2 ? budget() : deal().maxCost; return nPlayers()>2 ? Math.min(m, FFA_MAX_COST) : m; };
const SNAKE = [0,1,1,0];

/* ---------- state / storage ---------- */
const SCORE_KEY = 'squad-draft-score', NAMES_KEY = 'squad-draft-names';
function loadScore(){ try{ return JSON.parse(localStorage.getItem(SCORE_KEY))||{} }catch(e){ return {} } }
function saveScore(s){ try{ localStorage.setItem(SCORE_KEY,JSON.stringify(s)) }catch(e){} }
function loadNames(){ try{ return JSON.parse(localStorage.getItem(NAMES_KEY)) }catch(e){ return null } }
function saveNames(n){ try{ localStorage.setItem(NAMES_KEY,JSON.stringify(n)) }catch(e){} }
// This phone's player name (Settings → Your name, or asked once on the home screen). Used wherever "you" play:
// story, Quickplay, Practice, the daily challenge, online, and player 1 in Local. Each phone keeps its own.
const PLAYER_KEY = 'squad-draft-player';
function playerName(){ try{ return localStorage.getItem(PLAYER_KEY)||'' }catch(e){ return '' } }
function savePlayerName(n){ n=String(n||'').trim().slice(0,14); if(!n) return; try{ localStorage.setItem(PLAYER_KEY,n) }catch(e){} }
// Per-character records on this phone: card id → [games played, games won]
const RECORDS_KEY = 'squad-draft-records';
function loadRecords(){ try{ return JSON.parse(localStorage.getItem(RECORDS_KEY))||{} }catch(e){ return {} } }
function recordMatch(){
  const rec=loadRecords();
  players().forEach(p=>S.teams[p].filter(u=>!u.spawn).forEach(u=>{ const r=rec[u.id]||(rec[u.id]=[0,0]); r[0]++; if(S.winner>=0 && sameSide(S.winner,p)) r[1]++; }));
  try{ localStorage.setItem(RECORDS_KEY,JSON.stringify(rec)) }catch(e){}
}

// Character pool: 'random' deals a hand of characters (default), 'all' offers every character, 'slayers' and 'demons'
// every character on that side. Nezuko, Tamayo and Yushiro are demons who fight for the Corps, so they're Slayers here.
const POOL_TYPES = ['random','all','slayers','demons'];
const fullPool = () => S.sideWar || S.poolType==='all' || S.poolType==='slayers' || S.poolType==='demons';
const slayerSide = c => !c.demon || /Demon ally/.test(c.type);
const poolSide = c => S.poolType==='slayers' ? slayerSide(c) : S.poolType==='demons' ? !slayerSide(c) : true;
function loadPoolType(){ try{ const t=localStorage.getItem('squad-draft-pooltype'); return POOL_TYPES.includes(t)?t:'random' }catch(e){ return 'random' } }
function savePoolType(v){ try{ localStorage.setItem('squad-draft-pooltype',v) }catch(e){} }
function loadBudget(){ try{ const b=+localStorage.getItem('squad-draft-budget'); return BUDGETS.includes(b)?b:DEFAULT_BUDGET }catch(e){ return DEFAULT_BUDGET } }
function saveBudget(v){ try{ localStorage.setItem('squad-draft-budget',v) }catch(e){} }
function loadLevel(){ try{ return localStorage.getItem('squad-draft-level')||'normal' }catch(e){ return 'normal' } }
function saveLevel(v){ try{ localStorage.setItem('squad-draft-level',v) }catch(e){} }
// Each mode keeps its own match settings on this phone: players (2–4), points, pool and (Quickplay) computer level.
// Online: the room creator's settings are used. Story sets its own. The ⚙ Settings menu only has general options.
const MODES = ['local','online','cpu','practice','story'];
const MODE_DEFAULTS = {local:{players:2}, online:{players:2}, cpu:{players:2}, practice:{players:2, poolType:'all'}, story:{players:2}};   // + maxTeam 6, bans off
function loadModeCfg(mode){
  let c=null; try{ c=JSON.parse(localStorage.getItem('squad-draft-mode-'+mode)) }catch(e){}
  return Object.assign({players:2, budget:loadBudget(), poolType:loadPoolType(), level:loadLevel(), maxTeam:MAXTEAM, bans:false}, MODE_DEFAULTS[mode], c||{});
}
function saveModeCfg(mode, c){ try{ localStorage.setItem('squad-draft-mode-'+mode, JSON.stringify(c)) }catch(e){} }
// Copy a mode's settings into the game state (points, pool, players, level)
function useModeCfg(mode=S.mode){ const c=loadModeCfg(mode); if(mode==='cpu'||mode==='practice'||mode==='local') c.players=2;   // Quickplay and Practice: you vs one computer. Same Phone: 2 players (CK dropped 3 and 4, Nov 2, 2026)
  S.cfg=c; S.duo = mode!=='story' && c.players===4 && !!c.duo; S.budget=c.budget; S.poolType=c.poolType; S.level=c.level; S.sideWar=mode==='cpu'&&!!c.demonSide; S.maxTeam=mode==='story'?MAXTEAM:c.maxTeam; S.bansOn=mode!=='story'&&!!c.bans; if(mode!=='online') S.n=c.players; return c; }
const CPU_NAMES = ['Muzan AI','Kokushibo AI','Doma AI'];

// Saved data reset: when DATA_VERSION changes, every 'squad-draft…' key on this phone is cleared once (story, stats,
// daily streak, names, settings), then saving carries on as normal. Bumped to 3 on Oct 26, 2026 at CK's request
// ("clear all my data and save from this point on"), and to 4 on Oct 26, 2026 (CK: wipe all existing data for
// everyone again). Don't bump it again unless CK asks for another wipe.
const DATA_VERSION = '4';
try{ if(localStorage.getItem('squad-draft-data')!==DATA_VERSION){
  Object.keys(localStorage).filter(k=>k.startsWith('squad-draft')).forEach(k=>localStorage.removeItem(k));
  localStorage.setItem('squad-draft-data', DATA_VERSION); } }catch(e){}
let S = {phase:'setup', mode:'story', n:2,   // Story is selected when the game opens (CK)
  level: loadLevel(), budget: loadBudget(), poolType: loadPoolType(), names: [playerName()||'Player 1','Player 2']};
// Battle backgrounds outside story mode (Settings → Battle background): 'random' (default), 'off', or a place id from
// img/places/. Picked when a battle starts and shared online, so every phone shows the same place.
const PLACE_KEY = 'squad-draft-place';
function placeChoice(){ try{ return localStorage.getItem(PLACE_KEY)||'random' }catch(e){ return 'random' } }
function pickPlace(){
  const have = typeof PLACE_ART!=='undefined' ? Object.keys(PLACE_ART) : [], c=placeChoice();
  if(S.trial || c==='off' || !have.length) return null;
  if(c==='random'){ const ok=have.filter(id=>!/^(dr_|dream|six)/.test(id)); return ok.length ? ok[Math.floor(Math.random()*ok.length)] : null; }
  return have.includes(c) ? c : have[Math.floor(Math.random()*have.length)];
}
// Players in the match: 2, 3 (triple threat) or 4 (1 v 1 v 1 v 1). Every team fights every other team; last one standing wins.
const MAX_PLAYERS = 4;
const nPlayers = () => S.n || 2;
const players = () => Array.from({length:nPlayers()}, (_,i)=>i);
const others = p => players().filter(q=>q!==p);
// 2v2 (4 players, teams on): players 1 & 3 are one team, 2 & 4 the other (side = seat % 2). Otherwise everyone is alone.
// Co-op online (S.coop = 'final' or 'gauntlet'): the humans are one side, the last seat is the computer, played by the host
const foeSeat = () => nPlayers()-1, coopFoe = p => !!S.coop && p===foeSeat(), coopHumans = () => nPlayers()-1;
const finalFight = () => S.mode==='final' || S.coop==='final';
const sideOf = p => S.coop ? (p===foeSeat()?1:0) : S.duo ? p%2 : p;
const sameSide = (p,q) => sideOf(p)===sideOf(q);
const enemiesOf = p => players().filter(q=>!sameSide(p,q));
const partnersOf = p => players().filter(q=>q!==p && sameSide(p,q));
const allPicks = () => (S.picks||[]).flat();
const allUnits = () => (S.teams||[]).flat();
const rnd = a => a[Math.floor(Math.random()*a.length)];
// Playing against the computer (normal vs-computer games and story mode); the screen belongs to player 1
// Quickplay's Game Modes (js/daily.js): solo modes with their own draft and a reveal before each fight
const GAME_MODES = ['final','gauntlet','rush','random'], gameMode = () => GAME_MODES.includes(S.mode);
const vsCpu = () => S.mode==='cpu' || S.mode==='story' || S.mode==='practice' || S.mode==='daily' || gameMode();
// Practice: you draft for every team (the computers' picks too), then fight the computers. Doesn't count toward records.
const isPractice = () => S.mode==='practice';
// One person per screen (vs computer, story, online): label sides "You" / "Opponent" from that person's view
const soloView = () => S.mode!=='local';
// Health is shown as a percent of each fighter's own max HP (display only; the engine keeps raw HP)
const pct = (u,n=u.hp) => Math.round(n/u.max*100);
const LOW = 25;
// Log tags for health changes: the screens show [-17%] as red −17% and [+5%] as green +5%
const lost = (u,n) => `[-${pct(u,n)}%]`, gained = (u,n) => `[+${pct(u,n)}%]`;

/* ---------- draft ---------- */
// How likely a character is to be dealt, relative to 1 for everyone else. Yoriichi is rare (about 1 draft in 8),
// and when he is dealt, the old version is twice as likely as the prime one.
const FAMILY_ODDS = {yoriichi:.4};
const VERSION_ODDS = {michikatsu:.5, hakuji:.5, yoriichi:.5, muzan_final:.5, tanjiro_demon:.3};   // the stronger version of these comes up less often
// 30-point games deal more and stronger cards, so the hard pulls get their own odds to stay hard pulls
const STRONG_FAMILY_ODDS = {yoriichi:.4, kokushibo:1.6};
const STRONG_VERSION_ODDS = {michikatsu:.5, hakuji:.5, yoriichi:.5, muzan_final:.2, tanjiro_demon:.2};
// How likely a family / version is to be dealt in the current mode (relative to 1)
function familyOdds(fam, cards){
  if(!deal().strong) return FAMILY_ODDS[fam] ?? 1;
  if(fam in STRONG_FAMILY_ODDS) return STRONG_FAMILY_ODDS[fam];
  const top=Math.max(...cards.filter(c=>c.fam===fam).map(c=>c.cost));
  return 0.5 + top/8;   // a 2-pt character ×0.75, an 8-pt ×1.5, a 16-pt ×2.5
}
const versionOdds = c => deal().strong ? (STRONG_VERSION_ODDS[c.id] ?? (c.mark ? 2 : 1)) : (VERSION_ODDS[c.id] ?? 1);
// Weighted pick without replacement: takes one item out of `list` and returns it
function takeWeighted(list, w){
  let r=Math.random()*list.reduce((a,x)=>a+w(x),0);
  const i=Math.max(0, list.findIndex(x=>(r-=w(x))<0));
  return list.splice(i,1)[0];
}
// Deal random characters (12, or 14 in 30-point games), one version each (base OR Mark OR old/young Yoriichi). Always at least 3 cheap (≤4) picks.
// Split-off forms (Hantengu's emotions) are never dealt, nor is anything over maxCardCost().
// The back-pocket helpers are offered in every draft, on top of the characters dealt
const HELPERS = ROSTER.filter(c=>c.helper).map(c=>c.id);
const DREAM_HELPERS = ['aoi','chuntaro','goto','tecchin'];   // unlocked in The Endless Dream; the daily challenge stays on the first five so it's the same for everyone
// Each draft offers 3 of the back-pocket helpers, picked at random (CK, Oct 26, 2026: there are 5 now). rand: a seeded
// generator for drafts that must be the same everywhere (the daily challenge).
const HELPERS_DEALT = 3;
function dealHelpers(rand=Math.random){ const left=HELPERS.filter(id=>rand===Math.random ? S.unlockAll || typeof isUnlocked!=='function' || isUnlocked(id) : !DREAM_HELPERS.includes(id)), out=[]; while(out.length<HELPERS_DEALT && left.length) out.push(left.splice(Math.floor(rand()*left.length),1)[0]); return out; }
const isHelper = id => !!BYID[id].helper;
const fighterIds = p => S.picks[p].filter(id=>!isHelper(id));
function buildPool(){
  // story unlocks (story.js): only characters this phone has unlocked are dealt (the host's phone, online)
  const open = c => S.unlockAll || typeof isUnlocked!=='function' || isUnlocked(c.id);
  const cards=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=maxCardCost() && open(c) && poolSide(c)), fams=[...new Set(cards.map(c=>c.fam))];
  // "All" pool: every character and every version (still one version per character per draft, via famTaken)
  if(fullPool()) return cards.map(c=>c.id).sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name)).concat(dealHelpers());
  for(let tries=0;tries<200;tries++){
    const left=fams.slice(), f=[];
    while(f.length<Math.min(poolSize(),fams.length)) f.push(takeWeighted(left, x=>familyOdds(x,cards)));   // a new phone with few unlocks can have fewer characters than a 4-player deal
    const ids=f.map(fam=>takeWeighted(cards.filter(c=>c.fam===fam), versionOdds).id);
    addRivals(ids, cards);
    if(ids.filter(id=>BYID[id].cost<=4).length>=3+(nPlayers()-2)*2) return ids.sort((a,b)=>BYID[b].cost-BYID[a].cost).concat(dealHelpers());
  }
  return cards.slice(0,poolSize()).map(c=>c.id).concat(dealHelpers());
}
// Big cards come with a rival (CK, Oct 28, 2026): a card of RIVAL_MIN+ points is always dealt with another character
// within RIVAL_GAP points of it, so a lone Final Form Muzan isn't decided by who picks first. If the deal has none,
// a mid-priced card (over 4 points, so the cheap-card guarantee holds) is swapped for one. Same deal size.
const RIVAL_MIN = 9, RIVAL_GAP = 3;
// Few cards sit near the top of the points, so Kokushibo kept being the rival (CK, Oct 30, 2026): he's picked less often
const RIVAL_ODDS = {kokushibo:.25};
// Never each other's rival: a card and its direct counter (CK, Oct 28, 2026: Muzan was always being dealt next to a
// Yoriichi and fell to ~25%). Either way round, by family.
const NOT_RIVALS = [['muzan','yoriichi']];
const counterPair = (a,b) => NOT_RIVALS.some(([x,y])=>(BYID[a].fam===x&&BYID[b].fam===y)||(BYID[a].fam===y&&BYID[b].fam===x));
function addRivals(ids, cards){
  const cost=id=>BYID[id].cost, near=(a,b)=>Math.abs(cost(a)-cost(b))<=RIVAL_GAP && !counterPair(a,b);
  ids.slice().sort((a,b)=>cost(b)-cost(a)).forEach(big=>{
    if(cost(big)<RIVAL_MIN || !ids.includes(big) || ids.some(o=>o!==big && near(o,big))) return;
    const fams=new Set(ids.map(id=>BYID[id].fam)), rivals=cards.filter(c=>!fams.has(c.fam) && near(c.id,big));
    const out=ids.filter(id=>id!==big && cost(id)>4 && !near(id,big));
    if(!rivals.length || !out.length) return;
    ids[ids.indexOf(out[Math.floor(Math.random()*out.length)])] = takeWeighted(rivals, c=>RIVAL_ODDS[c.fam]??1).id;
  });
}
// first = the player who won the spin and picks first (0 or 1)
function newDraft(first=0){
  Object.assign(S,{phase:'draft', first, lastPicker:null, history:[], picks:players().map(()=>[]), locked:players().map(()=>false), k:0, sel:null, pool:buildPool(),
    banning:!!S.bansOn, bans:[]});
}
// Who picks first: a fair coin flip, shown as a wheel. Returns the winner and how far to turn the wheel.
const WHEEL_SEGS = 8;
const wheelSegs = () => nPlayers()===3 ? 9 : WHEEL_SEGS;   // slices take turns between the players
/* ---------- who picks first: "I'm thinking of a number" (CK, Oct 28, 2026: replaces the wheel) ----------
   A character thinks of a number from 1 to 9, shown as nine numbered character cards. Everyone takes a different
   number (the computer picks at random); whoever is closest picks first. On a tie one of the two calls a coin flip
   (CK, Nov 1, 2026), and the other gets the other side. Numbers are all different, so a tie is always two players.
   S.spin = {game:'guess', host, cards, secret, picks:[number or 0 per player], state:'picking'|'coin'|'done', r, tied, call, flip} */
const GUESS_HOSTS = ['kagaya','urokodaki','tengen','shinobu','tamayo'];
function newGuess(){
  const fams=ROSTER.filter(c=>c.id===c.fam && !c.helper && !c.spawn).map(c=>c.id), cards=[];
  while(cards.length<9 && fams.length) cards.push(fams.splice(Math.floor(Math.random()*fams.length),1)[0]);
  return {game:'guess', host:GUESS_HOSTS[Math.floor(Math.random()*GUESS_HOSTS.length)], cards, secret:1+Math.floor(Math.random()*9), picks:players().map(()=>0), state:'picking'};
}
// whose number it is on a shared screen (Local: in order), or -1
const guessTurn = () => { const g=S.spin; return g && g.state==='picking' ? g.picks.findIndex(n=>!n) : -1; };
function guessPick(p, n){
  const g=S.spin; n=+n;
  if(!g || g.state!=='picking' || !(p>=0 && p<g.picks.length) || g.picks[p] || !(n>=1 && n<=9) || g.picks.includes(n)) return false;
  g.picks[p]=n; if(g.picks.every(Boolean)) guessReveal(); return true;
}
function cpuGuess(p){ const g=S.spin, free=[1,2,3,4,5,6,7,8,9].filter(n=>!g.picks.includes(n)); return guessPick(p, free[Math.floor(Math.random()*free.length)]); }
function guessReveal(){
  const g=S.spin, d=g.picks.map(n=>Math.abs(n-g.secret)), best=Math.min(...d), tied=players().filter(p=>d[p]===best);
  if(tied.length>1){ g.tied={who:tied, away:best}; g.state='coin'; return; }
  g.r=tied[0]; g.state='done';
}
const COIN_SIDES = ['heads','tails'];
function guessCall(p, side){
  const g=S.spin; if(!g || g.state!=='coin' || !g.tied.who.includes(p) || !COIN_SIDES.includes(side)) return false;
  g.call={p, side}; g.flip=COIN_SIDES[Math.floor(Math.random()*2)]; g.r=g.flip===side ? p : g.tied.who.find(q=>q!==p); g.state='done'; return true;
}
const cpuCall = () => guessCall(S.spin.tied.who[0], COIN_SIDES[Math.floor(Math.random()*2)]);
// The old wheel's random first picker: still used as the coin flip for own-pace games and by the tests
function spinWheel(){
  const n=nPlayers(), segs=wheelSegs(), r = Math.floor(Math.random()*n), seg = 360/segs;
  const i = r + n*Math.floor(Math.random()*segs/n);   // slice i belongs to player i % n
  const at = i*seg + seg*(.15 + Math.random()*.7);           // land inside the slice, never on a line
  return {r, angle: 360*6 + (360-at)};
}
const spent = p => S.picks[p].reduce((a,id)=>a+BYID[id].cost,0);
const famTaken = fam => allPicks().some(id=>BYID[id].fam===fam);
const banned = fam => (S.bans||[]).some(b=>BYID[b.id].fam===fam);
const taken = id => famTaken(BYID[id].fam) || banned(BYID[id].fam);
// Optional bans (per-mode setting, off by default): before the first pick each player, in order from the first
// picker, bans one character (every version of it). The draft then starts as usual.
const banTurn = () => ((S.first||0) + S.bans.length) % nPlayers();
const canBan = (p,id) => S.banning && banTurn()===p && S.pool.includes(id) && !BYID[id].helper && !banned(BYID[id].fam);
function doBan(id){ const p=banTurn(); S.bans.push({p,id}); S.sel=null; if(S.bans.length>=nPlayers()) S.banning=false; }
// The computer bans the priciest card still in the pool
function cpuBan(){ const ok=S.pool.filter(id=>canBan(banTurn(),id)).sort((a,b)=>BYID[b].cost-BYID[a].cost || Math.random()-.5); doBan(ok[0]); }
// helpers don't take one of the 6 fighter slots, but each player may have only one helper
function canPick(p,id){ const c=BYID[id]; if(S.sideWar && !c.helper && slayerSide(c)===(p===0)) return false;   // Demon Side: you draft demons, the computer slayers
  return !S.banning && !taken(id) && !S.locked[p] && (c.helper ? !S.picks[p].some(isHelper) : fighterIds(p).length<teamCap()) && c.cost <= budget()-spent(p); }
const canAny = p => S.pool.some(id=>canPick(p,id));
// Whose pick it is: snake order, skipping a player who has locked
function turn(){ return S.banning ? banTurn() : turnAt(S.k); }
// Snake order from the first picker: 2 players A B B A A B…, 3 players A B C C B A A B C…, and so on
function rawTurn(k){ const n=nPlayers(), r=Math.floor(k/n), i=k%n, j=r%2 ? n-1-i : i; return ((S.first||0)+j)%n; }
function turnAt(k){ for(let j=k;j<k+4*nPlayers();j++){ const p=rawTurn(j); if(!S.locked[p]) return p; } return rawTurn(k); }
// The next n picks in order (shown on the draft screen so players can see a double pick coming)
const pickOrder = n => Array.from({length:n},(_,i)=>turnAt(S.k+i));
function checkLocks(){ players().forEach(p=>{ if(!S.locked[p] && !canAny(p)) S.locked[p]=true; }); }
function afterTurn(){
  checkLocks();
  if(S.locked.every(Boolean)) startBattle();
}
function doPick(id){
  const p=turn();
  S.history.push({p, id, lastPicker:S.lastPicker, locked:S.locked.slice()});   // for Undo
  S.picks[p].push(id); S.lastPicker=p; S.k++;
  S.sel=null; afterTurn();
}
function doLock(p){ S.history.push({lock:true}); S.locked[p]=true; S.lastPicker=p; S.sel=null; S.k++; afterTurn(); }
// The pick Undo would take back: the latest action, if it was a pick and the draft is still going (else null)
const undoable = () => { const h=S.phase==='draft' && S.history && S.history[S.history.length-1]; return h && !h.lock ? h : null; };
function undoPick(){
  const h=undoable(); if(!h) return;
  S.history.pop(); S.picks[h.p].pop(); S.k--; S.lastPicker=h.lastPicker; S.locked=h.locked; S.sel=null;
}
// Two-character synergies the computer drafter looks for
const PAIRS = [['hinatsuru','makio'],['makio','suma'],['hinatsuru','suma'],['tanjuro','tanjiro'],['makomo','sabito'],['hinatsuru','tengen'],['makio','tengen'],['suma','tengen'],['urokodaki','sabito'],['sabito','tanjiro'],['tanjiro','nezuko'],['tamayo','yushiro'],['yoriichi','tanjiro'],['urokodaki','tanjiro'],['urokodaki','giyu'],
  ['tanjiro','zenitsu'],['tanjiro','inosuke'],['zenitsu','inosuke'],
  ['gyutaro','daki'],['susamaru','yahaba'],['kanae','shinobu'],['kanae','kanao'],['muichiro','typezero']];
// Computer difficulty. Easy plays like the original simple computer; Normal plays smart but with sloppier choices;
// Hard is the full planner. Noise = random wobble added to every option's score (bigger = more mistakes).
const LEVELS = {easy:{label:'Easy', draftNoise:12}, normal:{label:'Normal', draftNoise:6, noise:22}, hard:{label:'Hard', draftNoise:3, noise:4}};
function cpuDraftStep(level='hard'){
  const p=turn();
  const left=budget()-spent(p);
  if(fighterIds(p).length && left<=2 && Math.random()<.5){ doLock(p); return; }
  const mine=S.picks[p].map(id=>BYID[id]);
  const ok=S.pool.map(id=>BYID[id]).filter(c=>canPick(p,c.id));
  ok.forEach(c=>{
    // value cost, but leave room so the remaining budget is usable
    const rest=left-c.cost;
    c._w = c.cost*1.2 + Math.random()*LEVELS[level].draftNoise
      + (c.upper && mine.some(m=>m.upper)?3:0)
      + (c.demon && mine.some(m=>m.fam==='muzan')?2:0)
      + (c.hashira && mine.some(m=>m.hashira||m.fam==='kagaya')?2:0)
      + (c.fam==='kagaya' && mine.some(m=>m.hashira)?2:0)
      + (PAIRS.some(([a,b])=>(c.fam===a&&mine.some(m=>m.fam===b))||(c.fam===b&&mine.some(m=>m.fam===a)))?3:0)
      + (rest>0 && rest<3 ? -2 : 0);
  });
  ok.sort((a,b)=>b._w-a._w); doPick(ok[0].id);
}

/* ---------- battle setup ---------- */
let UID=0;
// Final Form: Muzan's side, including forms that appear mid-battle (Zohakuten)
const finalUp = (v,p) => finalFight() && p===foeSeat() ? Math.round(v*(1+FINAL_POW)) : v;
function mkUnit(id,p){ const c=BYID[id]; return {uid:'u'+(UID++),id,fam:c.fam,sk:c.sk,p,name:c.short,g:c.g,hp:c.hp,max:c.hp,pow:finalUp(c.pow,p),spd:c.spd,def:c.def,
  regen:c.regen||0,revive:c.revive||0,demon:!!c.demon,mark:!!c.mark,legend:!!c.legend,strikes:c.strikes||1,cap:c.cap||0,taken:0,grit:c.id==='murata',
  sunproof:!!c.sunproof,noPoison:!!c.noPoison,vowed:false,noDefend:!!c.noDefend,basic:c.basic||null,anchor:c.anchor||null,emo:!!c.emo,kin:c.kin||null,drums:!!c.drums,splitOnHit:c.splitOnHit||null,
  sig:c.sig,cd:0,alive:true,spawn:!!c.spawn,splits:c.splits||null,merge:c.merge||null,poison:null,stun:false,stunNext:false,defending:false,evade:false,sunburn:false}; }
// Applies team bonuses to the units and returns their labels ('!' prefix = a penalty)
function synergies(p){
  const t=S.teams[p], e=enemiesOf(p).flatMap(q=>S.teams[q]), has=f=>t.some(u=>u.fam===f), out=[];
  if(has('tanjiro')&&has('zenitsu')&&has('inosuke')){ t.forEach(u=>u.spd+=2); out.push('Kamaboko Squad +2 SPD'); }
  if(has('tanjiro')&&has('nezuko')){ S.sib[p]=true; out.push('Siblings counter'); }
  const ha=t.filter(u=>BYID[u.id].hashira); if(ha.length>=2){ ha.forEach(u=>u.pow+=1); out.push('Hashira +1 PWR'); }
  const um=t.filter(u=>BYID[u.id].upper); if(um.length>=2){ um.forEach(u=>u.regen+=1); out.push('Upper Moons +1 regen'); }
  if(has('muzan') && t.some(u=>u.demon && u.fam!=='muzan' && u.fam!=='nezuko')){ t.filter(u=>u.demon&&u.fam!=='nezuko').forEach(u=>u.pow+=1); out.push("Muzan's Blood +1 PWR"); }
  const mk=t.filter(u=>u.mark); if(mk.length>=2){ mk.forEach(u=>u.spd+=1); out.push('Marks spread +1 SPD'); }
  if(has('tamayo')&&has('yushiro')){ t.filter(u=>u.fam==='yushiro').forEach(u=>u.pow+=2); out.push('Devoted: Yushiro +2 PWR'); }
  if(has('muzan') && e.some(u=>u.fam==='tamayo')){ t.filter(u=>u.fam==='muzan').forEach(u=>u.regen=Math.max(0,u.regen-2)); out.push("!Tamayo's medicine −2 regen"); }
  if(has('yoriichi')&&has('tanjiro')){ t.filter(u=>u.fam==='tanjiro').forEach(u=>u.pow+=2); out.push('Sun Lineage: Tanjiro +2 PWR'); }
  if(has('muzan') && e.some(u=>u.fam==='yoriichi')){ t.filter(u=>u.fam==='muzan').forEach(u=>{u.pow-=3; u.spd-=2;}); out.push('!Muzan fears the Sun −3 PWR'); }
  if(has('kokushibo') && e.some(u=>u.fam==='yoriichi')){ t.filter(u=>u.fam==='kokushibo').forEach(u=>u.def-=1); out.push('!Kokushibo shaken −1 DEF'); }
  const pupils=t.filter(u=>u.fam==='tanjiro'||u.fam==='giyu'||u.fam==='sabito'); if(has('urokodaki') && pupils.length){ pupils.forEach(u=>u.def+=1); out.push('Mentor: pupils +1 DEF'); }
  const wives=t.filter(u=>['hinatsuru','makio','suma'].includes(u.fam));
  if(wives.length===3){ wives.forEach(u=>u.spd+=1); out.push('The Three Wives: +1 SPD'); }
  if(wives.length && has('tengen')){ t.filter(u=>u.fam==='tengen').forEach(u=>u.pow+=1); out.push("Tengen's Family: Tengen +1 PWR"); }
  if(has('tanjuro') && has('tanjiro')){ t.filter(u=>u.fam==='tanjiro').forEach(u=>u.pow+=2); out.push('Father and Son: Tanjiro +2 PWR'); }
  if(has('makomo') && has('sabito')){ t.filter(u=>u.fam==='makomo'||u.fam==='sabito').forEach(u=>u.spd+=1); out.push("Urokodaki's Pupils: +1 SPD"); }
  if(has('kagaya') && ha.length){ ha.forEach(u=>u.def+=1); out.push('Corps Master: Hashira +1 DEF'); }
  if(has('gyutaro')&&has('daki')){ S.twins[p]=true; t.filter(u=>u.fam==='gyutaro').forEach(u=>u.pow+=2); out.push('Two as One: Gyutaro +2 PWR'); }
  if(has('susamaru')&&has('yahaba')){ t.filter(u=>u.fam==='susamaru').forEach(u=>u.pierceAll=true); out.push('Temari & Arrows: past Defend'); }
  if(has('kanae')&&has('shinobu')){ t.filter(u=>u.fam==='shinobu').forEach(u=>u.poisonTurns=4); out.push('Kocho Sisters: longer poison'); }
  if(has('kanae')&&has('kanao')){ t.filter(u=>u.fam==='kanao').forEach(u=>u.pow+=1); out.push("Kanae's student: Kanao +1 PWR"); }
  if(has('typezero')&&has('muichiro')){ t.filter(u=>u.fam==='muichiro').forEach(u=>u.pow+=1); out.push('Training partner: Muichiro +1 PWR'); }
  // CK, Nov 3, 2026: six more from the story
  if(has('sanemi')&&has('genya')){ t.filter(u=>u.fam==='sanemi'||u.fam==='genya').forEach(u=>u.pow+=2); out.push('Brothers: Sanemi and Genya +2 PWR'); }
  if(has('obanai')&&has('mitsuri')){ t.filter(u=>u.fam==='obanai'||u.fam==='mitsuri').forEach(u=>{ u.spd+=1; u.pow+=1; }); out.push('Love Hashira: Obanai and Mitsuri +1 PWR, +1 SPD'); }
  if(has('rengoku')&&has('tanjiro')){ t.filter(u=>u.fam==='tanjiro').forEach(u=>u.pow+=1); t.filter(u=>u.fam==='rengoku').forEach(u=>u.def+=1); out.push('Set Your Heart Ablaze: Tanjiro +1 PWR, Rengoku +1 DEF'); }
  if(has('giyu')&&has('sabito')){ t.filter(u=>u.fam==='giyu').forEach(u=>{ u.pow+=2; u.def+=1; }); t.filter(u=>u.fam==='sabito').forEach(u=>u.spd+=1); out.push('Old Friends: Giyu +2 PWR +1 DEF, Sabito +1 SPD'); }
  if(has('rengoku') && e.some(u=>u.fam==='akaza')){ t.filter(u=>u.fam==='rengoku').forEach(u=>u.pow+=2); out.push('Rival: Rengoku +2 PWR'); }
  if((has('kanao')||has('inosuke')) && e.some(u=>u.fam==='doma')){ t.filter(u=>u.fam==='kanao'||u.fam==='inosuke').forEach(u=>{ u.spd+=2; u.revenge='doma'; }); out.push('Revenge on Doma: +2 SPD, +4 damage to Doma through his DEF'); }
  if(has('zenitsu') && e.some(u=>u.fam==='kaigaku')){ t.filter(u=>u.fam==='zenitsu').forEach(u=>u.pow+=2); out.push('Rival: Zenitsu +2 PWR'); }
  return out;
}
function startBattle(){
  S.n=S.picks.length;
  if(gameMode() && !S.picks[1].length) S.picks[1]=gmEnemy();   // the enemy is chosen once your squad is locked (js/daily.js)
  if(S.coop && !S.picks[foeSeat()].length) S.picks[foeSeat()]=gmEnemy();
  S.teams=players().map(p=>fighterIds(p).map(id=>mkUnit(id,p)));
  S.helpers=players().map(p=>S.picks[p].filter(isHelper)); S.helperPlan=players().map(()=>[]); S.scoutQueue=[]; S.scouting=false; S.clipSeen={};   // move clips: repeat moments shown this match (js/clips.js)
  S.place = S.mode==='story' ? null : pickPlace();   // the background for this match (story battles use their own)
  if(S.mode!=='story'){ S.twist=null; S.startState=null; S.boosts=null; S.phases=null; S.beats=null; S.awaken=null; }   // story twists never leak into other games
  S.waveQ=null; S.said={}; S.failed=false; S.awoke={}; S.midScene=null; S.pendingAwake=[]; S.chainDone=false; S.chainPending=null;
  S.survived=false; S.htMore={}; S.htHide={};
  S.sib=players().map(()=>false); S.twins=players().map(()=>false); S.syn=players().map(p=>synergies(p)); S.outOrder=[];
  S.synShown=false; S.upSeen={};
  S.round=1; S.plans=players().map(()=>({})); S.lastPlans=players().map(()=>null); S.log=[]; S.matchLog=[]; S.planFor=S.me||0; S.focus=null; S.stats={};
  S.movesLocked=players().map(()=>false); S.readyNext=players().map(()=>false); S.roundId=0;   // online play
  // story: stat boosts shown on the stage card ({side, hp: ×, pow/def/spd: +, label}), e.g. a boss with more HP
  (S.boosts||[]).forEach(b=>S.teams[b.side].forEach(u=>{ if(b.only && !b.only.includes(u.id)) return;
    if(b.hp){ u.max=u.hp=Math.round(u.max*b.hp); } u.pow+=b.pow||0; u.def+=b.def||0; u.spd+=b.spd||0; }));
  // story: an enemy that starts the fight already hurt (part 2 of a two-part fight)
  Object.entries(S.startState||{}).forEach(([id,st])=>S.teams[1].filter(u=>u.id===id).forEach(u=>{
    if(st.hp) u.hp=Math.ceil(u.max*st.hp); if(st.devoured) u.devoured=st.devoured; if(st.poison) u.poison={...st.poison}; }));
  if(S.coop) S.movesLocked[foeSeat()]=true;
  S.phase = gameMode() ? 'reveal' : S.mode==='local' && !S.tvDuo ? 'pass' : 'plan';   // TV 2-player: each phone picks in secret, no passing
}
const alive = p => S.teams[p].filter(u=>u.alive);
const findU = uid => allUnits().find(u=>u.uid===uid) || Object.values(S.htHide||{}).map(h=>h&&h.u).find(u=>u&&u.uid===uid);   // a hiding real Hantengu is off the board but still known
// Every enemy fighter still standing, from all the other teams
const foes = p => enemiesOf(p).flatMap(q=>alive(q));
// Your fighters and (2v2) your partner's: who ally moves (heals, hides, shields, training) can target
const friends = p => players().filter(q=>sameSide(p,q)).flatMap(q=>alive(q));

// The special a "Name: Special!" log line was for (line.sig = its id; none = the card's first special)
function sigOfLine(u, line){ const c=BYID[u.id]||{}, id=line&&line.sig; return !id || id==='unblock' ? c.sig||u.sig : id==='selfless' ? SELFLESS : c.sig2&&c.sig2.id===id ? c.sig2 : u.sig; }
// Mark Tanjiro's Selfless State is open once Destructive Death is won (story.js decides; simulations always have it)
const selflessOpen = () => !!S.unlockAll || typeof selflessUnlocked!=='function' || selflessUnlocked();
const canSelfless = u => BYID[u.id] && BYID[u.id].selfless && !u.selflessUsed && selflessOpen();
// In the Selfless State Tanjiro is hidden, except on a round he attacks: striking reveals him (A), so he can't hit and
// stay untouchable at once. He can Save a teammate once per state (B). Both chosen Oct 27, 2026.
const hidden = t => !!(t && t.selfless && !t.reveal);
// A second special with a story lock (sig2.lock = the battle that reveals it) joins the cycle once that battle is won
const sig2Open = card => !!card.sig2 && (!card.sig2.lock || !!S.unlockAll || typeof storyReached!=='function' || storyReached(card.sig2.lock));
/* ---------- move planning ---------- */
const isAllyMove = (u,pl) => (pl.type==='special' && u.sig.kind==='ally') || pl.type==='save';   // save: Tanjiro's Selfless State
// Free-for-all (3–4 players): a special that hits "every enemy" hits every fighter on the team you aim at, so you pick a target
const aimsTeam = u => u.sig.kind==='all' && nPlayers()>2 && !S.coop;
const needsTarget = (u,pl) => (pl.type==='attack' && !(u.basic && u.basic.kind==='self')) || pl.type==='save' || (pl.type==='special' && (u.sig.kind==='single'||u.sig.kind==='ally'||aimsTeam(u)));
const targetOptions = (u,pl) => !needsTarget(u,pl) ? [] : isAllyMove(u,pl) ? friends(u.p).filter(f=>pl.type!=='save'||f!==u) : foes(u.p);
function unitReady(u){ if(u.stun) return true; const pl=S.plans[u.p][u.uid]; if(!pl||!pl.type) return false; if(pl.type==='hunt') return pl.spot!=null; return !needsTarget(u,pl) || !!pl.t; }
// Hantengu H: the team hiding its real Hantengu from player p (or undefined)
const huntTeam = p => (S.htHide ? enemiesOf(p).find(q=>S.htHide[q]) : undefined);
const planReady = p => alive(p).every(unitReady);
function setMove(u,type){
  const pl=S.plans[u.p][u.uid]||{};
  if(pl.type!==type){ const wasAlly=pl.type && isAllyMove(u,pl); pl.type=type; if(wasAlly!==isAllyMove(u,pl)) delete pl.t; }
  // only one possible target: pick it for them
  const opts=targetOptions(u,pl); if(!pl.t && opts.length===1) pl.t=opts[0].uid;
  S.plans[u.p][u.uid]=pl;
}

/* ---------- computer player ----------
   Scores each option (attack each enemy, or the special) and takes the best. Damage is scored as % of the
   target's max HP, with a big bonus for a knockout. Fighters planned earlier in the round "reserve" the damage
   they expect to do, so the team spreads out instead of overkilling one target. */
// Damage a hit of `base` would do to `t`, by the same formula as hit() (ignores guards and dodges)
function estHit(t, base, o={}){
  if((t.selfless||t.saved) && !o.unblockable) return 0;
  let d = o.ignoreDef ? base : Math.max(1, base - t.def, Math.ceil(base/2));
  return Math.max(0, t.cap ? Math.min(d, t.cap) : d);
}
// Damage specials: what they hit and how hard. Specials not listed here are scored by hand in cpuPlan().
const SIG_EST = {
  yoriichi: u=>({all:true, base:u.pow, o:{ignoreDef:true}}),
  yoriichi_old: u=>({base:u.pow+10, o:{ignoreDef:true}}),
  tanjiro: u=>({base:u.pow+5, o:{ignoreDef:true}}),
  nezuko: ()=>({all:true, base:5, o:{ignoreDef:true}}),
  zenitsu: u=>({base:u.pow*2}),
  inosuke: u=>({random:2, base:u.pow-1}),
  kanao: u=>({base:u.pow+4}),
  murata: u=>({base:u.pow+2}),
  urokodaki: u=>({base:u.pow+3}),
  gyomei: u=>({all:true, base:u.sig.dmg, o:{ignoreDef:true}}),
  sanemi: u=>({base:u.pow, bonus:1.6}),          // also hits a second enemy
  kaigaku: u=>({base:u.pow+3, bonus:1.3}),
  muichiro: u=>({base:u.pow+2}),
  makomo: u=>({base:u.pow, bonus:1.3}), makio: u=>({base:u.pow+3}), hakuji: u=>({base:u.pow+3}), michikatsu: u=>({base:u.pow+Math.min(6,S.round)}), hinatsuru: u=>({base:u.pow, bonus:1.5}), suma: u=>({random:1, base:u.pow}), dojo_fighter: u=>({base:u.pow+2}),
  mitsuri: u=>({all:true, base:u.pow-3, o:{pierce:true}}),
  obanai: u=>({base:u.pow+4}),
  rengoku: u=>({base:u.pow+4}),
  seventh: u=>({base:u.pow*3, o:{ignoreDef:true}}),
  annihilation: u=>({all:true, base:u.pow-4, o:{ignoreDef:true}}),
  ninth: u=>({base:u.pow+10, o:{ignoreDef:true}}),
  tengen: u=>({all:true, base:u.pow-2}),
  rui: u=>({base:u.pow, stun:true}),
  hand: u=>({base:u.pow+3}),
  swamp: u=>({base:u.pow+1}),
  gyutaro: ()=>({all:true, base:8, o:{ignoreDef:true}}),   // 4 now plus 4 of poison
  akaza: u=>({base:u.pow+6}),
  doma: u=>({all:true, base:u.pow-4, o:{ignoreDef:true}}),
  kokushibo: u=>({all:true, base:u.pow-4, o:{ignoreDef:true}}),
  muzan: u=>({all:true, base:u.pow-7, o:{ignoreDef:true}}),
  muzan_final: u=>({all:true, base:u.pow-6, o:{ignoreDef:true}}),
  gyokko: u=>({base:u.pow-2, o:{ignoreDef:true}, stun:true}),
  sekido: ()=>({all:true, base:5, o:{ignoreDef:true}}),
  karaku: u=>({all:true, base:Math.max(1,u.pow-6)}),
  aizetsu: u=>({base:u.pow+4, o:{pierce:true}}),
  urogi: u=>({base:u.pow+2}),
  daki: u=>({all:true, base:u.pow-3}),
  zohakuten: u=>({all:true, base:u.pow, o:{pierce:true}}),
  susamaru: u=>({base:u.pow-1, bonus:1.6}),          // also hits a second enemy
  kanae: u=>({base:u.pow+3, bonus:1.15}),             // plus a small heal
  tanjiro_demon: u=>({all:true, base:u.pow-4, o:{ignoreDef:true}}),
  nezuko_awakened: ()=>({all:true, base:10, o:{ignoreDef:true}}),
};
// Easy: the original simple computer. Specials at random when ready, always hits whoever has the least HP.
function cpuPlanEasy(p){
  const enemy=foes(p);
  alive(p).forEach(u=>{
    if(u.stun) return;
    const low=enemy.slice().sort((a,b)=>a.hp-b.hp)[0];
    let type='attack';
    if(u.cd===0 && Math.random()<.7 && !(u.sk==='kagaya' && !markReady(u).length)) type='special';
    else if(u.hp<u.max*.5 && Math.random()<(u.hp<u.max*.3?.5:.2) && !u.noDefend && !u.selfless) type='defend';
    let t=low.uid;
    if(u.sig.kind==='ally'){ const hurt=alive(p).slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0]; t=hurt.uid; if(type==='special' && u.sk==='tamayo' && hurt.hp>hurt.max*.75) type='attack'; if(type==='attack') t=low.uid; }
    S.plans[p][u.uid]={type, t};
  });
}
// "Repeat last round": give each fighter the move they used last round. A special still recharging becomes Attack;
// a target that's gone is dropped (or replaced when there's only one choice left).
function repeatPlans(p){
  const last=S.lastPlans && S.lastPlans[p]; if(!last) return;
  alive(p).forEach(u=>{
    const q=last[u.uid]; if(u.stun || !q || !q.type) return;
    setMove(u, q.type==='special' && u.cd>0 ? 'attack' : q.type==='save' && (!u.selfless || u.saveUsed) ? (u.selfless?'attack':'defend') : q.type==='defend' && u.selfless ? 'attack' : q.type);
    const pl=S.plans[p][u.uid], opts=targetOptions(u,pl);
    if(needsTarget(u,pl)) pl.t = q.t && opts.some(o=>o.uid===q.t) ? q.t : opts.length===1 ? opts[0].uid : undefined;
  });
}
// How strongly the computer focuses the leading team in a free-for-all
const FFA_FOCUS = 150;
function cpuPlan(p, level='hard'){
  if(level==='easy') return cpuPlanEasy(p);
  const noise=finalFight() && p===foeSeat() ? 0 : LEVELS[level].noise;   // Muzan never misjudges a move
  const foesNow=foes(p), mine=alive(p), planned={};
  const left = t => t.hp - (planned[t.uid]||0);
  // Hard reads Dead Calm: with Giyu's ready, this round's stance is a fresh roll (fire everything, hold some, or hold
  // most), so a player can't learn when it's safe to shield. Odds = the chance each damage special is held back.
  const fin = finalFight() && p===foeSeat();   // Muzan: reads Dead Calm, goes for your strongest, and only guards a fighter about to fall
  const calm = level==='hard' && foesNow.find(f=>f.sk==='giyu' && f.cd===0 && !f.stun), stance=Math.random(), hold = !calm ? 0 : fin ? (S.heldCalm===S.round-1 ? .75 : .9) : stance<.3 ? 0 : stance<.75 ? .5 : .85;
  let guards=0;
  const threat = t => t.pow*t.strikes + (t.cd===0?4:0) + (t.sk==='kagaya' && t.cd===0 ? 8*markReady(t).length : 0) + (calm===t?5:0);   // Kagaya about to awaken Marks; Giyu about to shield
  // free-for-all: gang up on the team that's ahead (most health × power left), like real players would
  const power = q => alive(q).reduce((a,x)=>a+x.hp*x.pow,0), top=Math.max(1,...enemiesOf(p).map(power));
  const lead = t => nPlayers()>2 ? FFA_FOCUS*power(t.p)/top : 0;
  const held = t => t.anchor && foesNow.some(f=>f.id===t.anchor), root = t => foesNow.some(f=>f.anchor===t.id);   // Zohakuten can't fall while the real Hantengu lives
  const score = (t,d) => { const l=left(t); if(l<=0) return 0; d=Math.min(d,l); if(held(t)) return d/t.max*15; return d/t.max*100 + (d>=l ? 40+threat(t) : 0) + (d>0?lead(t):0) + (root(t)?30:0) + (t.id==='hantengu_true'?45:0); };
  const best = (base,o) => foesNow.reduce((b,t)=>{ const s=score(t,estHit(t,base,o))+threat(t)*(fin?2:.5)+Math.random()*(fin?12:noise); return s>b.s?{t,s}:b; },{t:foesNow[0],s:-1}).t;
  const pctHurt = m => m.hp/m.max;
  mine.forEach(u=>{
    if(u.stun) return;
    const ao=u.selfless?{ignoreDef:true}:undefined, at=best(u.pow,ao), atD=estHit(at,u.pow,ao)*u.strikes;
    let plan={type:'attack', t:at.uid, v:score(at,atD), hits:[[at,atD]]};
    // Nakime's Biwa Strum: slow down the most dangerous enemy. Kagaya's Words of Resolve: heal the team.
    if(u.basic && u.basic.cower) plan={type:'attack', v:12};
    else if(u.basic && u.basic.kind==='self') plan={type:'attack', v: mine.reduce((a,m)=>a+Math.min(2,m.max-m.hp)/m.max*100,0)};
    else if(u.basic){ const t=calm && Math.random()<.6 ? calm : foesNow.slice().sort((a,b)=>threat(b)-threat(a))[0]; plan={type:'attack', t:t.uid, v:8, hits:[]}; }   // Biwa Strum on Giyu: his Dead Calm comes too late
    // Selfless State: Save a teammate who's in danger, otherwise attack (he can't be hit anyway)
    if(u.selfless && !u.saveUsed){ const low=mine.filter(m=>m!==u).sort((a,b)=>pctHurt(a)-pctHurt(b))[0]; if(low && pctHurt(low)<.45) plan={type:'save', t:low.uid, v:45}; }
    if(u.cd===0){
      const e=u.sig.id==='selfless' ? null : SIG_EST[u.sig.id] || SIG_EST[u.sk]; let sp=null;
      if(u.sig.id==='selfless') sp={type:'special', v:35+mine.filter(m=>pctHurt(m)<.5).length*10};
      else if(e){ const x=e(u);
        if(x.all){ const teams=aimsTeam(u) ? enemiesOf(p).map(q=>alive(q)).filter(a=>a.length) : [foesNow];
          teams.forEach(team=>{ const c={type:'special', t:team[0].uid, v:0, hits:[]}; team.forEach(t=>{ const d=estHit(t,x.base,x.o); c.v+=score(t,d); c.hits.push([t,d]); }); if(!sp||c.v>sp.v) sp=c; }); }
        else if(x.random){ sp={type:'special', v:x.random*foesNow.reduce((a,t)=>a+score(t,estHit(t,x.base)),0)/foesNow.length, hits:[]}; }
        else { const t=best(x.base,x.o), d=estHit(t,x.base,x.o); sp={type:'special', t:t.uid, v:score(t,d)*(x.bonus||1)+(x.stun?10+threat(t):0), hits:[[t,d]]}; }
      } else {
        const hurt=mine.slice().sort((a,b)=>pctHurt(a)-pctHurt(b))[0];
        switch(u.sk){
          case 'giyu': { const danger=foesNow.filter(f=>f.cd===0).reduce((a,f)=>a+f.pow,0); sp={type:'special', v: danger>=12 || pctHurt(hurt)<.4 ? 30+danger : 0}; break; }
          case 'genya': sp={type:'special', v: S.round<=3 ? 40 : u.hp<u.max*.6 ? 30 : 12}; break;
          case 'tanjuro': sp={type:'special', v: mine.reduce((a,m)=>a+Math.min(3,m.max-m.hp)/m.max*100,0)}; break;
          case 'tamayo': { const sick=mine.find(m=>m.poison), t=sick||hurt; sp={type:'special', t:t.uid, v:Math.min(10,t.max-t.hp)/t.max*100+(sick?20:0)}; break; }
          case 'yushiro': sp={type:'special', t:hurt.uid, v: pctHurt(hurt)<.4 ? 45 : 0}; break;
          case 'sabito': { const t=mine.slice().sort((a,b)=>b.pow*b.strikes-a.pow*a.strikes)[0]; sp={type:'special', t:t.uid, v: S.round<=4 ? 35 : 15}; break; }
          case 'tengen_retired': sp={type:'special', t:hurt.uid, v: pctHurt(hurt)<.5 ? 30 : 0}; break;
          case 'hantengu': case 'hantengu_true': sp={type:'special', v: u.hp<u.max*.7 ? 35 : 10}; break;
          case 'kagaya': { const n=markReady(u).length; sp={type:'special', v: n ? 30+25*n : -999}; break; }
          case 'enmu': sp={type:'special', v: foesNow.filter(f=>f.cd<=1).length*14}; break;
          case 'shinobu': { const t=foesNow.slice().sort((a,b)=>(!!a.noPoison-!!b.noPoison)||(b.demon-a.demon)||(b.hp-a.hp))[0]; sp={type:'special', t:t.uid, v: t.poison||t.noPoison ? 0 : t.demon ? 45 : 25}; break; }
          case 'nakime': { const t=foesNow.slice().sort((a,b)=>threat(b)-threat(a))[0]; sp={type:'special', t:t.uid, v:15+threat(t)}; break; }
          case 'yahaba': { const t=foesNow.slice().sort((a,b)=>threat(b)-threat(a))[0]; sp={type:'special', t:t.uid, v:10+threat(t)*1.2}; break; }
          case 'typezero': { const t=mine.slice().sort((a,b)=>b.pow*b.strikes-a.pow*a.strikes)[0]; sp={type:'special', t:t.uid, v: S.round<=3 ? 25 : 10}; break; }
          case 'kyogai': { const t=foesNow.slice().sort((a,b)=>threat(b)-threat(a))[0]; sp={type:'special', t:t.uid, v:12+threat(t)}; break; }
        }
      }
      if(sp && e && Math.random()<hold){ sp=null; if(fin) S.heldCalm=S.round; }   // saved for a round the shield is down (a player who kept Dead Calm ready and unused froze a 90% hold: one squad won 31%, so he's less patient after a round)
      if(sp && sp.v+Math.random()*noise > plan.v+Math.random()*noise) plan=sp;
    }
    // could fall this round with nothing better to do: guard (never more than half the team, so it keeps attacking)
    if(!u.noDefend && !u.selfless && plan.type!=='save' && guards<(fin?1:Math.ceil(mine.length/2))){
      const danger=foesNow.map(f=>estHit(u,f.pow+(f.cd===0?4:0))*f.strikes).sort((a,b)=>b-a).slice(0,2).reduce((a,d)=>a+d,0);
      const [worth,odds]=level==='hard'?[45,.6]:[30,.4];
      if(plan.v<worth && (danger>=u.hp || (!fin && u.hp<=u.max*.25)) && !(fin&&u.spawn) && Math.random()<odds){ plan={type:'defend'}; guards++; }
    }
    if(u.drums && plan.type==='attack' && plan.v<(level==='hard'?30:20) && Math.random()<.6) plan={type:'drums'};   // Zohakuten: build up when there's nothing worth hitting
    (plan.hits||[]).forEach(([t,d])=>{ planned[t.uid]=(planned[t.uid]||0)+d; });
    S.plans[p][u.uid]={type:plan.type, t:plan.t};
  });
  // Hantengu H: while the real one hides, one fighter a round may gamble on a hiding place (more often while Zohakuten is healthy)
  const q=huntTeam(p); if(q!==undefined){ const z=alive(q).find(u=>u.id==='zohakuten'), mine=alive(p).filter(u=>!u.stun), odds=(level==='hard'?HUNT_ODDS:HUNT_ODDS*.8)*(z&&z.hp>z.max*.5?1:.2);
    if(mine.length && Math.random()<odds){ const u=mine.slice().sort((a,b)=>a.pow*a.strikes-b.pow*b.strikes)[0]; S.plans[p][u.uid]={type:'hunt', spot:Math.floor(Math.random()*HT_SPOTS)}; } }
}

/* ---------- resolving a round ---------- */
// Each log line keeps everyone's HP at that moment, so the round can be played back step by step
// What a line shows on the fight stage during playback: effect type, who did it (by) and who it landed on (on)
// move = 'attack' or 'special' while a fighter is acting (null for end-of-round effects), for the breathing-style effects and grouping
const fx = (type, by, on) => ({fx:type, by:by?by.uid:null, on:on?on.uid:null, move:S.curMove||null});
function L(t,c='',extra){ const hp={}; allUnits().forEach(u=>{ hp[u.uid]=u.hp; }); S.log.push(Object.assign({t,c,hp},extra)); }
function target(u,tid){ let t=findU(tid); if(!t||!t.alive||sameSide(t.p,u.p)){ const a=foes(u.p); t=a.length?rnd(a):null; } return t; }
function fall(t,a){ if(t.hp>0) return;
  if(t.id==='zohakuten' && htDown(t,a)) return; if(t.grit){ t.grit=false; t.hp=1; L(`${t.name} somehow survives on ${pct(t)}% health!`,'h',{...fx('heal',null,t), grit:true}); return; } if(t.revive){ t.hp=Math.ceil(t.max*t.revive); t.revive=0; L(`${t.name} falls… and rises again! Seven Hearts ${gained(t,t.hp)}.`,'x',{...fx('revive',null,t), knit:true}); return; }
  if(t.anchor && S.teams[t.p].some(u=>u.alive && u.id===t.anchor)){ t.hp=1; L(`${t.name} won't fall! The real ${BYID[t.anchor].short} is still alive.`,'x',{...fx('block',null,t), held:true});
    return; }
  // how it fell, for playback: burned away by the sun, or killed by Shinobu's blade or wisteria
  const ash=t.demon && !a && sunUp() && !sunSafe(t), wist=t.demon && ((a&&a.fam==='shinobu') || (!a && t.poison && t.poison.src==='shinobu'));
  t.alive=false; L(`${t.name} falls!`,'k',{ko:t.uid, ash, wist, ...fx('ko',a,t)});
  if(t.p===0) nextWave();   // Nine Hashira: the next one steps up
  // Gyutaro and Daki (Two as One): a fallen sibling gets back up (once each) at the end of the round if the other is still standing
  if(S.twins && S.twins[t.p] && (t.fam==='gyutaro'||t.fam==='daki') && !t.rose){ t.rise=true; t.rose=true; }
  // Shinobu's Wisteria Body: the demon who knocks her out devours her and is poisoned. Not Akaza: he never eats women.
  if(t.fam==='shinobu' && a && a.alive && a.demon && a.fam!=='akaza'){ a.devoured=5; L(`${a.name} devours Shinobu, but her body is full of wisteria poison. ${a.name} will lose ${lost(a,5)} every round.`,'h',fx('poison',null,a)); }
  if(t.splits) split(t);
  if(t.merge) merge(t);
  S.teams[t.p].filter(u=>u.alive && u.anchor===t.id).forEach(u=>{ u.hp=0; L(`With the real ${t.name} gone, ${u.name} crumbles.`,'k',fx('hit',a,u)); fall(u,a); });
  S.teams[t.p].filter(u=>(u.alive||u.down) && u.kin===t.id).forEach(u=>{ u.hp=0; u.alive=false; u.down=null; L(`With the real Hantengu gone, ${u.name} crumbles away.`,'k',{ko:u.uid, ash:true, ...fx('ko',null,u)}); });
  if(t.emo){   // Hantengu's emotions
    if(!S.htMore[t.p]){ S.htMore[t.p]=true; const k=['aizetsu','urogi'].map(id=>mkUnit(id,t.p)); S.teams[t.p].push(...k);
      L(`Cutting ${t.name} only makes more! Aizetsu and Urogi burst out.`,'x',{spawn:k.map(x=>x.uid), htmore:{from:t.uid}, ...fx('spawn',null,t)}); }
    else if(!S.teams[t.p].some(u=>u.alive && u.emo)){ const z=mkUnit('zohakuten',t.p); S.teams[t.p].push(z); S.htHide[t.p]={spot:Math.floor(Math.random()*HT_SPOTS), u:null};
      L(`The emotions merge into one body. Zohakuten appears! The real Hantengu scurries off to hide.`,'x',{spawn:[z.uid], merged:true, htmerge:true, ...fx('spawn',null,t)}); }
  }
  // story: allies who arrive the moment this fighter falls (Petals of Futility: Kanao and Inosuke when Shinobu falls)
  ((S.twist||{}).reinforce||[]).forEach(r=>{ if(r.after===t.id && !r.came && t.p===0) arrive(r); }); }
// Hantengu's forms: a fallen form is replaced by the forms it splits into. They join the team at full health and act from next round.
// Hantengu's emotions: when the last form with this merge falls, they merge into that form (Zohakuten). Acts from next round.
function merge(t){
  if(S.teams[t.p].some(u=>u.alive && u.merge===t.merge)) return;
  const m=mkUnit(t.merge,t.p), real=m.anchor?mkUnit(m.anchor,t.p):null; S.teams[t.p].push(m); if(real) S.teams[t.p].push(real);
  L(`The emotions merge into one body. ${m.name} appears!${real?` The real ${real.name} crawls out behind him.`:''}`,'x',{spawn:real?[m.uid,real.uid]:[m.uid], merged:true, ...fx('spawn',null,t)});
}
function split(t){
  const kids=t.splits.map(id=>mkUnit(id,t.p)); S.teams[t.p].push(...kids);
  const names=kids.map(k=>k.name), list=names.length>1 ? names.slice(0,-1).join(', ')+' and '+names[names.length-1] : names[0];
  L(`${t.name} splits! ${list} ${kids.length>1?'appear':'appears'}.`,'x',{spawn:kids.map(k=>k.uid), ...fx('spawn',null,t)});
}
function hit(a,t,base,o={}){
  if(!t||!t.alive) return 0;
  if(a && a.tech) o={...o, ignoreDef:true};   // Tecchin's Masterwork Edge
  if(a && a.revenge && t.fam===a.revenge){ base+=4; o={...o, ignoreDef:true}; }   // Revenge on Doma
  const ub=!!o.unblockable;   // Hinokami Kagura out of the Selfless State: nothing blocks it
  if(!ub){
    if(S.shield[t.p]){ L(`${t.name} is untouched. Dead Calm blocks it.`,'x',fx('block',a,t)); return 0; }
    if(hidden(t)){ L(`${a.name} strikes at ${t.name}, but he's in the Selfless State. Nothing touches him.`,'x',{...fx('miss',a,t), dodge:'selfless'}); return 0; }
    if(t.saved){ L(`${t.name} is untouched. ${t.saved} stands guard over them.`,'x',{...fx('block',a,t), dodge:'save', guard:t.savedBy}); return 0; }
    if(t.evade){ L(`${a.name} strikes at ${t.name}, but hits nothing.`,'x',{...fx('miss',a,t), dodge:t.evadeBy||'evade'}); return 0; }
    if(t.away){ L(t.carried ? `${a.name} can't reach ${t.name}. Goto has them.` : `${a.name} can't find ${t.name}. They're in another room of the castle.`,'x',fx('miss',a,t)); return 0; }
    if(a.astray){ L(`Yahaba's arrows bend ${a.name}'s blow away from ${t.name}.`,'x',fx('miss',a,t)); return 0; }
  } else if(S.shield[t.p]||t.evade||t.away||t.saved||t.defending||a.astray) L(`Nothing can stop it. ${a.name} cuts straight through to ${t.name}.`,'h',fx('special',a,t));
  let d = o.ignoreDef ? base : Math.max(1, base - t.def, Math.ceil(base/2));
  const guarded = t.defending && !t.exposed && !o.pierce && !a.pierceAll && !ub;
  if(guarded) d = Math.ceil(d/2);
  let note = guarded?' (guarded)':'';
  const guardLine = guarded && t.guardBy ? {guard:t.guardBy} : null;   // Retired Tengen standing over an ally
  if(t.cap){ const room=t.cap-t.taken; if(room<=0){ L(`${t.name} sees it coming in the Transparent World. No damage.`,'x',fx('block',a,t)); return 0; } if(d>room){ d=room; note+=' (capped)'; } t.taken+=d; }
  if(t.exposed){ d=Math.ceil(d*1.5); note+=' (wide open)'; }
  d=Math.max(0,d); const before=t.hp; t.hp = Math.max(0, t.hp - d);
  if(d>0 && t.splitOnHit){ htSplit(t,a); return d; }
  L(`${a.name} hits ${t.name} ${lost(t,Math.min(d,before))}${note}.`,'',{...fx('hit',a,t), ...(guardLine||{})});
  if(o.sun && t.demon && t.regen && !t.sunproof){ t.regen=0; t.sunburn=true; L(`${t.name} is burned by the sun. No more regeneration.`,'h',fx('burn',a,t)); }
  fall(t,a);
  // Kiriya's Ambush Orders: each enemy that hits the trapped fighter this round takes AMBUSH_DMG back (once each)
  if(t.ambush && a.alive && !sameSide(a.p,t.p) && !t.ambush.hit.includes(a.uid)){ t.ambush.hit.push(a.uid);
    let ad=AMBUSH_DMG; if(a.cap){ ad=Math.min(ad, Math.max(0, a.cap-a.taken)); a.taken+=ad; }
    a.hp=Math.max(0,a.hp-ad); L(`Ambush! Kiriya's trap around ${t.name} catches ${a.name} ${lost(a,ad)}.`,'k',{...fx('hit',null,a), trap:true}); fall(a,null); }
  if(o.counter!==false && S.sib[t.p] && a.alive && (t.fam==='tanjiro'||t.fam==='nezuko')){
    const partner = S.teams[t.p].find(u=>u.alive && u!==t && (u.fam==='tanjiro'||u.fam==='nezuko'));
    if(partner && !(a.cap && a.taken>=a.cap)){ let cd=3; if(a.cap){ cd=Math.min(cd,a.cap-a.taken); a.taken+=cd; } a.hp=Math.max(0,a.hp-cd); L(`${partner.name} counters ${a.name} ${lost(a,cd)} to protect ${t.fam==='tanjiro'?'her brother':'his sister'}.`,'h',fx('hit',partner,a)); fall(a,partner); }
  }
  return d;
}
const HER_FAMS = ['daki','nakime','susamaru','mitsuri','shinobu','kanae','nezuko','kanao','tamayo'];
const hisHer = u => u.fam==='typezero' ? 'its' : HER_FAMS.includes(u.fam) ? 'her' : 'his';
function stunT(t, kind){ if(t&&t.alive&&!S.shield[t.p]&&!t.evade&&!hidden(t)&&!t.saved){ t.stunNext=true; if(kind) t.bound=kind; L(`${t.name} will lose ${hisHer(t)} turn next round.`,'k',{...fx('stun',null,t), kind}); } }
// Hantengu: the first hit that lands cuts his head off and he splits (he doesn't fall: he becomes them)
// Hantengu H: a fighter guesses where the real one is hiding. Right: he's dragged out and takes the hit. Wrong: left wide open this round.
// Hantengu H: the real one comes out of hiding (the same fighter if he's hidden before, with his wounds)
function htOut(q){ const h=S.htHide[q], r=(h&&h.u)||mkUnit('hantengu_true',q); S.htHide[q]=null; r.alive=true; S.teams[q].push(r); return r; }
// Zohakuten at 0 HP while the real one lives: knocked down, not killed. The real one is exposed; if he's still alive at
// the end of the next round, Zohakuten gets back up with half his health and the real one hides again.
function htDown(z,a){
  const q=z.p, real=S.teams[q].find(u=>u.alive && u.id==='hantengu_true');
  if(!real && !S.htHide[q]) return false;   // the real one is already dead
  z.hp=0; z.alive=false; z.down=S.round+1;
  const r=real||htOut(q);
  L(`${a?a.name+' knocks':'Something knocks'} Zohakuten flat! He's seeing stars. The real Hantengu is out in the open: cut him down before Zohakuten gets back up!`,'h',{...fx('stun',a,z), htdown:true, spawn:real?[]:[r.uid], real:r.uid});
  return true;
}
// End of round: a knocked-down Zohakuten gets back up if the real one survived his round in the open
function htRise(){
  players().forEach(p=>S.teams[p].filter(z=>z.down!=null && z.down<=S.round).forEach(z=>{
    const real=S.teams[p].find(u=>u.alive && u.id==='hantengu_true'); z.down=null; if(!real) return;
    z.alive=true; z.hp=Math.ceil(z.max*HT_RISE); z.stun=false; z.cd=Math.min(z.cd,1);
    S.teams[p].splice(S.teams[p].indexOf(real),1); S.htHide[p]={spot:Math.floor(Math.random()*HT_SPOTS), u:real};
    L(`Zohakuten gets back up, furious! The real Hantengu scurries back into hiding.`,'x',{...fx('spawn',null,z), htrise:true, real:real.uid}); }));
}
const HUNT_ODDS = .3;   // how often the computer gambles on a hiding place (Hard; Normal a bit less, Easy never)
function hunt(u,spot){
  const q=huntTeam(u.p); if(q===undefined){ L(`${u.name} looks around, but there's no one left to find.`,'',fx('stun',null,u)); return; }
  const h=S.htHide[q], found=h.spot===spot;
  if(!found){ u.exposed=true; L(`${u.name} searches hiding place ${spot+1}… nothing! ${u.name} is left wide open this round.`,'x',{...fx('miss',u,null), hunt:{spot, at:h.spot, found:false}}); return; }
  const r=htOut(q);
  L(`${u.name} searches hiding place ${spot+1}… FOUND HIM! The real Hantengu is dragged out.`,'h',{spawn:[r.uid], hunt:{spot, at:spot, found:true}, ...fx('spawn',u,r)});
  hit(u,r,u.pow);
}
function htSplit(t,a){
  t.alive=false; t.hp=0; const kids=t.splitOnHit.map(id=>mkUnit(id,t.p)); S.teams[t.p].push(...kids);
  L(`${a?a.name+' cuts':'Something cuts'} Hantengu's head off… and he splits! Sekido and Karaku appear.`,'x',{spawn:kids.map(k=>k.uid), htcut:{by:a?a.uid:null}, ...fx('spawn',null,t)});
}
function special(u,pl){
  const s=u.sig, en=()=>aimsTeam(u) ? aimedTeam(u,pl) : foes(u.p);
  L(`${u.name}: ${s.name}!`,'x',{...fx('special',u,null), sig:s.id||(u.unblock?'unblock':null), flare:!!u.mark && !u.flared});   // a Mark flares the first time it's used
  if(u.mark) u.flared=true;
  if(s.id==='selfless'){   // Mark Tanjiro: untouchable until Hinokami Kagura is ready again (end of round, below)
    u.selfless=true; u.selflessUsed=true; u.saveUsed=false; u.reveal=false; u.stun=false; u.stunNext=false; u.late=false; u.away=false; u.astray=false;
    L(`${u.name} hides every trace of killing intent. Until Hinokami Kagura is ready, nothing can touch him unless he strikes.`,'h',fx('guard',null,u));
    u.sig=BYID[u.id].sig; u.cd=s.cd+1; return; }
  switch(s.id||u.sk){   // a second special has its own id
    case 'seventh': hit(u,target(u,pl.t),u.pow*3,{ignoreDef:true}); break;
    case 'annihilation': en().forEach(e=>hit(u,e,u.pow-4,{ignoreDef:true,counter:false})); break;
    case 'ninth': hit(u,target(u,pl.t),u.pow+10,{ignoreDef:true}); break;
    case 'yoriichi': en().forEach(e=>hit(u,e,u.pow,{ignoreDef:true,sun:true,counter:false})); break;
    case 'yoriichi_old': hit(u,target(u,pl.t),u.pow+10,{ignoreDef:true}); break;
    case 'tanjiro': { const ub=!!u.unblock; u.unblock=false; u.hinokami=true; hit(u,target(u,pl.t),u.pow+5,{ignoreDef:true, unblockable:ub}); break; }
    case 'nezuko': en().forEach(e=>{ if(hit(u,e,5,{ignoreDef:true,counter:false})>0 && e.demon && e.regen) e.blood=S.round; }); break;   // her blood burns demons: no regeneration this round
    case 'zenitsu': hit(u,target(u,pl.t),u.pow*2); break;
    case 'inosuke': for(let i=0;i<2;i++){ const e=en(); if(e.length) hit(u,rnd(e),u.pow-1); } break;
    case 'kanao': hit(u,target(u,pl.t),u.pow+4); break;
    case 'genya': { const h=Math.min(8,u.max-u.hp); u.hp+=h; u.pow+=2; u.ate=true; L(`Genya eats demon flesh ${gained(u,h)}, PWR now ${u.pow}.`,'h',{...fx('heal',null,u), ate:true}); break; }
    case 'tamayo': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=alive(u.p).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0]; const h=Math.min(10,t.max-t.hp); t.hp+=h; t.poison=null; L(`Tamayo heals ${t===u?'herself':t.name} ${gained(t,h)} and clears any poison.`,'h',fx('heal',u,t)); break; }
    case 'gyokko': { const t=target(u,pl.t); if(t&&t.alive){ hit(u,t,u.pow-2,{ignoreDef:true}); stunT(t,'pot'); } break; }
    case 'sabito': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=u; t.pow+=2; L(`Sabito trains ${t===u?'himself':t.name}: +2 PWR for the rest of the match.`,'h',fx('buff',u,t)); break; }
    case 'muzan_final': { let n=0; en().forEach(e=>{ if(hit(u,e,u.pow-6,{ignoreDef:true,counter:false})>0) n++; }); if(u.alive&&n){ const h=Math.min(3*n,u.max-u.hp); u.hp+=h; L(`Final Muzan heals ${gained(u,h)}.`,'k',fx('heal',null,u)); } break; }
    case 'tengen_retired': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=u; t.defending=true; if(t!==u) t.guardBy=u.uid; L(`Retired Tengen stands guard over ${t===u?'himself':t.name}. Half damage this round.`,'h',{...fx('guard',u,t), cover:t!==u}); break; }
    case 'yushiro': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=u; t.evade=true; t.evadeBy='yushiro'; L(`${t===u?'Yushiro':t.name} vanishes behind the talisman.`,'h',{...fx('guard',u,t), hid:true}); break; }
    case 'murata': hit(u,target(u,pl.t),u.pow+2); break;
    case 'giyu': players().filter(q=>sameSide(q,u.p)).forEach(q=>{ S.shield[q]=true; }); L(`${u.name}'s team can't be hurt this round.`,'h',{...fx('guard',u,null), calm:true}); break;
    case 'gyomei': en().forEach(e=>hit(u,e,s.dmg,{ignoreDef:true,counter:false})); break;
    case 'sanemi': { const t=target(u,pl.t); hit(u,t,u.pow); const o=en().filter(e=>e!==t); if(o.length) hit(u,rnd(o),u.pow); break; }
    case 'muichiro': hit(u,target(u,pl.t),u.pow+2); break;
    case 'mitsuri': en().forEach(e=>hit(u,e,u.pow-3,{counter:false,pierce:true})); break;
    case 'obanai': hit(u,target(u,pl.t),u.pow+4,{pierce:true}); break;
    case 'rengoku': hit(u,target(u,pl.t),u.pow+4); break;   // Fifth Form: Flame Tiger (Ninth Form is his second special)
    case 'makomo': hit(u,target(u,pl.t),u.pow); break;
    case 'hinatsuru': { const t=target(u,pl.t); if(t&&t.alive&&!S.shield[t.p]&&!t.evade&&!hidden(t)&&!t.noPoison){ t.poison={dmg:t.demon?4:2,turns:3}; L(`${t.name} is poisoned.`,'h',fx('poison',u,t)); } hit(u,t,u.pow); break; }
    case 'makio': hit(u,target(u,pl.t),u.pow+3); break;
    case 'suma': { const e=en(); if(e.length) hit(u,rnd(e),u.pow); break; }
    case 'michikatsu': hit(u,target(u,pl.t),u.pow+Math.min(6,S.round)); break;
    case 'hakuji': hit(u,target(u,pl.t),u.pow+3); break;
    case 'dojo_fighter': hit(u,target(u,pl.t),u.pow+2); break;
    case 'tanjuro': { const healed=alive(u.p).map(m=>{ const h=Math.min(3,m.max-m.hp); m.hp+=h; return h?`${m.name} ${gained(m,h)}`:''; }).filter(Boolean); L(`Tanjuro dances the Hinokami Kagura.${healed.length?' '+healed.join(', ')+'.':''}`,'h',fx('heal',u,null)); break; }
    case 'shinobu': { const t=target(u,pl.t); if(t&&t.alive){ if(S.shield[t.p]||t.evade||hidden(t)){L(`The poison misses.`,'x',fx('miss',u,t));break;} if(t.noPoison){L(`The poison does nothing to ${t.name}. It's only a puppet.`,'x',fx('miss',u,t));break;} t.poison={dmg:t.demon?6:3,turns:u.poisonTurns||3,src:'shinobu'}; L(`${t.name} is poisoned.`,'h',fx('poison',u,t)); } break; }
    case 'tengen': en().forEach(e=>hit(u,e,u.pow-2,{counter:false})); break;
    case 'rui': { const t=target(u,pl.t); hit(u,t,u.pow); stunT(t,'thread'); break; }
    case 'kyogai': stunT(target(u,pl.t),'drum'); break;
    case 'hand': hit(u,target(u,pl.t),u.pow+3); break;
    case 'swamp': hit(u,target(u,pl.t),u.pow+1); break;
    case 'gyutaro': en().forEach(e=>{ hit(u,e,4,{ignoreDef:true,counter:false}); if(e.alive&&!e.noPoison&&!S.shield[e.p]&&!e.evade&&(!e.poison||e.poison.dmg<2)) e.poison={dmg:2,turns:2}; }); break;
    case 'akaza': hit(u,target(u,pl.t),u.pow+6); break;
    case 'daki': en().forEach(e=>hit(u,e,u.pow-3,{counter:false})); break;
    case 'nakime': { const t=target(u,pl.t); if(hidden(t)){ L(`The castle shifts, but ${t.name}'s presence can't be found.`,'x',fx('miss',u,t)); break; } if(t&&t.alive){ t.away=true; L(`Nakime strums. ${t.name} is sent to another room of the castle this round.`,'k',{...fx('stun',u,t), gone:true}); } break; }
    case 'zohakuten': en().forEach(e=>hit(u,e,u.pow,{pierce:true,counter:false})); break;
    case 'susamaru': { const t=target(u,pl.t); hit(u,t,u.pow-1); const o=en().filter(e=>e!==t); if(o.length) hit(u,rnd(o),u.pow-1); break; }
    case 'yahaba': { const t=target(u,pl.t); if(hidden(t)){ L(`Yahaba's arrows can't lock onto ${t.name}.`,'x',fx('miss',u,t)); break; } if(t&&t.alive){ t.astray=true; L(`Yahaba's arrows lock onto ${t.name}. Every hit they throw this round will miss.`,'k',fx('stun',u,t)); } break; }
    case 'kanae': { hit(u,target(u,pl.t),u.pow+3); const m=alive(u.p).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0]; if(m){ const h=Math.min(4,m.max-m.hp); if(h){ m.hp+=h; L(`Kanae's petals heal ${m===u?'her':m.name} ${gained(m,h)}.`,'h',fx('heal',u,m)); } } break; }
    case 'tanjiro_demon': en().forEach(e=>hit(u,e,u.pow-4,{ignoreDef:true,counter:false})); break;
    case 'nezuko_awakened': { en().forEach(e=>hit(u,e,10,{ignoreDef:true,counter:false})); const sick=alive(u.p).filter(m=>m.poison); sick.forEach(m=>{ m.poison=null; }); if(sick.length) L(`Nezuko's blood burns the poison off ${sick.map(m=>m.name).join(', ')}.`,'h',fx('heal',u,null)); break; }
    case 'typezero': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=u; t.spd+=2; L(`Type Zero drills ${t===u?'itself':t.name}: +2 SPD for the rest of the match.`,'h',fx('buff',u,t)); break; }
    case 'doma': en().forEach(e=>hit(u,e,u.pow-4,{ignoreDef:true,counter:false})); break;
    case 'kokushibo': en().forEach(e=>hit(u,e,u.pow-4,{ignoreDef:true,counter:false})); break;
    case 'sekido': en().forEach(e=>hit(u,e,5,{ignoreDef:true,counter:false})); break;
    case 'flee': u.evade=true; u.evadeBy='hantengu'; L(`The real Hantengu scurries away and hides.`,'h',{...fx('guard',null,u), shrink:true}); break;
    case 'karaku': en().forEach(e=>hit(u,e,Math.max(1,u.pow-6),{counter:false})); break;
    case 'aizetsu': hit(u,target(u,pl.t),u.pow+4,{pierce:true}); break;
    case 'urogi': hit(u,target(u,pl.t),u.pow+2); break;
    case 'hantengu': { u.evade=true; u.evadeBy='hantengu'; const h=Math.min(6,u.max-u.hp); u.hp+=h; L(`Hantengu shrinks into hiding and heals ${gained(u,h)}.`,'h',{...fx('heal',null,u), shrink:true}); break; }
    case 'kaigaku': { const t=target(u,pl.t); hit(u,t,u.pow+3); const o=en().filter(e=>e!==t); if(o.length) hit(u,rnd(o),4,{ignoreDef:true}); break; }
    case 'enmu': en().forEach(e=>{ if(S.shield[e.p]||e.evade||hidden(e)) return; e.cd+=2; }); L('The enemy team falls into a deep sleep. Their specials are 2 rounds further away.','k',fx('stun',u,null)); break;
    case 'urokodaki': hit(u,target(u,pl.t),u.pow+3); break;
    case 'kagaya': { const ha=markReady(u); u.hp=0; u.alive=false;
      L(`Kagaya gives his life for the Corps.`,'k',{ko:u.uid, resolve:true, ...fx('ko',null,u)});
      if(!ha.length){ L(`No Hashira is left to carry his will.`,'x',fx('ko',null,u)); break; }
      const was=ha.map(m=>({uid:m.uid, id:m.id, name:m.name, g:m.g, sk:m.sk, mark:m.mark, max:m.max}));   // playback shows them as they were until this line
      ha.forEach(m=>awakenMark(m,false,null,true));
      L(ha.length>1 ? `${ha.length} Hashira have awakened their Marks! Stronger and faster.` : `${was[0].name} has awakened the Demon Slayer Mark! Stronger and faster.`,'h',{...fx('awaken',null,null), act:'awaken', was}); break; }
    case 'muzan': { let n=0; en().forEach(e=>{ if(hit(u,e,u.pow-7,{ignoreDef:true,counter:false})>0) n++; }); if(u.alive&&n){ const h=Math.min(2*n,u.max-u.hp); u.hp+=h; L(`Muzan heals ${gained(u,h)}.`,'k',fx('heal',null,u)); } break; }
  }
  u.cd = s.cd + 1;
  if(u.sk==='tanjiro' && canSelfless(u)) u.sig=SELFLESS;   // after Hinokami Kagura, the next special ready is the Selfless State
  const card=BYID[u.id]; if(sig2Open(card)) u.sig = s.id===card.sig2.id ? card.sig : card.sig2;   // second specials alternate with the first
  // story chain (stage.chain, e.g. Senior Brother): after this fighter's first special, a cutscene, then the second one at once
  const ch=S.mode==='story' && S.chain; if(ch && !S.chainDone && u.p===0 && u.fam===ch.id && !s.id && card.sig2) S.chainPending=u.uid;
}
// Gyutaro and Daki (Two as One): one who fell this round gets back up with 30% if the other is still standing.
// If both fell in the same round, both stay down. Each can only get back up once (unlimited won 94% of matches).
function twinsRise(){
  players().forEach(p=>{ if(!S.twins[p]) return;
    const pair=S.teams[p].filter(u=>u.fam==='gyutaro'||u.fam==='daki');
    pair.filter(u=>u.rise).forEach(u=>{ u.rise=false; const o=pair.find(x=>x!==u);
      if(o && o.alive){ u.alive=true; u.hp=Math.ceil(u.max*.3); u.poison=null; L(`${u.name} rises again while ${o.name} still stands ${gained(u,u.hp)}. Two as One!`,'x',fx('revive',null,u)); } }); });
}
// Nakime and Kagaya never fight: if only they are left standing on a team, they're out (count as knocked out)
function aloneCheck(){
  players().forEach(p=>{ const a=alive(p); if(!a.length || !a.every(u=>u.basic && u.basic.flee)) return;
    a.forEach(u=>{ u.alive=false; u.hp=0; L(u.basic.flee,'k',{ko:u.uid, ...fx('ko',null,u)}); }); });
}
// Free-for-all: the team an "every enemy" special lands on (the aimed fighter's team; if it's gone, a random team still standing)
function aimedTeam(u,pl){ const t=findU(pl.t), q=t && !sameSide(t.p,u.p) && alive(t.p).length ? t.p : rnd(enemiesOf(u.p).filter(q=>alive(q).length)); return q===undefined ? [] : alive(q); }
// A back-pocket helper's effect, at the start of the round it's used. It then leaves the back pocket.
function useHelper(p, id){
  S.helpers[p]=S.helpers[p].filter(h=>h!==id);
  const team=alive(p), tag={fx:id==='chachamaru'||id==='aoi'?'heal':id==='mice'||id==='chuntaro'||id==='tecchin'?'buff':'special', by:null, on:null, helper:id, hp:p};   // hp: whose helper (for its clip)
  if(id==='chachamaru'){   // the most hurt fighter (lowest health %) heals half of what they've lost
    const u=team.slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
    if(u){ const h=Math.ceil((u.max-u.hp)/2); u.hp+=h; L(`Chachamaru delivers Tamayo's medicine to ${u.name} ${gained(u,h)}.`,'h',{...tag, on:u.uid}); }
  }
  if(id==='aoi'){ team.forEach(u=>{ u.poison=null; }); const u=team.slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0]; if(u){ const h=Math.min(4,u.max-u.hp); u.hp+=h; L(`Aoi treats your team. Poison is cured, and ${u.name} recovers ${gained(u,h)}.`,'h',{...tag, on:u.uid}); } }
  if(id==='chuntaro'){ const u=team.filter(x=>x.stun).sort((a,b)=>b.pow-a.pow)[0]; if(u){ u.stun=false; const t=foes(p)[0]; S.plans[p][u.uid]={type:'attack', t:t&&t.uid}; } team.forEach(x=>{ x.spd+=2; x.chuBoost=(x.chuBoost||0)+2; }); L(`Chuntaro sounds the alarm!${u?` ${u.name} wakes up!`:''} ${S.names[p]}'s team gets +2 SPD this round.`,'h',tag); }
  if(id==='goto'){ const u=team.slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0]; if(u){ u.away=true; u.carried=true; L(`Goto carries ${u.name} to safety. They're out of this round.`,'h',{...tag, on:u.uid}); } }
  if(id==='tecchin'){ const u=team.slice().sort((a,b)=>b.pow*b.strikes-a.pow*a.strikes)[0]; if(u){ u.tech=true; L(`Tecchin hands ${u.name} a masterwork edge. Their attacks ignore DEF this round.`,'h',{...tag, on:u.uid}); } }
  if(id==='mice'){ team.forEach(u=>{ u.pow+=MICE_PWR; u.miceBoost=(u.miceBoost||0)+MICE_PWR; }); L(`The Muscle Mice flex! ${S.names[p]}'s team gets +${MICE_PWR} PWR this round.`,'h',tag); }
  if(id==='hotaru'){   // he works at the END of the round (hotaruForge), so a special used this round can come straight back
    S.hotaru=(S.hotaru||[]).concat(p); L(`Hotaru fires up his forge. He'll reforge a blade at the end of the round.`,'x',tag); }
  if(id==='crow') L(`${S.names[p]}'s Kasugai Crow scouted the enemy's moves.`,'x',tag);
  if(id==='kiriya'){   // the fighter picked on the move screen (S.plans[p].ambush), or the most hurt one
    const pick=findU((S.plans[p]||{}).ambush), u=pick && pick.alive && pick.p===p ? pick : team.slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
    if(u){ u.ambush={hit:[]}; L(`Kiriya gives his orders. A trap is set somewhere on ${S.names[p]}'s side.`,'x',tag); }
  }
}
// Hotaru (end of the round, after cooldowns tick): the fighter with the longest wait has it cut to 1 round (or, if it's
// already 1, it's ready next round). A special used this round counts, so he works in round 1 too (CK, Oct 27, 2026).
// A full reload straight away was tried: 64% for the side with him, too strong; this is ~58% like the others.
function hotaruForge(){
  (S.hotaru||[]).forEach(p=>{ const tag={fx:'buff', by:null, on:null, helper:'hotaru', hp:p};
    const u=alive(p).slice().sort((a,b)=>b.cd-a.cd)[0];
    if(u && u.cd>0){ u.cd=u.cd>1?1:0; L(`Hotaru reforges ${u.name}'s blade. Their special is ready ${u.cd?'the round after next':'next round'}.`,'h',{...tag, on:u.uid});
      if(u.selfless){ u.selfless=false; u.unblock=true; L(`${u.name} leaves the Selfless State. Hinokami Kagura is ready, and nothing can stop it.`,'h',fx('buff',null,u)); } }
    else L(`Hotaru has nothing to reforge and storms off.`,'x',tag); });
  S.hotaru=[];
}
// Computer back-pocket choices for this round
function cpuHelpers(p){
  const team=alive(p), have=S.helpers[p]||[], use=[];
  if(team.length){
    const avg=team.reduce((a,u)=>a+u.hp/u.max,0)/team.length;
    if(have.includes('chachamaru') && team.some(u=>u.hp<=u.max*.5)) use.push('chachamaru');
    if(have.includes('mice') && S.round>=2 && team.length>=2) use.push('mice');
    if(have.includes('crow') && S.round>=2) use.push('crow');
    if(have.includes('aoi') && (team.some(u=>u.poison) || team.some(u=>u.hp<=u.max*.5))) use.push('aoi');
    if(have.includes('chuntaro') && (team.some(u=>u.stun) || S.round>=2)) use.push('chuntaro');
    if(have.includes('goto') && team.length>1 && team.some(u=>u.hp<=u.max*.35)) use.push('goto');
    if(have.includes('tecchin') && S.round>=2) use.push('tecchin');
    // Hotaru reloads at the end of the round: worth it when a special is fired this round or one has a long wait
    if(have.includes('hotaru') && (team.some(u=>u.cd>=2) || team.some(u=>(S.plans[p][u.uid]||{}).type==='special' && u.sig.id!=='selfless'))) use.push('hotaru');
    // Kiriya: trap the fighter most likely to be attacked (the most hurt one) once someone is in danger
    if(have.includes('kiriya') && S.round>=2 && team.some(u=>u.hp<=u.max*.6)){ use.push('kiriya'); S.plans[p].ambush=team.slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0].uid; }
  }
  S.helperPlan[p]=use;
}
// Computer with a crow: it has seen the other side's moves, so any fighter about to be knocked out defends instead
function cpuScout(p){
  const incoming={};
  foes(p).forEach(e=>{
    const q=S.plans[e.p][e.uid]; if(!q || e.stun) return;
    const x = q.type==='special' && SIG_EST[e.sk] ? SIG_EST[e.sk](e) : null;
    const base = q.type==='attack' ? e.pow*e.strikes : x ? x.base : 0; if(!base) return;
    const hits = x && x.all && (!aimsTeam(e) || (findU(q.t)||{}).p===p) ? alive(p) : [findU(q.t)].filter(t=>t && t.p===p);
    hits.forEach(t=>{ incoming[t.uid]=(incoming[t.uid]||0)+estHit(t, base, x?x.o:{}); });
  });
  alive(p).forEach(u=>{ if(!u.stun && !u.noDefend && (incoming[u.uid]||0)>=u.hp) S.plans[p][u.uid]={type:'defend'}; });
}
// Every side played by the computer (simulator and checks): moves, back-pocket helpers, then crow scouting
function cpuBothSides(l0='hard', l1='hard'){
  players().forEach(p=>cpuPlan(p, p===0?l0:l1)); players().forEach(p=>cpuHelpers(p));
  players().forEach(p=>{ if(S.helperPlan[p].includes('crow')) cpuScout(p); });
}
// Playback steps for a round's log: [first line, last line] per beat. A special that hits several enemies plays as
// one beat: its hits (and any knockouts it causes) go together. Everything else is one line per beat.
const GROUP_FX = ['hit','miss','block'];
function playSteps(log){
  const steps=[[0,0]];   // the "Round N · Fight!" intro
  for(let i=1;i<log.length;){
    const l=log[i];
    if(GROUP_FX.includes(l.fx) && l.by && l.move==='special'){
      const seen=new Set([l.on]); let j=i+1;
      while(j<log.length){
        const m=log[j];
        if(GROUP_FX.includes(m.fx) && m.by===l.by && m.move==='special' && !seen.has(m.on)){ seen.add(m.on); j++; continue; }
        if((m.fx==='ko'||m.fx==='burn') && m.by===l.by){ j++; continue; }
        break;
      }
      if(seen.size>=2 || log.slice(i+1,j).some(m=>m.fx==='ko')){ steps.push([i,j-1]); i=j; continue; }   // a special that lands the knockout is one moment with it (CK, Nov 3, 2026)
    }
    // several strikes from one Attack (Yoriichi, Type Zero) play as one quick flurry, not a slow beat each (CK)
    if(GROUP_FX.includes(l.fx) && l.by && l.move==='attack'){
      let j=i+1; while(j<log.length && GROUP_FX.includes(log[j].fx) && log[j].by===l.by && log[j].move==='attack') j++;
      if(j-i>=2){ steps.push([i,j-1]); i=j; continue; }
    }
    steps.push([i,i]); i++;
  }
  return steps;
}
// Match stats for the win screen, counted from each log line's HP snapshot (no extra bookkeeping in the rules):
// damage dealt and biggest hit (hit lines), knockouts (ko lines with an attacker), healing given to others (heal lines with a healer)
function tallyRound(){
  const st=uid=>S.stats[uid]||(S.stats[uid]={dmg:0, kos:0, heal:0, best:0});
  for(let i=1;i<S.log.length;i++){
    const l=S.log[i], prev=S.log[i-1], diff=uid=>(l.hp[uid]??0)-(prev.hp[uid]??l.hp[uid]??0);
    if(l.fx==='hit' && l.by && l.on){ const d=-diff(l.on); if(d>0){ const s=st(l.by); s.dmg+=d; s.best=Math.max(s.best,d); } }
    if(l.fx==='ko' && l.by && l.by!==l.on) st(l.by).kos++;
    if(l.fx==='heal' && l.by){ const h=Object.keys(l.hp).reduce((a,uid)=>a+Math.max(0,diff(uid)),0); if(h>0) st(l.by).heal+=h; }
  }
}
// Who did best this match: damage + 12 per knockout + healing given
const mvpScore = s => s.dmg + s.kos*12 + s.heal;
function resolve(){
  S.log=[]; S.shield=players().map(()=>false);
  L(`Round ${S.round}`,'r');
  players().forEach(p=>(S.helperPlan&&S.helperPlan[p]||[]).forEach(id=>useHelper(p,id)));   // back-pocket helpers act first
  const acts=[];
  players().forEach(p=>alive(p).forEach(u=>{ u.taken=0; acts.push({u, pl: u.stun?{type:'stunned'}:(S.plans[p][u.uid]||{type:u.noDefend?'attack':'defend'}), r:Math.random()}); }));
  acts.forEach(x=>{ if(x.pl.type==='defend' || (x.pl.type==='attack' && x.u.basic && x.u.basic.cower)) x.u.defending=true;
    if(x.u.selfless && x.pl.type==='attack') x.u.reveal=true;   // striking shows him for this round
    if(x.pl.type==='save' && x.u.selfless && !x.u.saveUsed){ const t=findU(x.pl.t); if(t && t.alive && t!==x.u && sameSide(t.p,x.u.p)){ t.saved=x.u.name; t.savedBy=x.u.uid; x.u.saveUsed=true; } } });
  const moves=players().map(p=>({p, helpers:(S.helperPlan&&S.helperPlan[p]||[]).map(id=>BYID[id].short), picks:acts.filter(x=>x.u.p===p).map(x=>moveText(x.u,x.pl))}));
  // Mark Tanjiro entering the Selfless State goes before everything, even the biwa: nothing can stop him slipping into it
  acts.forEach(x=>{ if(x.pl.type==='special' && x.u.sig.id==='selfless' && x.u.alive){ S.curMove='special'; special(x.u,x.pl); S.curMove=null; x.done=true; } });
  // Nakime's Biwa Strum always goes first: the enemy she picks acts last this round
  acts.forEach(x=>{ if(x.pl.type!=='attack' || !x.u.basic || x.u.basic.kind==='self') return; const t=findU(x.pl.t); if(!t || !t.alive || t.p===x.u.p) return;
    if(hidden(t)){ S.curMove='attack'; L(`${x.u.name} strums her biwa, but ${t.name}'s presence can't be found.`,'x',fx('miss',x.u,t)); S.curMove=null; return; }
    t.late=true; S.curMove='attack'; L(`${x.u.name} strums her biwa. ${t.name} will act last this round.`,'x',fx('stun',x.u,t)); S.curMove=null; });
  const prio = x => x.pl.type==='special' ? (x.u.sig.prio||0) : 0;
  acts.sort((a,b)=> (a.u.late?1:0)-(b.u.late?1:0) || prio(b)-prio(a) || b.u.spd-a.u.spd || a.r-b.r);
  aloneCheck(); storyBeats('round');
  for(const x of acts){
    const u=x.u; if(!u.alive || x.done) continue;
    S.curMove=x.pl.type;
    if(x.pl.type==='stunned'){ L(`${u.name} can't move.`,'',fx('stun',null,u)); continue; }
    if(u.away){ L(u.carried ? `${u.name} is being carried to safety.` : `${u.name} is lost in the Infinity Castle and can't act.`,'',fx('stun',null,u)); continue; }
    if(x.pl.type==='attack' && u.basic && u.basic.cower){ L(`${u.name} cowers.`,'',fx('guard',null,u)); continue; }   // Hantengu never attacks
    if(x.pl.type==='attack' && u.basic && u.basic.kind==='self'){   // Kagaya's Words of Resolve
      const healed=alive(u.p).map(m=>{ const h=Math.min(2,m.max-m.hp); m.hp+=h; return h?`${m.name} ${gained(m,h)}`:''; }).filter(Boolean);
      L(`Kagaya steadies the Corps.${healed.length?' '+healed.join(', ')+'.':''}`,'h',fx('heal',u,null)); continue; }
    if(x.pl.type==='attack' && u.basic) continue;   // Nakime's strum already happened
    if(x.pl.type==='defend'){ L(`${u.name} braces.`,'',fx('guard',null,u)); continue; }
    if(x.pl.type==='hunt'){ hunt(u,x.pl.spot); continue; }
    if(x.pl.type==='drums'){ u.pow+=2; L(`${u.name} pounds the drums of hatred. PWR +2 for good (now ${u.pow}).`,'h',fx('buff',null,u)); continue; }
    if(x.pl.type==='save'){ const t=findU(x.pl.t); if(t && t.saved===u.name) L(`${u.name} stands guard over ${t.name}. Nothing will touch them this round.`,'h',fx('guard',u,t)); continue; }
    if(x.pl.type==='special' && (u.sk==='muichiro'||u.sk==='swamp'||u.sk==='makomo'||u.sk==='suma')){ u.evade=true; u.evadeBy=u.sk; }   // evadeBy: whose dodge to draw
    if(x.pl.type==='attack' && u.reveal) L(`${u.name} strikes from the Selfless State, and for a moment he can be seen.`,'x',{...fx('buff',null,u), transparent:true});
    if(x.pl.type==='attack') for(let i=0;i<u.strikes;i++){ if(!foes(u.p).length) break; hit(u,target(u,x.pl.t),u.pow,u.selfless?{ignoreDef:true}:{}); }   // out of the Selfless State: ignores DEF
    if(x.pl.type==='special') special(u,x.pl);
    aloneCheck(); storyBeats();
    if(sidesUp().length<=1 || S.failed) break;
  }
  S.curMove=null;
  // end of round: poison, Shinobu's devour damage, sunrise, regeneration, cooldowns
  const sun=sunUp();
  htRise();
  Object.values(S.htHide||{}).forEach(h=>{ if(h) h.spot=Math.floor(Math.random()*HT_SPOTS); });   // the real Hantengu moves every round
  if(sun && S.round===sunRise()) L('The sun rises! From now on demons burn every round, hotter each time, and stop regenerating.','h',{...fx('burn',null,null), sunrise:true});
  if(sun && S.round===sunRise() && finalFight()){ alive(foeSeat()).forEach(u=>{ u.pow=Math.round(u.pow*(1+FINAL_FRENZY)); u.noDefend=true; }); L('Out of time, the demons throw everything they have left. They hit far harder and can no longer Defend.','k',{...fx('burn',null,null), frenzy:true}); }
  players().forEach(p=>S.teams[p].forEach(u=>{
    if(u.alive && u.poison){ u.hp=Math.max(0,u.hp-u.poison.dmg); L(`Poison hits ${u.name} ${lost(u,u.poison.dmg)}.`,'k',fx('poison',null,u)); fall(u); u.poison.turns--; if(u.poison.turns<=0) u.poison=null; }
    if(u.alive && u.devoured){ u.hp=Math.max(0,u.hp-u.devoured); L(`Shinobu's poison eats away at ${u.name} ${lost(u,u.devoured)}.`,'k',fx('poison',null,u)); fall(u); }
    if(sun && u.alive && u.demon && !sunSafe(u)){ const d=Math.ceil(u.max*sunBurn()); u.hp=Math.max(0,u.hp-d); L(`The sun burns ${u.name} ${lost(u,d)}.`,'k',fx('burn',null,u)); fall(u);
      if(u.alive && u.fam==='nezuko') L(`${u.name} endures the sunlight. She has conquered the sun.`,'h',fx('buff',null,u)); }
    if(u.alive && u.regen && u.hp<u.max && u.blood===S.round && !(sun && u.demon && !sunSafe(u))){ L(`Nezuko's blood burns in ${u.name}'s wounds. No regeneration this round.`,'h',fx('burn',null,u)); }
    else if(u.alive && u.regen && u.hp<u.max && !(sun && u.demon && !sunSafe(u))){ const h=Math.min(u.regen,u.max-u.hp); u.hp+=h; L(`${u.name} regenerates ${gained(u,h)}.`,'',Object.assign(fx('heal',null,u),{act:'regen'})); }
    if(u.sk==='hakuji' && u.alive && !u.vowed && S.teams[p].some(m=>!m.alive)){ u.vowed=true; u.pow+=3; L(`${u.name} remembers his vow: +3 PWR.`,'h',fx('buff',null,u)); }
    if(u.cd>0) u.cd--;
    if(u.selfless && u.alive && u.cd===0){ u.selfless=false; u.unblock=true; L(`${u.name} leaves the Selfless State. Hinokami Kagura is ready, and nothing can stop it.`,'h',fx('buff',null,u)); }
    u.stun=u.stunNext; u.stunNext=false; if(!u.stun) u.bound=null; u.defending=false; u.exposed=false; u.evade=false; u.evadeBy=null; u.guardBy=null; u.savedBy=null; u.away=false; u.carried=false; u.tech=false; u.astray=false; u.late=false; u.ambush=null; u.saved=null; u.reveal=false;
    if(u.chuBoost){ u.spd-=u.chuBoost; u.chuBoost=0; }
    if(u.miceBoost){ u.pow-=u.miceBoost; u.miceBoost=0; }   // Muscle Mice last one round
  }));
  twinsRise(); hotaruForge(); aloneCheck(); storyBeats();
  tallyRound();
  S.plans=players().map(()=>({})); S.helperPlan=players().map(()=>[]);
  // teams knocked out this round, in order (free-for-all places: last out = 2nd…). Several at once share a place.
  const out=players().filter(p=>!alive(p).length && !S.outOrder.some(o=>o.includes(p))); if(out.length) S.outOrder.push(out);
  const up=standing(), tw=S.twist||{};
  if(S.failed){ S.winner=1; S.phase='over'; }   // story: the ally you had to protect fell
  else if(sidesUp().length<=1){ S.winner = up.length ? up[0] : -1; S.phase='over'; }   // 2v2: any player of the winning side
  else if(tw.survive && S.round>=tw.survive){ S.winner=0; S.survived=true; S.phase='over'; L(`The sun rises. ${S.names[0]}'s team held out!`,'h',fx('burn',null,null)); }
  else if(S.round>=40){ S.winner=-1; S.phase='over'; }   // nobody wins after 40 rounds
  else { S.phase='result'; reinforcements(); if(S.mode==='story') awakenings(); }   // Marks awaken after the round (cutscene before the next)
  recordRound(moves);
}
/* ---------- full battle log (win screen, Copy) ----------
   Each round keeps what every fighter chose and the round's lines as plain text, so a player can look back at a whole
   match and see where it turned. Kept after the round resolves only, so online it never shows moves still being chosen. */
function moveText(u,pl){
  const t=pl.t && findU(pl.t), on=t && needsTarget(u,pl) ? ' → '+t.name : '';
  const what = pl.type==='stunned' ? "can't move" : pl.type==='defend' ? 'Defend' : pl.type==='save' ? 'Save'
    : pl.type==='special' ? u.sig.name : pl.type==='drums' ? 'Drums of Hatred' : pl.type==='hunt' ? `Hunt (hiding place ${(pl.spot??0)+1})` : u.basic ? u.basic.name : 'Attack';
  return `${u.name}: ${what}${on}`;
}
function recordRound(moves){
  const name=uid=>{ const u=findU(uid); return u?u.name:''; };
  (S.matchLog=S.matchLog||[]).push({r:S.round, moves,
    lines:S.log.filter(l=>l.c!=='r').map(l=>({t: l.c==='say' ? `${name(l.by)}: “${l.t}”` : l.t, c:l.c}))});
}
const plainLog = t => t.replace(/\[([+-])(\d+%)\]/g, (m,s,n)=>(s==='-'?'−':'+')+n);
function battleLogText(){
  const ml=S.matchLog||[], w=S.winner, team=p=>S.teams[p].filter(u=>!u.spawn).map(u=>u.name).join(', ');
  const out=[`Slayer Squad battle log · ${new Date().toLocaleDateString()}`,
    ...players().map(p=>`${S.names[p]}: ${team(p)}${(S.picks[p]||[]).filter(isHelper).length?' + '+S.picks[p].filter(isHelper).map(id=>BYID[id].short).join(', '):''}`),
    `Result: ${w<0?'nobody wins':S.names[w]+' wins'} after ${S.round} round${S.round===1?'':'s'}`, ''];
  ml.forEach(r=>out.push(roundText(r), ''));
  return out.join('\n');
}
// One round as text: what each player chose, then what happened (the round results screen copies the latest one)
function roundText(r){
  return [`— Round ${r.r} —`, ...r.moves.map(m=>`${S.names[m.p]} chose: ${m.picks.join(' · ')||'nothing'}${m.helpers.length?' · used '+m.helpers.join(', '):''}`),
    ...r.lines.map(l=>'  '+plainLog(l.t))].join('\n');
}
// Sunrise: long games end. From round SUNRISE_ROUND demons (except the sun-proof) burn SUN_BURN of their max HP every
// round and stop regenerating. Not in story mode (its own fights are about holding out until dawn).
const FINAL_BUDGET = 45, FINAL_POW = .15, FINAL_FRENZY = .5, FINAL_SUNRISE = 7;   // Final Form (js/daily.js). His play does most of the work: smarter moves alone took the computer's wins from ~16% to ~5% at +25%; these values give ~14% for the computer and 8–15% for a focus-fire script. Real players win more: CK beat an easier build in 13 rounds by stalling for the sun, hence the dawn frenzy.
const SUNRISE_ROUND = 10, SUN_BURN = .1;   // round 10 since Oct 27, 2026 (CK: sun in ~10% / 25% / 30% of 10 / 20 / 30-pt games; at 12 it was 5 / 14 / 16%)
// The burn grows every round the sun is up (CK, Oct 28, 2026): 10% at sunrise, then 15%, 20%, 25%…
const SUN_GROW = .05, sunBurn = () => SUN_BURN + SUN_GROW*Math.max(0, S.round-sunRise());
const sunRise = () => finalFight() ? FINAL_SUNRISE : SUNRISE_ROUND;   // Final Form races an earlier dawn
const sunUp = () => S.mode!=='story' && S.round>=sunRise();
// Nezuko burns on the first morning only, then she has conquered the sun (CK, Oct 30, 2026)
const sunSafe = u => u.sunproof || (u.fam==='nezuko' && S.round>sunRise());
/* ---------- story beats: protect, boss phases and mid-battle lines (all set by the stage; nothing hidden) ----------
   twist.protect: id      you lose if that fighter on your team falls
   S.phases: [{id, at, pow, spd, def, ready, label, line}]   an enemy powers up once when its health drops to `at`
   S.beats:  [{when:'low'|'ko'|'round', id, at, round, who, text}]   a character speaks (once each) */
const say = (u, text) => L(text, 'say', {fx:'say', by:u.uid, on:null, move:null});
function storyBeats(when){
  if(S.mode!=='story') return;
  const tw=S.twist||{}, all=allUnits(), find=id=>all.find(u=>u.id===id) || all.find(u=>u.fam===(BYID[id]||{}).fam && u.p===0);   // by family too: a fighter may have awakened their Mark
  (S.beats||[]).forEach((b,i)=>{ if(S.said[i]) return; const u=find(b.id), who=find(b.who||b.id)||u; if(!who) return;
    const hit = b.when==='round' ? when==='round' && S.round===b.round
      : b.when==='low' ? u && u.alive && u.hp<=u.max*(b.at||.3)
      : b.when==='ko' ? u && !u.alive : false;
    if(hit){ S.said[i]=true; say(who, b.text); } });
  (S.phases||[]).forEach(ph=>{ const u=S.teams[1].find(x=>x.id===ph.id); if(!u || !u.alive || u.phased || u.hp>u.max*ph.at) return;
    u.phased=true; if(ph.line) say(u, ph.line); if(ph.rally) while(S.waveQ && S.waveQ.length) nextWave();
    if(ph.reply){ const r=allUnits().find(x=>x.alive && x.p===0 && x.fam===ph.reply.id) || alive(0)[0]; if(r) say(r, ph.reply.text); }
    u.pow+=ph.pow||0; u.spd+=ph.spd||0; u.def+=ph.def||0; if(ph.ready) u.cd=0; if(ph.second && BYID[u.id].sig2) u.sig=BYID[u.id].sig2;
    L(`${u.name} changes: ${ph.label}.`,'k',fx('buff',null,u)); });
  if(tw.protect && !S.failed){ const u=S.teams[0].find(x=>x.id===tw.protect); if(u && !u.alive){ S.failed=true; L(`${u.name} has fallen. You had to protect ${u.name}.`,'k',fx('ko',null,u)); } }
}
// Story: a fighter awakens their Demon Slayer Mark at the end of a round (when hurt to `at` of their health, or after
// round `round`). The stage's short cutscene plays before the next round (S.midScene, shown by app.js), and they become
// the Mark card (its extra HP, PWR, SPD, DEF and faster special, which is ready) when the scene reaches their awakening
// line ({awaken:true}), not before: S.pendingAwake holds them until then (applyAwakenings).
// A fighter becomes their Mark card mid-battle (or, in story, another awakened card: Nezuko → Awakened Nezuko): that
// card's extra HP, PWR, SPD, DEF and regen on top of what they have now, its special, and its name. Story Marks (ready) also get the special ready now; Kagaya's Final Resolve keeps the current wait.
function awakenMark(u, ready, to, quiet){
  const b=BYID[u.id], m=BYID[to||u.id+'_mark'];
  const dh=m.hp-b.hp; u.max+=dh; u.hp+=dh; u.pow+=m.pow-b.pow; u.spd+=m.spd-b.spd; u.def+=m.def-b.def; u.regen+=(m.regen||0)-(b.regen||0);
  const was=u.name;
  Object.assign(u,{id:m.id, name:m.short, g:m.g, sig:m.sig, sk:m.sk, mark:!!m.mark, noDefend:!!m.noDefend, awoke:true}, ready?{cd:0}:{cd:Math.min(u.cd,m.sig.cd+1)});   // now named like that card (Tanjiro ✦)
  if(m.selfless && u.hinokami && canSelfless(u)) u.sig=SELFLESS;
  if(u.noDefend && S.plans) players().forEach(p=>{ const pl=S.plans[p]&&S.plans[p][u.uid]; if(pl && pl.type==='defend') pl.type='attack'; });
  if(!quiet) L(m.mark ? `${was} awakens the Demon Slayer Mark! Stronger and faster${ready?', and the special is ready':''}.`
    : `${was} awakens! ${m.short}: stronger, faster${ready?', special ready':''}.`,'h',{...fx('buff',null,u), act:'awaken'});
}
// Kagaya's Final Resolve: the Hashira on his team still standing who have a Mark card and haven't awakened it
const markReady = k => alive(k.p).filter(m=>m!==k && BYID[m.id].hashira && !m.mark && BYID[m.id+'_mark']);
// Awaken the fighters waiting for their cutscene line: the one becoming card `to`, or everyone still waiting. The
// awakening line goes into the battle log's last round too.
function applyAwakenings(to){
  S.pendingAwake=(S.pendingAwake||[]).filter(w=>{ if(to && w.to!==to) return true;
    const u=findU(w.uid); if(u && u.alive){ const n=S.log.length; awakenMark(u,true,w.to);
      const last=S.matchLog && S.matchLog[S.matchLog.length-1]; if(last) S.log.slice(n).forEach(l=>last.lines.push({t:l.t, c:l.c})); }
    return false; });
}
function awakenings(){
  if(S.chainPending){ const u=findU(S.chainPending), card=u&&BYID[u.id]; S.chainPending=null; S.chainDone=true;
    if(u && u.alive && card.sig2){ u.sig=card.sig2; u.cd=0; S.midScene=(S.midScene||[]).concat(S.chain.lines||[]); } }
  (S.awaken||[]).forEach((a,i)=>{ if(S.awoke[i]) return;
    const u=S.teams[0].find(x=>x.id===a.id && x.alive); if(!u) return;
    if(!(u.hp<=u.max*(a.at||0) || (a.round && S.round>=a.round))) return;
    S.awoke[i]=true; S.pendingAwake=(S.pendingAwake||[]).concat({uid:u.uid, to:a.to||a.id+'_mark'});
    S.midScene=(S.midScene||[]).concat(a.lines||[]);
  });
}
// Teams with anyone still standing
const standing = () => players().filter(p=>alive(p).length);
// Sides with anyone standing (in 2v2 a side is two players)
const sidesUp = () => [...new Set(standing().map(sideOf))];
// Final places for the win screen: [[winner], [2nd…], …], best first; teams that fell together share a place
function placings(){ const out=(S.outOrder||[]).slice().reverse(); return S.winner>=0 ? [[S.winner], ...out] : out; }
// story: allies who join your team at the start of a given round (they arrive at the end of the round before)
function reinforcements(){
  ((S.twist||{}).reinforce||[]).forEach(r=>{ if(r.round===S.round+1 && !r.came) arrive(r); });
}
function nextWave(){ if(S.waveQ && S.waveQ.length) arrive({id:S.waveQ.shift()}); }
function arrive(r){ r.came=true; const u=mkUnit(r.id,0); S.teams[0].push(u);
  L(`${u.name} arrives to fight alongside ${S.names[0]}!`,'h',{spawn:[u.uid], ...fx('spawn',null,u)});
  if(!S.noArriveSyn) arriveSynergies(u); }
// A fighter who joins mid-fight (story reinforcements, Nine Hashira waves) gets the synergies and matchups they'd have
// had from the start, and so does anyone they complete one with (CK, Nov 5, 2026: Kanao and Inosuke never got Revenge
// on Doma). synergies() runs on copies of the living fighters, rebuilt from their cards, with and without the newcomer,
// and only the difference is applied, so nothing counts twice.
function arriveSynergies(nu){
  const real={teams:S.teams, sib:S.sib, twins:S.twins}, F=['pow','spd','def','regen'];
  const copy=x=>{ const c=BYID[x.id]; return {uid:x.uid, id:x.id, fam:x.fam, p:x.p, demon:x.demon, mark:x.mark, alive:true, pow:c.pow, spd:c.spd, def:c.def, regen:c.regen||0}; };
  const run=withNew=>{ S.teams=real.teams.map(t=>t.filter(x=>x.alive && (withNew || x!==nu)).map(copy)); S.sib=players().map(()=>false); S.twins=players().map(()=>false);
    const names=players().map(p=>synergies(p)), by={}; S.teams.flat().forEach(x=>{ by[x.uid]=x; }); return {by, names, sib:S.sib, twins:S.twins}; };
  let before, after;
  try{ before=run(false); after=run(true); } finally { Object.assign(S, real); }
  S.teams.flat().forEach(x=>{ const a=after.by[x.uid]; if(!a) return; const b=before.by[x.uid] || copy(x);
    F.forEach(k=>{ x[k]+=a[k]-b[k]; });
    ['revenge','pierceAll','poisonTurns'].forEach(k=>{ if(a[k] && !b[k]) x[k]=a[k]; }); });
  players().forEach(p=>{ if(after.sib[p]) S.sib[p]=true; if(after.twins[p]) S.twins[p]=true;
    const got=after.names[p].filter(n=>!before.names[p].includes(n)); if(got.length && S.syn) S.syn[p]=[...new Set([...(S.syn[p]||[]), ...got])]; });
}
