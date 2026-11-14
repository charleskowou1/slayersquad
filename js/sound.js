/* ================= SOUND AND MUSIC =================
   Effects are made on the fly with the Web Audio API. Music is a library of songs in music/ (see TRACKS below).
   Phones only allow sound after a tap, so audio starts on the first tap (unlockSound in app.js).
   Two volumes in Settings: Music and Effects (Off / Low / Medium / High), saved per phone.
   - Effects: hits, knockouts, heals… plus one sound per breathing style (water swirl, thunder crack, flame roar…),
     a cut-in sound when a special fires, and scene sounds (typing ticks, the unlock sting).
   - Music: songs from the music library, one per kind of screen (home, draft, battle, boss battle, credits) and per
     story arc; music(name) cross-fades to it. */
const VOL_LEVELS = [0, .35, .7, 1];   // Off, Low, Medium, High
const VOL_KEY = 'squad-draft-volume';
// defaults: music low (CK, Nov 4, 2026: the new music library, Nezuko's Song on the home screen), effects low
function loadVolumes(){ try{ const v=JSON.parse(localStorage.getItem(VOL_KEY)); if(v) return v; }catch(e){} return {music:1, sfx:1}; }
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
  playMusicEl();   // a song a phone refused to start without a tap
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
  // Dead Calm (Nov 11, 2026, CK: the drop sound should land with the animation): a still pause, then one drop hits the
  // lake 0.7 s in, when the drawn drop does, and the ripple rings out
  calmdrop(){ const a=.68; tone('sine',650,1900,.07,.24,a); tone('sine',1900,1350,.22,.09,a+.06); hiss('bandpass',3200,1400,.12,.05,a+.02); tone('sine',1100,1000,.6,.04,a+.12); },
  // a blow landing on Dead Calm's water: a splash when it strikes (0.3 s in), droplets falling after
  calmhit(){ const a=.36; hiss('bandpass',2600,700,.35,.2,a,SFX_OUT,1.5); tone('sine',560,1500,.06,.12,a+.02); [.2,.3,.42].forEach((d,i)=>tone('sine',1700-i*180,1250-i*150,.08,.07,a+d)); },
  // Hantengu running away: a squeak, then tiny scurrying steps
  // Kyogai: three tsuzumi strikes, on the beats his room turns (0.25 s, 0.8 s, 1.35 s)
  tsuzumi(){ [.25,.8,1.35].forEach((a,i)=>{ tone('sine',220-i*15,90,.28,.32,a); tone('triangle',660-i*30,300,.09,.12,a); hiss('bandpass',1800,600,.12,.12,a); }); tone('sine',1400,1200,.5,.05,1.6); },
  scurry(){ tone('sine',1300,2300,.14,.1,0); for(let i=0;i<9;i++) tone('square',2100-(i%2)*300,1900-(i%2)*300,.025,.04,.15+i*.075); },
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
  const p=warmSound(url); if(p) p.then(b=>{ if(b) go(b); });
}
// Download a clip sound ahead of time, so a voice line starts with its clip instead of after a download
function warmSound(url){
  if(!AC || CLIP_AUDIO[url] instanceof AudioBuffer) return null;
  return CLIP_AUDIO[url] = CLIP_AUDIO[url] || fetch(url).then(r=>r.arrayBuffer()).then(a=>AC.decodeAudioData(a)).then(b=>CLIP_AUDIO[url]=b).catch(()=>{ delete CLIP_AUDIO[url]; });
}
function sfxForLine(line){
  if(line.c==='r') return sfx('gong');
  if(line.fx==='say') return sfx('page');
  if(line.fx==='awaken') return sfx('unlock');
  const big=/\[-(\d+)%\]/.exec(line.t), hard=big && +big[1]>=30, by=line.by && typeof findU==='function' && findU(line.by);
  const style = by && typeof styleOf==='function' ? styleOf(by, line.move) : null;
  if(line.calm) return sfx('calmdrop');
  if(line.calmblock) return sfx('calmhit');
  if(line.flee) return sfx('scurry');
  if(line.kind==='drum') return sfx('tsuzumi');
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

// a koto-like pluck (the splash sting uses it)
const midiHz = m => 440*Math.pow(2,(m-69)/12);
function pluck(f,t,len,vol,bus){ const o=AC.createOscillator(), g=AC.createGain(), lp=AC.createBiquadFilter();
  o.type='triangle'; o.frequency.value=f; lp.type='lowpass'; lp.frequency.setValueAtTime(f*6,t); lp.frequency.exponentialRampToValueAtTime(f*1.5,t+len);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.005); g.gain.exponentialRampToValueAtTime(.001,t+len);
  o.connect(lp).connect(g).connect(bus); o.start(t); o.stop(t+len+.05); }

/* ---------- music ---------- */
// The music library (CK, Nov 4, 2026: the old music made from tones in code was scrapped). Files in music/, trimmed and
// levelled by the scratch mkmusic.py. Each plays through an <audio> element routed into MUSIC_OUT, so the Music volume in
// Settings controls it on every phone (iPhones ignore an audio element's own volume). Streamed, never in the offline cache.
const TRACKS = {
  nezuko:        'music/nezuko-lullaby.mp3',        // Kamado Nezuko's Song (ufotable): home rotation, story map, calm scenes
  from_the_edge: 'music/from-the-edge.mp3',         // FictionJunction ft. LiSA, the Season 1 ending: home rotation
  gurenge:       'music/gurenge.mp3',               // LiSA, the Season 1 opening (TV size): home rotation
  zankyou:       'music/zankyou-sanka.mp3',         // Aimer, the Season 2 opening (full): home rotation (CK, Nov 13, 2026)
  nezuko_finale: 'music/nezuko-finale.mp3',         // the same song's orchestral climax: story finale and end credits
  tengen:        'music/tengen.mp3',                // drafting and who-picks-first
  hashira:       'music/hashira.mp3',               // battles (one of three per match)
  zenitsu:       'music/zenitsu-thunderclap.mp3',
  zenitsu_mugen: 'music/zenitsu-mugen.mp3',
  zenitsu_seventh:'music/zenitsu-seventh.mp3',      // Zenitsu 7th Form: Flaming Thunder God (Infinity Castle OST cover, Diego Mitre Music): battles (CK, Nov 13, 2026)
  akaza:         'music/akaza.mp3',                 // boss battles (Upper Moons, Muzan, Final Form) and epic scenes
  zohakuten:     'music/zohakuten.mp3',             // boss battles and dark scenes
};
// names shown in Settings → Now playing
const SONG_TITLES = {nezuko:'Kamado Nezuko’s Song', nezuko_finale:'Kamado Nezuko’s Song (finale)', from_the_edge:'from the edge · FictionJunction ft. LiSA',
  gurenge:'Gurenge · LiSA', zankyou:'Zankyou Sanka · Aimer', tengen:'Tengen Uzui Theme', hashira:'Hashira Theme', zenitsu:'Zenitsu Theme · Thunderclap and Flash',
  zenitsu_mugen:'Zenitsu Theme · Mugen Train', zenitsu_seventh:'Zenitsu · Flaming Thunder God (cover)', akaza:'Akaza Theme', zohakuten:'Zohakuten Theme'};
// Home screen rotation (CK, Nov 4, 2026): each time the game opens it starts on the next song, and one song follows another
const HOME_TRACKS = ['nezuko', 'from_the_edge', 'gurenge', 'zankyou'], BATTLE_TRACKS = ['hashira', 'zenitsu', 'zenitsu_mugen', 'zenitsu_seventh'], BOSS_TRACKS = ['akaza', 'zohakuten'];
const HOME_KEY = 'squad-draft-home-song';
let HOME_AT = 0; try{ HOME_AT = (((+localStorage.getItem(HOME_KEY))||0) + 1) % HOME_TRACKS.length; localStorage.setItem(HOME_KEY, HOME_AT); }catch(e){}
const homeTrack = () => HOME_TRACKS[HOME_AT];
// story arcs → the track for their scenes
const ARC_MOOD = {dream1:'nezuko', dream2:'nezuko', dream3:'hashira', dream4:'zohakuten', dream5:'akaza', six:'akaza', prologue:'nezuko', asakusa:'nezuko', tsuzumi:'zohakuten', natagumo:'zohakuten', mugen:'hashira', district:'akaza', swordsmith:'nezuko', flashback:'hashira', castle:'zohakuten', dawn:'akaza'};
// two players (A/B) so tracks cross-fade; each keeps its place per track, so coming back to the menu resumes the song
const MUSIC = {want:null, playing:null, cur:null, pos:{}, skip:{}};
function musicPlayer(){
  const el=new Audio(); el.loop=true; el.preload='auto'; el.setAttribute('playsinline','');
  const bus=AC.createGain(); bus.gain.value=0; try{ AC.createMediaElementSource(el).connect(bus); }catch(e){} bus.connect(MUSIC_OUT);
  const p={el, bus, name:null};
  el.addEventListener('ended', ()=>{ if(MUSIC.cur===p && HOME_TRACKS.includes(p.name)){ nextSong(); if(S.settings && typeof render==='function') render(); } });   // home songs play one after another
  return p;
}
function startMusic(name){
  if(!AC){ MUSIC.want=name; return; }
  if(MUSIC.playing===name) return;
  MUSIC.playing=name; MUSIC.want=name;
  if(!MUSIC.a){ MUSIC.a=musicPlayer(); MUSIC.b=musicPlayer(); }
  const old=MUSIC.cur;
  if(old && old.name){   // fade out and remember where it was
    MUSIC.pos[old.name]=old.el.currentTime; old.bus.gain.setTargetAtTime(0, AC.currentTime, .35);
    const was=old.name; setTimeout(()=>{ if(old.name===was && MUSIC.cur!==old) old.el.pause(); }, 1600);
  }
  if(!name || !TRACKS[name]){ MUSIC.cur=null; return; }
  const p = old===MUSIC.a ? MUSIC.b : MUSIC.a; p.name=name; MUSIC.cur=p;
  if(!p.el.src.endsWith(TRACKS[name])){ p.el.src=TRACKS[name]; }
  p.el.loop = !HOME_TRACKS.includes(name);
  try{ p.el.currentTime=MUSIC.pos[name]||0; }catch(e){}
  p.bus.gain.cancelScheduledValues(AC.currentTime); p.bus.gain.setValueAtTime(0, AC.currentTime); p.bus.gain.setTargetAtTime(1, AC.currentTime+.05, .5);
  playMusicEl();
}
// phones only start audio inside a tap: if a start is refused, the next tap anywhere tries again (unlockSound calls this)
function playMusicEl(){ const p=MUSIC.cur; if(!p || !p.el.paused || document.hidden) return; try{ const r=p.el.play(); if(r&&r.catch) r.catch(()=>{}); }catch(e){} }
// leaving the game pauses the song; coming back carries on
if(typeof document!=='undefined') document.addEventListener('visibilitychange', ()=>{ const p=MUSIC.cur; if(!p) return; if(document.hidden) p.el.pause(); else playMusicEl(); });
// Which track a screen plays (called on every redraw; does nothing if it's already playing)
function music(name){ if(name==='home') name=homeTrack(); if((S.vol||loadVolumes()).music===0){ startMusic(null); MUSIC.want=name; return; } startMusic(name); }
// Settings → Next: the next song of the same kind (home rotation, battle songs, boss songs), from its start
function songList(name){ return [HOME_TRACKS, BATTLE_TRACKS, BOSS_TRACKS].find(l=>l.includes(name)) || null; }
function nextSong(){
  const now=MUSIC.playing, list=songList(now); if(!list) return;
  const next=list[(list.indexOf(now)+1)%list.length]; MUSIC.pos[next]=0;
  if(list===HOME_TRACKS){ HOME_AT=HOME_TRACKS.indexOf(next); try{ localStorage.setItem(HOME_KEY, HOME_AT); }catch(e){} }
  else MUSIC.skip[matchKey()]=next;   // this match keeps the song picked
  startMusic(next);
}
// one battle track per match, kept for the whole match (picked from who's in it, so a rematch keeps its song)
const matchKey = () => JSON.stringify(S.picks||[]) + (S.stage??'');
const pickOf = (list, key) => { let h=0; for(const c of key) h=(h*31+c.charCodeAt(0))>>>0; return list[h%list.length]; };
function battleTrack(){
  const ids=(S.teams||[]).flat().map(u=>u.id), fam=id=>(BYID[id]||{}).fam||id;
  const boss = S.mode==='final' || S.mode==='rush' || S.coop==='final' || ids.some(id=>(BYID[id]||{}).upper || fam(id)==='muzan');
  if(MUSIC.skip[matchKey()]) return MUSIC.skip[matchKey()];
  if(!boss) return pickOf(BATTLE_TRACKS, matchKey());
  if(ids.some(id=>fam(id)==='hantengu')) return 'zohakuten';
  if(ids.some(id=>fam(id)==='akaza')) return 'akaza';
  return pickOf(BOSS_TRACKS, matchKey());
}
function musicFor(view){
  const st = S.mode==='story' && typeof STAGES!=='undefined' && STAGES[S.stage];
  if(['setup','modeset','codex','lobby','tvhome'].includes(view)) return 'home';
  if(view==='story') return 'nezuko';
  if(view==='credits' || (view==='scene' && S.sceneFinale)) return 'nezuko_finale';   // the story finale and end credits
  if(['spin','draft'].includes(view)) return 'tengen';
  if(view==='scene') return st ? ARC_MOOD[st.arc]||'nezuko' : 'nezuko';
  if(['plan','pass','ready','result','scout','reveal','order','rally'].includes(view)) return battleTrack();
  return null;   // the win screen: just the win / lose fanfare
}
