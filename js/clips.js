/* ================= MOVE CLIPS =================
   Short anime clips (and optional sounds) for a character's moments in round playback: their special plays inside
   the cut-in; other moments (regen, heal, defend, knockouts…) get a clip box on the stage. Characters or moments
   without a clip keep the drawn effects. Clips are Tenor's mp4 versions (page links resolved by hand to the
   media.tenor.com address in the page's og:video tag). Personal use only, like the pictures.
   A family's clips cover its other versions (muzan → muzan_final) unless that version has its own.
   No DOM here: app.js picks the clip for each playback step (clipStep) and views.js draws S.play.clip. */
const CLIPS = {
  doma: {
    special: 'https://media.giphy.com/media/6r4H65jNdyZGk18xNl/giphy.mp4',                    // Frozen Lotus (CK, Giphy; was a Tenor fan clip)
    regen:   'https://media.tenor.com/-sCN02pzMS8AAAPo/douma-demon-slayer.mp4',              // face healing
    poison:  'https://media.giphy.com/media/NuhxMSbSUqnNQfQBsA/giphy.mp4',                    // poisoned (Shinobu's wisteria)
    bodhisattva: 'clips/doma-bodhisattva.jpg',   // Rime Ice: Water Lily Bodhisattva (CK's manga page, Nov 11, 2026)
  },
  giyu: {
    special: 'https://media.tenor.com/xHYvGutUP_kAAAPo/giyuu-tamioka.mp4',                   // Dead Calm
  },
  rengoku:      {special: 'https://media.tenor.com/z1P4ccPzl9MAAAPo/demon-slayer-demon-slayer-season-2.mp4',   // Fifth Form: Flame Tiger
                 ninth: 'https://media.tenor.com/Bk9kw_WGE5wAAAPo/demon-slayer-demon-slayer-season-2.mp4'},     // Ninth Form: Rengoku
  zenitsu:      {special: 'https://media.tenor.com/E-dg68_nbcgAAAPo/good-morning.mp4',       // Thunderclap and Flash
                 seventh: 'https://media.tenor.com/1cf7FDK2C34AAAPo/zenistu-chong-yeu.mp4'},  // Seventh Form: Flaming Thunder God
  tanjiro:      {special: 'https://media.giphy.com/media/7NXthOnRv4UQAyv34a/giphy.mp4'},     // Hinokami Kagura (CK's better one, Giphy)
  nakime:       {special: 'https://media.tenor.com/KcTOA0-I_8IAAAPo/%D0%B2%D1%8B%D1%81%D1%88%D0%B0%D1%8F%D0%BB%D1%83%D0%BD%D0%B04-%D0%BB%D1%83%D0%BD%D0%B04.mp4'},   // Castle Shift (biwa)
  rui:          {special: 'https://media.tenor.com/8F1cpYMAkQoAAAPo/demon-slayer-kimetsu-no-yaiba.mp4'},   // Cutting Thread Cage
  shinobu:      {special: 'https://media.tenor.com/ows-n9TDResAAAPo/shinobu-kocho-demon-slayer.mp4'},     // Wisteria Poison (butterfly sting)
  tanjiro_mark: {special: 'https://media.tenor.com/c24bU_rb8lQAAAPo/demon-slayer.mp4',        // Hinokami Kagura with Yoriichi behind him (CK, Nov 12, 2026: Mark Tanjiro never uses the regular clip)
                 unblock: 'clips/tanjiro_mark-setting-sun2.mp4',   // out of the Selfless State: the upside-down Setting Sun Transformation on Akaza (CK's video, 9.0-11.6 s only: just the flip, CK didn't want Akaza's full body)
                 selfless:'https://media.tenor.com/dwK2WAD5wJYAAAPo/tanjiro-infinity-castle.mp4'},   // Selfless State
  tanjiro_demon:{special: 'clips/tanjiro_demon-special.mp4'},   // Demon King's Rampage: CK's Tenor clip, first 4 s
  akaza:        {special: 'https://media.tenor.com/bcnPa1vZe3cAAAPo/akaza-demon-slayer.mp4',  // Destructive Death: Compass Needle
                 annihilation: 'clips/akaza-annihilation.mp4',   // Annihilation Type: CK's GIF, converted, served with the game
                 regen:   'https://media.tenor.com/cEpW6MV9Z_YAAAPo/akaza-gif-headless.mp4'},  // head growing back
  inosuke:      {special: 'https://media.tenor.com/J08tCPlL6dIAAAPo/inosuke-demon-slayer.mp4'},   // Fang Frenzy
  nezuko:       {special: 'https://media.tenor.com/MuLdehLf5WcAAAPo/demon-slayer-kimetsu-no-yaiba.mp4'},   // Exploding Blood
  kokushibo:    {special: 'https://media.tenor.com/HL0GFe-7zPkAAAPo/kokushibo-aura.mp4',      // Moon Breathing (aura)
                 moonbow: 'clips/kokushibo-moonbow.jpg',                                       // Sixteenth Form: Moonbow, Half Moon (CK's manga panel, Nov 11, 2026)
                 catastrophe: 'clips/kokushibo-catastrophe.jpg'},                             // Fourteenth Form: the crescent storm (CK's manga panel, Nov 11, 2026)
  yoriichi:     {special: 'https://media.tenor.com/yncZvQ9iX6MAAAPo/yoriichi-tsugikuni.mp4'}, // Sun Breathing (aura)
  muichiro:     {special: 'https://media.tenor.com/ynS0sUD6YbEAAAPo/tokito.mp4'},             // Obscuring Clouds
  gyomei:       {special: 'https://media.tenor.com/-XFLrcBj-lUAAAPo/gyomei-gyomei-himejima.mp4'},   // Volcanic Rock
  sanemi:       {special: 'https://media.tenor.com/wuIHjYf2VEUAAAPo/sanemi-wind-breathing.mp4', claws: 'clips/sanemi-claws.mp4'},   // Second Form: Claws-Purifying Wind (CK's YouTube link; cut at the same moments as the voice line so they match)   // Wind Breathing
  tengen:       {special: 'https://media.tenor.com/Exi_TpZVtQsAAAPo/tengen-uzui-tengen.mp4'},      // Sound Breathing
  tengen_retired:{special: 'https://media.tenor.com/E8_EMliP95EAAAPo/tengen-uzui.mp4'},            // Bodyguard (Hashira Training)
  mitsuri:      {special: 'https://media.tenor.com/Pr283FIcFIsAAAPo/mitsuri-love-breathing.mp4'},  // Swaying Love, Wildclaw
  obanai:       {special: 'https://media.tenor.com/3jBPI8_vMfcAAAPo/obanai-obanai-iguro.mp4'},     // Serpent Breathing
  genya:        {special: 'https://media.tenor.com/YXctE3HEatcAAAPo/demon-slayer.mp4'},            // Genya's special
  sabito:       {special: 'https://media.tenor.com/S98rvMkpd9kAAAPo/sabito.mp4'},                  // Spirit Training
  // Friday drop (Oct 30, 2026)
  daki:          {special: 'https://media.tenor.com/3dTXBpeK1EwAAAPo/kimetsu-no-yaiba-demon-slayer.mp4'},   // Obi Sashes
  enmu:          {special: 'https://media.tenor.com/KwNbxtAZ7rwAAAPo/kimetsu-no-yaiba-mugen-train.mp4'},   // Forced Sleep
  gyokko:        {special: 'https://media.tenor.com/WhSFVAa0eE8AAAPo/gyokko-pot.mp4'},   // Water Prison Pot
  gyutaro:       {special: 'https://media.tenor.com/0ViOIVwIBOgAAAPo/demon-slayer-demon-slayer-s2.mp4'},   // Flying Blood Sickles
  hantengu_true: {},
  hantengu:      {special: 'https://media.giphy.com/media/wiNn6bskDVY4SvE3kf/giphy.mp4'},   // Cowering Hide
  kanae:         {special: 'https://media.giphy.com/media/xWIklyBVywrEjcMKWJ/giphy.mp4'},   // Crimson Hanagoromo
  murata:        {special: 'https://media.tenor.com/wtlDk3glPlEAAAPo/sm32-murata.mp4'},   // Water Surface Slash
  susamaru:      {special: 'https://media.tenor.com/iYH7ipY5zkMAAAPo/susamaru-temari-balls.mp4'},   // Temari Barrage
  tamayo:        {special: 'https://media.tenor.com/wt1vTr1tT5UAAAPo/tamayo-demon-slayer.mp4'},   // Healing Blood Art
  yahaba:        {special: 'https://media.tenor.com/Sq2F7l-bgycAAAPo/yahaba-arrow-demon.mp4'},   // Vector Arrows
  typezero:      {special: 'https://media.tenor.com/pf7yjToDMCUAAAPo/yoriichi-yoriichi-type-zero.mp4'},   // Training Drill
  yushiro:       {special: 'https://media.tenor.com/w6sfVjjE_ycAAAPo/yushiro.mp4'},   // Concealment Talisman
  aizetsu:       {special: 'https://media.tenor.com/TypGxKxx9mgAAAPo/aizetsu-aizetsu-demon-slayer.mp4'},   // Cross Spear
  karaku:        {special: 'https://media.tenor.com/9ZJNvODaQxoAAAPo/karaku-karaku-demon-slayer.mp4'},   // Gale Fan
  nezuko_awakened:{special: 'https://media.tenor.com/TuhJqffeM7sAAAPo/demon-slayer-demon-slayer-s2.mp4'},   // Exploding Blood
  sekido:        {special: 'https://media.tenor.com/-G6Nc83GotcAAAPo/hantengu-demon-slayer.mp4'},   // Lightning Staff
  urogi:         {special: 'https://media.tenor.com/gg4FjAQPjpcAAAPo/urogi-urogi-demon-slayer.mp4'},   // Sky Dive
  zohakuten:     {special: 'https://media.tenor.com/c97RTCFc8kkAAAPo/zohakuten-kimetsu-no-yaiba.mp4'},   // Wood Dragons
  hand:          {special: 'clips/hand-special.mp4'},          // Grasping Arms: first 4 s
  kyogai:        {special: 'clips/kyogai-special.mp4'},        // Drum Room Spin: first 4 s
  muzan:         {special: 'https://media.tenor.com/-rE33m3Gk6cAAAPo/demon-slayer-demon-slayer-season-4.mp4',   // Blood Whips
                  regen: 'clips/muzan-regen.mp4'},             // head growing back (YouTube, 0:06-0:09, no sound)
  muzan_final:   {special: 'clips/muzan_final-special.jpg',    // Thorned Flesh Whips: a manga panel, no video exists
                  regen: 'clips/muzan-regen.mp4'},
  yoriichi_old:  {special: 'clips/yoriichi_old-special.jpg'},  // The Last Strike: a single manga panel
  kaigaku:       {special: 'clips/kaigaku-special.mp4'},       // Black Thunder: first 4 s
  gyomei_mark:   {special: 'https://media.tenor.com/bHhJrzZO3LMAAAPo/himejima-gyomei-kimetsu-no-yaiba.mp4'},
  michikatsu:    {},
  gyokko_perfect: {},   // Jinmei Kaigyo isn't his Water Prison Pot: don't borrow that clip   // not Kokushibo's demon clip: he's still human
  hakuji:        {special: 'https://media.tenor.com/JOGk6f__jd4AAAPo/demon-slayer-kimetsu-no-yaiba.mp4'},
  tanjuro:       {special: 'https://media.tenor.com/FjuEaNP16-AAAAPo/demon-slayer-tanjiro.mp4'},       // the Hinokami dance in the snow
  aoi:           {use: 'https://media.tenor.com/t61s6eT3YwoAAAPo/aoi-kanzaki-aoi.mp4'},
  chuntaro:      {use: 'https://media.tenor.com/B1PJ7zsydZsAAAPo/zenitsu-spirrow-chuntaro.mp4'},
  // back-pocket helpers: `use` plays when the helper is used (start of the round)
  chachamaru:   {use: 'https://media.tenor.com/_WSjCdYJ3QoAAAPo/chachamaru-kimetsu-no-yaiba.mp4'},
  crow:         {use: 'https://media.tenor.com/Rec9bEkDErUAAAPo/kasugai.mp4'},
  mice:         {use: 'https://media.tenor.com/-t9whuidwBwAAAPo/ninju-shino-buff-mice.mp4'},
  hotaru:       {use: 'https://media.tenor.com/1Z2gMbfksGgAAAPo/haganezuka-kimetsu-no-yaiba.mp4'},
  kiriya:       {use: 'https://media.tenor.com/pNNAQOoa9zsAAAPo/kiriya-infinity-castle.mp4'},
  kagaya:       {special: 'clips/kagaya-special.mp4'},   // Final Resolve: CK's Tenor clip, last 2 s cut (the fade to white; CK, Nov 6, 2026: too long, twice)
};
// Sounds for the same moments, same shape as CLIPS: files in sounds/ (e.g. 'sounds/doma-special.mp3').
// A clip's sound plays instead of the usual effect for that moment.
const CLIP_SOUNDS = {
  tanjiro_demon: {},   // never Hinokami Kagura
  akaza:   {special: 'sounds/akaza-special.mp3'},     // "Destructive Death: Compass Needle"
  gyomei:  {special: 'sounds/gyomei-special.mp3'},    // "Stone Breathing! Third Form!"
  genya:   {special: 'sounds/genya-special.mp3'},     // "I ate demon flesh earlier"
  gyutaro: {special: 'sounds/gyutaro-special.mp3'},   // "Blood Demon Art: Flying Blood Sickles"
  inosuke: {special: 'sounds/inosuke-special.mp3'},   // "Beast Breathing, Fourth Form! Slice and Dice!"
  kagaya:  {special: 'sounds/kagaya-special.mp3'},    // "True eternity is the human will"
  mitsuri: {special: 'sounds/mitsuri-special.mp3'},   // "Love Breathing, Fifth Form, Swaying Love"
  muichiro:{special: 'sounds/muichiro-special.mp3'},  // "Mist Breathing, Seventh Form: Obscuring Clouds"
  nakime:  {special: 'sounds/nakime-special.mp3'},    // her biwa
  nezuko:  {special: 'sounds/nezuko-special.mp3'},    // "Blood Demon Art: Exploding Blood"
  rui:     {special: 'sounds/rui-special.mp3'},       // "Blood Demon Art: Cutting Thread Cage"
  sabito:  {special: 'sounds/sabito-special.mp3'},    // "You look like you finally belong"
  sanemi:  {special: 'sounds/sanemi-special.mp3', claws: 'sounds/sanemi-second.mp3'},   // claws: "Wind Breathing, Second Form: Claws-Purifying Wind"    // "Rising Dust Storm!"
  shinobu: {special: 'sounds/shinobu-special.mp3'},   // "Insect Breathing: Dance of the Bee Sting, True Flutter"
  tanjiro: {special: 'sounds/tanjiro-special.mp3', unblock: 'sounds/tanjiro-special.mp3'},   // "Hinokami Kagura! Dance!"
  tengen:  {special: 'sounds/tengen-special.mp3'},    // "Sound Breathing, Fourth Form: Constant Resounding Slashes"
  zenitsu: {special: 'sounds/zenitsu-special.mp3'},   // "Thunder Breathing, First Form: Thunderclap and Flash"
  zohakuten:{special: 'sounds/zohakuten-special.mp3'},// "You brutal fiends who torment the weak"
  rengoku: {special: 'sounds/rengoku-special.mp3',    // "Fifth Form! Flame Tiger!"
            ninth:   'sounds/rengoku-ninth.mp3'},     // "The Ninth Form! Rengoku!"
  giyu: {special: 'sounds/giyu-special.mp3'},
  // Nov 12, 2026 drop (CK's YouTube links, English dub; each cut checked by transcribing it)
  doma:     {special: 'sounds/doma-special.mp3'},       // "Blood Demon Art... Frozen Lotus"
  muzan:    {special: 'sounds/muzan-special.mp3'},      // "You think you've driven me into a corner? I'll massacre every one of you before sunrise!" (5.3 s: "with your little plan" cut, 8% faster; covers Final Form)
  hantengu: {special: 'sounds/hantengu-special.mp3'},   // "How terrifying, terrifying!"
  sekido:   {special: 'sounds/sekido-special.mp3'},     // "Infuriating! Infuriating!" (CK confirmed)
  karaku:   {special: 'sounds/karaku-special.mp3'},     // "You guys wouldn't mind if I joined the fight, would ya?" (CK confirmed)
  aizetsu:  {special: 'sounds/aizetsu-special.mp3'},    // "...Spears!"
  urogi:    {special: 'sounds/urogi-special.mp3'},      // his cry (no words)
  obanai:   {special: 'sounds/obanai-special.mp3'},     // "Serpent Breathing, Fifth Form: Slithering Serpent" (covers Obanai ✦)
  yoriichi: {special: 'sounds/yoriichi-special.mp3'},   // "So tell me then, what is the weight of a human life to you?" (covers Age 85)
  enmu:     {special: 'sounds/enmu-special.mp3'},       // "What a shame. You could have stayed dreaming forever."
  kyogai:   {special: 'sounds/kyogai-special.mp3'},     // "Damn insects! So infuriating!"
  susamaru: {special: 'sounds/susamaru-special.mp3'},   // "Having fun? I know I sure am."
  yahaba:   {special: 'sounds/yahaba-special.mp3'},     // "Stop stirring up so much dust! You're filthy!"
   // "Dead Calm" (CK's YouTube pick, 0:18.2-0:22.9; covers Giyu ✦)
};
// What each moment is called (shown on the clip box)
const CLIP_ACTS = {use:'Back pocket', poison:'Poisoned', special:'', unblock:'', attack:'Attack', regen:'Regenerates', heal:'Heals', defend:'Guards', ko:'Knockout', fall:'Falls', revive:'Rises again', split:'Splits'};
// Moments that repeat every round (attacks, guarding, regenerating) show their clip at most once every few rounds
// per fighter, so long matches don't drag. Specials and one-off moments always play.
const CLIP_REPEAT = ['attack','defend','regen','poison'], CLIP_GAP = 3;
// Moments that play every time for a character instead of every CLIP_GAP rounds (CK: Doma's regen and poison)
const CLIP_ALWAYS = {doma:['regen','poison']};

const clipSet = (src, u) => u && (src[u.id] || (BYID[u.id] && BYID[u.id].art && src[BYID[u.id].art]) || (BYID[u.id] && src[BYID[u.id].fam])) || null;   // art: a card that uses another card's picture and clips
// The moment a log line shows and whose it is: {act, u}
function clipMoment(line){
  // a back-pocket helper isn't on the battlefield: it gets a stand-in with its card id, name and owner
  if(line.helper) return {act:'use', u:{uid:`h-${line.hp}-${line.helper}`, id:line.helper, sk:line.helper, name:BYID[line.helper].short, p:line.hp, helper:true}};
  const by=line.by&&findU(line.by), on=line.on&&findU(line.on), has=(u,a)=>!!(clipSet(CLIPS,u)||{})[a];
  switch(line.fx){
    case 'special': return {act:line.sig||'special', u:by};   // a second special (or the Selfless State) has its own clip, under its id   // a second special (or the Selfless State) has its own clip, under its id
    case 'heal': return line.act==='regen' ? {act:'regen', u:on} : by ? {act:'heal', u:by} : null;
    case 'guard': case 'block': return {act:'defend', u:on||by};
    case 'ko': return has(by,'ko') ? {act:'ko', u:by} : {act:'fall', u:on};
    case 'revive': return {act:'revive', u:on||by};
    case 'spawn': return {act:'split', u:on};
    case 'poison': return on ? {act:'poison', u:on} : null;   // poisoned, or poison eating away (Doma and Shinobu's wisteria)
    case 'hit': return line.move==='attack' ? {act:'attack', u:by} : null;
  }
  return null;
}
// Does the special starting at this beat knock anyone out?
const specialKOs = u => { const a=S.play.steps[S.play.k][0]; for(let i=a+1;i<S.log.length && S.log[i].fx!=='special';i++) if(S.log[i].ko && S.log[i].by===u.uid) return true; return false; };
// The clip for one playback step (first line of the step), or null. Records repeat moments in S.clipSeen.
function clipStep(line){
  if(S.clipsOn===false || !line || line.dodge || line.guard || line.calmblock || line.nocut) return null;   // a dodge or a guard shows its own animation, not the attacker's clip
  const m=clipMoment(line); if(!m || !m.u) return null;
  const src=(clipSet(CLIPS,m.u)||{})[m.act]; if(!src) return null;
  const seen=S.clipSeen=S.clipSeen||{}, key=m.u.uid+':'+m.act;
  // A special plays its full clip and voice the first time in a match, and again only when it knocks someone out or a Mark flares
  const every=S.clipRepeat==='every';   // Settings: Repeat clips, Every round
  if(line.fx==='special'){ S.play.quick=!every && seen[key]!==undefined && !line.flare && !specialKOs(m.u); if(S.play.quick) return null; seen[key]=S.round; }
  if(!every && CLIP_REPEAT.includes(m.act) && !(CLIP_ALWAYS[m.u.fam||m.u.id]||[]).includes(m.act)){ if(seen[key]!==undefined && S.round-seen[key]<CLIP_GAP) return null; seen[key]=S.round; }
  const first=!seen['full:'+key]; seen['full:'+key]=true;   // the first time a clip plays this match, it plays to the end
  return {src, first, act:m.act, uid:m.u.uid, who:m.u.helper?m.u:null, sound:(clipSet(CLIP_SOUNDS,m.u)||{})[m.act]||null, key:`${S.round}-${S.play?S.play.k:0}-${m.u.uid}`};
}
// A clip can be a still picture (no video exists): drawn as an <img> for the same beat
const clipIsPic = url => /\.(jpe?g|png|webp)$/i.test(url);
// Downloaded copies (app.js fills this), so a clip starts instantly and isn't fetched again
const CLIP_BLOB = {};
const clipSrc = url => CLIP_BLOB[url] || url;
const matchSounds = () => [...new Set([...(S.teams?allUnits():[]), ...(S.picks||[]).flat().map(id=>BYID[id])]
  .flatMap(u=>Object.values(clipSet(CLIP_SOUNDS,u)||{})))];
// Every clip the fighters in this match could use: downloaded as soon as they're drafted (their sounds too, see matchSounds)
const matchClips = () => [...new Set([...(S.teams?allUnits():[]), ...(S.picks||[]).flat().map(id=>BYID[id])]
  .flatMap(u=>Object.values(clipSet(CLIPS,u)||{})))];
