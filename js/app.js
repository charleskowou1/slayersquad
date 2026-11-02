/* ================= APP =================
   Rendering and taps. The only file that touches the DOM. */
const app = document.getElementById('app'), sheet = document.getElementById('sheet');
const VIEWS = {ceremony:vCeremony, order:vOrder, credits:vCredits, setup:vSetup, modeset:vModeSet, codex:vCodex, lobby:vLobby, story:vStory, scene:vScene, scout:vScout, spin:vSpin, draft:vDraft, pass:vPass, plan:vPlan, ready:vReady, result:vResult, over:vOver};
const quickMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let scored = false, spinShown = null;   // spinShown: the number game already revealed on this screen (for its ding)
// which screen to draw: online, each phone shows the win screen on its own; a crow re-plan reuses the move screen
const viewName = () => isOnline() && S.final && S.localOver ? 'over' : S.phase==='scout' && S.scouting ? 'plan' : S.phase;

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
let lastView='';
try{ history.scrollRestoration='manual'; }catch(e){}
function render(){
  if(isOnline()) S.planFor=S.me;
  const ctl=typeof isCtl==='function' && isCtl(), view = ctl ? ctlViewName() : viewName();   // a phone controlling the TV shows only its moves
  if(view==='over' && !scored && S.mode==='daily'){ scored=true; S.dailyMet=dailyMet(S.daily); if(S.dailyMet) markDaily(S.daily.day); sfx(S.dailyMet?'win':'lose'); }   // no stats
  if(view==='over' && !scored && (isPractice() || S.mode==='story')){ scored=true;   // story and practice don't count toward stats
    if(S.winner!==0) sfx('lose'); }   // story wins are saved (and celebrated) before the ending scene
  if(view==='over' && !scored && isAsync()){ const g=myGame(S.asyncCode); if(g && g.scored===S.matchNo) scored=true; else setGame(S.asyncCode,{scored:S.matchNo}); }   // a reopened game isn't counted twice
  if(view==='plan' && S.round===1 && !matchOn){ matchOn=modeKey(); track([`m_${matchOn}_start`, `d_${todayKey()}_games`]); }
  if(view==='over' && matchOn){ track([`m_${matchOn}_finish`]); matchOn=null; ACTIONS.tipok('played'); }
  if(view==='setup') matchOn=null;
  if(view==='over' && !scored){ scored=true; postStats(statsGame()); if(S.winner>=0){ const sc=loadScore(); players().filter(q=>sameSide(q,S.winner)).forEach(q=>{ const n=S.names[q]; sc[n]=(sc[n]||0)+1; }); saveScore(sc); } recordMatch();
    sfx(S.winner<0 || (soloView() && !sameSide(S.winner,myP())) ? 'lose' : 'win'); }
  if(view!=='over') scored=false;
  // keep fold-out sections (How to play, records…) open across redraws
  const open=[...app.querySelectorAll('details[id]')].filter(d=>d.open).map(d=>d.id);
  document.body.classList.toggle('localmode', S.mode==='local');
  // Until Dawn: a sun climbs over the battle screen as the rounds count down to sunrise (stage.sunrise)
  const st=S.mode==='story' && STAGES[S.stage], fighting=['plan','result','pass','scout','ready'].includes(view);
  // the sun climbs over the battle: Until Dawn (story) over its rounds; every other battle in the 4 rounds before
  // sunrise (round SUNRISE_ROUND), then it burns hotter each round after (--heat)
  const before=4, sky=fighting && !!S.teams && (st ? !!st.sunrise : S.round>SUNRISE_ROUND-before);
  document.body.classList.toggle('dawn', sky);
  document.body.classList.toggle('sunrisetheme', !!hashiraTitle());
  if(sky){ const n=st?st.twist.survive:before, from=st?1:SUNRISE_ROUND-before;
    document.body.style.setProperty('--dawn', Math.max(0, Math.min(1, (S.round-from)/(st?n-1:before))).toFixed(3));
    document.body.style.setProperty('--heat', st ? 0 : Math.max(0, Math.min(1, (S.round-SUNRISE_ROUND)/4)).toFixed(3)); }
  // Story battles fight in front of the battle's place picture (img/places/, the same one as its cutscenes)
  const place=['plan','result','pass','scout','ready','over'].includes(view) && (st ? PLACE_ART[st.id]||PLACE_ART[st.arc] : S.place && PLACE_ART[S.place]);   // story: the battle's place; other modes: the match's
  document.body.classList.toggle('placebg', !!place);
  if(place) document.body.style.setProperty('--placebg', `url('${place}')`);
  cloudCheck();   // back up saved progress a few seconds after it changes
  music(ctl ? null : musicFor(view));   // the TV plays the music, not the controller phone   // each kind of screen has its own theme (cross-fades; nothing happens if it's already playing)   // wide landscape layout (tablets) for Local games
  const vids=new Map([...app.querySelectorAll('video[data-k],img[data-k]')].map(v=>[v.dataset.k,v]));   // a clip already playing keeps playing
  // reuse the picture elements already on screen: a redraw never has to decode them again, so nothing blinks
  const pics=new Map(); app.querySelectorAll('img:not([data-k])').forEach(im=>{ const k=im.getAttribute('src'); if(!pics.has(k)) pics.set(k,[]); pics.get(k).push(im); });
  beforeAwake(()=>{ app.innerHTML=VIEWS[view](); sheet.innerHTML=vSheet(); });
  app.querySelectorAll('img:not([data-k])').forEach(im=>{ const old=(pics.get(im.getAttribute('src'))||[]).shift(); if(old){ old.className=im.className; im.replaceWith(old); } });
  app.querySelectorAll('video[data-k],img[data-k]').forEach(v=>{ const old=vids.get(v.dataset.k); if(old){ v.replaceWith(old); if(old.tagName==='VIDEO') playVid(old); } else if(v.tagName==='VIDEO'){ v.onended=()=>{ if(v.duration<CLIP_LOOP){ v.currentTime=0; playVid(v); } }; playVid(v); } });
  warmClips();
  open.forEach(id=>{ const d=document.getElementById(id); if(d) d.open=true; });
  // Opening the home screen on a phone: Slayer Squad comes first, and Join a TV, Codex and Settings sit just above it (scroll up)
  if(view==='setup' && lastView!=='setup' && window.innerWidth<900 && !(typeof isTV==='function'&&isTV())){ const b=app.querySelector('.setbar'); if(b) window.scrollTo(0, Math.ceil(b.getBoundingClientRect().bottom+window.scrollY-(parseFloat(getComputedStyle(app).paddingTop)-26))+2); }
  lastView=view;
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
    const extra=(special==='sunform'?1300:0)+(!m?0:m.k==='final'?600:m.k==='lone'?500:0);
    const t = extra*pace() + (flurry ? (quickMotion()?400:(1300+320*lines.length)*pace()) : b>a ? groupTime(lines) : line.fx==='awaken' ? Math.max(readTime(line), 3600*pace()) : readTime(line));
    const c=S.play.clip, d=c&&CLIP_DUR[c.src], full=c&&c.first&&!clipIsPic(c.src) ? (!d ? CLIP_MAX : d>=CLIP_LOOP ? Math.min(CLIP_FIRST_MAX, d*1000+400) : CLIP_MIN*pace())   // first time: to the end, at any speed
      : d&&d>=CLIP_LOOP&&S.speed!=='fast' ? Math.min(CLIP_MAX, d*1000+400) : CLIP_MIN*pace();
    S._t=setTimeout(step, S.play.clip ? Math.max(t, full) : S.play.quick ? t*.55 : t);   // a clip beat stays up long enough to watch
  };
  sfx('gong'); clearTimeout(S._t); S._t=setTimeout(step, quickMotion() ? 250 : 1500*pace());   // the "Round N · Fight!" intro
}
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
  home(){ setCampaign('main'); if(UPDATE_READY) return location.reload(); clearTimeout(S._t); clearTimeout(HANDOFF); HANDOFF=null; if(ONLINE.net){ ONLINE.net.leave(); ONLINE.net=null; ONLINE.last=null; ONLINE.offActs=ONLINE.offState=null; }
    if(S.ctl) ctlStop();
    const tv=S.tv, mode=S.mode==='daily'?'cpu':S.mode; S={tv, phase:tv?'tvhome':'setup',mode,vol:S.vol,speed:S.speed,vibeOn:S.vibeOn,clipsOn:S.clipsOn,clipRepeat:S.clipRepeat,install:S.install,names:mode==='local'?localNames():[S.names[S.me||0]||S.names[0]]}; useModeCfg(mode); },
  clips(v){ S.clipsOn=v==='on'; try{ localStorage.setItem('squad-draft-clips',v) }catch(e){} },
  cliprepeat(v){ S.clipRepeat=v; try{ localStorage.setItem('squad-draft-clip-repeat',v) }catch(e){} },
  vibe(v){ S.vibeOn=v==='on'; try{ localStorage.setItem('squad-draft-vibe',v) }catch(e){} },
  rematch(){ if(isOnline()) return onlineRematch(); if(isPractice()) return newDraft(0); toSpin(); },
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
  onew(){ loadModeCfg('online').players>2 ? onlineCreate() : asyncCreate(); },   // 2 players: one game for live or your own pace. 3–4: everyone at once
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
  acreate(){ asyncCreate(); },
  agame(v){ keepNames(); openGame(v); },
  agamex(v){ const g=myGame(v), st=g&&g.meta; if(st && !st.final && st.phase!=='lobby' && !confirm('Remove this game? It can’t be finished after that.')) return;
    const f=GAME_WATCH[v]; if(f){ f(); delete GAME_WATCH[v]; } dropGame(v); gamesBadge(); },
  ojoin(){ onlineJoin(); },
  ojoinopen(){ S.names[0]=myName(); S.joinOpen=!S.joinOpen; S.onlineMsg=''; setTimeout(()=>{ const el=document.getElementById('ocode'); if(el) el.focus(); }); },
  ostart(){ if(iAmHost() && hostStartMatch()) toSpin(); },
  // open a card's detail (from the grid or from a name in a pool note); any card in the pool can be viewed
  sel(v){ if(S.mode==='cpu' && turn()!==0) return;
    if(S.pool.includes(v) || ((S.mode==='daily'||S.mode==='story') && S.picks[1].includes(v))) S.sel=v; },   // the set enemy team can be studied
  unsel(){ S.sel=null; S.info=null; S.settings=false; S.codexSel=null; },
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
    sendReport(msg).then(()=>{ S.reportText=''; S.reportOpen=false; S.reportMsg='Sent. Thank you!'; }).catch(()=>{ S.reportMsg='That didn’t send. Check your connection and try again.'; }).finally(render); },
  quit(v){ S.settings=false; S.quitAsk=false; S.play=null; clearTimeout(S._t); if(v==='map') ACTIONS.storymap(); else ACTIONS.home(); window.scrollTo(0,0); },   // story: leave a battle from Settings
  placecfg(v){ try{ localStorage.setItem(PLACE_KEY,v) }catch(e){} },   // Settings → Battle background
  settab(v){ S.setTab=v; if(v==='stats') loadGlobalStats(); },
  theirs(){ S.showTheirs=!S.showTheirs; },
  install(){ if(INSTALL_EVENT){ INSTALL_EVENT.prompt(); INSTALL_EVENT.userChoice.finally(()=>{ INSTALL_EVENT=null; installInfo(); render(); }); } },
  installlater(){ INSTALL_LATER=true; },
  backupnow(){ cloudBackup(true); },
  restore(){ cloudRestore(); },
  restoreok(){ cloudApply(); },
  unrestore(){ S.restoreFound=null; },
  copycode(){ const c=showCode(loadCloud().code); try{ navigator.clipboard.writeText(c); S.copied=true; setTimeout(()=>{ S.copied=false; render(); },1500); }catch(e){} },
  copyround(){ const ml=S.matchLog||[]; if(ml.length) copyText(roundText(ml[ml.length-1])); },
  copylog(){ copyText(battleLogText()); },
  tipok(v){ try{ const t=JSON.parse(localStorage.getItem(TIPS_KEY))||[]; t.push(v); localStorage.setItem(TIPS_KEY,JSON.stringify([...new Set(t)])); }catch(e){} },
  codex(){ keepNames(); S.phase='codex'; S.codexSel=null; window.scrollTo(0,0); },
  codexf(v){ S.codexF=v; },
  codexsel(v){ S.codexSel=v; },
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
  volmusic(v){ S.vol={...S.vol, music:+v}; saveVolumes(S.vol); applyVolumes(); },
  volsfx(v){ S.vol={...S.vol, sfx:+v}; saveVolumes(S.vol); applyVolumes(); sfx('pick'); },
  storymap(){ keepNames(); clearTimeout(S._t); S.mode='story'; S.phase='story'; S.storySel=nextStage(); S.storyScroll=true; },
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
  focus(v){ S.focus = focusOf(S.planFor)===v ? 'none' : v; },
  act(v,b){ const u=findU(b.dataset.u); setMove(u,v); if(unitReady(u)) advanceFocus(u.p); },
  tgt(v,b){ const u=findU(b.dataset.u); S.plans[u.p][u.uid].t=v; advanceFocus(u.p); },
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
  next(){ if(storyMid()) return; if(isAsync()) return asyncWatched(); if(isOnline()){ onlineNext(); return window.scrollTo(0,0); } S.round++; S.planFor=S.mode==='local'?nextChooser(-1):0; S.play=null; S.phase=S.mode==='local'&&!S.tvDuo?'pass':'plan'; newPlanTurn(); },
  finish(){ if(isAsync()) setGame(S.asyncCode,{seen:{m:S.matchNo, r:S.roundId}}); if(isOnline()){ S.asyncWatching=false; S.localOver=true; return window.scrollTo(0,0); } S.play=null;
    if(S.mode==='story' && S.winner===0) return storyWon_();   // ending scene and unlocks first
    S.phase='over'; window.scrollTo(0,0); },
};
// Opening splash: "a Kwow Media Productions game" with its sting, then the home screen (CK). Phones only allow sound
// inside a tap, so it waits for one ("Tap to start"); shown once each time the game is opened. ?nosplash skips it.
(function splash(){
  const el=document.getElementById('splash'); if(!el) return;
  if(/nosplash/.test(location.search) || navigator.webdriver){ el.remove(); return; }
  let gone=false;
  const go=()=>{ if(gone) return; gone=true; unlockSound(); sfx('intro'); el.classList.add('go');
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(), 700); }, quickMotion()?300:2400); };
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
  if(['storymap','daily','openmode'].includes(b.dataset.a) && S.phase==='setup' && !playerName() && !NAME_SKIPPED && !(typeof isTV==='function'&&isTV())){
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
function findArt(){
  const found={}, ids=ROSTER.map(c=>c.id).concat(EXTRA_ART);
  let waiting=ids.length;
  const finish=()=>{ if(--waiting>0) return;
    ROSTER.forEach(c=>{ const src=found[c.id]||found[c.id.replace(/_mark$/,'')]||found[c.fam]; if(src) ART[c.id]=src; });
    EXTRA_ART.forEach(id=>{ if(found[id]) ART[id]=found[id]; });
    if(Object.keys(ART).length) render(); };
  ids.forEach(id=>{
    const exts=['jpg','png','webp'];
    const tryNext=()=>{ const ext=exts.shift(); if(!ext) return finish();
      const im=new Image(); im.onload=()=>{ found[id]=im.src; ART_KEEP.push(im); if(im.decode) im.decode().catch(()=>{}); finish(); }; im.onerror=tryNext; im.src=`img/${id}.${ext}`; };
    tryNext();
  });
}
// Scene pictures (img/scenes/<name>.jpg/png/webp) for story lines that ask for one; lines without a file keep the portraits
// Place pictures behind the cutscenes: img/places/<battle id>.jpg/png/webp, or <arc id> for a whole arc (optional,
// see img/README.txt)
function findPlaces(){
  [...ALL_STAGES.map(st=>st.id), ...Object.keys(ARCS)].forEach(arc=>{ const exts=['jpg','png','webp','jpeg'];
    const tryNext=()=>{ const ext=exts.shift(); if(!ext) return;
      const im=new Image(); im.onload=()=>{ PLACE_ART[arc]=im.src; if(S.phase==='scene') render(); }; im.onerror=tryNext; im.src=`img/places/${arc}.${ext}`; };
    tryNext(); });
}
function findScenePics(){
  scenePics().forEach(name=>{ const exts=['jpg','png','webp','jpeg'];
    const tryNext=()=>{ const ext=exts.shift(); if(!ext) return;
      const im=new Image(); im.onload=()=>{ SCENE_ART[name]=im.src; if(S.phase==='scene') render(); }; im.onerror=tryNext; im.src=`img/scenes/${name}.${ext}`; };
    tryNext(); });
}
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
      const v=snap.val();
      const res=await room.child('seats').transaction(seats=>{ seats=seats||{}; for(let i=1;i<=3;i++){ if(!seats[i]||!seats[i].on){ seats[i]={name,on:true}; seat=i; return seats; } } return; });
      if(!res.committed || !seat) throw new Error('That game is full (4 players).');
      presence(); return {room:v, seat}; },
    publish(json, q){ room.child('state/'+q).set(json); },
    send(msg){ room.child('acts').push(JSON.parse(JSON.stringify(msg))); },   // Firebase rejects undefined (e.g. a Defend move's empty target)
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
  ONLINE.net.onSeats(seats=>{ if(S.phase==='lobby') S.lobby.seats=seats; const a=Object.assign({},S.away); seats.forEach((x,i)=>{ a[i+1]= !!x && !x.on; }); S.away=a; presenceChanged(); });
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
async function onlineJoin(){
  const el=document.getElementById('ocode'), code=((el&&el.value)||'').trim().toUpperCase(); S.joinCode=code;
  if(/^[A-Z]{6}$/.test(code)) return asyncJoin(code);
  if(/^[A-Z]{4}$/.test(code) && await tvRoom(code)) return ctlJoin(code);   // a TV's code: this phone becomes its controller
  if(!/^[A-Z]{4}$/.test(code)){ S.onlineMsg='Type the code from the other phone (4 or 6 letters).'; return render(); }
  const name=titled(myName()); S.names[0]=name; S.onlineMsg='Joining…'; render();
  try{
    const net=await firebaseNet('guest'), {room, seat}=await net.join(code,name);
    ONLINE.net=net; ONLINE.offActs=ONLINE.offState=null; ONLINE.tookFrom=[];
    Object.assign(S,{me:seat, planFor:seat, hostSeat:room.hostSeat||0, away:{}, names:[(room.host&&room.host.name)||'Host', name], lobbyHost:(room.host&&room.host.name)||'Host', lobby:{code, seats:[]}, phase:'lobby', onlineMsg:''});
    listenAsGuest(); watchPresence();
    render();
  }catch(e){ S.onlineMsg=e.message||'Could not join.'; render(); }
}
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
      return ref.transaction(g=>{ res=null; if(!g || !g.s) return g; const r=asyncApply(g.s, msg); if(!r) return; res=r; return Object.assign({}, g, {s:r.json, meta:r.meta}); })
        .then(t=>{ if(t.committed && res && res.ended) postStats({...res.ended, humans:res.ended.humans}); return t.committed && !!res; })
        .catch(e=>{ S.onlineMsg=netError(e); render(); return false; }); },
    onGame(cb){ const f=s=>{ const v=s.val(); if(v && v.s) cb(v); else if(!v){ setGame(code,{gone:true}); } }; ref.on('value',f); offs.push(()=>ref.off('value',f)); },
    // this phone is in the game right now (the other phone shows it, so a game can play live or wait); the server clears it if the phone drops
    here(db, seat){ const me=ref.child('here/'+seat), c=db.ref('.info/connected'), f=s=>{ if(s.val()){ me.onDisconnect().remove().catch(()=>{}); me.set(true).catch(()=>{}); } };
      c.on('value',f); offs.push(()=>{ c.off('value',f); me.onDisconnect().cancel().catch(()=>{}); me.remove().catch(()=>{}); }); },
    leave(){ offs.forEach(f=>f()); offs.length=0; },
  };
}
async function asyncCreate(){
  const name=titled(myName()); S.names[0]=name; S.onlineMsg='Connecting…'; render();
  try{
    const db=await firebaseReady(), c=useModeCfg('online'), now=Date.now();
    const state=JSON.stringify({phase:'lobby', n:2, names:[name], budget:c.budget, poolType:c.poolType, maxTeam:c.maxTeam, bansOn:!!c.bans, async:true, hostSeat:-1, duo:false, matchNo:0});
    let code=null;
    for(let i=0;i<8 && !code;i++){ const k=newGameCode(), r=await db.ref('games/'+k).transaction(v=>v ? undefined : {created:now, s:state, meta:{names:[name], matchNo:0, phase:'lobby', turn:[], round:0, roundId:0, final:false, winner:null, updated:now}}); if(r.committed) code=k; }
    if(!code) throw new Error('Could not make a game code. Try again.');
    setGame(code,{seat:0}); watchGames(); await openGame(code);
  }catch(e){ S.onlineMsg=netError(e); render(); }
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
    ONLINE.net=asyncNet(db, code); ONLINE.full=null; ONLINE.offActs=ONLINE.offState=null; ONLINE.net.here(db, g.seat);
    ONLINE.net.onGame(v=>{ if(!isAsync() || S.asyncCode!==code) return; ONLINE.full=v.s; S.oppHere=!!(v.here&&v.here[1-g.seat]); setGame(code,{meta:v.meta, gone:false});
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
      ref.on('value',f); GAME_WATCH[g.code]=()=>ref.off('value',f); });
  }catch(e){}
}
function gamesBadge(){
  const n=gamesToPlay();
  document.title = n ? `(${n}) Slayer Squad` : 'Slayer Squad';
  try{ if(n && navigator.setAppBadge) navigator.setAppBadge(n); else if(navigator.clearAppBadge) navigator.clearAppBadge(); }catch(e){}
}

/* ---------- shared stats (see online.js): sent when a match ends, read for the Codex and the Stats tab ---------- */
// The match that just ended, as the stats count it (null = not counted: Story, Practice, the daily challenge, and
// online games, which are counted once by the phone that hosts / ended them)
function statsGame(){
  if(S.mode==='story' || S.mode==='daily' || isPractice() || !S.teams) return null;
  if(isOnline() && (isAsync() || !iAmHost())) return null;
  return {pool:S.pool||[], poolType:S.poolType, teams:players().map(p=>S.teams[p].filter(u=>!u.spawn).map(u=>u.id)), helpers:players().map(p=>(S.picks[p]||[]).filter(isHelper)),
    won:players().map(p=>S.winner>=0 && sameSide(S.winner,p)), humans: S.mode==='cpu' ? [0] : players()};
}
// Anonymous counters for CK's admin page: no names, just how often things happen. Skipped on his own browser.
let matchOn=null;
const modeKey = () => (typeof isTV==='function'&&isTV()?'tv_':'')+(S.mode==='online'?'online'+S.n:S.mode);
function track(keys){
  try{ if(!FIREBASE_CONFIG || !navigator.onLine || navigator.webdriver || location.hostname==='localhost' || localStorage.getItem('squad-draft-admin')) return; }catch(e){ return; }
  firebaseReady().then(db=>{ const inc=firebase.database.ServerValue.increment(1), up={}; keys.forEach(k=>up[k]=inc); return db.ref('track').update(up); }).catch(()=>{});
}
function trackOpen(){
  const day=todayKey(), keys=[`d_${day}_opens`]; let t={}; try{ t=JSON.parse(localStorage.getItem('squad-draft-track'))||{} }catch(e){}
  if(t.day!==day) keys.push(`d_${day}_players`);
  if(!t.day){ const ua=navigator.userAgent||''; keys.push('players', `d_${day}_new`, 'dev_'+(/iphone|ipad|ipod/i.test(ua)?'ios':/android/i.test(ua)?'android':'computer')); }
  try{ localStorage.setItem('squad-draft-track',JSON.stringify({day})) }catch(e){}
  track(keys);
}
setTimeout(trackOpen, 5000);
const gameVersion = async () => { try{ return ((await caches.keys()).find(k=>k.startsWith('squad-draft-v'))||'').replace('squad-draft-v','') }catch(e){ return '' } };
async function sendReport(msg, auto){
  const db=await firebaseReady();
  await db.ref('reports').push({at:Date.now(), msg:String(msg).slice(0,500), v:await gameVersion(), ua:(navigator.userAgent||'').slice(0,200), where:String(S.mode+' / '+S.phase).slice(0,60), auto:auto?1:0});
}
// Crashes report themselves (at most 3 each time the game is open)
let CRASHES=0;
window.addEventListener('error',e=>{ if(!e.filename || CRASHES>=3 || navigator.webdriver || location.hostname==='localhost' || !navigator.onLine) return; CRASHES++;
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
   Needs the 'saves' rule in the Firebase console (see CLAUDE.md). Until then backups fail quietly and Settings says so. */
const CLOUD_KEY = 'squad-draft-cloud', CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const NOT_BACKED = ['squad-draft-cloud','squad-draft-data','squad-draft-install-later'];
const loadCloud = () => { try{ return JSON.parse(localStorage.getItem(CLOUD_KEY))||{} }catch(e){ return {} } };
const saveCloud = c => { try{ localStorage.setItem(CLOUD_KEY, JSON.stringify(c)) }catch(e){} };
const newSaveCode = () => Array.from({length:12},()=>CODE_ABC[Math.floor(Math.random()*CODE_ABC.length)]).join('');
const showCode = c => c ? c.match(/.{4}/g).join('-') : '';
function saveData(){ const d={}; try{ Object.keys(localStorage).filter(k=>k.startsWith('squad-draft') && !NOT_BACKED.includes(k)).sort().forEach(k=>{ d[k]=localStorage.getItem(k); }); }catch(e){} return d; }
// worth backing up once there's real progress (not a brand-new phone)
const hasProgress = d => ['squad-draft-story-v2','squad-draft-records','squad-draft-score','squad-draft-daily'].some(k=>d[k] && d[k]!=='{}' && d[k]!=='{"cleared":[]}');
let CLOUD = {timer:null, last:'', busy:false, status:''};
function cloudCheck(){   // called after every redraw: schedule a backup when the saved data changed
  if(!FIREBASE_CONFIG) return; const d=saveData(), j=JSON.stringify(d);
  if(j===CLOUD.last || !hasProgress(d)) return;
  clearTimeout(CLOUD.timer); CLOUD.timer=setTimeout(()=>cloudBackup(), 4000);
}
async function cloudBackup(force){
  if(CLOUD.busy || (!navigator.onLine && !force)) return; CLOUD.busy=true;
  const d=saveData(), j=JSON.stringify(d), c=loadCloud();
  try{
    const db=await firebaseReady(); if(!c.code){ c.code=newSaveCode(); }
    await db.ref('saves/'+c.code).set({v:1, at:Date.now(), data:d});
    c.last=Date.now(); saveCloud(c); CLOUD.last=j; CLOUD.status='';
  }catch(e){ CLOUD.status = /permission/i.test(e.message||'') ? 'rules' : 'offline'; }
  CLOUD.busy=false; if(S.settings && S.setTab==='save') render();
}
// Restore: first tap looks the code up, the second confirms (it replaces this phone's progress), then the game reloads
async function cloudRestore(){
  const el=document.getElementById('restorecode'), raw=((el&&el.value)||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  S.restoreCode=raw;
  if(raw.length!==12){ S.restoreMsg='Type the 12-character code (dashes are optional).'; return render(); }
  S.restoreMsg='Looking it up…'; render();
  try{ const db=await firebaseReady(), snap=await db.ref('saves/'+raw).get();
    if(!snap.exists()){ S.restoreMsg='No backup with that code.'; return render(); }
    S.restoreFound={code:raw, at:snap.val().at, data:snap.val().data}; S.restoreMsg='';
  }catch(e){ S.restoreMsg=/permission/i.test(e.message||'')?"Cloud backup isn't switched on yet.":'Could not connect. Check your internet.'; }
  render();
}
function cloudApply(){
  const f=S.restoreFound; if(!f) return;
  try{ Object.keys(localStorage).filter(k=>k.startsWith('squad-draft') && !NOT_BACKED.includes(k)).forEach(k=>localStorage.removeItem(k));
    Object.entries(f.data||{}).forEach(([k,v])=>localStorage.setItem(k,v)); saveCloud({code:f.code, last:f.at}); }catch(e){}
  location.reload();
}
S.vol=loadVolumes(); S.speed=loadSpeed(); try{ S.vibeOn=localStorage.getItem('squad-draft-vibe')!=='off'; S.clipsOn=localStorage.getItem('squad-draft-clips')!=='off'; S.clipRepeat=localStorage.getItem('squad-draft-clip-repeat')||'first' }catch(e){}
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
// Offline support and home-screen install (only works when served over http/https, not from a local file)
// Updates: a phone that keeps the game open in the background never reloads it, so check for a new version whenever
// the game comes back to the screen; when one arrives, reload right away on the home screen, or on the next return home.
let UPDATE_READY=false;
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  const hadSW=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg=>{
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) reg.update().catch(()=>{}); });
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(!hadSW || UPDATE_READY) return; UPDATE_READY=true; if(S.phase==='setup') location.reload(); });
}
