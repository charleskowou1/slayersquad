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
// Hantengu's four emotions, for his split and merge
const EMOTIONS = [['sekido','怒'],['karaku','楽'],['aizetsu','哀'],['urogi','喜']];
const emoFace = id => ART[id] ? `<img decoding="sync" src="${ART[id]}" alt="">` : `<em>${BYID[id].g}</em>`;
const FIGHT_STYLE = {
  yoriichi:'sun', yoriichi_old:'sun', tanjiro:{attack:'water', special:'sun'}, giyu:'water', urokodaki:'water', sabito:'water',
  murata:'water', rengoku:'flame', zenitsu:'thunder', kaigaku:'darkthunder', muichiro:'mist', sanemi:'wind', gyomei:'stone',
  mitsuri:'love', obanai:'serpent', tengen:'sound', tengen_retired:'sound', shinobu:'insect', inosuke:'beast', kanao:'flower',
  genya:'claw', nezuko:'blood', tamayo:'blood', yushiro:'blood', kagaya:'slash',
  muzan:'blood', muzan_final:'blood', kokushibo:'moon', doma:'ice', akaza:'compass', gyutaro:'blood', gyokko:'water', gyokko_perfect:'water',
  hantengu:'claw', hantengu_true:'claw', sekido:'thunder', karaku:'wind', aizetsu:'slash', urogi:'sound', enmu:'dream', rui:'thread', kyogai:'drum',
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
  // Sun Breathing on the target: a crossed blaze of golden cuts, no sun disc (CK didn't want suns on the targets)
  sun: () => `<path class="draw thick" d="M14 30 L86 70"/><path class="draw d2 thick" d="M16 72 L84 28"/><path class="draw thin" style="opacity:.8" d="M30 12 L70 88"/>`,
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
const SPECIAL_FX = {doma:'frostbloom', kokushibo:'kmoon', zenitsu:'bolt', muichiro:'mist', tengen:'mscore', kanae:'hanagoromo', inosuke:'twinblades', shinobu:'stinger', tanjiro:'firering', rengoku:'tiger', zohakuten:'dragons', kaigaku:'darkbolt', sanemi:'tornado', gyutaro:'sickles', susamaru:'temari', sekido:'redbolt', suma:'kunai', akaza:'compass', yoriichi:'sunform', yoriichi_old:'sunform',
  muzan:'whips', muzan_final:'whipfan2', gyomei:'flail', mitsuri:'ribbon', obanai:'snake', enmu:'sleep',
  urokodaki:'waterwheel', makio:'burst', hand:'hands', tanjuro:'kagura', sabito:'boulder',
  kanao:'bloom', tanjiro_demon:'tendrils', murata:'fizzle', gyokko:'goldfish'};   // Awakened Nezuko: her targets catch pink fire (TARGET_ART)   // Sabito: the boulder on Mount Sagiri, cut clean in two   // CK, Nov 3, 2026: the last specials without their own moment
const UPPER_RANK = ['','壱','弐','参','肆','伍','陸'];
const whipArt = n => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(n, i=>`<path style="--d:${i*.06}s" d="M${i%2?104:-4} ${16+i*(70/n)} C30 ${(i*37)%100} 70 ${100-(i*53)%100} ${i%2?-4:104} ${30+(i*29)%50}"/>`)}</svg>`;
// Animation round 2 (Nov 10, 2026, CK kept these): Inosuke's twin blades, Shinobu's stinger, Final Form Muzan's whip fan,
// Rengoku's Ninth Form flame beast. Big pieces cross the middle of the screen (CK: keep effects near the middle).
const JAG = `<svg viewBox="0 0 120 30"><path d="M2 15 L18 6 L24 12 L34 4 L40 11 L52 3 L58 10 L70 3 L76 10 L88 4 L94 11 L118 15 L94 19 L88 26 L76 20 L70 27 L58 20 L52 27 L40 19 L34 26 L24 18 L18 24 Z" fill="#b8c2cc" stroke="#3a4450" stroke-width="2"/><rect x="0" y="12" width="8" height="6" fill="#4a3424"/></svg>`;
const whipFan = n => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(n, i=>{ const y=50+(i-(n-1)/2)*(80/n), c=50+(i%2?-18:18); return `<path style="--d:${i*.07}s" d="M0 50 C30 ${c} 60 ${y-10} 100 ${y}"/><circle class="crack" style="--d:${.32+i*.07}s" cx="96" cy="${y}" r="3"/>`; })}</svg>`;
const SFX_ART = {
  // Animation round 3 (Nov 11, 2026, testing): Zenitsu's Seventh Form, Mark Tanjiro's unblockable Hinokami, Tengen's Musical Score, Kanae's Crimson Hanagoromo
  thunderdragon: () => { // bolts crackle off the dragon's body as it passes (CK: lightning around it)
    const bolt=(x,y,dir,len,k)=>{ let pts=[[x,y]], cx=x, cy=y; for(let j=1;j<=5;j++){ cx+=((j+k)%2?9:-9)+(k%3-1)*3; cy+=dir*len/5; pts.push([cx,cy]); } const br=pts[2]; return `M${pts.map(q=>q.join(' ')).join(' L')} M${br[0]} ${br[1]} l${k%2?14:-14} ${dir*10} l${k%2?-4:4} ${dir*9}`; };
    const bolts=rep(12,i=>{ const x=18+i*30, dir=i%2?1:-1, t=(.1+.55*x/360).toFixed(2); return `<path class="tdr-zap" style="--d:${t}s" d="${bolt(x,60+dir*14,dir,34+(i%3)*10,i)}"/>`; });
    return `<span class="tdr-flash"></span><svg class="tdr" viewBox="0 0 400 120" preserveAspectRatio="none"><defs><linearGradient id="tdrg" x1="0" x2="1"><stop offset="0" stop-color="#ff4a12" stop-opacity="0"/><stop offset=".5" stop-color="#ffb020"/><stop offset="1" stop-color="#fff6c8"/></linearGradient></defs>
    ${bolts}<path class="tdr-body" d="M0 64 C40 30 70 96 110 60 C150 24 180 92 220 58 C260 26 290 88 330 56 L360 46"/><path class="tdr-core" d="M0 64 C40 30 70 96 110 60 C150 24 180 92 220 58 C260 26 290 88 330 56 L360 46"/>${rep(5,i=>`<path class="tdr-bolt" style="--d:${.15+i*.07}s" d="M${70+i*60} ${20+(i%2)*70} l10 18 l-8 2 l12 22"/>`)}
    <g class="tdr-head"><path d="M352 40 L392 52 L370 58 L390 70 L352 66 Z"/><circle cx="366" cy="50" r="2.6"/><path class="tdr-crown" d="M356 40 l6 -16 l2 12 l8 -14 l0 16"/></g></svg>${rep(10,i=>`<i class="tdr-spark" style="--x:${8+i*9}%;--y:${30+((i*29)%34)}%;--d:${(.15+i*.06).toFixed(2)}s"></i>`)}<b class="tdr-k">炎雷神</b>`; },
  sundragon: () => { // the unblockable Hinokami: the stage goes dark, a sun rises, a great dragon coils in and erupts (CK: the first was too weak)
    const coil='M200 30 C300 30 360 100 360 190 C360 290 290 360 200 360 C110 360 44 296 44 206 C44 128 104 82 178 84 C250 86 290 140 288 200 C286 254 246 284 200 282 C160 280 136 254 138 222 C140 196 160 182 186 184';
    return `<span class="sdr-dim"></span><span class="sdr-rays"></span><span class="sdr-sun"></span><svg class="sdr" viewBox="0 0 400 400"><defs><linearGradient id="sdrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a14"/><stop offset=".45" stop-color="#ffb52a"/><stop offset="1" stop-color="#fff4c0"/></linearGradient></defs>
    <path class="sdr-glow" d="${coil}"/><path class="sdr-body" d="${coil}"/><path class="sdr-scale" d="${coil}"/>
    <g class="sdr-head"><path d="M186 184 L150 206 L166 186 L140 176 L170 172 L150 154 L184 166 L196 150 L200 172 Z"/><circle cx="176" cy="176" r="3.4"/></g></svg>
    <span class="sdr-flash"></span><span class="sdr-ring"></span><span class="sdr-ring r2"></span>${rep(14,i=>`<i class="sdr-ember" style="--a:${i*360/14}deg;--d:${(1.15+(i%4)*.05).toFixed(2)}s;--l:${110+(i%3)*40}px"></i>`)}<b class="sdr-k">日</b>`; },
  mscore: () => `<svg class="msc" viewBox="0 0 400 120" preserveAspectRatio="none">${rep(5,i=>`<line class="msc-line" style="--d:${i*.05}s" x1="0" y1="${30+i*14}" x2="400" y2="${30+i*14}"/>`)}</svg>${rep(7,i=>`<span class="msc-note" style="--x:${10+i*13}%;--y:${22+((i*37)%50)}%;--d:${.35+i*.12}s">${['♪','♫','♩','♬'][i%4]}</span>`)}<b class="msc-k">譜面</b>`,
  hanagoromo: () => `<svg class="hng" viewBox="0 0 200 200">${rep(8,i=>`<g transform="rotate(${i*45} 100 100)"><path class="hng-p" style="--d:${i*.05}s" d="M100 100 C88 76 90 52 100 34 C110 52 112 76 100 100 Z"/><path class="hng-cut" style="--d:${1.05+i*.04}s" d="M100 80 L100 6"/></g>`)}<circle class="hng-c" cx="100" cy="100" r="9"/></svg><b class="hng-k">花衣</b>`,
  // Doma (Nov 11, 2026): Frozen Lotus fills the screen with frost and drifting ice petals behind a great lotus
  frostbloom: () => `<span class="fb-frost"></span><svg class="fb-lotus" viewBox="0 0 200 120">${rep(9,i=>`<g transform="rotate(${(i-4)*19} 100 112)"><path style="--d:${(.05+Math.abs(i-4)*.06).toFixed(2)}s" d="M100 112 C116 86 116 52 100 18 C84 52 84 86 100 112 Z"/></g>`)}</svg>${rep(16,i=>`<i class="fb-petal" style="--x:${(i*37)%100}%;--d:${((i*.13)%1.2).toFixed(2)}s;--r:${(i*53)%360}deg;--s:${(.6+(i%4)*.2).toFixed(1)}"></i>`)}<b class="fb-k">蓮葉氷</b>`,
  // Doma's second special: Rime Ice, Water Lily Bodhisattva. A giant ice Buddha rises behind the stage, opens its eyes
  // and breathes a storm of frost across the slayers
  buddha: () => `<span class="bd-cold"></span><svg class="bud" viewBox="0 0 200 230"><defs><linearGradient id="budg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fcff"/><stop offset=".45" stop-color="#a6dcf7"/><stop offset="1" stop-color="#3a7fb0"/></linearGradient><radialGradient id="budh"><stop offset=".55" stop-color="#bfe8ff" stop-opacity="0"/><stop offset=".8" stop-color="#d6f1ff" stop-opacity=".55"/><stop offset="1" stop-color="#bfe8ff" stop-opacity="0"/></radialGradient></defs>
    <circle class="bud-halo" cx="100" cy="62" r="62" fill="url(#budh)"/><circle class="bud-ring" cx="100" cy="62" r="52" fill="none" stroke="#e4f6ff" stroke-width="1.4" stroke-dasharray="2 6"/>
    <g fill="url(#budg)" stroke="#eaf8ff" stroke-width="1.6" stroke-linejoin="round"><path d="M28 192 C40 176 70 174 100 180 C130 174 160 176 172 192 C160 204 130 206 100 202 C70 206 40 204 28 192 Z"/><path d="M100 90 C76 90 62 100 56 116 L38 170 C34 182 46 190 60 188 L140 188 C154 190 166 182 162 170 L144 116 C138 100 124 90 100 90 Z"/><path d="M90 80 L110 80 L112 94 L88 94 Z"/><path d="M79 56 C72 56 72 80 80 86 Z"/><path d="M121 56 C128 56 128 80 120 86 Z"/><ellipse cx="100" cy="60" rx="21" ry="25"/><path d="M79 54 C78 34 122 34 121 54 C114 44 86 44 79 54 Z"/><circle cx="100" cy="31" r="8"/><path d="M100 104 L93 138 L100 143 L107 138 Z"/></g>
    <g fill="none" stroke="#e8f8ff" stroke-width="1" opacity=".75"><path d="M70 120 Q82 150 76 180"/><path d="M130 120 Q118 150 124 180"/><path d="M84 100 Q100 112 116 100"/></g>
    <g class="bud-face" fill="none" stroke="#24608c" stroke-width="1.8" stroke-linecap="round"><path d="M88 60 Q92 63 97 60"/><path d="M103 60 Q108 63 112 60"/><path d="M95 74 Q100 76 105 74"/></g><g class="bud-eyes" fill="#ff3d6e"><ellipse cx="92.5" cy="60" rx="3.2" ry="2"/><ellipse cx="107.5" cy="60" rx="3.2" ry="2"/></g><circle cx="100" cy="50" r="1.6" fill="#24608c"/>
    <g fill="#e0f5ff" stroke="#fff" stroke-width="1">${rep(9,i=>`<path d="M${20+i*20} 226 C${11+i*20} 212 ${15+i*20} 200 ${20+i*20} 192 C${25+i*20} 200 ${29+i*20} 212 ${20+i*20} 226 Z"/>`)}</g></svg>
    <span class="bd-breath"></span>${rep(14,i=>`<i class="bd-ice" style="--y:${(18+(i*23)%60)}%;--d:${(1.15+(i%5)*.07).toFixed(2)}s;--s:${(.6+(i%3)*.3).toFixed(1)}"></i>`)}<b class="bd-k">睡蓮菩薩</b>`,
  // Kokushibo's Sixteenth Form: one enormous crescent cuts across, trailing small moons
  moonbow: () => `<span class="mb-dark"></span><svg class="mb-arc" viewBox="0 0 400 200" preserveAspectRatio="none"><path d="M-20 170 Q200 -60 420 170 Q200 -10 -20 170 Z"/></svg>${rep(9,i=>`<i class="mb-moon" style="--x:${8+i*10}%;--y:${30+((i*31)%40)}%;--d:${(.3+i*.05).toFixed(2)}s;--s:${(.5+(i%3)*.3).toFixed(1)}"></i>`)}<b class="mb-k">月虹</b>`,
  // Kokushibo's Fourteenth Form: a storm of crescent blades whirls out over every enemy
  crescents: () => `<span class="mb-dark"></span><span class="cr-storm">${rep(12,i=>`<i style="--a:${i*30}deg;--r:${18+(i%3)*12}vmin;--d:${(i*.04).toFixed(2)}s"></i>`)}</span><b class="mb-k">天満繊月</b>`,
  twinblades: () => `<span class="tblade a">${JAG}</span><span class="tblade b">${JAG}</span>`,
  stinger: () => `<span class="stg-needle"></span><svg class="stg-fly" viewBox="0 0 60 40"><path d="M30 20 C18 2 2 4 6 18 C2 30 18 36 30 22 C42 36 58 30 54 18 C58 4 42 2 30 20 Z" fill="#b48ae6" stroke="#5b2f8a" stroke-width="1.5"/><path d="M30 12 V30" stroke="#2a1640" stroke-width="2"/></svg><svg class="stg-veins" viewBox="0 0 100 100">${rep(7, i=>`<path style="--d:${.45+i*.06}s" d="M50 50 L${50+40*Math.cos(i*0.9)} ${50+40*Math.sin(i*0.9)}"/>`)}</svg>`,
  whipfan2: () => whipFan(9),
  // Nov 3, 2026: Urokodaki's water wheel, Makio's blast, the Hand Demon's arms, Tanjuro's Hinokami dance in the snow, Sabito's fox mask
  waterwheel: () => `<svg viewBox="0 0 100 100"><g class="ww">${rep(8,i=>`<path d="M50 50 L50 14 A36 36 0 0 1 ${50+36*Math.sin((i+1)*Math.PI/4)} ${50-36*Math.cos((i+1)*Math.PI/4)}" transform="rotate(${i*45} 50 50)"/>`)}</g></svg>`,
  burst: () => `<span class="bflash"></span>${rep(12,i=>`<i style="--a:${i*30}deg;--d:${(i%3)*.05}s"></i>`)}`,
  hands: () => rep(6,i=>`<svg class="arm a${i}" viewBox="0 0 40 100"><path d="M20 100 C14 70 24 50 18 30 C16 22 10 18 8 10 M18 30 C22 20 28 16 30 6 M18 30 C20 22 22 14 20 2 M18 30 C14 24 12 18 14 8"/></svg>`),
  kagura: () => `<span class="kring"></span><span class="kring k2"></span>${rep(14,i=>`<i style="--x:${(i*29)%100}%;--d:${(i%7)*.12}s"></i>`)}`,
  // Gyokko's Thousand Needles: goldfish swim in and fire needles (CK: no vase)
  goldfish: () => `${rep(5,i=>`<svg class="gf" style="--y:${16+i*16}%;--d:${i*.08}s;--s:${i%2?-1:1}" viewBox="0 0 60 30"><path d="M8 15 C18 2 38 2 46 15 C38 28 18 28 8 15 Z"/><path class="tail" d="M46 15 L58 5 L55 15 L58 25 Z"/><circle cx="16" cy="13" r="2"/></svg>`)}${rep(14,i=>`<i class="nd" style="--a:${-30+i*4.5}deg;--d:${.45+(i%7)*.05}s"></i>`)}<span class="gf-splash"></span>`,
  // Kanao's Equinoctial Vermilion Eye: a crimson flower blooms, a cut, then its petals scatter (CK: no eyes)
  bloom: () => `<svg class="bl" viewBox="0 0 100 100">${rep(6,i=>`<path class="blp" style="--r:${i*60}deg;--d:${i*.05}s" d="M50 50 C40 34 42 16 50 8 C58 16 60 34 50 50 Z"/>`)}<circle class="blc" cx="50" cy="50" r="7"/></svg><i class="bl-cut"></i>${rep(16,i=>`<i class="pk" style="--a:${i*22.5}deg;--d:${.9+(i%5)*.04}s"></i>`)}`,
  petalspin: () => `<span class="pk-eyes"><i></i><i></i></span>${rep(18,i=>`<i class="pk" style="--a:${i*20}deg;--d:${i*.04}s"></i>`)}`,
  tendrils: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(9,i=>`<path style="--d:${i*.05}s" d="M50 50 C${30+i*5} ${20+i*3} ${70-i*4} ${80-i*5} ${4+i*11} ${i%2?6:94}"/>`)}</svg><span class="td-core"></span>`,
  bloodfire: () => `<span class="bf-wave"></span>${rep(22,i=>`<i class="bf" style="--x:${(i*41)%100}%;--d:${(i%8)*.05}s;--h:${30+(i*17)%40}vmin"></i>`)}`,
  fizzle: () => `<span class="fz-wave"></span>${rep(5,i=>`<i class="fz" style="--a:${-50+i*25}deg;--d:${i*.05}s"></i>`)}<b class="fz-puff">…</b>`,
  boulder: () => `<span class="bd-l"></span><span class="bd-r"></span><i class="bd-cut"></i>${rep(14,i=>`<i class="bd-spray" style="--a:${-70+i*10}deg;--d:${(i%4)*.04}s"></i>`)}`,
  foxmask: () => `<svg class="fox" viewBox="0 0 100 100"><path d="M50 12 C70 12 84 24 86 44 C88 64 72 86 50 90 C28 86 12 64 14 44 C16 24 30 12 50 12 Z"/><path class="fm" d="M28 40 L42 46 M72 40 L58 46 M44 30 C48 26 52 26 56 30 M30 62 C40 58 44 66 50 66 C56 66 60 58 70 62"/></svg><span class="rip"></span><span class="rip r2"></span>`,
  // Nov 3, 2026: an Upper Moon's first move of the match, and two fighters falling on the same beat
  upper: m => `<span class="upeye"><b>上弦の${UPPER_RANK[+(((BYID[m.u.id]||{}).type||'').match(/\d/)||[0])[0]]||''}</b><small>${m.u.name}</small></span>`,
  doubleko: () => '<b class="dko">Double KO</b>',
  // Muzan's death across the whole screen: dark red build-up, cracks, a white flash, three shockwaves, bars, embers (CK: more climactic)
  muzandeath: () => `<span class="md-dark"></span><svg class="md-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">${['M50 50 L10 4','M50 50 L92 10','M50 50 L98 58','M50 50 L70 98','M50 50 L22 96','M50 50 L2 40','M30 28 L14 30','M74 30 L86 22','M62 76 L80 84','M28 70 L12 64'].map((d,i)=>`<path style="--d:${i*.04}s" d="${d}"/>`).join('')}</svg><span class="md-flash"></span>${rep(3,i=>`<span class="md-ring" style="--d:${1.05+i*.16}s"></span>`)}<i class="md-bar t"></i><i class="md-bar b"></i>${rep(40,i=>`<i class="md-ember" style="--x:${(i*37)%100}%;--dx:${((i*53)%60)-30}px;--d:${1.2+(i%10)*.12}s;--s:${3+(i*7)%6}px"></i>`)}<b class="md-name">無惨</b>`,
  bolt: () => `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><polyline class="b1" points="-2,12 18,20 30,8 46,24 60,10 76,26 102,14"/><polyline class="b2" points="-2,12 18,20 30,8 46,24 60,10 76,26 102,14"/></svg>`,
  mist: () => rep(5, i=>`<i style="--d:${i*.09}s;--y:${8+i*19}%"></i>`),
  drum: () => rep(3, i=>`<i style="--d:${i*.16}s"></i>`),
  claws: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(3, i=>`<line class="c1" style="--d:${i*.05}s" x1="${8+i*24}" y1="-4" x2="${38+i*24}" y2="104"/>`)}${rep(3, i=>`<line class="c2" style="--d:${.26+i*.05}s" x1="${92-i*24}" y1="-4" x2="${62-i*24}" y2="104"/>`)}</svg>`,
  tiger: () => `<span class="tband"><b>炎虎</b></span>`,
  ninth: () => `<span class="nburst"></span><span class="flamebeast"><svg viewBox="0 0 320 150"><defs><linearGradient id="nbfire" x1="0" x2="1"><stop offset="0" stop-color="#ff2a00" stop-opacity="0"/><stop offset=".35" stop-color="#ff5a10"/><stop offset=".75" stop-color="#ffb030"/><stop offset="1" stop-color="#fff2b0"/></linearGradient><linearGradient id="nbhead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd24a"/><stop offset=".55" stop-color="#ff7a14"/><stop offset="1" stop-color="#d42a00"/></linearGradient><radialGradient id="nbeye"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffe95c"/><stop offset="1" stop-color="#ff5a00" stop-opacity="0"/></radialGradient></defs>
    <g class="fb-trail">${rep(6,i=>`<path style="--d:${i*.05}s" d="M${10+i*18} ${78+(i%2?-1:1)*(10+i*3)} C${60+i*20} ${50-i*4} ${110+i*12} ${110+i*3} ${190} ${72+(i%3-1)*8}" />`)}</g>
    <path class="fb-body" d="M30 76 C70 40 110 104 150 62 C170 42 188 50 200 58 L206 92 C188 100 168 92 150 104 C112 128 70 96 30 76 Z"/>
    <g class="fb-mane">${rep(9,i=>`<path style="--d:${i*.04}s" d="M${214-i*10} ${50+i*3} C${200-i*12} ${30+i*4} ${196-i*14} ${8+i*6} ${186-i*14} ${-4+i*7} C${206-i*12} ${14+i*6} ${214-i*10} ${30+i*3} ${222-i*9} ${46+i*2} Z"/>`)}</g>
    <g class="fb-head"><path class="fb-skull" d="M196 52 C220 30 262 30 290 46 L312 56 L298 64 L276 62 C262 62 252 70 246 80 L214 92 C204 86 198 70 196 52 Z"/>
      <path class="fb-stripe" d="M214 50 L230 44 L226 54 Z M226 62 L244 54 L240 66 Z M244 38 L252 34 L250 44 Z M276 46 L290 48 L282 54 Z"/><path class="fb-brow" d="M230 38 L272 42 L250 50 Z"/><ellipse class="fb-eye" cx="258" cy="50" rx="9" ry="4.2" fill="url(#nbeye)"/><path class="fb-pupil" d="M258 46.5 L260 50 L258 53.5 L256 50 Z"/>
      <path class="fb-fangs" d="M262 64 L266 76 L270 63 L276 74 L280 62 L286 70 L290 61 Z"/>
      <g class="fb-jaw"><path class="fb-jawp" d="M214 92 L246 82 C262 80 282 84 300 82 L290 96 C268 104 236 106 214 92 Z"/><path class="fb-fangs" d="M256 84 L260 74 L264 85 L270 74 L274 85 L280 76 L284 84 Z"/></g></g>
    <g class="fb-embers">${rep(12,i=>`<circle style="--d:${(i*.07).toFixed(2)}s;--dx:${-40-(i*23)%90}px;--dy:${-30+(i*37)%60}px" cx="${120+(i*17)%80}" cy="${60+(i*29)%40}" r="${1.6+(i%3)}"/>`)}</g></svg><i class="fb-roar"></i></span><b class="nk">煉獄</b>`,
  sunform: () => `<span class="sunglow"></span>${rep(13, i=>`<i class="ys" style="--a:${[-34,28,-12,42,-52,16,-26,38,-44,8,-18,30,-38][i]}deg;--x:${[46,54,40,60,50,36,64,44,56,48,38,62,50][i]}%;--y:${[24,32,18,38,28,42,22,34,16,44,30,20,36][i]}%;--d:${i*.09}s"></i>`)}<i class="sflash"></i>`,
  whips: () => whipArt(5),
  whips2: () => whipArt(9),
  flail: () => `<span class="fchain"></span><svg class="fball" viewBox="0 0 100 100"><circle cx="50" cy="50" r="27"/>${rep(10, i=>`<polygon points="50,6 57,26 43,26" transform="rotate(${i*36} 50 50)"/>`)}</svg>`,
  ribbon: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(3, i=>`<path style="--d:${i*.1}s" d="M-4 ${38+i*10} C18 ${10+i*12} 30 ${80-i*8} 50 ${44+i*6} S82 ${12+i*12} 104 ${52+i*6}"/>`)}</svg>`,
  snake: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="body" d="M-8 22 C10 2 22 44 34 24 S46 12 50 34"/><path class="scale" d="M-8 22 C10 2 22 44 34 24 S46 12 50 34"/><path class="body two" d="M108 22 C90 44 78 2 66 24 S54 44 50 34"/><path class="scale two" d="M108 22 C90 44 78 2 66 24 S54 44 50 34"/></svg><i class="fang l"></i><i class="fang r"></i><b class="ser">蛇</b>`,
  sleep: () => `<span class="lid t"></span><span class="lid b"></span><svg class="spiral" viewBox="0 0 100 100"><path d="M50 50 m0 -6 a6 6 0 1 1 -6 6 a12 12 0 1 1 12 12 a18 18 0 1 1 -18 -18 a26 26 0 1 1 26 26 a34 34 0 1 1 -34 -34"/></svg>`,
  crack: () => `<span class="husk">${emoFace('hantengu')}</span><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="50,0 46,22 54,34 44,52 56,68 48,100"/><polyline points="46,22 26,30 12,24"/><polyline points="54,34 74,40 90,32"/><polyline points="44,52 22,62 8,60"/><polyline points="56,68 78,72 94,84"/></svg><i class="mflash"></i>${EMOTIONS.map(([id,k],i)=>`<span class="emo" style="--x:${[-30,30,-30,30][i]}vmin;--y:${[-26,-26,26,26][i]}vmin;--i:${i}">${emoFace(id)}<b>${k}</b></span>`).join('')}`,
  darkbolt: () => `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><polyline class="b1" points="-2,28 16,14 30,30 48,12 62,28 80,10 102,24"/><polyline class="b2" points="-2,28 16,14 30,30 48,12 62,28 80,10 102,24"/></svg>`,
  dragons: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(4, i=>`<path style="--d:${i*.12}s" d="M${10+i*27} 108 C${i%2?34+i*14:i*14} 70 ${i%2?i*18:30+i*18} 50 ${20+i*20} ${16+(i%2)*12}"/>`)}</svg>`,
  // Akaza's Compass Needle (Nov 12, 2026, CK: his special was weak): the snowflake compass opens across the floor, the needle
  // swings and locks onto the target with a glint, then a barrage of shockwaves bursts on them (no fist: CK turned that down)
  compass: () => `<span class="ak-dim"></span><svg class="ak-flake" viewBox="0 0 200 200"><g class="ak-spin">${rep(12,i=>`<g transform="rotate(${i*30} 100 100)"><line x1="100" y1="100" x2="100" y2="8"/><line x1="100" y1="40" x2="88" y2="28"/><line x1="100" y1="40" x2="112" y2="28"/><line x1="100" y1="64" x2="92" y2="56"/><line x1="100" y1="64" x2="108" y2="56"/></g>`)}<circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="58"/><circle cx="100" cy="100" r="22"/></g><line class="ak-needle" x1="100" y1="100" x2="100" y2="14"/><circle class="ak-hub" cx="100" cy="100" r="6"/></svg>
    <span class="ak-glint"></span>${rep(7,i=>`<i class="ak-burst" style="--d:${(1.05+i*.09).toFixed(2)}s;--x:${(((i*37)%30)-15)}px;--y:${(((i*23)%26)-13)}px"></i>`)}${rep(10,i=>`<i class="ak-streak" style="--a:${i*36+8}deg;--d:${(1.05+(i%5)*.08).toFixed(2)}s"></i>`)}<b class="ak-k">破壊殺</b>`,
  // Annihilation Type (Nov 12, 2026): the compass opens under every enemy, then the whole field erupts in shockwaves
  annihilx: () => `<span class="ak-dim"></span>${SFX_ART.annihil()}<span class="ax-flash"></span><span class="ax-ring"></span><span class="ax-ring r2"></span>${rep(16,i=>`<i class="ax-beam" style="--a:${i*22.5}deg;--d:${(1.05+(i%4)*.05).toFixed(2)}s"></i>`)}${rep(5,i=>`<i class="ak-burst ax" style="--d:${(1.1+i*.1).toFixed(2)}s;--x:${(i-2)*22}vw;--y:0px"></i>`)}<b class="ak-k">破壊殺・滅式</b>`,
  annihil: () => `<svg class="annring" viewBox="0 0 100 100"><g>${rep(16, i=>`<line x1="50" y1="50" x2="${50+48*Math.cos(i*Math.PI/8)}" y2="${50+48*Math.sin(i*Math.PI/8)}"/>`)}${rep(8, i=>`<polygon points="50,2 54,14 50,26 46,14" transform="rotate(${i*45} 50 50)"/>`)}<circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="47"/></g></svg>`,
  merge: () => EMOTIONS.map(([id,k],i)=>`<span class="emo" style="--x:${[-34,34,-34,34][i]}vmin;--y:${[-28,-28,28,28][i]}vmin">${emoFace(id)}<b>${k}</b></span>`).join('')+`<i class="mflash"></i><span class="husk zoh">${emoFace('zohakuten')}<b>憎</b></span>`,
  biwa: () => rep(3, i=>`<i style="--d:${i*.14}s"></i>`)+'<b>♪</b>',
  tilt: () => '',
  sunsweep: () => '<i></i>',
  tornado: () => `<span class="twist">${rep(9, i=>`<i style="--i:${i};--w:${26+i*7}vmin"></i>`)}</span><b class="wk">風</b>`,
  sickles: () => rep(2, i=>`<svg class="sick s${i}" viewBox="0 0 100 100"><path d="M50 8 C86 12 96 54 70 80 C84 50 72 26 50 24 C28 26 16 50 30 80 C4 54 14 12 50 8 Z"/></svg>`),
  temari: () => '<span class="ball"></span>',
  kunai: () => rep(8, i=>`<i style="--a:${i*45+12}deg;--d:${i*.04}s"></i>`),
  somehow: () => '<b class="smh">Somehow!</b>',
  h_mice: () => rep(5, i=>`<img class="hrun mice" style="--i:${i}" src="${ART.mice||''}" alt="">`),
  h_crow: () => `<img class="hrun fly" src="${ART.crow||''}" alt=""><span class="crowletter"><b>報</b><em>Report!</em></span>${rep(6,i=>`<i class="crowfeather" style="--x:${14+i*13}%;--d:${(.35+i*.11).toFixed(2)}s;--r:${(i*67)%360}deg"></i>`)}`,   // swoops across, drops its letter, feathers drift down (Nov 12, 2026)
  h_chachamaru: () => `<img class="hrun pad" src="${ART.chachamaru||''}" alt=""><svg class="hcup" viewBox="0 0 100 50"><g transform="rotate(-20 50 25)"><rect x="8" y="12" width="84" height="26" rx="13" fill="#f4e7c6" stroke="#3b2a1c" stroke-width="2"/><path d="M50 12 H79 a13 13 0 0 1 0 26 H50 Z" fill="#c93c4b" stroke="#3b2a1c" stroke-width="2"/><rect x="16" y="16" width="26" height="4" rx="2" fill="#fff" opacity=".7"/></g></svg>`,
  h_goto: m => { const u=m&&m.on&&findU(m.on); return `<img class="hrun haul" src="${ART.goto||''}" alt="">${u&&ART[u.id]?`<img class="hrun hauled" src="${ART[u.id]}" alt="">`:''}`; },
  h_aoi: () => `<svg class="hcup tea" viewBox="0 0 100 80"><path class="steam" d="M38 22 C30 12 46 8 38 -2 M60 22 C52 12 68 8 60 -2" fill="none" stroke="#d7efdc" stroke-width="3" stroke-linecap="round"/><path d="M16 28 H84 C84 56 70 70 50 70 C30 70 16 56 16 28 Z" fill="#e9e2d0" stroke="#3b2a1c" stroke-width="2"/><ellipse cx="50" cy="28" rx="34" ry="8" fill="#7fbf6a" stroke="#3b2a1c" stroke-width="2"/><ellipse cx="50" cy="74" rx="26" ry="4" fill="#8a6a44"/></svg><span class="hwash"></span>`,
  redbolt: () => rep(3, i=>`<svg class="rb r${i}" viewBox="0 0 40 100" preserveAspectRatio="none"><polyline class="b1" points="20,-4 12,22 26,38 14,58 28,74 18,104"/><polyline class="b2" points="20,-4 12,22 26,38 14,58 28,74 18,104"/></svg>`),
  firering: () => `<span class="firering"><i></i><i></i><i></i></span>`,
};
const compassFx = () => `<svg class="compassfx" viewBox="0 0 100 100" aria-hidden="true"><g>${rep(8, i=>`<line x1="50" y1="50" x2="${50+48*Math.cos(i*Math.PI/4)}" y2="${50+48*Math.sin(i*Math.PI/4)}"/>`)}${rep(6, i=>`<polygon points="50,6 54,16 50,26 46,16" transform="rotate(${i*60} 50 50)"/>`)}<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="46"/></g></svg>`;
// Drawn on each fighter a special lands on, so the eye stays on the damage (views.js targetFx, by character)
const TARGET_ART = {
  nezuko_awakened: () => rep(8, i=>`<path class="tfi pinkfire" style="--d:${i*.06}s" d="M${10+i*11} 96 C${2+i*11} 70 ${22+i*11} 56 ${12+i*11} 30 C${30+i*11} 48 ${26+i*11} 72 ${18+i*11} 96 Z"/>`),   // Awakened Nezuko: her targets catch pink fire (CK)
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
  // Gyokko's Water Prison Pot: a sphere of water closes around the target and ripples (CK, Nov 3, 2026)
  vase: () => `<circle class="tfi wpr" cx="50" cy="52" r="42"/><circle class="tfi wpr w2" cx="50" cy="52" r="34"/><path class="tfi wpw" d="M12 60 C26 52 38 68 50 60 C62 52 74 68 88 60"/>${rep(6,i=>`<circle class="tfi wpb" style="--d:${i*.12}s" cx="${26+i*10}" cy="${80-(i%3)*8}" r="${2+(i%3)}"/>`)}`,
  tamayo: () => rep(7, i=>`<g transform="rotate(${i*360/7} 50 50)"><g class="tfi bloom" style="--d:${i*.07}s"><circle cx="50" cy="12" r="3"/>${rep(5, k=>`<ellipse cx="50" cy="6" rx="3.4" ry="6" transform="rotate(${k*72} 50 12)"/>`)}</g></g>`),
  kokushibo: () => rep(3, i=>`<g transform="rotate(${i*120-20} 50 50)"><path class="tfi moon" style="--d:${i*.12}s" d="M34 8 A22 22 0 1 0 66 8 A17 17 0 1 1 34 8 Z"/></g>`),
  shinobu: () => rep(5, i=>`<g transform="rotate(${i*72} 50 50)"><g class="fly" style="--d:${i*.08}s"><ellipse cx="44" cy="10" rx="7" ry="5" transform="rotate(-24 44 10)"/><ellipse cx="56" cy="10" rx="7" ry="5" transform="rotate(24 56 10)"/></g></g>`),
  daki: () => rep(3, i=>`<g transform="rotate(${i*14-14} 50 50)"><ellipse class="tfi sash" style="--d:${i*.1}s" cx="50" cy="${28+i*22}" rx="48" ry="9"/></g>`),
  nezuko: () => rep(7, i=>`<path class="tfi pflame" style="--d:${i*.05}s" d="M${14+i*12} 92 C${6+i*12} 66 ${24+i*12} 54 ${14+i*12} ${26+(i%3)*12} C${32+i*12} 48 ${30+i*12} 72 ${22+i*12} 92 Z"/>`),
  rui: () => rep(3, i=>`<line class="tfi thr" style="--d:${i*.06}s" x1="${i%2?100:0}" y1="${14+i*22}" x2="${i%2?0:100}" y2="${34+i*16}"/>`),
};
// Doma's Frozen Lotus: ice petals open around each fighter it hits, leaving the middle clear for the damage
// Frozen Lotus on each target (reworked Nov 11, 2026): frost creeps over the card, an ice lotus blooms under it, then it shatters
const lotusFx = () => `<span class="frostcard" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 50 L18 8 M50 50 L88 14 M50 50 L92 70 M50 50 L10 78 M50 50 L56 98 M30 30 L34 14 M70 32 L84 26 M66 64 L84 84 M32 66 L16 64"/></svg></span><svg class="lotusfx" viewBox="0 0 100 100" aria-hidden="true">${rep(10, i=>`<g transform="rotate(${-90+(i-4.5)*16} 50 92)"><path class="lp${i%2}" style="--d:${(.05+Math.abs(i-4.5)*.04).toFixed(2)}s" d="M50 92 C58 80 58 66 50 52 C42 66 42 80 50 92 Z"/></g>`)}<circle class="lcore" cx="50" cy="90" r="5"/></svg><span class="iceshards" aria-hidden="true">${rep(7,i=>`<i style="--a:${-170+i*26}deg;--l:${34+(i%3)*14}px"></i>`)}</span>`;
// The effect drawn over a fighter: style art plus the style's colour class
const fxArt = (style, extra='') => `<svg class="fxl sty-${style} ${extra}" viewBox="0 0 100 100" aria-hidden="true">${(FX_ART[style]||FX_ART.slash)()}</svg>`;
