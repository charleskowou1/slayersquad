/* ================= SOUND AND MUSIC =================
   Everything is made on the fly with the Web Audio API: no audio files (nothing to license on the public site).
   Phones only allow sound after a tap, so audio starts on the first tap (unlockSound in app.js).
   Two volumes in Settings: Music and Effects (Off / Low / Medium / High), saved per phone.
   - Effects: hits, knockouts, heals… plus one sound per breathing style (water swirl, thunder crack, flame roar…),
     a cut-in sound when a special fires, and scene sounds (typing ticks, the unlock sting).
   - Music: short looping pieces composed from Japanese scales (miyako-bushi, in-sen) with koto-like plucks,
     a shakuhachi-like flute, soft pads and taiko drums. One theme per kind of screen (menu, draft, battle) and a mood
     per story arc; music(name) cross-fades to it. */
const VOL_LEVELS = [0, .35, .7, 1];   // Off, Low, Medium, High
const VOL_KEY = 'squad-draft-volume';
// defaults (CK): music off, effects low
function loadVolumes(){ try{ const v=JSON.parse(localStorage.getItem(VOL_KEY)); if(v) return v; }catch(e){} return {music:0, sfx:1}; }
function saveVolumes(v){ try{ localStorage.setItem(VOL_KEY, JSON.stringify(v)) }catch(e){} }
let AC = null, NOISE = null, SFX_OUT = null, MUSIC_OUT = null;
// Called on every tap (not just the first): phones only let audio start or resume inside a tap, and they pause it
// whenever the screen locks, you switch apps, or a call or notification comes in (iPhones call that 'interrupted').
function unlockSound(){
  if(typeof AudioContext==='undefined' && typeof webkitAudioContext==='undefined') return;
  if(!AC){
    // iPhone: a 'playback' session keeps an audio symbol on the Dynamic Island the whole time the game is open (Safari 17+)
    try{ if(navigator.audioSession) navigator.audioSession.type='ambient'; }catch(e){}   // ambient: no audio symbol on the iPhone's Dynamic Island (CK, Nov 1, 2026), but the silent switch mutes the game
    AC = new (window.AudioContext || window.webkitAudioContext)();
    NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d=NOISE.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    SFX_OUT = AC.createGain(); SFX_OUT.connect(AC.destination);
    MUSIC_OUT = AC.createGain(); MUSIC_OUT.connect(AC.destination);
    applyVolumes();
  }
  if(AC.state!=='running'){
    try{ AC.resume(); }catch(e){}
    // older iPhones only really wake up once something plays during the tap: a silent one-sample sound does it
    try{ const b=AC.createBuffer(1,1,22050), src=AC.createBufferSource(); src.buffer=b; src.connect(AC.destination); src.start(0); }catch(e){}
  }
  if(MUSIC.want && !MUSIC.playing) startMusic(MUSIC.want);
}
function applyVolumes(){
  if(!AC) return; const v=S.vol||loadVolumes();
  SFX_OUT.gain.setTargetAtTime(VOL_LEVELS[v.sfx], AC.currentTime, .05);
  MUSIC_OUT.gain.setTargetAtTime(VOL_LEVELS[v.music]*.55, AC.currentTime, .3);
}
// one tone: type, start/end frequency (Hz), length (s), volume, delay (s), output
function tone(type, f0, f1, len, vol=.25, at=0, out=SFX_OUT){
  const t=AC.currentTime+at, o=AC.createOscillator(), g=AC.createGain();
  o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+len);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+len);
  o.connect(g).connect(out); o.start(t); o.stop(t+len+.02);
}
// a burst of filtered noise: filter type, start/end frequency, length, volume, delay
function hiss(filter, f0, f1, len, vol=.3, at=0, out=SFX_OUT, q=1.2){
  const t=AC.currentTime+at, src=AC.createBufferSource(), bq=AC.createBiquadFilter(), g=AC.createGain();
  src.buffer=NOISE; src.loop=true; bq.type=filter; bq.Q.value=q;
  bq.frequency.setValueAtTime(f0,t); bq.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+len);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+len);
  src.connect(bq).connect(g).connect(out); src.start(t); src.stop(t+len+.02);
}
// A sword (CK found the old ringing tones annoying): air rushing past a swinging blade, then a very short, bright
// scrape of steel on contact, mostly noise, with a touch of uneven metal partials that die in under 0.1 s.
// Each swing varies a little so repeated hits don't sound identical.
function swoosh(at, vol, len=.2){ const j=.9+Math.random()*.2; hiss('bandpass',320*j,2600*j,len,vol,at,SFX_OUT,1.6); }
function steel(at, vol){ const j=.94+Math.random()*.12;
  hiss('bandpass',6200*j,3400*j,.09,vol*1.7,at,SFX_OUT,7);          // the scrape
  tone('triangle',3150*j,2950*j,.07,vol*.35,at); tone('sine',4720*j,4500*j,.05,vol*.22,at); }
function shing(at, vol){ steel(at, vol); }   // older callers: now the short steel scrape, not a ring
function taikoHit(at, vol=.4, out=SFX_OUT){ tone('sine',95,48,.45,vol,at,out); hiss('lowpass',600,90,.18,vol*.45,at,out); }
const SFX = {
  // the opening sting (Kwow Media Productions): a taiko hit, a quick koto run up the miyako scale, then a second hit
  // under a bright chime that rings out
  intro(){ const t0=AC.currentTime; taikoHit(0,.55); tone('sine',73.4,55,1.4,.22,0);
    [62,63,67,69,70,74,75,79].forEach((m,i)=>pluck(midiHz(m), t0+.14+i*.065, 1, .17, SFX_OUT));
    taikoHit(.72,.5); [1174.7,1760,2349.3].forEach((f,i)=>tone('sine',f,f*.998,2.4,.1-.025*i,.72)); hiss('highpass',6000,9500,1.3,.05,.72); },
  // attacks (timed with the lunge): a soft blade whoosh, a short metallic "shing", then a light impact
  slash(){ swoosh(.12,.12,.2); steel(.3,.06); hiss('highpass',1800,500,.07,.08,.31); tone('sine',150,60,.12,.14,.31); },
  bighit(){ swoosh(.1,.15,.24); steel(.3,.08); hiss('highpass',1600,400,.09,.1,.31); tone('sine',110,40,.3,.3,.32); hiss('lowpass',500,80,.25,.12,.32); },
  bighitTail(){ tone('sine',90,40,.3,.25,.32); hiss('lowpass',500,80,.25,.1,.32); },
  ko(){ tone('sine',90,28,.8,.55,.3); hiss('lowpass',1200,60,.7,.4,.3); tone('triangle',220,110,.5,.15,.45); },
  miss(){ hiss('highpass',2500,6000,.25,.18,.2); },
  block(){ tone('triangle',900,700,.25,.2,.25); tone('triangle',1350,1100,.2,.12,.27); },
  heal(){ tone('sine',660,660,.35,.16,.1); tone('sine',990,990,.4,.14,.22); tone('sine',1320,1320,.45,.1,.34); },
  guard(){ tone('triangle',520,520,.3,.16,.1); tone('sine',780,780,.35,.1,.15); },
  poison(){ tone('sawtooth',180,120,.5,.06,.15); hiss('bandpass',600,300,.4,.12,.15); },
  stun(){ tone('sine',700,350,.35,.12,.1); tone('sine',600,300,.35,.1,.3); },
  special(){ tone('sawtooth',160,820,.45,.08,0); hiss('bandpass',800,4000,.45,.15,0); tone('sine',1200,1200,.3,.08,.4); },
  // the special-move cut-in: a whoosh as the band slides in, a sword ring, then a taiko hit
  cutin(){ hiss('bandpass',400,3200,.35,.16,0,SFX_OUT,.8); shing(.12,.1); taikoHit(.2,.42); },
  spawn(){ tone('square',300,600,.2,.06,.1); tone('square',450,900,.2,.06,.25); },
  gong(){ tone('sine',196,190,1.4,.35); tone('sine',392,380,1.1,.12); tone('triangle',588,570,.8,.06); },
  tick(){ tone('square',1800,1700,.03,.05); },
  ding(){ tone('sine',1046,1046,.6,.2); tone('sine',1568,1568,.5,.1,.05); },
  pick(){ tone('sine',520,780,.12,.12); },
  // story: the "You have unlocked" sting and a soft page-turn for scene lines
  unlock(){ [587,740,880,1175].forEach((f,i)=>tone('triangle',f,f,.5,.14,i*.09)); hiss('highpass',3000,8000,.9,.05,.3); tone('sine',1760,1760,1,.06,.4); },
  page(){ hiss('bandpass',1800,900,.12,.05); },
  vs(){ hiss('lowpass',300,2000,.4,.12); taikoHit(.3,.5); taikoHit(.55,.35); },
  win(){ [523,659,784,1046].forEach((f,i)=>tone('triangle',f,f,.35,.18,i*.14)); tone('sine',1046,1046,.9,.14,.56); },
  lose(){ [392,330,262].forEach((f,i)=>tone('triangle',f,f*.98,.45,.16,i*.22)); },
};
// One sound per breathing style, layered over the hit (quietly) or played in full for a special
const STYLE_SFX = {
  water:  v=>{ hiss('bandpass',2400,500,.5,.16*v,0,SFX_OUT,2); [880,1175,1480].forEach((f,i)=>tone('sine',f,f*1.4,.12,.05*v,.05+i*.06)); },
  flame:  v=>{ hiss('lowpass',300,2600,.45,.22*v); hiss('bandpass',900,400,.5,.1*v,.15); tone('sawtooth',90,160,.4,.05*v); },
  thunder:v=>{ hiss('highpass',4000,1200,.12,.34*v); tone('square',1400,200,.08,.08*v); tone('sine',70,40,.7,.3*v,.08); },
  darkthunder:v=>{ hiss('highpass',2500,800,.14,.3*v); tone('sawtooth',300,90,.25,.08*v); tone('sine',55,35,.8,.3*v,.08); },
  sun:    v=>{ [523,659,784,1046].forEach((f,i)=>tone('triangle',f,f,.6,.07*v,i*.03)); hiss('highpass',2000,6000,.5,.08*v); tone('sine',130,65,.5,.2*v,.1); },
  mist:   v=>{ hiss('highpass',1500,4000,.8,.08*v); tone('sine',660,620,.6,.04*v,.1); },
  wind:   v=>{ hiss('bandpass',400,3000,.25,.18*v,0,SFX_OUT,3); hiss('bandpass',3000,500,.3,.14*v,.22,SFX_OUT,3); },
  stone:  v=>{ tone('sine',70,35,.5,.42*v); hiss('lowpass',800,100,.35,.22*v,.02); hiss('bandpass',2000,1200,.2,.06*v,.1); },
  love:   v=>{ [988,1319,1568].forEach((f,i)=>tone('sine',f,f,.3,.06*v,i*.05)); hiss('highpass',2500,5000,.3,.07*v); },
  flower: v=>{ [784,1046,1319].forEach((f,i)=>tone('sine',f,f,.35,.06*v,i*.07)); },
  serpent:v=>{ hiss('highpass',3500,5500,.5,.12*v); tone('sine',300,200,.3,.05*v,.15); },
  sound:  v=>{ tone('square',220,200,.15,.08*v); hiss('lowpass',1200,100,.3,.3*v,.02); tone('square',330,300,.15,.06*v,.18); hiss('lowpass',1200,100,.3,.25*v,.2); },
  insect: v=>{ for(let i=0;i<8;i++) tone('sine',2600+i*40,2500,.03,.04*v,i*.035); },
  beast:  v=>{ tone('sawtooth',110,70,.35,.1*v); hiss('lowpass',700,200,.35,.12*v); },
  moon:   v=>{ tone('sine',740,620,.7,.08*v); tone('sine',747,625,.7,.07*v); hiss('highpass',3000,6000,.4,.05*v); },
  ice:    v=>{ [2093,2637,3136,2349].forEach((f,i)=>tone('sine',f,f,.15,.05*v,i*.05)); hiss('highpass',5000,8000,.3,.06*v); },
  blood:  v=>{ hiss('lowpass',600,150,.3,.22*v); tone('sine',150,80,.25,.12*v); },
  compass:v=>{ tone('sine',120,60,.18,.4*v); hiss('highpass',2000,3000,.05,.12*v); },
  thread: v=>{ tone('sine',3000,1800,.12,.06*v); tone('sine',2800,1600,.12,.05*v,.08); },
  drum:   v=>{ taikoHit(0,.45*v); taikoHit(.18,.3*v); },
  claw:   v=>{ hiss('bandpass',3000,1500,.1,.14*v,0,SFX_OUT,4); hiss('bandpass',3200,1600,.1,.12*v,.08,SFX_OUT,4); },
  dream:  v=>{ [523,659,784,988].forEach((f,i)=>tone('sine',f,f*1.02,.6,.05*v,i*.12)); },
  slash:  v=>{ shing(0,.06*v); },
};
// Basic attacks: what the fighter swings. Blades ring; fists, claws and demon arts sound like themselves.
const WEAPON = {akaza:'fist', hakuji:'fist', typezero:'blade', hand:'claw', swamp:'claw', kyogai:'drum', rui:'thread', enmu:'dream', muzan:'whip', muzan_final:'whip',
  doma:'fan', gyutaro:'sickle', daki:'obi', gyokko:'blunt', susamaru:'blunt', yahaba:'arrow', nezuko:'kick', nezuko_awakened:'kick', tanjiro_demon:'claw',
  tamayo:'blood', yushiro:'claw', hantengu:'claw', hantengu_true:'claw', sekido:'staff', karaku:'fan', aizetsu:'spear', urogi:'claw', zohakuten:'staff', kokushibo:'blade', kaigaku:'blade'};
const ATTACK_SFX = {
  blade:  v=>{ swoosh(.12,.13*v,.2); steel(.3,.06*v); hiss('highpass',1800,500,.07,.08*v,.31); tone('sine',150,60,.12,.14*v,.31); },
  fist:   v=>{ hiss('lowpass',800,200,.08,.12*v,.2); tone('sine',150,55,.16,.5*v,.28); hiss('highpass',2500,4000,.04,.1*v,.28); },
  kick:   v=>{ hiss('bandpass',600,1400,.12,.1*v,.18); tone('sine',120,50,.18,.42*v,.28); },
  claw:   v=>{ hiss('bandpass',3200,1400,.1,.16*v,.24,SFX_OUT,4); hiss('bandpass',3400,1500,.1,.13*v,.32,SFX_OUT,4); tone('sine',110,60,.1,.12*v,.3); },
  whip:   v=>{ hiss('highpass',1500,6000,.12,.16*v,.2); hiss('highpass',6000,2000,.06,.22*v,.3); tone('sine',90,50,.15,.18*v,.32); },
  fan:    v=>{ hiss('bandpass',800,2400,.22,.12*v,.15,SFX_OUT,2); [2093,2637].forEach((f,i)=>tone('sine',f,f,.12,.04*v,.3+i*.04)); },
  sickle: v=>{ for(let i=0;i<3;i++) hiss('bandpass',1800,900,.07,.1*v,.16+i*.06,SFX_OUT,3); shing(.34,.05*v); },
  obi:    v=>{ hiss('bandpass',500,2000,.22,.12*v,.15,SFX_OUT,1.5); tone('sine',160,90,.12,.14*v,.32); },
  blunt:  v=>{ hiss('lowpass',500,150,.1,.15*v,.2); tone('sine',180,80,.16,.35*v,.28); },
  arrow:  v=>{ hiss('highpass',3000,6500,.14,.12*v,.15); tone('sine',900,300,.08,.06*v,.3); tone('sine',140,70,.1,.14*v,.32); },
  drum:   v=>{ taikoHit(.25,.45*v); },
  thread: v=>{ tone('sine',3200,1800,.1,.06*v,.2); tone('sine',3000,1700,.1,.05*v,.27); tone('sine',150,80,.08,.1*v,.32); },
  dream:  v=>{ tone('sine',660,990,.25,.06*v,.2); tone('sine',140,70,.1,.1*v,.32); },
  blood:  v=>{ hiss('lowpass',700,150,.25,.2*v,.2); tone('sine',140,70,.12,.12*v,.3); },
  staff:  v=>{ hiss('highpass',1200,2400,.12,.1*v,.18); tone('sine',110,50,.2,.35*v,.3); },
  spear:  v=>{ hiss('highpass',2000,5000,.1,.12*v,.2); tone('sine',160,70,.12,.25*v,.3); },
};
const sfxOn = () => AC && (S.vol||loadVolumes()).sfx>0;
function sfx(name){ if(!sfxOn() || document.hidden) return;   // nothing plays once you've left the game
  try{ if(AC.state!=='running') AC.resume(); SFX[name] && SFX[name](); }catch(e){} }
function styleSfx(style, v){ if(!sfxOn() || document.hidden) return; try{ (STYLE_SFX[style]||STYLE_SFX.slash)(v); }catch(e){} }
// The sound for one playback line: the base sound plus the attacker's breathing style
// A character's own sound for a clip moment (js/clips.js CLIP_SOUNDS): downloaded once, played at the effects volume
const CLIP_AUDIO = {};
function clipSound(url){
  if(!sfxOn() || document.hidden) return;
  const go=buf=>{ try{ if(AC.state!=='running') AC.resume(); const s=AC.createBufferSource(); s.buffer=buf; s.connect(SFX_OUT); s.start(); }catch(e){} };
  if(CLIP_AUDIO[url] instanceof AudioBuffer) return go(CLIP_AUDIO[url]);
  if(CLIP_AUDIO[url]) return;   // still loading
  CLIP_AUDIO[url]=fetch(url).then(r=>r.arrayBuffer()).then(a=>AC.decodeAudioData(a)).then(b=>{ CLIP_AUDIO[url]=b; go(b); }).catch(()=>{ delete CLIP_AUDIO[url]; });
}
function sfxForLine(line){
  if(line.c==='r') return sfx('gong');
  if(line.fx==='say') return sfx('page');
  if(line.fx==='awaken') return sfx('unlock');
  const big=/\[-(\d+)%\]/.exec(line.t), hard=big && +big[1]>=30, by=line.by && typeof findU==='function' && findU(line.by);
  const style = by && typeof styleOf==='function' ? styleOf(by, line.move) : null;
  if(line.fx==='special'){ sfx('cutin'); if(style) setTimeout(()=>styleSfx(style, 1), 250); return; }
  // a basic attack: the fighter's own weapon, their breathing style on top
  if(line.fx==='hit' && by && line.move==='attack' && sfxOn() && !document.hidden){
    const w=WEAPON[by.id] || (by.demon ? 'claw' : 'blade');
    try{ ATTACK_SFX[w](hard?1.25:1); }catch(e){}
    if(style) setTimeout(()=>styleSfx(style, hard?.75:.55), 300);
    if(hard) setTimeout(()=>sfx('bighitTail'), 0);
    return;
  }
  sfx({hit:hard?'bighit':'slash', ko:'ko', miss:'miss', block:'block', heal:'heal', revive:'heal', buff:'heal', guard:'guard',
    poison:'poison', stun:'stun', burn:'bighit', spawn:'spawn'}[line.fx]);
  if(style && (line.fx==='hit'||line.fx==='ko')) setTimeout(()=>styleSfx(style, hard?.7:.45), 280);
}
// Scene lines type themselves out: soft ticks while they do (stopped when the line is skipped)
let TYPE_OUT=null;
function typeTicks(chars){
  if(!sfxOn()) return; if(TYPE_OUT){ try{ TYPE_OUT.disconnect(); }catch(e){} }
  TYPE_OUT=AC.createGain(); TYPE_OUT.gain.value=1; TYPE_OUT.connect(SFX_OUT);
  for(let i=0;i<chars;i+=3) tone('square',1500+((i*37)%400),1400,.02,.018,i*.028,TYPE_OUT);
}
function stopTypeTicks(){ if(TYPE_OUT){ try{ TYPE_OUT.disconnect(); }catch(e){} TYPE_OUT=null; } }

/* ---------- music ---------- */
// Scales as semitones from the root. Miyako-bushi (the classic koto sound) for calm, in-sen for darker, yo for bright.
const SCALES = {miyako:[0,1,5,7,8], insen:[0,1,5,7,10], yo:[0,2,5,7,9]};
// theme: tempo, root (MIDI note), scale, chord progression (scale degrees), and which instruments play
const THEMES = {
  menu:   {bpm:52,  root:50, scale:'yo',     prog:[0,3,1,3], koto:'slow', flute:.25,pad:.7, taiko:0,  bass:.3},   // calm (CK: the old one wasn't)
  draft:  {bpm:88,  root:52, scale:'yo',     prog:[0,2,3,1], koto:'arp',  flute:.3, pad:.3, taiko:.3, bass:.6},
  // battle (CK: more intense): faster, a driving bass line, hi-hats, shamisen-like power stabs and a taiko fill every 4 bars
  battle: {bpm:140, root:50, scale:'insen',  prog:[0,0,3,2,0,0,4,1], koto:'stab', flute:.55,pad:.3, taiko:1, bass:1, drive:1, hats:1, power:1, fill:1},
  calm:   {bpm:66,  root:55, scale:'yo',     prog:[0,3,1,4], koto:'arp',  flute:.7, pad:.6, taiko:0,  bass:.4},
  dark:   {bpm:70,  root:47, scale:'insen',  prog:[0,1,0,3], koto:'slow', flute:.5, pad:.7, taiko:.2, bass:.6},
  epic:   {bpm:104, root:50, scale:'miyako', prog:[0,3,4,2], koto:'arp',  flute:.6, pad:.5, taiko:.8, bass:.8, drive:.6, hats:.5, fill:1},
};
// story arcs → mood for their scenes and map
const ARC_MOOD = {dream1:'calm', dream2:'calm', dream3:'epic', dream4:'dark', dream5:'epic', six:'epic', prologue:'calm', asakusa:'calm', tsuzumi:'dark', natagumo:'dark', mugen:'epic', district:'epic', swordsmith:'calm', flashback:'epic', castle:'dark', dawn:'epic'};
const MUSIC = {want:null, playing:null, timer:null, step:0, next:0, theme:null, mel:null, bus:null};
const midiHz = m => 440*Math.pow(2,(m-69)/12);
// a note of the theme's scale: degree (can go past one octave) above the root
const noteOf = (th, deg, oct=0) => { const sc=SCALES[th.scale], n=sc.length, o=Math.floor(deg/n); return th.root + sc[((deg%n)+n)%n] + 12*(o+oct); };
// instruments (all into the theme's own bus, so themes can cross-fade)
function pluck(f,t,len,vol,bus){ const o=AC.createOscillator(), g=AC.createGain(), lp=AC.createBiquadFilter();
  o.type='triangle'; o.frequency.value=f; lp.type='lowpass'; lp.frequency.setValueAtTime(f*6,t); lp.frequency.exponentialRampToValueAtTime(f*1.5,t+len);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.005); g.gain.exponentialRampToValueAtTime(.001,t+len);
  o.connect(lp).connect(g).connect(bus); o.start(t); o.stop(t+len+.05); }
function flute(f,t,len,vol,bus){ const o=AC.createOscillator(), g=AC.createGain(), lfo=AC.createOscillator(), lg=AC.createGain();
  o.type='sine'; o.frequency.value=f; lfo.frequency.value=5; lg.gain.value=f*.012; lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.09); g.gain.setValueAtTime(vol,t+len*.7); g.gain.linearRampToValueAtTime(0,t+len);
  o.connect(g).connect(bus); o.start(t); lfo.start(t); o.stop(t+len+.05); lfo.stop(t+len+.05); }
function pad(fs,t,len,vol,bus){ fs.forEach(f=>[-6,6].forEach(c=>{ const o=AC.createOscillator(), g=AC.createGain(), lp=AC.createBiquadFilter();
  o.type='sawtooth'; o.frequency.value=f; o.detune.value=c; lp.type='lowpass'; lp.frequency.value=700;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+len*.35); g.gain.linearRampToValueAtTime(0,t+len);
  o.connect(lp).connect(g).connect(bus); o.start(t); o.stop(t+len+.05); })); }
function bassNote(f,t,len,vol,bus){ const o=AC.createOscillator(), g=AC.createGain();
  o.type='triangle'; o.frequency.value=f; g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+len);
  o.connect(g).connect(bus); o.start(t); o.stop(t+len+.05); }
// battle drive: a closed hi-hat tick, and a bright plucked power chord (sawtooth through a closing filter)
function hat(t,vol,bus){ hiss('highpass',7000,9000,.035,vol,t-AC.currentTime,bus,.7); }
function powerStab(fs,t,len,vol,bus){ fs.forEach(f=>{ const o=AC.createOscillator(), g=AC.createGain(), lp=AC.createBiquadFilter();
  o.type='sawtooth'; o.frequency.value=f; lp.type='lowpass'; lp.Q.value=4; lp.frequency.setValueAtTime(f*8,t); lp.frequency.exponentialRampToValueAtTime(f*1.2,t+len);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+len);
  o.connect(lp).connect(g).connect(bus); o.start(t); o.stop(t+len+.05); }); }
// a simple seeded melody per theme (the same tune every time that theme plays)
function makeMelody(name){ let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))>>>0; const rnd=()=>((h=(h*1103515245+12345)>>>0)/4294967296);
  const out=[]; let d=4; for(let i=0;i<32;i++){ if(rnd()<.45){ out.push(null); continue; } d=Math.max(2,Math.min(9,d+[-2,-1,-1,0,1,1,2][Math.floor(rnd()*7)])); out.push({deg:d, len:rnd()<.3?4:rnd()<.5?2:1}); } return out; }
// play one 16th-note step of the current theme at time t
function musicStep(t){
  const th=MUSIC.theme, bus=MUSIC.bus, s=MUSIC.step, bar=Math.floor(s/16)%th.prog.length, beat=s%16, root=th.prog[bar], q=60/th.bpm/4;
  const chord=[root, root+2, root+4];
  if(th.koto==='arp' && beat%2===0) pluck(midiHz(noteOf(th, chord[(beat/2)%3]+(beat>=8?3:0), 1)), t, q*5, .09, bus);
  if(th.koto==='stab' && [0,3,6,10,12].includes(beat)) pluck(midiHz(noteOf(th, chord[beat%3], 1)), t, q*2, .1, bus);
  if(th.koto==='slow' && beat%4===0) pluck(midiHz(noteOf(th, chord[(beat/4)%3], 1)), t, q*10, .08, bus);
  if(th.bass && (beat===0 || (th.taiko>.5 && beat===8))) bassNote(midiHz(noteOf(th, root, -1)), t, q*(beat===0?7:5), .14*th.bass, bus);
  if(th.pad && beat===0) pad([midiHz(noteOf(th,root)), midiHz(noteOf(th,root+2))], t, q*16, .018*th.pad, bus);
  if(th.taiko){ const pat=th.taiko>.5 ? [0,3,6,8,11,14] : [0,8]; if(pat.includes(beat)) taikoHit(t-AC.currentTime, (beat===0?.32:.2)*th.taiko, bus); }
  if(th.drive && beat%2===0) bassNote(midiHz(noteOf(th, root, beat%8===4?0:-1)), t, q*1.7, .09*th.drive, bus);   // 8th-note bass, jumping an octave
  if(th.hats) { if(beat%2===1) hat(t, .045*th.hats, bus); else if(th.hats>.7 && beat%4===2) hat(t, .025, bus); }
  if(th.power && [0,3,6,10].includes(beat)) powerStab([midiHz(noteOf(th,root)), midiHz(noteOf(th,root+2)), midiHz(noteOf(th,root,1))], t, q*(beat===0?3:1.6), (beat===0?.028:.02)*th.power, bus);
  if(th.fill && bar%4===3 && beat>=12) taikoHit(t-AC.currentTime, (.16+.05*(beat-12))*th.fill, bus);   // drum roll into the next phrase
  if(th.flute && beat%4===0){ const m=MUSIC.mel[(s/4)%MUSIC.mel.length]; if(m && Math.random()<.85) flute(midiHz(noteOf(th, m.deg, 1)), t, q*4*m.len*.95, .05*th.flute, bus); }
  MUSIC.step++;
}
function startMusic(name){
  if(!AC){ MUSIC.want=name; return; }
  if(MUSIC.playing===name) return;
  // fade the old theme out, start the new one on a fresh bus
  if(MUSIC.bus){ const old=MUSIC.bus; old.gain.setTargetAtTime(0, AC.currentTime, .4); setTimeout(()=>{ try{ old.disconnect(); }catch(e){} }, 2500); }
  clearInterval(MUSIC.timer); MUSIC.playing=name; MUSIC.want=name;
  if(!name || !THEMES[name]){ MUSIC.bus=null; return; }
  MUSIC.theme=THEMES[name]; MUSIC.mel=makeMelody(name); MUSIC.step=0; MUSIC.next=AC.currentTime+.15;
  MUSIC.bus=AC.createGain(); MUSIC.bus.gain.setValueAtTime(0,AC.currentTime); MUSIC.bus.gain.setTargetAtTime(1,AC.currentTime,.6); MUSIC.bus.connect(MUSIC_OUT);
  MUSIC.timer=setInterval(()=>{ if(!MUSIC.bus) return; if(AC.state!=='running'){ MUSIC.next=AC.currentTime+.1; return; }
    const q=60/MUSIC.theme.bpm/4; while(MUSIC.next < AC.currentTime+.2){ try{ musicStep(MUSIC.next); }catch(e){} MUSIC.next+=q; } }, 40);
}
// Which theme a screen plays (called on every redraw; does nothing if it's already playing)
function music(name){ if((S.vol||loadVolumes()).music===0){ startMusic(null); MUSIC.want=name; return; } startMusic(name); }
function musicFor(view){
  const st = S.mode==='story' && typeof STAGES!=='undefined' && STAGES[S.stage];
  if(['setup','modeset','codex','lobby','tvhome'].includes(view)) return 'menu';
  if(['spin','draft'].includes(view)) return 'draft';
  if(view==='story') return 'calm';
  if(view==='credits' || (view==='scene' && S.sceneFinale)) return 'calm';   // the story finale and end credits
  if(view==='scene') return st ? ARC_MOOD[st.arc]||'calm' : 'calm';
  if(['plan','pass','ready','result','scout'].includes(view)) return 'battle';
  return null;   // the win screen: just the win / lose fanfare
}
