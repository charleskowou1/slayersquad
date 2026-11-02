/* ================= DAILY CHALLENGE =================
   One counter-drafting puzzle a day. The enemy team is picked in full and shown; you get a number of points and
   draft your own squad, only from characters you've unlocked (so the story opens up more answers). A goal makes it
   more than "just win". The enemy team, your points and the goal are the same on every phone: they're built from the
   date with a seeded random generator, and even the test battles used to set the difficulty run on that generator.
   Difficulty: your points come from 8 to 26; the enemy team is then chosen so a strong computer drafting only from the
   starting characters meets the goal in 35–75% of tries.
   Daily games don't count toward Stats. Progress and the streak are kept in localStorage (DAILY_KEY). No DOM. */
const DAILY_KEY = 'squad-draft-daily';
const DAILY_GOALS = {
  win:    () => 'Beat this team',
  rounds: g => `Beat this team within ${g.n} rounds`,
  keep:   g => `Beat this team with ${BYID[g.id].short} on your squad, still standing`,
};
const todayKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
// Small seeded random generator (mulberry32) from a string
function seededRng(str){ let h=1779033703^str.length; for(let i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),3432918353); h=h<<13|h>>>19; }
  return ()=>{ h|=0; h=h+0x6D2B79F5|0; let t=Math.imul(h^h>>>15,1|h); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
// The enemy: a random team within `pts` points, up to 4 fighters, one version per character
function dailyEnemy(rng, cards, pts){
  const pool=cards.filter(c=>c.cost<=pts), team=[], fams=new Set(); let left=pts;
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }   // a real shuffle: a random sort comes out differently on iPhone and Android
  for(const c of pool){ if(team.length>=4) break; if(c.cost<=left && !fams.has(c.fam)){ team.push(c.id); fams.add(c.fam); left-=c.cost; } }
  return team.length>=1 ? team : null;
}
// Did the battle just finished meet the goal?
function dailyMet(ch){
  if(S.winner!==0) return false;
  const g=ch.goal;
  if(g.type==='rounds') return S.round<=g.n;
  if(g.type==='keep') return S.teams[0].some(u=>u.id===g.id && u.alive);
  return true;
}
// Set up the challenge's draft (enemy locked in, you pick within the points from `open` cards). A "keep X standing"
// goal puts X on your squad from the start (its points already spent; not in the Undo history, so it stays).
function dailyDraft(ch, open){
  Object.assign(S,{mode:'daily', n:2, duo:false, maxTeam:MAXTEAM, bansOn:false, banning:false, bans:[], daily:ch, budget:ch.budget, level:ch.level,
    phase:'draft', first:0, lastPicker:null, history:[], k:0, sel:null, picks:[ch.goal.type==='keep'?[ch.goal.id]:[], ch.enemy.slice()], locked:[false,true], showTheirs:false});
  const enemyFams=new Set(ch.enemy.map(id=>BYID[id].fam));
  S.pool=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=ch.budget && open(c) && !enemyFams.has(c.fam)).map(c=>c.id)
    .sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name)).concat(dealHelpers(seededRng('helpers '+ch.day)));   // the day's 3 helpers, the same for everyone
}
// One test of the challenge: a strong computer drafts from the starting characters, then both sides fight
const starterCard = c => typeof lockable!=='function' || !lockable(c);
function dailyTrial(ch){
  const keep=S; S={names:['You','Foe'], unlockAll:true, trial:true};   // the same for every player: no saved progress, no background roll
  dailyDraft(ch, starterCard);
  let k=0; while(S.phase==='draft' && k++<40) cpuDraftStep('hard');
  if(S.phase==='draft'){ S.locked=[true,true]; startBattle(); }
  while(S.phase!=='over'){ cpuPlan(0,'hard'); cpuPlan(1,ch.level); cpuHelpers(0); cpuHelpers(1); resolve(); if(S.phase==='result') S.round++; }
  const out={won:S.winner===0, rounds:S.round, met:dailyMet(ch)}; S=keep; return out;
}
// Today's challenge: your points are picked from a wide range (8 to 26, so some days push you toward characters you'd
// never usually play), then seeded enemy teams and goals are tried until one is fair for those points (goal met in
// 35–75% of 24 test battles), else the closest. Cached per day.
const DAILY_POINTS = [8,10,12,14,16,18,20,22,24,26];
let DAILY_CACHE=null;
function dailyChallenge(day=todayKey()){
  if(DAILY_CACHE && DAILY_CACHE.day===day) return DAILY_CACHE;
  const rng=seededRng('squad-draft '+day), real=Math.random; Math.random=rng;   // the test battles use the seed too
  try{
    const anyone=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=14), starters=ROSTER.filter(c=>!c.spawn && !c.helper && starterCard(c) && c.cost<=6);
    const budget=DAILY_POINTS[Math.floor(rng()*DAILY_POINTS.length)];
    let best=null;
    for(let tries=0;tries<40;tries++){
      // the enemy's points sit around yours (a little under to a fair bit over), and the test battles decide if it's fair
      const ep=Math.max(4, budget + [-2,0,0,2,2,4,6][Math.floor(rng()*7)]);
      const enemy=dailyEnemy(rng, anyone.filter(c=>c.cost<=Math.max(4,budget)), ep); if(!enemy) continue;
      const type=['win','rounds','keep'][Math.floor(rng()*3)], level=rng()<.5?'normal':'hard';
      const ch={day, enemy, level, goal:{type}, budget};
      if(type==='keep'){ const ok=starters.filter(c=>c.cost<=budget && !enemy.some(e=>BYID[e].fam===c.fam)); if(!ok.length) continue; ch.goal.id=ok[Math.floor(rng()*ok.length)].id; }
      if(type==='rounds'){ const w=[]; for(let i=0;i<10;i++){ const t=dailyTrial(ch); if(t.won) w.push(t.rounds); } if(w.length<3) continue; w.sort((a,b)=>a-b); ch.goal.n=w[Math.floor(w.length*.55)]; }
      let met=0; for(let i=0;i<24;i++) if(dailyTrial(ch).met) met++;
      ch.rate=met/24; const miss=Math.abs(ch.rate-.55);
      if(!best || miss<best.miss) best={ch:JSON.parse(JSON.stringify(ch)), miss};
      if(ch.rate>=.35 && ch.rate<=.75) break;
    }
    DAILY_CACHE=best.ch; return best.ch;
  } finally { Math.random=real; }
}
function loadDaily(){ try{ return JSON.parse(localStorage.getItem(DAILY_KEY))||{} }catch(e){ return {} } }
function saveDaily(d){ try{ localStorage.setItem(DAILY_KEY,JSON.stringify(d)) }catch(e){} }
const dailyDone = (day=todayKey()) => (loadDaily().done||[]).includes(day);
// Streak: days in a row with the challenge completed, ending today (or yesterday, if today isn't done yet)
function dailyStreak(){
  const done=new Set(loadDaily().done||[]), d=new Date(); if(!done.has(todayKey(d))) d.setDate(d.getDate()-1);
  let n=0; while(done.has(todayKey(d))){ n++; d.setDate(d.getDate()-1); } return n;
}
function markDaily(day){ const d=loadDaily(); d.done=[...new Set([...(d.done||[]), day])].slice(-400); saveDaily(d); }
// Start today's challenge: the draft, from the characters this phone has unlocked
function startDaily(){
  const ch=dailyChallenge(), name=playerName()||'Player 1';
  dailyDraft(ch, c=>S.unlockAll || typeof isUnlocked!=='function' || isUnlocked(c.id));
  S.names=[name, 'Daily challenger'];
}

/* ---------- Final Form ----------
   Very hard and endlessly replayable (CK, Nov 2, 2026: players were beating Hard). You draft Marked slayers and Corps
   support; Muzan then answers with Final Muzan and three Upper Moons chosen to counter your squad, with a little chance so no
   two runs match. His side hits harder (FINAL_POW) and his moves have no noise. Dawn comes early (FINAL_SUNRISE). */
const FINAL_SUPPORT = ['kagaya','murata','zenitsu','inosuke','kanao','genya','hinatsuru','makio','suma','urokodaki','tengen_retired'];
// Which of your cards each Upper Moon does best against (from the simulator). Nakime and Kaigaku made the fight easier, so he leaves them out.
const FINAL_COUNTERS = {hantengu:['giyu_mark','gyomei_mark','kagaya','urokodaki'], doma:['tanjiro_mark','hinatsuru','makio','murata'], kokushibo:['giyu_mark','murata','urokodaki'],
  akaza:['obanai_mark','makio','suma','genya'], gyutaro:['inosuke','kanao','zenitsu','tengen_retired'], gyokko:['mitsuri_mark','tanjiro_mark','obanai_mark']};
function finalPicks(team){
  const left=Object.keys(FINAL_COUNTERS), out=['muzan_final'], score=id=>FINAL_COUNTERS[id].filter(c=>team.includes(c)).length*4 + BYID[id].cost*.3 + Math.random()*4;
  while(out.length<4) out.push(left.splice(left.indexOf(left.slice().sort((a,b)=>score(b)-score(a))[0]),1)[0]);
  return out;
}
function finalTaunt(team, foes){
  for(const id of foes.slice(1)){ const c=(FINAL_COUNTERS[id]||[]).find(x=>team.includes(x)); if(c) return `${BYID[c].short}? ${BYID[id].short} will deal with that one.`; }
  return 'You came all this way to die before dawn.';
}

/* ---------- Game Modes (Quickplay → Game Modes) ----------
   Solo modes sharing one flow: your own draft (or none), the enemy revealed afterwards (startBattle → gmEnemy, phase 'reveal').
   Gauntlet and Upper Moon Rush are runs: S.series.wave counts the fights, and survivors carry into the next one (gmNext). */
const GM = {
  gauntlet:{title:'Gauntlet', blurb:'One squad, wave after wave. Damage carries over. How far can you get?', kj:'連', line:'Survive wave after wave', budget:30, foe:'The wave', art:'tanjiro'},
  rush:{title:'Upper Moon Rush', blurb:'Slayers only. Beat the Upper Moons one by one, then Muzan. Damage carries over.', kj:'月', line:'Eight fights to Muzan', budget:35, foe:'Upper Moons', art:'kokushibo'},
  random:{title:'Random Squads', blurb:'Both teams are dealt at random. No draft: just play your hand.', kj:'運', line:'No draft, just your hand', budget:20, foe:'Computer', art:'zenitsu'},
  mirror:{title:'Mirror Match', blurb:'The computer copies your squad exactly. Only your moves can win it.', kj:'鏡', line:'Same squad, better moves', budget:20, foe:'Your reflection', art:'typezero'},
};
const RUSH_FIGHTS = [['kaigaku'],['gyokko'],['gyutaro','daki'],['hantengu'],['akaza'],['doma'],['kokushibo'],['muzan_final']];
const RUSH_DEMONS = ['enmu','rui','kyogai','susamaru','yahaba','hand','swamp'], RUSH_ESCORT = 3, GM_HEAL = .2;   // what survivors get back between fights in a run
const GM_KEY = 'squad-draft-modes';   // {mode: {won, played, best}}
const gmStats = mode => { try{ return (JSON.parse(localStorage.getItem(GM_KEY))||{})[mode]||{won:0, played:0, best:0}; }catch(e){ return {won:0, played:0, best:0}; } };
function gmRecord(won){
  const m=S.mode, r=gmStats(m), g=S.series, more=won && g && gmFights()>g.wave;
  if(!more){ r.played++; if(won) r.won++; }   // a run counts once, when it ends, but its best is saved after every fight, so leaving mid-run keeps it
  if(g) r.best=Math.max(r.best, won?g.wave:g.wave-1);
  try{ const all=JSON.parse(localStorage.getItem(GM_KEY))||{}; all[m]=r; localStorage.setItem(GM_KEY,JSON.stringify(all)); }catch(e){}
}
const gmFights = () => S.mode==='rush' ? RUSH_FIGHTS.length : Infinity;
const gmName = () => S.mode==='final' ? 'Final Form' : GM[S.mode].title;
// A random squad: any card that fits, one version per character
function randSquad(budget, cards){
  const out=[], fams=new Set(); let left=budget;
  cards.slice().sort(()=>Math.random()-.5).forEach(c=>{ if(out.length<MAXTEAM && c.cost<=left && !fams.has(c.fam)){ out.push(c.id); fams.add(c.fam); left-=c.cost; } });
  return out;
}
const gmCards = () => ROSTER.filter(c=>!c.spawn && !c.helper);
// Gauntlet: each wave is a bigger random squad, and the computer stops making mistakes from wave 3
const waveBudget = w => 6+4*w;
function gmEnemy(){
  if(S.mode==='final') return finalPicks(S.picks[0]);
  if(S.mode==='mirror') return S.picks[0].slice();
  if(S.mode==='rush'){ const w=S.series.wave;   // alone they get swarmed (the computer cleared 100%): each brings lesser demons, more every fight
    return RUSH_FIGHTS[w-1].concat(randSquad(RUSH_ESCORT*w, RUSH_DEMONS.map(id=>BYID[id]))); }
  S.level=S.series.wave<3?'normal':'hard';
  return randSquad(waveBudget(S.series.wave), gmCards().filter(c=>c.cost<=waveBudget(S.series.wave)));
}
const gmBase = mode => ({mode, unlockAll:true, n:2, duo:false, maxTeam:MAXTEAM, bansOn:false, banning:false, bans:[], budget:mode==='final'?FINAL_BUDGET:GM[mode].budget, level:'hard', poolType:'random', sideWar:false,
  phase:'draft', first:0, lastPicker:null, history:[], k:0, sel:null, picks:[[],[]], locked:[false,true], showTheirs:false, heldCalm:0, series:mode==='gauntlet'||mode==='rush'?{wave:1}:null,
  names:[playerName()||'Player 1', mode==='final'?'Muzan':GM[mode].foe]});
function gmDraft(mode){
  Object.assign(S,gmBase(mode));
  S.pool=ROSTER.filter(mode==='final' ? c=>(c.mark&&!c.demon&&!c.spawn)||FINAL_SUPPORT.includes(c.id) : c=>!c.spawn && !c.helper && !(mode==='rush'&&c.demon)).map(c=>c.id)
    .sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name)).concat(dealHelpers());
}
function gmRandom(){
  Object.assign(S,gmBase('random')); const cards=gmCards();
  const a=randSquad(S.budget,cards), fams=new Set(a.map(id=>BYID[id].fam));
  S.picks=[a, randSquad(S.budget,cards.filter(c=>!fams.has(c.fam)))]; S.locked=[true,true]; S.pool=[]; startBattle();   // no character on both teams, in any version
}
const gmStart = mode => mode==='random' ? gmRandom() : gmDraft(mode);
const gmAgain = () => gmStart(S.mode);   // a fresh draft (CK): refilling a full squad locked it and skipped the draft
// The next fight of a run: survivors keep their damage, heal a little and have their specials ready
function gmNext(){
  const keep=S.teams[0].filter(u=>u.alive), g=S.series; g.wave++;
  keep.forEach(u=>{ u.hp=Math.min(u.max, u.hp+Math.ceil(u.max*GM_HEAL)); u.cd=0; u.poison=null; u.stun=u.stunNext=false; u.devoured=0; u.defending=u.evade=false; });
  S.picks[1]=[]; startBattle(); S.teams[0]=keep;
}
