/* ================= VIEWS =================
   Each v*() returns the HTML for one screen. No DOM access here, so these can also be rendered in Node. */
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pc = p => `var(--p${p+1})`;   // player colours: green, wisteria, amber, rose
const nm = p => esc(titled(S.names[p]));
// The round is worked out before it plays, so a pot or thread only shows once the replay reaches the move that did it
const boundNow = u => { const p=S.play; if(!u.bound || !p || p.done || !p.steps || !p.steps[p.k]) return u.bound||'';
  return S.log.slice(p.steps[0][0], p.steps[p.k][1]+1).some(l=>l.kind===u.bound && l.on===u.uid) ? u.bound : ''; };
const glyphCls = c => { const b=boundNow(c); return (c.legend?'leg':c.mark?'mk':'')+(b?' bound'+b:''); };
const plural = (n,w) => `${n} ${w}${n===1?'':'s'}`;
// Character pictures found in img/ (filled in by app.js at startup): card id → file path
const ART = {};
// A character's seal: their picture if there is one, otherwise their kanji
// In battle, a fighter's picture is a button that opens their info card (stats, special, passive, status)
const sealBtn = (u, cls='') => `<button class="sealbtn" data-a="info" data-v="${u.uid}" aria-label="About ${esc(u.name)}">${seal(u,cls)}</button>`;
// A fighter's picture: Mark Tanjiro shows his Selfless State picture while he's in it (img/tanjiro_selfless.jpg)
const artOf = c => (c.uid && c.ate && ART.genya_demon) || (c.uid && c.tw && ART.tanjiro_transparent) || (c.uid && (c.selfless || c.unblock) && ART.tanjiro_selfless) || ART[c.id];   // until his unblockable Hinokami lands
const seal = (c, cls='') => `<span class="gl ${glyphCls(c)} ${cls}">${artOf(c)?`<img decoding="sync" src="${artOf(c)}" alt="">`:c.g}</span>`;

/* ---------- shared pieces ---------- */
// First-time tips: a small banner the first time a player reaches each screen. "Got it" hides it for good (TIPS_KEY).
const TIPS_KEY = 'squad-draft-tips';
const tipsSeen = () => { try{ return JSON.parse(localStorage.getItem(TIPS_KEY))||[] }catch(e){ return [] } };
// Tips show in the story's Prologue, and in a new player's first battle in any other mode except online
const inPrologue = () => S.mode==='story' && STAGES[S.stage] && STAGES[S.stage].arc==='prologue';
const firstBattle = () => S.mode!=='online' && !tipsSeen().includes('played');
const tip = (id, text) => !(inPrologue() || firstBattle()) || tipsSeen().includes(id) ? '' : `<div class="tip"><span class="tipk">Tip</span><p>${text}</p><button class="btn ghost small" data-a="tipok" data-v="${id}">Got it</button></div>`;
// Game screens get a small ⚙ so music and sound can be changed mid-game (playback pauses while it's open)
function topbar(eyebrow, title, quit=true){
  return `<header class="top"><div><div class="eyebrow">${eyebrow}</div><div class="title">${title}</div></div>
    <div class="topbtns"><button class="btn ghost small gearmini" data-a="settings" aria-label="Settings">⚙</button>${quit?(isAsync()?'<button class="btn ghost small" data-a="quit" data-v="home">Leave</button>':inMatch()?'<button class="btn ghost small" data-a="askquit">Quit</button>':S.mode==='story'?'<button class="btn ghost small" data-a="home">Back</button>':'<button class="btn ghost small" data-a="home">Quit</button>'):''}</div></header>`;
}
// In a match (from who-picks-first to the last round), Quit asks first instead of leaving straight away (CK).
// Two-phone online games carry on without you, so they say Leave and need no warning.
const inMatch = () => ['spin','draft','pass','plan','scout','ready','result'].includes(S.phase);
function quitAsk(){
  return `<div class="scrim" data-a="unquit"></div><div class="modal"><div class="in quitask" role="dialog" aria-modal="true" aria-label="Quit this battle?">
    <h2>Quit this ${S.phase==='draft'||S.phase==='spin'?'match':'battle'}?</h2><p class="muted">${isOnline()?'You’ll leave the game for everyone.':'This match won’t be saved.'}</p>
    <div class="row"><button class="btn ghost" data-a="unquit">Keep playing</button><button class="btn" data-a="quit" data-v="${S.mode==='story'?'map':'home'}">Quit${S.mode==='story'?' to story map':''}</button></div></div></div>`;
}
const actionbar = inner => `<div class="actionbar"><div class="in">${inner}</div></div>`;
const statCells = c => `<span class="stats"><span><i>HP</i>${c.hp}</span><span><i>PWR</i>${c.pow}</span><span><i>SPD</i>${c.spd}</span><span><i>DEF</i>${c.def}</span></span>`;
// A battle log line for the screen: each fighter's picture before their name, damage in red (−17%),
// healing in green (+5%), other percents in bold. Engine lines tag health changes as [-17%] / [+5%].
function fmtLog(t){
  const byName={}; allUnits().forEach(u=>{ byName[esc(u.name)]=u; });
  const names=Object.keys(byName).sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const re=new RegExp('\\[([+-])(\\d+%)\\]|(\\d+%)'+(names.length?'|('+names.join('|')+')':''),'g');
  return esc(t).replace(re,(m,sign,n,plain,name)=> sign ? `<b class="${sign==='-'?'dmg':'gain'}">${sign==='-'?'−':'+'}${n}</b>`
    : plain ? `<b>${plain}</b>` : `<span class="who">${seal(byName[name],'ls')}${name}</span>`);
}

// Name, percent and health bar. During round playback `o.hp` is the HP at that moment and `o.from` the HP a step earlier.
function health(u, o={}){
  const live=o.hp===undefined, hp=live?u.hp:o.hp, up=live?u.alive:hp>0;
  const h=up?pct(u,hp):0, low=up && h<=LOW ? ' low' : '';
  const from=o.from===undefined ? h : Math.max(0,pct(u,o.from));
  const bar=`<span class="bar${low}" role="img" aria-label="${h}% health"><i class="${from!==h?'drain':''}" style="width:${h}%;--from:${from}%"></i></span>`;
  const pctTag=`<span class="hp${low}">${up?h+'%':'KO'}</span>`;
  // simple tiles: name on its own line, percent beside the bar, so narrow tiles don't cut the name off
  if(o.simple) return `<span class="un"><span class="nm">${esc(u.name)}</span></span><span class="hprow">${bar}${pctTag}</span>`;
  return `<span class="un"><span class="nm">${esc(u.name)}</span>${pctTag}</span>
    ${bar}`;
}
const meta = u => `<div class="meta">PWR ${u.pow} · DEF ${u.def} · SPD ${u.spd}${u.regen?` · Regen ${pct(u,u.regen)}%`:''}</div>`;
function statusChips(u, showSpecial){
  if(!u.alive) return '';
  const out=[];
  if(u.legend) out.push(`<span class="chip s">Strikes ×${u.strikes} · takes max ${pct(u,u.cap)}%/round</span>`);
  if(u.grit) out.push('<span class="chip good">Somehow Survives</span>');
  if(u.defending) out.push('<span class="chip good">Guarding</span>');
  if(u.devoured) out.push(`<span class="chip bad">Wisteria −${pct(u,u.devoured)}%/round</span>`);
  if(u.sunburn) out.push('<span class="chip bad">Sunburned</span>');
  if(u.poison) out.push(`<span class="chip bad">Poison −${pct(u,u.poison.dmg)}% × ${u.poison.turns}</span>`);
  if(u.stun) out.push('<span class="chip bad">Stunned</span>');
  if(u.selfless) out.push('<span class="chip good">Selfless State · untouchable unless he attacks</span>');
  if(u.unblock) out.push('<span class="chip s">Hinokami can\'t be blocked</span>');
  if(u.saved) out.push(`<span class="chip good">Guarded by ${esc(u.saved)}</span>`);
  if(showSpecial) out.push(u.cd>0?`<span class="chip">Special in ${u.cd}</span>`:'<span class="chip s">Special ready</span>');
  return out.length?`<div class="chips">${out.join('')}</div>`:'';
}
// Tiny status marks for the compact opponent cards: special ready, poison, stun, Shinobu's wisteria, sunburn, guarding
function statusMarks(u, ready){
  const m=[ready?['Special ready','Their special is ready this round','s txt']:null, u.poison?['毒',`Poisoned ${u.poison.turns} more round${u.poison.turns>1?'s':''}`,'b']:null,
    u.stun?['眠','Stunned this round','b']:null, u.devoured?['藤',"Eating Shinobu's wisteria poison",'b']:null, u.sunburn?['陽','Sunburned: no regeneration','b']:null].filter(Boolean);
  return m.length?`<span class="smarks">${m.map(([k,t,c])=>`<span class="sm ${c}" title="${t}" aria-label="${t}">${k}</span>`).join('')}</span>`:'';
}
const synChips = p => S.syn[p].length ? `<div class="chips">${S.syn[p].map(s=>s[0]==='!'?`<span class="chip bad">${esc(s.slice(1))}</span>`:`<span class="chip s">${esc(s)}</span>`).join('')}</div>` : '';

// Fighter tile: enemies, results and the end screen. `o` is the playback moment (see health()), plus o.flash.
// o.simple = just the picture, name and health (the opponent's team while you choose moves).
// o.tgtFor = uid of your fighter picking a target: the tile becomes a button that targets this enemy.
// o.picked = it's that fighter's current target; o.aimed = your fighters already aiming here.
function tile(u, o={}){
  if(o.hidden) return '';
  const playing=o.hp!==undefined, up=playing?o.hp>0:u.alive, tap=o.tgtFor && up;
  // on the move screen an enemy whose special is ready this round glows, and small marks show poison, stun and so on
  const ready=o.simple && up && !playing && u.cd===0 && !u.stun;
  const cls=`tile${up?'':' dead'}${o.flash?' '+o.flash:''}${tap?' targetable':''}${o.picked?' picked':''}${ready?' sready':''}`;
  const aimed=o.aimed&&o.aimed.length?`<span class="aimed"><span class="aimx" aria-hidden="true">◎</span>${o.aimed.map(a=>seal(a,'pip')).join('')}<span class="sr">by ${o.aimed.map(a=>esc(a.name)).join(', ')}</span></span>`:'';
  const body=`<div class="tb">${health(u,o)}${aimed}${up&&o.simple&&!playing?statusMarks(u,ready):''}${up&&!o.simple?meta(u)+(playing?'':statusChips(u,true)):''}</div>`;
  // the picture opens the info card; when targeting, the rest of the tile is the target button
  const main = tap ? `<button class="tilebtn" data-a="tgt" data-u="${o.tgtFor}" data-v="${u.uid}" aria-pressed="${!!o.picked}" aria-label="Target ${esc(u.name)}">${body}</button>` : body;
  const art=ART[u.id]?`;--art:url('${ART[u.id]}')`:'';
  return `<div class="${cls}${art?' hasart':''}" style="--tc:${pc(u.p)};--i:${o.i||0}${art}">${sealBtn(u)}${main}</div>`;
}
// One bar split between every team's remaining health (all fighters' HP ÷ all max HP), so you can see who's ahead.
// hpOf(u) = HP to count (playback passes the HP at that moment; undefined = not on the field yet). Your team comes first.
function strengthBar(me, hpOf=u=>u.alive?u.hp:0, prevOf){
  const sideOf=f=>p=>{ const us=S.teams[p].filter(u=>f(u)!==undefined); const max=us.reduce((a,u)=>a+u.max,0); return max?us.reduce((a,u)=>a+Math.max(0,f(u)),0)/max:0; };
  // groups: one per team (2v2: your side, then the other side)
  const groups = S.duo ? [players().filter(q=>sameSide(q,me)).sort((a,b)=>(a!==me)-(b!==me)), enemiesOf(me)] : [[me], ...others(me).map(q=>[q])];
  const solo=soloView()||S.phase==='plan'&&!(S.tvDuo&&S.tv), share=f=>g=>{ const us=g.flatMap(q=>S.teams[q]).filter(u=>f(u)!==undefined); const max=us.reduce((a,u)=>a+u.max,0); return max?us.reduce((a,u)=>a+Math.max(0,f(u)),0)/max:0; };
  const now=groups.map(share(hpOf)), was=prevOf?groups.map(share(prevOf)):now, sum=x=>x.reduce((a,b)=>a+b,0)||1;
  const name=g=>g.length>1 ? g.map(q=>q===me&&solo?'You':nm(q)).join(' & ') : g[0]===me&&solo?'You':g[0]!==me&&solo&&nPlayers()===2?'Opponent':nm(g[0]);
  const label=(g,i)=>`<span style="color:${pc(g[0])}">${i&&groups.length===2?`<b>${Math.round(now[i]*100)}%</b> ${name(g)}`:`${name(g)} <b>${Math.round(now[i]*100)}%</b>`}</span>`;
  return `<div class="strength${groups.length>2?' multi':''}" role="img" aria-label="${groups.map((g,i)=>`${name(g)} ${Math.round(now[i]*100)}% health`).join(', ')}">
    <div class="sl">${groups.map(label).join('')}</div>
    <div class="sbar">${groups.map((g,i)=>`<i class="${was[i]!==now[i]?'drain':''}" style="width:${now[i]/sum(now)*100}%;--from:${was[i]/sum(was)*100}%;background:${pc(g[0])}"></i>`).join('')}</div></div>`;
}
const vsDivider = () => '<div class="vsdiv" aria-hidden="true"><span>VS</span></div>';
function teamBlock(p, label, moment, simple, hint){
  const os=S.teams[p].map(u=>Object.assign(moment?moment(u):{}, simple?{simple:true}:{})), shown=S.teams[p].filter((u,i)=>!os[i].hidden);
  const up=S.teams[p].filter((u,i)=>!os[i].hidden && (os[i].hp===undefined?u.alive:os[i].hp>0)).length;
  return `<section class="side"><div class="sidehead"><span class="tname" style="color:${pc(p)}">${label||nm(p)}</span>
    ${hint?`<span class="taphint">${hint}</span>`:simple?'':`<span class="muted">${up} of ${shown.length} standing</span>`}</div>
    ${simple?'':synChips(p)}<div class="tiles${simple?' simple':''}">${S.teams[p].map((u,i)=>tile(u,{...os[i],i})).join('')}</div></section>`;
}

/* ---------- setup ---------- */
function recordsPanel(){
  const rec=loadRecords();
  const rows=Object.entries(rec).filter(([id])=>BYID[id]).map(([id,[g,w]])=>({c:BYID[id],g,w,r:Math.round(w/g*100)}))
    .sort((a,b)=>b.r-a.r||b.g-a.g);
  if(!rows.length) return '<p class="muted">No character records yet.</p>';
  return `<div class="records"><div class="tlabel">Character records <span class="muted">· ${plural(rows.length,'character')} played</span></div>
    <div class="recs"><div class="rec head"><span></span><span>Character</span><span>Win rate</span><span>Won</span></div>
    ${rows.map(x=>`<div class="rec">${seal(x.c,'sm')}<span class="rn">${esc(x.c.short)}</span>
      <span class="rbar"><i style="width:${x.r}%"></i><b>${x.r}%</b></span><span class="rw">${x.w} of ${x.g}</span></div>`).join('')}</div></div>`;
}
// The four modes on the main menu: key, kanji, title, caption
const MODE_CARDS = [
  ['cpu','機','Quickplay','Final Form, Gauntlet and more'],
  ['online','網','Online','Quick Match or play friends'],
  ['local','二','Same Phone','Pass and play'],
  ['practice','練','Practice','Draft every team yourself'],
];
// Faint character art behind each mode card (only pictures that exist are used)
const MODE_ART = {local:['zenitsu','inosuke'], online:['tanjiro','nezuko'], cpu:['muzan'], practice:['typezero']};
// Names for local play: up to four, remembered on this phone
const localNames = () => { const s=loadNames()||[]; return [playerName()||'Player 1','Player 2','Player 3','Player 4'].map((d,i)=>s[i]||d); };
const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v,l])=>`<button data-a="${act}" data-v="${v}" class="${String(cur)===String(v)?'on':''}">${l}</button>`).join('')}</div>`;
const POOL_OPTS = [['random','Random'],['all','All'],['slayers','Slayers'],['demons','Demons']];
const poolName = t => ({all:'All characters', slayers:'All Slayers', demons:'All Demons'}[t]||'Random pool');
// Match settings for the selected mode (each mode remembers its own)
function modeSettings(){
  const c=S.cfg||loadModeCfg(S.mode), n=c.players;
  const pts=`<div class="setline"><span class="tlabel">Points per team</span>${seg('cfgbudget',c.budget,BUDGETS.map(b=>[b,budgetName(b)]))}</div>`;
  // rarely changed options stay folded away so the panel stays simple
  const more=[c.maxTeam!==MAXTEAM?`max ${c.maxTeam} fighters`:'', c.bans?'bans on':''].filter(Boolean).join(' · ');
  const pool=`<div class="setline"><span class="tlabel">Character pool</span>${seg('cfgpool',c.poolType,POOL_OPTS)}</div>
    <details class="subset" id="more-${S.mode}"><summary>More options <span class="muted">${more?'· '+more:''}</span></summary>
      <div class="setline"><span class="tlabel">Max fighters per team</span>${seg('cfgmax',c.maxTeam,[1,2,3,4,5,6].map(k=>[k,k]))}</div>
      <div class="setline"><span class="tlabel">Bans</span>${seg('cfgbans',c.bans?'on':'off',[['off','Off'],['on','1 each']])}
        <span class="hint">Before the draft, each player bans one character. Nobody can pick it.</span></div></details>`;
  const note = n===4 && c.duo ? `<p class="hint">2v2: ${S.mode==='local'?'players 1 &amp; 3 team up against 2 &amp; 4':'you and an allied computer against two computers'}. Heals and shields can go on your partner's fighters; a team wins when the other team has nobody left. Cards over ${FFA_MAX_COST} pts aren't dealt.</p>`
    : n>2 ? `<p class="hint">Free-for-all: every team fights every other team; last one standing wins. Specials that hit “every enemy” hit the whole team you aim at, and cards over ${FFA_MAX_COST} pts aren't dealt.</p>`
    : `<p class="hint">${{10:'Quick, chaotic games with 2–3 fighters each.',20:'The standard game.',30:'Bigger squads and stronger cards. Yoriichi and Final-Form Muzan stay rare.',[UNLIMITED]:'No point limit: anyone can be drafted, and only the fighter limit stops a team.'}[c.budget]}</p>`;
  if(S.mode==='local'){ const names=localNames(), side=(i,art)=>`<label class="vsside" style="--tc:${pc(i)}">${ART[art]?`<img decoding="sync" src="${ART[art]}" alt="">`:''}<span>Player ${i+1}</span><input id="n${i}" type="text" maxlength="14" value="${esc(names[i])}" aria-label="Player ${i+1} name"></label>`;
    return `<div class="vsboard">${side(0,'zenitsu')}<b class="vsmark" aria-hidden="true">VS</b>${side(1,'inosuke')}</div>
      <p class="hint vshint">Draft your squads, then pass the phone each round so your moves stay secret.</p>
      <div class="panel modepanel">${pts}${note}${pool}</div>
      <button class="btn" data-a="start">Start: who picks first?</button>`; }
  const levelHint={easy:'Picks moves almost at random. Good for learning the cards.',normal:'Plays sensibly but makes mistakes.',hard:'Goes for knockouts, spreads damage and saves its specials.'}[c.level];
  if(S.mode==='cpu'){ const foe={easy:'hand',normal:'akaza',hard:'muzan'}[c.level];
    return `<div class="vsboard"><label class="vsside" style="--tc:${pc(0)}">${ART.tanjiro?`<img decoding="sync" src="${ART.tanjiro}" alt="">`:''}<span>You</span><input id="n0" type="text" maxlength="14" value="${esc(S.names[0])}" aria-label="Your name"></label>
        <b class="vsmark" aria-hidden="true">VS</b>
        <div class="vsside" style="--tc:${pc(1)}">${ART[foe]?`<img decoding="sync" src="${ART[foe]}" alt="">`:''}<span>Computer</span><strong>${LEVELS[c.level].label}</strong></div></div>
      ${seg('cfglevel',c.level,Object.entries(LEVELS).map(([k,l])=>[k,l.label]))}
      <p class="hint vshint">${levelHint}</p>
      <div class="panel modepanel">${pts}${pool}${dreamDone()?`<div class="setline"><span class="tlabel">Demon Side</span>${seg('cfgdemon',c.demonSide?'on':'off',[['off','Off'],['on','You lead the demons']])}<span class="hint">You draft only demons. The computer drafts only slayers.</span></div>`:''}</div>
      <button class="btn" data-a="start">Start: who picks first?</button>`; }
  if(S.mode==='practice')
    return `<p class="hint">Curate the match: you draft for every team, the computers’ too, then fight the computers. Practice games don’t count toward your records.</p>
      <label class="pname" style="--tc:${pc(0)}"><span>Your name</span><input id="n0" type="text" maxlength="14" value="${esc(S.names[0])}"></label>
      <div class="setline"><span class="tlabel">Difficulty</span>${seg('cfglevel',c.level,Object.entries(LEVELS).map(([k,l])=>[k,l.label]))}</div>
      <p class="hint">${levelHint}</p>
      ${pts}${pool}<button class="btn" data-a="start">Start drafting</button>`;
  const won=storyWon();
  return `<div class="storyhead"><div class="sprog" style="--won:${won/STAGES.length*100}"><b>${won}</b><span>of ${STAGES.length} battles won</span></div>
      <p class="hint">Relive the arcs with the canon squads, from Mount Sagiri to the last dawn, plus two Yoriichi flashbacks. Every battle opens with a scene.</p></div>
    <button class="btn" data-a="storymap">${won?'Continue the story':'Begin the story'}</button>`;
}
/* ---------- codex ---------- */
// Every card in the game, filtered by group. Locked cards say which story battle unlocks them.
const CODEX_GROUPS = [['all','All'],['slayer','Slayers'],['demon','Demons'],['helper','Helpers']];
const codexGroup = c => c.helper ? 'helper' : c.demon && !['nezuko','tamayo','yushiro'].includes(c.fam) ? 'demon' : 'slayer';
function vCodex(){
  const f=S.codexF||'all', cards=ROSTER.filter(c=>!c.spawn && (f==='all'||codexGroup(c)===f)).sort((a,b)=>b.cost-a.cost||a.name.localeCompare(b.name));
  const open=ROSTER.filter(c=>!c.spawn && isUnlocked(c.id)).length, total=ROSTER.filter(c=>!c.spawn).length;
  return `${topbar('Codex', 'Every character')}
    <p class="muted">${open} of ${total} unlocked. Win story battles to unlock the rest. Tap a card to read it.</p>
    ${seg('codexf',f,CODEX_GROUPS)}
    <div class="grid codex">${cards.map(c=>{ const lock=!isUnlocked(c.id);
      return `<button class="card ${glyphCls(c)}${lock?' locked':''}" data-a="codexsel" data-v="${c.id}">
        <span class="cart">${ART[c.id]?`<img decoding="sync" src="${ART[c.id]}" alt="">`:`<span class="ck">${c.g}</span>`}</span>
        <span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span>${lock?'<span class="lockbadge">🔒</span>':''}
        <span class="cbody"><span class="cn">${esc(c.name)}</span><span class="ct">${esc(c.type)}</span>${c.helper?`<span class="ct">${esc(c.sig.tag)}</span>`:statCells(c)}</span>
</button>`; }).join('')}</div>`;
}
// A card's full entry in the Codex
function codexSheet(){
  const c=BYID[S.codexSel]; if(!c) return '';
  const pas=[c.passive, c.mark?MARK_PASSIVE:''].filter(Boolean), ui=unlockStage(c.id), lock=!isUnlocked(c.id);
  const notes=c.helper?[]:allNotesFor(c.id);
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in ${glyphCls(c)}" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    ${banner(c)}
    <div class="shead">${seal(c,'lg')}<div><div class="eyebrow">${esc(c.type)}</div><h2>${esc(c.name)}</h2></div><span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span></div>
    ${loreOf(c)?`<div class="lore"><q>${esc(loreOf(c)[0])}</q><p>${esc(loreOf(c)[1])}</p></div>`:''}
    ${lock?`<div class="lockline">🔒 Locked. ${ui>=0?`Win <b>${esc(MAIN_STAGES[ui].title)}</b> (story battle ${ui+1})`:'Keep going in <b>The Endless Dream</b>'} to play with ${esc(c.short)} in every mode.</div>`
      : ui>=0?`<div class="muted">Unlocked in story battle ${ui+1}: ${esc(MAIN_STAGES[ui].title)}.</div>`:''}
    ${c.helper?'':statCells(c)}
    <div class="sig"><div class="sname">${esc(c.sig.name)}${c.helper?'':` <span class="muted">· special, cooldown ${c.sig.cd}</span>`}</div>${esc(c.sig.desc)}</div>
    ${c.selfless?`<div class="pas"><b>Then: ${esc(SELFLESS.name)}</b>: ${esc(SELFLESS.desc)}${selflessOpen()?'':' <span class="muted">🔒 Unlocks when you win Destructive Death in the story.</span>'}</div>`:''}
    ${c.sig2?`<div class="pas"><b>Then: ${esc(c.sig2.name)}</b>: ${esc(c.sig2.desc)} <span class="muted">After it, back to ${esc(c.sig.name)}: the two take turns.${sig2Open(c)?'':` 🔒 Unlocks when you win ${esc((STAGES.find(s=>s.id===c.sig2.lock)||{}).title||'its story battle')}.`}</span></div>`:''}
    ${c.basic?`<div class="pas"><b>${esc(c.basic.name)}</b> (instead of Attack): ${esc(c.basic.desc)}</div>`:''}
    ${c.regen?`<div class="pas">Regenerates ${c.regen} HP every round.</div>`:''}
    ${pas.map(x=>`<div class="pas">${esc(x)}</div>`).join('')}
    ${c.helper?'<div class="pas">Back-pocket helper: doesn\'t fight or take a fighter slot. Use it once, on the round you choose.</div>':''}
    ${c.splits?splitTree(c):''}
    ${notes.length?`<div class="mnotes"><div class="tlabel">Synergies and matchups</div>${notes.map(n=>`<div class="note"><div class="nh"><span class="nk ${n.kind}">${n.kind==='team'?'Same team':'Opponents'}</span></div><div class="nt">${esc(n.title)}</div><div class="nx">${esc(n.text)}</div></div>`).join('')}</div>`:''}
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button></div>
  </div></div>`;
}
// Today's challenge on the main menu (built just after the menu first draws: it runs a few test battles)
// Final Form on the Quickplay screen, its reveal (Muzan answers your squad) and the dawn countdown in battle
const triesText = r => `${r.won} of ${r.played===1?'1 try':r.played+' tries'} won`;
// Quickplay → Game Modes: Final Form as the headline, the rest as picture tiles. The whole tile is the button.
const gmTile = (id, kj, title, line, stat, art) => pickTile(`data-a="gamemode" data-v="${id}"`, id==='final', kj, title, line, stat, art);
const pickTile = (attrs, hero, kj, title, line, stat, art) => `<button class="gmtile${hero?' hero':''}" ${attrs}>
    ${ART[art]?`<img decoding="sync" src="${ART[art]}" alt="">`:''}<span class="gmmk" aria-hidden="true">${kj}</span>${stat?`<span class="gmstat">${esc(stat)}</span>`:''}
    <span class="gmtext"><b>${esc(title)}</b><small>${esc(line)}</small></span></button>`;
function gmList(){
  const stat=id=>{ const r=gmStats(id); return !r.played?'':id==='gauntlet'?`Best ${plural(r.best,'wave')}`:id==='rush'?`Best ${r.best} of ${RUSH_FIGHTS.length}`:triesText(r); };
  return `<div class="gmgrid qp">${pickTile('data-a="qpmode" data-v="classic"',true,'戦','Classic','Choose your difficulty, points and pool.','','rengoku')}${gmTile('final','終','Final Form','Muzan picks the Upper Moons to beat you. Harder than Hard.',stat('final'),'muzan_final')}
    ${Object.entries(GM).map(([id,m])=>gmTile(id,m.kj,m.title,m.line,stat(id),m.art)).join('')}${pickTile('data-a="openmode" data-v="practice"',false,'練','Practice','Draft every team yourself','','typezero')}</div>`;
}
const fightName = () => { const g=S.series; return !g?gmName():S.mode==='rush'?`Fight ${g.wave} of ${RUSH_FIGHTS.length}`:`Wave ${g.wave}`; };
function vReveal(){
  const seals=(ids,d=0)=>ids.filter(id=>!isHelper(id)).map((id,i)=>`<span class="ucard" style="--i:${i+d}">${seal(BYID[id],'lg')}<b>${esc(BYID[id].short)}</b></span>`).join(''), m=S.mode, g=S.series;
  const yours=g && g.wave>1 ? `<p class="hint">Your squad: ${alive(0).map(u=>`${esc(u.name)} ${pct(u)}%`).join(' · ')}</p>` : '';
  return `<div class="reveal">${topbar(gmName(), m==='final'?'Muzan has seen your squad':esc(fightName()))}
    ${m==='final'?`<p class="muzanline">“${esc(finalTaunt(S.picks[0],S.picks[1]))}”</p>`:''}
    ${m==='random'?'<div class="tlabel revealhead">Their hand</div>':''}
    <div class="revealteam">${seals(S.picks[1])}</div>${yours}
    ${m==='random'?`<div class="tlabel revealhead">Your hand</div><div class="revealteam">${seals(S.picks[0])}</div>`:''}
    ${m==='final'?`<p class="hint">Every enemy hits ${Math.round(FINAL_POW*100)}% harder and never misjudges a move. The sun rises in round ${FINAL_SUNRISE} and burns them, but at dawn they stop defending and hit far harder.</p>`:''}
    ${actionbar('<button class="btn" data-a="finalfight">Fight</button>')}</div>`;
}
const coopResult = () => { const g=S.series, won=coopWon(); return `<p class="dres ${won?'ok':''}">${g?(won?`Wave ${g.wave} cleared.`:`You cleared ${plural(g.wave-1,'wave')} together.`):won?'You beat Muzan together.':'Muzan wins.'}</p>`; };
function gmResult(w){
  const g=S.series, r=gmStats(S.mode);
  if(g){ const done=w===0?g.wave:g.wave-1, more=w===0 && gmFights()>g.wave;
    return `<p class="dres ${w===0?'ok':''}">${more?`${esc(fightName())} cleared.`:S.mode==='rush'&&w===0?'You beat every one of them.':S.mode==='rush'?`You won ${done} of ${RUSH_FIGHTS.length} fights.`:`You cleared ${plural(done,'wave')}.`}${more?'':` <span class="muted">Best: ${r.best}</span>`}</p>`; }
  return `<p class="dres ${w===0?'ok':''}">${w===0?(S.mode==='final'?'You beat Muzan.':'You win.'):S.mode==='final'?'Muzan wins.':'They win.'} <span class="muted">${triesText(r)}</span></p>`;
}
const gmNote = w => S.mode==='final' ? (w===0?'He’ll choose differently next time.':'Change your squad and his picks change too.') : S.series ? (w===0 && gmFights()>S.series.wave?`Survivors recover ${Math.round(GM_HEAL*100)}% and their specials are ready.`:'Try a different squad.') : 'A new hand every time.';
const dawnText = () => { const n=FINAL_SUNRISE-S.round; return n>0?`Sunrise in ${plural(n,'round')}.`:'The sun is up. Hold on.'; };
function dailyCard(){
  const ch=DAILY_CACHE&&DAILY_CACHE.day===todayKey()?DAILY_CACHE:null, done=dailyDone(), streak=dailyStreak();
  if(!ch) return `<div class="daily slim loading"><div class="eyebrow">Daily challenge</div></div>`;
  return `<div class="daily slim${done?' done':''}"><div class="dbody"><div class="eyebrow">Daily challenge${streak?` · 🔥 ${streak}`:''}</div>
      <div class="dgoal">${esc(DAILY_GOALS[ch.goal.type](ch.goal))}</div></div>
    <button class="btn small${done?' ghost':''}" data-a="daily">${done?'✓ Done':'Play'}</button></div>`;
}
// Own-pace online games on the home screen: who against, and whether it's your turn (your turn first, then newest)
function gamesCard(){
  const list=loadGames().slice().sort((a,b)=>(gameStatus(b).mine?1:0)-(gameStatus(a).mine?1:0) || ((b.meta||{}).updated||0)-((a.meta||{}).updated||0));
  if(!list.length) return '';
  return `<section class="games"><div class="eyebrow">Your online games</div>${list.map(g=>{ const st=gameStatus(g), m=g.meta||{}, opp=m.names&&m.names[1-g.seat];
    return `<div class="grow${st.mine?' mine':''}"><button class="gopen" data-a="agame" data-v="${esc(g.code)}"><b>${opp?'vs '+esc(opp):g.qm?'Quick Match':'New game'}</b><span>${esc(st.t)}</span></button>
      <button class="gx" data-a="agamex" data-v="${esc(g.code)}" aria-label="Remove this game">×</button></div>`; }).join('')}</section>`;
}
// Online: three clear ways in. Game choices live in the lobby, once you can see who's there.
const onlinePage = () => `<div class="onlinepage"><label class="pname" style="--tc:${pc(0)}"><span>Your name</span><input id="n0" type="text" maxlength="14" value="${esc(S.names[0])}"></label>
  ${S.joinOpen?`<div class="panel onlinebox"><div class="tlabel">Enter a code</div>
      <div class="joinrow"><input id="ocode" type="text" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="CODE" value="${esc(S.joinCode||'')}" aria-label="Game code"><button class="btn" data-a="ojoin">Join</button></div>
      <button class="btn ghost" data-a="ojoinopen">Back</button></div>`
    :`<div class="gmgrid online">${pickTile('data-a="onew"',true,'友','Play Friends','Invite 2 to 4 players. Battle each other or team up against Muzan.','','inosuke')}
      ${pickTile('data-a="oquick"',false,'速','Quick Match','Play anyone','','tanjiro')}${pickTile('data-a="ojoinopen"',false,'鍵','Enter a Code','Join a friend’s game','','nezuko')}</div>`}
  ${S.onlineMsg?`<p class="hint onlinemsg">${esc(S.onlineMsg)}</p>`:''}</div>`;
// A mode's own page (opened from its card on the home screen): its settings and the Start button
function vModeSet(){
  const [,kj,title,sub]=MODE_CARDS.find(m=>m[0]===S.mode), art=(MODE_ART[S.mode]||[]).filter(id=>ART[id]);
  return `<header class="top"><div><div class="eyebrow">${esc(S.mode==='cpu'?'You vs the computer':sub)}</div><div class="title">${S.qpClassic&&S.mode==='cpu'?'Classic':esc(title)}</div></div>
      <div class="topbtns"><button class="btn ghost small gearmini" data-a="settings" aria-label="Settings">⚙</button><button class="btn ghost small" ${S.qpClassic&&S.mode==='cpu'?'data-a="qpmode" data-v="list"':S.mode==='practice'?'data-a="openmode" data-v="cpu"':'data-a="home"'}>Back</button></div></header>
    ${art.length&&S.mode!=='online'&&S.mode!=='local'&&S.mode!=='cpu'?`<div class="modehero" aria-hidden="true"><span class="mk">${kj}</span>${art.map(id=>`<img decoding="sync" src="${ART[id]}" alt="">`).join('')}</div>`:''}
    ${S.mode==='online'?onlinePage():S.mode==='local'?`<div class="localpage">${modeSettings()}</div>`:S.mode==='cpu'&&!S.qpClassic?gmList():S.mode==='cpu'?`<div class="localpage">${modeSettings()}</div>`:`<div class="panel modepanel">${modeSettings()}</div>`}`;
}
let INSTALL_LATER=false;
// "Add to Home Screen": installed, the game keeps its saved progress (iPhone Safari deletes website data after 7 days
// without a visit, but not for Home Screen apps) and opens full screen. S.install is filled in by app.js.
function installCard(){
  const i=S.install; if(!i || i.standalone || INSTALL_LATER || (!i.mobile && !i.canPrompt) || (typeof isTV==='function'&&isTV())) return '';   // browsers only, every time the game opens; never in the installed app
  const steps = i.ios ? `<ol class="isteps"><li>Tap <b>Share</b> <span class="ishare" aria-hidden="true">⬆︎</span> at the bottom of Safari</li><li>Choose <b>Add to Home Screen</b></li></ol>`
    : i.canPrompt ? '' : '<p class="muted">Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>';
  return `<div class="install"><div class="ihead"><span class="ik">家</span><div><b>Keep your progress safe!</b><span class="muted">Add Slayer Squad to your Home Screen. It opens like an app, and your story and stats stay saved.</span></div></div>
    ${steps}<div class="ibtns">${i.canPrompt && !i.ios?'<button class="btn small" data-a="install">Install</button>':''}<button class="btn ghost small" data-a="installlater">Later</button></div></div>`;
}
// Story on the home screen: a progress pie and one button to carry on where you left off
// The moving roster on the home screen: tap a portrait to open that card in the Codex. Locked cards are silhouettes, so there's
// something to chase, and the count shows how far along you are.
function rosterRow(){
  const all=ROSTER.filter(c=>!c.spawn && !c.helper), got=all.filter(c=>isUnlocked(c.id)), shown=all.filter(c=>ART[c.id]), open=shown.filter(c=>isUnlocked(c.id)), shut=shown.filter(c=>!isUnlocked(c.id)).slice(0,8);
  const list=open.slice(0,24-shut.length), mix=[]; list.forEach((c,i)=>{ mix.push(c); if(i%2 && shut.length) mix.push(shut.shift()); }); mix.push(...shut);
  if(mix.length<6) return '';
  const row=(hide)=>mix.map(c=>{ const lock=!isUnlocked(c.id); return `<button class="rp${lock?' lock':c.mark?' marked':c.demon?' demon':''}" data-a="codexopen" data-v="${c.id}" ${hide?'tabindex="-1" aria-hidden="true"':`aria-label="${lock?'Locked character':esc(c.short)}"`}><img decoding="sync" src="${ART[c.id]}" alt=""><span>${lock?'???':esc(c.short)}</span></button>`; }).join('');
  return `<section class="roster"><button class="rosterhead" data-a="codex"><span class="rseal" aria-hidden="true">隊</span><b>Roster</b><span class="rcount">${got.length} of ${all.length} unlocked</span><i class="rbar" aria-hidden="true"><u style="width:${Math.round(got.length/all.length*100)}%"></u></i><em aria-hidden="true">›</em></button>
    <div class="artstrip"><div class="track">${row(false)}${row(true)}</div></div></section>`;
}
function storyHome(){
  const won=storyWon(), next=nextStage(), st=STAGES[next], all=won>=STAGES.length;
  const place=st&&(PLACE_ART[st.id]||PLACE_ART[st.arc]);
  return `<div class="storyhome">${place?`<span class="shbg" aria-hidden="true"><img decoding="sync" src="${place}" alt=""></span>`:''}${ART.tanjiro?`<span class="shhero" aria-hidden="true"><img decoding="sync" src="${ART.tanjiro}" alt=""></span>`:''}<div class="sprog" style="--won:${won/STAGES.length*100}"><b>${won}</b><span>of ${STAGES.length}</span></div>
    <div class="shbody"><div class="eyebrow">Story mode</div><b>${all?'Story complete':won?`Next: ${esc(st.title)}`:'The Slayer’s journey'}</b>
      <span class="muted">${all?`${totalStars()} of ${STAGES.length*3} stars`:won?`Battle ${next+1} · ${esc(ARCS[st.arc].title)}`:`${STAGES.length} battles, from Mount Sagiri to the last dawn`}</span></div>
    <button class="btn small" data-a="storymap">${all?'Star chase':won?'Continue':'Start'}</button></div>`;
}
function vSetup(){
  return `
  ${S.askName?`<div class="scrim"></div><div class="modal"><div class="in askname"><b>What should we call you?</b><span class="muted">Your name shows when you win, in story mode and online.</span>
    <div class="namerow"><input id="hname" type="text" maxlength="14" placeholder="Your name" aria-label="Your name"><button class="btn small" data-a="savename" data-v="hname">Save</button></div>
    <button class="btn ghost small" data-a="nameskip">Not now</button></div></div>`:''}
  <div class="setbar">${typeof isTV==='function'&&isTV()?'':'<button class="gear tvbtn" data-a="tvstart" aria-label="TV mode" title="TV mode">📺 TV mode</button>'}<button class="gear tvjoinbtn" data-a="tvjoinopen" aria-label="Join a TV" title="Join a TV">📺 Join a TV</button><button class="gear" data-a="codex" aria-label="Codex" title="Codex">📖 Codex</button><button class="gear" data-a="settings" aria-label="Settings" title="Settings">⚙ Settings</button></div>
  <div class="hero"><span class="kanji" aria-hidden="true">滅</span>
    <h1>Slayer Squad</h1>
    <div class="credit">Built by Charles Kowou · Inspired by Amelia Gray</div>
    ${storyWon()||loadGames().length?'':'<p class="muted tagline">Build your squad. Outthink every move.</p>'}</div>
  ${S.tvMsg?`<p class="hint onlinemsg">${esc(S.tvMsg)}</p>`:''}
  ${S.tvJoinOpen?`<div class="panel tvjoinpanel"><b>Join a TV</b><ol class="tvsteps"><li>On a smart TV, open its web browser and go to slayersquad.app. Or connect a laptop to your TV with an HDMI cable or AirPlay and open the game there.</li><li>Click the 📺 button at the top of the game.</li><li>A 4-letter code appears on the TV. Type it here.</li></ol><span class="muted">This phone becomes your controller. A second phone can join with the same code for 2 players.</span>
    <div class="joinrow"><input id="tvcode" type="text" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="CODE" value="${esc(S.tvJoinCode||'')}" aria-label="TV code"><button class="btn" data-a="tvjoin">Join</button></div>
    ${S.tvJoinMsg?`<p class="hint onlinemsg">${esc(S.tvJoinMsg)}</p>`:''}</div>`:''}
  ${typeof oldSite==='function'&&oldSite()?`<div class="movecard"><b>We’ve moved to slayersquad.app</b><span>Tap below and your progress comes with you. Then add the new game to your Home Screen. Once you have, you can delete this old one.</span>
    <button class="btn small" data-a="movesite">Move my progress</button>${S.moveMsg?`<small>${esc(S.moveMsg)}</small>`:''}</div>`:''}
  ${rosterRow()}
  ${gamesCard()}
  ${storyHome()}
  ${dailyCard()}
  <div class="gmgrid home">${MODE_CARDS.filter(m=>m[0]!=='practice').map(([k,kj,t,sub])=>pickTile(`data-a="openmode" data-v="${k}"`,k==='cpu',kj,t,sub,'',{cpu:'muzan',online:'giyu_mark'}[k]||(MODE_ART[k]||[])[0])).join('')}</div>
  <details class="panel" id="howto"><summary>How to play</summary>
    <ol class="steps">
      <li><span class="sk">選</span><div><b>Pick a mode</b>Quickplay vs the computer, Online or Same Phone with friends, or the Story.</div></li>
      <li><span class="sk">陣</span><div><b>Draft a squad</b>Take turns picking characters within your points. Tap a card to read it first.</div></li>
      <li><span class="sk">技</span><div><b>Choose moves in secret</b>Each fighter picks Attack, Defend (half damage) or their Special, and a target.</div></li>
      <li><span class="sk">斬</span><div><b>Watch the clash</b>The fastest act first. Health shows as a percent; red means 25% or less.</div></li>
      <li><span class="sk">勝</span><div><b>Last team standing wins</b>Specials recharge, demons regenerate, and the sun burns demons from round ${SUNRISE_ROUND}.</div></li>
    </ol>
    <div class="goodtoknow"><div class="tlabel">Good to know</div>
      <p><b>Synergies</b> (like Tanjiro + Nezuko) are listed in the draft's Pool notes and in the 📖 Codex.</p>
      <p><b>Marks ✦</b> hit harder and recharge faster. <b>Legends</b> (Yoriichi) strike twice.</p>
      <p><b>Back pocket:</b> one optional 1 pt helper you can use once, on any round.</p>
      <p><b>3–4 players:</b> a free-for-all or 2v2 teams. Specials that hit "every enemy" hit the team you aim at.</p>
      <p><b>Story</b> unlocks new characters for every mode as you win battles.</p>
    </div></details>
  ${updatesPanel()}
  ${installCard()}`;
}

/* ---------- who picks first ---------- */
// Who picks first: a character thinks of a number from 1 to 9; each player takes a numbered character card; closest
// goes first (engine.js: newGuess / guessPick). Local players take turns on the one screen; online and on a TV each
// phone picks its own; the computer picks at random right after you.
// The cards deal in, and the secret card flips, only the first time this screen draws them: guest phones and the TV
// redraw on every update, which would restart the animations (and keep the cards half-faded)
const GUESS_SHOWN = new Set();
function vSpin(){
  const g=S.spin; if(!g || g.game!=='guess') return `${topbar('Before the draft', 'Who picks first?')}`;
  const seenKey=g.cards.join()+'|'+g.state, fresh=!GUESS_SHOWN.has(seenKey); GUESS_SHOWN.add(seenKey);
  const done=g.state==='done', ctl=typeof isCtl==='function'&&isCtl(), guest=isOnline()&&!iAmHost()&&!isAsync();
  const onPhones = typeof isTV==='function' && isTV() && (S.tvDuo || tvAnyPhone());   // the TV: the phones pick
  const me = onPhones ? -1 : isOnline()||ctl ? S.me : S.mode==='cpu' ? 0 : guessTurn();
  const mine = !done && me>=0 && !g.picks[me];
  const host=BYID[g.host], waiting=players().filter(q=>!g.picks[q]);
  const card=(id,i)=>{ const n=i+1, o=g.picks.indexOf(n), c=BYID[id], win=done && o===g.r;
    return `<button class="gcard${o>=0?' taken':''}${shown&&n===g.secret?' secret':''}${win?' win':''}" data-a="guess" data-v="${n}" ${mine&&o<0?'':'disabled'} style="--tc:${o>=0?pc(o):'var(--line-2)'};--i:${i}">
      <span class="gart">${ART[id]?`<img decoding="sync" src="${ART[id]}" alt="">`:`<span class="ck">${c.g}</span>`}</span><span class="gnum">${n}</span>
      ${shown&&n===g.secret?'<span class="gis">The number!</span>':''}${o>=0?`<span class="gtag" style="background:${pc(o)}">${nm(o)}</span>`:''}</button>`; };
  const coin=g.state==='coin', shown=done||coin, tieLine=g.tied?`${g.tied.who.map(q=>`${nm(q)} ${g.picks[q]}`).join(' and ')}: a tie, both ${plural(g.tied.away,'away')}.`:'';
  const say = shown ? `It was <b>${g.secret}</b>: <b>${esc(BYID[g.cards[g.secret-1]].short)}</b>!` : 'I’m thinking of a number from 1 to 9.';
  const caller = !coin || onPhones ? -1 : isOnline()||ctl ? S.me : S.mode==='cpu' ? 0 : g.tied.who[0], callNow = coin && g.tied.who.includes(caller);
  const dist = q => Math.abs(g.picks[q]-g.secret);
  const status = done
    ? `<div class="spinres" style="color:${pc(g.r)}">${nm(g.r)} picks first</div>
       <p class="hint gwhy">${g.call?`${tieLine} ${nm(g.call.p)} called ${g.call.side}, and it landed ${g.flip}.`:players().map(q=>`${nm(q)} ${g.picks[q]} (${dist(q)} away)`).join(' · ')}</p>
       ${ctl?'':actionbar(guest?`<button class="btn" disabled>Waiting for ${nm(hostSeat())} to start…</button>`:`<button class="btn team" data-a="toDraft" style="--bc:${pc(g.r)}">Start the draft</button>`)}`
    : coin ? `<p class="hint gwhy">${tieLine}</p><div class="spinhint">${callNow?`<span style="color:${pc(caller)}">${nm(caller)}</span>, call the coin`:`Waiting for ${g.tied.who.map(q=>`<span style="color:${pc(q)}">${nm(q)}</span>`).join(' or ')} to call the coin${onPhones?' on the phone':''}…`}</div>${callNow?`<div class="coinbtns">${COIN_SIDES.map(s=>`<button class="btn" data-a="coincall" data-v="${s}">${s==='heads'?'Heads':'Tails'}</button>`).join('')}</div>`:''}${isAsync()?`<p class="hint">${asyncHint()}</p>`:''}`
    : `<div class="spinhint">${mine?`<span style="color:${pc(me)}">${nm(me)}</span>, pick a number`:`Waiting for ${waiting.map(q=>`<span style="color:${pc(q)}">${nm(q)}</span>`).join(' and ')} to pick${onPhones?' on the phone':''}…`}</div>${isAsync()?`<p class="hint">${asyncHint()}</p>`:''}`;
  return `${topbar('Before the draft', 'Who picks first?')}
    <div class="guess${done?' done':''}${fresh?' fresh':''}"><div class="gthink">${seal(host,'stg')}<div class="gsay"><span class="gwho">${esc(host.short||host.name)}</span><span>${say}</span></div></div>
    <div class="ggrid">${g.cards.map(card).join('')}</div>${status}</div>`;
}

/* ---------- draft ---------- */
function cardHTML(c,p){
  const owner=S.picks.findIndex(t=>t.includes(c.id)), ban=(S.bans||[]).find(b=>BYID[b.id].fam===c.fam);
  const ok = S.banning ? canBan(p,c.id) : canPick(p,c.id);
  const badge = c.legend?'Legend':c.mark?'✦ Mark':'';
  // picture-first card: art on top (kanji if no picture), name and type over its lower edge, stats below
  return `<button class="card ${glyphCls(c)}${ok?'':' off'}${S.sel===c.id?' sel':''}${owner>=0?' taken':''}" data-a="sel" data-v="${c.id}" ${ok?'':'aria-disabled="true"'}>
    <span class="cart">${ART[c.id]?`<img decoding="sync" src="${ART[c.id]}" alt="">`:`<span class="ck">${c.g}</span>`}</span>
    <span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span>
    ${badge?`<span class="badge">${badge}</span>`:''}
    <span class="cbody"><span class="cn">${esc(c.name)}</span><span class="ct">${esc(c.type)}</span>${statCells(c)}<span class="csp">${esc(sigCaption(c))}</span></span>
    ${owner>=0?`<span class="tag" style="background:${pc(owner)}">${nm(owner)}</span>`:ban?`<span class="tag banned">Banned · ${nm(ban.p)}</span>`:''}</button>`;
}
function teamBox(q,p){
  const left=budget()-spent(q), study=(S.mode==='story'||S.mode==='daily') && q===1;   // the set enemy team: tap to study it
  return `<${study?`button data-a="theirs" aria-expanded="${!!S.showTheirs}"`:'div'} class="tbox${p===q&&!S.locked[q]?' active':''}${study?' studybox':''}" style="--tc:${pc(q)}">
    <div class="tn"><span>${nm(q)}${q===myP()&&soloView()&&S.mode!=='story'?' <small>(you)</small>':''}${S.duo?` <small class="tside">Team ${sideOf(q)+1}</small>`:''}</span><span>${study?(S.showTheirs?'Hide ▴':'Tap to study ▾'):S.locked[q]?'Locked':budget()>=UNLIMITED?`${spent(q)} pts`:left+' pts left'}</span></div>
    <div class="meter" role="img" aria-label="${spent(q)} of ${budget()} points spent"><i style="width:${Math.min(100,spent(q)/budget()*100)}%"></i></div>
    <div class="slots">${S.picks[q].map(id=>seal(BYID[id],'xs')).join('')}${!S.locked[q]&&fighterIds(q).length<teamCap()?'<span class="slot empty"></span>':''}</div></${study?'button':'div'}>`;
}
function vDraft(){
  // cpuTurn = the other side is picking (the computer, or the other phone online): this phone waits
  const p = turn(), cpuTurn = (S.mode==='cpu' && p!==0) || (isOnline() && p!==S.me), story = S.mode==='story', forCpu = isPractice() && p!==0;
  const fresh = allPicks().length===0, left=budget()-spent(p);
  // second pick in a row (snake order), or everyone else has locked and this one keeps going
  const restLocked = others(p).every(q=>S.locked[q]);
  const again = S.lastPicker===p && !restLocked;
  const verb = restLocked && others(p).some(q=>S.picks[q].length) ? 'keeps picking' : again ? 'picks again' : cpuTurn ? 'is picking' : 'picks';
  const daily=S.mode==='daily', final=S.mode==='final', gm=gameMode(), fixed=story||daily||gm;   // one side drafts, the other team is already set
  const lockbar = !cpuTurn && !S.banning && fighterIds(p).length ? `<div class="lockbar"><span>${fixed?'Ready to fight?':forCpu?`Done picking for ${nm(p)}?`:'Done picking?'}${left&&budget()<UNLIMITED?` ${left} pts go unused.`:''}</span>
    <button class="btn team small" data-a="lock" style="--bc:${pc(p)}">${fixed?'Fight':forCpu?`Lock ${nm(p)}`:'Lock team'}</button></div>` : '';
  // Undo the latest pick (2 players: either player's; vs computer: only your own)
  const un=!S.banning && undoable(), undo = un && (S.mode==='local' || isPractice() || un.p===myP())
    ? `<button class="btn ghost small undo" data-a="undo">↶ Undo ${nm(un.p)}'s ${esc(BYID[un.id].short)}</button>` : '';
  const st=story&&STAGES[S.stage];
  return `<div class="draftlayout"><div class="dtop">
    ${gm?topbar(gmName(), final?'Muzan is waiting':'Draft your squad'):daily?topbar('Daily challenge', esc(DAILY_GOALS[S.daily.goal.type](S.daily.goal))):story?topbar(`Story · Battle ${S.stage+1} · ${esc(st.title)}`,'Draft replay'):topbar(S.banning?`Ban round · ${S.bans.length+1} of ${nPlayers()}`:forCpu?'Practice · you pick for the computer':'Draft',
      S.banning ? (forCpu?`Ban for <span style="color:${pc(p)}">${nm(p)}</span>`:`<span style="color:${pc(p)}">${nm(p)}</span> ${cpuTurn?'is banning…':'bans a character'}`)
      : forCpu?`Pick for <span style="color:${pc(p)}">${nm(p)}</span>`:`<span style="color:${pc(p)}">${nm(p)}</span> ${verb}${cpuTurn?'…':''}`)}
    ${S.banning?`<p class="hint">Tap a card and ban it: nobody can pick that character this match.${S.bans.length?` Banned so far: ${S.bans.map(b=>esc(BYID[b.id].short)).join(', ')}.`:''}</p>`:''}
    ${story?`<p class="hint">${esc(st.blurb)} You have ${budget()} points. Only the Corps and its allies fight for you.</p>`:''}
    ${S.coop?`<p class="hint">${S.coop==='final'?'Team up with Marked slayers and Corps support. Muzan picks his Upper Moons after you lock in.':'Team up and survive as many waves as you can. Damage carries over.'} You each have ${budget()} points.</p>`:''}
    ${final?`<p class="hint">Marked slayers and Corps support only, ${budget()} points. Muzan picks his Upper Moons after he sees your squad, and the sun rises in round ${FINAL_SUNRISE}.</p>`:gm?`<p class="hint">${esc(GM[S.mode].blurb)} You have ${budget()} points.</p>`:''}
    ${daily?`<p class="hint">Their team is set. Draft a squad to beat it with ${budget()} points, from the characters you've unlocked.</p>`:''}
    ${awayBanner()}${isAsync()&&cpuTurn?`<p class="hint asynchint">${asyncHint()}</p>`:''}${S.banning||cpuTurn?'':tip('draft','Tap a card to read it, then <b>Confirm</b> to pick it. Stay within your points (up to 6 fighters), and tap <b>Lock team</b> when you’re done.')}
    ${S.banning?'':orderStrip(p)}
    <div class="teams${nPlayers()>2?' many':''}">${players().map(q=>teamBox(q,p)).join('')}</div>
    ${lockbar}
    <div class="dealt"><span>${(n=>final?`Marks and Corps support · ${n}`:gm?`Every character · ${n}`:story?`The Corps · ${n} characters`:daily?`Your unlocked characters · ${n}`:fullPool()?`${poolName(S.poolType)} · ${n}`:`${n} characters dealt`)(S.pool.filter(id=>!isHelper(id)).length)} · tap one to see it</span>${undo}${fresh&&!cpuTurn&&!fixed&&S.poolType!=='all'&&(!isOnline()||iAmHost())?'<button class="btn ghost small" data-a="redeal">Re-deal</button>':''}</div>
    ${(story||daily)&&S.showTheirs?`<section class="theirs"><div class="tlabel">Their team · tap a card to study it</div><div class="grid">${S.picks[1].map(id=>cardHTML(BYID[id],p)).join('')}</div></section>`:''}</div>
    ${notesPanel()}
    <div class="grid">${S.pool.filter(id=>!isHelper(id)).map(id=>cardHTML(BYID[id],p)).join('')}</div>
    ${S.banning?'':pocketDraft(p)}</div>`;
}
// The back-pocket helpers in the draft: a slim optional row at the bottom. 1 pt, one helper per player.
function pocketDraft(p){
  const hs=S.pool.filter(isHelper); if(!hs.length) return '';
  return `<section class="pocket"><div class="pockethead"><span class="tlabel">Back pocket</span><span class="muted">Optional · pick one 1 pt helper · used once in battle</span></div>
    <div class="pocketrow">${hs.map(id=>{ const c=BYID[id], owner=S.picks.findIndex(t=>t.includes(id)), ok=canPick(p,id);
      return `<button class="hchip${ok?'':' off'}${S.sel===id?' sel':''}${owner>=0?' owned':''}" data-a="sel" data-v="${id}" ${ok?'':'aria-disabled="true"'} ${owner>=0?`style="--tc:${pc(owner)}"`:''}>${seal(c,'pip')}
        <span><b>${esc(c.short)}</b><small>${owner>=0?nm(owner):esc(c.sig.tag)}</small></span></button>`; }).join('')}</div></section>`;
}
// Move screen: your helper (if not used yet) as a small toggle next to "Lock in moves"
// Kiriya's Ambush Orders: once he's switched on, pick the fighter to set the trap around (default: the most hurt)
function ambushPick(p){
  if(S.scouting || !(S.helperPlan[p]||[]).includes('kiriya')) return '';
  const team=alive(p), pick=(S.plans[p]||{}).ambush, cur=team.find(u=>u.uid===pick) || team.slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
  return `<div class="ambushpick"><span class="tlabel">Kiriya's trap goes around</span><div class="tgs">${team.map(u=>`<button class="tg ally${u===cur?' on':''}" data-a="ambush" data-v="${u.uid}">${seal(u,'sm')}${esc(u.name)}<span>${pct(u)}%</span></button>`).join('')}</div>
    <p class="hint">Every enemy that attacks them this round takes ${AMBUSH_DMG} damage back. They won't see where it is.</p></div>`;
}
function pocketChip(p){
  const id=S.helpers&&S.helpers[p]&&S.helpers[p][0]; if(!id || S.scouting) return '';
  const c=BYID[id], on=(S.helperPlan[p]||[]).includes(id);
  return `<button class="pchip${on?' on':''}" data-a="helper" data-v="${id}" aria-pressed="${on}" title="${esc(c.sig.desc)}">${seal(c,'pip')}<span><b>${on?'Using':'Use'} ${esc(c.short)}</b><small>${esc(c.sig.tag)}</small></span></button>`;
}
// What the crow saw: the other side's locked-in moves
function crowReport(p){
  return `<div class="crow"><div class="crowhead">${seal(BYID.crow,'sm')}<b>Crow report</b><span class="muted">${nPlayers()>2?'Everyone else':nm(others(p)[0])+"'s"} moves this round</span></div>
    ${others(p).filter(q=>alive(q).length).map(q=>`${nPlayers()>2?`<div class="crowteam" style="color:${pc(q)}">${nm(q)}</div>`:''}
      ${alive(q).map(e=>`<div class="crowline">${seal(e,'pip')}<b>${esc(e.name)}</b><span>${moveSummary(e)}</span></div>`).join('')}
      ${(S.helperPlan[q]||[]).length?`<div class="crowline"><span>Back pocket: ${(S.helperPlan[q]).map(id=>esc(BYID[id].short)).join(', ')}</span></div>`:''}`).join('')}</div>`;
}
// The crow is back: see the enemy's moves, then change yours or keep them
function vScout(){
  const p=S.scoutP;
  if(isOnline() && p!==S.me) return waitScreen(`Round ${S.round}`, `${nm(p)}'s Kasugai Crow is scouting…`, `${nm(p)} is seeing your moves and may change theirs.`);
  return `${topbar(`Round ${S.round} · Kasugai Crow`, `<span style="color:${pc(p)}">${nm(p)}</span>, your crow is back`)}
    ${crowReport(p)}
    <p class="hint">You can change your moves now that you know theirs. Back-pocket choices stay as they are.</p>
    ${actionbar(`<button class="btn ghost" data-a="keepmoves">Keep my moves</button><button class="btn team" data-a="rescout" style="--bc:${pc(p)}">Change my moves</button>`)}`;
}
// Online: who's away, and what happens if the host stays away (the game waits; after a while hosting moves)
const awayTag = q => isOnline() && S.away && S.away[q] ? ' <span class="awaytag">away</span>' : '';
function awayBanner(){
  if(!isOnline()) return '';
  if(S.hostNote) return `<div class="netnote">${esc(S.hostNote)} If you’d already chosen your moves, tap Lock in moves again.</div>`;
  if(!S.hostAwaySince) return '';
  const h=hostSeat(), next=players().find(p=>p!==h && !(S.away&&S.away[p])), mins=Math.max(1, Math.ceil((S.hostAwaySince+HANDOFF_MS-Date.now())/60000));
  return `<div class="netnote">${nm(h)} has stepped away. The game waits for them${next!==undefined?`; if they’re not back in about ${plural(mins,'minute')}, ${next===S.me?'you take':nm(next)+' takes'} over hosting so the game can go on`:''}.</div>`;
}
const asyncHintText = 'Tap Leave to play something else. This game stays on your home screen and says when it’s your turn.';
const asyncHint = () => S.oppHere ? `${esc(nm(1-S.me))} is here too, so this is playing live.` : `${esc(nm(1-S.me)||'They')} isn’t in the game right now. ${asyncHintText}`;
// A simple "waiting for the other phone" screen (online play)
// Quick taunts in a 2-player online game: a fighter of yours says their own line (js/app.js)
function tauntBar(){
  if(!isAsync() || S.tauntsOn===false || !S.teams || !S.oppHere || tauntsLeft()<=0) return '';
  return `<div class="tauntbar"><button class="btn ghost small" data-a="tauntopen" aria-expanded="${!!S.tauntOpen}">💬 Taunt · ${tauntsLeft()} left</button>
    ${S.tauntOpen?`<div class="tauntlist">${alive(S.me).filter(u=>SPECIAL_QUOTES[u.id]).slice(0,4).map(u=>`<button class="tauntline" data-a="taunt" data-v="${u.id}"><b>${esc(u.name)}</b> ${esc(SPECIAL_QUOTES[u.id])}</button>`).join('')}</div>`:''}</div>`;
}
function waitScreen(eyebrow, title, line){
  return `${topbar(eyebrow, title)}${awayBanner()}<div class="waiting"><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div><p class="muted">${line}</p>${isAsync()?`<p class="hint">${asyncHint()}</p>`:''}</div>`;
}
// Online lobby: the host shares the room code; up to three guests take seats 2–4. The host starts when ready.
function vLobby(){
  if(isAsync()) return `${topbar('Online game', 'Your game')}
    <div class="lobby"><div class="tlabel">Game code</div><div class="roomcode">${esc(S.asyncCode||'······')}</div>
      <p class="muted">Send this code to your friend. They tap Online → Join a game and type it.</p>
      <p class="hint">${asyncHintText}</p></div>
    ${actionbar('<button class="btn" data-a="home">Back to the home screen</button>')}`;
  const L=S.lobby||{}, host=iAmHost(), seats=L.seats||[], taken=seats.filter(x=>x&&x.on).length, ok=taken>=1 && seats.slice(0,taken).every(x=>x&&x.on), n=taken+1, c=S.cfg||loadModeCfg('online');
  const seat=(i,name,on)=>`<div class="seat${on?' on':''}" style="--tc:${pc(i)}"><span class="sn">${i+1}</span><b>${on?esc(name):'Open'}</b>${i===0?'<small>host</small>':i===S.me&&!host?'<small>you</small>':''}</div>`;
  const how=n<2?'Waiting for friends. Up to 4 can join.':(c.gm==='final'||c.gm==='gauntlet')?`${plural(n,'player')} on one team.`:n===2?'2 players: play live, or take turns whenever you like.':n===3?'3 players: a free-for-all, and everyone plays at the same time.':c.duo?'4 players: 2v2, and everyone plays at the same time.':'4 players: a free-for-all, and everyone plays at the same time.';
  const gm=c.gm==='mirror'?'none':c.gm||'none', coop=gm==='final'||gm==='gauntlet';
  return `${topbar('Online game', host?'Invite your friends':'You’re in')}
    <div class="lobby">
      <div class="tlabel">Game code</div><div class="roomcode">${esc(L.code||'····')}</div>
      ${host?`<button class="btn ghost small" data-a="copyroom">${S.copied?'Copied ✓':'Copy code'}</button>
      <p class="muted">Friends tap Online → Enter a Code.</p>`:`<p class="muted">Waiting for ${nm(0)} to start…</p>`}
      <div class="seats">${[0,1,2,3].map(i=>i===0?seat(0,S.lobbyHost||S.names[0],true):seat(i,(seats[i-1]||{}).name,(seats[i-1]||{}).on)).join('')}</div>
      <p class="hint">${how}</p>
      ${S.onlineMsg?`<p class="hint onlinemsg">${esc(S.onlineMsg)}</p>`:''}
      ${host?`<div class="setline"><span class="tlabel">Against each other</span>${seg('cfggm',gm,[['none','Draft'],['random','Random']])}</div>
      <div class="setline"><span class="tlabel">Team up against the computer</span>${seg('cfggm',gm,[['final','Final Form'],['gauntlet','Gauntlet']])}</div>
      <p class="hint">${gm==='random'?'Everyone is dealt a random team from 5 to 50 points, with no character on two teams.':gm==='final'?'You all face Muzan and the Upper Moons he picks. Everyone plays live, and he grows with your group.':gm==='gauntlet'?'Survive wave after wave together. Everyone plays live, and damage carries over.':'Take turns picking your squads.'}</p>
      ${n===4&&!coop?`<div class="setline"><span class="tlabel">With 4 players</span>${seg('cfgduo',c.duo?'on':'off',[['off','Free-for-all'],['on','2v2 teams']])}</div>`:''}
      ${gm==='none'?`<details class="subset" id="onlineset"><summary>Draft settings <span class="muted">· ${budgetName(c.budget)}${c.budget<UNLIMITED?' pts':' points'} · ${poolName(c.poolType)}</span></summary>
        <div class="setline"><span class="tlabel">Points per team</span>${seg('cfgbudget',c.budget,BUDGETS.map(b=>[b,budgetName(b)]))}</div>
        <div class="setline"><span class="tlabel">Character pool</span>${seg('cfgpool',c.poolType,POOL_OPTS)}</div></details>`:''}`:''}
    </div>
    ${host?actionbar(`<button class="btn" data-a="ostart" ${ok?'':'disabled'}>${ok?`Start with ${n} players`:'Waiting for players…'}</button>`):''}`;
}
// Who picks next: the current pick and the next few, so a double pick is never a surprise
function orderStrip(p){
  if(S.locked.filter(x=>!x).length<2) return '';
  return `<div class="order" aria-label="Pick order"><span class="tlabel">Pick order</span>${pickOrder(6).map((q,i)=>`<span class="op${i===0?' cur':''}" style="--tc:${pc(q)}">${i===0?'Now: ':''}${nm(q)}</span>`).join('<span class="oarrow" aria-hidden="true">›</span>')}</div>`;
}
// Synergies and matchups possible in this deal. Folds away on phones; always open beside the cards on wide screens.
function notesPanel(){
  const notes=poolNotes();
  if(!notes.length) return '';
  const live=notes.filter(n=>n.state!=='off').length;
  return `<aside class="notes${S.notesOpen?' open':''}">
    <button class="nhead" data-a="notes" aria-expanded="${!!S.notesOpen}"><span class="ntitle">Pool notes</span>
      <span class="muted">${live===1?'1 synergy or matchup':`${live} synergies and matchups`} in this deal</span><span class="chev" aria-hidden="true">▾</span></button>
    <div class="nbody">${notes.map(n=>noteHTML(n)).join('')}</div></aside>`;
}
// The cards a matchup note sets against `self`, leaving out anyone already on the team picking now: they'd be teammates
function vsFaces(n, self){
  const mine=S.phase==='draft' ? S.picks[turn()]||[] : [], other=n.side.includes(self) ? n.ids.filter(id=>!n.side.includes(id)) : n.side;
  return other.filter(id=>id!==self && !mine.some(m=>BYID[m].fam===BYID[id].fam));
}
// One note. `self` = the card being viewed, left out of the name chips.
function noteHTML(n, self){
  const status = n.state==='on' ? (n.kind==='team' ? `<span class="nst" style="color:${pc(n.p)}">${nm(n.p)} has it</span>` : '<span class="nst live">In play</span>')
    : n.state==='off' ? '<span class="nst">No longer possible</span>' : '';
  const who=n.ids.filter(id=>id!==self);
  const chip=id=>`<button class="nc" data-a="sel" data-v="${id}">${seal(BYID[id],'sm')}${esc(BYID[id].short)}</button>`;
  // Opponents: who's on which side, with a vs between them (on a card's own panel, just the side it faces)
  const vsChips=()=>{ const a=n.ids.filter(id=>n.side.includes(id)), b=n.ids.filter(id=>!n.side.includes(id)), mine=a.includes(self)||b.includes(self), them=mine?vsFaces(n,self):[];
    return mine ? (them.length?`<div class="nwho"><span class="tlabel">vs</span>${them.map(chip).join('')}</div>`:'') : `<div class="nwho"><span class="nside">${a.map(chip).join('')}</span><span class="nvs">vs</span><span class="nside">${b.map(chip).join('')}</span></div>`; };
  return `<div class="note ${n.state}"><div class="nh"><span class="nk ${n.kind}">${n.kind==='team'?'Same team':'Opponents'}</span>${status}</div>
    <div class="nt">${esc(n.title)}</div><div class="nx">${esc(n.text)}</div>
    ${n.kind==='vs'?vsChips():who.length?`<div class="nwho">${self?'<span class="tlabel">With</span>':''}${who.map(chip).join('')}</div>`:''}</div>`;
}
// Hantengu's split forms, shown on his card: each form, what it becomes when it falls, and the form they merge into
// The home screen's Latest Updates tile (js/updates.js)
const updatesNew = () => { try{ return +localStorage.getItem('squad-draft-seen-update')!==LATEST_UPDATE.version; }catch(e){ return false; } };
const updatesPanel = () => `<details class="panel" id="updates"><summary>Latest Updates${updatesNew()?'<i class="newdot">New</i>':''}</summary>
    <div class="updhead"><b>Version ${LATEST_UPDATE.version}</b><span class="muted">${esc(LATEST_UPDATE.date)}</span></div>
    <ul class="updlist">${LATEST_UPDATE.notes.map(([t,d])=>`<li><b>${esc(t)}</b>${esc(d)}</li>`).join('')}</ul></details>`;
function splitTree(c){
  const form=id=>{ const f=BYID[id]; return `<div class="sform">${seal(f,'sm')}<div><b>${esc(f.short)}</b> <span class="muted">${f.hp} HP · PWR ${f.pow} · SPD ${f.spd}</span><br><span class="sx">${esc(f.sig.name)}: ${esc(f.sig.desc)}</span>${f.splits?`<div class="sthen">falls → ${f.splits.map(k=>esc(BYID[k].short)).join(', ')}</div>`:''}</div></div>`; };
  const all=[]; const walk=id=>{ (BYID[id].splits||[]).forEach(k=>{ all.push(k); }); (BYID[id].splits||[]).forEach(walk); }; walk(c.id);
  const merged=[...new Set(all.map(id=>BYID[id].merge).filter(Boolean))];
  return `<div class="splits"><div class="tlabel">Splits into</div>${all.map(form).join('')}
    ${merged.map(id=>`<div class="tlabel">When the last one falls, they merge into</div>${form(id)}${BYID[id].anchor?`<div class="tlabel">And the real one comes back</div>${form(BYID[id].anchor)}`:''}`).join('')}</div>`;
}
// Fighter info card in battle: tap any picture (yours or the opponent's). Shows current stats, which include
// team bonuses and anything gained in the match, plus the special's cooldown, passives and status effects.
function vInfo(){
  const u=findU(S.info); if(!u) return '';
  const c=BYID[u.id], pas=[c.passive, c.mark?MARK_PASSIVE:''].filter(Boolean);
  const yours = soloView() ? u.p===myP() : S.phase==='plan' ? u.p===S.planFor : null;
  const side = yours===null || (!yours && nPlayers()>2) ? nm(u.p) : yours ? 'Your team' : 'Opponent';
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in info ${glyphCls(u)}" role="dialog" aria-modal="true" aria-label="${esc(u.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    ${banner(u)}
    <div class="shead">${seal(u,'lg')}<div><div class="eyebrow" style="color:${pc(u.p)}">${side} · ${esc(c.type)}</div><h2>${esc(c.name)}</h2></div></div>
    <div class="ihp"><span class="tlabel">Health</span>${health(u,{simple:true})}</div>
    <span class="stats"><span><i>PWR</i>${u.pow}</span><span><i>DEF</i>${u.def}</span><span><i>SPD</i>${u.spd}</span><span><i>REGEN</i>${u.regen?pct(u,u.regen)+'%':'–'}</span></span>
    <div class="sig"><div class="sname">${esc(u.sig.name)} <span class="muted">· ${!u.alive?'knocked out':u.cd>0?`ready in ${plural(u.cd,'round')}`:'ready now'}</span></div>${esc(u.sig.desc)}</div>
    ${BYID[u.id].sig2?`<div class="pas">Specials take turns: ${esc(BYID[u.id].sig.name)}, then ${esc(BYID[u.id].sig2.name)}. Next up: <b>${esc(u.sig.name)}</b>.</div>`:''}
    ${BYID[u.id].selfless?`<div class="pas"><b>${esc(SELFLESS.name)}</b>: ${u.selfless?'active now. He can\'t be touched until Hinokami Kagura is ready.':u.selflessUsed?'used this match.':u.sig.id==='selfless'?'his special now.':selflessOpen()?'his next special after Hinokami Kagura (once per match).':'🔒 unlocks when you win Destructive Death in the story.'} ${esc(SELFLESS.desc)}</div>`:''}
    ${u.legend?`<div class="pas">Strikes ×${u.strikes} per Attack · takes at most ${pct(u,u.cap)}% a round.</div>`:''}
    ${pas.map(x=>`<div class="pas">${esc(x)}</div>`).join('')}
    ${statusChips(u,false)}
    ${S.syn&&S.syn[u.p].length?`<div class="ibonus"><span class="tlabel">Team bonuses</span>${synChips(u.p)}</div>`:''}
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button></div>
  </div></div>`;
}
// Two players: after both lock in, wait for a tap before the round plays out
function vReady(){
  const row=p=>`<div class="rteam" style="--tc:${pc(p)}"><span class="rname">${nm(p)}</span><span class="rseals">${alive(p).map(u=>seal(u,'sm')).join('')}</span></div>`;
  return `<div class="pass ready"><div class="eyebrow">Round ${S.round}</div>
    <div class="big">${standing().length>2?'All squads are ready':'Both squads are ready'}</div>
    <div class="rvs">${standing().map(row).join('<span class="rx">VS</span>')}</div>
    <p class="muted">Put the phone where everyone can see it.</p>
    <button class="btn" data-a="fight">Start the battle</button></div>`;
}
// Save (a tab in Settings): the cloud backup's recovery code, when it last backed up, and restoring on this phone
function saveTab(){
  const c=typeof loadCloud==='function'?loadCloud():{}, st=typeof CLOUD!=='undefined'?CLOUD.status:'';
  const ago=c.last?Math.round((Date.now()-c.last)/60000):null;
  return `<div class="setgroup"><div class="tlabel">Cloud backup</div>
      ${st==='rules'?'<p class="hint warn">Cloud backup isn’t switched on yet (it needs one setting in the game’s Firebase).</p>'
        : c.code?`<p class="hint">Your progress backs up automatically. ${ago===null?'':ago<1?'Last backup: just now.':`Last backup: ${ago<60?plural(ago,'minute'):plural(Math.round(ago/60),'hour')} ago.`}</p>`
        : '<p class="hint">Your progress will back up automatically once you’ve played a little.</p>'}
      ${c.code?`<div class="tlabel">Your recovery code</div><div class="savecode">${showCode(c.code)}</div>
        <p class="hint">Write it down or screenshot it. On another device, or if this browser’s data is ever cleared, enter it below. It adds your progress and never removes any.</p>
        <div class="row"><button class="btn ghost small" data-a="copycode">${S.copied?'Copied ✓':'Copy code'}</button><button class="btn ghost small" data-a="backupnow">Back up now</button></div>`:''}</div>
    <div class="setgroup"><div class="tlabel">Restore on this device</div>
      <div class="joinrow"><input id="restorecode" type="text" maxlength="16" autocapitalize="characters" autocomplete="off" placeholder="XXXX-XXXX-XXXX" value="${esc(S.restoreCode||'')}" aria-label="Recovery code"><button class="btn small" data-a="restore">Restore</button></div>
      ${S.restoreMsg?`<p class="hint">${esc(S.restoreMsg)}</p>`:''}</div>`;
}
// Stats (a tab in Settings): wins per player name and per-character records, on this phone.
// Only Local, Online and Quickplay games count: not Story (preset, boosted fights) or Practice (curated matches).
function globalPanel(){
  if(!GLOBAL_STATS) return `<div class="setgroup"><div class="tlabel">Everyone’s games</div><div class="muted">${S.globalErr?'Not available right now.':'Loading…'}</div></div>`;
  const rows=ROSTER.filter(c=>!c.spawn).map(c=>({c, ...globalOf(c.id)})).filter(x=>x.p>=GLOBAL_MIN).sort((a,b)=>b.w/b.p-a.w/a.p), n=GLOBAL_STATS.games||0;
  return `<div class="setgroup"><div class="tlabel">Everyone’s games · ${n} ${n===1?'match':'matches'}</div>
    ${rows.length?`<div class="recs"><div class="rec head"><span></span><span>Character</span><span>Win rate</span><span>Picked</span></div>
    ${rows.map(x=>`<div class="rec">${seal(x.c,'sm')}<span class="rn">${esc(x.c.short)}</span><b>${Math.round(x.w/x.p*100)}%</b><span class="muted">${x.d>=10?Math.round(x.r/x.d*100)+'%':'–'}</span></div>`).join('')}</div>`
      :`<div class="muted">Not enough games yet. A character shows up here after ${GLOBAL_MIN} games.</div>`}
    <div class="hint">From every player's finished games (Same Phone, Online and Quickplay; in Quickplay only your squad counts). Picked = how often players take a character when it's dealt. Anonymous: no names are sent.</div></div>`;
}
function statsTab(){
  const sc=loadScore(), top=Object.entries(sc).sort((a,b)=>b[1]-a[1]);
  return `<div class="setgroup"><div class="tlabel">All-time wins</div>
      <div class="score">${top.length ? top.slice(0,6).map(([k,v])=>`<div><b>${v}</b>${esc(k)}</div>`).join('') : '<div class="muted">No matches yet</div>'}</div></div>
    ${recordsPanel()}
    <div class="hint">Counts Same Phone, Online and Quickplay games on this phone. Story and Practice battles don't count.</div>
    ${globalPanel()}`;
}
// Settings (gear on the main screen): general options only. Match settings live with each mode on the main menu.
function vSettings(){
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in" role="dialog" aria-modal="true" aria-label="Settings">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    <h2>Settings</h2>
    ${seg('settab',S.setTab||'general',[['general','General'],['stats','Stats'],['save','Save']])}
    ${S.setTab==='stats'?statsTab():S.setTab==='save'?saveTab():`<div class="setgroup"><div class="tlabel">Your name</div>
      <div class="namerow"><input id="pname" type="text" maxlength="14" value="${esc(playerName())}" placeholder="Your name" aria-label="Your name"><button class="btn small" data-a="savename" data-v="pname">${S.nameSaved?'Saved ✓':'Save'}</button></div>
      <div class="hint">Shown when you win, in story mode and online. Each phone keeps its own name.</div></div>
    ${inMatch()?'':`<div class="setgroup placeset"><div class="tlabel">Battle background</div>
      <select class="setselect" data-change="placecfg" aria-label="Battle background">${[['random','Random'],['off','Off'],...Object.keys(PLACE_ART).filter(id=>!/^(dr_|dream|six)/.test(id)).map(id=>[id,placeName(id)])].map(([v,l])=>`<option value="${v}"${placeChoice()===v?' selected':''}>${esc(l)}</option>`).join('')}</select>
      <div class="hint">Quickplay, Same Phone, Online and Practice games are fought in front of one of the story places. Story battles always use their own.</div></div>`}
    <div class="setgroup"><div class="tlabel">Playback speed</div>
      ${seg('speed',S.speed||'normal',[['slow','Slow'],['normal','Normal'],['fast','Fast']])}
      <div class="hint">How long each action stays on screen during a round.</div></div>
    <div class="setgroup"><div class="tlabel">Music</div>${seg('volmusic',(S.vol||loadVolumes()).music,[[0,'Off'],[1,'Low'],[2,'Medium'],[3,'High']])}</div>
    <div class="setgroup"><div class="tlabel">Sound effects</div>${seg('volsfx',(S.vol||loadVolumes()).sfx,[[0,'Off'],[1,'Low'],[2,'Medium'],[3,'High']])}</div>
    <div class="setgroup"><div class="tlabel">Move clips</div>${seg('clips',S.clipsOn===false?'off':'on',[['on','On'],['off','Off']])}
      <div class="hint">Short anime clips for some specials and moments during a round. Needs internet.</div></div>
    <div class="setgroup"><div class="tlabel">Online taunts</div>${seg('taunts',S.tauntsOn===false?'off':'on',[['on','On'],['off','Off']])}</div>
    <div class="setgroup"><div class="tlabel">Repeat clips</div>${seg('cliprepeat',S.clipRepeat==='every'?'every':'first',[['first','First time'],['every','Every round']])}
      <div class="hint">Every clip plays in full the first time. Choose whether it plays again each round.</div></div>
    <div class="setgroup"><div class="tlabel">Vibration on knockouts</div>${seg('vibe',S.vibeOn===false?'off':'on',[['on','On'],['off','Off']])}
      <div class="hint">Android phones only (iPhones don't allow it).</div></div>
    <div class="hint">Saved on this phone. Players, points, pool and difficulty are set per mode on the main menu.</div>`}
    <div class="setgroup"><div class="tlabel">Found a bug?</div>
      ${S.reportOpen?`<textarea id="reportbox" class="reportbox" maxlength="500" rows="4" placeholder="What happened, and what were you doing?" aria-label="Describe the bug">${esc(S.reportText||'')}</textarea>
      <div class="row"><button class="btn small" data-a="reportsend">Send</button><button class="btn ghost small" data-a="reportopen">Cancel</button></div>
      <div class="hint">Sends your message and your device type. Nothing else.</div>`:`<button class="btn ghost small" data-a="reportopen">Report a bug</button>`}
      ${S.reportMsg?`<div class="hint">${esc(S.reportMsg)}</div>`:''}</div>
    ${S.mode==='story' && !['story','setup','modeset'].includes(S.phase)?`<div class="setgroup"><div class="tlabel">Leave this battle</div>
      <div class="row"><button class="btn ghost" data-a="quit" data-v="map">Quit to story map</button><button class="btn ghost" data-a="quit" data-v="home">Quit to home screen</button></div>
      <div class="hint">The battle isn't saved. You can start it again from the story map.</div></div>`:''}
    <div class="row"><button class="btn" data-a="unsel">Done</button></div>
  </div></div>`;
}
// Wide picture across the top of a detail card (only when the character has a picture)
const banner = c => ART[c.id] ? `<div class="mbanner" aria-hidden="true"><img decoding="sync" src="${ART[c.id]}" alt=""></div>` : '';
// Main menu: a slowly scrolling strip of character art (only once pictures have loaded)
// Card detail, centred on screen, when a card is tapped during the draft (or a fighter's info card in battle)
function vSheet(){
  if(S.quitAsk) return quitAsk();
  if(S.settings) return vSettings();
  if(S.phase==='codex') return codexSheet();
  if(S.info) return vInfo();
  if(S.phase!=='draft' || !S.sel) return '';
  const c=BYID[S.sel], p=isOnline()?S.me:turn(), ok=(S.banning?canBan(p,c.id):canPick(p,c.id)) && (!isOnline() || turn()===S.me), verbBtn=S.banning?'Ban':'Confirm';
  if(c.helper) return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    <div class="shead">${seal(c,'lg')}<div><div class="eyebrow">${esc(c.type)}</div><h2>${esc(c.name)}</h2></div><span class="cost">${c.cost}<small>pt</small></span></div>
    <div class="sig"><div class="sname">${esc(c.sig.name)}</div>${esc(c.sig.desc)}</div>
    <div class="pas">Back-pocket helper: doesn't fight, can't be attacked and doesn't take a fighter slot. On the move screen, tap Use on the round you want. It acts first that round, then leaves.</div>
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button>${ok?`<button class="btn team${S.banning?' banbtn':''}" data-a="confirmPick" style="--bc:${pc(p)}">${verbBtn} ${esc(c.short)}</button>`:''}</div>
  </div></div>`;
  const pas=[c.passive, c.mark?MARK_PASSIVE:''].filter(Boolean);
  const notes=notesForCard(c.id, p).filter(n=>n.kind!=='vs' || vsFaces(n,c.id).length);   // only partners this player could afford alongside this card; no matchup against your own team
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in ${glyphCls(c)}" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    ${banner(c)}
    <div class="shead">${seal(c,'lg')}
      <div><div class="eyebrow">${esc(c.type)}</div><h2>${esc(c.name)}</h2></div><span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span></div>
    ${statCells(c)}
    <div class="sig"><div class="sname">${esc(c.sig.name)} <span class="muted">· special, cooldown ${c.sig.cd}</span></div>${esc(c.sig.desc)}</div>
    ${c.selfless?`<div class="pas"><b>Then: ${esc(SELFLESS.name)}</b>: ${esc(SELFLESS.desc)}${selflessOpen()?'':' <span class="muted">🔒 Unlocks when you win Destructive Death in the story.</span>'}</div>`:''}
    ${c.sig2?`<div class="pas"><b>Then: ${esc(c.sig2.name)}</b>: ${esc(c.sig2.desc)} <span class="muted">After it, back to ${esc(c.sig.name)}: the two take turns.${sig2Open(c)?'':` 🔒 Unlocks when you win ${esc((STAGES.find(s=>s.id===c.sig2.lock)||{}).title||'its story battle')}.`}</span></div>`:''}
    ${c.regen?`<div class="pas">Regenerates ${c.regen} HP every round.</div>`:''}
    ${pas.map(x=>`<div class="pas">${esc(x)}</div>`).join('')}
    ${c.splits?splitTree(c):''}
    ${notes.length?`<div class="mnotes"><div class="tlabel">Notes for ${esc(c.short)} in this deal</div>${notes.map(n=>noteHTML(n,c.id)).join('')}</div>`:''}
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button>${ok?`<button class="btn team${S.banning?' banbtn':''}" data-a="confirmPick" style="--bc:${pc(p)}">${verbBtn} ${esc(c.short)}</button>`:''}</div>
  </div></div>`;
}

/* ---------- planning ---------- */
// Which of the player's fighters is open: the one they tapped, else the first without a move
function focusOf(p){
  if(S.focus==='none') return null;
  const a=alive(p).filter(u=>!u.stun);
  if(S.focus && a.some(u=>u.uid===S.focus)) return S.focus;
  const n=a.find(u=>!unitReady(u)); return n?n.uid:null;
}
function moveSummary(u){
  if(u.stun) return 'Stunned · skips this round';
  const pl=S.plans[u.p][u.uid];
  if(!pl||!pl.type) return 'Choose a move';
  const name = pl.type==='attack'?(u.basic?esc(u.basic.name):'Attack'):pl.type==='defend'?'Defend':pl.type==='save'?'Save':esc(u.sig.name);
  if(!needsTarget(u,pl)) return name;
  const t=pl.t&&findU(pl.t);
  return t ? `${name} → ${esc(t.name)}` : `${name} · pick a target`;
}
function fighter(u, open){
  const ready=unitReady(u), pl=S.plans[u.p][u.uid]||{};
  const head=`<div class="fhead">${sealBtn(u)}<button class="fmain" data-a="focus" data-v="${u.uid}" aria-expanded="${open}" ${u.stun?'disabled':''}>
    <span class="tb">${health(u)}<span class="sum${ready?' ok':''}">${ready&&!u.stun?'✓ ':''}${moveSummary(u)}</span></span></button></div>`;
  if(!open) return `<div class="fighter" style="--tc:${pc(u.p)}">${head}</div>`;
  // kept short on purpose: stats and the full special text are one tap away on the fighter's picture
  const mv=(v,k,label,sub,dis)=>`<button data-a="act" data-u="${u.uid}" data-v="${v}" class="${pl.type===v?'on':''}" ${dis?'disabled':''}><span class="mk" aria-hidden="true">${k}</span>${label}${sub?`<small>${sub}</small>`:''}</button>`;
  const opts=targetOptions(u,pl);
  const tgt=x=>`<button class="tg${x.p===u.p?' ally':''}${pl.t===x.uid?' on':''}" data-a="tgt" data-u="${u.uid}" data-v="${x.uid}">
    ${seal(x,'sm')}${esc(x.name)}<span class="${pct(x)<=LOW?'lo':''}">${pct(x)}%</span></button>`;
  return `<div class="fighter open" style="--tc:${pc(u.p)}">${head}<div class="fbody">
    ${statusChips(u,false)}
    <div class="moves">${u.basic?mv('attack',u.basic.k,esc(u.basic.name),esc(u.basic.tag)):mv('attack','攻','Attack',u.selfless?'ignores DEF · reveals you':u.strikes>1?'×'+u.strikes:'')}${u.selfless?mv('save','護','Save',u.saveUsed?'used':'ally takes no damage · once',u.saveUsed||!friends(u.p).some(f=>f!==u)):mv('defend','守','Defend',u.noDefend?'berserk':'',u.noDefend)}${mv('special','技',`<span class="spn">${esc(u.sig.name.split(':')[0])}</span>`,u.cd>0?`<span class="cdn">ready in ${u.cd}</span>`:esc(u.sig.tag),u.cd>0)}</div>
    ${opts.length?`<div class="targets"><span class="tlabel">${isAllyMove(u,pl)?'Ally':'Target'}</span>${opts.map(tgt).join('')}</div>`:''}
  </div></div>`;
}
function vPass(){
  const p=S.planFor;
  return `<div class="pass"><div class="eyebrow">Round ${S.round}</div>
    <div class="big" style="color:${pc(p)}">Hand the phone to ${nm(p)}</div>
    <p class="muted">${S.passScout?`${nm(p)}'s Kasugai Crow is back with a report. Everyone else, look away.`:`${others(p).length>1?'Everyone else':nm(others(p)[0])}, no peeking at their moves.`}</p>
    <button class="btn team" data-a="reveal" style="--bc:${pc(p)}">I'm ${nm(p)}. Show my team</button></div>`;
}
function vPlan(){
  const p=S.planFor, open=focusOf(p), ready=planReady(p), mine=alive(p);
  if(isOnline() && !mine.length) return waitScreen(`Round ${S.round}`, "You're out", 'Your squad has fallen. You can keep watching the others fight.');
  if(isOnline() && S.movesLocked && S.movesLocked[p] && !S.scouting){
    const wait=players().filter(q=>q!==p && alive(q).length && !S.movesLocked[q]);
    return waitScreen(`Round ${S.round}`, 'Moves locked in', `Waiting for ${wait.length?wait.map(q=>nm(q)+awayTag(q)).join(', '):'the others'} to choose…`); }
  // the open fighter needs an enemy target: opponents become tappable
  const ou=open&&findU(open), opl=ou&&S.plans[p][ou.uid]||{}, picking=ou && needsTarget(ou,opl) && !isAllyMove(ou,opl);
  const aimers=e=>mine.filter(m=>{ const q=S.plans[p][m.uid]; return q && q.t===e.uid && needsTarget(m,q) && !isAllyMove(m,q); });
  // knocked-out fighters aren't shown on the move screen (either side)
  const enemyMoment=e=>!e.alive ? {hidden:true} : ({aimed:aimers(e), ...(picking?{tgtFor:ou.uid, picked:opl.t===e.uid}:{})});
  const goal = S.mode==='story' && STAGES[S.stage] ? twistText(STAGES[S.stage]) : finalFight() ? dawnText() : S.series ? fightName() : '';
  const tips = S.round===1 ? tip('moves','For each fighter, pick <b>Attack</b>, <b>Defend</b> (half damage) or their <b>Special</b>, then tap who to hit. When everyone has a move, tap <b>Lock in moves</b>.')
    : S.round===2 ? tip('info','Tap any picture to see that fighter’s stats, special and status. A gold <b>Special ready</b> means that enemy can use their special this round.')
    : tip('red','Health turns <b>red</b> at 25% or less. Finish them off, or <b>Defend</b> to stay alive.');
  return `${topbar(`Round ${S.round}`, `<span style="color:${pc(p)}">${nm(p)}</span>, choose`)}
    ${tips}${awayBanner()}
    ${goal?`<div class="goal">${esc(goal)}${S.twist&&S.twist.survive?` · ${plural(Math.max(0,S.twist.survive-S.round+1),'round')} to go`:''}</div>`:''}
    ${strengthBar(p)}${tauntBar()}
    <div class="planwide"><div class="opps${nPlayers()>2?' many':''}">${enemiesOf(p).filter(q=>alive(q).length).map(q=>teamBlock(q,nPlayers()>2?null:'Opponent',enemyMoment,true,picking?`Tap to target with ${esc(ou.name)}`:'')).join('')}
      ${partnersOf(p).filter(q=>alive(q).length).map(q=>teamBlock(q,`${nm(q)} · your partner`,e=>!e.alive?{hidden:true}:{},true)).join('')}</div>
    ${picking&&aimsTeam(ou)&&opl.type==='special'?`<p class="hint aimhint">${esc(ou.sig.name.split(':')[0])} hits every fighter on the team you aim at.</p>`:''}
    <section class="side"><div class="sidehead"><span class="tname" style="color:${pc(p)}">Your team</span>${S.lastPlans&&S.lastPlans[p]?'<button class="btn ghost small" data-a="repeat">↻ Repeat</button>':''}</div>
      ${S.scouting?crowReport(p):''}<div class="fighters">${alive(p).map(u=>fighter(u,u.uid===open)).join('')}</div>${ambushPick(p)}</section></div>
    ${actionbar(`${pocketChip(p)}<button class="btn team" data-a="lockMoves" ${ready?'':'disabled'} style="--bc:${pc(p)}">${ready?'Lock in moves':`${mine.filter(unitReady).length} of ${plural(mine.length,'fighter')} ready`}</button>`)}`;
}

/* ---------- results ---------- */
// The team drawn on the left of the fight stage: yours (or player 1 when the phone is shared)
const leftSide = () => soloView() ? myP() : 0;
// The fight stage for one playback line: the attacker's picture lunges at the target's, a mark flashes on impact,
// and the health change floats up. Lines with one fighter (regen, poison, specials…) animate just that fighter.
const FX_MARK = {hit:'斬', miss:'避', block:'防', ko:'KO', heal:'癒', revive:'蘇', poison:'毒', stun:'眠', guard:'守', buff:'鍛', special:'技', burn:'陽', spawn:'分'};
function stage(line){
  const by=line.by&&findU(line.by), on=line.on&&findU(line.on), type=line.fx||'', duo=by&&on&&by!==on;
  // breathing style of the fighter acting (their Attack or Special look): colour, kanji mark and drawing
  const style = by && ['hit','ko','burn','special','miss','block'].includes(type) ? styleOf(by, line.move) : null;
  const art = style && ['hit','ko','burn'].includes(type) ? fxArt(style) : '';
  // Teams keep their side of the stage (player 1 left, player 2 right), so a hit back swings the other way
  // instead of the two cards swapping places. "rev" = the actor is on the right, attacking leftwards.
  const rev = duo && by.p!==on.p && by.p!==leftSide();
  const amt=line.t.match(/\[([+-])(\d+%)\]/);
  const pop=amt?`<span class="pop ${amt[1]==='-'?'dmg':'gain'}">${amt[1]==='-'?'−':'+'}${amt[2]}</span>`:'';
  const calm=calmSides(), ring=(u,role)=>role==='on'&&by&&!sameSide(by.p,u.p)&&calm.has(u.p)?waterRing():'';   // the water shows on whoever is being attacked
  const cut=type==='ko' && slicedBy(line,on), dust=crumbleKind(line), act=line.move==='special'&&by?' by-'+by.sk:'';
  const who=(u,role)=>`<div class="st-${role}">${role==='on'&&dust?crumblePic(dust,seal(u,'stg')):role==='on'&&cut?slicePic(u,seal(u,'stg'),cutStyle(line)):seal(u,'stg')}${ring(u,role)}${role==='on'&&line.gone?kDoors:''}${role==='by'?byFx(line):''}${role==='on'?art+pop+targetFx(line):''}${role==='by'&&type==='special'&&style?fxArt(style,'aura'):''}<span class="st-nm" style="color:${pc(u.p)}">${esc(u.name)}</span></div>`;
  if(line.helper){ const h=BYID[line.helper];   // a back-pocket helper acting
    return `<div class="stage fx-${type} solo helperfx" aria-hidden="true"><span class="st-mark">${FX_MARK[type]||''}</span><div class="st-on">${seal(h,'stg')}<span class="st-nm">${esc(h.short)}</span></div></div>`; }
  const mark=`<span class="st-mark">${style&&(type==='hit'||type==='special')?STYLE_KANJI[style]:FX_MARK[type]||''}</span>`;
  const solo=on||by;
  if(line.calm && by) return stageCalm(by);
  return `<div class="stage fx-${type||'none'}${cut||dust?' sliced':''}${line.gone?' goneaway':''}${line.shrink?' shrinking':''}${line.cover?' covering':''}${act} ${duo?'duo':'solo'}${rev?' rev':''}${style?' sty sty-'+style:''}" aria-hidden="true">
    ${duo ? (rev ? who(on,'on')+mark+who(by,'by') : who(by,'by')+mark+who(on,'on')) : solo ? mark+who(solo, on?'on':'by') : mark}</div>`;
}
// A slayer's killing blow on a demon cuts the card in two: the top half slides off (CK)
const slicedBy = (l, t) => { const a=l&&l.by&&findU(l.by); return !!(a && !l.wist && t && t.demon && !slayerSide(BYID[t.id]) && slayerSide(BYID[a.id])); };
// Each breathing style cuts its own way: its colour and angle (css .cut-<style>)
const cutStyle = l => { const a=l&&l.by&&findU(l.by); return a ? styleOf(a, l.move==='special'?'special':'attack') : 'slash'; };
// A demon burned away by the sun turns to ash; one killed by Shinobu turns purple and crumbles
const crumbleKind = l => l && l.fx==='ko' ? (l.resolve?'resolve':l.wist?'wist':l.ash?'ash':'') : '';
const crumblePic = (kind, html) => `<span class="crumble ${kind}"><span class="cr-pic">${html}</span>${rep(10, i=>`<i style="--x:${(i*37)%100}%;--dx:${((i*53)%60)-30}px;--d:${(i%5)*.09}s"></i>`)}</span>`;
const slicePic = (u, html, style='slash') => `<span class="slice cut-${style}"><span class="sl-b">${html}</span><span class="sl-t">${html}</span><i class="sl-line"></i></span>`;
// A special's big moment for this beat (effects.js): over the whole screen, on its first hit (every hit for Tengen)
const SPECIAL_HITS = ['hit','ko','miss','block'];
// Which special a hit belongs to: the nearest announcement above it
function sigFor(l){ for(let i=S.log.indexOf(l);i>=0;i--){ const m=S.log[i]; if(m.fx==='special' && m.by===l.by) return m.sig; } return null; }
function fxName(lines, from){
  const l=lines.find(x=>x.by && x.move==='special' && (SPECIAL_HITS.includes(x.fx) || (x.fx==='stun' && !x.on))), by=l&&findU(l.by); let name=by&&SPECIAL_FX[by.sk];
  if(!name) return null;
  if(name==='annihil' && sigFor(l)!=='annihilation') return null;
  if(name!=='drum') for(let i=from-1;i>=0;i--){ const m=S.log[i]; if(m.by!==l.by) continue; if(m.fx==='special'){ if(m.sig==='ninth') name='ninth'; break; } if(m.move==='special' && SPECIAL_HITS.includes(m.fx)) return null; }
  return name;
}
const beatFx = (lines, from) => { const name=fxName(lines,from); return name ? `<div class="sfx sfx-${name}" aria-hidden="true">${SFX_ART[name]()}</div>` : ''; };
// The big moments of a match: the blow that ends it, a team down to its last fighter, Hantengu breaking apart
function momentOf(lines, to, cur){
  if(lines.some(l=>l.grit)) return {k:'somehow'};
  const hlp=lines.find(l=>l.helper && SFX_ART['h_'+l.helper]); if(hlp) return {k:'h_'+hlp.helper, on:hlp.on};
  if(lines.some(l=>l.merged)) return {k:'merge'};
  if(lines.some(l=>l.sunrise)) return {k:'sunsweep'};
  if(lines.some(l=>l.kind==='drum')) return {k:'tilt'};
  if(lines.some(l=>l.fx==='stun' && l.move==='attack' && l.by && (findU(l.by)||{}).sk==='nakime')) return {k:'biwa'};
  if(lines.some(l=>l.fx==='spawn' && l.on && findU(l.on) && findU(l.on).sk==='hantengu')) return {k:'crack'};
  const ko=lines.filter(l=>l.fx==='ko'); if(!ko.length) return null;
  if(S.final && !S.log.slice(to+1).some(l=>l.fx==='ko')) return {k:'final'};
  for(const p of players()){ const up=S.teams[p].filter(u=>(cur.hp[u.uid]||0)>0);
    if(up.length===1 && ko.some(l=>{ const u=findU(l.on); return u && u.p===p; })) return {k:'lone', u:up[0]}; }
  return null;
}
const momentFx = m => !m ? '' : SFX_ART[m.k] ? `<div class="sfx sfx-${m.k}" aria-hidden="true">${SFX_ART[m.k](m)}</div>`
  : m.k==='final' ? '<div class="sfx sfx-final" aria-hidden="true"></div>'
  : `<div class="sfx sfx-lone" aria-hidden="true"><span style="--tc:${pc(m.u.p)}">${seal(m.u,'sm')}<b>${esc(m.u.name)} stands alone</b></span></div>`;
// One Attack's several strikes as one quick beat: quick lunges, a number per strike
const flurryPct = lines => lines.reduce((a,l)=>a+(+((l.t.match(/\[-(\d+)%\]/)||[])[1]||0)),0);
function stageFlurry(lines){
  const by=findU(lines[0].by), t=findU(lines[0].on), style=styleOf(by,'attack'), rev=by.p!==leftSide(), calm=calmSides(), ring=u=>calm.has(u.p)&&!sameSide(by.p,u.p)?waterRing():'';
  const pops=lines.map((l,i)=>{ const a=l.t.match(/\[-(\d+%)\]/); return `<span class="pop dmg fl" style="--i:${i}">${a?'−'+a[1]:l.fx==='miss'?'miss':'blocked'}</span>`; }).join('');
  const side=(u,r)=>`<div class="st-${r}">${seal(u,'stg')}${r==='on'?ring(u):''}${r==='on'?fxArt(style)+pops+(by.sk==='typezero'?artSvg('typezero'):''):''}<span class="st-nm" style="color:${pc(u.p)}">${esc(u.name)}</span></div>`;
  return `<div class="stage duo flurry sty sty-${style}${rev?' rev':''}" style="--n:${lines.length}" aria-hidden="true">${rev?side(t,'on')+side(by,'by'):side(by,'by')+side(t,'on')}</div>`;
}
function flurrySummary(lines){
  const by=findU(lines[0].by), t=findU(lines[0].on), n=lines.length, sum=flurryPct(lines);
  return fmtLog(`${by.name} strikes ${t.name} ${n===2?'twice':n+' times'}${sum?` [-${sum}%]`:''}.`);
}
// Drawn on the attacker: Makomo's afterimage, Michikatsu's shadow of what he becomes, the Swamp Demon's dark ripple
const byFx = l => { const u=l.by&&findU(l.by); if(!u || l.move!=='special' || l.fx!=='hit') return '';
  return u.sk==='makomo' ? `<span class="ghostcard">${seal(u,'stg')}</span>` : u.sk==='michikatsu' ? `<svg class="tfx sixeyes" viewBox="0 0 100 100" aria-hidden="true">${rep(6, i=>`<ellipse class="tfi" style="--d:${i*.08}s" cx="${i%2?68:32}" cy="${18+Math.floor(i/2)*26}" rx="13" ry="6"/>`)}</svg>` : u.sk==='swamp' ? `<svg class="tfx ripple" viewBox="0 0 100 100" aria-hidden="true">${rep(3, i=>`<ellipse class="tfi" style="--d:${i*.12}s" cx="50" cy="84" rx="${22+i*14}" ry="${6+i*3}"/>`)}</svg>` : ''; };
// Akaza's Compass Needle opens under his target, Doma's Frozen Lotus around each of his
const artSvg = k => `<svg class="tfx" viewBox="0 0 100 100" aria-hidden="true">${TARGET_ART[k]()}</svg>`;
const targetFx = l => { const by=l.by&&findU(l.by);
  const k=l.knit?'knit':l.ate?'crack':l.hid?'charm':l.trap?'wires':l.kind==='pot'?'vase':''; if(k) return artSvg(k); if(by && by.sk==='tamayo' && l.fx==='heal') return `<svg class="tfx" viewBox="0 0 100 100" aria-hidden="true">${TARGET_ART.tamayo()}</svg>`;
  if(by && by.sk==='yahaba' && l.move==='special' && l.fx==='stun') return artSvg('yahaba');
  if(!by || l.move!=='special' || !['hit','poison'].includes(l.fx)) return '';
  return by.sk==='akaza' ? (sigFor(l)==='annihilation' ? '' : compassFx()) : by.sk==='doma' ? lotusFx() : TARGET_ART[by.sk] && !['tamayo','knit','crack','charm','wires','vase'].includes(by.sk) ? `<svg class="tfx" viewBox="0 0 100 100" aria-hidden="true">${TARGET_ART[by.sk]()}</svg>` : ''; };
// The teams under Dead Calm at this moment of the playback (it lasts the whole round)
function calmSides(){
  const p=S.play, s=new Set(); if(!p || p.done || !p.steps) return s;
  S.log.slice(0,p.steps[p.k][1]+1).forEach(l=>{ const b=l.calm&&findU(l.by); if(b) players().filter(q=>sameSide(q,b.p)).forEach(q=>s.add(q)); });
  return s;
}
const kDoors = '<span class="kdoor l"></span><span class="kdoor r"></span>';   // Nakime's Castle Shift: doors close over the one fighter
// Dead Calm: a ring of still water closes around Giyu and everyone on his side
const waterRing = () => `<span class="waterring" aria-hidden="true"><i></i><i></i><i></i></span>`;
function stageCalm(by){
  const team=players().filter(q=>sameSide(q,by.p)).flatMap(q=>alive(q));
  return `<div class="stage calmstage" aria-hidden="true">${waterRing()}<div class="calmteam">${team.map(u=>seal(u,'stg')).join('')}</div></div>`;
}
// Kagaya's Final Resolve: one beat for everyone who awakens, the old picture burning away into the Mark
function awakenBeat(line){
  const us=line.was.map(w=>({w, u:findU(w.uid)})).filter(x=>x.u);
  return `<div class="awaken${us.length>3?' many':''}"><span class="awk" aria-hidden="true">痣</span>
    <div class="awrow">${us.map(({w,u},i)=>`<span class="awc" style="--i:${i}"><span class="awpic">${ART[w.id]?`<img class="old" src="${ART[w.id]}" alt="">`:''}${ART[u.id]?`<img class="new" src="${ART[u.id]}" alt="">`:`<i>${u.g}</i>`}</span>${us.length>3?'':`<small>${esc(u.name)}</small>`}</span>`).join('')}</div>
    <b class="awt">${fmtLog(line.t)}</b></div>`;
}
// Fighters change card when the round resolves, but playback draws them as they were until their awakening beat
function beforeAwake(draw){
  const p=S.play, undo=[];
  if(p && !p.done && p.steps && S.log) S.log.slice(p.steps[p.k][1]+1).forEach(l=>{ const g=l.ate&&findU(l.on); if(g){ undo.push([g,{ate:true}]); g.ate=false; } });   // Genya changes on his own beat
  if(p && !p.done && p.steps && S.log) S.log.slice(p.steps[p.k][1]+1).forEach(l=>(l.was||[]).forEach(w=>{ const u=findU(w.uid); if(!u) return;
    undo.push([u,{id:u.id, name:u.name, g:u.g, sk:u.sk, mark:u.mark, max:u.max}]); Object.assign(u,w); }));
  // Mark Tanjiro shows his Transparent World picture from the moment he strikes until the round ends
  if(p && !p.done && p.steps && S.log) S.log.slice(0,p.steps[p.k][1]+1).forEach(l=>{ const u=l.transparent&&findU(l.on); if(u){ undo.push([u,{tw:false}]); u.tw=true; } });
  try{ return draw(); } finally { undo.reverse().forEach(([u,o])=>Object.assign(u,o)); }
}
// Special-move cut-in: the fighter's art slides across a slanted band with the move's name and their line,
// from the left for the team on the left of the stage, from the right for everyone else
function cutin(u, clip, line){
  const sg=sigOfLine(u,line);   // the special this beat is for, not the one now waiting
  const style=styleOf(u,'special'), right=u.p!==leftSide();
  return `<div class="cutin sty sty-${style}${right?' right':''}${clip?' hasclip':''}" style="--tc:${pc(u.p)}" aria-hidden="true">${line&&line.flare?'<span class="markflare2"><b>痣</b></span>':''}
    ${clip?clipVideo(clip)+'<span class="cbars"></span><span class="lines"></span><span class="cflash"></span>':'<span class="lines"></span>'}
    <div class="band"><span class="cimg">${ART[u.id]?`<img decoding="sync" src="${ART[u.id]}" alt="">`:`<span class="ck">${u.g}</span>`}</span>
      <div class="ctext"><span class="cwho" style="color:${pc(u.p)}">${esc(u.name)}</span><span class="cmove">${esc(sg.name)}</span>${(sg.quote||BYID[u.id].sig.quote)?`<span class="cquote">“${esc(sg.quote||BYID[u.id].sig.quote)}”</span>`:''}</div></div>
    <span class="ckanji">${STYLE_KANJI[style]||'技'}</span></div>`;
}
// A move clip: muted, plays once inline (app.js keeps the same element across redraws of the beat, using data-k)
const clipWho = c => c.who || findU(c.uid);   // a fighter, or a helper's stand-in
const clipVideo = c => clipIsPic(c.src) ? `<img class="cvid" data-k="${esc(c.key)}" src="${esc(clipSrc(c.src))}" alt="">` : `<video class="cvid" data-k="${esc(c.key)}" src="${esc(clipSrc(c.src))}"${ART[clipWho(c).id]?` poster="${ART[clipWho(c).id]}"`:''} muted playsinline webkit-playsinline autoplay preload="auto" disablepictureinpicture></video>`;
const CLIP_KANJI = {regen:'再', heal:'癒', poison:'毒', defend:'守', ko:'討', fall:'倒', revive:'蘇', split:'分'};
// A beat with a move clip that isn't a special (regen, heal, guard, knockout…): the clip with who and what over it
function clipBeat(c, line){
  const u=clipWho(c);
  const style=styleOf(u,c.act==='attack'?'attack':'special');
  return `<div class="clipbox act-${c.act}${u.p!==leftSide()?' right':''}" style="--tc:${pc(u.p)}">${clipVideo(c)}<span class="cbars"></span><span class="cflash"></span>
    <span class="cstamp sty sty-${style}">${u.helper?BYID[u.id].g:CLIP_KANJI[c.act]||STYLE_KANJI[style]||'技'}</span>
    <span class="cliptag"><b style="color:${pc(u.p)}">${esc(u.name)}</b>${CLIP_ACTS[c.act]?`<i>${CLIP_ACTS[c.act]}</i>`:''}</span></div><span>${fmtLog(line.t)}</span>`;
}
// One beat for a special that hits several enemies: the attacker strikes once, every target recoils together with
// its own damage number, and any it knocks out topple over
function stageGroup(lines){
  const by=findU(lines[0].by), style=styleOf(by,'special'), rev=by.p!==leftSide();
  const hits=lines.filter(l=>GROUP_FX.includes(l.fx));
  const target=l=>{ const t=findU(l.on), amt=l.t.match(/\[([+-])(\d+%)\]/), ko=lines.some(m=>m.fx==='ko'&&m.on===l.on);
    const koL=lines.find(m=>m.fx==='ko'&&m.on===l.on), cut=ko && slicedBy(koL,t), dust=crumbleKind(koL);
    return `<div class="st-on${ko?(cut||dust?' sliced':' koed'):''}${l.fx!=='hit'?' missed':''}">${dust?crumblePic(dust,seal(t,'stg')):cut?slicePic(t,seal(t,'stg'),cutStyle(koL)):seal(t,'stg')}${calmSides().has(t.p)?waterRing():''}${targetFx(l)}${l.fx==='hit'?fxArt(style):''}${amt?`<span class="pop dmg">−${amt[2]}</span>`:l.fx!=='hit'?`<span class="pop">${l.fx==='miss'?'miss':'blocked'}</span>`:''}<span class="st-nm" style="color:${pc(t.p)}">${esc(t.name)}</span></div>`; };
  const attacker=`<div class="st-by">${seal(by,'stg')}<span class="st-nm" style="color:${pc(by.p)}">${esc(by.name)}</span></div>`;
  const row=`<div class="st-targets">${hits.map(target).join('')}</div>`, mark=`<span class="st-mark">${STYLE_KANJI[style]}</span>`;
  return `<div class="stage group duo fx-hit sty sty-${style}${rev?' rev':''}" aria-hidden="true">${rev?row+mark+attacker:attacker+mark+row}</div>`;
}
// During playback each team is a slim row of small portraits with a thin health line, so the stage is the focus.
// `moment` gives HP at this beat; `involved` = uids in the current action.
function miniTeam(p, moment, involved){
  const us=S.teams[p].map(u=>({u,o:moment(u)})).filter(x=>!x.o.hidden);
  return `<div class="mini" style="--tc:${pc(p)}">${us.map(({u,o})=>{
    const hp=o.hp===undefined?u.hp:o.hp, up=hp>0, h=up?pct(u,hp):0, from=o.from===undefined?h:Math.max(0,pct(u,o.from));
    return `<div class="m${up?'':' dead'}${involved.has(u.uid)?' inv':''}${o.flash?' '+o.flash:''}${o.calm?' calm':''}${o.lost?' lost':''}${o.smolder?' smolder':''}${o.hid?' talisman':''}">${sealBtn(u,'mini')}
      <span class="mb${up&&h<=LOW?' low':''}"><i class="${from!==h?'drain':''}" style="width:${h}%;--from:${from}%"></i></span></div>`; }).join('')}</div>`;
}
// One line for a group attack: "Frozen Lotus hits 4 enemies · 1 knocked out"
function groupSummary(lines){
  const by=findU(lines[0].by), n=lines.filter(l=>l.fx==='hit').length, ko=lines.filter(l=>l.fx==='ko').length;
  return `${seal(by,'ls')}<b>${esc(by.sig.name.split(':')[0])}</b> hits ${plural(n,'enemy').replace('enemys','enemies')}${ko?` · <b class="dmg">${ko} knocked out</b>`:''}`;
}
// Knockouts and hits of 30%+ shake the stage
const bigHit = line => line.fx==='ko' || (/\[-(\d+)%\]/.exec(line.t)||[])[1] >= 30;
const COPY_ICON='<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
// Win screen: every round of the match (what each player chose, then what happened), with a Copy button for the text
function matchLogPanel(){
  const ml=S.matchLog||[]; if(!ml.length) return `<details class="panel" id="finallog"><summary>Final round</summary>${logHTML()}</details>`;
  return `<section class="panel matchlog"><div class="mlhead"><span class="tlabel">Battle log</span>
      <button class="btn ghost small copylog" data-a="copylog" aria-label="Copy the full battle log">${COPY_ICON}${S.logCopied?'Copied ✓':'Copy'}</button></div>
    <details id="finallog"><summary>All ${plural(ml.length,'round')}</summary>
    ${ml.map(r=>`<div class="mlround"><div class="mlr">Round ${r.r}</div>
      ${r.moves.map(m=>`<div class="mlmoves" style="--tc:${pc(m.p)}"><b>${nm(m.p)}</b> ${m.picks.map(x=>esc(x)).join(' · ')}${m.helpers.length?` · used ${esc(m.helpers.join(', '))}`:''}</div>`).join('')}
      <div class="log">${r.lines.map(l=>`<div class="${l.c}">${fmtLog(l.t)}</div>`).join('')}</div></div>`).join('')}
    </details></section>`;
}
const logHTML = () => `<div class="log">${S.log.filter(l=>l.c!=='r').map(l=>`<div class="${l.c}">${fmtLog(l.t)}</div>`).join('')}</div>`;
// The round plays back one log line at a time (S.play.k = the line being shown); tiles show HP at that moment
// The playback beat being shown: its log lines, any clip, and each fighter's HP at this moment (also drawn by the TV board)
function playBeat(){
  const done=!S.play||S.play.done, steps=S.play&&S.play.steps;
  const [from,to]=done?[S.log.length-1,S.log.length-1]:steps[S.play.k], k=to, cur=S.log[to], prev=S.log[Math.max(0,from-1)];
  const lines=S.log.slice(from,to+1), group=to>from, flurry=group&&lines[0].move==='attack', clip=!done&&!group&&S.play.clip&&clipWho(S.play.clip)?S.play.clip:null;
  // the fighter acting: the line's attacker, or the one whose name starts it
  const actor=done?null:(cur.by&&findU(lines[0].by))||allUnits().filter(u=>cur.t.startsWith(u.name)).sort((a,b)=>b.name.length-a.name.length)[0];
  // what stays on screen for the rest of the round: Dead Calm's water around a team, fighters Nakime has sent away
  const calm=calmSides(), lost=new Set(), hid=new Set();
  if(!done) S.log.slice(0,from).forEach(l=>{ if(l.gone) lost.add(l.on); });
  if(!done) S.log.slice(0,to+1).forEach(l=>{ if(l.hid) hid.add(l.on); });
  const burning = !done && S.mode!=='story' && S.round>=sunRise();   // demons smoulder once the sun is up
  const moment = u => done ? {} : cur.hp[u.uid]===undefined ? {hidden:true} : {hid:hid.has(u.uid), smolder:burning&&u.demon&&!sunSafe(u), calm:calm.has(u.p)&&lines.some(l=>l.on===u.uid&&l.by&&findU(l.by)&&!sameSide(findU(l.by).p,u.p)), lost:lost.has(u.uid), hp:cur.hp[u.uid], from:prev.hp[u.uid]??cur.hp[u.uid],
    flash: lines.some(l=>l.ko===u.uid) ? 'ko' : prev.hp[u.uid]===undefined ? 'spawn' : cur.hp[u.uid]<prev.hp[u.uid] ? 'hit' : cur.hp[u.uid]>prev.hp[u.uid] ? 'heal' : actor===u ? 'acting' : ''};
  // fighters in this beat (attacker and targets) stay bright in the slim team rows; the rest fade back
  const involved=new Set(lines.flatMap(l=>[l.by,l.on,l.ko]).filter(Boolean));
  return {done, k, from, to, flurry, cur, prev, lines, group, clip, actor, moment, involved, step:done?0:S.play.k, total:done?0:steps.length-1};
}
function vResult(){
  const {done, k, from, to, flurry, cur, prev, lines, group, clip, moment, involved, step, total}=playBeat();
  // vs computer the screen is yours, so label the teams from your side; two players share it, so keep names
  const solo=soloView(), me=myP(), them=[...enemiesOf(me), ...partnersOf(me)], multi=nPlayers()>2;
  const waiting = isOnline() && S.readyNext && S.readyNext[me] && !S.final;
  const slow = them.filter(q=>S.readyNext&&!S.readyNext[q]);
  const next = S.final ? '<button class="btn" data-a="finish">See who won</button>'
    : waiting ? `<button class="btn" disabled>Waiting for ${slow.length?slow.map(q=>nm(q)+(S.away&&S.away[q]?' (away)':'')).join(', '):'the others'}…</button>` : '<button class="btn" data-a="next">Next round</button>';
  return `${topbar(`Round ${S.round}${done?'':` · ${step} of ${total}`}`, done?'What happened':'The clash')}
    ${done?'':tip('clash','The round plays out one move at a time, fastest first. Tap <b>Skip</b> if you’re in a hurry.')}${awayBanner()}
    ${strengthBar(me, done?undefined:u=>cur.hp[u.uid], done?undefined:u=>prev.hp[u.uid])}
    <div class="reswide${done?' done':''}${!done&&!k&&S.round===1?' opener':''}"><div class="rcol">${them.map(q=>done?teamBlock(q,solo&&!multi?'Opponent':null,moment):miniTeam(q,moment,involved)).join('')}</div>
    ${done?vsDivider():flurry?`<div class="now${lines.some(bigHit)?' big':''}" aria-live="polite">${stageFlurry(lines)}<span>${flurrySummary(lines)}</span></div>`:group?`<div class="now${lines.some(bigHit)?' big':''}${lines.some(l=>l.fx==='ko')?' k':''}" aria-live="polite">${stageGroup(lines)}<span>${groupSummary(lines)}</span></div>`
      :k&&cur.fx==='say'&&findU(cur.by)?`<div class="now saybeat" aria-live="polite" style="--tc:${pc(findU(cur.by).p)}">${seal(findU(cur.by),'stg')}<div><span class="sayn">${esc(findU(cur.by).name)}</span><span class="sayq">“${esc(cur.t)}”</span></div></div>`
      :k&&cur.fx==='awaken'?`<div class="now awakebeat" aria-live="polite">${awakenBeat(cur)}</div>`
      :k&&cur.fx==='special'&&findU(cur.by)?`<div class="now cut${clip?' clip':''}" aria-live="polite">${cutin(findU(cur.by),clip,cur)}<span class="sr">${fmtLog(cur.t)}</span></div>`
      :k&&clip?`<div class="now clipbeat${bigHit(cur)?' big':''}" aria-live="polite">${clipBeat(clip,cur)}</div>`
      :k?`<div class="now ${cur.c}${bigHit(cur)?' big':''}" aria-live="polite">${stage(cur)}<span>${fmtLog(cur.t)}</span></div>`
      :`<div class="now intro" aria-live="polite"><span class="ir">Round ${S.round}</span><span class="ig">Fight!</span></div>`}
    <div class="rcol">${done?teamBlock(me,solo?'Your team':null,moment):miniTeam(me,moment,involved)}</div></div>
    ${done?`<div class="panel"><div class="mlhead"><span class="tlabel">Round log</span>${(S.matchLog||[]).length?`<button class="btn ghost small copylog" data-a="copyround" aria-label="Copy this round's log">${COPY_ICON}${S.logCopied?'Copied ✓':'Copy'}</button>`:''}</div>${logHTML()}</div>`:''}
    ${done||!k?'':beatFx(lines,from)+momentFx(momentOf(lines,to,cur))}${actionbar(done ? next : '<button class="btn ghost" data-a="skip">Skip</button>')}`;
}
// MVP of the match plus a few awards, from S.stats (see tallyRound in engine.js)
function mvpPanel(){
  const all=allUnits().filter(u=>!u.spawn || S.stats[u.uid]).map(u=>({u, s:S.stats[u.uid]||{dmg:0,kos:0,heal:0,best:0}}));
  if(!all.length) return '';
  const top=(f)=>all.slice().sort((a,b)=>f(b.s)-f(a.s))[0];
  const mvp=top(mvpScore); if(!mvpScore(mvp.s)) return '';
  const line=s=>[s.dmg?`${s.dmg} damage`:'', s.kos?plural(s.kos,'knockout'):'', s.heal?`${s.heal} healed`:''].filter(Boolean).join(' · ');
  const award=(label,x,val)=>x&&val?`<div class="award">${seal(x.u,'sm')}<span><b>${label}</b> ${esc(x.u.name)} · ${val}</span></div>`:'';
  const dm=top(s=>s.dmg), ko=top(s=>s.kos), bh=top(s=>s.best), hl=top(s=>s.heal);
  return `<section class="mvp" style="--tc:${pc(mvp.u.p)}"><div class="mvpmain">${seal(mvp.u,'lg')}<div><div class="tlabel">Match MVP</div>
    <div class="mvpname">${esc(mvp.u.name)}</div><div class="muted">${line(mvp.s)}</div></div></div>
    <div class="awards">${award('Most damage',dm,dm.s.dmg?`${dm.s.dmg}`:'')}${award('Most knockouts',ko,ko.s.kos?`${ko.s.kos}`:'')}${award('Biggest hit',bh,bh.s.best?`${bh.s.best}`:'')}${award('Best healer',hl,hl.s.heal?`${hl.s.heal} HP`:'')}</div></section>`;
}
// A character from each arc, faded into its chapter card on the story map
const ARC_ART = {dream1:['tanjuro'], dream2:['kanae'], dream3:['michikatsu'], dream4:['enmu'], dream5:['tanjiro'], six:['yoriichi'], prologue:['sabito'], asakusa:['tamayo'], tsuzumi:['kyogai'], natagumo:['rui'], mugen:['rengoku'], district:['tengen'],
  swordsmith:['muichiro_mark'], castle:['nakime'], flashback:['yoriichi'], dawn:['muzan_final']};
// Arcs that come back as several chapters (CK): the art for each part, in order
const CHAPTER_ART = {castle:['nakime','akaza','kokushibo'], flashback:['kanae','yoriichi_old','yoriichi']};
// Story map: a winding path through the arcs. Each battle is a node with its stars; tap one to open its details
// (squads, twist, star goals, Play / Draft replay). It opens on the next battle to play.
const starRow = (n, of=3) => `<span class="stars" aria-label="${n} of ${of} stars">${Array.from({length:of},(_,i)=>`<i class="${i<n?'on':''}">★</i>`).join('')}</span>`;
// The campaigns this phone has opened, as tabs at the top of the story map
function campaignTabs(){ const t=[['main','The Slayer’s Journey']]; if(dreamOpen()) t.push(['dream','The Endless Dream']); if(sixOpen()) t.push(['six','Earned Every Star']);
  return t.length>1 ? seg('campaign',S.campaign||'main',t) : ''; }
// Nine Hashira: tap fighters in the order they'll fight. The first three start; whoever's left follows in the list's order.
function vOrder(){
  const st=STAGES[S.stage], o=S.waveOrder||[];
  return `${topbar('The last battle','Choose your order')}
    <p class="hint">The first ${st.waves} fight. When one falls, the next arrives. Anyone still waiting charges in when Muzan is nearly finished. Tap to set the order.</p>
    <div class="grid orderlist">${st.mine.map(id=>{ const i=o.indexOf(id), c=BYID[id];
      return `<button class="ocard${i>=0?' on':''}${i>=0&&i<st.waves?' first':''}" data-a="orderpick" data-v="${id}">${seal(c,'lg')}<b>${esc(c.short)}</b>${i>=0?`<span class="onum">${i+1}</span>`:''}</button>`; }).join('')}</div>
    ${actionbar(`<button class="btn" data-a="orderstart">${o.length?'Begin':'Begin in this order'}</button>`)}`;
}
// The Hashira Ceremony: earned by beating Yoriichi vs the Six
const TITLES = ['Water','Flame','Thunder','Wind','Stone','Mist','Love','Serpent','Sound','Insect','Flower','Beast','Moon','Sun'];
function vCeremony(){
  const k=BYID.kagaya, name=esc(playerName()||'my child');
  const line=(t)=>`<p class="cline">${t}</p>`;
  return `<div class="ceremony">${seal(k,'lg')}<div class="eyebrow">The Ubuyashiki Estate</div>
    ${line('Thank you for coming, my child.')}${line('You’ve stood in every battle of this long night, and earned every star.')}${line('The Corps has only ever been as strong as those who refuse to give up.')}
    ${S.titleDone?`${line(`From this day, you are the <b>${esc(hashiraTitle())} Hashira</b>.`)}${line(`Thank you, ${name}. My child. Please, stay well.`)}<p class="muted">Your title now shows on your wins and online, and the Sunrise Theme is yours.</p>${actionbar('<button class="btn" data-a="home">Home</button>')}`
      :`<div class="tlabel">Choose your title</div><div class="titles">${seg('titlepick',S.title||'',TITLES.map(t=>[t,t]))}</div>${S.title?`<p class="cline"><b>${esc(S.title)} Hashira ${name}</b></p>`:''}${actionbar(`<button class="btn" data-a="titlesave" ${S.title?'':'disabled'}>Accept the title</button>`)}`}</div>`;
}
function vStory(){
  const won=storyWon(), stars=totalStars(), next=nextStage(); let arc='', html='', start=0; const parts={};
  STAGES.forEach((st,i)=>{
    if(st.arc!==arc){ if(arc) html+='</div></section>'; arc=st.arc; start=i;
      let end=i; while(end+1<STAGES.length && STAGES[end+1].arc===arc) end++;   // this chapter: a run of battles in one arc
      const part=parts[arc]=(parts[arc]||0)+1, many=STAGES.filter((x,k)=>x.arc===arc && k>0 && STAGES[k-1].arc!==arc).length+(STAGES[0].arc===arc?1:0)>1;
      const mine=STAGES.map((x,k)=>[x,k]).filter(([x,k])=>k>=i && k<=end), wonHere=mine.filter(([x,k])=>stageCleared(k)).length;
      const pick=CHAPTER_ART[arc]&&CHAPTER_ART[arc][part-1], current=mine.some(([x,k])=>k===next), art=(pick?[pick]:ARC_ART[st.arc]||[]).filter(id=>ART[id]);
      html+=`<section class="chap arc-${st.arc}${current?' current':''}${wonHere===mine.length?' done':''}">
        ${art.length?`<span class="chapart" aria-hidden="true">${art.map(id=>`<img decoding="sync" src="${ART[id]}" alt="">`).join('')}</span>`:''}
        <div class="chaphead"><span class="chapk">${ARCS[st.arc].g}</span><b>${esc(ARCS[st.arc].title)}${many?` · Part ${part}`:''}</b>
          <span class="chapprog">${wonHere===mine.length?'✓ Complete':current?'Now playing':`${wonHere} of ${mine.length} won`}</span></div><div class="chaprows">`; }
    const open=stageUnlocked(i), clear=stageCleared(i), sel=S.storySel===i, unl=STAGE_UNLOCKS[st.id]||[];
    html+=`<div class="srow${clear?' clear':''}${open?'':' locked'}${sel?' sel':''}${st.arc==='flashback'?' flash':''}">
      <button class="srowbtn" data-a="storysel" data-v="${i}" ${open?'':'disabled'} aria-expanded="${sel}">
        <span class="snum">${clear?'✓':open?i+1:'🔒'}</span>
        <span class="sinfo"><b>${esc(st.title)}</b>
          <span class="sfaces"><span class="muted">vs</span>${st.enemy.map(id=>seal(BYID[id],'xs')).join('')}${clear&&starsOn()?starRow(stageStars(st.id)):''}</span></span>
        ${unl.length?`<span class="sunl"><small>Unlocks</small><span>${unl.slice(0,3).map(id=>seal(BYID[id],'xs')).join('')}${unl.length>3?`<i>+${unl.length-3}</i>`:''}</span></span>`:''}
      </button>${sel&&open?stageDetail(st,i,clear):''}</div>`;
  });
  html+='</div></section>';
  return `${topbar('Story mode', S.campaign==='dream'?'The Endless Dream':S.campaign==='six'?'Earned Every Star':'The Slayer’s journey')}
    ${campaignTabs()}<div class="storytotals"><span><b>${won}</b> of ${STAGES.length} battles won</span>${stars&&starsOn()?`<span class="st3">${starRow(1,1)} <b>${stars}</b> of ${STAGES.length*3}</span>`:''}</div>
    <div class="chapters">${html}</div>`;
}
function stageDetail(st,i,clear){
  const tw=twistText(st), n=stageStars(st.id), unl=STAGE_UNLOCKS[st.id]||[];
  return `<div class="pcard"><span class="splace">${esc(st.place)}</span><span class="sblurb">${esc(st.blurb)}</span>
    ${tw||st.boosts?`<span class="stags">${tw?`<span class="stwist">${esc(tw)}</span>`:''}${(st.boosts||[]).map(b=>`<span class="stwist ${b.side?'foe':'ally'}">${esc(b.label)}</span>`).join('')}</span>`:''}
    <span class="sseals">${st.mine.map(id=>seal(BYID[id],'sm')).join('')}<span class="svs">vs</span>${st.enemy.map(id=>seal(BYID[id],'sm')).join('')}</span>
    ${unl.length&&!clear?`<span class="unlpreview"><small>Win to unlock</small>${unl.map(id=>`<span>${seal(BYID[id],'sm')}<b>${esc(BYID[id].short)}</b></span>`).join('')}</span>`:''}
    ${clear&&starsOn()?`<div class="goals"><span class="tlabel">Star chase</span>${starGoals(st).map((g,k)=>`<span class="${goalsGot(st.id)[k]?'got':''}">★ ${esc(g)}</span>`).join('')}</div>`:''}
    <span class="sbtns"><button class="btn small" data-a="stage" data-v="${i}">${clear?'Play again':i===nextStage()?'Continue':'Play'}</button>${clear?`<button class="btn ghost small" data-a="stagedraft" data-v="${i}">Draft replay · ${stageBudget(st)} pts</button>`:''}</span></div>`;
}
// End credits after the finale: rolls up the screen (tap Skip to jump to the end); the buttons stay at the bottom
function vCredits(){
  const people=FINALE_SURVIVORS.filter(id=>BYID[id]);
  return `<div class="credits" data-a="creditsend"><span class="particles p-ember" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="--x:${(i*37)%100}%;--d:${(i*0.73)%6}s;--s:${0.6+(i%5)*0.15}"></i>`).join('')}</span>
    <div class="roll${S.creditsDone?' done':''}">
      <span class="ckanji" aria-hidden="true">滅</span>
      <h1>Slayer Squad</h1>
      <p class="cline">Built by <b>Charles Kowou</b></p>
      <p class="cline">Inspired by <b>Amelia Gray</b></p>
      <div class="cblock"><div class="eyebrow">They lived to see the sun</div>
        <div class="cseals">${people.map(id=>`<span>${seal(BYID[id],'lg')}<small>${esc(BYID[id].short)}</small></span>`).join('')}</div></div>
      <div class="cblock"><div class="eyebrow">In memory of</div>
        <div class="cseals fallen">${FINALE_FALLEN.filter(id=>BYID[id]).map(id=>`<span>${seal(BYID[id],'lg')}<small>${esc(BYID[id].name)}</small></span>`).join('')}</div></div>
      <div class="cblock"><p class="muted">A fan game made with love. Demon Slayer: Kimetsu no Yaiba is the work of Koyoharu Gotouge.</p></div>
      <p class="cthanks">Thank you for playing.</p>
    </div></div>
    ${actionbar(`<button class="btn ghost" data-a="storymap">Story map</button>${(S.campaign||'main')==='main'?'<button class="btn" data-a="dreamstart">Something stirs…</button>':'<button class="btn" data-a="home">Home</button>'}`)}`;
}
// Particles drifting over each arc's scene (embers, snow, petals…)
const ARC_FX = {dream1:'petal', dream2:'petal', dream3:'ember', dream4:'dust', dream5:'ember', six:'ember', prologue:'snow', asakusa:'petal', flashback:'ember', tsuzumi:'dust', natagumo:'thread', mugen:'ember', district:'petal', swordsmith:'leaf', castle:'dust', dawn:'ember'};
// The scene before a story battle: allies speak from the left, enemies from the right, the line types itself out.
// Tap to finish the line, tap again for the next. After the last line, a versus card shows both squads and the twist.
// Scene pictures found in img/scenes/ (app.js fills this at startup)
const SCENE_ART = {};
const placeStyle = st => { const src=PLACE_ART[st.id]||PLACE_ART[st.arc]; return src ? `style="--place:url('${src}')" data-place="1" ` : ''; };
// Place pictures behind the cutscenes: a battle's own (img/places/<battle id>.jpg), else its arc's (app.js fills this)
const PLACE_ART = {};
// A place's name for Settings: the battle's place, or the arc's title
const placeName = id => { const st=ALL_STAGES.find(s=>s.id===id); return st ? st.place.split(',')[0] : ARCS[id] ? ARCS[id].title : id; };
function vScene(){
  const st=STAGES[S.stage], lines=st.scene;
  const fx=`<span class="particles p-${ARC_FX[st.arc]||'dust'}" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="--x:${(i*37)%100}%;--d:${(i*0.73)%6}s;--s:${0.6+(i%5)*0.15}"></i>`).join('')}</span>`;
  const head=S.sceneFinale ? `<div class="scenetop"><div><div class="eyebrow">Finale</div><div class="title">${S.campaign==='dream'?'Morning':'After the Dawn'}</div><div class="splace">The Kamado home${S.campaign==='dream'?'':', and everyone who made it'}</div></div>
      <span class="topbtns"><button class="btn ghost small gearmini" data-a="settings" aria-label="Settings">⚙</button><button class="btn ghost small" data-a="sceneskip">Skip</button></span></div>`
    : `<div class="scenetop"><div><div class="eyebrow">${esc(ARCS[st.arc].title)} · ${S.sceneMid?`Round ${S.round}`:`Battle ${S.stage+1} of ${STAGES.length}`}</div><div class="title">${esc(st.title)}</div><div class="splace">${esc(st.place)}</div></div>
      <span class="topbtns"><button class="btn ghost small gearmini" data-a="settings" aria-label="Settings">⚙</button><button class="btn ghost small" data-a="sceneskip">Skip</button></span></div>`;
  if(S.sceneUnlock){   // after the ending scene: what this win unlocked
    return `<div ${placeStyle(st)}class="scene arc-${st.arc} vscard unlockcard" data-a="scenenext"><span class="lbox t" aria-hidden="true"></span>${fx}${head}
      <div class="unlocktitle"><span class="eyebrow">Battle won</span>${starsOn()?`${starRow(S.starsGot||1)}
        <div class="goals">${starGoals(st).map((g,k)=>`<span class="${(S.goalsNow||[])[k]?'got':''}">★ ${esc(g)}</span>`).join('')}</div>
        ${(S.starsGot||0)>(S.starsBest||0)&&S.starsBest?'<span class="muted">New best!</span>':''}`:''}
        ${S.newUnlocks&&S.newUnlocks.length?'<b>You have unlocked</b>':''}</div>
      ${(()=>{ const all=S.newUnlocks||[], at=Math.min(S.unlockAt||0, all.length-1), id=all[at]; if(!id) return '';   // one at a time: tap for the next
        return `<div class="ulist one"><span class="ucard big" key="${id}">${seal(BYID[id],'lg')}<b>${esc(BYID[id].name)}</b><small>${esc(BYID[id].type)}</small></span></div>
          ${all.length>1?`<span class="udots">${all.map((_,i)=>`<i class="${i===at?'on':i<at?'done':''}"></i>`).join('')}</span>`:''}`; })()}
      ${S.newUnlocks&&S.newUnlocks.length?'<p class="muted ucap">Now playable in Same Phone, Online, Quickplay and Practice.</p>':''}
      <button class="btn big" data-a="scenenext">${(S.unlockAt||0)+1<(S.newUnlocks||[]).length?'Next':'Continue'}</button><span class="lbox b" aria-hidden="true"></span></div>`;
  }
  if(S.sceneVs){
    const tw=twistText(st), row=ids=>ids.filter(id=>!BYID[id].helper).map(id=>`<span class="vsc">${seal(BYID[id],'lg')}<small>${esc(BYID[id].short)}</small></span>`).join('');
    const mine=S.storyDraft?'<span class="muted">Your draft</span>':row(st.mine);
    return `<div ${placeStyle(st)}class="scene arc-${st.arc} vscard"><span class="lbox t" aria-hidden="true"></span>${fx}${head}
      <div class="vsrow l">${mine}</div><div class="vsmid"><span>VS</span></div><div class="vsrow r">${row(st.enemy)}</div>
      ${tw||st.boosts?`<div class="stags">${tw?`<span class="stwist">${esc(tw)}</span>`:''}${(st.boosts||[]).map(b=>`<span class="stwist ${b.side?'foe':'ally'}">${esc(b.label)}</span>`).join('')}</div>`:''}
      ${stageCleared(S.stage)?`<div class="goals vsgoals"><span class="tlabel">Star chase</span>${starGoals(st).map((g,k)=>`<span class="${goalsGot(st.id)[k]?'got':''}">★ ${esc(g)}</span>`).join('')}</div>`:''}
      <button class="btn big" data-a="sceneskip">Fight</button><span class="lbox b" aria-hidden="true"></span></div>`;
  }
  const shown=sceneLines(), [who,text,opt={}]=shown[S.sceneAt], c=who&&BYID[who], side=!c?'n':S.sceneFinale?(S.sceneAt%2?'r':'l'):sceneSide(st,who), pic=opt.img&&SCENE_ART[opt.img];
  // the other speakers in this scene stand dimmed behind the line
  const cast=(S.sceneFinale ? [shown[S.sceneAt-1], shown[S.sceneAt+1]].map(l=>l&&l[0]) : [...new Set(shown.map(l=>l[0]))]).filter(id=>id && id!==who).slice(0,2);   // finale: the neighbours in the conversation
  const typed=esc(text);   // lines simply appear (CK didn't want the typing effect)
  return `<div ${placeStyle(st)}class="scene arc-${st.arc}${opt.awaken?' awakening':''}${S.sceneMid?' midscene':''}" data-a="scenenext"><span class="lbox t" aria-hidden="true"></span>${fx}
    ${head}
    ${tip('scene','Tap anywhere to continue the story. <b>Skip</b> jumps to the fight.')}
    ${opt.clip&&(CLIPS[opt.clip]||{}).special&&S.clipsOn!==false?`<div class="scenevid" key="${S.sceneAt}"><video data-k="scene-${S.stage}-${S.sceneAt}" src="${esc(clipSrc(CLIPS[opt.clip].special))}"${ART[opt.clip]?` poster="${ART[opt.clip]}"`:''} muted playsinline autoplay loop preload="auto" disablepictureinpicture></video></div>`:''}
    <div class="stagecast">${cast.map(id=>`<span class="extra ${S.sceneFinale?(side==='l'?'r':'l'):sceneSide(st,id)}">${seal(BYID[id],'lg')}</span>`).join('')}
      ${pic?`<span class="lead ${c?side:'l'} scenepor" key="${S.sceneAt}"><span class="gl lg"><img decoding="sync" src="${pic}" alt=""></span></span>`   // a scene picture takes the speaker's portrait frame
      :c?`<span class="lead ${side}${opt.awaken?' awaken':''}" key="${S.sceneAt}">${opt.pic&&ART[opt.pic]?`<span class="gl lg"><img decoding="sync" src="${ART[opt.pic]}" alt=""></span>`:seal(c,'lg')}${opt.awaken?`<span class="markstamp" aria-hidden="true">${typeof opt.awaken==='string'?opt.awaken:'痣'}</span><span class="markburst" aria-hidden="true"></span>`:''}</span>`:''}</div>
    <div class="sceneline ${side}${S.sceneInstant?' instant':''}" aria-live="polite">${c?`<span class="sname">${esc(c.short)}</span>`:''}
      <p class="popline" key="${S.sceneAt}">${typed}</p></div>
    <div class="scenefoot"><span class="dots">${shown.map((_,i)=>`<i class="${i===S.sceneAt?'on':i<S.sceneAt?'done':''}"></i>`).join('')}</span>
      <span class="muted">Tap to continue</span></div><span class="lbox b" aria-hidden="true"></span></div>`;
}
// The winner: who won and how, without the numbers (the TV shows only this; the phone has the rest)
function winHero(){
  const w=S.winner;
  return `<div class="win${w<0?'':' victory'}" style="--wc:${w<0?'var(--muted)':pc(w)}"><span class="burst" aria-hidden="true"></span>
    ${w<0?'':`<div class="winseals" aria-hidden="true">${(()=>{ const best=S.teams[w].slice().sort((a,b)=>mvpScore(S.stats[b.uid]||{dmg:0,kos:0,heal:0})-mvpScore(S.stats[a.uid]||{dmg:0,kos:0,heal:0}))[0]; return S.teams[w].map((u,i)=>`<span class="${u===best?'star':''}" style="--i:${i}">${seal(u,'lg')}</span>`).join(''); })()}</div>`}
    <div class="eyebrow">After ${plural(S.round,'round')}</div>
    <div class="big" style="color:${w<0?'var(--fg)':pc(w)}">${w<0?(nPlayers()>2?'Nobody survives':'Both squads fall'):S.duo||(S.coop&&!coopFoe(w))?players().filter(q=>sameSide(q,w)).map(nm).join(' & ')+' win':nm(w)+' wins'}</div>
    ${nPlayers()>2&&!S.duo&&!S.coop?`<div class="places">${placings().map((g,i)=>g.map(q=>`<span class="place" style="--tc:${pc(q)}"><b>${['1st','2nd','3rd','4th'][w<0?i+1:i]}</b>${nm(q)}</span>`).join('')).join('')}</div>`:''}
    ${gameMode() ? gmResult(w) : S.coop ? coopResult() : ''}
    ${S.mode==='daily' ? `<p class="dres ${S.dailyMet?'ok':''}">${S.dailyMet?'Challenge complete!':'Challenge not met.'} <span class="muted">${esc(DAILY_GOALS[S.daily.goal.type](S.daily.goal))}</span></p>` : ''}
    <p class="muted">${S.coop ? (coopWon()&&S.series?`Survivors recover ${Math.round(GM_HEAL*100)}% and their specials are ready.`:'Draft again and take him on.') : gameMode() ? gmNote(w) : S.mode==='daily' ? (S.dailyMet?`Come back tomorrow for a new one.${dailyStreak()>1?` Streak: ${plural(dailyStreak(),'day')}.`:''}`:'Try again: same squads, same goal.') : S.mode==='story' ? (w===0 ? (S.survived?'You held out until dawn. ':'')+(S.stage+1<STAGES.length?`Battle ${S.stage+1} won. ${esc(STAGES[S.stage+1].title)} is unlocked.`:'The sun rises. The story is complete!') : S.storyDraft ? 'Defeated. Rethink your squad and try again.' : 'Defeated. Try a different plan.')
      : w<0?'Nobody is left standing at dawn.':'Win and character records saved on this phone.'}</p></div>`;
}
const overUnlocks = () => S.mode==='story' && S.newUnlocks && S.newUnlocks.length ? `<section class="unlocked"><div class="tlabel">Unlocked this battle</div>
      <div class="ulist">${S.newUnlocks.map((id,i)=>`<span class="ucard" style="--i:${i}">${seal(BYID[id],'lg')}<b>${esc(BYID[id].short)}</b></span>`).join('')}</div></section>` : '';
const overBar = () => { const w=S.winner; return actionbar(gameMode() ? `<button class="btn ghost" data-a="home">Main menu</button>${w===0 && S.series && gmFights()>S.series.wave?'<button class="btn" data-a="nextfight">Next fight</button>':`<button class="btn" data-a="rematch">${S.mode==='final'?'Face him again':S.mode==='random'?'Deal again':'Try again'}</button>`}` : S.mode==='daily' ? `<button class="btn ghost" data-a="home">Main menu</button><button class="btn" data-a="daily">${S.dailyMet?'Play again':'Try again'}</button>` : S.mode==='story'
      ? `<button class="btn ghost" data-a="storymap">Story map</button>${w===0&&S.campaign==='six'?'<button class="btn" data-a="ceremony">You are summoned</button>':w===0&&S.stage+1<STAGES.length?`<button class="btn" data-a="stage" data-v="${S.stage+1}">Next battle</button>`:w===0?'<button class="btn" data-a="finale">Finish the story</button>':`<button class="btn" data-a="${S.storyDraft?'stagedraft':'stage'}" data-v="${S.stage}">Try again</button>`}`
      : isOnline() ? `<button class="btn ghost" data-a="home">Leave room</button><button class="btn" data-a="rematch">${S.coop?(S.series&&coopWon()?'Next wave':'Try again'):S.gm?'Deal again':isAsync()?'Rematch: loser picks first':'Rematch'}</button>`
      : `<button class="btn ghost" data-a="home">Main menu</button><button class="btn" data-a="rematch">Rematch</button>`); };
function vOver(){
  return `${winHero()}${overUnlocks()}
    ${mvpPanel()}
    <div class="overteams${nPlayers()>2?' many':''}">${players().map(q=>teamBlock(q)).join('')}</div>
    ${matchLogPanel()}
    ${overBar()}`;
}
