/* ================= TOURNAMENT (Nov 12, 2026, CK) =================
   An online bracket for 4 or 8 players. At least 2 people; computers fill the empty seats.
   - Everyone drafts their own squad, privately, from every character (different players can own the same character;
     one version per character inside a squad).
   - Person vs person: an own-pace online game with both squads preset (gm 'tour', see dealMatch in online.js).
     Person vs computer: played on that person's phone like Quickplay. Computer vs computer: simulated instantly.
   - Spoils: after a win you may swap one fighter of yours for one from the team you beat (a stronger version of someone you
     already have is allowed); each win adds TOUR_SPOILS points of room. Computers take the best upgrade that fits.
   - The final is best of 3. The champion gets a screen and a tournament win on their phone.
   Data: rooms/<CODE>/tour. `s` is the bracket as JSON, written only by the host's phone. Each phone writes its own
   joins/<phone>, dacts/<pick number> (draft picks), spoils/<match> and results/<match>_<game>. The host's phone runs tourStep() on every change. */
const TOUR = {code:null, ref:null, raw:null, s:null, host:false, making:{}, offs:[], reported:{}};
const TOUR_SPOILS = 3, TOUR_NOW = 'squad-draft-tour-now', TOUR_KEY = 'squad-draft-tour';
const TOUR_CPU = ['Akaza AI','Doma AI','Kokushibo AI','Gyokko AI','Hantengu AI','Daki AI','Kaigaku AI'];
const tourCost = q => q.reduce((a,id)=>a+BYID[id].cost,0);
const tourFighters = q => q.filter(id=>!BYID[id].helper);
const tourMeIdx = () => TOUR.s && TOUR.s.players ? TOUR.s.players.findIndex(p=>p.phone===PHONE_ID) : -1;
const tourRounds = s => Math.round(Math.log2(s.size));
const tourWinner = m => m.w===null || m.w===undefined ? -1 : m.w ? m.b : m.a;
const tourLoser = m => m.w===null || m.w===undefined ? -1 : m.w ? m.a : m.b;
const tourRec = () => { try{ return JSON.parse(localStorage.getItem(TOUR_KEY))||{wins:0, seen:[]}; }catch(e){ return {wins:0, seen:[]}; } };

/* ---------- pure rules (no network) ---------- */
// Where people sit: spread out so they meet the computers first and each other later (4: 0,2,1,3; 8: 0,4,2,6,1,5,3,7)
const tourSeats = size => size===8 ? [0,4,2,6,1,5,3,7] : [0,2,1,3];
function tourPlayers(size, humans){
  const out=Array.from({length:size}, ()=>null), seats=tourSeats(size);
  humans.slice(0,size).forEach((h,i)=>{ out[seats[i]]={name:h.name, phone:h.phone, squad:null, pts:0, wins:0}; });
  let c=0; return out.map(p=>p || {name:TOUR_CPU[c++ % TOUR_CPU.length], phone:null, squad:null, pts:0, wins:0});
}
function tourPair(s, r){
  const last = r===tourRounds(s)-1, need = last ? 2 : 1;
  const ids = r===0 ? s.players.map((p,i)=>i) : s.matches.filter(m=>m.r===r-1).map(tourWinner);
  const out=[]; for(let i=0;i<ids.length;i+=2) out.push({r, a:ids[i], b:ids[i+1], w:null, wins:[0,0], need, g:0, game:null, spoil:null});
  return out;
}
// A spoils swap is allowed if the squad stays within its points, one version per character, and at most MAXTEAM fighters
function tourSpoilOk(p, sq){ const f=tourFighters(sq), fams=new Set(f.map(id=>BYID[id].fam)); return tourCost(sq)<=p.pts && fams.size===f.length && f.length<=MAXTEAM; }
function tourApplySpoil(s, m, sp){
  const W=s.players[tourWinner(m)]; W.pts += TOUR_SPOILS; W.wins=(W.wins||0)+1;
  if(sp && sp.take && sp.drop){ const sq=W.squad.slice(), i=sq.indexOf(sp.drop); if(i>=0 && !BYID[sp.drop].helper && !BYID[sp.take].helper){ sq[i]=sp.take;
    if(tourSpoilOk(W, sq)){ W.squad=sq; const L=s.players[tourLoser(m)], j=L.squad.indexOf(sp.take); if(j>=0){ L.squad=L.squad.slice(); L.squad[j]=sp.drop; } } } }   // a true swap: the beaten team gets yours, so no card is ever on two teams
}
// The computer's spoils: the costliest upgrade from the beaten squad that fits (a same-family upgrade first)
function tourAutoSpoil(s, m){
  const W=s.players[tourWinner(m)], L=s.players[tourLoser(m)], room=W.pts+TOUR_SPOILS;
  const takes=tourFighters(L.squad).slice().sort((a,b)=>BYID[b].cost-BYID[a].cost);
  for(const take of takes){
    const drops=tourFighters(W.squad).slice().sort((a,b)=>(BYID[b].fam===BYID[take].fam)-(BYID[a].fam===BYID[take].fam) || BYID[a].cost-BYID[b].cost);
    for(const drop of drops){ if(BYID[take].cost<=BYID[drop].cost) continue; const sq=W.squad.slice(); sq[sq.indexOf(drop)]=take; if(tourSpoilOk({pts:room}, sq)) return {take, drop}; }
  }
  return {skip:true};
}
// The draft (CK, Nov 12, 2026): everyone in the bracket, people and computers, picks one card at a time in snake order
// from one shared pool, and every card can be taken only once in the whole tournament (one Mark Tanjiro at most).
// Different versions of a character can be on different teams; on one team the usual rules hold (one version per
// character, your points, at most MAXTEAM fighters, one helper).
const tourBudget = (s, pi) => s.budget - ((s.draft && s.draft.bid) ? (s.draft.bid[pi]||0) : 0);   // your points after your bid
const tourPool = s => ROSTER.filter(c=>!c.spawn && c.cost<=s.budget).map(c=>c.id)
  .sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name));
const tourSeatAt = (d, k) => { const N=d.order.length, r=Math.floor(k/N), i=k%N; return d.order[r%2 ? N-1-i : i]; };
function tourCanTake(s, pi, id){
  const d=s.draft, c=BYID[id], q=d.picks[pi]; if(!c || d.taken[id]!==undefined || tourCost(q)+c.cost>tourBudget(s,pi)) return false;
  if(c.helper) return !q.some(x=>BYID[x].helper);
  const f=tourFighters(q); return f.length<MAXTEAM && !f.some(x=>BYID[x].fam===c.fam);
}
const tourCanAny = (s, pi) => tourPool(s).some(id=>!BYID[id].helper && tourCanTake(s,pi,id));
const tourShuffle = n => { const o=Array.from({length:n},(_,i)=>i); for(let i=n-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [o[i],o[j]]=[o[j],o[i]]; } return o; };
// Bid for your draft spot (CK, Nov 13, 2026: players wanted some say in the draft order; picking seats failed because
// nobody wants the last one). Everyone secretly bids points from their own draft budget; the highest bid drafts first
// (ties are a coin flip), and what you bid is gone for the whole tournament, so an early pick costs you later.
const tourBidMax = s => Math.max(1, Math.round(s.budget/7));   // 10 pts: 1, 20: 3, 30: 4
function tourBidsInit(s){ s.bids={cpu:{}}; s.players.forEach((p,i)=>{ if(!p.phone) s.bids.cpu[i]=tourCpuBid(s); }); s.phase='bids'; }
function tourCpuBid(s){ const m=tourBidMax(s), r=Math.random(), lv=s.level;
  return lv==='hard' ? Math.min(m, r<.2?0:r<.55?1:r<.85?2:3) : lv==='easy' ? Math.floor(Math.random()*(m+1)) : Math.min(m, r<.35?0:r<.7?1:2); }
const tourBidOf = (s, raw, pi) => { const p=s.players[pi]; return p.phone ? ((raw.bids||{})[p.phone]) : s.bids.cpu[pi]; };
// Everyone in: order by bid (highest first, ties shuffled) and start the draft with each player's bid taken off
function tourBidsDone(s, raw){
  const n=s.players.length, bids=s.players.map((p,i)=>{ const b=tourBidOf(s,raw,i); return b===undefined||b===null ? null : Math.max(0, Math.min(tourBidMax(s), +b||0)); });
  if(bids.some(b=>b===null)) return false;
  const tie=tourShuffle(n), order=s.players.map((p,i)=>i).sort((a,b)=>bids[b]-bids[a] || tie.indexOf(a)-tie.indexOf(b));
  tourDraftInit(s, order, bids); return true;
}
function tourDraftInit(s, chosen, bid){
  const order=chosen || tourShuffle(s.players.length);
  s.draft={order, k:0, picks:s.players.map(()=>[]), locked:s.players.map(()=>false), taken:{}, last:null, bid:bid||null};
  s.phase='draft'; tourDraftSkip(s);
}
// Move past anyone who has locked or can't afford another fighter; when everyone is done, the bracket starts
function tourDraftSkip(s){
  const d=s.draft; let g=0;
  while(g++<999){
    if(d.locked.every(x=>x)){ s.players.forEach((p,i)=>{ p.squad=d.picks[i].slice(); p.pts=tourBudget(s,i); }); s.phase='play'; s.round=0; s.matches=tourPair(s,0); return; }
    const pi=tourSeatAt(d,d.k); if(d.locked[pi]){ d.k++; continue; }
    if(!tourCanAny(s,pi)){ d.locked[pi]=true; d.k++; continue; }
    return;
  }
}
// One pick (or Lock team) by player pi; only on their turn
function tourDraftAct(s, pi, act){
  const d=s.draft; if(s.phase!=='draft' || tourSeatAt(d,d.k)!==pi || d.locked[pi]) return false;
  if(act.lock){ if(!tourFighters(d.picks[pi]).length) return false; d.locked[pi]=true; }
  else { if(!tourCanTake(s,pi,act.id)) return false; d.picks[pi].push(act.id); d.taken[act.id]=pi; d.last={pi, id:act.id}; }
  d.k++; tourDraftSkip(s); return true;
}
// A computer's pick: the strongest card it can afford that still leaves room for a second fighter, with a little chance
// (more on Easy); a partner it pairs well with counts extra; a helper once it's down to 1-2 points; then it locks
function tourCpuPick(s, pi){
  const d=s.draft, q=d.picks[pi], left=tourBudget(s,pi)-tourCost(q), f=tourFighters(q), noise={easy:6, normal:3, hard:1.5}[s.level]||3;
  const opts=tourPool(s).filter(id=>tourCanTake(s,pi,id) && !BYID[id].helper);
  if(f.length>=2 && left<=2){ const h=tourPool(s).find(id=>BYID[id].helper && tourCanTake(s,pi,id)); return h && Math.random()<.6 ? {id:h} : {lock:true}; }
  if(f.length>=4 || !opts.length) return {lock:true};
  const cheapest=Math.min(...opts.map(id=>BYID[id].cost));
  const score=id=>{ const c=BYID[id], rest=left-c.cost; let v=c.cost+Math.random()*noise;
    if(f.length<1 && rest>0 && rest<cheapest) v-=8;   // leave room for a second fighter
    if(typeof PAIRS!=='undefined' && PAIRS.some(([a,b])=>(a===c.fam||a===id) && f.some(x=>BYID[x].fam===b||x===b) || (b===c.fam||b===id) && f.some(x=>BYID[x].fam===a||x===a))) v+=3;
    return v; };
  return {id:opts.sort((a,b)=>score(b)-score(a))[0]};
}
// Computer vs computer: one real battle, played out at once (0 = side a won, 1 = side b, -1 = draw)
function tourSim(a, b, level){
  const keep=S; let w=-1;
  try{ S={names:['A','B'], unlockAll:true, trial:true, mode:'cpu', n:2, duo:false, budget:UNLIMITED, maxTeam:MAXTEAM, level, picks:[a.slice(), b.slice()]};
    startBattle(); let k=0; while(S.phase!=='over' && k++<80){ cpuPlan(0,level); cpuPlan(1,level); cpuHelpers(0); cpuHelpers(1); resolve(); if(S.phase==='result') S.round++; } w=S.winner; }
  finally{ S=keep; }
  return w;
}
const tourKind = (s, m) => { const A=s.players[m.a].phone, B=s.players[m.b].phone; return A && B ? 'hh' : A || B ? 'hc' : 'cc'; };
// One step of the host's bracket: take in squads, results and spoils, simulate computer matches, start the next round.
// Returns the games to create (person vs person) as [match index]; the caller creates them.
function tourAdvance(s, raw){
  raw=raw||{}; const make=[];
  if(s.phase!=='play') return make;
  let guard=0;
  while(guard++<20){
    let moved=false;
    s.matches.forEach((m,mi)=>{
      if(m.r!==s.round) return;
      const kind=tourKind(s,m);
      // results reported by phones (person vs person, person vs computer)
      while(m.w===null && kind!=='cc' && raw.results && raw.results[`${mi}_${m.g}`]!==undefined){
        const res=raw.results[`${mi}_${m.g}`]; if(res===0 || res===1) m.wins[res]++;
        m.g++; m.game=null; if(m.wins[0]>=m.need) m.w=0; else if(m.wins[1]>=m.need) m.w=1; moved=true;
      }
      // computer vs computer: play it out now (a draw is replayed)
      if(m.w===null && kind==='cc'){ let k=0; while(m.w===null && k++<9){ const r=tourSim(s.players[m.a].squad, s.players[m.b].squad, s.level); if(r===0||r===1) m.wins[r]++; m.g++; if(m.wins[0]>=m.need) m.w=0; else if(m.wins[1]>=m.need) m.w=1; } if(m.w===null) m.w=0; moved=true; }
      if(m.w===null && kind==='hh' && !m.game) make.push(mi);
      // spoils: computers take theirs at once; a person picks on their phone (or skips)
      if(m.w!==null && !m.spoil){
        const W=s.players[tourWinner(m)], sp=raw.spoils && raw.spoils[mi];
        if(!W.phone || s.round===tourRounds(s)-1){ tourApplySpoil(s, m, W.phone ? null : tourAutoSpoil(s,m)); m.spoil='done'; moved=true; }
        else if(sp){ tourApplySpoil(s, m, sp.skip ? null : sp); m.spoil='done'; moved=true; }
      }
    });
    const cur=s.matches.filter(m=>m.r===s.round);
    if(cur.length && cur.every(m=>m.w!==null && m.spoil)){
      if(s.round>=tourRounds(s)-1){ s.phase='done'; s.champion=tourWinner(cur[0]); return make; }
      s.round++; s.matches=s.matches.concat(tourPair(s, s.round)); moved=true;
    }
    if(!moved) break;
  }
  return make.filter((mi,i,a)=>a.indexOf(mi)===i);
}

/* ---------- single player (CK, Nov 12, 2026): the same bracket on this phone only ----------
  Code TOUR_SOLO, stored in localStorage instead of Firebase, behind a small stand-in for a Firebase ref
  (child(path).set, on/off 'value'), so every rule above runs unchanged. You and computers; works offline. */
const TOUR_SOLO = 'SOLO', TOUR_SOLO_KEY = 'squad-draft-tour-solo';
let SOLO_REF = null;
function soloRef(){
  if(SOLO_REF) return SOLO_REF;
  let raw=null; try{ raw=JSON.parse(localStorage.getItem(TOUR_SOLO_KEY)); }catch(e){}
  const subs=[], snap={val:()=>raw};
  const save=()=>{ try{ if(raw) localStorage.setItem(TOUR_SOLO_KEY, JSON.stringify(raw)); else localStorage.removeItem(TOUR_SOLO_KEY); }catch(e){} setTimeout(()=>subs.slice().forEach(f=>f(snap)),0); };
  SOLO_REF = { raw:()=>raw, reset(v){ raw=v; save(); },
    child(path){ return { set(v){ if(!raw) return Promise.resolve(); const ks=path.split('/'); let o=raw; ks.slice(0,-1).forEach(k=>{ o=o[k]=o[k]||{}; }); o[ks[ks.length-1]]=v; save(); return Promise.resolve(); } }; },
    on(_, f){ subs.push(f); setTimeout(()=>f(snap),0); }, off(_, f){ const i=subs.indexOf(f); if(i>=0) subs.splice(i,1); } };
  return SOLO_REF;
}
// A tournament from before the shared draft (v135) has computers that drafted alone, so the same cards turn up on
// several teams (CK, Nov 13, 2026). Those are cleared instead of resumed.
const tourOld = s => !!s && !['lobby','cancelled','bids'].includes(s.phase) && !s.draft;
const tourSoloOpen = () => { const r=soloRef().raw(); if(!r) return false; try{ const s=JSON.parse(r.s); if(tourOld(s)){ soloRef().reset(null); return false; } return s && s.phase!=='done'; }catch(e){ return false; } };
function tourSolo(){
  const name=titled(myName()), s={phase:'lobby', solo:true, id:Date.now(), size:4, budget:20, level:'normal', humans:[{phone:PHONE_ID, name, at:Date.now()}], players:[], round:0, matches:[]};
  tourOff(); TOUR.code=null; soloRef().reset({host:PHONE_ID, s:JSON.stringify(s), joins:{[PHONE_ID]:{name, at:Date.now()}}});
  tourEnter(TOUR_SOLO);
}

/* ---------- network (Firebase, rooms/<CODE>/tour) ---------- */
const tourWriteS = () => TOUR.ref && TOUR.host && TOUR.ref.child('s').set(JSON.stringify(TOUR.s));
function tourListen(code){
  tourOff(); TOUR.code=code;
  (code===TOUR_SOLO ? Promise.resolve(null) : firebaseReady()).then(db=>{
    TOUR.ref = db ? db.ref('rooms/'+code+'/tour') : soloRef();
    const f=snap=>{ const raw=snap.val(); if(!raw) return; TOUR.raw=raw; TOUR.host=raw.host===PHONE_ID;
      if(TOUR.host){ if(!TOUR.s) TOUR.s=JSON.parse(raw.s||'null'); tourHostStep(); } else TOUR.s=JSON.parse(raw.s||'null');
      if(tourOld(TOUR.s)){ TOUR.s={phase:'cancelled', old:true}; if(code===TOUR_SOLO) soloRef().reset(null); try{ localStorage.removeItem(TOUR_NOW); }catch(e){} }
      tourChampion(); if(S.phase==='tour') render(); };
    TOUR.ref.on('value', f); TOUR.offs.push(()=>TOUR.ref.off('value', f));
  }).catch(e=>{ S.tourMsg=netError(e); render(); });
}
function tourOff(){ clearTimeout(TOUR.cpuT); TOUR.cpuT=null; TOUR.offs.forEach(f=>f()); TOUR.offs=[]; TOUR.s=null; TOUR.raw=null; TOUR.host=false; TOUR.making={}; }
function tourHostStep(){
  const s=TOUR.s; if(!s || s.phase==='cancelled') return;
  const quits=TOUR.raw.quits||{}; let qd=false;
  (s.players||[]).forEach(p=>{ if(p.phone && quits[p.phone]){ p.phone=null; p.quit=true; qd=true; } });   // a computer takes the seat of anyone who quits
  if(qd){ s.matches.forEach(m=>{ if(m.w===null && tourKind(s,m)!=='hh') m.game=null; }); tourWriteS(); }
  if(s.phase==='lobby'){   // the lobby's player list follows who has joined
    const humans=Object.entries(TOUR.raw.joins||{}).map(([phone,j])=>({phone, name:j.name, at:j.at||0})).sort((a,b)=>a.at-b.at);
    const names=JSON.stringify(humans.map(h=>[h.phone,h.name])); if(names!==JSON.stringify((s.humans||[]).map(h=>[h.phone,h.name]))){ s.humans=humans.slice(0,s.size); tourWriteS(); }
    return;
  }
  if(s.phase==='bids'){
    // a person who quit mid-bid has become a computer: give them a bid
    s.players.forEach((p,i)=>{ if(!p.phone && s.bids.cpu[i]===undefined) s.bids.cpu[i]=tourCpuBid(s); });
    if(tourBidsDone(s, TOUR.raw)){ tourWriteS(); tourHostStep(); }
    return;
  }
  if(s.phase==='draft'){
    const d=s.draft; let changed=false, g=0;
    while(s.phase==='draft' && g++<60){ const a=(TOUR.raw.dacts||{})[d.k], pi=tourSeatAt(d,d.k), P=s.players[pi];
      if(a && P.phone && a.phone===P.phone){ if(!tourDraftAct(s, pi, a)) d.k++; changed=true; continue; }   // a stale or invalid act can't block the draft
      break; }
    if(changed) tourWriteS();
    if(s.phase==='draft'){ const pi=tourSeatAt(d,d.k);
      if(!s.players[pi].phone && !TOUR.cpuT) TOUR.cpuT=setTimeout(()=>{ TOUR.cpuT=null; if(!TOUR.s || TOUR.s.phase!=='draft' || tourSeatAt(TOUR.s.draft,TOUR.s.draft.k)!==pi) return;
        const ok=tourDraftAct(TOUR.s, pi, tourCpuPick(TOUR.s, pi)) || tourDraftAct(TOUR.s, pi, {lock:true}); if(!ok){ TOUR.s.draft.locked[pi]=true; TOUR.s.draft.k++; tourDraftSkip(TOUR.s); }
        tourWriteS(); tourHostStep(); if(S.phase==='tour') render(); }, quickMotion() ? 120 : 900);
      return; }
  }
  const before=JSON.stringify(s), make=tourAdvance(s, TOUR.raw);
  if(JSON.stringify(s)!==before) tourWriteS();
  make.forEach(mi=>tourMakeGame(mi));
}
// Person vs person: an own-pace game with both squads set, joined for both of them (seat 0 = side a, seat 1 = side b)
async function tourMakeGame(mi){
  const s=TOUR.s, m=s.matches[mi], key=mi+'_'+m.g; if(TOUR.making[key] || m.game) return; TOUR.making[key]=true;
  try{
    const db=await firebaseReady(), A=s.players[m.a], B=s.players[m.b], now=Date.now();
    const state=JSON.stringify({phase:'lobby', n:2, names:[A.name], budget:UNLIMITED, poolType:'all', maxTeam:MAXTEAM, bansOn:false, gm:'tour', tourSquads:[A.squad, B.squad],
      tourRef:{code:TOUR.code, mi, g:m.g}, async:true, hostSeat:-1, duo:false, matchNo:0});
    let code=null;
    for(let i=0;i<8 && !code;i++){ const k=newGameCode(), r=await db.ref('games/'+k).transaction(v=>v ? undefined : {created:now, s:state, meta:{names:[A.name], matchNo:0, phase:'lobby', turn:[], round:0, roundId:0, final:false, winner:null, updated:now}}); if(r.committed) code=k; }
    if(!code) throw new Error('Could not make a game code.');
    await asyncNet(db,code).send({a:'join', p:1, name:B.name});
    if(TOUR.s.matches[mi].g===m.g){ TOUR.s.matches[mi].game=code; tourWriteS(); }
  }catch(e){ S.tourMsg=netError(e); render(); }
  finally{ TOUR.making[key]=false; }
}
async function tourCreate(){
  const name=titled(myName()); S.tourMsg='Making a tournament…'; render();
  try{
    const db=await firebaseReady(); let code=null;
    const s={phase:'lobby', size:4, budget:20, level:'normal', humans:[{phone:PHONE_ID, name, at:Date.now()}], players:[], round:0, matches:[]};
    for(let i=0;i<8 && !code;i++){ const c=newRoomCode(), r=await db.ref('rooms/'+c).transaction(v=>v?undefined:{created:Date.now(), tour:{host:PHONE_ID, s:JSON.stringify(s), joins:{[PHONE_ID]:{name, at:Date.now()}}}}); if(r.committed) code=c; }
    if(!code) throw new Error('Could not make a code. Try again.');
    tourEnter(code);
  }catch(e){ S.tourMsg=netError(e); render(); }
}
async function tourIs(code){ try{ const db=await firebaseReady(); return !!(await db.ref('rooms/'+code+'/tour/s').get()).val(); }catch(e){ return false; } }
async function tourJoin(code){
  try{ const db=await firebaseReady(); await db.ref('rooms/'+code+'/tour/joins/'+PHONE_ID).update({name:titled(myName()), at:Date.now()}); tourEnter(code); }
  catch(e){ S.onlineMsg=netError(e); render(); }
}
function tourEnter(code){
  if(code!==TOUR_SOLO) try{ localStorage.setItem(TOUR_NOW, code); }catch(e){}
  S.tourMsg=''; S.tourSpoil=null; Object.assign(S,{mode:'tour', phase:'tour'}); window.scrollTo(0,0);
  if(TOUR.code!==code || !TOUR.ref) tourListen(code); render();
}
const tourPut = (path, v) => TOUR.ref && TOUR.ref.child(path).set(v);
// The tournament screen again, from a finished match (person vs person or person vs computer)
function tourBack(){ const code=(S.tourMatch&&S.tourMatch.code) || TOUR.code || (()=>{ try{ return localStorage.getItem(TOUR_NOW); }catch(e){ return null; } })(); ACTIONS.home(); if(code) tourEnter(code); }
// A finished match reports its winner to the bracket (once per game; both phones of a person-vs-person game may report the same)
function tourReport(){
  const ref=S.tourRef || S.tourMatch; if(!ref || S.winner===undefined) return;
  const key=ref.code+':'+ref.mi+'_'+ref.g; if(TOUR.reported[key]) return; TOUR.reported[key]=true;
  let res = S.winner<0 ? -1 : S.winner;
  if(S.tourMatch) res = S.winner<0 ? -1 : (S.winner===0 ? S.tourMatch.side : 1-S.tourMatch.side);   // locally you're side 0
  if(ref.code===TOUR_SOLO){ soloRef().child(`results/${ref.mi}_${ref.g}`).set(res); return; }
  firebaseReady().then(db=>db.ref(`rooms/${ref.code}/tour/results/${ref.mi}_${ref.g}`).set(res)).catch(()=>{});
}
function tourChampion(){
  const s=TOUR.s; if(!s || s.phase!=='done' || s.champion===undefined) return;
  const key=TOUR.code===TOUR_SOLO ? 'solo'+s.id : TOUR.code, rec=tourRec(); if(rec.seen.includes(key)) return;
  rec.seen.push(key); rec.seen=rec.seen.slice(-60); if(s.players[s.champion].phone===PHONE_ID){ rec.wins++; if(S.phase==='tour') sfx('win'); }
  try{ localStorage.setItem(TOUR_KEY, JSON.stringify(rec)); }catch(e){}
}

/* ---------- playing your match ---------- */
// Person vs computer: on this phone, like Quickplay, with both squads set
function tourFight(mi){
  const s=TOUR.s, m=s.matches[mi], me=tourMeIdx(), side=m.a===me?0:1, foe=s.players[side?m.a:m.b];
  ACTIONS.home();
  Object.assign(S,{mode:'cpu', n:2, duo:false, names:[titled(s.players[me].name), foe.name], picks:[s.players[me].squad.slice(), foe.squad.slice()], level:s.level, unlockAll:true,
    budget:UNLIMITED, maxTeam:MAXTEAM, poolType:'all', sideWar:false, gm:undefined, coop:false, series:null, bans:[], banning:false, final:false, winner:undefined,
    tourMatch:{code:TOUR.code, mi, g:m.g, side}});
  startBattle(); window.scrollTo(0,0);
}
/* ---------- screens (redesigned Nov 13, 2026, CK: "the UI sucks, all parts of it, and it's confusing to keep up
   where you are in the bracket") ---------- */
const tourRoundName = (s, r) => { const R=tourRounds(s), left=R-1-r; return left===0 ? 'Final' : left===1 ? 'Semi-finals' : 'Quarter-finals'; };
const tourRoundOne = (s, r) => { const n=tourRoundName(s,r); return n==='Semi-finals' ? 'Semi-final' : n==='Quarter-finals' ? 'Quarter-final' : n; };
const tourMatchNo = (s, m) => s.matches.filter(x=>x.r===m.r).indexOf(m)+1;
const tourFace = (q, n) => `<span class="tface">${tourFighters(q||[]).slice(0,n||6).map(id=>seal(BYID[id],'sm')).join('')}</span>`;
// The card at the top of the bracket: where you stand and what to do next
function tourHero(s, me){
  if(me<0) return '';
  const P=s.players, p=P[me];
  if(s.phase==='done'){ const c=P[s.champion], mine=s.champion===me;
    const lastR=Math.max(-1,...s.matches.filter(m=>m.a===me||m.b===me).map(m=>m.r)), lastM=s.matches.find(m=>m.r===lastR&&(m.a===me||m.b===me));
    const res=mine?'Champion':lastM&&lastM.r===tourRounds(s)-1?'Runner-up':lastM?`Out in the ${tourRoundName(s,lastM.r).toLowerCase()}`:'';
    return `<div class="thero champ"><span class="tcrown">優勝</span><span class="thlbl">Champion</span><b class="thname">${esc(c.name)}${c.phone?'':' <small>CPU</small>'}</b>${tourFace(c.squad)}<p class="thsub">${mine?'You won the tournament!':esc(res)}</p></div>`; }
  const won=s.matches.map((x,i)=>[x,i]).find(([x,i])=>tourWinner(x)===me && !x.spoil && !(TOUR.raw.spoils||{})[i] && x.r<tourRounds(s)-1);
  if(won) return tourSpoilPanel(s, won[0], won[1], me);
  const mi=s.matches.findIndex(m=>m.r===s.round && (m.a===me || m.b===me)), m=s.matches[mi];
  if(!m){ const lost=s.matches.filter(x=>tourLoser(x)===me).pop();
    return `<div class="thero out"><span class="thlbl">You’re out</span><b class="thname">${lost?`Beaten by ${esc(P[tourWinner(lost)].name)} in the ${esc(tourRoundName(s,lost.r).toLowerCase())}`:'Out of the tournament'}</b><p class="thsub">Watch the rest of the bracket below.</p></div>`; }
  const foe=P[m.a===me?m.b:m.a], mw=m.wins[m.a===me?0:1], fw=m.wins[m.a===me?1:0], kind=tourKind(s,m);
  const head=`<span class="thlbl">${esc(tourRoundOne(s,m.r))}${m.need>1?' · best of 3':''}</span>`;
  const score=m.need>1?`<div class="thscore"><b>${mw}</b><span>–</span><b>${fw}</b><small>${m.w!==null?'':`Game ${m.g+1}${m.g>mw+fw?' · the last one was a draw, so it’s replayed':''}`}</small></div>`:'';
  const vs=`<div class="thvs"><div class="thside you"><b>${esc(p.name)}</b><small>You</small>${tourFace(p.squad)}</div><span class="thv">VS</span><div class="thside"><b>${esc(foe.name)}</b><small>${foe.phone?'Player':'Computer'}</small>${tourFace(foe.squad)}</div></div>`;
  if(m.w!==null) return `<div class="thero wait">${head}<b class="thname">You won! Into the ${esc(tourRoundName(s,m.r+1))}</b><p class="thsub">Waiting for the other matches to finish…</p></div>`;
  const btn = kind==='hc' ? `<button class="btn big" data-a="tourfight" data-v="${mi}">${m.need>1?`Fight game ${m.g+1}`:'Fight'}</button>`
    : kind==='hh' ? (m.game ? `<button class="btn big" data-a="tourplay" data-v="${mi}">${m.need>1?`Play game ${m.g+1}`:'Play'}</button>` : '<button class="btn big" disabled>Setting up your match…</button>') : '';
  return `<div class="thero now">${head}${vs}${score}${btn}${m.need>1?'<p class="thsub">First to 2 wins takes the tournament.</p>':''}</div>`;
}
// One match in the bracket: two rows (name, squad, score); you're gold, winners bright, losers dimmed
function tourMatchCard(s, m, me, label){
  const row=i=>{ const p=s.players[i], won=tourWinner(m)===i, out=m.w!==null && !won, w=m.wins[i===m.a?0:1];
    return `<div class="tbrow${won?' won':''}${out?' out':''}${i===me?' me':''}"><b>${esc(p.name)}${i===me?' <em>You</em>':p.phone?'':' <small>CPU</small>'}</b>${tourFace(p.squad,4)}<span class="tbsc">${m.need>1?w:won?'✓':''}</span></div>`; };
  const kind=tourKind(s,m), live=m.r===s.round && m.w===null;
  const tag = m.w!==null ? '' : !live ? '' : kind==='cc' ? 'Playing' : kind==='hh' && !m.game ? 'Setting up' : m.g>0 ? `Game ${m.g+1}` : 'Next';
  return `<div class="tbm${live?' live':''}${m.a===me||m.b===me?' mine':''}"><div class="tbhead"><span>${esc(label)}</span>${tag?`<i>${tag}</i>`:''}</div>${row(m.a)}${row(m.b)}</div>`;
}
function tourBracket(s, me){
  const R=tourRounds(s); let html='';
  for(let r=0;r<R;r++){
    const ms=s.matches.filter(m=>m.r===r), count=s.size>>(r+1), short=tourRoundOne(s,r);
    const cards=Array.from({length:count},(_,i)=>{ const m=ms[i]; if(m) return tourMatchCard(s, m, me, count>1?`${short} ${i+1}`:short);
      const prev=tourRoundOne(s,r-1); return `<div class="tbm tbd"><div class="tbhead"><span>${esc(count>1?`${short} ${i+1}`:short)}</span></div><div class="tbrow tbtbd"><b>Winner of ${esc(prev)} ${2*i+1}</b></div><div class="tbrow tbtbd"><b>Winner of ${esc(prev)} ${2*i+2}</b></div></div>`; }).join('');
    const cur=s.phase==='done' ? R-1 : s.round, ord = r>=cur ? r-cur : 50+(cur-r);   // phones: the round you're in first, then what's next, then finished rounds
    html+=`<section class="tbcol${r===s.round&&s.phase==='play'?' cur':''}" style="--o:${ord}"><h3>${esc(tourRoundName(s,r))}${r===R-1?' <small>best of 3</small>':''}</h3><div class="tbcards">${cards}</div></section>`;
  }
  return `<div class="tbracket">${html}</div>`;
}
// Spoils: take one fighter from the squad you beat and give up one of yours, with a preview of the new squad
function tourSpoilPanel(s, m, mi, me){
  const W=s.players[me], L=s.players[tourLoser(m)], sel=S.tourSpoil||{}, room=W.pts+TOUR_SPOILS;
  const take=tourFighters(L.squad), mine=tourFighters(W.squad);
  let ok=false, why='', sq=W.squad;
  if(sel.take && sel.drop){ sq=W.squad.slice(); sq[sq.indexOf(sel.drop)]=sel.take; ok=tourSpoilOk({pts:room}, sq); if(!ok) why=tourCost(sq)>room?`That squad costs ${tourCost(sq)} points; you have ${room}.`:'You can only have one version of each character.'; }
  const card=(id,kind)=>{ const c=BYID[id]; return `<button class="tspc${sel[kind]===id?' on':''}" data-a="tourspoil" data-v="${kind}:${id}">${ART[id]?`<img decoding="sync" src="${ART[id]}" alt="">`:seal(c,'lg')}<b>${esc(c.short)}</b><span class="tdc">${c.cost}</span></button>`; };
  return `<div class="thero spoil"><span class="thlbl">Spoils of victory</span><b class="thname">You beat ${esc(L.name)}</b>
    <p class="thsub">Take one of their fighters for one of yours, or keep your squad. Each win gives you 3 more points: you have ${room}.</p>
    <div class="tsplbl">1 · Take from ${esc(L.name)}</div><div class="tspgrid">${take.map(id=>card(id,'take')).join('')}</div>
    <div class="tsplbl">2 · Give up one of yours</div><div class="tspgrid">${mine.map(id=>card(id,'drop')).join('')}</div>
    ${sel.take&&sel.drop?`<div class="tsplbl">Your new squad · ${tourCost(sq)} of ${room} pts</div>${tourFace(sq)}`:''}
    ${why?`<p class="hint warn">${esc(why)}</p>`:''}
    <div class="row"><button class="btn ghost" data-a="tourspoilgo" data-v="skip">Keep my squad</button><button class="btn" data-a="tourspoilgo" data-v="${mi}" ${ok?'':'disabled'}>Swap</button></div></div>`;
}
// The shared draft
const TOUR_FILTERS = [['all','All'],['slayers','Slayers'],['demons','Demons'],['helpers','Helpers'],['can','I can take']];
function tourDraftView(s, me){
  const d=s.draft, cur=tourSeatAt(d,d.k), mine=cur===me && !d.locked[me], P=s.players, N=P.length;
  const round=Math.floor(d.k/N)+1, fwd=round%2===1, q=me>=0?d.picks[me]:[], left=me>=0?tourBudget(s,me)-tourCost(q):0;
  const order=(fwd?d.order:d.order.slice().reverse());
  const flt=S.tourFilter||'all', sel=S.tourSel && d.taken[S.tourSel]===undefined ? S.tourSel : null;
  const pass=id=>{ const c=BYID[id]; if(flt==='helpers') return !!c.helper; if(flt==='can') return me>=0 && tourCanTake(s,me,id); if(c.helper) return flt==='all';
    const sl=typeof slayerSide==='function' ? slayerSide(c) : !c.demon; return flt==='all' || (flt==='slayers'?sl:!sl); };
  const card=id=>{ const c=BYID[id], who=d.taken[id], ok=me>=0 && tourCanTake(s,me,id);
    return `<button class="tdart${who!==undefined?' gone':''}${ok?' can':''}${sel===id?' sel':''}${c.mark?' mk':''}${c.legend?' lg':''}" data-a="toursel" data-v="${id}">
      <span class="tdpic">${ART[id]?`<img decoding="sync" loading="lazy" src="${ART[id]}" alt="">`:seal(c,'lg')}<span class="tdc">${c.cost}</span>${who!==undefined?`<span class="tdtaken">${who===me?'Yours':esc(P[who].name)}</span>`:''}</span>
      <b>${esc(c.short)}</b><small>${c.helper?'Helper':`${c.hp} HP · ${c.pow} PWR · ${c.spd} SPD`}</small><small class="tds">${esc(sigCaption(c))}</small></button>`; };
  const pool=tourPool(s).filter(pass).sort((a,b)=>(d.taken[a]!==undefined)-(d.taken[b]!==undefined));
  const intro = d.k<N && !Object.keys(d.taken).length;
  return `<div class="tdbar${mine?' mine':''}"><div><b>${mine?'Your pick!':`${esc(P[cur].name)} is picking…`}</b><small>Pick ${d.k+1} · round ${round} of picks</small></div>${me>=0?`<div class="tdpts"><b>${left}</b><small>pts left</small></div>`:''}</div>
    ${intro?`<div class="panel tdintro"><b>Draft order</b><p class="muted small">Highest bid first (ties were a coin flip). It snakes: whoever picks last in a round picks first in the next.</p><ol>${d.order.map(i=>`<li class="${i===me?'tdme':''}">${esc(P[i].name)}${i===me?' (you)':''}${d.bid?` <small>bid ${d.bid[i]} · ${tourBudget(s,i)} pts</small>`:''}</li>`).join('')}</ol><p class="muted small">Every card can be taken once in the whole tournament.</p></div>`
      :`<div class="tdorder"><span class="tdo-l">Round ${round} ${fwd?'→':'←'}</span>${order.map(i=>`<span class="${i===cur?'tdnow':''}${i===me?' tdme':''}${d.locked[i]?' tddone':''}">${esc(P[i].name)}</span>`).join('')}</div>`}
    ${me>=0?`<div class="panel tdmine"><div class="tlabel">Your squad${d.locked[me]?' · locked in':''}</div><div class="tdsq">${q.length?q.map(id=>`<span class="tdsqi">${seal(BYID[id],'sm')}<small>${esc(BYID[id].short)}</small></span>`).join(''):'<span class="muted small">Nothing yet</span>'}</div></div>`:''}
    <details class="tdall"><summary>Every team’s picks</summary><div class="tdteams">${P.map((p,i)=>`<div class="tdteam${i===cur?' tdnow':''}${d.locked[i]?' tddone':''}"><b>${esc(p.name)}${i===me?' (you)':p.phone?'':' <small>CPU</small>'}</b><span>${d.picks[i].map(id=>seal(BYID[id],'xs')).join('')||'<small class="muted">–</small>'}</span>${d.locked[i]?'<em>✓</em>':''}</div>`).join('')}</div></details>
    <div class="tdfilters">${TOUR_FILTERS.map(([k,l])=>`<button class="trseg${flt===k?' on':''}" data-a="tourfilter" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="tdgrid">${pool.map(card).join('')||'<p class="muted">Nothing here.</p>'}</div>
    ${actionbar(sel ? `<div class="tdact"><button class="btn ghost" data-a="tourinfo" data-v="${sel}">Info</button>${mine && tourCanTake(s,me,sel)?`<button class="btn" data-a="tourpick" data-v="${sel}">Draft ${esc(BYID[sel].short)} (${BYID[sel].cost})</button>`:`<button class="btn" disabled>${mine?'You can’t take this one':'Not your pick yet'}</button>`}</div>`
      : mine && tourFighters(q).length ? '<button class="btn ghost" data-a="tourpick" data-v="lock">Lock my team</button>' : `<button class="btn" disabled>${mine?'Tap a card to pick it':'Waiting for '+esc(P[cur].name)+'…'}</button>`)}`;
}
function tourBidsView(s, me){
  const P=s.players, raw=TOUR.raw||{}, mx=tourBidMax(s), mine=me>=0 ? tourBidOf(s,raw,me) : undefined, done=mine!==undefined&&mine!==null;
  const waiting=P.map((p,i)=>i).filter(i=>P[i].phone && (raw.bids||{})[P[i].phone]===undefined);
  return `<div class="tdbar${done?'':' mine'}"><div><b>${done?`You bid ${mine}`:'Bid for your draft spot'}</b><small>${done?(waiting.length?`Waiting for ${waiting.map(i=>esc(P[i].name)).join(', ')}…`:'Everyone’s in…'):'Bids are secret until everyone is in'}</small></div></div>
    <div class="panel tdintro"><b>How it works</b><p class="muted small">Spend points from your draft budget to pick earlier. The highest bid drafts first, then the next highest. Ties are a coin flip. What you bid is gone for the whole tournament.</p></div>
    ${me>=0 && !done ? `<div class="tbids">${Array.from({length:mx+1},(_,b)=>`<button class="tbid" data-a="tourbid" data-v="${b}"><b>${b}</b><small>Draft with ${s.budget-b} pts</small><em>${b===0?'Keep every point':b===mx?'Best shot at 1st pick':'Earlier pick'}</em></button>`).join('')}</div>` : ''}
    <div class="panel"><div class="tlabel">Bids</div><div class="tbidlist">${P.map((p,i)=>{ const b=tourBidOf(s,raw,i), inn=b!==undefined&&b!==null;
      return `<div class="${i===me?'tdme':''}"><b>${esc(p.name)}${i===me?' (you)':p.phone?'':' <small>CPU</small>'}</b><span>${inn?(i===me?`${b}`:'✓ in'):'…'}</span></div>`; }).join('')}</div></div>`;
}
// Leave or quit (CK: "I can't quit the tournament")
function tourLeaveSheet(s){
  const solo=TOUR.code===TOUR_SOLO, host=TOUR.host;
  const quitTxt = solo ? 'Ends this tournament for good.' : host ? 'Ends the tournament for everyone in it.' : 'A computer takes your seat and plays on for you.';
  return `<div class="scrim" data-a="tourleaveno"></div><div class="modal"><div class="in tleave" role="dialog" aria-modal="true" aria-label="Leave the tournament">
    <b>Leave the tournament?</b>
    <button class="btn" data-a="tourleave">Leave for now<small>Come back from ${solo?'Quickplay':'Online'} → Your tournament</small></button>
    <button class="btn danger" data-a="tourquit">Quit the tournament<small>${quitTxt}</small></button>
    <button class="btn ghost" data-a="tourleaveno">Keep playing</button></div></div>`;
}
function vTour(){
  const s=TOUR.s, raw=TOUR.raw||{}, me=tourMeIdx();
  const title=!s?'Loading…':s.phase==='lobby'?'Lobby':s.phase==='bids'?'Bid for your spot':s.phase==='draft'?'The draft':s.phase==='done'?'Champion':s.phase==='cancelled'?'Ended':tourRoundName(s,s.round);
  const top=`<header class="top"><div><div class="eyebrow">Tournament${TOUR.code===TOUR_SOLO?' · Solo':TOUR.code?` · ${TOUR.code}`:''}</div><div class="title">${title}</div></div><div class="topbtns"><button class="btn ghost small" data-a="${s&&!['done','cancelled'].includes(s.phase)?'tourleaveask':'tourleave'}">${s&&!['done','cancelled'].includes(s.phase)?'Leave':'Done'}</button></div></header>`;
  const sheet=S.tourLeaveAsk && s ? tourLeaveSheet(s) : '';
  if(!s) return top+`<p class="hint">${esc(S.tourMsg||'Connecting…')}</p>`;
  if(s.phase==='cancelled') return top+`<div class="thero out"><span class="thlbl">Tournament ended</span><b class="thname">${s.old?'This tournament was made with an older version of the game. Start a new one.':'The host ended this tournament.'}</b></div>`;
  if(s.phase==='lobby'){
    const hs=s.humans||[], opt=(k,v,label)=>`<button class="trseg${s[k]===v?' on':''}" data-a="tourcfg" data-v="${k}:${v}" ${TOUR.host?'':'disabled'}>${label}</button>`;
    return top+`<div class="panel trlobby">${s.solo?'<div class="trcode solo">戦</div>':`<div class="trcode">${TOUR.code}</div><p class="muted">Friends join from Online → Enter a Code.</p>`}
      <div class="trlist">${Array.from({length:s.size},(_,i)=>`<div class="trslot${hs[i]?' on':''}">${hs[i]?esc(hs[i].name)+(hs[i].phone===PHONE_ID?' (you)':''):'Computer'}</div>`).join('')}</div>
      <div class="trcfg"><span>Players</span>${opt('size',4,'4')}${opt('size',8,'8')}</div>
      <div class="trcfg"><span>Points</span>${opt('budget',10,'10')}${opt('budget',20,'20')}${opt('budget',30,'30')}</div>
      <div class="trcfg"><span>Computers</span>${opt('level','easy','Easy')}${opt('level','normal','Normal')}${opt('level','hard','Hard')}</div>
      <ol class="trhow"><li>Bid points for an earlier pick, then everyone drafts together, one card at a time. Each card can only be taken once.</li><li>Knockout rounds: win to go through.</li><li>After each win, you can swap a fighter with the team you beat.</li><li>The final is best of 3.</li></ol></div>
      ${S.tourMsg?`<p class="hint warn">${esc(S.tourMsg)}</p>`:''}
      ${actionbar(TOUR.host ? `<button class="btn" data-a="tourstart" ${hs.length>=(s.solo?1:2)?'':'disabled'}>${hs.length>=(s.solo?1:2)?'Start the tournament':'Needs at least 2 people'}</button>` : '<button class="btn" disabled>Waiting for the host to start…</button>')}${sheet}`;
  }
  if(s.phase==='bids') return top+tourBidsView(s, me)+sheet;
  if(s.phase==='draft') return top+tourDraftView(s, me)+sheet;
  const stuck = TOUR.host && s.phase==='play' ? s.matches.map((m,mi)=>[m,mi]).filter(([m,mi])=>m.r===s.round && m.w!==null && !m.spoil && !(raw.spoils||{})[mi] && tourWinner(m)!==me).map(([m,mi])=>`<button class="btn ghost small" data-a="tourskipspoil" data-v="${mi}">Skip ${esc(s.players[tourWinner(m)].name)}’s spoils</button>`).join('') : '';
  return top+tourHero(s, me)+tourBracket(s, me)+(stuck?`<div class="row">${stuck}</div>`:'')+(S.tourMsg?`<p class="hint warn">${esc(S.tourMsg)}</p>`:'')+sheet;
}
if(typeof VIEWS!=='undefined') VIEWS.tour = () => vTour();

Object.assign(ACTIONS, {
  tournew(){ tourCreate(); },
  tourback(){ tourBack(); },
  tourleaveask(){ S.tourLeaveAsk=true; },
  tourleaveno(){ S.tourLeaveAsk=false; },
  tourquit(){ S.tourLeaveAsk=false; const s=TOUR.s, solo=TOUR.code===TOUR_SOLO;
    if(solo){ tourOff(); TOUR.code=null; soloRef().reset(null); return ACTIONS.home(); }
    if(s && TOUR.host){ s.phase='cancelled'; tourWriteS(); }
    else if(s && s.phase==='lobby') tourPut('joins/'+PHONE_ID, null);
    else tourPut('quits/'+PHONE_ID, true);
    try{ localStorage.removeItem(TOUR_NOW); }catch(e){} setTimeout(()=>{ tourOff(); TOUR.code=null; ACTIONS.home(); render(); }, 300); },
  tourbid(v){ const s=TOUR.s; if(!s || s.phase!=='bids' || tourMeIdx()<0) return; tourPut('bids/'+PHONE_ID, Math.max(0, Math.min(tourBidMax(s), +v||0))); sfx('pick'); },
  toursel(v){ S.tourSel = S.tourSel===v ? null : v; },
  tourfilter(v){ S.tourFilter=v; },
  tourinfo(v){ S.codexSel=v; },
  tourleave(){ const done=TOUR.s && TOUR.s.phase==='done', solo=TOUR.code===TOUR_SOLO; tourOff(); TOUR.code=null; try{ if(done && !solo) localStorage.removeItem(TOUR_NOW); }catch(e){} if(done && solo) soloRef().reset(null); ACTIONS.home(); },   // you can come back to an unfinished one from Online → Your tournament
  toursolo(){ tourSolo(); },
  toursoloresume(){ tourEnter(TOUR_SOLO); },
  tourresume(){ let c=null; try{ c=localStorage.getItem(TOUR_NOW); }catch(e){} if(c) tourEnter(c); },
  tourcfg(v){ if(!TOUR.host || !TOUR.s || TOUR.s.phase!=='lobby') return; const [k,x]=v.split(':'); TOUR.s[k]= k==='level' ? x : +x; if(k==='size') TOUR.s.humans=(TOUR.s.humans||[]).slice(0,TOUR.s.size); tourWriteS(); render(); },
  tourstart(){
    const s=TOUR.s; if(!TOUR.host || !s || s.phase!=='lobby' || (s.humans||[]).length<(s.solo?1:2)) return;
    s.players=tourPlayers(s.size, s.humans); s.round=0; s.matches=[]; tourBidsInit(s); tourWriteS(); tourHostStep(); render();
  },
  tourpick(v){ const s=TOUR.s; if(!s || s.phase!=='draft') return; const d=s.draft, me=tourMeIdx(); if(tourSeatAt(d,d.k)!==me) return;
    tourPut('dacts/'+d.k, v==='lock' ? {phone:PHONE_ID, lock:true} : {phone:PHONE_ID, id:v}); S.tourSel=null; sfx('pick'); },
  tourfight(v){ tourFight(+v); },
  tourplay(v){ const s=TOUR.s, m=s.matches[+v], me=tourMeIdx(); if(m && m.game) enterGame(m.game, m.a===me?0:1); },
  tourspoil(v){ const [k,id]=v.split(':'); S.tourSpoil=Object.assign({}, S.tourSpoil, {[k]:id}); render(); },
  tourspoilgo(v){
    const s=TOUR.s, me=tourMeIdx(); const won=s.matches.map((x,i)=>[x,i]).find(([x,i])=>tourWinner(x)===me && !x.spoil && !(TOUR.raw.spoils||{})[i]); if(!won) return;
    tourPut('spoils/'+won[1], v==='skip' ? {skip:true} : {take:S.tourSpoil.take, drop:S.tourSpoil.drop}); S.tourSpoil=null; render();
  },
  tourskipspoil(v){ if(TOUR.host) tourPut('spoils/'+v, {skip:true}); },
});
