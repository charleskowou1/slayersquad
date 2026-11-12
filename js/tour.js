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
   joins/<phone>, squads/<phone>, spoils/<match> and results/<match>_<game>. The host's phone runs tourStep() on every change. */
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
  if(sp && sp.take && sp.drop){ const sq=W.squad.slice(), i=sq.indexOf(sp.drop); if(i>=0 && !BYID[sp.drop].helper && !BYID[sp.take].helper){ sq[i]=sp.take; if(tourSpoilOk(W, sq)) W.squad=sq; } }
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
// A computer drafts like it does in Quickplay, alone, from every character within the points
function tourDraftState(budget, names){
  Object.assign(S,{mode:'tourdraft', n:2, duo:false, maxTeam:MAXTEAM, bansOn:false, banning:false, bans:[], budget, phase:'draft', first:0, lastPicker:null, history:[], k:0, sel:null,
    picks:[[],[]], locked:[false,true], names, poolType:'all', unlockAll:true, sideWar:false, gm:undefined, coop:false, series:null});
  S.pool=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=budget).map(c=>c.id).sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name)).concat(dealHelpers());
}
function tourCpuSquad(budget, level){
  const keep=S; let out=[];
  try{ S={names:['A','B'], unlockAll:true, trial:true}; tourDraftState(budget, ['A','B']); let k=0; while(S.phase==='draft' && !S.locked[0] && k++<80) cpuDraftStep(level); out=S.picks[0].slice(); }
  finally{ S=keep; }
  return out.length ? out : [ROSTER.find(c=>!c.spawn && !c.helper && c.cost<=budget).id];
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
  if(s.phase==='draft'){
    s.players.forEach(p=>{ if(!p.squad && p.phone && raw.squads && raw.squads[p.phone]) { p.squad=raw.squads[p.phone]; p.pts=s.budget; } });
    if(s.players.every(p=>p.squad)){ s.phase='play'; s.round=0; s.matches=tourPair(s,0); }
  }
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
const tourSoloOpen = () => { const r=soloRef().raw(); if(!r) return false; try{ const s=JSON.parse(r.s); return s && s.phase!=='done'; }catch(e){ return false; } };
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
      tourChampion(); if(S.phase==='tour') render(); };
    TOUR.ref.on('value', f); TOUR.offs.push(()=>TOUR.ref.off('value', f));
  }).catch(e=>{ S.tourMsg=netError(e); render(); });
}
function tourOff(){ TOUR.offs.forEach(f=>f()); TOUR.offs=[]; TOUR.s=null; TOUR.raw=null; TOUR.host=false; TOUR.making={}; }
function tourHostStep(){
  const s=TOUR.s; if(!s) return;
  if(s.phase==='lobby'){   // the lobby's player list follows who has joined
    const humans=Object.entries(TOUR.raw.joins||{}).map(([phone,j])=>({phone, name:j.name, at:j.at||0})).sort((a,b)=>a.at-b.at);
    const names=JSON.stringify(humans.map(h=>[h.phone,h.name])); if(names!==JSON.stringify((s.humans||[]).map(h=>[h.phone,h.name]))){ s.humans=humans.slice(0,s.size); tourWriteS(); }
    return;
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
// Drafting your squad: the normal draft screen, you alone, from every character
function tourDraft(){ const s=TOUR.s; ACTIONS.home(); tourDraftState(s.budget, [titled(s.players[tourMeIdx()].name), 'Your opponents']); S.tourDrafting=TOUR.code; window.scrollTo(0,0); }
// The draft ends (Lock team, or nothing left to afford): send the squad instead of starting a battle
const tourBaseStart = startBattle;
startBattle = function(){
  if(S.mode==='tourdraft'){ S.phase='drafted'; if(!S.trial){ const q=S.picks[0].slice(), code=S.tourDrafting; tourPut('squads/'+PHONE_ID, q); tourEnter(code); } return; }
  return tourBaseStart.apply(this, arguments);
};

/* ---------- screens ---------- */
const tourSquadRow = (q, sm) => `<span class="trsq">${(q||[]).map(id=>seal(BYID[id], sm||'xs')).join('')}</span>`;
function tourMatchCard(s, m, mi, me){
  const side=i=>{ const p=s.players[i], won=tourWinner(m)===i, out=m.w!==null && !won;
    return `<div class="trside${won?' won':''}${out?' out':''}${i===me?' me':''}"><b>${esc(p.name)}${p.phone?'':' <small>CPU</small>'}</b>${tourSquadRow(p.squad)}${m.need>1?`<i class="trpips">${'●'.repeat(m.wins[i===m.a?0:1])}${'○'.repeat(m.need-m.wins[i===m.a?0:1])}</i>`:''}</div>`; };
  const kind=tourKind(s,m), state = m.w!==null ? 'Done' : m.r!==s.round ? '' : kind==='cc' ? 'Playing…' : kind==='hh' && !m.game ? 'Setting up…' : m.g>0 ? `Game ${m.g+1}` : 'Ready';
  return `<div class="trmatch${m.r===s.round&&m.w===null?' live':''}">${side(m.a)}<span class="trvs">vs</span>${side(m.b)}${state?`<span class="trstate">${state}</span>`:''}</div>`;
}
function tourMyAction(s, me){
  if(me<0) return '';
  const p=s.players[me];
  if(s.phase==='draft') return p.squad || (TOUR.raw.squads||{})[PHONE_ID] ? '<p class="hint">Squad locked in. Waiting for the others to draft…</p>' : `<button class="btn" data-a="tourdraft">Draft your squad (${s.budget} pts)</button>`;
  if(s.phase!=='play') return '';
  const mi=s.matches.findIndex(m=>m.r===s.round && (m.a===me || m.b===me));
  const m=s.matches[mi];
  // spoils for your last win, if you haven't chosen yet
  const won=s.matches.map((x,i)=>[x,i]).find(([x,i])=>tourWinner(x)===me && !x.spoil && !(TOUR.raw.spoils||{})[i] && x.r<tourRounds(s)-1);
  if(won) return tourSpoilPanel(s, won[0], won[1], me);
  if(!m) return '<p class="hint">You’re out. Watch the rest of the bracket here.</p>';
  if(m.w!==null) return '<p class="hint">You won this round. Waiting for the others…</p>';
  const kind=tourKind(s,m), foe=s.players[m.a===me?m.b:m.a];
  if(kind==='hc') return `<button class="btn" data-a="tourfight" data-v="${mi}">Fight ${esc(foe.name)}${m.need>1?` · game ${m.g+1}`:''}</button>`;
  if(kind==='hh') return m.game ? `<button class="btn" data-a="tourplay" data-v="${mi}">Play ${esc(foe.name)}${m.need>1?` · game ${m.g+1}`:''}</button>` : '<p class="hint">Setting up your match…</p>';
  return '';
}
// Spoils: take one fighter from the squad you beat, giving up one of yours (or keep your squad)
function tourSpoilPanel(s, m, mi, me){
  const W=s.players[me], L=s.players[tourLoser(m)], sel=S.tourSpoil||{}, room=W.pts+TOUR_SPOILS;
  const take=tourFighters(L.squad), mine=tourFighters(W.squad);
  let ok=false, why='';
  if(sel.take && sel.drop){ const sq=W.squad.slice(); sq[sq.indexOf(sel.drop)]=sel.take; ok=tourSpoilOk({pts:room}, sq); if(!ok) why=tourCost(sq)>room?`That squad costs ${tourCost(sq)} pts; you have ${room}.`:'Your squad can only have one version of each character.'; }
  const chip=(id,kind)=>`<button class="trpick${sel[kind]===id?' on':''}" data-a="tourspoil" data-v="${kind}:${id}">${seal(BYID[id],'sm')}<small>${esc(BYID[id].short)} · ${BYID[id].cost}</small></button>`;
  return `<div class="panel trspoil"><div class="tlabel">Spoils from ${esc(L.name)}</div><p class="muted">Take one of their fighters and give up one of yours. You now have ${room} points of room.</p>
    <div class="trrow"><span class="trlbl">Take</span>${take.map(id=>chip(id,'take')).join('')}</div>
    <div class="trrow"><span class="trlbl">Give up</span>${mine.map(id=>chip(id,'drop')).join('')}</div>
    ${why?`<p class="hint warn">${esc(why)}</p>`:''}
    <div class="row"><button class="btn ghost" data-a="tourspoilgo" data-v="skip">Keep my squad</button><button class="btn" data-a="tourspoilgo" data-v="${mi}" ${ok?'':'disabled'}>Swap</button></div></div>`;
}
function vTour(){
  const s=TOUR.s, raw=TOUR.raw||{}, me=tourMeIdx();
  const top=`<header class="top"><div><div class="eyebrow">Tournament${TOUR.code===TOUR_SOLO?' · Solo':TOUR.code?` · ${TOUR.code}`:''}</div><div class="title">${!s?'Loading…':s.phase==='lobby'?'Lobby':s.phase==='draft'?'Draft':s.phase==='done'?'Champion':'The bracket'}</div></div><div class="topbtns"><button class="btn ghost small" data-a="tourleave">Leave</button></div></header>`;
  if(!s) return top+`<p class="hint">${esc(S.tourMsg||'Connecting…')}</p>`;
  if(s.phase==='lobby'){
    const hs=s.humans||[], opt=(k,v,label)=>`<button class="trseg${s[k]===v?' on':''}" data-a="tourcfg" data-v="${k}:${v}" ${TOUR.host?'':'disabled'}>${label}</button>`;
    return top+`<div class="panel trlobby">${s.solo?'<div class="trcode solo">戦</div>':`<div class="trcode">${TOUR.code}</div>`}<p class="muted">${s.solo?'You against the computers. Pick the size, points and how hard they play.':'Friends join from Online → Enter a Code. Computers fill the empty seats.'}</p>
      <div class="trlist">${Array.from({length:s.size},(_,i)=>`<div class="trslot${hs[i]?' on':''}">${hs[i]?esc(hs[i].name)+(hs[i].phone===PHONE_ID?' (you)':''):'Computer'}</div>`).join('')}</div>
      <div class="trcfg"><span>Players</span>${opt('size',4,'4')}${opt('size',8,'8')}</div>
      <div class="trcfg"><span>Points</span>${opt('budget',10,'10')}${opt('budget',20,'20')}${opt('budget',30,'30')}</div>
      <div class="trcfg"><span>Computers</span>${opt('level','easy','Easy')}${opt('level','normal','Normal')}${opt('level','hard','Hard')}</div>
      <p class="muted small">Draft from every character. After each win, take one fighter from the team you beat. The final is best of 3.</p></div>
      ${S.tourMsg?`<p class="hint warn">${esc(S.tourMsg)}</p>`:''}
      ${actionbar(TOUR.host ? `<button class="btn" data-a="tourstart" ${hs.length>=(s.solo?1:2)?'':'disabled'}>${hs.length>=(s.solo?1:2)?'Start the tournament':'Needs at least 2 people'}</button>` : '<button class="btn" disabled>Waiting for the host to start…</button>')}`;
  }
  const R=tourRounds(s), label=r=>r===R-1?'Final · best of 3':r===R-2?'Semi-finals':'Quarter-finals';
  const cols = s.phase==='draft' ? `<div class="panel"><div class="tlabel">Who’s drafted</div>${s.players.map(p=>`<div class="trside${p.squad||(raw.squads||{})[p.phone]?' won':''}"><b>${esc(p.name)}${p.phone?'':' <small>CPU</small>'}</b><span class="muted small">${p.squad||(raw.squads||{})[p.phone]?'Ready':'Drafting…'}</span></div>`).join('')}</div>`
    : `<div class="trbracket">${Array.from({length:R},(_,r)=>`<div class="trcol"><div class="tlabel">${label(r)}</div>${s.matches.map((m,mi)=>m.r===r?tourMatchCard(s,m,mi,me):'').join('')||'<p class="muted small">Waiting…</p>'}</div>`).join('')}</div>`;
  const champ = s.phase==='done' ? (()=>{ const c=s.players[s.champion]; return `<div class="trchamp"><span class="trcrown">優勝</span><b>${esc(c.name)}</b><span class="muted">${c.phone===PHONE_ID?'You won the tournament!':'wins the tournament'}</span>${tourSquadRow(c.squad,'lg')}</div>`; })() : '';
  const stuck = TOUR.host && s.phase==='play' ? s.matches.map((m,mi)=>[m,mi]).filter(([m,mi])=>m.r===s.round && m.w!==null && !m.spoil && !(raw.spoils||{})[mi]).map(([m,mi])=>`<button class="btn ghost small" data-a="tourskipspoil" data-v="${mi}">Skip ${esc(s.players[tourWinner(m)].name)}’s spoils</button>`).join('') : '';
  return top+champ+`<div class="trme">${tourMyAction(s, me)}</div>${cols}${stuck?`<div class="row">${stuck}</div>`:''}${S.tourMsg?`<p class="hint warn">${esc(S.tourMsg)}</p>`:''}`;
}
if(typeof VIEWS!=='undefined') VIEWS.tour = () => vTour();

Object.assign(ACTIONS, {
  tournew(){ tourCreate(); },
  tourback(){ tourBack(); },
  tourleave(){ const done=TOUR.s && TOUR.s.phase==='done', solo=TOUR.code===TOUR_SOLO; tourOff(); TOUR.code=null; try{ if(done && !solo) localStorage.removeItem(TOUR_NOW); }catch(e){} if(done && solo) soloRef().reset(null); ACTIONS.home(); },   // you can come back to an unfinished one from Online → Your tournament
  toursolo(){ tourSolo(); },
  toursoloresume(){ tourEnter(TOUR_SOLO); },
  tourresume(){ let c=null; try{ c=localStorage.getItem(TOUR_NOW); }catch(e){} if(c) tourEnter(c); },
  tourcfg(v){ if(!TOUR.host || !TOUR.s || TOUR.s.phase!=='lobby') return; const [k,x]=v.split(':'); TOUR.s[k]= k==='level' ? x : +x; if(k==='size') TOUR.s.humans=(TOUR.s.humans||[]).slice(0,TOUR.s.size); tourWriteS(); render(); },
  tourstart(){
    const s=TOUR.s; if(!TOUR.host || !s || s.phase!=='lobby' || (s.humans||[]).length<(s.solo?1:2)) return;
    s.players=tourPlayers(s.size, s.humans); s.players.forEach(p=>{ if(!p.phone){ p.squad=tourCpuSquad(s.budget, s.level); p.pts=s.budget; } });
    s.phase='draft'; s.round=0; s.matches=[]; tourWriteS(); tourHostStep(); render();
  },
  tourdraft(){ tourDraft(); },
  tourfight(v){ tourFight(+v); },
  tourplay(v){ const s=TOUR.s, m=s.matches[+v], me=tourMeIdx(); if(m && m.game) enterGame(m.game, m.a===me?0:1); },
  tourspoil(v){ const [k,id]=v.split(':'); S.tourSpoil=Object.assign({}, S.tourSpoil, {[k]:id}); render(); },
  tourspoilgo(v){
    const s=TOUR.s, me=tourMeIdx(); const won=s.matches.map((x,i)=>[x,i]).find(([x,i])=>tourWinner(x)===me && !x.spoil && !(TOUR.raw.spoils||{})[i]); if(!won) return;
    tourPut('spoils/'+won[1], v==='skip' ? {skip:true} : {take:S.tourSpoil.take, drop:S.tourSpoil.drop}); S.tourSpoil=null; render();
  },
  tourskipspoil(v){ if(TOUR.host) tourPut('spoils/'+v, {skip:true}); },
});
