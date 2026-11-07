/* ================= MINI-GAMES (prototypes, Nov 7, 2026) =================
   Three quick games CK asked to try from the test page: Higher or Lower, Corps Memory Training and Final Selection.
   Phase 'mini' with S.mini = {g:'hilo'|'memory'|'sel', ...}. Loaded after app.js (Final Selection runs its own loop and
   touch input on #fsfield, so it touches the DOM). Best scores per phone in localStorage 'squad-draft-mini'.
   Tests: ?test=m_hilo | m_memory | m_sel (localhost only). Not reachable from the game's menus yet. */
const MINI_KEY = 'squad-draft-mini';
const miniBest = g => { try{ return (JSON.parse(localStorage.getItem(MINI_KEY))||{})[g]||0; }catch(e){ return 0; } };
const miniSaveBest = (g, v, lower) => { try{ const b=JSON.parse(localStorage.getItem(MINI_KEY))||{}; const old=b[g]; if(old===undefined || (lower ? v<old : v>old)){ b[g]=v; localStorage.setItem(MINI_KEY, JSON.stringify(b)); return true; } }catch(e){} return false; };
// Characters this phone has unlocked and has a picture for (no spoilers, no helpers or split forms)
const miniPool = () => ROSTER.filter(c=>!c.spawn && !c.helper && ART[c.id] && isUnlocked(c.id));
const pickOne = (list, not=[]) => { const ok=list.filter(c=>!not.includes(c.id)); return ok[Math.floor(Math.random()*ok.length)]; };
const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

function miniStart(g){
  clearInterval(FS.loop); FS.loop=null;
  Object.assign(S,{phase:'mini', mode:'mini', askName:null});
  if(g==='hilo'){ const a=pickOne(miniPool()); S.mini={g, cur:a.id, ...hiloNext(a.id, hiloStat()), streak:0, reveal:null, over:false}; }
  // memory: six characters with distinct pictures (Marks borrow their base character's, so Giyu and Giyu ✦ would look the same)
  if(g==='memory'){ const seen=new Set(), ids=shuffle(miniPool().slice()).filter(c=>!seen.has(ART[c.id]) && seen.add(ART[c.id])).slice(0,6).map(c=>c.id); S.mini={g, deck:shuffle([...ids,...ids]), open:[], done:[], moves:0, t0:0, t1:0, lock:false}; }
  if(g==='sel') S.mini={g, running:false, over:false, score:0, lives:3, won:false};
  window.scrollTo(0,0);
}
const miniTop = (title) => `<header class="top"><div><div class="eyebrow">Mini-game</div><div class="title">${title}</div></div><div class="topbtns"><button class="btn ghost small" data-a="minihome">Back</button></div></header>`;

/* ---- Higher or Lower: is the next fighter's stat higher or lower? Never a tie (CK: strictly higher or lower). ----
   The stat sits big at the top in its own colour; the question reads as a sentence across the two buttons:
   "Mitsuri's speed is… [Higher than 10] [Lower than 10]". A right answer slides the pair along; a wrong one shakes. */
const HILO_STATS = [['hp','HP','Health','♥','#e8576a'],['pow','PWR','Power','⚔','#ef8a3c'],['spd','SPD','Speed','⚡','#5aa9ef'],['cost','pts','Cost','◆','#d6a54d']];
const hiloStat = () => HILO_STATS[Math.floor(Math.random()*HILO_STATS.length)][0];
// the next fighter for a stat: never the same value as the current one; if nobody differs, try another stat
function hiloNext(cur, stat){
  for(const s of [stat, ...shuffle(HILO_STATS.map(x=>x[0]).filter(x=>x!==stat))]){
    const ok=miniPool().filter(c=>c.id!==cur && c[s]!==BYID[cur][s]); if(ok.length) return {next:ok[Math.floor(Math.random()*ok.length)].id, stat:s};
  }
  return {next:pickOne(miniPool(),[cur]).id, stat};
}
function vHilo(m){
  const st=HILO_STATS.find(s=>s[0]===m.stat), a=BYID[m.cur], b=BYID[m.next], best=miniBest('hilo'), n=a[m.stat];
  const card=(c,show,cls='')=>`<div class="hlcard ${cls}"><span class="hlart"><img decoding="sync" src="${ART[c.id]}" alt=""><span class="hlname">${esc(c.short)}</span></span>
    <span class="hlbadge${show?'':' ask'}">${show?c[m.stat]:'?'}<small>${st[1]}</small></span></div>`;
  const head=`<div class="hlhead2"><span class="hlstreak${m.streak>=3?' hot':''}"><b>${m.streak}</b><small>${m.streak>=3?'🔥 ':''}in a row</small></span><span class="hlmeta">Best <b>${best}</b></span></div>`;
  if(m.over) return `${miniTop('Higher or Lower')}<div class="minibody hilo" style="--sc:${st[4]}">${head}<div class="miniover"><span class="eyebrow">Game over</span><b class="mbig">${m.streak}</b><span>in a row${m.streak>=best&&m.streak?' · New best!':` · Best ${best}`}</span>
    <p class="muted">${esc(b.short)} has ${b[m.stat]} ${st[1]}. ${esc(a.short)} has ${a[m.stat]}.</p>
    <div class="minibtns"><button class="btn" data-a="ministart" data-v="hilo">Play again</button><button class="btn ghost" data-a="minihome">Back</button></div></div></div>`;
  return `${miniTop('Higher or Lower')}<div class="minibody hilo" style="--sc:${st[4]}">${head}
    <div class="hlstat"><span class="hlicon" aria-hidden="true">${st[3]}</span><b>${st[2]}</b></div>
    <div class="hlrow${m.slid?' slidein':''}">${card(a,true)}<span class="hlvs">vs</span>${card(b,!!m.reveal,m.reveal?'rev '+m.reveal:'mystery')}</div>
    <p class="hlsent"><b>${esc(b.short)}</b>’s ${st[2].toLowerCase()} is…</p>
    <div class="hlbtns2"><button class="hlhi" data-a="higuess" data-v="hi" ${m.reveal?'disabled':''}><span>▲</span>Higher than ${n}</button><button class="hllo" data-a="higuess" data-v="lo" ${m.reveal?'disabled':''}><span>▼</span>Lower than ${n}</button></div></div>`;
}
function hiloGuess(v){
  const m=S.mini; if(!m || m.reveal || m.over) return;
  const a=BYID[m.cur][m.stat], b=BYID[m.next][m.stat], right = v==='hi' ? b>a : b<a;
  m.reveal = right ? 'right' : 'wrong'; m.slid=false; sfx(right?'ding':'miss');
  setTimeout(()=>{ if(S.mini!==m) return;
    if(right){ m.streak++; m.cur=m.next; Object.assign(m, hiloNext(m.cur, hiloStat())); m.reveal=null; m.slid=true; setTimeout(()=>{ m.slid=false; }, 600); }
    else { m.over=true; miniSaveBest('hilo', m.streak); sfx('lose'); }
    render(); }, right?900:1300);
}

/* ---- Corps Memory Training: find the six pairs; moves and time count ---- */
function vMemory(m){
  const done=m.done.length===m.deck.length, secs=Math.round(((m.t1||Date.now())-(m.t0||Date.now()))/1000), best=miniBest('memory');
  const cards=m.deck.map((id,i)=>{ const up=m.open.includes(i)||m.done.includes(i), c=BYID[id];
    return `<button class="mmcard${up?' up':''}${m.done.includes(i)?' got':''}" data-a="memflip" data-v="${i}" aria-label="${up?esc(c.short):'Hidden card'}"><span class="mmin"><span class="mmback">滅</span><span class="mmfront"><img decoding="sync" src="${ART[id]}" alt=""><b>${esc(c.short)}</b></span></span></button>`; }).join('');
  return `${miniTop('Corps Memory Training')}<div class="minibody">
    <div class="hlhead"><span>Moves <b>${m.moves}</b></span><span>${done?`Time <b>${secs}s</b>`:`Pairs <b>${m.done.length/2} of 6</b>`}</span><span>Best <b>${best?best+' moves':'–'}</b></span></div>
    ${done?`<div class="miniover small"><b>All pairs found!</b><span>${m.moves} moves in ${secs}s${m.newBest?' · New best!':''}</span><div class="minibtns"><button class="btn" data-a="ministart" data-v="memory">Play again</button><button class="btn ghost" data-a="minihome">Back</button></div></div>`:''}
    <div class="mmgrid">${cards}</div></div>`;
}
function memFlip(i){
  const m=S.mini; i=+i; if(!m || m.lock || m.open.includes(i) || m.done.includes(i)) return;
  if(!m.t0) m.t0=Date.now();
  m.open.push(i); sfx('page');
  if(m.open.length<2) return;
  m.moves++;
  const [x,y]=m.open;
  if(m.deck[x]===m.deck[y]){ m.done.push(x,y); m.open=[]; sfx('ding');
    if(m.done.length===m.deck.length){ m.t1=Date.now(); m.newBest=miniSaveBest('memory', m.moves, true); sfx('win'); } return; }
  m.lock=true; setTimeout(()=>{ if(S.mini!==m) return; m.open=[]; m.lock=false; render(); }, 850);
}

/* ---- Final Selection: slash the demons coming out of the dark (tap or swipe), spare the other candidates, last until sunrise ---- */
const FS = {loop:null, items:new Map(), next:0, t0:0, down:false, last:null};
const FS_LEN = 45000, FS_DEMONS = ['hand','swamp'], FS_PEOPLE = ['murata','genya','kanao','zenitsu'];
function vSel(m){
  const best=miniBest('sel'), place=PLACE_ART.selection||PLACE_ART.prologue||'';
  return `${miniTop('Final Selection')}<div class="minibody sel">
    <div class="fshud"><span>Slain <b id="fsscore">${m.score}</b></span><span class="fslives" id="fslives">${'♥'.repeat(Math.max(0,m.lives))}<i>${'♥'.repeat(3-Math.max(0,m.lives))}</i></span><span>Best <b>${best}</b></span></div>
    <div class="fssun"><i id="fssun" style="width:${m.over?100:0}%"></i><span>Sunrise</span></div>
    <div class="fsfield" id="fsfield" style="${place?`--fsbg:url('${place}')`:''}">
      ${!m.running&&!m.over?`<div class="fsover"><b>Survive until sunrise</b><span>Tap or swipe the demons before they reach you.<br>Don’t cut the other candidates.</span><div class="fslegend">${FS_DEMONS.map(id=>seal(BYID[id],'sm')).join('')}<small>slash</small><span class="fsdiv"></span>${FS_PEOPLE.map(id=>seal(BYID[id],'sm')).join('')}<small>spare</small></div><button class="btn" data-a="fsgo">Begin</button></div>`:''}
      ${m.over?`<div class="fsover"><span class="eyebrow">${m.won?'The sun rises':'You fell'}</span><b class="mbig">${m.score}</b><span>demons slain${m.newBest?' · New best!':` · Best ${best}`}</span><div class="minibtns"><button class="btn" data-a="ministart" data-v="sel">Try again</button><button class="btn ghost" data-a="minihome">Back</button></div></div>`:''}
    </div></div>`;
}
function fsGo(){
  const m=S.mini; if(!m || m.running) return;
  Object.assign(m,{running:true, over:false, score:0, lives:3, won:false}); FS.items.clear(); FS.t0=Date.now(); FS.next=FS.t0+500;
  render(); fsBind();
  clearInterval(FS.loop); FS.loop=setInterval(fsTick, 60);
}
function fsBind(){
  const f=document.getElementById('fsfield'); if(!f || f.dataset.bound) return; f.dataset.bound='1';
  const at=e=>{ const el=document.elementFromPoint(e.clientX,e.clientY); const t=el&&el.closest('.fst'); if(t) fsSlash(t); };
  f.addEventListener('pointerdown',e=>{ FS.down=true; FS.last=[e.clientX,e.clientY]; at(e); });
  f.addEventListener('pointermove',e=>{ if(!FS.down) return; fsTrail(f,e); at(e); });
  window.addEventListener('pointerup',()=>{ FS.down=false; FS.last=null; });
}
function fsTrail(f,e){
  const r=f.getBoundingClientRect(), [x0,y0]=FS.last||[e.clientX,e.clientY], dx=e.clientX-x0, dy=e.clientY-y0, len=Math.hypot(dx,dy); FS.last=[e.clientX,e.clientY]; if(len<4) return;
  const s=document.createElement('i'); s.className='fstrail'; s.style.cssText=`left:${x0-r.left}px;top:${y0-r.top}px;width:${len}px;transform:rotate(${Math.atan2(dy,dx)}rad)`;
  f.appendChild(s); setTimeout(()=>s.remove(),260);
}
function fsTick(){
  const m=S.mini, f=document.getElementById('fsfield');
  if(!m || m.g!=='sel' || S.phase!=='mini' || !m.running){ clearInterval(FS.loop); FS.loop=null; return; }
  if(!f) return;
  fsBind();   // the field can be redrawn (the Begin tap renders twice), so make sure the new one listens
  const now=Date.now(), t=now-FS.t0, k=Math.min(1,t/FS_LEN);
  const sun=document.getElementById('fssun'); if(sun) sun.style.width=(k*100)+'%';
  f.style.setProperty('--dawn', k.toFixed(3));
  if(t>=FS_LEN) return fsEnd(true);
  if(now>=FS.next){   // faster and more of them as the night goes on
    const life=Math.round(1900-1000*k), person=Math.random()<.22, id=person?FS_PEOPLE[Math.floor(Math.random()*FS_PEOPLE.length)]:FS_DEMONS[Math.floor(Math.random()*FS_DEMONS.length)];
    const el=document.createElement('button'); el.className='fst'+(person?' person':' demon'); el.type='button'; el.tabIndex=-1;
    el.style.cssText=`left:${6+Math.random()*70}%;top:${8+Math.random()*62}%;--life:${life}ms`;
    el.innerHTML=`<img decoding="sync" src="${ART[id]}" alt="">`; f.appendChild(el);
    FS.items.set(el,{person, end:now+life});
    FS.next=now+Math.round(820-480*k)*(0.7+Math.random()*0.6);
  }
  FS.items.forEach((it,el)=>{ if(now<it.end) return; FS.items.delete(el);
    if(!it.person && !el.dataset.dead){ el.classList.add('reached'); fsHurt(f,'A demon got you!'); }
    setTimeout(()=>el.remove(), it.person?0:350); });
}
function fsSlash(el){
  const it=FS.items.get(el), m=S.mini; if(!it || el.dataset.dead || !m.running) return; el.dataset.dead='1'; FS.items.delete(el);
  if(it.person){ el.classList.add('oops'); fsHurt(document.getElementById('fsfield'),'Not a demon!'); setTimeout(()=>el.remove(),500); return; }
  m.score++; const s=document.getElementById('fsscore'); if(s) s.textContent=m.score;
  el.classList.add('cut'); sfx('slash'); if(navigator.vibrate) try{ navigator.vibrate(15); }catch(e){}
  setTimeout(()=>el.remove(),450);
}
function fsHurt(f,msg){
  const m=S.mini; m.lives--; sfx('block');
  const l=document.getElementById('fslives'); if(l) l.innerHTML=`${'♥'.repeat(Math.max(0,m.lives))}<i>${'♥'.repeat(3-Math.max(0,m.lives))}</i>`;
  if(f){ f.classList.remove('hurt'); void f.offsetWidth; f.classList.add('hurt'); const n=document.createElement('b'); n.className='fsmsg'; n.textContent=msg; f.appendChild(n); setTimeout(()=>n.remove(),900); }
  if(m.lives<=0) fsEnd(false);
}
function fsEnd(won){
  const m=S.mini; clearInterval(FS.loop); FS.loop=null; m.running=false; m.over=true; m.won=won;
  m.newBest=miniSaveBest('sel', m.score); sfx(won?'win':'lose'); FS.items.clear(); render();
}

/* ---- wiring ---- */
VIEWS.mini = () => { const m=S.mini||{}; return m.g==='hilo'?vHilo(m):m.g==='memory'?vMemory(m):m.g==='sel'?vSel(m):''; };
Object.assign(ACTIONS, {
  ministart(v){ miniStart(v); },
  minihome(){ clearInterval(FS.loop); FS.loop=null; S.mini=null; ACTIONS.home(); if(ACTIONS.openmode) ACTIONS.openmode('cpu'); },   // back to Quickplay, where the mini-games live
  higuess(v){ hiloGuess(v); },
  memflip(v){ memFlip(v); },
  fsgo(){ fsGo(); },
});
