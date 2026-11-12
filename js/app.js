/* ================= APP =================
   Rendering and taps. The only file that touches the DOM. */
const BASE_TITLE = document.title;   // the full title from index.html, kept for search results
const app = document.getElementById('app'), sheet = document.getElementById('sheet');
const VIEWS = {reveal:vReveal, ceremony:vCeremony, order:vOrder, credits:vCredits, setup:vSetup, modeset:vModeSet, codex:vCodex, lobby:vLobby, story:vStory, scene:vScene, scout:vScout, spin:vSpin, draft:vDraft, pass:vPass, plan:vPlan, ready:vReady, result:vResult, over:vOver};
const quickMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let scored = false, spinShown = null;   // spinShown: the number game already revealed on this screen (for its ding)
// which screen to draw: online, each phone shows the win screen on its own; a crow re-plan reuses the move screen
const viewName = () => S.replaying ? 'result' : isOnline() && S.final && S.localOver ? 'over' : S.phase==='scout' && S.scouting ? 'plan' : S.phase;

// Start a clip with no play button: phones only autoplay a video that is muted inline, and a video added by script
// has to be told so in code. If the phone still refuses (iPhone Low Power Mode), the next tap anywhere starts it.
const PENDING_VIDS = new Set();
function playVid(v){
  v.muted=true; v.defaultMuted=true; v.playsInline=true; v.setAttribute('muted',''); v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline','');
  const go=()=>{ if(!v.isConnected || !v.paused || v.ended) return; const p=v.play(); if(p && p.then) p.then(()=>{ PENDING_VIDS.delete(v); v.classList.remove('vidwait'); }).catch(()=>{ PENDING_VIDS.add(v); v.classList.add('vidwait'); }); };
  go(); v.addEventListener('canplay',go,{once:true}); setTimeout(go,400);   // not loaded yet: try again when it can play
}
['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev, ()=>{
  PENDING_VIDS.forEach(v=>{ if(!v.isConnected){ PENDING_VIDS.delete(v); return; } const p=v.play(); if(p && p.then) p.then(()=>{ PENDING_VIDS.delete(v); v.classList.remove('vidwait'); }).catch(()=>{}); });
}, {passive:true}));
// Opening Latest Updates clears its New badge until the next version
document.addEventListener('toggle',e=>{ if(e.target.id!=='updates' || !e.target.open) return; try{ if(typeof LATEST_UPDATE==='object') localStorage.setItem('squad-draft-seen-update',LATEST_UPDATE.version); }catch(x){} const d=e.target.querySelector('.newdot'); if(d) d.remove(); },true);
// The home roster drifts on its own and you can swipe it; touching it pauses the drift for a few seconds. A redraw keeps its place.
const ROSTER_ROW = {x:0, dir:1, until:0, on:false, at:0, speed:10};   // speed in pixels a second, the same on every screen
// Drift moves the row on the graphics layer (smooth, fractions of a pixel); a finger gets ordinary scrolling (whole pixels), and the two hand over in place
function rosterPlace(el){ const R=ROSTER_ROW, t=el.firstElementChild; if(Date.now()<R.until){ if(t.style.transform){ t.style.transform=''; el.scrollLeft=Math.round(R.x); } } else { if(el.scrollLeft) el.scrollLeft=0; t.style.transform=`translate3d(${-R.x}px,0,0)`; } }
function rosterKeep(){ const el=document.querySelector('.artstrip'); if(!el) return; rosterPlace(el); if(!ROSTER_ROW.on && !matchMedia('(prefers-reduced-motion:reduce)').matches){ ROSTER_ROW.on=true; requestAnimationFrame(rosterDrift); } }
function rosterDrift(now){
  const el=document.querySelector('.artstrip'), R=ROSTER_ROW; if(!el){ R.on=false; return; }
  const dt=Math.min(.1,(now-(R.at||now))/1000); R.at=now;
  if(Date.now()<R.until){ rosterPlace(el); R.x=el.scrollLeft; }
  else { const end=el.firstElementChild.scrollWidth-el.clientWidth; R.x+=R.dir*R.speed*dt; if(R.x>=end){ R.x=end; R.dir=-1; } if(R.x<=0){ R.x=0; R.dir=1; } rosterPlace(el); }
  requestAnimationFrame(rosterDrift);
}
['touchstart','touchmove','wheel','pointerdown','scroll'].forEach(ev=>document.addEventListener(ev,e=>{ if(ev==='scroll' && Date.now()>=ROSTER_ROW.until) return; if(e.target.closest && e.target.closest('.artstrip')){ ROSTER_ROW.until=Date.now()+4000; const el=document.querySelector('.artstrip'); if(el) rosterPlace(el); } },{passive:true, capture:true}));
// Synergy reveal: once per match, at the first move screen, the teams' active synergies light up for a moment (tap to skip)
// Who a synergy is about, for its portraits: fighters named in it, or the group it counts (Hashira, Upper Moons, Marks, demons)
const SYN_GROUPS = {'Hashira':u=>BYID[u.id].hashira, 'Corps Master':u=>BYID[u.id].hashira||u.fam==='kagaya', 'Upper Moons':u=>BYID[u.id].upper, 'Marks spread':u=>u.mark,
  "Muzan's Blood":u=>u.demon&&u.fam!=='nezuko', 'Kamaboko Squad':u=>['tanjiro','zenitsu','inosuke'].includes(u.fam), 'Siblings counter':u=>['tanjiro','nezuko'].includes(u.fam),
  'Mentor':u=>['urokodaki','tanjiro','giyu','sabito'].includes(u.fam)};
// Pairs: both fighters are pictured even when only one gets the bonus (CK: Sun Lineage shows Yoriichi and Tanjiro)
[['Sun Lineage','yoriichi','tanjiro'],['Devoted','tamayo','yushiro'],['Two as One','gyutaro','daki'],['Father and Son','tanjuro','tanjiro'],["Kanae's student",'kanae','kanao'],
 ['Training partner','typezero','muichiro'],['Kocho Sisters','kanae','shinobu'],['Temari & Arrows','susamaru','yahaba'],['Old Friends','giyu','sabito'],['Set Your Heart Ablaze','rengoku','tanjiro'],
 ['Love Hashira','obanai','mitsuri'],['Brothers','sanemi','genya'],["Tengen's Family",'tengen','hinatsuru','makio','suma'],
 ['For Nezuko!','zenitsu','nezuko'],['Butterfly Mansion','shinobu','kanao'],["Gyomei's student",'gyomei','genya']].forEach(([n,...f])=>{ SYN_GROUPS[n]=u=>f.includes(u.fam); });
function synMembers(p, label){
  const name=label.replace(/^!/,'').split(':')[0].replace(/ [+−-]\d.*$/,''), grp=SYN_GROUPS[name], team=S.teams[p].filter(u=>!u.spawn);
  let us=grp ? team.filter(grp) : team.filter(u=>[u.name,u.short,BYID[u.id].short,u.fam].some(n=>n && label.toLowerCase().includes(String(n).toLowerCase().replace(/ ✦$/,''))));
  if(!us.length) us=team.slice(0,2);
  const foe=/^Rival|^Revenge/.test(name) ? enemiesOf(p).flatMap(q=>S.teams[q]).find(u=>label.includes(u.short)||(/Doma/.test(label)&&u.fam==='doma')||(name==='Rival'&&['akaza','kaigaku'].includes(u.fam))) : null;
  return {us:us.slice(0,4), foe};
}
// The bonus line (CK): a bonus for both says just '+2 PWR'; a bonus for one says who, '+2 PWR for Tanjiro'
const synBonus = t => t.split(/,\s*/).map(part=>{ const m=part.match(/^((?:[A-Z][a-z][\w✦']*\s?)+?)\s+([+−-]\d.*)$/); if(!m) return part; return / and /.test(part) ? m[2] : `${m[2]} for ${m[1].trim()}`; })
  .join(', ').replace(/^(.*?) and (.*?) ([+−-]\d.*)$/,'$3');
// Synergy reveal (CK, Nov 3, 2026: "do it better"): one cut-in per synergy. A band sweeps across, the fighters slide in, a link
// lights between them, then the name. Tap to skip.
// Battle entrance (Nov 12, 2026): before round 1 (not story, which has its VS card), the two squads slam in from either
// side with their kanji stamped on, and a VS slash cuts between them. Tap to skip.
function entranceIntro(after){
  const me=myP(), them=enemiesOf(me); if(!them.length) return after&&after();
  const side=(us,cls,p,name)=>`<div class="en-side ${cls}" style="--tc:${pc(p)}"><span class="en-name">${esc(name)}</span><div class="en-cards">${us.map((u,i)=>`<span class="en-c" style="--i:${i}">${seal(u,'lg')}<b>${u.g}</b></span>`).join('')}</div></div>`;
  const el=document.createElement('div'); el.className='entrance'; el.setAttribute('role','status');
  el.innerHTML=side(S.teams[me].filter(u=>!u.spawn),'l',me,soloView()?'You':titled(S.names[me]))+'<span class="en-slash"></span><b class="en-vs">VS</b>'+side(them.flatMap(q=>S.teams[q]).filter(u=>!u.spawn),'r',them[0],them.map(q=>titled(S.names[q])).join(' & '));
  document.body.appendChild(el); sfx('vs');
  let gone=false; const done=()=>{ if(gone) return; gone=true; el.classList.add('out'); setTimeout(()=>{ el.remove(); after&&after(); },350); };
  el.addEventListener('click',done); setTimeout(done, quickMotion()?600:2800);
}
// Weather by place (Nov 12, 2026): soft particles behind the battle that match its background
const WEATHER = {prologue:'snow', mentor:'mist', training:'mist', selection:'wisteria', dr_selection:'wisteria', asakusa:'lanterns', tsuzumi:'dust', natagumo:'leaves',
  mugen:'embers', mugen_akaza:'embers', dr_wrongtrain:'embers', district:'lanterns', dr_wives:'lanterns', swordsmith:'steam', castle:'paper', estate:'embers',
  hashira_training:'leaves', kanae:'petals', dr_flowers:'petals', flashback:'petals', dawn:'ash', six:'embers', dr_nine:'paper', dr_waking:'ash', dr_heart:'embers',
  dr_hakuji:'petals', dr_nothing:'petals', dr_returned:'snow', dream1:'snow', dream2:'petals', dream3:'mist', dream4:'embers', dream5:'petals'};
const WX_N = {snow:16, mist:4, wisteria:12, lanterns:6, dust:10, leaves:9, embers:14, steam:4, paper:7, petals:11, ash:12};   // kept sparse so they never pull the eye (CK)
function setWeather(kind){
  let el=document.getElementById('weather');
  if(!kind || quickMotion()){ if(el) el.remove(); return; }
  if(el && el.dataset.k===kind) return;
  if(!el){ el=document.createElement('div'); el.id='weather'; el.setAttribute('aria-hidden','true'); document.body.prepend(el); }
  el.dataset.k=kind; el.className='wx-'+kind;
  el.innerHTML=Array.from({length:WX_N[kind]||16},(_,i)=>`<i style="--x:${(i*37+11)%100}%;--y:${(i*53+7)%90}%;--d:${(-((i*1.7)%9)).toFixed(1)}s;--s:${(.6+(i%4)*.2).toFixed(2)};--t:${(7+(i%5)*1.8).toFixed(1)}s;--r:${(i*47)%360}deg"></i>`).join('');
}
function synergyIntro(){
  S.synShown=true; const list=players().flatMap(p=>(S.syn&&S.syn[p]||[]).filter(x=>x[0]!=='!').map(t=>({p,t}))).slice(0,6); if(!list.length) return;
  const el=document.createElement('div'); el.className='synreel'; el.setAttribute('role','status'); document.body.appendChild(el);
  let i=0, timer=null; const done=()=>{ clearTimeout(timer); el.classList.add('out'); setTimeout(()=>el.remove(),400); };
  const next=()=>{ if(i>=list.length) return done(); const {p,t}=list[i++], m=synMembers(p,t), cut=t.includes(':')?t.indexOf(':'):t.search(/ [+−-]\d/), name=cut>0?t.slice(0,cut):t, what=synBonus(cut>0?t.slice(cut+1).trim():'');   // 'Brothers: …' or 'Hashira +1 PWR'
    const L=m.us.slice(0,Math.ceil(m.us.length/2)), R=m.foe?[m.foe]:m.us.slice(Math.ceil(m.us.length/2));
    el.innerHTML=`<div class="synband" style="--tc:${pc(p)}"><span class="synteamtag">${esc(nm(p))}</span>
      <div class="synpair"><span class="synl">${L.map(u=>seal(u,'lg')).join('')}</span><i class="synlink${m.foe?' vs':''}">${m.foe?'VS':''}</i><span class="synr">${R.map(u=>seal(u,'lg')).join('')}</span></div>
      <b class="synname">${esc(name)}</b>${what?`<span class="syneff">${esc(what)}</span>`:''}<span class="syncount">${i} / ${list.length}</span></div>`;
    timer=setTimeout(next, quickMotion()?700:1450); };
  el.addEventListener('click',done); next();
}
/* KO test matches (localhost only): ?test=<name> starts a battle one hit from that knockout. Tap Attack on the fighter
   (or Fight) and watch. CK, Nov 3, 2026. */
const dodge=(id,by,extra)=>({you:['tanjiro'], foe:[id,'hand'], keep:true, setup:()=>{ const t=S.teams[1][0]; Object.assign(t,{hp:t.max,pow:0}, by); S.teams[0][0].spd=99; S.teams[1].forEach(u=>{u.pow=0;u.spd=1;u.cd=9;}); if(extra) extra(); }, note:'Attack '+BYID[id].short+' and Fight.'});
const KO_TESTS = {
  // Dead Calm and Castle Shift prototypes (Nov 11, 2026): old and new side by side
  an9_gyokko:  {you:['muichiro','tanjiro'], foe:['gyokko'], keep:true, setup:()=>{ const g=S.teams[1][0]; g.hp=Math.round(g.max*.55); g.cd=9; S.teams[0].forEach(u=>{ u.cd=0; }); }, note:'Gyokko is at 55%. Hit him this round: at the end of it he sheds his shell into his Perfect Form.'},
  an8_compass: {you:['akaza'], foe:['tanjiro','zenitsu','inosuke'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); S.teams[0][0].cd=0; }, note:'Pick Compass Needle and Fight.'},
  an10_claws: {you:['sanemi'], foe:['akaza','doma','gyokko'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); const a=S.teams[0][0]; a.sig=BYID.sanemi.sig2; a.cd=0; }, note:'Pick Claws-Purifying Wind and Fight.'},
  an8_annihil: {you:['akaza'], foe:['tanjiro','zenitsu','inosuke'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); const a=S.teams[0][0]; a.sig=BYID.akaza.sig2; a.cd=0; }, note:'Pick Annihilation Type and Fight.'},
  an8_muzan:   {custom:()=>{ Object.assign(S,{mode:'cpu', n:2, names:['You','Muzan AI'], askName:null, unlockAll:true, poolType:'all'}); newDraft(0); }, note:'Scroll to Muzan and Final Muzan: their cards have the Demon King lining.'},
  an7_stuck:   {you:['kyogai','akaza'], foe:['tanjiro','zenitsu'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); const k=S.teams[0][0]; k.cd=0; k.spd=99; }, note:'Round 1: Drum Room Spin on anyone and Fight. Round 2: they have dizzy stars on their card, and when their turn comes they are stuck in the spinning room.'},
  an7_nofind:  {you:['nakime','akaza'], foe:['tanjiro','zenitsu'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); const n=S.teams[0][0]; n.cd=0; n.spd=99; }, note:'Castle Shift on Tanjiro, and have Akaza Attack Tanjiro: Akaza strikes an empty room.'},
  an7_entrance:{you:['tanjiro','zenitsu','inosuke'], foe:['akaza','doma','hand'], syn:true, keep:true, note:'The two squads slam in before round 1.'},
  an7_status:  {you:['tanjiro','zenitsu','inosuke'], foe:['akaza','doma'], keep:true, setup:()=>{ const [a,b]=S.teams[0]; a.poison={dmg:2,turns:3}; b.stun=true; b.bound='drum'; S.teams[1][1].poison={dmg:6,turns:3}; }, note:'Tanjiro and Doma are poisoned (bubbles); Zenitsu is dizzy (stars) and will lose his turn.'},
  an7_codex:   {custom:()=>{ Object.assign(S,{phase:'codex', askName:null, unlockAll:true, codexSel:'tanjiro'}); }, note:'The card flips over as it opens. Close it and tap other cards.'},
  an7_deal:    {custom:()=>{ Object.assign(S,{mode:'cpu', n:2, names:['You','Muzan AI'], askName:null, unlockAll:true}); newDraft(0); }, note:'The cards fly onto the table one by one.'},
  an7_crow:    {you:['tanjiro','zenitsu','crow'], foe:['akaza'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); }, note:'Tap Use Kasugai Crow, then Fight.'},
  an7_wx_prologue: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='prologue'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: snow.'},
  an7_wx_selection: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='selection'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: wisteria.'},
  an7_wx_mugen: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='mugen'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: embers.'},
  an7_wx_natagumo: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='natagumo'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: leaves.'},
  an7_wx_district: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='district'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: lanterns.'},
  an7_wx_castle: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='castle'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: paper.'},
  an7_wx_swordsmith: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='swordsmith'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: steam.'},
  an7_wx_mentor: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='mentor'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: mist.'},
  an7_wx_kanae: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='kanae'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: petals.'},
  an7_wx_dawn: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='dawn'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: ash.'},
  an7_wx_tsuzumi: {you:['tanjiro'], foe:['hand'], keep:true, setup:()=>{ S.place='tsuzumi'; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Weather: dust.'},
  an6_kyogai: {you:['kyogai'], foe:['tanjiro','zenitsu'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); const k=S.teams[0][0]; k.cd=0; k.spd=99; }, note:'Pick Drum Room Spin on Tanjiro and Fight.'},
  an5_destiny:{you:['giyu'], foe:['akaza'], keep:true, setup:()=>{ DESTINY_ODDS=1; const g=S.teams[0][0]; g.hp=Math.round(g.max*.35); S.teams[1][0].pow=8; S.teams[1][0].cd=9; }, note:'Giyu is low against Akaza. Defend and Fight: when Akaza drops him under 30%, he awakens (always, for this test).'},
  an4_flee:   {you:['akaza'], foe:['hantengu_true','zohakuten'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); const h=S.teams[1].find(u=>u.id==='hantengu_true'); h.cd=0; h.spd=99; }, note:'Fight: the real Hantengu flees.'},
  an4_block:  {you:['giyu','tanjiro','zenitsu'], foe:['akaza'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.hp=u.max=300; u.cd=9; u.spd=1; }); const g=S.teams[0][0]; g.cd=0; g.spd=99; }, note:'Pick Giyu\'s Dead Calm, and Fight: Akaza\'s blow lands on the water.'},
  an4_lost:   {you:['nakime','akaza'], foe:['tanjiro','zenitsu'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=300; }); const n=S.teams[0][0]; n.cd=0; n.spd=99; }, note:'Pick Nakime\'s special on Tanjiro and Fight: he falls into the castle, then can\'t act when his turn comes.'},
  an4_lotus:  {you:['doma'], foe:['tanjiro','zenitsu','inosuke'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=300; }); S.teams[0][0].cd=0; }, note:'Pick Frozen Lotus and Fight.'},
  an4_buddha: {you:['doma'], foe:['tanjiro','zenitsu','inosuke'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=300; }); const d=S.teams[0][0]; d.sig=BYID.doma.sig2; d.cd=0; }, note:'Pick Water Lily Bodhisattva and Fight.'},
  an4_moonbow:{you:['kokushibo'], foe:['tanjiro','zenitsu','inosuke'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=300; }); const k=S.teams[0][0]; k.sig=BYID.kokushibo.sig2; k.cd=0; }, note:'Pick Moonbow, Half Moon and Fight.'},
  an4_crescent:{you:['kokushibo'], foe:['tanjiro','zenitsu','inosuke'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=300; }); const k=S.teams[0][0]; k.sig=BYID.kokushibo.sig3; k.cd=0; }, note:'Pick Catastrophe, Tenman Crescent Moon and Fight.'},
  an4_shinobu:{you:['shinobu'], foe:['hand'], keep:true, setup:()=>{ const h=S.teams[1][0]; h.hp=3; h.pow=0; h.cd=9; h.regen=0; h.noDefend=true; }, note:'Attack the Hand Demon: Shinobu can\'t cut his head off.'},
  an4_calm_new: {you:['giyu','tanjiro','zenitsu'], foe:['akaza','doma'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.hp=u.max=300; u.cd=9; }); S.teams[0][0].cd=0; }, note:'New Dead Calm: pick Giyu\'s special and Fight.'},
  an4_castle_new: {you:['nakime','akaza'], foe:['tanjiro','zenitsu'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=300; }); S.teams[0][0].cd=0; }, note:'New Castle Shift: pick Nakime\'s special on Tanjiro and Fight.'},
  // animation round 3 (Nov 11, 2026)
  an3_seventh: {you:['zenitsu'], foe:['akaza'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); const z=S.teams[0][0]; z.sig=BYID.zenitsu.sig2; z.cd=0; }, note:'Seventh Form is ready: pick it and Fight.'},
  an3_sun:     {you:['tanjiro_mark'], foe:['akaza'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); const t=S.teams[0][0]; t.sig=BYID.tanjiro_mark.sig; t.unblock=true; t.cd=0; }, note:'His unblockable Hinokami Kagura is ready (as if he just left the Selfless State): pick it and Fight.'},
  an3_tengen:  {you:['tengen'], foe:['akaza','doma','hand'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); S.teams[0][0].cd=0; }, note:'Pick Tengen\'s special and Fight.'},
  an3_kanae:   {you:['kanae','tanjiro'], foe:['doma'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); S.teams[0][0].cd=0; const t=S.teams[0][1]; t.hp=Math.round(t.max*.5); }, note:'Pick Kanae\'s special and Fight.'},
  an3_defeat:  {you:['hand'], foe:['akaza'], keep:true, setup:()=>{ S.teams[0].forEach(u=>{ u.hp=1; }); S.teams[1][0].spd=99; }, note:'You\'re about to lose: Defend or Attack and Fight to see the defeat screen.'},
  an3_foil:    {custom:()=>{ Object.assign(S,{phase:'codex', askName:null, unlockAll:true, codexSel:'yoriichi'}); }, note:'Prime Yoriichi\'s card shines like foil. Open a Mark or another rare card to compare with a normal one.'},
  // animation round (Nov 10, 2026): Genya, Zenitsu asleep, Kokushibo's blade, your special-ready pulse
  an_inosuke: {you:['inosuke'], foe:['akaza','doma','hand'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); S.teams[0][0].cd=0; }, note:'Pick Inosuke\'s special and Fight: both swords spin across and back.'},
  an_shinobu: {you:['shinobu'], foe:['akaza'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); S.teams[0][0].cd=0; }, note:'Pick Shinobu\'s special and Fight.'},
  an_muzan:  {you:['muzan_final'], foe:['tanjiro','zenitsu','inosuke'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); S.teams[0][0].cd=0; }, note:'Pick Thorned Flesh Whips and Fight. (Final Form only: regular Muzan keeps his old whips.)'},
  an_rengoku:{you:['rengoku'], foe:['akaza'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); const r=S.teams[0][0]; r.sig=BYID.rengoku.sig2; r.cd=0; }, note:'Ninth Form is ready: pick it and Fight.'},
  an_draft:  {custom:()=>htDraftTest(['tanjiro'], 30), note:'Upper Moon cards have a purple lining in the draft.'},
  an_win:    {you:['rengoku','tanjiro'], foe:['hand'], keep:true, setup:()=>{ const h=S.teams[1][0]; h.hp=1; h.pow=0; h.cd=9; }, note:'Attack to win: on the win screen the MVP\'s card flips with their special\'s name behind it.'},
  an_genya: {you:['genya','tanjiro'], foe:['akaza','hand'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); const g=S.teams[0][0]; g.cd=0; g.hp=Math.round(g.max*.6); }, note:'Pick Genya\'s special and Fight.'},
  an_zzz:   {you:['zenitsu','inosuke'], foe:['zenitsu','hand'], keep:true, setup:()=>{ S.teams.flat().forEach(u=>{ u.cd=0; }); S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Both Zenitsus have Thunderclap ready, so they\'re asleep. Use it and the Z\'s stop until it\'s ready again.'},
  an_koku:  {you:['kokushibo'], foe:['tanjiro','zenitsu','inosuke'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.pow=0; u.cd=9; u.hp=u.max=200; }); S.teams[0][0].cd=0; }, note:'Pick Moon Breathing and Fight.'},
  an_ready: {you:['tanjiro','giyu','mitsuri','inosuke'], foe:['akaza'], keep:true, setup:()=>{ const [t,g,m,i]=S.teams[0]; t.cd=0; g.cd=0; m.cd=2; i.cd=0; S.teams[1].forEach(u=>{ u.pow=0; u.hp=u.max=200; }); }, note:'Tanjiro, Giyu and Inosuke have their specials ready (Mitsuri doesn\'t): open them and look at the Special button.'},
  // Hantengu (reworked Nov 10, 2026): fight him with a squad you draft at his points, play as him, or skip to the hunt
  ht_vs:   {custom:()=>htDraftTest(['hantengu','gyokko']), note:'Draft your squad with the same points as Hantengu + Gyokko (15), then fight him. Hunt the real one, or knock Zohakuten down to expose him.'},
  ht_solo: {custom:()=>htDraftTest(['hantengu']), note:'Draft your squad with the same points as Hantengu alone (9), then fight him.'},
  ht_play: {you:['hantengu','gyokko'], foe:['tanjiro_mark','zenitsu','inosuke'], keep:true, setup:()=>{ S.level='normal'; }, note:'You are Hantengu (and Gyokko). Keep the real one hidden as long as you can.'},
  ht_hunt: {you:['tanjiro_mark','genya','mitsuri'], foe:['hantengu'], keep:true, setup:()=>{ const z=mkUnit('zohakuten',1); S.teams[1]=[z]; S.htHide[1]={spot:Math.floor(Math.random()*HT_SPOTS), u:null}; S.htMore[1]=true; S.level='normal'; },
            note:'Straight to Zohakuten, with the real Hantengu hiding. Hunt (pick a hiding place), or knock Zohakuten down.'},
  // dodges and guards (CK, Nov 3, 2026)
  d_muichiro: dodge('muichiro',{evade:true,evadeBy:'muichiro'}),
  d_swamp:    dodge('swamp',{evade:true,evadeBy:'swamp'}),
  d_makomo:   dodge('makomo',{evade:true,evadeBy:'makomo'}),
  d_suma:     dodge('suma',{evade:true,evadeBy:'suma'}),
  d_hantengu: dodge('hantengu',{evade:true,evadeBy:'hantengu'}),
  d_yushiro:  {you:['tanjiro'], foe:['tamayo','yushiro'], keep:true, setup:()=>{ const t=S.teams[1][0]; Object.assign(t,{evade:true,evadeBy:'yushiro'}); S.teams[0][0].spd=99; S.teams[1].forEach(u=>{u.pow=0;u.spd=1;u.cd=9;}); }, note:'Yushiro’s talisman hides Tamayo. Attack Tamayo and Fight.'},
  d_selfless: dodge('tanjiro_mark',{selfless:true,reveal:false}, ()=>{ Object.assign(S.teams[1][0],{cd:3,stun:true}); }),   // stunned so he doesn't strike (striking reveals him)
  g_save:     {you:['akaza'], foe:['zenitsu','tanjiro_mark'], keep:true, setup:()=>{ const [z,t]=S.teams[1]; Object.assign(z,{saved:t.name,savedBy:t.uid}); Object.assign(t,{selfless:true}); S.teams[0][0].spd=99; t.cd=3; S.teams[1].forEach(u=>{u.pow=0;u.spd=1;u.cd=9;}); }, note:'Tanjiro stands over Zenitsu. Attack Zenitsu and Fight.'},
  g_tengen:   {you:['akaza'], foe:['zenitsu','tengen_retired'], keep:true, setup:()=>{ const [z,t]=S.teams[1]; Object.assign(z,{defending:true,guardBy:t.uid}); S.teams[0][0].spd=99; S.teams[1].forEach(u=>{u.pow=0;u.spd=1;u.cd=9;}); }, note:'Retired Tengen guards Zenitsu. Attack Zenitsu and Fight.'},
  g_group:    {you:['gyomei'], foe:['muichiro','hantengu','tanjiro_mark','zenitsu'], keep:true, setup:()=>{ const [m,h,t,z]=S.teams[1]; Object.assign(m,{evade:true,evadeBy:'muichiro'}); Object.assign(h,{evade:true,evadeBy:'hantengu'}); Object.assign(t,{selfless:true,reveal:false,cd:3,stun:true}); Object.assign(z,{saved:t.name,savedBy:t.uid}); S.teams[0][0].cd=0; S.teams[0][0].spd=99; S.teams[1].forEach(u=>{u.pow=0;u.spd=1;u.cd=Math.max(u.cd,9);}); }, note:'Use Gyomei’s special: four dodges and a guard at once.'},
  s_yoriichi: {you:['yoriichi'], foe:['akaza','doma'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{u.pow=0;u.cd=9;u.hp=u.max=200;}); S.teams[0][0].cd=0; }, note:'Attack for the new sun, or use his special.'},
  // new specials
  s_gyokko:   {you:['gyokko'], foe:['tanjiro','zenitsu'], keep:true, setup:()=>{ S.teams[0][0].cd=0; S.teams[1].forEach(u=>{u.pow=0;u.cd=9;}); }, note:'Use Gyokko’s special: the water prison.'},
  s_kanao:    {you:['kanao'], foe:['akaza','doma'], keep:true, setup:()=>{ S.teams[0][0].cd=0; S.teams[1].forEach(u=>{u.pow=0;u.cd=9;}); }, note:'Use Kanao’s special.'},
  s_demonking:{you:['tanjiro_demon'], foe:['tanjiro','zenitsu','inosuke'], keep:true, setup:()=>{ S.teams[0][0].cd=0; S.teams[1].forEach(u=>{u.pow=0;u.cd=9;}); }, note:'Use Demon King Tanjiro’s special.'},
  s_nezuko:   {you:['nezuko_awakened'], foe:['akaza','doma'], keep:true, setup:()=>{ S.teams[0][0].cd=0; S.teams[1].forEach(u=>{u.pow=0;u.cd=9;}); }, note:'Use Awakened Nezuko’s special.'},
  s_murata:   {you:['murata'], foe:['hand','swamp'], keep:true, setup:()=>{ S.teams[0][0].cd=0; S.teams[1].forEach(u=>{u.pow=0;u.cd=9;}); }, note:'Use Murata’s special.'},
  petals:   {you:['akaza'], foe:['kanao'], note:'Kanao falls: butterfly petals.'},
  behead:   {you:['tanjiro'], foe:['hand','swamp'], note:'A demon is beheaded (not the last blow, so normal speed).'},
  muzan:    {you:['yoriichi'], foe:['muzan'], note:'Muzan cracks, the stage shakes, and he explodes.'},
  // mini-game prototypes (Nov 7, 2026; js/mini.js)
  m_hilo:   {custom:()=>miniStart('hilo'), note:'Higher or Lower: guess whether the next fighter has more or less of the stat.'},
  m_memory: {custom:()=>miniStart('memory'), note:'Corps Memory Training: find the six pairs.'},
  m_sel:    {custom:()=>miniStart('sel'), note:'Final Selection: tap or swipe the demons until sunrise.'},
  // battle animations (CK, Nov 6, 2026)
  b_impact: {you:['rengoku'], foe:['hand','swamp'], keep:true, setup:()=>{ S.teams[0][0].pow=30; const h=S.teams[1][0]; h.max=h.hp=50; S.teams[1].forEach(u=>{u.pow=0;u.cd=9;u.spd=0;}); S.teams[0][0].spd=99; }, note:'Attack the Hand Demon: a 40%+ hit flashes an inverted manga frame.'},
  b_ghost:  {you:['tanjiro','zenitsu','inosuke'], foe:['akaza','hand'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{u.pow=0;u.cd=9;u.spd=0;}); }, note:'Attack anyone: the health bars drop at once and a white chip drains after.'},
  b_clash:  {you:['tanjiro'], foe:['akaza','hand'], keep:true, setup:()=>{ const a=S.teams[1][0]; a.spd=99; S.teams[1][1].pow=0; }, note:'Pick Defend and Fight: Akaza’s hit meets crossed blades.'},
  b_breath: {you:['rengoku','tanjiro'], foe:['akaza','hand'], keep:true, setup:()=>{ S.teams[0].forEach(u=>{u.cd=0;}); S.teams[1].forEach(u=>{u.pow=0;u.cd=9;u.max=u.hp=200;}); }, note:'Use a special: air streams into the slayer before the move (全集中).'},
  b_blur:   {you:['zenitsu','tanjiro'], foe:['akaza','hand'], keep:true, setup:()=>{ S.teams[0][0].spd=14; S.teams[1].forEach(u=>{u.pow=0;u.cd=9;u.max=u.hp=200;}); }, note:'Attack with Zenitsu (SPD 14): he leaves afterimages. Tanjiro (slower) doesn’t.'},
  // draft and story map animations (CK, Nov 6, 2026)
  p_rare:   {custom:testDraft, note:'Yoriichi and Final Muzan are dealt: their cards flip in with a gold shine.'},
  p_pick:   {custom:testDraft, note:'Draft any card: it flies into your team box. The computer’s picks do too.'},
  p_journey:{custom:()=>{ Object.assign(S,{campaign:'main'}); try{ localStorage.setItem(STORY_KEY, JSON.stringify({cleared:MAIN_STAGES.slice(0,3).map(s=>s.id)})); localStorage.setItem(MAP_SEEN_KEY, JSON.stringify({main:2})); }catch(e){} ACTIONS.storymap(); S.storySel=null; S.storyScroll=false; window.scrollTo(0,0); }, note:'You just won Final Selection: the trail fills gold and the next stop lights up. (This test overwrites story progress in this browser.)'},
  p_stars:  {custom:()=>{ Object.assign(S,{mode:'story', campaign:'main', stage:1, phase:'scene', sceneOutro:true, sceneUnlock:true, unlockAt:0, newUnlocks:[], goalsNow:[true,true,true], starsGot:3, starsBest:0, sceneAt:0, sceneVs:false}); }, note:'The stars stamp in one at a time.'},
  kagaya:   {you:['kagaya','giyu','sanemi'], foe:['akaza'], keep:true, setup:()=>{ S.teams[0][0].cd=0; S.teams[1].forEach(u=>{u.pow=0;u.cd=9;u.spd=1;}); }, note:'Use Kagaya’s special, Final Resolve: he glows, then explodes.'},
  special:  {you:['tanjiro'], foe:['akaza'], note:'Use Tanjiro’s special (Hinokami Kagura): it lands the cut in the same moment.'},
  synergy:  {you:['rengoku','tanjiro','sanemi','genya'], foe:['akaza','doma','gyutaro'], keep:true, syn:true, note:'The synergy panel opens now.'},
  laststand:{you:['rengoku'], foe:['akaza','doma'], keep:true, setup:()=>{ S.teams[0][0].hp=4; }, note:'Your last fighter is under 25%: the red glow.'},
  sunrise:  {you:['gyomei','giyu'], foe:['akaza','doma'], keep:true, setup:()=>{ S.round=SUNRISE_ROUND; }, note:'Round 10: pick any moves and Fight to see the sunrise.'},
  upper:    {you:['gyomei'], foe:['akaza'], note:'An Upper Moon: the kanji shatters, then the cut.'},
  entrance: {you:['tanjiro','zenitsu'], foe:['doma','hand'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.spd=99; }); }, note:'Fight: Doma moves first and makes his entrance.'},
  doubleko: {you:['mitsuri_mark'], foe:['hand','swamp'], keep:true, setup:()=>{ S.teams[1].forEach(u=>{ u.hp=1; u.pow=0; u.revive=0; }); S.teams[0][0].cd=0; }, note:'Use Mitsuri’s special: both fall at once.'},
  specials: {you:['urokodaki','makio','sabito','tanjuro'], foe:['akaza','doma'], keep:true, setup:()=>{ S.teams[0].forEach(u=>u.cd=0); S.teams[1].forEach(u=>{ u.pow=0; }); }, note:'Use each fighter’s special to see the new effects.'},
};
// The journey advances (CK, Nov 6, 2026). The map remembers how many battles it last showed won (per campaign); when there's a new
// win, the finished chapter's trail fills gold and the next stop lights up, once. First visit: nothing to animate.
const MAP_SEEN_KEY = 'squad-draft-map-seen';
function mapAdvance(){
  let seen={}; try{ seen=JSON.parse(localStorage.getItem(MAP_SEEN_KEY))||{}; }catch(e){}
  const c=S.campaign||'main', won=storyWon(), was=seen[c];
  S.mapAdv = was!==undefined && won>was ? {cleared:Math.max(0,nextStage()-1)} : null;
  seen[c]=won; try{ localStorage.setItem(MAP_SEEN_KEY, JSON.stringify(seen)); }catch(e){}
  clearTimeout(mapAdvance.t); if(S.mapAdv) mapAdvance.t=setTimeout(()=>{ S.mapAdv=null; }, 4000);
}
// Test setups that aren't battles: a draft with rare cards dealt, the story map after a win, the win stars
function testDraft(){
  Object.assign(S,{mode:'cpu', n:2, duo:false, names:[playerName()||'You','Test'], askName:null, unlockAll:true, budget:30, maxTeam:6, poolType:'random'});
  newDraft(0); const want=['yoriichi','muzan_final'], fams=want.map(id=>BYID[id].fam);
  S.pool=[...want, ...S.pool.filter(id=>!fams.includes(BYID[id].fam))].slice(0, Math.max(S.pool.length,want.length));
}
function koTest(){
  const name=(new URLSearchParams(location.search).get('test')||'').toLowerCase(), t=KO_TESTS[name]; if(!t || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  if(t.custom){ t.custom(); note(t.note); render(); return; }
  Object.assign(S,{mode:'cpu', n:2, duo:false, names:[playerName()||'You','Test'], askName:null, unlockAll:true, budget:UNLIMITED, maxTeam:6});
  if(t.pre) t.pre();
  S.picks=[t.you.slice(), t.foe.slice()]; startBattle(); S.synShown=!t.syn;
  if(!t.keep){ S.teams[1].forEach((u,i)=>{ if(i===0) u.hp=1; u.pow=0; u.regen=0; u.revive=0; u.cd=9; u.spd=0; }); S.teams[0].forEach(u=>{ u.spd=99; }); }   // first enemy one hit from down, and harmless
  if(t.setup) t.setup();
  note(t.keep ? t.note : t.note+' Tap Attack on the enemy, then Fight.'); render();
}
// Test page: draft against a set enemy team with the same points it costs (every character open)
function htDraftTest(enemy, budget){
  const cost=budget||enemy.reduce((a,id)=>a+BYID[id].cost,0), fams=new Set(enemy.map(id=>BYID[id].fam));
  Object.assign(S,{mode:'cpu', n:2, duo:false, names:[playerName()||'You','Hantengu'], askName:null, unlockAll:true, maxTeam:6, bansOn:false, banning:false, bans:[], budget:cost, level:'normal', poolType:'all',
    phase:'draft', first:0, lastPicker:null, history:[], k:0, sel:null, picks:[[], enemy.slice()], locked:[false,true]});
  S.pool=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=cost && !fams.has(c.fam)).map(c=>c.id).sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name)).concat(dealHelpers());
}
setTimeout(koTest, 900);
function render(){
  if(isOnline()) S.planFor=S.me;
  const ctl=typeof isCtl==='function' && isCtl(), view = ctl ? ctlViewName() : viewName();   // a phone controlling the TV shows only its moves
  if(view==='over' && !scored && (S.tourMatch||S.tourRef)){ scored=true; if(typeof tourReport==='function') tourReport(); if(S.tourMatch) sfx(S.winner===0?'win':'lose'); }   // tournament matches report to the bracket and stay out of records and shared stats
  if(view==='over' && !scored && S.mode==='daily'){ scored=true; S.dailyMet=dailyMet(S.daily); if(S.dailyMet) markDaily(S.daily.day); sfx(S.dailyMet?'win':'lose'); }   // no stats
  if(view==='over' && !scored && gameMode()){ scored=true; gmRecord(S.winner===0); if(S.winner===0) track([`m_${S.mode}_win`]); sfx(S.winner===0?'win':'lose'); }   // no shared stats: these aren't fair matchups
  if(view==='over' && !scored && S.coop){ scored=true; track([`m_coop_${S.coop}_finish`]); if(coopWon()) track([`m_coop_${S.coop}_win`]); sfx(coopWon()?'win':'lose'); }   // no shared stats
  if(view==='over' && !scored && (isPractice() || S.mode==='story')){ scored=true;   // story and practice don't count toward stats
    if(S.winner!==0) sfx('lose'); }   // story wins are saved (and celebrated) before the ending scene
  if(view==='over' && !scored && isAsync()){ const g=myGame(S.asyncCode); if(g && g.scored===S.matchNo) scored=true; else setGame(S.asyncCode,{scored:S.matchNo}); }   // a reopened game isn't counted twice
  if(view==='plan' && S.round===1 && !matchOn){ matchOn=modeKey(); track([`m_${matchOn}_start`, `d_${trackDay()}_games`]); }
  if(view==='over' && matchOn){ track([`m_${matchOn}_finish`]); matchOn=null; ACTIONS.tipok('played'); }
  if(view==='setup') matchOn=null;
  if(view==='over' && !scored){ scored=true; postStats(statsGame()); if(S.winner>=0){ const sc=loadScore(); players().filter(q=>sameSide(q,S.winner)).forEach(q=>{ const n=S.names[q]; sc[n]=(sc[n]||0)+1; }); saveScore(sc); } recordMatch();
    sfx(S.winner<0 || (soloView() && !sameSide(S.winner,myP())) ? 'lose' : 'win'); }
  if(view!=='over') scored=false;
  // keep fold-out sections (How to play, records…) open across redraws
  const open=[...app.querySelectorAll('details[id]')].filter(d=>d.open).map(d=>d.id);
  document.body.classList.toggle('localmode', S.mode==='local');
  document.body.classList.toggle('home', view==='setup' && !S.tv);   // the About footer under the home screen
  // Until Dawn: a sun climbs over the battle screen as the rounds count down to sunrise (stage.sunrise)
  const st=S.mode==='story' && STAGES[S.stage], fighting=['plan','result','pass','scout','ready'].includes(view);
  // the sun climbs over the battle: Until Dawn (story) over its rounds; every other battle in the 4 rounds before
  // sunrise (round SUNRISE_ROUND), then it burns hotter each round after (--heat)
  const before=4, sky=fighting && !!S.teams && (st ? !!st.sunrise : S.round>sunRise()-before);
  document.body.classList.toggle('dawn', sky);
  document.body.classList.toggle('sunrisetheme', !!hashiraTitle());
  if(sky){ const n=st?st.twist.survive:before, from=st?1:sunRise()-before;
    document.body.style.setProperty('--dawn', Math.max(0, Math.min(1, (S.round-from)/(st?n-1:before))).toFixed(3));
    document.body.style.setProperty('--heat', st ? 0 : Math.max(0, Math.min(1, (S.round-sunRise())/4)).toFixed(3)); }
  // Story battles fight in front of the battle's place picture (img/places/, the same one as its cutscenes)
  const place=!ctl && ['plan','result','pass','scout','ready','over'].includes(view) && (st ? PLACE_ART[st.id]||PLACE_ART[st.arc] : S.place && PLACE_ART[S.place]);   // story: the battle's place; other modes: the match's (not on a TV controller: the TV shows it)
  document.body.classList.toggle('placebg', !!place);
  // Last stand: your final fighter under 25% gets a heartbeat and red edges while you choose
  { const me=S.teams && (S.planFor??S.me??0), mine=S.teams && S.teams[me] && alive(me); document.body.classList.toggle('laststand', view==='plan' && !!mine && mine.length===1 && mine[0].hp<=mine[0].max*.25); }
  if(view==='plan' && S.round===1 && S.teams && !S.synShown && !ctl){ if(S.mode!=='story' && !S.entShown && !S.trial){ S.entShown=true; S.synShown=true; entranceIntro(synergyIntro); } else synergyIntro(); }   // battle entrance first, then the synergy cut-ins   // the TV plays the synergy cut-ins, not the controller phone
  // TV controller: a clean phone screen (body.ctlmode), and a buzz + ding when it becomes this phone's turn to choose
  document.body.classList.toggle('ctlmode', !!ctl);
  if(ctl){ const mine=['plan','draft','spin','scout'].includes(view); if(mine && render.ctlWas!==view+S.round){ try{ navigator.vibrate&&navigator.vibrate([30,40,30]); }catch(e){} sfx('pick'); } render.ctlWas=mine?view+S.round:null; }
  if(place) document.body.style.setProperty('--placebg', `url('${place}')`);
  setWeather(place && (WEATHER[st ? (WEATHER[st.id]?st.id:st.arc) : S.place] || 'dust'));
  cloudCheck();   // back up saved progress a few seconds after it changes
  queueMicrotask(rosterKeep);
  music(ctl ? null : musicFor(view));   // the TV plays the music, not the controller phone   // each kind of screen has its own theme (cross-fades; nothing happens if it's already playing)   // wide landscape layout (tablets) for Local games
  const vids=new Map([...app.querySelectorAll('video[data-k],img[data-k]')].map(v=>[v.dataset.k,v]));   // a clip already playing keeps playing
  // reuse the picture elements already on screen: a redraw never has to decode them again, so nothing blinks
  const pics=new Map(); app.querySelectorAll('img:not([data-k])').forEach(im=>{ const k=im.getAttribute('src'); if(!pics.has(k)) pics.set(k,[]); pics.get(k).push(im); });
  // a pop-up redrawn as the same pop-up keeps its scroll (Settings' bug report sits at the bottom and jumped to the top on Send)
  const mIn=sheet.querySelector('.modal .in'), mKey=mIn&&mIn.getAttribute('aria-label'), mTop=mIn?mIn.scrollTop:0;
  // A screen that fails to draw shows a Reload card instead of a blank page, and is still reported (crashes in render were blanking the home screen)
  withReplay(()=>beforeAwake(()=>{ try{ app.innerHTML=VIEWS[view](); sheet.innerHTML=vSheet(); }
    catch(err){ app.innerHTML=`<div class="drawfail"><b>Something went wrong</b><span class="muted">Reloading usually fixes it. Your progress is safe.</span><button class="btn" onclick="location.reload()">Reload</button><button class="btn ghost" data-a="home">Home</button></div>`; sheet.innerHTML='';
      if(CRASHES<3 && !navigator.webdriver && !LOCAL_COPY && navigator.onLine){ CRASHES++; sendReport(`${err&&err.message||err} (render ${view})`, true).catch(()=>{}); } } }));
  { const n=sheet.querySelector('.modal .in'); if(n && mKey && n.getAttribute('aria-label')===mKey) n.scrollTop=mTop; }
  if(app.querySelector('.kolater')) setTimeout(()=>app.querySelectorAll('.kolater').forEach(e=>e.classList.remove('kolater')), quickMotion()?150:620);   // a special's knockout waits for the special to land
  app.querySelectorAll('img:not([data-k])').forEach(im=>{ const old=(pics.get(im.getAttribute('src'))||[]).shift(); if(old){ old.className=im.className; im.replaceWith(old); } });
  app.querySelectorAll('video[data-k],img[data-k]').forEach(v=>{ const old=vids.get(v.dataset.k); if(old){ v.replaceWith(old); if(old.tagName==='VIDEO') playVid(old); } else if(v.tagName==='VIDEO'){ v.onended=()=>{ if(v.duration<CLIP_LOOP){ v.currentTime=0; playVid(v); } }; playVid(v); } });
  warmClips();
  open.forEach(id=>{ const d=document.getElementById(id); if(d) d.open=true; });
  if(S.reveal){ S.reveal=false; const f=app.querySelector('.fighter.open'); if(f) requestAnimationFrame(()=>keepAboveBar(f)); }   // move screen: the fighter you're choosing for stays above the Lock bar
  if(view==='story' && S.storyScroll){ S.storyScroll=false; const el=app.querySelector('.srow.sel'); if(el) el.scrollIntoView({block:'center'}); else window.scrollTo(0,0); }
  if(!ctl && S.phase==='draft' && S.mode==='cpu' && turn()!==0){ clearTimeout(S._t); S._t=setTimeout(()=>{ if(S.banning) cpuBan(); else cpuDraftStep(S.level); render(); },700); }
  if(!ctl && S.phase==='spin' && S.spin && S.spin.state==='done' && S.spin.cards && spinShown!==S.spin.cards.join()){ spinShown=S.spin.cards.join(); sfx('ding'); }   // the number is revealed
  // online host: send each guest phone its own copy of the shared state (only when it changed)
  if(typeof tvPublish==='function'){ tvPublish(view); tvBadge(); }   // TV mode: keep the phone controller in step
  if(iAmHost() && ONLINE.net){ ONLINE.last=ONLINE.last||{};
    const seats = S.phase==='lobby' ? (S.lobby.seats||[]).map((x,i)=>x&&x.on?i+1:0).filter(Boolean) : others(S.me);
    seats.forEach(q=>{ const j=snapshotFor(q); if(j!==ONLINE.last[q]){ ONLINE.last[q]=j; ONLINE.net.publish(j,q); } }); }
}
// How long a playback line stays up: enough to read it, longer for long lines and knockouts
// Playback speed (Settings): Slow / Normal / Fast multiply how long each action stays up
const SPEEDS = {slow:1.4, normal:1, fast:.55};
function loadSpeed(){ try{ const v=localStorage.getItem('squad-draft-speed'); return v in SPEEDS ? v : 'normal' }catch(e){ return 'normal' } }
const pace = () => SPEEDS[S.speed]||1;
const readTime = line => quickMotion() ? 300 : (2200 + line.t.length*30 + (line.ko||line.spawn ? 1100 : 0) + (line.fx==='special' ? 500 : 0)) * pace();   // cut-ins stay up a bit longer
// a grouped special (several targets in one beat): longer for more targets and any knockouts
const groupTime = lines => quickMotion() ? 400 : (2400 + 450*lines.filter(l=>GROUP_FX.includes(l.fx)).length + (lines.some(l=>l.ko) ? 1100 : 0)) * pace();
// Move clips (js/clips.js): beats with a clip stay up at least this long; clips download when a battle starts
// Clips shorter than CLIP_LOOP seconds loop (instead of freezing on their last frame); longer ones keep the beat up
// until they finish (up to CLIP_MAX ms), since many build up to the strike at the very end.
const CLIP_MIN = 3600, CLIP_MAX = 6000, CLIP_FIRST_MAX = 12000, CLIP_LOOP = 2.2, CLIP_PENDING = new Set(), CLIP_DUR = {};
function warmClips(){
  if(S.clipsOn===false || !(S.teams||S.picks) || !navigator.onLine) return;
  matchSounds().forEach(warmSound);
  matchClips().forEach(url=>{ if(CLIP_BLOB[url] || CLIP_PENDING.has(url)) return; CLIP_PENDING.add(url);
    fetch(url).then(r=>r.ok?r.blob():Promise.reject()).then(b=>{ CLIP_BLOB[url]=URL.createObjectURL(b); if(clipIsPic(url)) return;
      const v=document.createElement('video'); v.preload='metadata'; v.muted=true; v.onloadedmetadata=()=>{ CLIP_DUR[url]=v.duration; v.removeAttribute('src'); v.load(); }; v.src=CLIP_BLOB[url];
    }).catch(()=>{}).finally(()=>CLIP_PENDING.delete(url)); });
}
// Play the round back one log line at a time. Knockouts buzz the phone (Android; iPhones don't allow vibration).
function playRound(){
  (S.replayLog=S.replayLog||[]).push({r:S.round, log:S.log, teams:JSON.parse(JSON.stringify(S.teams))});   // kept for Watch again (the teams as they are after this round)
  S.play={k:0, done:false, steps:playSteps(S.log)};
  const step=()=>{
    if(S.info || S.settings || S.quitAsk){ S._t=setTimeout(step,300); return; }   // paused while an info card, Settings or Quit is open
    if(S.play.k>=S.play.steps.length-1){ S.play.done=true; if(storyEnd() || storyMid()) return; render(); return; }
    S.play.k++; const [a,b]=S.play.steps[S.play.k], lines=S.log.slice(a,b+1), line=lines[0];
    S.play.quick=false; S.play.clip = b>a || quickMotion() ? null : clipStep(line);   // a move clip for this beat, if the fighter has one
    if(lines.some(l=>l.ko) && navigator.vibrate && S.vibeOn!==false) navigator.vibrate([90,50,160]);
    const flurry=b>a && line.move==='attack', special=fxName(lines,a), m=momentOf(lines,b,S.log[b]);
    const noise=()=>{ if(flurry) lines.forEach((l,i)=>setTimeout(()=>sfxForLine(l),i*280)); else if(b>a){ sfx('bighit'); if(lines.some(l=>l.ko)) setTimeout(()=>sfx('ko'),250); } else if(S.play.clip && S.play.clip.sound) clipSound(S.play.clip.sound); else sfxForLine(line); };
    if(special==='sunform'){ for(let i=0;i<13;i++) setTimeout(()=>sfx('slash'), 60+i*90); setTimeout(noise,1250); } else noise();   // Yoriichi: thirteen cuts, then they all land
    render();
    const extra=(special==='sunform'?1300:0)+(!m?0:m.k==='final'?600:m.k==='muzandeath'?1500:m.k==='lone'?500:0);
    const t = extra*pace() + (flurry ? (quickMotion()?400:(1300+320*lines.length)*pace()) : b>a ? groupTime(lines) : line.fx==='awaken' ? Math.max(readTime(line), 3600*pace()) : readTime(line));
    const c=S.play.clip, d=c&&CLIP_DUR[c.src], full=c&&c.first&&!clipIsPic(c.src) ? (!d ? CLIP_MAX : d>=CLIP_LOOP ? Math.min(CLIP_FIRST_MAX, d*1000+400) : CLIP_MIN*pace())   // first time: to the end, at any speed
      : d&&d>=CLIP_LOOP&&S.speed!=='fast' ? Math.min(CLIP_MAX, d*1000+400) : CLIP_MIN*pace();
    S._t=setTimeout(step, S.play.clip ? Math.max(t, full) : S.play.quick ? t*.55 : t);   // a clip beat stays up long enough to watch
  };
  sfx('gong'); clearTimeout(S._t); S._t=setTimeout(step, quickMotion() ? 250 : 1500*pace());   // the "Round N · Fight!" intro
}
// Watch the match again (CK, Nov 12, 2026): Highlights (specials, knockouts, awakenings, comebacks and the final blow) or
// a Full replay of every round. Each round's log and teams are kept by playRound(); the replay only swaps them in while
// drawing (withReplay), so the real match state never changes, even if an online update arrives meanwhile.
const HL_FX = ['special','ko','awaken','revive'];
function replaySeq(kind){
  const rl=S.replayLog||[], seq=[];
  rl.forEach((rd,i)=>{ const steps=playSteps(rd.log); let after=false;
    steps.forEach((st,k)=>{ if(!k){ if(kind==='full') seq.push([i,0]); return; }
      const ls=rd.log.slice(st[0],st[1]+1), big=ls.some(l=>HL_FX.includes(l.fx)||l.destiny);
      if(kind==='full' || big || after || (i===rl.length-1 && k===steps.length-1)) seq.push([i,k]);
      after = ls.some(l=>l.fx==='special'); }); });   // a special's announcement, then the hit it lands
  return seq;
}
function withReplay(fn){
  const R=S.replaying; if(!R || !R.cur) return fn();
  const keep={teams:S.teams, log:S.log, round:S.round, play:S.play, phase:S.phase, final:S.final, localOver:S.localOver};
  Object.assign(S,{teams:R.cur.teams, log:R.cur.log, round:R.cur.r, play:R.play, phase:'result', final:false, localOver:false});
  try{ return fn(); } finally { Object.assign(S,keep); }
}
function watchStart(kind){
  const seq=replaySeq(kind); if(!seq.length) return;
  clearTimeout(S._t); S.replaying={kind, seq, i:-1, paused:false, fast:false}; window.scrollTo(0,0); replayStep();
}
function replayStep(){
  const R=S.replaying; if(!R || R.paused) return; clearTimeout(R.t);
  if(S.info || S.settings || S.quitAsk){ R.t=setTimeout(replayStep,300); return; }
  if(++R.i>=R.seq.length) return watchEnd();
  const [ri,k]=R.seq[R.i], rd=S.replayLog[ri], steps=playSteps(rd.log);
  // which round this is, and how many quiet rounds the highlights jumped over to get here (CK, Nov 12, 2026)
  const prev=R.i>0 ? S.replayLog[R.seq[R.i-1][0]] : null;
  R.newRound = !prev || prev!==rd ? {skipped: prev ? rd.r-prev.r-1 : rd.r-1, at:Date.now()} : R.newRound;
  R.cur=rd; R.play={k, steps, done:false, clip:null};
  let t=1500*pace();
  withReplay(()=>{ if(!k){ sfx('gong'); return; }
    const [a,b]=steps[k], lines=rd.log.slice(a,b+1), line=lines[0];
    R.play.clip = b>a || quickMotion() ? null : clipStep(line);
    if(b>a){ sfx('bighit'); if(lines.some(l=>l.ko)) setTimeout(()=>sfx('ko'),250); } else if(R.play.clip && R.play.clip.sound) clipSound(R.play.clip.sound); else sfxForLine(line);
    t = b>a ? groupTime(lines) : line.fx==='awaken' ? Math.max(readTime(line), 3600*pace()) : readTime(line);
    if(R.play.clip) t=Math.max(t, CLIP_MIN*pace()); });
  render(); R.t=setTimeout(replayStep, R.fast ? t*.5 : t);
}
function watchEnd(){ const R=S.replaying; if(!R) return; clearTimeout(R.t); S.replaying=null; render(); window.scrollTo(0,0); }
// Start a Local or Quickplay match with the mode's settings: names from the boxes (computers get demon names)
// Story: when the last round has played out, go straight on (the ending scene after a win, the defeat screen after
// a loss) instead of stopping on a "See who won" button. Returns true if it moved on.
// Story: a Mark awakened this round, so its short cutscene plays now, then the next round starts
function storyMid(){
  if(S.mode!=='story' || S.final || !(S.midScene&&S.midScene.length)) return false;
  clearTimeout(S._t); S._t=setTimeout(()=>{ Object.assign(S,{phase:'scene', sceneMid:true, sceneOutro:false, sceneVs:false, sceneUnlock:false, sceneAt:0}); midAwake(); sfx('unlock'); render(); }, quickMotion()?0:900);
  return true;
}
// The fighter awakens as their awakening line comes up in the cutscene (its speaker is the card they become)
function midAwake(){ const l=sceneLines()[S.sceneAt]; if(S.sceneMid && l && (l[2]||{}).awaken) applyAwakenings(l[0]); }
function toCredits(){ S.sceneFinale=false; S.creditsDone=false; S.phase='credits'; sfx('win'); window.scrollTo(0,0); }
function midDone(){ applyAwakenings(); S.sceneMid=false; S.midScene=null; S.phase='result'; ACTIONS.next(); }   // skipped scenes still awaken
function storyEnd(){
  if(S.mode!=='story' || !S.final) return false;
  clearTimeout(S._t); S._t=setTimeout(()=>{ ACTIONS.finish(); render(); }, quickMotion()?0:700);
  return true;
}
function startDraft(){
  const c=useModeCfg(), field=i=>{ const el=document.getElementById('n'+i); return el&&el.value.trim(); };
  if(S.mode==='local'){ S.names=Array.from({length:c.players},(_,i)=>field(i)||`Player ${i+1}`); saveNames(S.names.concat(localNames().slice(S.names.length))); }
  else { S.names=[field(0)||S.names[0]||'Player 1', ...CPU_NAMES.slice(0,c.players-1)]; if(S.duo) S.names[2]='Rengoku AI'; }   // 2v2: your ally is a slayer
  S.n=c.players;
  if(isPractice()) return newDraft(0);   // Practice: you pick for everyone, so there's no wheel
  toSpin();
}
// The next player (after p) who still has fighters, or -1
const nextChooser = p => { for(let q=p+1;q<nPlayers();q++) if(alive(q).length) return q; return -1; };
function toSpin(){ S.phase='spin'; S.spin=newGuess(); S.tvLocked={}; window.scrollTo(0,0); }   // who picks first: the number game
// After a fighter's move is complete, open the next one that still needs a move
// Scroll a fighter's move buttons into view above the sticky Lock bar (iPhones: with 6 fighters the bar covered them)
function keepAboveBar(el){
  const bar=app.querySelector('.actionbar'), limit=Math.min(innerHeight, bar ? bar.getBoundingClientRect().top : innerHeight) - 10;
  const r=el.getBoundingClientRect(), top=60;   // 60: clear of the status bar and the top of the page
  if(r.bottom>limit) window.scrollBy({top:Math.min(r.bottom-limit, r.top-top), behavior:quickMotion()?'auto':'smooth'});
  else if(r.top<top) window.scrollBy({top:r.top-top, behavior:quickMotion()?'auto':'smooth'});
}
function advanceFocus(p){ const n=alive(p).find(u=>!u.stun && !unitReady(u)); S.focus = n ? n.uid : 'none'; }
function newPlanTurn(){ S.focus=null; S.info=null; window.scrollTo(0,0); }
// A story win: save it, remember what it unlocks (first win only), then play the ending scene before the results
function storyWon_(){
  const st=STAGES[S.stage], id=st.id; S.newUnlocks = loadStory().cleared.includes(id) ? [] : STAGE_UNLOCKS[id]; saveStoryClear(id);
  S.goalsNow=goalsMet(st); S.starsGot=S.goalsNow.filter(Boolean).length; S.starsBest=stageStars(id); if(starsOn()) saveStars(id,S.goalsNow);
  Object.assign(S,{phase:'scene', sceneOutro:true, sceneUnlock:false, sceneVs:false, sceneAt:0, sceneInstant:false, sceneShownAt:Date.now()}); sfx('win');
}
// After the ending scene: the stars earned (and any unlocks), then the results screen
function afterOutro(){ if(!S.sceneUnlock){ S.sceneUnlock=true; S.unlockAt=0; sfx('unlock'); return; } S.sceneOutro=false; S.sceneUnlock=false; S.phase='over'; window.scrollTo(0,0); }
// After both sides lock in: give each crow owner their report (and a chance to re-plan), then fight
function nextScoutOrFight(){
  S.scouting=false;
  if(S.scoutQueue.length){
    S.scoutP=S.scoutQueue.shift(); S.planFor=S.scoutP;
    if(vsCpu() || S.tvDuo) S.phase='scout'; else { S.phase='pass'; S.passScout=true; }   // TV 2-player: the report goes to the owner's phone
    return newPlanTurn();
  }
  S.passScout=false;
  if(vsCpu() || S.tvDuo) fight(); else S.phase='ready';
  newPlanTurn();
}
// Run the round, then play it back (a finished match still plays back first, then "See who won")
function fight(){ S.info=null; resolve(); S.final = S.phase==='over'; S.phase='result'; playRound(); }

// Change one of the selected mode's match settings (saved per mode)
function setCfg(k,v){ const c=loadModeCfg(S.mode); c[k]=v; saveModeCfg(S.mode,c); useModeCfg(); }
const keepNames = () => { const n0=document.getElementById('n0'); if(n0 && n0.value.trim()){ S.names[0]=n0.value.trim(); if(S.mode!=='local') savePlayerName(S.names[0]); }   // your name box on a mode page is your name
  if(S.mode==='local'){ const ns=localNames(); for(let i=0;i<4;i++){ const el=document.getElementById('n'+i); if(el) ns[i]=el.value.trim()||ns[i]; } saveNames(ns); } };
// Copy text (battle log, round log) and show "Copied ✓" for a moment; older browsers get the hidden-textarea way
function copyText(t){
  const done=()=>{ S.logCopied=true; render(); setTimeout(()=>{ S.logCopied=false; render(); },1600); };
  const old=()=>{ const a=document.createElement('textarea'); a.value=t; a.setAttribute('readonly',''); a.style.position='fixed'; a.style.opacity='0'; document.body.appendChild(a); a.select(); try{ document.execCommand('copy'); done(); }catch(e){} a.remove(); };
  try{ navigator.clipboard.writeText(t).then(done, old); }catch(e){ old(); }
}
const ACTIONS = {
  mode(v){ keepNames(); S.mode=v; S.joinOpen=false; S.onlineMsg=''; useModeCfg(v); if(v==='local') S.names=localNames(); },
  // a mode card on the home screen: Story goes straight to the map, the others open their settings page
  openmode(v){ ACTIONS.mode(v); if(v==='story') return ACTIONS.storymap(); S.phase='modeset'; window.scrollTo(0,0); },
  cfgplayers(v){ keepNames(); setCfg('players',+v); },
  cfgbudget(v){ keepNames(); setCfg('budget',+v); },
  cfgpool(v){ keepNames(); setCfg('poolType',v); },
  cfglevel(v){ keepNames(); setCfg('level',v); },
  cfgmax(v){ keepNames(); setCfg('maxTeam',+v); },
  cfgbans(v){ keepNames(); setCfg('bans',v==='on'); },
  cfgduo(v){ keepNames(); setCfg('duo',v==='on'); },
  start: startDraft,
  home(){ setCampaign('main'); if(isAsync() && S.final && S.asyncCode) leaveFinished(S.asyncCode, S.me); S.tourMatch=null; S.tourRef=null; if(UPDATE_READY) return reloadQuiet(); clearTimeout(S._t); clearTimeout(HANDOFF); HANDOFF=null; if(ONLINE.net){ ONLINE.net.leave(); ONLINE.net=null; ONLINE.last=null; ONLINE.offActs=ONLINE.offState=null; }
    if(S.ctl) ctlStop();
    const tv=S.tv, mode=S.mode==='daily'||gameMode()?'cpu':S.mode; S={tv, phase:tv?'tvhome':'setup',mode,vol:S.vol,speed:S.speed,vibeOn:S.vibeOn,clipsOn:S.clipsOn,clipRepeat:S.clipRepeat,tauntsOn:S.tauntsOn,install:S.install,names:mode==='local'?localNames():[S.names[S.me||0]||S.names[0]]}; useModeCfg(mode); },
  clips(v){ S.clipsOn=v==='on'; try{ localStorage.setItem('squad-draft-clips',v) }catch(e){} },
  cliprepeat(v){ S.clipRepeat=v; try{ localStorage.setItem('squad-draft-clip-repeat',v) }catch(e){} },
  vibe(v){ S.vibeOn=v==='on'; try{ localStorage.setItem('squad-draft-vibe',v) }catch(e){} },
  gamemode(v){ gmStart(v); window.scrollTo(0,0); },
  nextfight(){ gmNext(); window.scrollTo(0,0); },
  qpmode(v){ keepNames(); S.qpClassic=v==='classic'; window.scrollTo(0,0); },   // Quickplay: choose the kind of game first, so no settings get thrown away
  finalfight(){ S.phase='plan'; },
  rematch(){ if(isOnline()) return onlineRematch(); if(gameMode()) return gmAgain(); if(isPractice()) return newDraft(0); toSpin(); },
  // who picks first: take a number (a phone controlling a TV sends it; online the host applies it; vs the computer it
  // answers straight after you)
  guess(v){ if(typeof isCtl==='function' && isCtl()) return ctlSend({a:'guess', n:+v});
    if(isOnline()) return onlineGuess(+v);
    const p = S.mode==='cpu' ? 0 : guessTurn(); if(p<0 || !guessPick(p,+v)) return; sfx('pick');
    if(S.mode==='cpu') others(0).forEach(q=>cpuGuess(q)); },
  // a tie in the number game: call the coin
  coincall(v){ if(typeof isCtl==='function' && isCtl()) return ctlSend({a:'coin', v}); if(isOnline()) return onlineCoin(v); const g=S.spin; if(!g || g.state!=='coin') return; if(guessCall(S.mode==='cpu'?0:g.tied.who[0],v)) sfx('pick'); },
  toDraft(){ if(isAsync()) return send({a:'todraft'}); if(isOnline() && !iAmHost()) return; if(!S.spin || S.spin.state!=='done') return; newDraft(S.spin.r); },
  askquit(){ S.quitAsk=true; },
  unquit(){ S.quitAsk=false; },
  redeal(){ if(typeof isCtl==='function' && isCtl()) return ctlSend({a:'redeal'}); if(isOnline() && !iAmHost()) return; S.pool=buildPool(); S.sel=null; },
  onew(){ onlineCreate(); },
  shareroom(){ shareInvite(); },
  kick(v){ if(iAmHost() && S.phase==='lobby') ONLINE.net.kick(+v); },
  ocreate(){ onlineCreate(); },
  // TV mode (js/tv.js): this laptop shows the game on the big screen; a phone joins its code as the controller
  tvstart(){ tvStart(); },
  tvexit(){ tvStop(); tvFit(); ACTIONS.home(); },
  tvfull(){ tvFullscreen(); },
  tvmouse(v){ tvMouse(v); },
  tvcfgbudget(v){ tvCfgSet('budget',v); }, tvcfgpool(v){ tvCfgSet('poolType',v); }, tvcfglevel(v){ tvCfgSet('level',v); },   // the TV lobby's match settings, from the laptop or a phone
  tvchoose(v){ tvChoose(v); },                          // a mode on the TV's lobby, picked on the laptop
  tvjoinopen(){ S.tvJoinOpen=!S.tvJoinOpen; S.tvJoinMsg=''; setTimeout(()=>{ const el=document.getElementById('tvcode'); if(el) el.focus(); }); },
  tvjoin(){ tvJoinCode(); },                           // pick this round's moves on the laptop instead of a phone
  ctlnext(){ ctlNext(); },
  ctlpick(v){ ctlSend({a:'choose', key:v}); },          // a choice on the phone: Story map, Next battle, Rematch…
  ctlstage(v,b){ ctlSend({a:'stage', i:+v, draft:b.dataset.d==='1'}); },   // a story battle picked on the phone
  ctlexit(){ ctlStop(); ACTIONS.home(); },
  agame(v){ keepNames(); openGame(v); },
  agamex(v){ const g=myGame(v), st=g&&g.meta; if(st && !st.final && st.phase!=='lobby' && !confirm('Remove this game? It can’t be finished after that.')) return;
    const f=GAME_WATCH[v]; if(f){ f(); delete GAME_WATCH[v]; } if(g && g.qm && st && st.phase==='lobby') quickCancel(v); dropGame(v); gamesBadge(); },
  oquick(){ keepNames(); quickMatch(); },
  movesite(){ moveSite(); },
  pushall(){ pushSet('all',true); },
  pushqmno(){ S.qmWait=false; },
  pushno(){ pushSave({...pushState(), declined:true}); },
  pushdaily(v){ pushSet('daily',v==='on'); },
  pushturns(v){ pushSet('turns',v==='on'); },
  pushping(v){ pushSet('ping',v==='on'); },
  cfggm(v){ keepNames(); setCfg('gm',v); },
  taunt(v){ sendTaunt(v); },
  tauntopen(){ S.tauntOpen=!S.tauntOpen; },
  taunts(v){ S.tauntsOn=v==='on'; try{ localStorage.setItem('squad-draft-taunts',v) }catch(e){} },
  ojoin(){ onlineJoin(); },
  ojoinopen(){ S.names[0]=myName(); S.joinOpen=!S.joinOpen; S.onlineMsg=''; setTimeout(()=>{ const el=document.getElementById('ocode'); if(el) el.focus(); }); },
  ostart(){ if(iAmHost() && hostStartMatch()) startRoom(); },
  // open a card's detail (from the grid or from a name in a pool note); any card in the pool can be viewed
  sel(v){ if(S.mode==='cpu' && turn()!==0) return;
    if(S.pool.includes(v) || ((S.mode==='daily'||S.mode==='story') && S.picks[1].includes(v))) S.sel=v; },   // the set enemy team can be studied
  unsel(){ S.sel=null; S.info=null; S.settings=false; S.codexSel=null; if(S.codexHome){ S.codexHome=false; S.phase='setup'; } },
  settings(){ S.settings=true; },
  // Your name (Settings, or the home screen's one-time question): saved on this phone and used straight away
  savename(v){ const el=document.getElementById(v), n=el&&el.value.trim(); if(!n) return; savePlayerName(n); S.names[0]=playerName();
    const ns=loadNames(); if(ns && (ns[0]==='CK'||!ns[0])){ ns[0]=playerName(); saveNames(ns); }
    if(S.askName) return nameGo();
    S.nameSaved=true; setTimeout(()=>{ S.nameSaved=false; render(); },1500); },
  nameskip(){ NAME_SKIPPED=true; nameGo(); },
  reportopen(){ S.reportOpen=!S.reportOpen; S.reportMsg=''; },
  reportsend(){ const el=document.getElementById('reportbox'), msg=el&&el.value.trim(); if(!msg) return;
    S.reportText=msg; S.reportMsg='Sending…';
    sendReport(msg).then(()=>{ S.reportText=''; S.reportOpen=false; S.reportMsg='Sent. Thank you!'; }).catch(()=>{ S.reportMsg='That didn’t send. Check your connection and try again.'; })
      .finally(()=>{ render(); const m=document.getElementById('reportmsg'); if(m) m.scrollIntoView({block:'nearest'}); }); },   // keep "Sent" in view
  quit(v){ S.settings=false; S.quitAsk=false; S.play=null; clearTimeout(S._t); if(v==='map') ACTIONS.storymap(); else ACTIONS.home(); window.scrollTo(0,0); },   // story: leave a battle from Settings
  placecfg(v){ try{ localStorage.setItem(PLACE_KEY,v) }catch(e){} },   // Settings → Battle background
  settab(v){ S.setTab=v; if(v==='stats') loadGlobalStats(); },
  theirs(){ S.showTheirs=!S.showTheirs; },
  install(){ if(INSTALL_EVENT){ INSTALL_EVENT.prompt(); INSTALL_EVENT.userChoice.finally(()=>{ INSTALL_EVENT=null; installInfo(); render(); }); } },
  installlater(){ INSTALL_LATER=true; },
  backupnow(){ cloudBackup(true); },
  restore(){ cloudRestore(); },
  copycode(){ const c=showCode(loadCloud().code); try{ navigator.clipboard.writeText(c); S.copied=true; setTimeout(()=>{ S.copied=false; render(); },1500); }catch(e){} },
  copyround(){ const ml=S.matchLog||[]; if(ml.length) copyText(roundText(ml[ml.length-1])); },
  copylog(){ copyText(battleLogText()); },
  tipok(v){ try{ const t=JSON.parse(localStorage.getItem(TIPS_KEY))||[]; t.push(v); localStorage.setItem(TIPS_KEY,JSON.stringify([...new Set(t)])); }catch(e){} },
  codex(){ keepNames(); S.phase='codex'; S.codexSel=null; S.codexHome=false; window.scrollTo(0,0); },
  codexf(v){ S.codexF=v; },
  codexsel(v){ S.codexSel=v; },
  qrmine(){ qrMine(); },   // laptop sides: the QR with this computer's progress
  codexopen(v){ keepNames(); S.phase='codex'; S.codexSel=v; S.codexHome=true; window.scrollTo(0,0); },   // from the home roster: closing the card goes back home
  daily(){ keepNames(); clearTimeout(S._t); S.play=null; S.final=false; startDaily(); window.scrollTo(0,0); },
  info(v){ S.info=v; },
  fight(){ fight(); newPlanTurn(); },
  notes(){ S.notesOpen=!S.notesOpen; },
  confirmPick(){ if(typeof isCtl==='function' && isCtl()){ ctlSend({a:'pick', id:S.sel}); S.sel=null; return; }   // controller: the TV makes the pick
    if(S.banning){ if(isOnline()) return onlineBan(S.sel); if(canBan(turn(),S.sel)){ sfx('pick'); doBan(S.sel); } return; }
    if(isOnline()){ sfx('pick'); onlinePick(S.sel); S.sel=null; return; } if(!canPick(turn(),S.sel)) return; sfx('pick'); doPick(S.sel); if(S.phase!=='draft') newPlanTurn(); },
  undo(){ if(typeof isCtl==='function' && isCtl()) return ctlSend({a:'undo'}); if(isOnline()) return onlineUndo(); undoPick(); },
  repeat(){ repeatPlans(S.planFor); advanceFocus(S.planFor); },
  speed(v){ S.speed=v; try{ localStorage.setItem('squad-draft-speed',v) }catch(e){} },
  nextsong(){ nextSong(); },
  volmusic(v){ S.vol={...S.vol, music:+v}; saveVolumes(S.vol); applyVolumes(); },
  volsfx(v){ S.vol={...S.vol, sfx:+v}; saveVolumes(S.vol); applyVolumes(); sfx('pick'); },
  storymap(){ keepNames(); clearTimeout(S._t); S.mode='story'; S.phase='story'; S.storySel=nextStage(); S.storyScroll=true; mapAdvance(); },
  campaign(v){ setCampaign(v); S.storySel=nextStage(); S.storyScroll=true; window.scrollTo(0,0); },
  dreamstart(){ setCampaign('dream'); ACTIONS.storymap(); },
  orderpick(v){ S.waveOrder=S.waveOrder||[]; const i=S.waveOrder.indexOf(v); if(i>=0) S.waveOrder.splice(i,1); else S.waveOrder.push(v); },
  orderstart(){ const st=STAGES[S.stage], o=S.waveOrder||[]; S.waveOrder=[...o, ...st.mine.filter(id=>!o.includes(id))]; beginStage(); window.scrollTo(0,0); },
  ceremony(){ S.phase='ceremony'; S.title=null; window.scrollTo(0,0); },
  titlepick(v){ S.title=v; },
  titlesave(){ if(!S.title) return; saveHashiraTitle(S.title); S.titleDone=true; sfx('win'); },
  cfgdemon(v){ keepNames(); setCfg('demonSide',v==='on'); },
  storysel(v){ S.storySel = S.storySel===+v ? -1 : +v; },
  stage(v){ if(!stageUnlocked(+v)) return; startStage(+v); S.sceneShownAt=Date.now(); S.sceneInstant=false; window.scrollTo(0,0); },
  stagedraft(v){ if(!stageCleared(+v)) return; startStage(+v,true); S.sceneShownAt=Date.now(); S.sceneInstant=false; window.scrollTo(0,0); },
  // the story's finale (win screen of the last battle): a long scene, then the end credits
  finale(){ clearTimeout(S._t); Object.assign(S,{phase:'scene', sceneFinale:true, sceneOutro:false, sceneMid:false, sceneUnlock:false, sceneVs:false, sceneAt:0, sceneInstant:false, sceneShownAt:Date.now()}); sfx('page'); window.scrollTo(0,0); },
  creditsend(){ S.creditsDone=true; },
  scenenext(){ if(S.sceneVs) return;
    if(S.sceneUnlock){ if((S.unlockAt||0)+1<(S.newUnlocks||[]).length){ S.unlockAt=(S.unlockAt||0)+1; sfx('unlock'); return; } return afterOutro(); }   // unlocks one at a time
    if(S.sceneAt+1<sceneLines().length){ S.sceneAt++; S.sceneInstant=false; S.sceneShownAt=Date.now(); midAwake(); sfx(((sceneLines()[S.sceneAt]||[])[2]||{}).awaken?'cutin':'page'); return; }
    if(S.sceneMid) return midDone();
    if(S.sceneFinale) return toCredits();
   
    if(S.sceneOutro) return afterOutro();
    S.sceneVs=true; sfx('vs'); },
  sceneskip(){ if(S.sceneFinale) return toCredits(); if(S.sceneMid) return midDone(); if(S.sceneUnlock){ S.unlockAt=(S.newUnlocks||[]).length; return afterOutro(); } if(S.sceneOutro) return afterOutro();
    if(!S.sceneVs){ S.sceneVs=true; return; } beginStage(); if(S.phase==='plan') newPlanTurn(); window.scrollTo(0,0); },
  lock(){ if(typeof isCtl==='function' && isCtl()) return ctlSend({a:'lockteam'}); if(isOnline()) return onlineLockTeam(); doLock(turn()); if(S.phase!=='draft') newPlanTurn(); },
  reveal(){ S.phase=S.passScout?'scout':'plan'; newPlanTurn(); },
  helper(v){ const l=S.helperPlan[S.planFor]; S.helperPlan[S.planFor]=l.includes(v)?l.filter(x=>x!==v):l.concat(v); },
  ambush(v){ S.plans[S.planFor].ambush=v; },   // Kiriya's trap: which of your fighters it goes around
  rescout(){ if(typeof isCtl==='function' && isCtl()) return ctlRescout(); if(isOnline()){ S.scouting=true; S.planFor=S.me; newPlanTurn(); const f=alive(S.me).find(u=>!u.stun); if(f) S.focus=f.uid; return; } S.scouting=true; S.planFor=S.scoutP; S.phase='plan'; S.passScout=false; newPlanTurn(); const f=alive(S.planFor).find(u=>!u.stun); if(f) S.focus=f.uid; },   // open the first fighter to change
  keepmoves(){ if(typeof isCtl==='function' && isCtl()) return ctlKeep(); if(isOnline()) return onlineKeepMoves(); nextScoutOrFight(); },
  focus(v){ S.focus = focusOf(S.planFor)===v ? 'none' : v; S.reveal=true; },
  act(v,b){ const u=findU(b.dataset.u); setMove(u,v); if(unitReady(u)) advanceFocus(u.p); S.reveal=true; },
  spot(v,b){ const u=findU(b.dataset.u); S.plans[u.p][u.uid].spot=+v; advanceFocus(u.p); S.reveal=true; },   // Hantengu H: the hiding place a hunter checks
  tgt(v,b){ const u=findU(b.dataset.u); S.plans[u.p][u.uid].t=v; advanceFocus(u.p); S.reveal=true; },
  lockMoves(){
    if(typeof isCtl==='function' && isCtl()) return ctlLock();   // controller: send the picks to the TV
    if(isOnline()){ onlineLockMoves(); return newPlanTurn(); }
    if(S.tvDuo){ tvSeatLock(S.planFor); return newPlanTurn(); }   // TV 2-player: a phone dropped out and the laptop picked for it
    S.lastPlans[S.planFor]=JSON.parse(JSON.stringify(S.plans[S.planFor]));   // for "Repeat last round"
    if(S.scouting) return nextScoutOrFight();          // re-planned after a crow report
    if(vsCpu()){
      others(0).filter(q=>alive(q).length).forEach(q=>{ cpuPlan(q, S.mode==='story'?stageLevel():S.level); cpuHelpers(q); });
      others(0).forEach(q=>{ if(S.helperPlan[q].includes('crow')) cpuScout(q); });   // a computer's crow sees everyone's moves
      S.scoutQueue=S.helperPlan[0].includes('crow')?[0]:[];
      return nextScoutOrFight();
    }
    const nx=nextChooser(S.planFor);   // local: hand the phone to the next player still in the fight
    if(nx>=0){ S.planFor=nx; S.phase='pass'; return newPlanTurn(); }
    S.scoutQueue=players().filter(p=>alive(p).length && S.helperPlan[p].includes('crow'));   // each crow owner gets a private report
    nextScoutOrFight();
  },
  skip(){ clearTimeout(S._t); S.play.done=true; if(!storyEnd()) storyMid(); },   // skipping still plays a Mark awakening's cutscene
  watch(v){ watchStart(v); },
  rpause(){ const R=S.replaying; if(!R) return; R.paused=!R.paused; if(R.paused) clearTimeout(R.t); else replayStep(); },
  rfast(){ if(S.replaying) S.replaying.fast=!S.replaying.fast; },
  rnext(){ const R=S.replaying; if(!R) return; const ri=R.seq[R.i]&&R.seq[R.i][0]; let j=R.i; while(j+1<R.seq.length && R.seq[j+1][0]===ri) j++; R.i=j; R.paused=false; replayStep(); },
  rexit(){ watchEnd(); },
  next(){ if(storyMid()) return; if(isAsync()) return asyncWatched(); if(isOnline()){ onlineNext(); return window.scrollTo(0,0); } S.round++; S.planFor=S.mode==='local'?nextChooser(-1):0; S.play=null; S.phase=S.mode==='local'&&!S.tvDuo?'pass':'plan'; newPlanTurn(); },
  finish(){ if(isAsync()) setGame(S.asyncCode,{seen:{m:S.matchNo, r:S.roundId}}); if(isOnline()){ S.asyncWatching=false; S.localOver=true; return window.scrollTo(0,0); } S.play=null;
    if(S.mode==='story' && S.winner===0) return storyWon_();   // ending scene and unlocks first
    S.phase='over'; window.scrollTo(0,0); },
};
// Opening splash: "a Kwow Media Productions game" with its sting, then the home screen (CK). Phones only allow sound
// inside a tap, so it waits for one ("Tap to start"); shown once each time the game is opened. ?nosplash skips it.
(function splash(){
  const el=document.getElementById('splash'); if(!el) return;
  let quiet=false; try{ quiet=sessionStorage.getItem('squad-draft-quiet')==='1'; sessionStorage.removeItem('squad-draft-quiet'); }catch(e){}
  if(quiet || /[?&]test=/.test(location.search) || /nosplash/.test(location.search) || navigator.webdriver){ el.remove(); return; }   // quiet: the game just reloaded itself for an update
  let gone=false;
  const go=()=>{ if(gone) return; gone=true; unlockSound(); sfx('intro'); el.classList.add('go');
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>{ el.remove(); if(UPDATE_READY && S.phase==='setup') reloadQuiet(); }, 700); }, quickMotion()?300:2400); };   // an update that arrived during the splash applies once it's gone
  el.addEventListener('click', go); el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' ') go(); });
})();
// Wake audio on any touch or key, not only button taps (phones only allow it inside a tap; see unlockSound)
['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev, unlockSound, {passive:true}));
// coming back to the game after switching apps or locking the phone: try to wake audio straight away too
// Sound stays in the game (CK): leaving it silences everything, and coming back picks up where it left off
const hushSound = () => { try{ if(AC && AC.state==='running') AC.suspend(); }catch(e){} };
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) hushSound(); else if(AC && AC.state!=='running') try{ AC.resume(); }catch(e){} });
window.addEventListener('pagehide', hushSound);
// A new player is asked their name when they first start something, not before they've seen the game
let NAME_SKIPPED=false;
const nameGo = () => { const [a,v]=S.askName; S.askName=null; ACTIONS[a](v); };
document.addEventListener('click',e=>{
  unlockSound();   // phones only allow sound after a tap
  const b=e.target.closest('[data-a]'); if(!b||b.disabled) return;
  const fn=ACTIONS[b.dataset.a]; if(!fn) return;
  if(['storymap','daily','gamemode','openmode'].includes(b.dataset.a) && S.phase==='setup' && !playerName() && !NAME_SKIPPED && !(typeof isTV==='function'&&isTV())){
    S.askName=[b.dataset.a,b.dataset.v]; render(); const el=document.getElementById('hname'); if(el) el.focus(); return; }
  fn(b.dataset.v,b); render();
});
// Dropdowns in Settings
document.addEventListener('change',e=>{ const fn=e.target.dataset&&ACTIONS[e.target.dataset.change]; if(fn){ fn(e.target.value); render(); } });
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && (S.sel||S.info||S.settings||S.quitAsk||S.askName)){ S.askName=null; S.sel=null; S.info=null; S.settings=false; S.quitAsk=false; render(); } });

// Character pictures: for each card look for img/<id>.jpg (or .png / .webp). A Mark card without its own picture
// borrows its base character's (giyu_mark → giyu); other versions borrow too (tengen_retired → tengen). No picture: kanji.
// Pictures that aren't a card's own: Mark Tanjiro in the Selfless State, and in the Transparent World while he strikes from it. (Rengoku's bloodied last smile is only in
// his ending cutscene, scenes/rengoku-heart.jpg, not on his card: CK, Oct 28, 2026)
const EXTRA_ART = ['tanjiro_selfless','tanjiro_transparent','genya_demon'];
const ART_KEEP = [];   // holding the loaded pictures keeps them decoded, so redraws don't blink on phones
// The online clock: see online.js. Runs while everyone's there; whoever sees time run out acts, and the game ignores repeats.
const CLOCK = {key:'', at:0, sent:false};
function clockTick(){
  const el=document.getElementById('otimer'); if(!el) return;
  const on=isOnline() && !S.ctl && (!isAsync() || S.oppHere) && !S.final, watch=on && S.phase==='result';
  const key=watch ? 'r'+(S.roundId||0) : on ? clockKey() : '';
  if(key!==CLOCK.key){ CLOCK.key=key; CLOCK.at=Date.now(); CLOCK.sent=false; }
  // not counting while the synergy cut-ins are up, or while the round is still playing back (CK, Nov 3, 2026)
  const paused=document.querySelector('.synreel') || (watch && S.play && !S.play.done) || S.phase==='scene';
  if(paused){ CLOCK.at=Date.now(); el.hidden=true; return; }
  if(!key){ el.hidden=true; return; }
  const limit=CLOCK_LIMIT[key[0]], left=Math.max(0, Math.ceil(limit-(Date.now()-CLOCK.at)/1000));
  el.hidden=false; el.textContent=`⏱ ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`; el.classList.toggle('low', left<=15);
  if(left>0 || CLOCK.sent) return;
  if(watch && (isAsync() ? !S.asyncWatching : S.readyNext && S.readyNext[S.me])) return;
  CLOCK.sent=true;
  if(watch){ clearTimeout(S._t); if(S.play) S.play.done=true; ACTIONS.next(); return render(); }
  if(isAsync()) send({a:'timeout', key}); else if(iAmHost()){ timeoutRun(); render(); }
}
if(typeof document!=='undefined'){ const t=document.createElement('div'); t.id='otimer'; t.hidden=true; document.body.append(t); setInterval(clockTick,1000); }
// Which pictures exist comes from js/art-list.js (tools/make-art-list.js), so nothing is guessed. Portraits are loaded and decoded
// up front so redraws never blink; places and scene pictures load only when they're shown.
const artFile = (dir, name) => { const f=((typeof ART_FILES!=='undefined'&&ART_FILES[dir])||[]).find(x=>x.replace(/\.[^.]+$/,'')===name); if(!f) return null; const p=`img/${dir==='img'?'':dir+'/'}${f}`; return typeof document!=='undefined' ? new URL(p, document.baseURI).href : p; };   // full address: a CSS variable would read a short path from css/
function findArt(){
  const found={}, ids=ROSTER.map(c=>c.id).concat(EXTRA_ART).filter(id=>artFile('img',id));
  ids.forEach(id=>{ const im=new Image(); found[id]=im.src=artFile('img',id); ART_KEEP.push(im); if(im.decode) im.decode().catch(()=>{}); });
  ROSTER.forEach(c=>{ const src=found[c.id]||(c.art&&found[c.art])||found[c.id.replace(/_mark$/,'')]||found[c.fam]; if(src) ART[c.id]=src; });
  EXTRA_ART.forEach(id=>{ if(found[id]) ART[id]=found[id]; });
}
function findPlaces(){ [...ALL_STAGES.map(st=>st.id), ...Object.keys(ARCS)].forEach(arc=>{ const f=artFile('places',arc); if(f) PLACE_ART[arc]=f; }); }
function findScenePics(){ scenePics().forEach(name=>{ const f=artFile('scenes',name); if(f) SCENE_ART[name]=f; }); }
/* ---------- online play: Firebase connection and create / join ---------- */
ONLINE.hooks.roundPlayed = () => { if(!isAsync()) playRound(); };
const FB_VERSION = '10.12.2';
const loadScript = src => new Promise((ok,fail)=>{ const el=document.createElement('script'); el.src=src; el.onload=ok; el.onerror=()=>fail(new Error('Could not load '+src)); document.head.appendChild(el); });
// The transport ONLINE uses: rooms/<CODE> holds the host, guest seats 1–3 (name, on), one state copy per seat
// (state/<seat>, host writes) and the guests' actions (acts, guests write)
// Load Firebase (only when online play or cloud backup needs it) and sign in anonymously
async function firebaseReady(){
  if(!FIREBASE_CONFIG) throw new Error("Online play isn't set up yet (the Firebase config is missing).");
  if(!navigator.onLine) throw new Error("You're offline. This needs an internet connection.");
  if(!window.firebase) for(const m of ['app','auth','database']) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-${m}-compat.js`);
  if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  if(!firebase.auth().currentUser) await firebase.auth().signInAnonymously();
  return firebase.database();
}
async function firebaseNet(role){
  await firebaseReady();
  const db=firebase.database(), offs=[]; let room=null, seat=0;
  const listen=(ref,ev,f)=>{ ref.on(ev,f); const off=()=>ref.off(ev,f); offs.push(off); return off; };
  // presence: this seat is "on" while connected, and goes back on after any reconnect (switching apps or sites can drop it)
  const presence=()=>{ const me=room.child(seat===0?'host/on':'seats/'+seat+'/on');
    listen(db.ref('.info/connected'),'value',s=>{ if(s.val()){ me.onDisconnect().set(false); me.set(true); } }); };
  return {
    async create(code, name){ room=db.ref('rooms/'+code); if((await room.get()).exists()) return false;
      await room.set({created:Date.now(), host:{name, on:true}, hostSeat:0}); presence(); return true; },
    // a guest takes the first free seat (1–3); returns the room and the seat number
    async join(code, name){ room=db.ref('rooms/'+code); const snap=await room.get(); if(!snap.exists()) throw new Error('No game with that code.');
      const v=snap.val(); if(v.kicked && v.kicked[PHONE_ID]) throw new Error('The host removed you from this game.');
      const res=await room.child('seats').transaction(seats=>{ seats=seats||{}; for(let i=1;i<=3;i++){ if(!seats[i]||!seats[i].on){ seats[i]={name,on:true,id:PHONE_ID}; seat=i; return seats; } } return; });
      if(!res.committed || !seat) throw new Error('That game is full (4 players).');
      presence(); return {room:v, seat}; },
    publish(json, q){ room.child('state/'+q).set(json); },
    send(msg){ room.child('acts').push(JSON.parse(JSON.stringify(msg))); },
    // 2 players: the room hands over to an own-pace game, and the guest follows
    move(code){ return room.child('moved').set(code); },
    // host: remove a guest from the lobby. Their phone id is remembered, so the same link won't let them back in.
    async kick(i){ const id=(await room.child('seats/'+i+'/id').get()).val(); if(id) await room.child('kicked/'+id).set(true); await room.child('seats/'+i).remove(); },
    onKicked(cb){ return listen(room.child('kicked/'+PHONE_ID),'value',s=>{ if(s.val()) cb(); }); },
    // this phone is out or moving seats: stop listening and don't mark the seat as away, so it stays free
    quiet(){ offs.forEach(f=>f()); offs.length=0; if(room) room.child(seat===0?'host/on':'seats/'+seat+'/on').onDisconnect().cancel(); },
    release(){ this.quiet(); return room.child('seats/'+seat).remove(); },
    onMoved(cb){ return listen(room.child('moved'),'value',s=>{ if(s.val()) cb(s.val()); }); },   // Firebase rejects undefined (e.g. a Defend move's empty target)
    onState(cb){ return listen(room.child('state/'+seat),'value',s=>{ if(s.exists()) cb(s.val()); }); },
    // the host's queue of actions: an action is removed only once the host has taken it (cb returns true)
    onAction(cb){ return listen(room.child('acts'),'child_added',s=>{ if(cb(s.val())) s.ref.remove(); }); },
    onSeats(cb){ return listen(room.child('seats'),'value',s=>{ const v=s.val()||{}; cb([1,2,3].map(i=>v[i]||null)); }); },
    onHost(cb){ return listen(room.child('host'),'value',s=>cb(s.val())); },
    onHostSeat(cb){ return listen(room.child('hostSeat'),'value',s=>cb(s.val()||0)); },
    // take over hosting from seat `from` (only one phone can win this)
    async claimHost(from, to){ const r=await room.child('hostSeat').transaction(v=>(v||0)===from ? to : undefined); return r.committed; },
    leave(){ offs.forEach(f=>f()); offs.length=0; if(room) room.child(seat===0?'host/on':'seats/'+seat+'/on').set(false); },
  };
}
const myName = () => { const n0=document.getElementById('n0'); return (n0&&n0.value.trim()) || S.names[0] || 'Player'; };
/* ---------- online roles: host or guest, presence, and hand-off ----------
   ONLINE.offActs / ONLINE.offState switch listening on and off when this phone becomes host or goes back to guest. */
function listenAsHost(){
  if(ONLINE.offState){ ONLINE.offState(); ONLINE.offState=null; }
  if(!ONLINE.offActs) ONLINE.offActs=ONLINE.net.onAction(msg=>{
    if(!iAmHost()) return false;                               // not for us (we're not hosting): leave it for the host
    if(msg.to!==undefined && msg.to!==S.me && !(ONLINE.tookFrom||[]).includes(msg.to)) return false;
    hostHandle(msg); render(); return true; });
}
function listenAsGuest(){
  if(ONLINE.offActs){ ONLINE.offActs(); ONLINE.offActs=null; }
  if(!ONLINE.offState) ONLINE.offState=ONLINE.net.onState(json=>{ applySnapshot(json); render(); });
}
// presence of every seat (true = connected); used for "(away)" labels and the hand-off timer
function watchPresence(){
  ONLINE.net.onHost(v=>{ S.away=Object.assign({},S.away,{0: !(v&&v.on)}); presenceChanged(); });
  ONLINE.net.onSeats(seats=>{ if(S.phase==='lobby'){ S.lobby.seats=seats; closeGap(seats); } const a=Object.assign({},S.away); seats.forEach((x,i)=>{ a[i+1]= !!x && !x.on; }); S.away=a; presenceChanged(); });
  ONLINE.net.onHostSeat(h=>{ const was=iAmHost(); S.hostSeat=h; if(iAmHost()) listenAsHost(); else if(was || !ONLINE.offState) listenAsGuest(); presenceChanged(); });
}
// While the host is away mid-match, the first player still here takes over after HANDOFF_MS
let HANDOFF=null;
function presenceChanged(){
  const h=hostSeat(), hostAway=S.away && S.away[h] && S.phase!=='lobby' && !S.final && !iAmHost();
  if(!hostAway){ clearTimeout(HANDOFF); HANDOFF=null; S.hostAwaySince=null; render(); return; }
  if(!S.hostAwaySince) S.hostAwaySince=Date.now();
  if(!HANDOFF) HANDOFF=setTimeout(tryTakeOver, Math.max(0, S.hostAwaySince+HANDOFF_MS-Date.now()));
  render();
}
async function tryTakeOver(){
  HANDOFF=null; const h=hostSeat(); if(!(S.away&&S.away[h]) || iAmHost()) return;
  // the lowest seat still here goes first; anyone else waits a little longer in case that phone can't
  const here=players().filter(p=>p!==h && !(S.away&&S.away[p]));
  if(here[0]!==S.me){ HANDOFF=setTimeout(tryTakeOver, 30000); return; }
  if(await ONLINE.net.claimHost(h, S.me)){
    ONLINE.tookFrom=[...(ONLINE.tookFrom||[]), h]; takeOverHost(S.names[h]); ONLINE.last={}; listenAsHost(); render();
  }
}
async function onlineCreate(){
  const name=titled(myName()); S.names[0]=name; S.onlineMsg='Connecting…'; render();
  try{
    const net=await firebaseNet('host'); let code=null;
    for(let i=0;i<8 && !code;i++){ const c=newRoomCode(); if(await net.create(c,name)) code=c; }
    if(!code) throw new Error('Could not make a room code. Try again.');
    ONLINE.net=net; ONLINE.last=null; ONLINE.offActs=ONLINE.offState=null; ONLINE.tookFrom=[]; useModeCfg('online');
    Object.assign(S,{me:0, planFor:0, n:2, hostSeat:0, away:{}, names:[name], lobbyHost:name, lobby:{code, seats:[]}, phase:'lobby', onlineMsg:''});
    listenAsHost(); watchPresence();
    render();
  }catch(e){ S.onlineMsg=e.message||'Could not connect.'; render(); }
}
// Guests who sit behind a gap move up: a game can't start with an empty seat in the middle (a kicked player's)
function closeGap(seats){
  if(iAmHost() || S.phase!=='lobby' || S.reseating || !seats.slice(0,S.me-1).some(x=>!x)) return;
  S.reseating=true; clearTimeout(HANDOFF); HANDOFF=null;
  const code=S.lobby.code, name=(seats[S.me-1]||{}).name||playerName()||'Player'; ONLINE.net.release().then(()=>joinRoom(code,name)).finally(()=>{ S.reseating=false; });
}
function kickedOut(){ ONLINE.net.quiet(); ONLINE.net=null; ONLINE.offActs=ONLINE.offState=null; clearTimeout(HANDOFF); HANDOFF=null; Object.assign(S,{phase:'modeset', joinOpen:false, onlineMsg:'The host removed you from that game.'}); render(); }
async function onlineJoin(){
  const el=document.getElementById('ocode'), code=((el&&el.value)||'').trim().toUpperCase(); S.joinCode=code;
  if(/^[A-Z]{6}$/.test(code)) return asyncJoin(code);
  if(/^[A-Z]{4}$/.test(code) && typeof tourIs==='function' && await tourIs(code)) return tourJoin(code);   // a tournament's code
  if(/^[A-Z]{4}$/.test(code) && await tvRoom(code)) return ctlJoin(code);   // a TV's code: this phone becomes its controller
  if(!/^[A-Z]{4}$/.test(code)){ S.onlineMsg='Type the code from the other phone (4 or 6 letters).'; return render(); }
  const name=titled(myName()); S.names[0]=name; S.onlineMsg='Joining…'; render();
  await joinRoom(code,name);
}
async function joinRoom(code,name){
  try{
    const net=await firebaseNet('guest'), {room, seat}=await net.join(code,name);
    ONLINE.net=net; ONLINE.offActs=ONLINE.offState=null; ONLINE.tookFrom=[];
    Object.assign(S,{me:seat, planFor:seat, hostSeat:room.hostSeat||0, away:{}, names:[(room.host&&room.host.name)||'Host', name], lobbyHost:(room.host&&room.host.name)||'Host', lobby:{code, seats:[]}, phase:'lobby', onlineMsg:''});
    listenAsGuest(); watchPresence(); net.onMoved(c=>enterGame(c,seat)); net.onKicked(kickedOut);
    render();
  }catch(e){ S.onlineMsg=e.message||'Could not join.'; render(); }
}
// Start from the lobby (CK, Nov 2, 2026: one way in for 2–4 players). 2 players become an own-pace game, so they can play live or take
// turns later. 3 or 4 stay in the live room, where everyone plays at once.
async function startRoom(){
  const c=S.cfg||loadModeCfg('online'); if(S.coop){ coopStart(); newPlanTurn(); return render(); }
  S.gm=c.gm==='random'?'random':undefined;
  if(S.n===2) return roomToGame(c);
  if(S.gm){ dealMatch(); newPlanTurn(); } else toSpin();
  render();
}
async function roomToGame(c){
  const names=S.names.slice(); S.onlineMsg='Starting…'; render();
  try{
    const db=await firebaseReady(), code=await newAsyncGame(db, c, names[0]);
    if(!await asyncNet(db,code).send({a:'join', p:1, name:names[1]})) throw new Error('Could not start the game. Try again.');
    await ONLINE.net.move(code); enterGame(code,0);
  }catch(e){ S.onlineMsg=netError(e); render(); }
}
function enterGame(code, seat){ clearTimeout(HANDOFF); HANDOFF=null; setGame(code,{seat}); watchGames(); openGame(code); }
/* ---------- own-pace games (2 phones, no host): games/<6-letter code> in Firebase ----------
   The rules are in online.js (asyncApply). Here: create / join / open, the transaction that applies this phone's
   actions, playing back rounds this phone hasn't watched, and the home screen list (each game's meta, watched live). */
const newGameCode = () => Array.from({length:6}, ()=>ROOM_LETTERS[Math.floor(Math.random()*ROOM_LETTERS.length)]).join('');
const netError = e => /permission/i.test(String(e&&(e.code||e.message))) ? 'Firebase blocked this: the database rules need the “games” and “stats” entries (see the setup notes).' : (e&&e.message)||'Could not connect.';
function asyncNet(db, code){
  const ref=db.ref('games/'+code), offs=[];
  return {
    // apply this phone's action in one transaction; resolves true if it changed the game
    send(msg){ let res=null;
      return ref.transaction(g=>{ res=null; if(!g || !g.s) return g; if(msg.a==='rematch' && g.left) return; const r=asyncApply(g.s, msg); if(!r) return; res=r; return Object.assign({}, g, {s:r.json, meta:r.meta}); })
        .then(t=>{ if(t.committed && res && res.ended) postStats({...res.ended, humans:res.ended.humans}); if(t.committed && res) pushTurn(code,msg.p); return t.committed && !!res; })
        .catch(e=>{ S.onlineMsg=netError(e); render(); return false; }); },
    onGame(cb){ const f=s=>{ const v=s.val(); if(v && v.s) cb(v); else if(!v){ setGame(code,{gone:true}); } }; ref.on('value',f); offs.push(()=>ref.off('value',f)); },
    // this phone is in the game right now (the other phone shows it, so a game can play live or wait); the server clears it if the phone drops
    here(db, seat){ const me=ref.child('here/'+seat), c=db.ref('.info/connected'), f=s=>{ if(s.val()){ me.onDisconnect().remove().catch(()=>{}); me.set(true).catch(()=>{}); } };
      c.on('value',f); offs.push(()=>{ c.off('value',f); me.onDisconnect().cancel().catch(()=>{}); me.remove().catch(()=>{}); }); },
    leave(){ offs.forEach(f=>f()); offs.length=0; },
  };
}
// A new 2-player game in the lobby, with this player in seat 0. Returns its code.
async function newAsyncGame(db, c, name){
  const now=Date.now(), state=JSON.stringify({phase:'lobby', n:2, names:[name], budget:c.budget, poolType:c.poolType, maxTeam:c.maxTeam, bansOn:!!c.bans, gm:c.gm==='random'?'random':undefined, async:true, hostSeat:-1, duo:false, matchNo:0});
  let code=null;
  for(let i=0;i<8 && !code;i++){ const k=newGameCode(), r=await db.ref('games/'+k).transaction(v=>v ? undefined : {created:now, s:state, meta:{names:[name], matchNo:0, phase:'lobby', turn:[], round:0, roundId:0, final:false, winner:null, updated:now}}); if(r.committed) code=k; }
  if(!code) throw new Error('Could not make a game code. Try again.');
  return code;
}
/* Quick Match: a stranger, with nobody stuck on a waiting screen. It's an ordinary own-pace game, so the player who finds nobody
   can leave: it waits on their home screen and starts when someone taps in. games/QUEUED (a code the 'games' rule already
   allows, so no new Firebase rule) names the one waiting game; a transaction hands it to exactly one joiner. */
const QM_CFG = {budget:20, poolType:'random', maxTeam:MAXTEAM, bans:false};
async function quickMatch(){
  const name=titled(myName()); S.names[0]=name; S.onlineMsg='Looking for a match…'; render();
  try{
    const db=await firebaseReady(), q=db.ref('games/'+QUEUE), fresh=v=>v && v.code && Date.now()-v.at<QUEUE_TTL;
    const take=async mine=>{ let took=null; await q.transaction(v=>{ took=null; if(fresh(v) && v.by!==PHONE_ID){ took=v.code; return null; } return mine ? {code:mine, by:PHONE_ID, at:Date.now()} : v; }); return took; };
    const cur=(await q.get()).val();
    if(fresh(cur) && cur.by===PHONE_ID && myGame(cur.code)){ S.onlineMsg='You’re already looking for a match. It’s on your home screen.'; return render(); }
    const took=await take(null); if(took) return asyncJoin(took);
    const code=await newAsyncGame(db, QM_CFG, name), late=await take(code);
    if(late){ await db.ref('games/'+code).remove(); return asyncJoin(late); }
    setGame(code,{seat:0, qm:true}); watchGames(); pushGame(code,0); pushMatch(code);
    S.qmWait=true; S.onlineMsg='You’re in the queue. You can leave now: your match will be on your home screen when someone joins.'; render();
  }catch(e){ S.onlineMsg=netError(e); render(); }
}
async function quickCancel(code){ try{ const db=await firebaseReady(); await db.ref('games/'+QUEUE).transaction(v=>v && v.code===code ? null : v); await db.ref('games/'+code).remove(); }catch(e){} }
/* Quick taunts: only a fighter's own fixed line can be sent (the message is just the card id, so nothing typed ever reaches another
   player), 3 a match, 15 s apart, and Settings can mute them. */
const TAUNT_MAX = 3, TAUNT_GAP = 15000;
const tauntsLeft = () => { const t=S.tauntsSent||{}; return t.m===S.matchNo ? TAUNT_MAX-t.n : TAUNT_MAX; };
async function sendTaunt(id){
  const u=isAsync() && S.teams && S.teams[S.me].find(x=>x.id===id), t=S.tauntsSent||{}, now=Date.now();
  if(!u || S.tauntsOn===false || tauntsLeft()<=0 || now-(t.at||0)<TAUNT_GAP) return;
  S.tauntsSent={m:S.matchNo, n:(t.m===S.matchNo?t.n:0)+1, at:now}; S.tauntOpen=false;
  try{ const db=await firebaseReady(); await db.ref(`games/${S.asyncCode}/taunt`).set({p:S.me, id, at:now}); }catch(e){}
}
function showTaunt(t){
  if(S.tauntsOn===false || !t || !BYID[t.id] || !SPECIAL_QUOTES[t.id] || t.at-(S.tauntAt||0)<TAUNT_GAP || Date.now()-t.at>60000) return;   // the gap holds on this phone too, whatever the other one sends
  S.tauntAt=t.at;
  const el=document.createElement('div'); el.className='tauntpop'; el.setAttribute('role','status'); el.textContent=`${BYID[t.id].short}: “${SPECIAL_QUOTES[t.id]}”`;
  document.body.appendChild(el); setTimeout(()=>el.remove(),4000);
}
async function asyncJoin(code){
  if(myGame(code)) return openGame(code);
  const name=titled(myName()); S.names[0]=name; S.onlineMsg='Joining…'; render();
  try{
    const db=await firebaseReady(), snap=await db.ref('games/'+code).get();
    if(!snap.exists()) throw new Error('No game with that code.');
    const st=JSON.parse(snap.val().s);
    if(st.phase!=='lobby' || (st.names||[])[1]) throw new Error('That game already has two players.');
    const ok=await asyncNet(db, code).send({a:'join', p:1, name});
    if(!ok){ if(!S.onlineMsg || S.onlineMsg==='Joining…') S.onlineMsg='That game already has two players.'; return render(); }
    setGame(code,{seat:1}); watchGames(); await openGame(code);
  }catch(e){ S.onlineMsg=netError(e); render(); }
}
// Open one of this phone's games: listen to it, and draw it as this player sees it
async function openGame(code){
  const g=myGame(code); if(!g) return;
  S.onlineMsg='Connecting…'; render();
  try{
    const db=await firebaseReady();
    if(ONLINE.net) ONLINE.net.leave();
    clearTimeout(S._t);
    Object.assign(S,{mode:'online', async:true, asyncCode:code, me:g.seat, planFor:g.seat, hostSeat:-1, away:{}, phase:'lobby', lobby:{code, seats:[]},
      onlineMsg:'', asyncWatching:false, play:null, final:false, localOver:false, plans:null, helperPlan:null, lastPlans:null, sel:null, info:null});
    pushGame(code,g.seat); ONLINE.net=asyncNet(db, code); ONLINE.full=null; ONLINE.offActs=ONLINE.offState=null; ONLINE.net.here(db, g.seat);
    ONLINE.net.onGame(v=>{ if(!isAsync() || S.asyncCode!==code) return; ONLINE.full=v.s; S.oppHere=!!(v.here&&v.here[1-g.seat]); S.oppLeft=!!(v.left&&v.left[1-g.seat]); setGame(code,{meta:v.meta, gone:false});
      if(v.taunt && v.taunt.p!==g.seat) showTaunt(v.taunt);
      if(!S.asyncWatching){ asyncShow(); render(); } });
    window.scrollTo(0,0);
  }catch(e){ S.onlineMsg=netError(e); render(); }
}
// Draw the latest state; a round this phone hasn't watched yet plays back first
function asyncShow(){
  if(!ONLINE.full) return;
  const wasPhase=S.phase;
  applySnapshot(asyncView(ONLINE.full, S.me));
  S.away={};
  if(S.phase==='lobby'){ S.lobby={code:S.asyncCode, seats:[]}; return; }
  const seen=seenRound(myGame(S.asyncCode), S.matchNo);
  if((S.roundId||0)>seen && S.log && S.log.length){
    S.asyncWatching=true; S.localOver=false;
    if(!S.final) S.round--;   // the shared game has already moved on to the next round
    S.phase='result'; S.readyNext=players().map(()=>false); playRound(); return;
  }
  if(S.final){ S.phase='result'; S.localOver=true; }
  if(wasPhase!==S.phase) newPlanTurn();
}
// "Next round" after watching: remember it and show the game as it is now
function asyncWatched(){
  setGame(S.asyncCode,{seen:{m:S.matchNo, r:S.roundId}}); S.asyncWatching=false; S.play=null; clearTimeout(S._t);
  asyncShow(); newPlanTurn(); gamesBadge();
}
// Home screen: keep each game's summary up to date, and show how many are waiting on you
const GAME_WATCH = {};
async function watchGames(){
  const list=loadGames(); if(!list.length || !FIREBASE_CONFIG || !navigator.onLine) return gamesBadge();
  try{
    const db=await firebaseReady();
    loadGames().forEach(g=>{ if(GAME_WATCH[g.code]) return;
      const ref=db.ref('games/'+g.code+'/meta'), f=s=>{ const m=s.val(); if(!myGame(g.code)) return; setGame(g.code, m ? {meta:m, gone:false} : {gone:true}); gamesBadge(); if(S.phase==='setup') render(); };
      const lref=db.ref('games/'+g.code+'/left'), lf=s=>{ if(!myGame(g.code)) return; setGame(g.code,{left:s.val()||null}); pruneGames(); if(S.phase==='setup') render(); };
      ref.on('value',f); lref.on('value',lf); GAME_WATCH[g.code]=()=>{ ref.off('value',f); lref.off('value',lf); }; });
  }catch(e){}
}
// Finished own-pace matches clean themselves up (players reported games staying on the home screen after both had left,
// Nov 12, 2026): leaving a finished match marks this seat as left (games/<code>/left/<seat>) and drops it here; the other
// phone drops it once they've watched the end. Games that no longer exist, finished ones over 3 days old and any game
// untouched for 7 days go too. A game left mid-match stays: that's what playing at your own pace is for.
function leaveFinished(code, seat){
  firebaseReady().then(db=>db.ref('games/'+code+'/left/'+seat).set(true)).catch(()=>{});
  const f=GAME_WATCH[code]; if(f){ f(); delete GAME_WATCH[code]; } dropGame(code);
}
function pruneGames(){
  const now=Date.now();
  loadGames().forEach(g=>{
    if(isAsync() && S.asyncCode===g.code) return;   // never the game on screen
    const m=g.meta||{}, unseen=(m.roundId||0) > seenRound(g, m.matchNo), oppLeft=g.left && g.left[1-g.seat], age=now-(m.updated||g.at||now);
    const drop = g.gone || (m.final && !unseen && oppLeft) || (m.final && age>3*864e5) || age>7*864e5;
    if(drop){ const f=GAME_WATCH[g.code]; if(f){ f(); delete GAME_WATCH[g.code]; } dropGame(g.code); }
  });
}
function gamesBadge(){
  pruneGames();
  const n=gamesToPlay();
  document.title = n ? `(${n}) Slayer Squad` : BASE_TITLE;
  try{ if(n && navigator.setAppBadge) navigator.setAppBadge(n); else if(navigator.clearAppBadge) navigator.clearAppBadge(); }catch(e){}
}

/* ---------- shared stats (see online.js): sent when a match ends, read for the Codex and the Stats tab ---------- */
// The match that just ended, as the stats count it (null = not counted: Story, Practice, the daily challenge, and
// online games, which are counted once by the phone that hosts / ended them)
function statsGame(){
  if(S.mode==='story' || S.mode==='daily' || S.coop || gameMode() || isPractice() || !S.teams) return null;
  if(isOnline() && (isAsync() || !iAmHost())) return null;
  return {pool:S.pool||[], poolType:S.poolType, teams:players().map(p=>S.teams[p].filter(u=>!u.spawn).map(u=>u.id)), helpers:players().map(p=>(S.picks[p]||[]).filter(isHelper)),
    won:players().map(p=>S.winner>=0 && sameSide(S.winner,p)), humans: S.mode==='cpu' ? [0] : players()};
}
// Anonymous counters for CK's admin page: no names, just how often things happen. Skipped on his own browser.
let matchOn=null;
const modeKey = () => (typeof isTV==='function'&&isTV()?'tv_':'')+(S.coop?'coop_'+S.coop:S.mode==='online'?'online'+S.n:S.mode);
// Every tracked day is a New York date (CK's time zone), so every player's day rolls over at the same moment. admin.js uses the same zone.
const TRACK_TZ='America/New_York';
const trackDay = () => { try{ return new Intl.DateTimeFormat('en-CA',{timeZone:TRACK_TZ, year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date()); }catch(e){ return todayKey(); } };
// CK's own copy (Live Server at 127.0.0.1:5500, localhost or a file) never counts: its test links start Quickplay matches that are never
// finished, which made Quickplay look abandoned on the admin page (Nov 7, 2026). The live site's admin flag can't reach these.
const LOCAL_COPY = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname) || location.protocol==='file:';
const trackOff = () => { try{ return !FIREBASE_CONFIG || !navigator.onLine || navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent) || /notrack|[?&]test=/.test(location.search) || LOCAL_COPY || !!localStorage.getItem('squad-draft-admin'); }catch(e){ return true; } };   // test browsers don't count (Claude's live tests counted once, Nov 2026)
function track(keys){
  if(trackOff()) return; const day=trackDay();
  // mode and story counters also get a dated copy, so the admin page can filter them by time
  firebaseReady().then(db=>{ const inc=firebase.database.ServerValue.increment(1), up={}; keys.forEach(k=>{ up[k]=inc; if(/^([ms]|src)_/.test(k)) up[`d_${day}_${k}`]=inc; }); return db.ref('track').update(up); }).catch(()=>{});
}
// This browser's anonymous id (random; backed up with the save, but a restoring device keeps its own)
const trackId = () => { try{ let id=localStorage.getItem('squad-draft-pid'); if(!/^[a-z0-9]{12}$/.test(id||'')){ id=Array.from({length:12},()=>'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random()*32)]).join(''); localStorage.setItem('squad-draft-pid',id); } return id; }catch(e){ return null; } };
// A scrambled fingerprint of the recovery code: browsers sharing a code (phone + iPad, old + new address) count as one person. The code itself never leaves the save.
async function codeMark(){ try{ const c=loadCloud().code; if(!c || !crypto.subtle) return ''; const h=new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('slayer-squad:'+c))); return Array.from(h.slice(0,6),b=>b.toString(16).padStart(2,'0')).join(''); }catch(e){ return ''; } }
// Read at load, before invite or restore links clear the address bar.
const FROM_PARAM = (()=>{ try{ return (new URLSearchParams(location.search).get('from')||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,20); }catch(e){ return ''; } })();
async function trackOpen(){
  const day=trackDay(), keys=[`d_${day}_opens`]; let t={}; try{ t=JSON.parse(localStorage.getItem('squad-draft-track'))||{} }catch(e){}
  const ua=navigator.userAgent||'', dev=/iphone|ipad|ipod/i.test(ua)?'ios':/android/i.test(ua)?'android':'computer', firstDay=t.day!==day;
  if(firstDay) keys.push(`d_${day}_players`);
  if(!t.day) keys.push('players', `d_${day}_new`, 'dev_'+dev);
  // Where a new player came from: links like slayersquad.app/?from=tiktok (letters, numbers, - and _ only). Counted once per browser.
  if(!t.day) keys.push('src_'+(FROM_PARAM||'direct'));
  try{ localStorage.setItem('squad-draft-track',JSON.stringify({day})) }catch(e){}
  // Rough region, once per browser (existing players too): the device's time zone, e.g. America/Chicago. No location permission, no IP.
  let tz='Unknown'; try{ tz=(Intl.DateTimeFormat().resolvedOptions().timeZone||'Unknown').slice(0,50); }catch(e){}
  try{ if(navigator.onLine && !localStorage.getItem('squad-draft-where')){ keys.push('where_'+tz.replace(/[.$#\[\]\/]/g,'~')); localStorage.setItem('squad-draft-where','1'); } }catch(e){}
  track(keys);
  // People: one entry per browser with the days it played (once a day), its device, time zone and code fingerprint.
  // `old` marks browsers that played before this was added, so they don't show as new.
  if(trackOff()) return; const id=trackId(); if(!id) return;
  let seen=''; try{ seen=localStorage.getItem('squad-draft-seen')||''; }catch(e){}
  const mark=await codeMark(); if(seen===day+'|'+mark) return;
  const up={dev, tz, ['days/'+day]:true}; if(mark) up.p=mark; if(t.day && !seen) up.old=true;
  firebaseReady().then(db=>db.ref('seen/'+id).update(up)).then(()=>{ try{ localStorage.setItem('squad-draft-seen', day+'|'+mark); }catch(e){} }).catch(()=>{});
}
setTimeout(trackOpen, 5000);
setTimeout(arriveFromMove, 800);
setTimeout(arriveFromInvite, 300);
// the newest offline copy's version (a browser can still hold an older cache for a moment, which made reports say the wrong version)
const gameVersion = async () => { try{ const n=(await caches.keys()).map(k=>+(/^squad-draft-v(\d+)$/.exec(k)||[])[1]||0); const top=Math.max(0,...n); return top?String(top):(typeof LATEST_UPDATE==='object'?String(LATEST_UPDATE.version):''); }catch(e){ return '' } };
async function sendReport(msg, auto){
  const db=await firebaseReady();
  await db.ref('reports').push({at:Date.now(), msg:String(msg).slice(0,500), v:await gameVersion(), ua:(navigator.userAgent||'').slice(0,200), where:String(S.mode+' / '+S.phase).slice(0,60), auto:auto?1:0});
}
// Crashes report themselves (at most 3 each time the game is open)
let CRASHES=0;
window.addEventListener('error',e=>{ if(!e.filename || CRASHES>=3 || navigator.webdriver || LOCAL_COPY || !navigator.onLine) return; CRASHES++;
  sendReport(`${e.message} (${String(e.filename).split('/').pop()}:${e.lineno})`, true).catch(()=>{}); });
function postStats(g){
  if(!g || !FIREBASE_CONFIG || !navigator.onLine) return;
  firebaseReady().then(db=>{
    const inc=firebase.database.ServerValue.increment(1), up={games:inc}, add=(id,k)=>{ up[`chars/${id}/${k}`]=inc; }, random=g.poolType==='random'||!g.poolType;
    if(random) [...new Set(g.pool)].forEach(id=>add(id,'d'));
    g.humans.forEach(p=>[...g.teams[p], ...(g.helpers[p]||[])].forEach(id=>{ add(id,'p'); if(random) add(id,'r'); if(g.won[p]) add(id,'w'); }));
    return db.ref('stats').update(up);
  }).catch(()=>{});
}
async function loadGlobalStats(){
  if(GLOBAL_STATS && Date.now()-GLOBAL_STATS.at<5*60*1000) return;
  if(!FIREBASE_CONFIG || !navigator.onLine){ S.globalErr=true; return; }
  try{ const db=await firebaseReady(), v=(await db.ref('stats').get()).val()||{};
    GLOBAL_STATS={games:v.games||0, chars:v.chars||{}, at:Date.now()}; S.globalErr=false; }
  catch(e){ S.globalErr=true; }
  render();
}

/* ---------- cloud backup with a recovery code ----------
   Every 'squad-draft…' setting and save on this phone (story, stars, stats, records, daily streak, names, settings) is
   copied to Firebase at saves/<CODE> a few seconds after it changes. The code (like KMRT-7Q2X-9HEA) is shown in
   Settings → Save; typing it on another phone (or after clearing the browser) restores everything.
   Needs the 'saves' rule in the Firebase console (see CLAUDE.md). Until then backups fail quietly and Settings says so.
   Two devices can share a code (restoring takes the code with it), so each write carries a random 'rev' and a device only
   writes over the rev it last saw. Anything else is another device's save, and the two are combined (mergeSaves) so neither
   loses anything and the player never has to choose. Restoring combines the same way, so a code can only add progress. */
const CLOUD_KEY = 'squad-draft-cloud', CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const NOT_BACKED = ['squad-draft-cloud','squad-draft-data','squad-draft-install-later','squad-draft-push','squad-draft-admin','squad-draft-track','squad-draft-seen','squad-draft-where','squad-draft-pid','squad-draft-phone','squad-draft-ctl'];   // this device only: admin flag, tracking record, phone id, TV controller
const loadCloud = () => { try{ return JSON.parse(localStorage.getItem(CLOUD_KEY))||{} }catch(e){ return {} } };
const saveCloud = c => { try{ localStorage.setItem(CLOUD_KEY, JSON.stringify(c)) }catch(e){} };
const newSaveCode = () => Array.from({length:12},()=>CODE_ABC[Math.floor(Math.random()*CODE_ABC.length)]).join('');
const showCode = c => c ? c.match(/.{4}/g).join('-') : '';
function saveData(){ const d={}; try{ Object.keys(localStorage).filter(k=>k.startsWith('squad-draft') && !NOT_BACKED.includes(k)).sort().forEach(k=>{ d[k]=localStorage.getItem(k); }); }catch(e){} return d; }
// worth backing up once there's real progress (not a brand-new phone)
const hasProgress = d => ['squad-draft-story-v2','squad-draft-records','squad-draft-score','squad-draft-daily'].some(k=>d[k] && d[k]!=='{}' && d[k]!=='{"cleared":[]}');
// what a save holds, in players' words, for choosing between two of them
const saveJSON = (d,k) => { try{ return JSON.parse(d[k])||{}; }catch(e){ return {}; } };
const saveSummary = d => { const s=saveJSON(d,'squad-draft-story-v2'); return `${plural((s.cleared||[]).length,'story battle')}, ${plural(MAIN_STAGES.reduce((a,st)=>a+((s.stars||{})[st.id]||0),0),'star')}`; };   // the main story's stars, the same count the story map shows
// Two saves combined: every battle, the best stars, the fuller record per fighter and name, every daily done. Settings stay this device's.
function mergeSaves(mine, theirs){
  const out={...Object.fromEntries(Object.entries(theirs).filter(([k])=>!NOT_BACKED.includes(k))), ...mine}, both=k=>[saveJSON(mine,k), saveJSON(theirs,k)], put=(k,v)=>{ if(k in out) out[k]=JSON.stringify(v); };
  { const [a,b]=both('squad-draft-story-v2'); put('squad-draft-story-v2', mergeStory(b,a)); }
  { const [a,b]=both('squad-draft-records'), r={...b}; Object.entries(a).forEach(([id,v])=>{ if(!r[id] || v[0]>=r[id][0]) r[id]=v; }); put('squad-draft-records', r); }
  { const [a,b]=both('squad-draft-score'), r={...b}; Object.entries(a).forEach(([n,v])=>{ r[n]=Math.max(v, r[n]||0); }); put('squad-draft-score', r); }
  { const [a,b]=both('squad-draft-daily'); put('squad-draft-daily', {...b, ...a, done:[...new Set([...(a.done||[]), ...(b.done||[])])].sort().slice(-400)}); }
  { const [a,b]=both('squad-draft-modes'), r={...b}; Object.entries(a).forEach(([m,v])=>{ const o=r[m]||{}; r[m]={won:Math.max(v.won||0,o.won||0), played:Math.max(v.played||0,o.played||0), best:Math.max(v.best||0,o.best||0)}; }); put('squad-draft-modes', r); }
  return out;
}
const writeSave = d => { try{ Object.entries(d).forEach(([k,v])=>localStorage.setItem(k,v)); }catch(e){} };
const sameSave = (a,b) => JSON.stringify(Object.keys(a).sort().map(k=>[k,a[k]]))===JSON.stringify(Object.keys(b).sort().map(k=>[k,b[k]]));
// has another device saved to this code since this one last did? (Saves from before 'rev' existed go by the time.)
const anotherDevice = (r,c) => r.rev||c.rev ? r.rev!==c.rev : r.at>(c.last||0);
let CLOUD = {timer:null, last:'', busy:false, status:''};
function cloudCheck(){   // called after every redraw: schedule a backup when the saved data changed
  if(!FIREBASE_CONFIG) return; const d=saveData(), j=JSON.stringify(d);
  if(j===CLOUD.last || !hasProgress(d)) return;
  clearTimeout(CLOUD.timer); CLOUD.timer=setTimeout(()=>cloudBackup(), 4000);
}
async function cloudBackup(force){
  if(CLOUD.busy || (!navigator.onLine && !force)) return; CLOUD.busy=true;
  let d=saveData(); const c=loadCloud();
  try{
    const db=await firebaseReady(); if(!c.code){ c.code=newSaveCode(); }
    const r=(await db.ref('saves/'+c.code).get()).val(), merged=r && r.data && !sameSave(r.data,d) && anotherDevice(r,c);
    if(merged){ d=mergeSaves(d, r.data); writeSave(d); }
    c.rev=newSaveCode(); await db.ref('saves/'+c.code).set({v:1, at:Date.now(), rev:c.rev, data:d});
    c.last=Date.now(); saveCloud(c); CLOUD.last=JSON.stringify(saveData()); CLOUD.status='';
    if(merged && S.phase==='setup') render();
  }catch(e){ CLOUD.status = /permission/i.test(e.message||'') ? 'rules' : 'offline'; }
  CLOUD.busy=false; if(S.settings && S.setTab==='save') render();
}
// Restore: looks the code up and adds that save to this device; nothing here is lost. This device then uses that code.
async function cloudRestore(){
  const el=document.getElementById('restorecode'), raw=((el&&el.value)||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  S.restoreCode=raw;
  if(raw.length!==12){ S.restoreMsg='Type the 12-character code (dashes are optional).'; return render(); }
  S.restoreMsg='Looking it up…'; render();
  await restoreCode(raw); render();
}
async function restoreCode(raw){
  try{ const db=await firebaseReady(), snap=await db.ref('saves/'+raw).get();
    if(!snap.exists()){ S.restoreMsg='No backup with that code.'; return false; }
    const r=snap.val(), d=mergeSaves(saveData(), r.data||{}); writeSave(d); saveCloud({code:raw, last:r.at, rev:r.rev}); CLOUD.last='';
    S.restoreCode=''; S.restoreMsg=`Done! This device now has ${saveSummary(d)}.`; return true;
  }catch(e){ S.restoreMsg=/permission/i.test(e.message||'')?"Cloud backup isn't switched on yet.":'Could not connect. Check your internet.'; return false; }
}
/* The move to slayersquad.app: saves belong to a web address, so the old address stays up and offers one button. It backs up, then opens
   the new site with the code in the link, and the new site adds that save straight away. Nothing is typed, and restoring only adds. */
const NEW_SITE = 'https://slayersquad.app/';
const oldSite = () => /github\.io$/.test(location.hostname);
async function moveLink(){ const d=saveData(); if(!hasProgress(d)) return NEW_SITE; await cloudBackup(true); const c=loadCloud(); return c.code ? `${NEW_SITE}?restore=${c.code}` : ''; }
async function moveSite(){ S.moveMsg='Saving your progress…'; render(); const url=await moveLink(); if(url) return location.assign(url); S.moveMsg='Could not save your progress. Check your internet and try again.'; render(); }
async function arriveFromMove(){
  const raw=(new URLSearchParams(location.search).get('restore')||'').toUpperCase().replace(/[^A-Z0-9]/g,''); if(!raw) return;
  history.replaceState(null,'',location.pathname);   // the code doesn't stay in the address bar or browser history
  const ok=raw.length===12 && await restoreCode(raw); note(ok ? (FROM_PARAM==='qr' ? 'Your progress came over from your computer. Both now share one save.' : 'Welcome to slayersquad.app! Your progress came with you.') : 'We couldn’t bring your progress over. Enter your code in Settings → Save.'); render();
}
/* Invite links: slayersquad.app/join/?c=CODE shows its own link preview, then opens the game at ?join=CODE and joins that room. Players who've never named themselves see the code
   filled in and only have to tap Join. */
const inviteLink = code => `${NEW_SITE}join/?c=${code}`;   // join/ is a tiny page with its own link preview that forwards to ?join=
async function shareInvite(){
  const url=inviteLink(S.lobby.code);
  try{ if(navigator.share){ await navigator.share({title:'Slayer Squad', text:`Join my Slayer Squad game. Code: ${S.lobby.code}`, url}); return; } }catch(e){ if(e&&e.name==='AbortError') return; }
  try{ await navigator.clipboard.writeText(url); S.copied=true; setTimeout(()=>{ S.copied=false; render(); },1500); render(); }catch(e){}
}
function arriveFromInvite(){
  const q=new URLSearchParams(location.search), open=(q.get('open')||'').toUpperCase().replace(/[^A-Z]/g,'');
  if(open){ history.replaceState(null,'',location.pathname); if(myGame(open)) openGame(open); return; }   // tapped a "your move" notification
  const code=(q.get('join')||'').toUpperCase().replace(/[^A-Z]/g,''); if(!/^([A-Z]{4}|[A-Z]{6})$/.test(code)) return;
  history.replaceState(null,'',location.pathname);
  ACTIONS.mode('online'); Object.assign(S,{phase:'modeset', joinOpen:true, joinCode:code, askName:null, onlineMsg:playerName()?'':'Add your name, then tap Join.'}); render();
  if(playerName()) setTimeout(onlineJoin);
}
/* Notifications (worker/ is the service; it's the only thing that can send them). PUSH empty = the feature is off.
   squad-draft-push: {id, turns, ping} on this device. Players choose each kind; the worker holds the subscription, not Firebase. */
const PUSH = {url:'https://slayersquad-push.charleskowou1.workers.dev', key:'BAE6ugC3T67nVBPOzH_qJFdDSFSAUzaLbty-hw00sjfLiOch3j3T8P5jpM-mPuaCdgXhwrCG1eK82Wfyq_n3BGk'};
const PUSH_KEY = 'squad-draft-push';
const pushState = () => { try{ return JSON.parse(localStorage.getItem(PUSH_KEY))||{}; }catch(e){ return {}; } };
const pushSave = v => { try{ localStorage.setItem(PUSH_KEY,JSON.stringify(v)); }catch(e){} };
const pushOn = () => !!PUSH.url && !oldSite();
const pushCan = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function pushPost(path, body){
  const db=await firebaseReady(), token=await firebase.auth().currentUser.getIdToken();
  const r=await fetch(`${PUSH.url}/${path}`, {method:'POST', body:JSON.stringify({...body, token})}); return r.json();
}
// The home screen's one-tap offer: browsers won't let a game switch alerts on by itself, so this is as close as it gets
const pushAsk = () => pushOn() && pushCan() && Notification.permission==='default' && !pushState().id && !pushState().declined;
// Waiting in Quick Match is when alerts matter most, so ask again here, even after a Not now. 'home' = iPhone in Safari: it needs the Home Screen app first.
const pushQuick = () => !S.qmWait || !pushOn() || pushState().turns ? '' : !pushCan() ? 'home' : Notification.permission==='denied' ? '' : 'ask';
const keyBytes = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')), c=>c.charCodeAt(0));
// Turn one kind on or off. The first time, the phone asks for permission.
async function pushSet(kind, on){
  const st={...pushState(), ...(kind==='all'?{turns:on,ping:on,daily:on}:{[kind]:on})}; S.pushMsg='';
  try{
    if(!st.turns && !st.ping && !st.daily){ if(st.id) await pushPost('unsubscribe',{id:st.id}); const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription(); if(sub) await sub.unsubscribe(); pushSave({}); return render(); }
    if(await Notification.requestPermission()!=='granted'){ S.pushMsg='Notifications are blocked. Allow them in your phone’s settings, then try again.'; return render(); }
    const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:keyBytes(PUSH.key)});
    const r=await pushSend(sub,st); if(!r.id) throw new Error('no id');
    st.id=r.id; st.sent=Date.now(); pushSave(st); if(st.turns) loadGames().forEach(g=>pushGame(g.code,g.seat));
  }catch(e){ S.pushMsg='Could not change notifications. Try again in a moment.'; }
  render();
}
const pushSend = (sub,st) => pushPost('subscribe',{sub:sub.toJSON(), ping:!!st.ping, daily:!!st.daily, tz:Intl.DateTimeFormat().resolvedOptions().timeZone});
// The service forgets a phone after 90 days of silence, so an active player checks in every week (this also follows them to a new time zone)
async function pushRefresh(){ const st=pushState(); if(!pushOn() || !pushCan() || !st.id || Date.now()-(st.sent||0)<7*864e5 || Notification.permission!=='granted') return;
  try{ const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription(); if(sub && (await pushSend(sub,st)).id){ st.sent=Date.now(); pushSave(st); } }catch(e){} }
setTimeout(pushRefresh, 6000);
async function pushGame(code, seat){ const st=pushState(); if(!pushOn() || !st.turns || !st.id) return; const g=myGame(code); if(!g || g.pushed) return; try{ if((await pushPost('game',{code,seat,id:st.id})).ok) setGame(code,{pushed:true}); }catch(e){} }   // marked only once the service confirms, so a failure retries next open
function pushTurn(code, seat){ if(pushOn() && !S.oppHere) pushPost('turn',{code,seat}).catch(()=>{}); }
function pushMatch(code){ if(pushOn()) pushPost('match',{code,id:pushState().id}).catch(()=>{}); }
function note(text){ const el=document.createElement('div'); el.className='tauntpop'; el.setAttribute('role','status'); el.textContent=text; document.body.appendChild(el); setTimeout(()=>el.remove(),6000); }
S.vol=loadVolumes(); S.speed=loadSpeed(); try{ S.vibeOn=localStorage.getItem('squad-draft-vibe')!=='off'; S.clipsOn=localStorage.getItem('squad-draft-clips')!=='off'; S.clipRepeat=localStorage.getItem('squad-draft-clip-repeat')||'first'; S.tauntsOn=localStorage.getItem('squad-draft-taunts')!=='off' }catch(e){}
// One-time reset of The Endless Dream only (CK, Oct 30, 2026, after it changed): the main story and stars stay
try{ if(localStorage.getItem('squad-draft-dream-reset')!=='1'){ const st=loadStory(); st.cleared=(st.cleared||[]).filter(id=>!/^dr_/.test(id)); writeStory(st); localStorage.setItem('squad-draft-dream-reset','1'); } }catch(e){}
useModeCfg(S.mode); S.names=localNames(); if(S.mode!=='local') S.names[0]=playerName()||'Player 1';   // solo modes: this phone's name
// Add to Home Screen: what this phone can do (shown on the home screen until the game is installed)
let INSTALL_EVENT=null;
function installInfo(){
  const ua=navigator.userAgent||'', ios=/iphone|ipad|ipod/i.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  let later=0; try{ later=+localStorage.getItem('squad-draft-install-later')||0 }catch(e){}
  S.install={ ios, mobile: ios || /android/i.test(ua) || navigator.maxTouchPoints>1,
    standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone===true,
    canPrompt: !!INSTALL_EVENT, hidden: Date.now()-later < 3*24*3600e3 };
}
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); INSTALL_EVENT=e; installInfo(); if(S.phase==='setup') render(); });
window.addEventListener('appinstalled', ()=>{ INSTALL_EVENT=null; installInfo(); render(); });
installInfo();
// ask the browser to keep this game's saved data even when the phone is low on space (Android/Chrome grant it; harmless elsewhere)
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
// today's challenge takes a moment to build (it runs test battles), so it fills in just after the menu appears
setTimeout(()=>{ dailyChallenge(); if(S.phase==='setup') render(); }, 60);
setTimeout(watchGames, 200);   // own-pace games on the home screen   // own-pace games on the home screen: whose turn it is
render();
findArt(); findScenePics(); findPlaces();
// Laptop sides: the character spotlight (index.html #spot). Unlocked characters only, so it never spoils the story.
// Changes every 20 s while the sides are on screen; tapping it on the home screen opens the card in the Codex.
// Laptop sides: "Bring my progress" swaps the plain QR for one with this computer's recovery code (?restore=CODE&from=qr),
// so scanning it opens the game on the phone with this progress added (arriveFromMove). The code is personal, so it's
// only shown on a click and goes back to the plain QR after 2 minutes or on "Hide my code".
const QRM={plain:null, timer:0};
function qrSet(card, cap, sub, url, btn, mine){
  const $=id=>document.getElementById(id);
  if(card!=null) $('qrcard').innerHTML=card; $('qrcap').textContent=cap; $('qrsub').textContent=sub; $('qrurl').textContent=url;
  $('qrmine').textContent=btn; $('qrmine').disabled=false; $('qrcard').classList.toggle('mine',!!mine); $('qrurl').classList.toggle('warn',!!mine);
}
const qrPlain = () => { clearTimeout(QRM.timer); qrSet(QRM.plain,'Play on your phone','Scan with your camera','slayersquad.app','Bring my progress',false); };
const loadQR = () => window.qrcode ? Promise.resolve() : new Promise((ok,no)=>{ const t=document.createElement('script'); t.src='js/qr.js'; t.onload=ok; t.onerror=no; document.head.appendChild(t); });
function qrSvg(text){
  const q=qrcode(0,'M'); q.addData(text); q.make(); const n=q.getModuleCount(); let d='';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(q.isDark(r,c)) d+=`M${c} ${r}h1v1h-1z`;
  return `<svg class="qrsvg" role="img" aria-label="QR code with your progress" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path fill="#1d1915" d="${d}"/></svg>`;
}
async function qrMine(){
  const card=document.getElementById('qrcard'), btn=document.getElementById('qrmine'); if(!card||!btn) return;
  if(QRM.plain==null) QRM.plain=card.innerHTML;
  if(card.classList.contains('mine')) return qrPlain();
  if(!hasProgress(saveData())) return qrSet(null,'Play on your phone','No progress on this computer yet. Play a battle first.','slayersquad.app','Bring my progress',false);
  btn.textContent='Saving your progress…'; btn.disabled=true;
  await cloudBackup(true); const c=loadCloud();
  if(!c.code || CLOUD.status){ btn.disabled=false; btn.textContent='Bring my progress';
    return qrSet(null,'Play on your phone','Couldn’t save your progress. Check your internet and try again.','slayersquad.app','Try again',false); }
  try{ await loadQR(); }catch(e){ return qrSet(null,'Play on your phone','Couldn’t make the code. Check your internet and try again.','slayersquad.app','Try again',false); }
  qrSet(qrSvg(`${NEW_SITE}?restore=${c.code}&from=qr`),'Bring your progress','Scan with your phone’s camera','This code is yours. Don’t share it.','Hide my code',true);
  clearTimeout(QRM.timer); QRM.timer=setTimeout(qrPlain, 120000);
}
const SPOT={last:null};
function sideSpot(){
  const el=document.getElementById('spot'); if(!el || getComputedStyle(el.closest('.sides')).display==='none') return;
  const pool=ROSTER.filter(c=>!c.spawn && !c.helper && ART[c.id] && isUnlocked(c.id) && loreOf(c) && c.id!==SPOT.last); if(!pool.length) return;
  const c=pool[Math.floor(Math.random()*pool.length)], [line,bio]=loreOf(c); SPOT.last=c.id;
  const fill=()=>{ el.dataset.a='codexopen'; el.dataset.v=c.id;
    el.innerHTML=`<div class="sc${c.demon?' demon':''}"><img src="${ART[c.id]}" alt=""><i>${esc(c.short)}</i></div><b class="snm">${esc(c.name)}</b><span class="lxsty">${esc(c.type||'')} · ${c.cost} pts</span>${line?`<q>${esc(line)}</q>`:''}${bio?`<p>${esc(bio)}</p>`:''}${c.sig?`<span class="ssig">技 ${esc(c.sig.name)}</span>`:''}`;
    el.classList.remove('out'); };
  if(el.innerHTML){ el.classList.add('out'); setTimeout(fill,600); } else fill();
}
sideSpot(); setInterval(()=>{ if(!document.hidden) sideSpot(); }, 20000);
matchMedia('(min-width:1100px) and (min-height:560px)').addEventListener('change', sideSpot);
// Offline support and home-screen install (only works when served over http/https, not from a local file)
// Updates: a phone that keeps the game open in the background never reloads it, so check for a new version whenever
// the game comes back to the screen; when one arrives, reload right away on the home screen, or on the next return home.
let UPDATE_READY=false;
function reloadQuiet(){ try{ sessionStorage.setItem('squad-draft-quiet','1'); }catch(e){} location.reload(); }   // an update reload goes straight to the home screen
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  const hadSW=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg=>{
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) reg.update().catch(()=>{}); });
  }).catch(()=>{});
  // the splash used to reload mid-way when an update landed right after opening (CK: "randomly reloads"): now it waits for a quiet moment
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(!hadSW || UPDATE_READY) return; UPDATE_READY=true; if(S.phase==='setup' && !document.getElementById('splash')) reloadQuiet(); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && UPDATE_READY && S.phase==='setup') reloadQuiet(); });
}
