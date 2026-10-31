/* ================= FIGHT EFFECTS =================
   Breathing-style effects for the fight stage. Every character has a style for their Attack and, when it looks
   different, for their Special (Tanjiro: Water, then Sun for Hinokami Kagura). A style is a kanji impact mark, a colour
   (css: .sty-<name>) and a small SVG drawing that CSS animates (.draw, .burst, .flick…). No DOM. */
const STYLE_KANJI = {
  water:'水', flame:'炎', thunder:'雷', darkthunder:'雷', sun:'日', mist:'霞', wind:'風', stone:'岩', love:'恋', serpent:'蛇',
  sound:'音', insect:'蟲', beast:'獣', flower:'花', moon:'月', ice:'氷', blood:'血', compass:'拳', thread:'糸', drum:'鼓',
  claw:'爪', dream:'夢', slash:'斬',
};
// character (sk) → style, or {attack, special} when the special has its own look
const FIGHT_STYLE = {
  yoriichi:'sun', yoriichi_old:'sun', tanjiro:{attack:'water', special:'sun'}, giyu:'water', urokodaki:'water', sabito:'water',
  murata:'water', rengoku:'flame', zenitsu:'thunder', kaigaku:'darkthunder', muichiro:'mist', sanemi:'wind', gyomei:'stone',
  mitsuri:'love', obanai:'serpent', tengen:'sound', tengen_retired:'sound', shinobu:'insect', inosuke:'beast', kanao:'flower',
  genya:'claw', nezuko:'blood', tamayo:'blood', yushiro:'blood', kagaya:'slash',
  muzan:'blood', muzan_final:'blood', kokushibo:'moon', doma:'ice', akaza:'compass', gyutaro:'blood', gyokko:'water',
  hantengu:'claw', sekido:'thunder', karaku:'wind', aizetsu:'slash', urogi:'sound', enmu:'dream', rui:'thread', kyogai:'drum',
  hand:'claw', swamp:'claw',
  daki:'thread', nakime:'sound', zohakuten:{attack:'thunder', special:'beast'}, susamaru:'compass', yahaba:'wind', kanae:'flower',
  tanjiro_demon:'blood', nezuko_awakened:'blood', typezero:'slash', makomo:'water', hinatsuru:'slash', makio:'slash', suma:'slash', michikatsu:'moon', hakuji:'compass', tanjuro:'sun', dojo_fighter:'slash',
};
const styleOf = (u, move) => { const s=FIGHT_STYLE[u.sk]||'slash'; return typeof s==='string' ? s : (s[move]||s.attack); };

const rep = (n, f) => Array.from({length:n}, (_,i)=>f(i)).join('');
// One drawing per style, in a 100×100 box centred on the fighter. Classes pick the animation (see style.css).
const FX_ART = {
  water: () => `<path class="draw" d="M4 70 Q30 6 56 42 T96 24"/><path class="draw d2" d="M8 86 Q38 34 62 60 T96 44"/>`
    + rep(4, i=>`<circle class="spray" cx="${52+i*8}" cy="${38+i*6}" r="3.5" style="--dx:${12+i*7}px;--dy:${-16+i*9}px"/>`),
  flame: () => rep(3, i=>`<path class="burst" style="--d:${i*.06}s" d="M${34+i*14} 78 C${22+i*14} 56 ${40+i*14} 46 ${32+i*14} ${22+(i%2)*12} C${50+i*14} 40 ${50+i*14} 60 ${42+i*14} 78 Z"/>`)
    + rep(6, i=>`<circle class="spray" cx="50" cy="56" r="2.5" style="--dx:${(i-2.5)*16}px;--dy:${-22-(i%3)*12}px"/>`),
  thunder: () => `<polyline class="flick" points="44,0 58,34 44,38 66,100"/><polyline class="flick f2" points="58,34 78,46 70,58"/>`,
  sun: () => `<circle class="spin" cx="50" cy="50" r="20"/>` + rep(8, i=>`<line class="spin" x1="50" y1="50" x2="${50+46*Math.cos(i*Math.PI/4)}" y2="${50+46*Math.sin(i*Math.PI/4)}" style="stroke-dasharray:0 26 30"/>`),
  mist: () => rep(3, i=>`<ellipse class="drift" style="--d:${i*.12}s" cx="${36+i*14}" cy="${40+i*10}" rx="22" ry="10"/>`),
  wind: () => rep(3, i=>`<path class="draw" style="animation-delay:${.26+i*.07}s,${.8+i*.07}s" d="M6 ${30+i*18} Q50 ${6+i*18} 94 ${36+i*16}"/>`),
  stone: () => rep(6, i=>`<polygon class="spray solid" points="${44+i*3},44 ${54+i*3},40 ${50+i*3},54" style="--dx:${(i-2.5)*18}px;--dy:${(i%2?-1:1)*(14+i*4)}px"/>`),
  love: () => `<path class="draw thick" d="M2 64 C24 20 46 92 70 40 S96 30 98 46"/><path class="draw thick d2" d="M4 80 C30 40 54 100 76 58 S96 52 98 64"/>`,
  serpent: () => `<path class="draw" d="M2 50 C14 26 26 26 38 50 S62 74 74 50 S94 30 98 44"/><circle class="spray" cx="96" cy="44" r="4" style="--dx:6px;--dy:-4px"/>`,
  sound: () => rep(3, i=>`<circle class="ringx" style="--d:${i*.12}s" cx="50" cy="50" r="${18+i*12}"/>`),
  insect: () => rep(3, i=>`<g class="flutter" style="--d:${i*.12}s;--dx:${(i-1)*26}px;--dy:${-30-i*8}px"><ellipse class="solid" cx="${42+i*8}" cy="${50+i*4}" rx="9" ry="6" transform="rotate(-30 ${42+i*8} ${50+i*4})"/><ellipse class="solid" cx="${52+i*8}" cy="${50+i*4}" rx="9" ry="6" transform="rotate(30 ${52+i*8} ${50+i*4})"/></g>`),
  beast: () => `<polyline class="draw" points="8,14 24,30 18,40 40,56 32,66 60,92"/><polyline class="draw d2" points="92,10 74,30 82,40 60,56 68,66 40,94"/>`,
  flower: () => rep(6, i=>`<ellipse class="spray solid" cx="50" cy="50" rx="7" ry="3.5" style="--dx:${36*Math.cos(i*Math.PI/3)}px;--dy:${36*Math.sin(i*Math.PI/3)}px" transform="rotate(${i*60} 50 50)"/>`),
  moon: () => rep(3, i=>`<path class="slice solid" style="--d:${i*.08}s" d="M${20+i*20} ${18+i*10} A30 30 0 1 0 ${44+i*20} ${70+i*6} A24 24 0 1 1 ${20+i*20} ${18+i*10} Z"/>`),
  ice: () => `<g class="spin">${rep(6, i=>{ const a=i*Math.PI/3, x=50+38*Math.cos(a), y=50+38*Math.sin(a); return `<line x1="50" y1="50" x2="${x}" y2="${y}"/><line x1="${50+24*Math.cos(a)}" y1="${50+24*Math.sin(a)}" x2="${50+24*Math.cos(a)+9*Math.cos(a+.9)}" y2="${50+24*Math.sin(a)+9*Math.sin(a+.9)}"/>`; })}</g>`
    + rep(4, i=>`<polygon class="spray solid" points="50,46 54,50 50,54 46,50" style="--dx:${(i%2?1:-1)*(20+i*6)}px;--dy:${(i<2?-1:1)*22}px"/>`),
  blood: () => rep(3, i=>`<path class="draw thick" style="animation-delay:${.24+i*.06}s,${.8+i*.06}s" d="M4 ${24+i*24} C32 ${4+i*24} 52 ${52+i*18} 96 ${30+i*20}"/>`),
  compass: () => `<g class="spin"><circle cx="50" cy="50" r="12"/>${rep(8, i=>`<line x1="50" y1="50" x2="${50+44*Math.cos(i*Math.PI/4)}" y2="${50+44*Math.sin(i*Math.PI/4)}"/>`)}</g>`,
  thread: () => rep(4, i=>`<line class="draw thin" style="animation-delay:${.24+i*.05}s,${.8+i*.05}s" x1="${i%2?96:4}" y1="${10+i*22}" x2="${i%2?4:96}" y2="${30+i*18}"/>`),
  drum: () => rep(3, i=>`<rect class="ringx" style="--d:${i*.12}s" x="${36-i*10}" y="${36-i*10}" width="${28+i*20}" height="${28+i*20}" rx="4"/>`),
  claw: () => rep(3, i=>`<line class="draw" style="animation-delay:${.24+i*.05}s,${.8+i*.05}s" x1="${22+i*16}" y1="10" x2="${42+i*16}" y2="90"/>`),
  dream: () => `<path class="draw" d="M50 50 m0 -6 a6 6 0 1 1 -6 6 a12 12 0 1 1 12 12 a18 18 0 1 1 -18 -18 a26 26 0 1 1 26 26"/>`,
  slash: () => `<line class="draw" x1="10" y1="16" x2="90" y2="84"/>`,
};
// Big moments for a few specials (CK): drawn over the whole screen on the special's first hit, keyed by character (sk).
// Akaza's and Doma's are drawn on their targets instead, so the eye stays on the damage. Tengen's plays on every hit, like
// a drum. Rengoku has one for each special (tiger, then ninth for Ninth Form).
const SPECIAL_FX = {zenitsu:'bolt', muichiro:'mist', tengen:'drum', inosuke:'claws', tanjiro:'firering', rengoku:'tiger', zohakuten:'dragons', kaigaku:'darkbolt', sanemi:'tornado', gyutaro:'sickles', susamaru:'temari', sekido:'redbolt', suma:'kunai', akaza:'annihil', yoriichi:'sunform', yoriichi_old:'sunform',
  muzan:'whips', muzan_final:'whips2', gyomei:'flail', mitsuri:'ribbon', obanai:'snake', enmu:'sleep'};
const whipArt = n => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(n, i=>`<path style="--d:${i*.06}s" d="M${i%2?104:-4} ${16+i*(70/n)} C30 ${(i*37)%100} 70 ${100-(i*53)%100} ${i%2?-4:104} ${30+(i*29)%50}"/>`)}</svg>`;
const SFX_ART = {
  bolt: () => `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><polyline class="b1" points="-2,12 18,20 30,8 46,24 60,10 76,26 102,14"/><polyline class="b2" points="-2,12 18,20 30,8 46,24 60,10 76,26 102,14"/></svg>`,
  mist: () => rep(5, i=>`<i style="--d:${i*.09}s;--y:${8+i*19}%"></i>`),
  drum: () => rep(3, i=>`<i style="--d:${i*.16}s"></i>`),
  claws: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(3, i=>`<line class="c1" style="--d:${i*.05}s" x1="${8+i*24}" y1="-4" x2="${38+i*24}" y2="104"/>`)}${rep(3, i=>`<line class="c2" style="--d:${.26+i*.05}s" x1="${92-i*24}" y1="-4" x2="${62-i*24}" y2="104"/>`)}</svg>`,
  tiger: () => `<span class="tband"><b>炎虎</b></span>`,
  ninth: () => `<span class="nburst"></span><span class="nspin"></span><b class="nk">煉獄</b>`,
  sunform: () => `<span class="sunglow"></span>${rep(13, i=>`<i class="ys" style="--a:${[-34,28,-12,42,-52,16,-26,38,-44,8,-18,30,-38][i]}deg;--x:${[46,54,40,60,50,36,64,44,56,48,38,62,50][i]}%;--y:${[24,32,18,38,28,42,22,34,16,44,30,20,36][i]}%;--d:${i*.09}s"></i>`)}<i class="sflash"></i>`,
  whips: () => whipArt(5),
  whips2: () => whipArt(9),
  flail: () => `<span class="fchain"></span><svg class="fball" viewBox="0 0 100 100"><circle cx="50" cy="50" r="27"/>${rep(10, i=>`<polygon points="50,6 57,26 43,26" transform="rotate(${i*36} 50 50)"/>`)}</svg>`,
  ribbon: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(3, i=>`<path style="--d:${i*.1}s" d="M-4 ${38+i*10} C18 ${10+i*12} 30 ${80-i*8} 50 ${44+i*6} S82 ${12+i*12} 104 ${52+i*6}"/>`)}</svg>`,
  snake: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="body" d="M-8 22 C10 2 22 44 34 24 S46 12 50 34"/><path class="scale" d="M-8 22 C10 2 22 44 34 24 S46 12 50 34"/><path class="body two" d="M108 22 C90 44 78 2 66 24 S54 44 50 34"/><path class="scale two" d="M108 22 C90 44 78 2 66 24 S54 44 50 34"/></svg><i class="fang l"></i><i class="fang r"></i><b class="ser">蛇</b>`,
  sleep: () => `<span class="lid t"></span><span class="lid b"></span><svg class="spiral" viewBox="0 0 100 100"><path d="M50 50 m0 -6 a6 6 0 1 1 -6 6 a12 12 0 1 1 12 12 a18 18 0 1 1 -18 -18 a26 26 0 1 1 26 26 a34 34 0 1 1 -34 -34"/></svg>`,
  crack: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="50,0 46,22 54,34 44,52 56,68 48,100"/><polyline points="46,22 26,30 12,24"/><polyline points="54,34 74,40 90,32"/><polyline points="44,52 22,62 8,60"/><polyline points="56,68 78,72 94,84"/></svg>${['怒','楽','哀','喜'].map((k,i)=>`<b style="--x:${[-34,34,-34,34][i]}vmin;--y:${[-30,-30,30,30][i]}vmin">${k}</b>`).join('')}`,
  darkbolt: () => `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><polyline class="b1" points="-2,28 16,14 30,30 48,12 62,28 80,10 102,24"/><polyline class="b2" points="-2,28 16,14 30,30 48,12 62,28 80,10 102,24"/></svg>`,
  dragons: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(4, i=>`<path style="--d:${i*.12}s" d="M${10+i*27} 108 C${i%2?34+i*14:i*14} 70 ${i%2?i*18:30+i*18} 50 ${20+i*20} ${16+(i%2)*12}"/>`)}</svg>`,
  annihil: () => `<svg class="annring" viewBox="0 0 100 100"><g>${rep(16, i=>`<line x1="50" y1="50" x2="${50+48*Math.cos(i*Math.PI/8)}" y2="${50+48*Math.sin(i*Math.PI/8)}"/>`)}${rep(8, i=>`<polygon points="50,2 54,14 50,26 46,14" transform="rotate(${i*45} 50 50)"/>`)}<circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="47"/></g></svg>`,
  merge: () => ['怒','楽','哀','喜'].map((k,i)=>`<b style="--x:${[-40,40,-40,40][i]}vmin;--y:${[-34,-34,34,34][i]}vmin">${k}</b>`).join('')+'<i class="mflash"></i>',
  biwa: () => rep(3, i=>`<i style="--d:${i*.14}s"></i>`)+'<b>♪</b>',
  tilt: () => '',
  sunsweep: () => '<i></i>',
  tornado: () => `<span class="twist">${rep(9, i=>`<i style="--i:${i};--w:${26+i*7}vmin"></i>`)}</span><b class="wk">風</b>`,
  sickles: () => rep(2, i=>`<svg class="sick s${i}" viewBox="0 0 100 100"><path d="M50 8 C86 12 96 54 70 80 C84 50 72 26 50 24 C28 26 16 50 30 80 C4 54 14 12 50 8 Z"/></svg>`),
  temari: () => '<span class="ball"></span>',
  kunai: () => rep(8, i=>`<i style="--a:${i*45+12}deg;--d:${i*.04}s"></i>`),
  somehow: () => '<b class="smh">Somehow!</b>',
  h_mice: () => rep(5, i=>`<img class="hrun mice" style="--i:${i}" src="${ART.mice||''}" alt="">`),
  h_crow: () => `<img class="hrun fly" src="${ART.crow||''}" alt="">`,
  h_chachamaru: () => `<img class="hrun pad" src="${ART.chachamaru||''}" alt=""><svg class="hcup" viewBox="0 0 100 50"><g transform="rotate(-20 50 25)"><rect x="8" y="12" width="84" height="26" rx="13" fill="#f4e7c6" stroke="#3b2a1c" stroke-width="2"/><path d="M50 12 H79 a13 13 0 0 1 0 26 H50 Z" fill="#c93c4b" stroke="#3b2a1c" stroke-width="2"/><rect x="16" y="16" width="26" height="4" rx="2" fill="#fff" opacity=".7"/></g></svg>`,
  h_goto: m => { const u=m&&m.on&&findU(m.on); return `<img class="hrun haul" src="${ART.goto||''}" alt="">${u&&ART[u.id]?`<img class="hrun hauled" src="${ART[u.id]}" alt="">`:''}`; },
  h_aoi: () => `<svg class="hcup tea" viewBox="0 0 100 80"><path class="steam" d="M38 22 C30 12 46 8 38 -2 M60 22 C52 12 68 8 60 -2" fill="none" stroke="#d7efdc" stroke-width="3" stroke-linecap="round"/><path d="M16 28 H84 C84 56 70 70 50 70 C30 70 16 56 16 28 Z" fill="#e9e2d0" stroke="#3b2a1c" stroke-width="2"/><ellipse cx="50" cy="28" rx="34" ry="8" fill="#7fbf6a" stroke="#3b2a1c" stroke-width="2"/><ellipse cx="50" cy="74" rx="26" ry="4" fill="#8a6a44"/></svg><span class="hwash"></span>`,
  redbolt: () => rep(3, i=>`<svg class="rb r${i}" viewBox="0 0 40 100" preserveAspectRatio="none"><polyline class="b1" points="20,-4 12,22 26,38 14,58 28,74 18,104"/><polyline class="b2" points="20,-4 12,22 26,38 14,58 28,74 18,104"/></svg>`),
  firering: () => `<span class="firering"><i></i><i></i><i></i></span>`,
};
const compassFx = () => `<svg class="compassfx" viewBox="0 0 100 100" aria-hidden="true"><g>${rep(8, i=>`<line x1="50" y1="50" x2="${50+48*Math.cos(i*Math.PI/4)}" y2="${50+48*Math.sin(i*Math.PI/4)}"/>`)}${rep(6, i=>`<polygon points="50,6 54,16 50,26 46,16" transform="rotate(${i*60} 50 50)"/>`)}<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="46"/></g></svg>`;
// Drawn on each fighter a special lands on, so the eye stays on the damage (views.js targetFx, by character)
const TARGET_ART = {
  kanae: () => rep(9, i=>`<ellipse class="tfi fall" style="--d:${i*.08}s" cx="${10+i*10}" cy="${6+(i*37)%30}" rx="4" ry="2.2" transform="rotate(${i*40} ${10+i*10} 20)"/>`),
  hakuji: () => rep(14, i=>`<g transform="translate(${8+(i*37)%84} ${8+(i*53)%80})"><polygon class="tfi fist" style="--d:${i*.06}s" points="0,-9 3,-3 9,-3 4,1 6,8 0,4 -6,8 -4,1 -9,-3 -3,-3"/></g>`),
  typezero: () => rep(6, i=>`<g transform="rotate(${i*60} 50 50)"><path class="tfi tzb" style="--d:${i*.07}s" d="M50 50 L54 8 L50 2 L46 8 Z"/></g>`),
  yahaba: () => rep(5, i=>`<path class="tfi arrow" style="--d:${i*.09}s" d="M2 ${16+i*16} C34 ${4+i*16} 66 ${30+i*14} 94 ${14+i*16} M86 ${10+i*16} L96 ${14+i*16} L88 ${22+i*16}"/>`),
  karaku: () => rep(3, i=>`<g transform="rotate(${i*120} 50 50)"><path class="tfi gust2" style="--d:${i*.08}s" d="M50 6 C84 10 92 46 74 62"/></g>`),
  aizetsu: () => `<path class="tfi spear" d="M-30 92 L92 10 M92 10 L78 12 M92 10 L88 24"/>`,
  urogi: () => rep(3, i=>`<circle class="tfi ringx2" style="--d:${i*.12}s" cx="50" cy="50" r="${18+i*14}"/>`),
  hinatsuru: () => rep(6, i=>`<circle class="tfi puff" style="--d:${i*.08}s" cx="${22+(i*29)%60}" cy="${26+(i*41)%50}" r="${11+i%3*4}"/>`),
  knit: () => rep(9, i=>`<path class="tfi strand" style="--d:${i*.06}s" d="M${6+i*11} ${i%2?98:2} C${30+i*5} 40 ${70-i*5} 62 ${94-i*11} ${i%2?2:98}"/>`),
  crack: () => `<polyline class="tfi crk" points="50,2 44,24 56,36 42,54 58,70 48,98"/><polyline class="tfi crk" style="--d:.1s" points="44,24 22,32 8,26"/><polyline class="tfi crk" style="--d:.1s" points="56,36 78,44 94,36"/><polyline class="tfi crk" style="--d:.2s" points="42,54 20,64 6,62"/><polyline class="tfi crk" style="--d:.2s" points="58,70 80,74 96,86"/>`,
  charm: () => `<g class="tfi"><rect x="36" y="14" width="28" height="62" rx="2" fill="#f2ead8" stroke="#a33" stroke-width="1.2"/><circle cx="50" cy="44" r="8" fill="none" stroke="#a33" stroke-width="1.6"/><line x1="50" y1="24" x2="50" y2="66" stroke="#a33" stroke-width="1.2"/></g>`,
  wires: () => rep(5, i=>`<line class="tfi wire" style="--d:${i*.05}s" x1="${i*25}" y1="-6" x2="${100-i*25}" y2="106"/>`)+rep(3, i=>`<line class="tfi wire" style="--d:${.2+i*.05}s" x1="-6" y1="${20+i*30}" x2="106" y2="${50-i*10}"/>`),
  vase: () => `<path class="tfi pot" d="M34 6 H66 L62 18 C84 32 88 74 68 94 H32 C12 74 16 32 38 18 Z"/><path class="tfi potl" style="--d:.1s" d="M24 44 C38 52 62 52 76 44"/><path class="tfi potl" style="--d:.1s" d="M22 62 C38 70 62 70 78 62"/>`,
  tamayo: () => rep(7, i=>`<g transform="rotate(${i*360/7} 50 50)"><g class="tfi bloom" style="--d:${i*.07}s"><circle cx="50" cy="12" r="3"/>${rep(5, k=>`<ellipse cx="50" cy="6" rx="3.4" ry="6" transform="rotate(${k*72} 50 12)"/>`)}</g></g>`),
  kokushibo: () => rep(3, i=>`<g transform="rotate(${i*120-20} 50 50)"><path class="tfi moon" style="--d:${i*.12}s" d="M34 8 A22 22 0 1 0 66 8 A17 17 0 1 1 34 8 Z"/></g>`),
  shinobu: () => rep(5, i=>`<g transform="rotate(${i*72} 50 50)"><g class="fly" style="--d:${i*.08}s"><ellipse cx="44" cy="10" rx="7" ry="5" transform="rotate(-24 44 10)"/><ellipse cx="56" cy="10" rx="7" ry="5" transform="rotate(24 56 10)"/></g></g>`),
  daki: () => rep(3, i=>`<g transform="rotate(${i*14-14} 50 50)"><ellipse class="tfi sash" style="--d:${i*.1}s" cx="50" cy="${28+i*22}" rx="48" ry="9"/></g>`),
  nezuko: () => rep(7, i=>`<path class="tfi pflame" style="--d:${i*.05}s" d="M${14+i*12} 92 C${6+i*12} 66 ${24+i*12} 54 ${14+i*12} ${26+(i%3)*12} C${32+i*12} 48 ${30+i*12} 72 ${22+i*12} 92 Z"/>`),
  rui: () => rep(3, i=>`<line class="tfi thr" style="--d:${i*.06}s" x1="${i%2?100:0}" y1="${14+i*22}" x2="${i%2?0:100}" y2="${34+i*16}"/>`),
};
// Doma's Frozen Lotus: ice petals open around each fighter it hits, leaving the middle clear for the damage
const lotusFx = () => `<svg class="lotusfx" viewBox="0 0 100 100" aria-hidden="true">${rep(8, i=>`<g transform="rotate(${i*45} 50 50)"><path style="--d:${i*.05}s" d="M50 2 C60 10 60 20 50 28 C40 20 40 10 50 2 Z"/></g>`)}</svg>`;
// The effect drawn over a fighter: style art plus the style's colour class
const fxArt = (style, extra='') => `<svg class="fxl sty-${style} ${extra}" viewBox="0 0 100 100" aria-hidden="true">${(FX_ART[style]||FX_ART.slash)()}</svg>`;
