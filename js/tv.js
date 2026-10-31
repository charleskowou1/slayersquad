/* ================= TV MODE =================
   A laptop (HDMI or AirPlay to the TV) runs the game on the big screen; phones join its 4-letter code as
   controllers. One phone: story mode and Quickplay against the computer. Two phones: a 2-player match where each
   phone is a player's private move screen. Nothing here runs unless TV mode or controller mode is switched on, so
   the normal phone game is untouched.
   - TV (S.tv): body.tvmode (big layout); creates rooms/<CODE> (the online rooms path, already allowed by the
     database rules) with tv/state = what the controllers need, reads tv/acts (taps sent from the phones) and
     tv/phones (who is connected). The first two phones get seats 0 and 1 (S.tv.seats, by phone id) and keep them
     through a reconnect. The laptop stays playable with the mouse.
   - Controller (S.ctl): mirrors tv/state; shows its own move / draft / crow screen when the TV waits for it,
     otherwise "Watch the TV". Picks stay on the phone until Lock in moves sends them. No music on the phone.
     The screen is kept awake, and a phone that reloads rejoins the same TV by itself. */
const TV = { offs:[], last:null };
const isTV = () => !!S.tv;
const isCtl = () => !!S.ctl;
if(typeof VIEWS!=='undefined') VIEWS.ctlwatch = () => vCtlWatch();   // the phone's "Watch the TV" screen
// What the controllers need from the TV's game (each phone's own picks stay on it, so plans/helperPlan aren't sent)
const TV_FIELDS = SHARED.filter(k=>k!=='plans' && k!=='helperPlan').concat(['campaign','mode','stage','storyDraft','twist','phases','boosts','place','beats','said','maxTeam','level','helpers','tvDuo']);
// This phone's id (keeps its seat at the TV after a reconnect)
const PHONE_ID = (()=>{ try{ let v=localStorage.getItem('squad-draft-phone'); if(!v){ v=Math.random().toString(36).slice(2,10); localStorage.setItem('squad-draft-phone',v); } return v; }catch(e){ return Math.random().toString(36).slice(2,10); } })();
// Presence is kept per page load (PHONE_ID~SESSION), so a reloading phone's old entry, removed by the server a
// moment later, can't remove the new one
const SESSION = Math.random().toString(36).slice(2,8);
const CTL_KEY = 'squad-draft-ctl';   // {code, at}: the TV this phone is controlling, for rejoining after a reload

// Keep the screen on (the TV laptop and the controller phones): asked again when the page comes back or on a tap,
// since the browser drops it whenever the page is hidden
const WAKE = {lock:null, want:false};
async function keepAwake(on){
  WAKE.want=on;
  try{
    if(on && !WAKE.lock && navigator.wakeLock && !document.hidden){ WAKE.lock=await navigator.wakeLock.request('screen'); WAKE.lock.addEventListener('release',()=>{ WAKE.lock=null; }); }
    if(!on && WAKE.lock){ const l=WAKE.lock; WAKE.lock=null; l.release(); }
  }catch(e){ WAKE.lock=null; }
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && WAKE.want) keepAwake(true); });
  document.addEventListener('pointerdown', ()=>{ if(WAKE.want && !WAKE.lock) keepAwake(true); }, {passive:true});
}
// Run f each time the connection to Firebase comes up (presence has to be set again after every drop)
function onConnected(db, f){ const r=db.ref('.info/connected'), g=s=>{ if(s.val()) f(); }; r.on('value',g); TV.offs.push(()=>r.off('value',g)); }

/* ---------- the TV (laptop) side ---------- */
async function tvStart(){
  S.tvMsg='Connecting…'; render();
  try{
    const db=await firebaseReady(); let code=null;
    for(let i=0;i<8 && !code;i++){ const c=newRoomCode(), r=await db.ref('rooms/'+c).transaction(v=>v?undefined:{created:Date.now(), host:{name:'TV', on:true}, hostSeat:0, tv:{on:true}}); if(r.committed) code=c; }
    if(!code) throw new Error('Could not make a code. Try again.');
    const room=db.ref('rooms/'+code);
    onConnected(db, ()=>{ room.child('host/on').onDisconnect().set(false); room.child('host/on').set(true); });
    S.tv={code, phones:{}, seats:[], saves:{}, names:{}}; S.tvMsg=''; TV.last=null; document.body.classList.add('tvmode');
    const f=s=>{ const m=s.val(); s.ref.remove(); tvAct(m); }; room.child('tv/acts').on('child_added',f); TV.offs.push(()=>room.child('tv/acts').off('child_added',f));
    const g=s=>tvPhones(s.val()||{}); room.child('tv/phones').on('value',g); TV.offs.push(()=>room.child('tv/phones').off('value',g));
    TV.room=room; keepAwake(true); S.phase='tvhome'; render();   // the TV's own lobby: the code, who's joined, and what to play
  }catch(e){ S.tvMsg=netError(e); render(); }
}
function tvStop(){
  TV.offs.forEach(f=>f()); TV.offs=[]; if(TV.room) TV.room.child('host/on').set(false); TV.room=null; TV.last=null;
  S.tv=null; document.body.classList.remove('tvmode'); keepAwake(false);
}
// The connected phones changed: a new phone takes a free seat (or, between matches, the seat of a phone that's gone)
function tvPhones(raw){
  if(!isTV()) return;
  const t=S.tv, ph={}; Object.entries(raw).forEach(([k,v])=>{ ph[k.split('~')[0]]=v; }); t.phones=ph;
  // each phone's name and story save, kept after it drops out so a battle in progress doesn't switch saves
  Object.entries(ph).forEach(([id,v])=>{ if(v.name) t.names[id]=v.name; if(v.story) t.saves[id]=JSON.parse(v.story); });
  Object.keys(ph).forEach(id=>{ if(t.seats.includes(id)) return;
    if(t.seats.length<2) t.seats.push(id);
    else { const free=t.seats.findIndex(s=>!ph[s]); if(free>=0 && !S.tvDuo) t.seats[free]=id; } });   // mid-match a seat waits for its own phone
  render();
}
const tvSeatOn = q => !!(S.tv && S.tv.seats[q] && S.tv.phones[S.tv.seats[q]]);
const tvSeatName = q => S.tv && S.tv.seats[q] && S.tv.names[S.tv.seats[q]] || '';
// The players' saves, not the laptop's: story and Quickplay use player 1's phone; a 2-player match deals anyone
// either phone has unlocked. Story wins go back to player 1's phone (tv/save/<id>, merged in there).
function tvStoryData(){
  if(!isTV()) return null;
  const sv=q=>S.tv.seats[q] && S.tv.saves[S.tv.seats[q]];
  if(S.tvDuo){ const a=sv(0), b=sv(1); return a&&b ? mergeStory(a,b) : a||b||null; }
  return sv(0)||null;
}
function tvStorySave(st){
  const id=S.tv.seats[0]; if(!id || S.tvDuo) return;
  S.tv.saves[id]=JSON.parse(JSON.stringify(st)); if(TV.room) TV.room.child('tv/save/'+id).set(JSON.stringify(st));
}
if(typeof STORY_SOURCE!=='undefined'){ STORY_SOURCE.get=tvStoryData; STORY_SOURCE.put=tvStorySave; }
// On the TV, "your name" (story, Quickplay) is player 1's phone's name
const thisPlayerName = playerName;
playerName = () => isTV() && tvSeatName(0) || thisPlayerName();
const tvPhonesOn = () => !S.tv ? 0 : S.tv.seats.filter((id,q)=>tvSeatOn(q)).length;
const tvAnyPhone = () => tvPhonesOn()>0;
// Who picks moves on a phone: player 1 against the computer, both players in a 2-player TV match
const tvChooser = q => S.tvDuo ? q<2 && alive(q).length>0 : q===0 && vsCpu();
const tvLocked = q => !!(S.tvLocked && S.tvLocked[q]===S.round);
// A message from a phone (m.from = its id): Continue, a choice, a draft pick, or its moves for this round
function tvAct(m){
  if(!m || !isTV()) return;
  const seat = m.from ? S.tv.seats.indexOf(m.from) : 0;   // older phones (no id) are player 1
  if(m.a==='hello'){ render(); return; }
  if(m.a==='next'){ tvContinue(); render(); return; }
  if(m.a==='choose'){ tvChoose(m.key); render(); return; }
  if(m.a==='stage'){ const i=m.i|0; if(m.draft ? stageCleared(i) : stageUnlocked(i)){ ACTIONS[m.draft?'stagedraft':'stage'](i); } render(); return; }
  if(seat<0) return;   // a third phone only watches
  if(m.a==='cfg' && ['budget','poolType','level'].includes(m.k)){ tvCfgSet(m.k,m.v); render(); return; }
  const myDraft = S.phase==='draft' && turn()===seat && (S.tvDuo ? seat<2 : seat===0 && (S.mode==='cpu'||S.mode==='story'));
  if(m.a==='pick' && myDraft){ S.sel=m.id; ACTIONS.confirmPick(); render(); return; }
  if(m.a==='lockteam' && myDraft){ ACTIONS.lock(); render(); return; }
  if(m.a==='undo' && S.phase==='draft'){ ACTIONS.undo(); render(); return; }
  if(m.a==='redeal' && S.phase==='draft'){ ACTIONS.redeal(); render(); return; }
  if(m.a==='guess' && S.phase==='spin'){ if(S.tvDuo ? seat<2 && guessPick(seat,m.n) : seat===0) { if(!S.tvDuo) ACTIONS.guess(m.n); sfx('pick'); } render(); return; }
  if(m.a==='keep' && S.phase==='scout' && S.scoutP===seat){ ACTIONS.keepmoves(); render(); return; }
  if(m.a==='moves' && m.round===S.round && tvChooser(seat)){
    const plans=m.plans||{}, helpers=(m.helperPlan||[]).filter(h=>(S.helpers[seat]||[]).includes(h));
    if(m.scout){ if(S.phase==='scout' && S.scoutP===seat){ S.plans[seat]=plans; S.lastPlans[seat]=JSON.parse(JSON.stringify(plans)); nextScoutOrFight(); render(); } return; }   // re-planned after the crow
    if(S.phase!=='plan' || tvLocked(seat)) return;
    S.plans[seat]=plans; S.helperPlan[seat]=helpers;
    if(S.tvDuo) tvSeatLock(seat); else { S.planFor=0; ACTIONS.lockMoves(); }
    render();
  }
}
// 2-player TV match: a player's moves are in (from their phone, or picked on the laptop); when everyone still
// fighting has locked in, each crow owner gets their report on their own phone, then the round plays
function tvSeatLock(q){
  S.tvLocked=S.tvLocked||{}; S.tvLocked[q]=S.round; S.tvMouse=null;
  S.lastPlans[q]=JSON.parse(JSON.stringify(S.plans[q]||{}));
  if(players().some(p=>tvChooser(p) && !tvLocked(p))) return;
  S.scoutQueue=players().filter(p=>alive(p).length && S.helperPlan[p].includes('crow'));
  nextScoutOrFight();
}
// The phone's Continue button: press whatever the TV's main button is right now
function tvNextLabel(){
  if(S.phase==='scene') return S.sceneVs ? 'Fight' : 'Next';
  if(S.phase==='result') return !S.play || !S.play.done ? 'Skip' : S.final ? 'See who won' : 'Next round';
  if(S.phase==='order') return 'Begin';
  if(S.phase==='spin') return S.spin && S.spin.state==='done' ? 'Start the draft' : null;   // numbers are picked on the phones
  return null;   // the crow report's Keep / Change are only on its owner's phone
}
function tvContinue(){
  const l=tvNextLabel(); if(!l) return;
  if(S.phase==='scene') return S.sceneVs ? ACTIONS.sceneskip() : ACTIONS.scenenext();
  if(S.phase==='order') return ACTIONS.orderstart();
  if(S.phase==='spin') return ACTIONS.toDraft();
  if(l==='Skip') return ACTIONS.skip();
  return S.final ? ACTIONS.finish() : ACTIONS.next();
}
// Choices for the phone on screens with no single main button (home, end of a battle, credits)
function tvChoices(view){
  const duo=tvPhonesOn()>=2 ? [['duo',`2 players: ${tvSeatName(0)||'Player 1'} vs ${tvSeatName(1)||'Player 2'}`]] : [];
  if(['tvhome','setup','modeset','codex'].includes(view)){ const p1=tvSeatName(0);
    return [...duo, ['story', p1?`Story mode · ${p1}’s save`:'Story mode'], ['quickplay', p1?`Quickplay: ${p1} vs the computer`:'Quickplay vs the computer']]; }
  if(view==='story') return [...duo, ...(dreamOpen()?[['dream','The Endless Dream'],['journey','The Slayer’s Journey']]:[]), ['home','Main menu']];
  if(view==='credits') return [['map','Story map'],['home','Home']];
  if(view==='over'){
    if(S.mode==='story'){ const won=S.winner===0, last=S.stage===STAGES.length-1;
      return won ? [last?['finale','Finish the story']:['nextstage','Next battle'], ['map','Story map']] : [['retry','Try again'], ['map','Story map']]; }
    return [['rematch','Rematch'],['home','Main menu']];
  }
  return null;
}
// The match settings on the TV's lobby (from the laptop or a phone): Quickplay and 2-player games both use them
function tvCfgSet(k,v){
  if(S.ctl) return ctlSend({a:'cfg', k, v});
  ['cpu','local'].forEach(m=>{ const c=loadModeCfg(m); c[k]=k==='budget'?+v:v; saveModeCfg(m,c); });
}
const tvCfgNow = () => { const c=loadModeCfg('cpu'); return {budget:c.budget, poolType:c.poolType, level:c.level}; };
const tvCfgRows = c => `<div class="tvcfg"><div class="setline"><span class="tlabel">Points per team</span>${seg('tvcfgbudget',c.budget,BUDGETS.map(b=>[b,budgetName(b)]))}</div>
  <div class="setline"><span class="tlabel">Character pool</span>${seg('tvcfgpool',c.poolType,POOL_OPTS)}</div>
  <div class="setline"><span class="tlabel">Computer</span>${seg('tvcfglevel',c.level,Object.entries(LEVELS).map(([k,l])=>[k,l.label]))}</div></div>`;
function tvChoose(key){
  if(key==='story' || key==='map') return ACTIONS.storymap();
  if(key==='dream') return ACTIONS.campaign('dream');
  if(key==='journey') return ACTIONS.campaign('main');
  if(key==='quickplay'){ ACTIONS.mode('cpu'); S.names=[playerName()||'Player 1', S.names[1]||'Computer']; return startDraft(); }
  if(key==='duo') return tvDuoStart();
  if(key==='finale' && S.mode==='story') return ACTIONS.finale();
  if(key==='nextstage' && S.mode==='story') return ACTIONS.stage(S.stage+1);
  if(key==='retry' && S.mode==='story') return ACTIONS[S.storyDraft?'stagedraft':'stage'](S.stage);
  if(key==='rematch') return ACTIONS.rematch();
  if(key==='home') return ACTIONS.home();
}
// 2 players on the TV: a Local match for two (the laptop's Local settings: points, pool, bans…) where each phone
// picks its own moves in secret, so there's no passing the phone
function tvDuoStart(){
  if(tvPhonesOn()<2) return;
  ACTIONS.mode('local'); S.n=2; S.duo=false; S.tvDuo=true; S.tvLocked={};
  S.names=[tvSeatName(0)||'Player 1', tvSeatName(1)||'Player 2'];
  toSpin();
}
// The story map for the phone: every battle with whether it's open, won, and its stars
const tvStoryList = () => STAGES.map((st,i)=>({i, title:st.title, arc:ARCS[st.arc].title, open:stageUnlocked(i), won:stageCleared(i), stars:stageStars(st.id)}));
// What the phone at seat q should show
function tvSeatView(q, view){
  const g=S.spin; if(S.phase==='spin' && g && g.state==='picking' && !g.picks[q] && (S.tvDuo ? q<2 : q===0 && S.mode==='cpu')) return 'guess';
  if(S.phase==='plan' && tvChooser(q) && !tvLocked(q) && !(S.tvMouse===S.round && S.planFor===q)) return 'plan';
  if(S.phase==='scout' && S.scoutP===q && tvChooser(q)) return 'scout';
  if(view==='draft' && turn()===q && (S.tvDuo ? q<2 : q===0 && (S.mode==='cpu'||S.mode==='story'))) return 'draft';
  return 'watch';
}
// After every redraw on the TV: send the controllers the current game (only when it changed)
function tvPublish(view){
  if(!isTV() || !TV.room) return;
  const o={views:[0,1].map(q=>tvSeatView(q,view)), seats:S.tv.seats, next:tvNextLabel(), choices:tvChoices(view), story: view==='story' ? tvStoryList() : null, tvView:view, wait:tvWaiting(), tvCfg: view==='tvhome' ? tvCfgNow() : null};
  TV_FIELDS.forEach(k=>{ if(S[k]!==undefined) o[k]=S[k]; });
  // the crow's owner sees the other side's moves (never the owner's own, so the other phone learns nothing new)
  if(S.phase==='scout' && S.plans){ o.scoutPlans=S.plans.map((p,q)=>q===S.scoutP?{}:p); o.scoutHelpers=S.helperPlan.map((h,q)=>q===S.scoutP?[]:h); }
  const j=JSON.stringify(o); if(j===TV.last) return; TV.last=j; TV.room.child('tv/state').set(j);
}
// Who the TV is waiting on, in words ('' when it isn't waiting on a phone)
function tvWaiting(){
  if(!isTV() || !S.teams && !['draft','spin'].includes(S.phase)) return '';
  const who=q=>esc(S.names[q]||`Player ${q+1}`), off=q=>!tvSeatOn(q);
  if(!S.tvDuo && !tvAnyPhone()) return '';
  if(S.phase==='plan'){ const w=players().filter(q=>tvChooser(q) && !tvLocked(q)); if(!w.length) return '';
    const done=S.tvDuo ? players().filter(q=>tvChooser(q) && tvLocked(q)).map(q=>`${who(q)} ✓`) : [];
    return [...done, ...w.map(q=>off(q)?`${who(q)}’s phone is reconnecting…`:`Waiting for ${who(q)}’s moves`)].join(' · '); }
  if(S.phase==='scout' && S.scoutP>=0) return `${who(S.scoutP)}’s Kasugai Crow is scouting…`;
  if(S.phase==='spin' && S.spin && S.spin.state==='picking'){ const w=players().filter(q=>!S.spin.picks[q] && (S.tvDuo||q===0)); return w.length ? `Waiting for ${w.map(who).join(' and ')} to pick a number` : ''; }
  if(S.phase==='draft'){ const q=turn(); if(!S.tvDuo && q!==0) return ''; return off(q)?`${who(q)}’s phone is reconnecting…`:`${who(q)} is picking on the phone`; }
  return '';
}
// Fill the screen: the TV layout is designed 1300 × 820 and zoomed to fit the window, down as well as up (CK: a
// laptop sending the TV a small resolution, like 1280 × 720, cut the board off at 1×)
const winW = () => typeof innerWidth==='number' ? innerWidth : 1300, winH = () => typeof innerHeight==='number' ? innerHeight : 820;
const tvZoom = () => Math.max(.5, Math.min(winW()/1300, winH()/820));
function tvFit(){
  if(!isTV()){ document.body.style.removeProperty('--tvz'); return; }
  document.body.style.setProperty('--tvz', tvZoom().toFixed(3));
}
if(typeof addEventListener!=='undefined') addEventListener('resize', ()=>{ if(isTV()) tvFit(); });
// Full screen hides the browser and window bars (press Esc to leave)
function tvFullscreen(){ const d=document, el=d.documentElement;
  if(d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen||d.webkitExitFullscreen).call(d);
  else (el.requestFullscreen||el.webkitRequestFullscreen).call(el); }
// The corner badge on the TV: the code, each seat's phone (✓, or ⟳ while it reconnects), and who it's waiting on
function tvBadge(){
  let b=document.getElementById('tvbadge');
  tvFit();
  // cutscenes and the credits fill the whole screen on the TV, edge to edge
  document.body.classList.toggle('tvscene', isTV() && ['scene','credits'].includes(S.phase));
  if(!isTV()){ if(b) b.remove(); return; }
  if(!b){ b=document.createElement('div'); b.id='tvbadge'; document.body.appendChild(b); }
  const t=S.tv, on=tvAnyPhone(), full=document.fullscreenElement||document.webkitFullscreenElement;
  // once every phone is in, the badge shrinks to a small faint pill (CK); it comes back full size if a phone drops out
  b.classList.toggle('mini', on && t.seats.every((id,q)=>tvSeatOn(q)));
  b.hidden = S.phase==='tvhome';   // the lobby shows the code itself
  const seats=t.seats.map((id,q)=>`<span class="tvseat${tvSeatOn(q)?'':' off'}" style="--tc:${pc(q)}">${esc(tvSeatName(q)||(S.tvDuo&&S.names[q])||'Phone')} ${tvSeatOn(q)?'✓':'⟳'}</span>`).join('');
  const wait=S.phase==='draft' ? tvWaiting() : '';   // the move board shows its own
  b.innerHTML=`<span class="tvk">📺</span><span>${on?'':'Phone controller code '}<b>${esc(t.code)}</b></span>${seats}${wait?`<span class="tvwait">${wait}</span>`:''}<button class="btn ghost small" data-a="tvfull">${full?'Exit full screen':'Full screen'}</button><button class="btn ghost small" data-a="tvexit">${on?'Exit TV':'Exit TV mode'}</button>`;
}

/* ---------- the TV battle board ----------
   On the TV a 2-team battle is one board: the opponent's cards across the top, yours across the bottom. While
   moves are being chosen it shows who the TV is waiting on; in playback the attacker's card flies across the board
   into its target, the target recoils with the damage, and knocked-out cards fall. Specials, move clips and lines
   play over the board. Card positions come from the card size (fixed per board), so nothing is measured. */
// card: the tallest a card gets; the board shrinks cards to fit the window it's in (sizeBoard)
const BOARD = {gap:18, card:186, band:112, rowGap:14, ch:186};
// Card width and height for a board with up to n cards in a row: as big as fits the zoomed window (design px)
function sizeBoard(n){
  const z=tvZoom(), w=Math.min(1300, winW()/z)-44, h=winH()/z-156-(S.play&&!S.play.done||S.phase==='plan'?96:20);   // 156: heading and strength bar above; 96: the button bar
  BOARD.ch=Math.max(110, Math.min(BOARD.card, Math.floor((h-BOARD.band-2*BOARD.rowGap)/2)));
  return Math.max(80, Math.min(BOARD.ch, Math.floor((w-BOARD.gap*(n-1))/n)));
}
const tvBoardOK = () => isTV() && !!S.teams && nPlayers()===2;
// the move screen is a waiting board while a phone picks (unless the laptop chose to pick this round)
// with a phone in hand the summaries go there (CK), and the TV stays a clean picture
const tvPhonesShow = () => isTV() && (S.tvDuo || tvAnyPhone());
const tvBoardWait = () => tvBoardOK() && ['plan','scout'].includes(S.phase) && !S.scouting && S.tvMouse!==S.round && (S.tvDuo || tvAnyPhone());
if(typeof VIEWS!=='undefined'){
  const base={plan:VIEWS.plan, scout:VIEWS.scout, result:VIEWS.result};
  VIEWS.plan = () => tvBoardWait() ? vTvBoard(null) : base.plan();
  VIEWS.scout = () => tvBoardWait() ? vTvBoard(null) : base.scout();
  VIEWS.result = () => !tvBoardOK() || !S.play ? base.result() : !S.play.done ? vTvBoard(playBeat()) : tvPhonesShow() ? vTvBoard(null) : base.result();
  const baseOver=VIEWS.over;
  VIEWS.over = () => tvPhonesShow() ? `${winHero()}${overUnlocks()}${overBar()}` : baseOver();
  const baseDraft=VIEWS.draft;
  VIEWS.draft = () => isTV() && (S.tvDuo || tvAnyPhone()) ? vTvDraft() : baseDraft();
}
// The draft on the TV while phones pick (CK): the phones have the details, so the TV shows whose turn it is, every
// card dealt (taken ones tagged with who took them), and each team so far
function vTvDraft(){
  const p=turn(), cpu=!S.tvDuo && p!==0, who=`<span style="color:${pc(p)}">${nm(p)}</span>`;
  const verb=S.banning?'ban':'pick', wait=tvWaiting();
  return `${topbar(S.banning?`Ban round · ${S.bans.length+1} of ${nPlayers()}`:'Draft', `${who}’s ${verb}`, false)}
    <div class="tvturn" style="--tc:${pc(p)}"><span class="adots" aria-hidden="true"><i></i><i></i><i></i></span><b>${cpu?`${nm(p)} is ${S.banning?'banning':'picking'}…`:wait||`${nm(p)} is picking`}</b><span class="muted">${budget()} points each · up to ${teamCap()} fighters</span></div>
    <div class="teams">${players().map(q=>teamBox(q,p)).join('')}</div>
    <div class="grid tvgrid">${S.pool.filter(id=>!isHelper(id)).map(id=>cardHTML(BYID[id],p)).join('')}</div>
    ${S.banning?'':`<div class="tvhelpers"><span class="tlabel">Back pocket</span>${S.pool.filter(isHelper).map(id=>{ const o=S.picks.findIndex(t=>t.includes(id)); return `<span class="hchip${o>=0?' owned':''}" ${o>=0?`style="--tc:${pc(o)}"`:''}>${seal(BYID[id],'pip')}<span><b>${esc(BYID[id].short)}</b><small>${o>=0?nm(o):esc(BYID[id].sig.tag)}</small></span></span>`; }).join('')}</div>`}`;
}
const amtOf = l => l.t.match(/\[([+-])(\d+%)\]/)||[];
const popHTML = l => { const a=amtOf(l); return a[1] ? `<span class="apop ${a[1]==='-'?'dmg':'gain'}">${a[1]==='-'?'−':'+'}${a[2]}</span>` : l.fx==='miss' ? '<span class="apop">miss</span>' : l.fx==='block' ? '<span class="apop">blocked</span>' : ''; };
const rowStep = () => BOARD.ch + BOARD.band + 2*BOARD.rowGap;   // top row to bottom row
// What each fighter does in this beat: {cls, dx, dy, fx} by uid
function boardRoles(b, pos){
  const roles=new Map(), add=(u,cls,fx='',o={})=>{ if(!u) return; const r=roles.get(u.uid)||{cls:'',fx:''}; roles.set(u.uid, Object.assign(r, o, {cls:r.cls+' '+cls, fx:r.fx+fx})); };
  // the attacker flies dist of the way to `to` (a position on the board)
  const fly=(u,to,dist)=>{ const a=pos.get(u.uid); if(a && to) add(u,'fly','',{dx:Math.round((to.x-a.x)*dist), dy:Math.round((to.ri-a.ri)*rowStep()*dist)}); };
  const struck=(l,style)=>{ const t=findU(l.on); if(!t) return;
    const mark=l.fx==='miss'?'避':l.fx==='block'?'防':STYLE_KANJI[style]||'斬';
    add(t, l.fx==='miss'?'dodged':l.fx==='block'?'blocked':'struck', (['hit','ko','burn'].includes(l.fx)&&style?fxArt(style):'')+targetFx(l)+`<span class="amark">${mark}</span>`+popHTML(l)); };
  const first=b.lines[0], by=first.by&&findU(first.by), type=first.fx||'';
  b.lines.forEach(l=>{ if(l.ko) add(findU(l.ko),'kod'); });
  if(first.gone){ add(findU(first.on),'pulled',kDoors); return roles; }
  if(first.shrink){ add(findU(first.on),'shrinking'); return roles; }
  if(first.cover && by && pos.get(first.on)){ fly(by,pos.get(first.on),.85); add(findU(first.on),'fx-guard'); return roles; }
  { const f=byFx(first); if(f) add(by,by.sk==='swamp'?'sinking':'',f); }   // Nakime's biwa: dropped through the floor, off the screen
  if(b.flurry && by){   // one Attack's quick strikes: one flight, one total
    const t=findU(first.on), sum=flurryPct(b.lines), style=styleOf(by,'attack');
    if(t && pos.get(t.uid)) fly(by, pos.get(t.uid), .8);
    add(t,'struck',fxArt(style)+(by.sk==='typezero'?artSvg('typezero'):'')+`<span class="amark">${STYLE_KANJI[style]||'斬'}</span>`+(sum?`<span class="apop dmg">−${sum}%</span>`:''));
    return roles;
  }
  if(b.group && by){   // a special that hits a whole team: the attacker dives at the middle of that row
    const style=styleOf(by,'special'), t=findU((b.lines.find(l=>l.on)||{}).on);
    if(t && pos.get(t.uid)) fly(by, {x:0, ri:pos.get(t.uid).ri}, .7);
    b.lines.filter(l=>GROUP_FX.includes(l.fx)).forEach(l=>struck(l,style));
    return roles;
  }
  if(type==='ko') return roles;   // "X falls!": the hit already landed last beat, so the card just topples
  const on=first.on&&findU(first.on), duo=by&&on&&by!==on;
  const style=by && ['hit','ko','burn','special','miss','block'].includes(type) ? styleOf(by, first.move) : null;
  const glow=(u,t)=>add(u, 'fx-'+(t||'none'), targetFx(first)+`<span class="amark">${FX_MARK[t]||''}</span>`+popHTML(first));
  if(duo && on.p!==by.p){   // at an enemy: fly into them
    fly(by, pos.get(on.uid), .8);
    if(['hit','ko','burn','miss','block'].includes(type)) struck(first, style); else glow(on, type);
  } else if(duo){ fly(by, pos.get(on.uid), .35); glow(on, type||'buff'); }   // helping a teammate: a short hop, and they glow
  else if(on||by) glow(on||by, type);
  return roles;
}
function vTvBoard(b){
  const me=leftSide(), foe=enemiesOf(me)[0], playing=!!b;
  const rowU=[foe, me].map(p=>playing ? S.teams[p].filter(u=>!b.moment(u).hidden) : S.teams[p]);
  const n=Math.max(1, ...rowU.map(r=>r.length)), W=sizeBoard(n);
  const pos=new Map(); rowU.forEach((r,ri)=>r.forEach((u,i)=>pos.set(u.uid, {ri, x:(i-(r.length-1)/2)*(W+BOARD.gap)})));
  const beat=playing && b.k>0, cur=b&&b.cur, first=b&&b.lines[0], by=first&&first.by&&findU(first.by);
  // beats that play over the board: the round intro, a special's cut-in, a move clip, a fighter's line
  const over = !playing ? '' : !beat ? `<div class="now intro"><span class="ir">Round ${S.round}</span><span class="ig">Fight!</span></div>`
    : b.group ? ''
    : cur.fx==='awaken' ? `<div class="now awakebeat">${awakenBeat(cur)}</div>`
    : cur.fx==='special' && by ? `<div class="now cut${b.clip?' clip':''}">${cutin(by,b.clip,cur)}</div>`
    : b.clip ? `<div class="now clipbeat">${clipBeat(b.clip,cur)}</div>`
    : cur.fx==='say' && by ? `<div class="now saybeat" style="--tc:${pc(by.p)}">${seal(by,'stg')}<div><span class="sayn">${esc(by.name)}</span><span class="sayq">“${esc(cur.t)}”</span></div></div>` : '';
  const roles = beat && !over ? boardRoles(b, pos) : new Map();
  const calmRow = r => playing && r.some(u=>b.moment(u).calm) ? ' calm' : '';   // Dead Calm's water around the whole team, for the rest of the round
  const card=u=>{
    const o=playing?b.moment(u):{}, hp=o.hp===undefined?u.hp:o.hp;
    // a fighter hit down to 0 stays standing at 0% this beat; it falls on its own "falls!" beat (flash 'ko')
    const up=o.hp===undefined ? u.alive : hp>0 || (o.from>0 && o.flash!=='ko');
    const h=hp>0?pct(u,hp):0, from=o.from===undefined?h:Math.max(0,pct(u,o.from)), r=roles.get(u.uid)||{cls:'',fx:''};
    const koLine=beat&&b.lines.find(l=>l.ko===u.uid), cut=!!koLine && slicedBy(koLine,u), dust=crumbleKind(koLine);
    const state = dust ? ` crumbling ${dust}` : cut ? ` cutdown cut-${cutStyle(koLine)}` : r.cls.includes('kod') || o.flash==='ko' ? ' felled' : !up ? ' dead' : o.flash==='spawn' ? ' spawned' : !r.cls && o.flash==='hit' ? ' struck' : !r.cls && o.flash==='heal' ? ' fx-heal' : '';
    const back = beat && !over && !b.involved.has(u.uid) && !r.cls && !state ? ' back' : '';
    const inner=`${o.calm&&b.involved.has(u.uid)?waterRing():''}<div class="aart">${artOf(u)?`<img decoding="sync" src="${artOf(u)}" alt="">`:`<span class="ak">${u.g}</span>`}</div>${r.fx}
      <div class="ainfo"><span class="anm">${esc(u.name)}</span><span class="ahp${up&&h<=LOW?' low':''}"><span class="abar"><i class="${from!==h?'drain':''}" style="width:${h}%;--from:${from}%"></i></span><b>${hp>0||o.hp===undefined&&up?h+'%':'KO'}</b></span></div>
      ${!playing&&up?statusMarks(u, u.cd===0&&!u.stun):''}`;
    return `<div class="acard${state}${r.cls}${back}${o.lost?' lost':''}${o.smolder?' smolder':''}${o.hid?' talisman':''}${boundNow(u)?' bound'+boundNow(u):''}" style="--tc:${pc(u.p)}${r.dx!==undefined?`;--dx:${r.dx}px;--dy:${r.dy}px`:''}">${dust?`<div class="cr-pic">${inner}</div>${crumblePic(dust,'').replace('<span class="cr-pic"></span>','')}`:cut?`<div class="sl-wrapb">${inner}</div><div class="sl-wrapt">${inner}</div>`:inner}</div>`; };
  const big = beat && !over && b.lines.some(bigHit), kos = beat && !over && b.lines.some(l=>l.fx==='ko'||l.ko);
  const wait=tvWaiting(), goal=S.mode==='story'&&STAGES[S.stage]?twistText(STAGES[S.stage]):'';
  const roundOver = !playing && S.phase==='result';
  const band = roundOver ? `<div class="await"><b>${S.final?'The battle is over':`Round ${S.round} is over`}</b><small>The full round is on your phone</small></div>`
    : !playing ? `<div class="await"><span class="adots" aria-hidden="true"><i></i><i></i><i></i></span><b>${wait||'Choose your moves'}</b>${goal?`<small>${esc(goal)}</small>`:''}</div>`
    : over ? '' : `<div class="aline ${cur.c||''}">${first.helper?stage(first):''}<span>${b.flurry?flurrySummary(b.lines):b.group?groupSummary(b.lines):fmtLog(cur.t)}</span></div>`;
  // the laptop can still pick: for player 1 against the computer, or for a player whose phone has dropped out
  const offSeat = S.tvDuo ? players().find(q=>tvChooser(q) && !tvLocked(q) && !tvSeatOn(q)) : undefined;
  const mouse = S.phase!=='plan' ? '' : S.tvDuo ? (offSeat!==undefined ? `<button class="btn ghost" data-a="tvmouse" data-v="${offSeat}">Choose ${esc(S.names[offSeat])}’s moves here</button>` : '')
    : '<button class="btn ghost" data-a="tvmouse" data-v="0">Choose on this screen</button>';
  const heading = playing ? [`Round ${S.round}${b.total?` · ${b.step} of ${b.total}`:''}`, 'The clash'] : [`Round ${S.round}`, roundOver ? 'Round over' : S.phase==='scout' ? 'The crow is back' : 'Choose your moves'];
  return `${topbar(heading[0], heading[1], false)}
    ${strengthBar(me, playing?u=>b.cur.hp[u.uid]:undefined, playing?u=>b.prev.hp[u.uid]:undefined)}
    <div class="board${big?' big':''}${kos?' k':''}${over?' covered':''}${playing?'':' bwait'}${playing&&!beat&&S.round===1?' opener':''}" style="--w:${W}px;--ch:${BOARD.ch}px">
      <div class="arow top${calmRow(rowU[0])}">${rowU[0].map(card).join('')}${calmRow(rowU[0])?waterRing():''}</div>
      <div class="aband">${band}</div>
      <div class="arow bot${calmRow(rowU[1])}">${rowU[1].map(card).join('')}${calmRow(rowU[1])?waterRing():''}</div>
      ${over?`<div class="aover" aria-live="polite">${over}</div>`:''}
    </div>${beat&&!over?beatFx(b.lines,b.from)+momentFx(momentOf(b.lines,b.to,b.cur)):''}
    ${playing ? actionbar('<button class="btn ghost" data-a="skip">Skip</button>') : roundOver ? actionbar(S.final?'<button class="btn" data-a="finish">See who won</button>':'<button class="btn" data-a="next">Next round</button>') : mouse ? actionbar(mouse) : ''}`;
}
// The TV's lobby (TV mode opens here, and Main menu comes back here): the code, who has joined, what to play
function vTvHome(){
  const t=S.tv, seat=q=>{ const on=tvSeatOn(q), name=tvSeatName(q);
    return `<div class="tvslot${on?' on':''}" style="--tc:${pc(q)}"><span class="tvsn">Player ${q+1}</span><b>${on?esc(name):q?'Second phone (for 2 players)':'Waiting for a phone…'}</b><span class="muted">${on?'Connected ✓':t.seats[q]?'Reconnecting…':'Not joined yet'}</span></div>`; };
  const ch=tvChoices('tvhome');
  return `<div class="tvhome">
    <div class="hero"><span class="kanji" aria-hidden="true">滅</span><div class="eyebrow">TV mode</div><h1>Slayer Squad</h1></div>
    <div class="tvjoin"><p>On your phones, open Slayer Squad, tap <b>📺 Join a TV</b> and type</p><div class="tvcode">${esc(t.code)}</div></div>
    <div class="tvslots">${seat(0)}${seat(1)}</div>
    ${tvCfgRows(tvCfgNow())}
    <div class="tvmodes">${ch.map(([k,l],i)=>`<button class="btn${i?' ghost':''}" data-a="tvchoose" data-v="${k}">${esc(l)}</button>`).join('')}</div>
    <p class="hint">Pick from either phone, or here. Story mode and unlocks use the players’ own saves from their phones, and story wins are saved back to Player 1’s phone.</p>
    <div class="tvhomebar"><button class="btn ghost small" data-a="tvfull">Full screen</button><button class="btn ghost small" data-a="tvexit">Exit TV mode</button></div>
  </div>`;
}
if(typeof VIEWS!=='undefined') VIEWS.tvhome = () => vTvHome();
// Join a TV from a phone's home screen (its own button: not under Online)
async function tvJoinCode(){
  const el=document.getElementById('tvcode'), code=((el&&el.value)||'').trim().toUpperCase(); S.tvJoinCode=code;
  if(!/^[A-Z]{4}$/.test(code)){ S.tvJoinMsg='Type the 4-letter code on the TV.'; return render(); }
  S.tvJoinMsg='Looking for the TV…'; render();
  if(await tvRoom(code)){ S.tvJoinMsg=''; S.tvJoinOpen=false; return ctlJoin(code); }
  S.tvJoinMsg='No TV with that code. Check the code on the TV screen.'; render();
}
// The laptop picks this round's moves itself (player 1 against the computer, or a player whose phone dropped out)
function tvMouse(q){ S.tvMouse=S.round; S.planFor=+q||0; S.focus=null; }

/* ---------- the phone (controller) side ---------- */
async function ctlJoin(code){
  S.onlineMsg='Connecting to the TV…'; render();
  try{
    const db=await firebaseReady(), room=db.ref('rooms/'+code);
    const keep={vol:S.vol, speed:S.speed, vibeOn:S.vibeOn, clipsOn:S.clipsOn, install:S.install};
    S=Object.assign({phase:'setup', mode:'story', names:[playerName()||'Player 1','Computer']}, keep, {ctl:{code}, onlineMsg:'', ctlView:'watch', ctlLocked:0, ctlSeat:-1, me:0, planFor:0, plans:[{},{}], helperPlan:[[],[]], lastPlans:[null,null]});
    TV.room=room;
    // here at the TV: the phone's name under its id, removed by the server if the phone drops off
    const me=room.child('tv/phones/'+PHONE_ID+'~'+SESSION);
    // the phone's story save goes with it, so the TV plays and unlocks from this phone's progress (as a string:
    // Firebase drops empty lists)
    onConnected(db, ()=>{ me.onDisconnect().remove(); me.set({name:playerName()||'Player', at:Date.now(), story:JSON.stringify(loadStory())}); });
    // a story battle won on the TV: merge it into this phone's save (never loses anything already here)
    const sv=room.child('tv/save/'+PHONE_ID), h=x=>{ const v=x.val(); if(!v) return;
      try{ writeStory(mergeStory(loadStory(), JSON.parse(v))); me.update({story:JSON.stringify(loadStory())}); }catch(e){} };
    sv.on('value',h); TV.offs.push(()=>sv.off('value',h));
    const f=s=>{ const v=s.val(); if(v) ctlState(v); }; room.child('tv/state').on('value',f); TV.offs.push(()=>room.child('tv/state').off('value',f));
    const g=s=>{ S.tvGone=s.val()===false; render(); }; room.child('host/on').on('value',g); TV.offs.push(()=>room.child('host/on').off('value',g));
    try{ localStorage.setItem(CTL_KEY, JSON.stringify({code, at:Date.now()})); }catch(e){}
    keepAwake(true); music(null); render();
  }catch(e){ S.onlineMsg=netError(e); render(); }
}
function ctlStop(){
  if(TV.room) TV.room.child('tv/phones/'+PHONE_ID+'~'+SESSION).remove();
  TV.offs.forEach(f=>f()); TV.offs=[]; TV.room=null; S.ctl=null; keepAwake(false);
  try{ localStorage.removeItem(CTL_KEY); }catch(e){}
}
// The TV's game arrived: mirror it; a new round starts with a clean set of picks on the phone
function ctlState(json){
  const o=JSON.parse(json), newRound=o.round!==S.round || o.stage!==S.stage || o.phase==='draft';
  const seat=(o.seats||[]).indexOf(PHONE_ID);
  Object.assign(S,o); if(o.campaign) setCampaign(o.campaign); S.ctlSeat=seat; S.me=S.planFor=Math.max(0,seat);
  S.ctlView = seat>=0 && o.views ? o.views[seat] : 'watch';
  if(newRound || !S.plans){ S.plans=players().map(()=>({})); S.helperPlan=players().map(()=>[]); S.focus=null; S.scouting=false; }
  if(o.scoutPlans) players().forEach(q=>{ if(q!==S.me){ S.plans[q]=o.scoutPlans[q]||{}; S.helperPlan[q]=(o.scoutHelpers||[])[q]||[]; } });
  else S.scouting=false;
  try{ const c=JSON.parse(localStorage.getItem(CTL_KEY)||'null'); if(c && Date.now()-c.at>60e3) localStorage.setItem(CTL_KEY, JSON.stringify({code:S.ctl.code, at:Date.now()})); }catch(e){}
  render();
}
// The Continue button: tell the TV to press its main button
function ctlNext(){ ctlSend({a:'next'}); }
// Lock in on the phone: send the picks to the TV, then watch (after a crow report: the changed moves)
function ctlLock(){
  if(!TV.room) return;
  const q=S.me, scout=!!S.scouting;
  S.lastPlans=S.lastPlans||[null,null]; S.lastPlans[q]=JSON.parse(JSON.stringify(S.plans[q]||{}));
  ctlSend({a:'moves', round:S.round, scout, plans:S.plans[q]||{}, helperPlan:S.helperPlan[q]||[]});
  if(scout){ S.ctlScouted=S.round; S.scouting=false; } else S.ctlLocked=S.round;
  window.scrollTo(0,0);
}
// Crow report on the phone: keep the moves, or change them (the move screen again, with the report on top)
function ctlKeep(){ ctlSend({a:'keep'}); S.ctlScouted=S.round; }
function ctlRescout(){ S.scouting=true; S.focus=null; const f=alive(S.me).find(u=>!u.stun); if(f) S.focus=f.uid; window.scrollTo(0,0); }
// What the phone shows: its move / crow / draft screen while the TV waits for this phone, otherwise "Watch the TV"
function ctlViewName(){
  const v=S.ctlView;
  if(v==='plan' && S.ctlLocked!==S.round && S.teams) return 'plan';
  if(v==='scout' && S.ctlScouted!==S.round && S.teams) return S.scouting ? 'plan' : 'scout';
  if(v==='guess' && S.spin) return 'spin';
  if(v==='draft' && S.pool) return 'draft';
  return 'ctlwatch';
}
// Send something to the TV, signed with this phone's id so the TV knows which player it is
function ctlSend(m){ if(TV.room) TV.room.child('tv/acts').push(JSON.parse(JSON.stringify(Object.assign({}, m, {from:PHONE_ID})))); }
// The story map on the phone: pick a battle (or a draft replay of one you've won); the TV opens it
function ctlStoryList(list){
  return `<div class="ctlstory"><div class="tlabel">Pick a battle</div>${list.map(b=>`<div class="ctlrow${b.open?'':' locked'}${b.won?' won':''}">
    <span class="ctln">${b.i+1}</span><span class="ctlt"><b>${esc(b.title)}</b><small>${esc(b.arc)}${b.won?' · '+'★'.repeat(b.stars||1):''}</small></span>
    ${b.open?`<button class="btn small" data-a="ctlstage" data-v="${b.i}">${b.won?'Play again':'Play'}</button>`:'<span class="muted">🔒</span>'}
    ${b.won?`<button class="btn ghost small" data-a="ctlstage" data-v="${b.i}" data-d="1">Draft</button>`:''}</div>`).join('')}</div>`;
}
// The numbers live on the phone so the TV can stay clean: the round's log, then the match summary when it ends
function ctlSummary(){
  if(S.tvView==='over' && S.teams) return `${mvpPanel()}<div class="overteams">${players().map(q=>teamBlock(q)).join('')}</div>${matchLogPanel()}`;
  if(S.tvView==='result' && S.teams && S.next && S.next!=='Skip' && S.log) return `<div class="panel ctlround"><div class="tlabel">Round ${S.round}</div>${logHTML()}</div>`;
  return '';
}
function vCtlWatch(){
  const live=!!S.teams && !['setup','story','modeset','credits'].includes(S.phase) && !S.story;
  const seat=S.ctlSeat, who = seat>=0 && S.tvDuo ? `<p class="ctlwho" style="color:${pc(seat)}">You’re ${esc(S.names[seat]||'Player '+(seat+1))}</p>` : seat<0 && (S.seats||[]).length>=2 ? '<p class="ctlwho muted">Watching: two phones are already playing</p>' : '';
  const locked = (S.ctlLocked===S.round || S.ctlScouted===S.round) && ['plan','scout'].includes(S.phase);
  return `<div class="ctlwatch"><span class="ctlk" aria-hidden="true">📺</span>
    <h1>${S.story?'Story mode':'Watch the TV'}</h1>${who}
    ${S.tvGone?'<p class="ctlgone">The TV has disconnected. This phone picks up again when the laptop is back.</p>':''}
    <p class="muted">${S.story?'Pick a battle here, or on the TV.':!live?'Connected. Your moves will show up here when a battle starts.':locked?`Round ${S.round}: moves locked in.`:['plan','result','scout'].includes(S.phase)?`Round ${S.round||1}`:'Look at the TV.'}</p>
    ${S.wait&&live?`<p class="ctlwaitline">${S.wait}</p>`:''}
    ${S.next?`<button class="btn big" data-a="ctlnext">${esc(S.next)}</button>`:''}
    ${(S.choices||[]).length?`<div class="ctlchoices">${S.choices.map(([k,l],i)=>`<button class="btn${i?' ghost':''}" data-a="ctlpick" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>`:''}
    ${S.tvCfg?tvCfgRows(S.tvCfg):''}
    ${S.story?ctlStoryList(S.story):''}
    ${ctlSummary()}
    <p class="hint">Code ${esc(S.ctl.code)}</p>
    <button class="btn ghost" data-a="ctlexit">Leave controller mode</button></div>`;
}
// Is this 4-letter code a TV (rather than a live online room)?
async function tvRoom(code){ try{ const db=await firebaseReady(); return !!(await db.ref('rooms/'+code+'/tv/on').get()).val(); }catch(e){ return false; } }
// A phone that was controlling a TV and reloaded (or was closed by the phone) goes straight back to it
function ctlResume(){
  let c=null; try{ c=JSON.parse(localStorage.getItem(CTL_KEY)||'null'); }catch(e){}
  if(!c) return;
  if(Date.now()-c.at>6*3600e3){ try{ localStorage.removeItem(CTL_KEY); }catch(e){} return; }
  tvRoom(c.code).then(ok=>{ if(ok && !S.ctl && !S.tv && S.phase==='setup') ctlJoin(c.code); else if(!ok) try{ localStorage.removeItem(CTL_KEY); }catch(e){} });
}
if(typeof document!=='undefined' && typeof render==='function') setTimeout(ctlResume, 300);
