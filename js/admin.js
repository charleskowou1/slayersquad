/* CK's private numbers page (admin.html): nothing links to it. Counters come from track() in app.js, written as flat keys in Firebase
   track/: players, dev_<device>, d_<date>_<opens|players|new|games>, m_<mode>_<start|finish>, s_<stage>_<try|win>. Reading track and reports
   needs the rules this page prints, which only let CK's browser read them. Opening it also turns tracking off in this browser. */
const FB='10.12.2', esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const load=src=>new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
const MODE_NAMES={cpu:'Quickplay',local:'Same Phone',practice:'Practice',story:'Story',daily:'Daily',online2:'Online 2 players',online3:'Online 3 players',online4:'Online 4 players'};
const modeName=k=>(k.startsWith('tv_')?'TV: ':'')+(MODE_NAMES[k.replace('tv_','')]||k);
const rowsOf=(list,max)=>list.map(([n,v,note])=>`<div class="row"><span>${esc(n)}</span><u style="width:${max?Math.max(1,v/max*100):0}%"></u><small>${note||v}</small></div>`).join('')||'<p class="muted">Nothing yet.</p>';
function dayKeys(n){ return Array.from({length:n},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(n-1-i)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }); }
function rulesFor(uid){ const me=`auth != null && auth.uid === '${uid}'`; return `"track": {
  ".read": "${me}",
  "$key": {
    ".write": "auth != null && $key.length <= 60",
    ".validate": "newData.isNumber() && newData.val() === (data.exists() ? data.val() : 0) + 1"
  }
},
"reports": {
  ".read": "${me}",
  ".write": "${me}",
  "$id": {
    ".write": "auth != null && !data.exists() && newData.exists()",
    ".validate": "newData.hasChildren(['at', 'msg', 'ua'])",
    "msg": { ".validate": "newData.isString() && newData.val().length <= 500" },
    "$field": { ".validate": "(newData.isString() && newData.val().length <= 200) || newData.isNumber()" }
  }
}`; }
function draw(uid, t, stats, reports, denied){
  const sum=(a)=>a.reduce((x,y)=>x+y,0), days=dayKeys(14), d=(day,k)=>t[`d_${day}_${k}`]||0, today=days[13];
  const peak=Math.max(1,...days.map(x=>d(x,'players')));
  const modes=Object.keys(t).map(k=>k.match(/^m_(.+)_start$/)).filter(Boolean).map(m=>m[1]).map(k=>[modeName(k),t[`m_${k}_start`]||0,`${t[`m_${k}_start`]||0} · ${t[`m_${k}_finish`]||0} done`]).sort((a,b)=>b[1]-a[1]);
  const stages=ALL_STAGES.filter(s=>t[`s_${s.id}_try`]||t[`s_${s.id}_win`]).map(s=>[s.title,t[`s_${s.id}_win`]||0,`${t[`s_${s.id}_win`]||0} of ${t[`s_${s.id}_try`]||0}`]);
  const chars=Object.entries(stats.chars||{}).filter(([id])=>BYID[id]).map(([id,c])=>[BYID[id].name,c.p||0,`${c.p||0} · ${c.p?Math.round((c.w||0)/c.p*100):0}% won`]).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const devs=['ios','android','computer'].map(k=>[{ios:'iPhone / iPad',android:'Android',computer:'Computer'}[k],t['dev_'+k]||0]);
  const reps=Object.entries(reports||{}).sort((a,b)=>b[1].at-a[1].at);
  document.getElementById('sub').textContent=`Last 14 days and all-time totals. Updated ${new Date().toLocaleTimeString()}.`;
  document.getElementById('out').innerHTML=`
  ${denied?`<section class="warn"><h2>One setup step</h2><p>Firebase is blocking this page, so players aren't being counted yet. In the Firebase console open Realtime Database → Rules, paste this inside <b>"rules"</b> next to what's there (keep a comma between sections), and click Publish. It lets only this browser read the numbers.</p><pre id="rules">${esc(rulesFor(uid))}</pre><button id="copy">Copy</button></section>`:''}
  <div class="tiles"><div class="tile"><b>${t.players||0}</b><span>Players ever</span></div><div class="tile"><b>${d(today,'players')}</b><span>Played today</span></div><div class="tile"><b>${sum(days.map(x=>d(x,'new')))}</b><span>New, 14 days</span></div>
    <div class="tile"><b>${sum(days.map(x=>d(x,'games')))}</b><span>Games, 14 days</span></div><div class="tile"><b>${stats.games||0}</b><span>Finished games ever</span></div><div class="tile"><b>${reps.length}</b><span>Bug reports</span></div></div>
  <section><h2>Players each day</h2><div class="bars">${days.map(x=>`<div title="${x}">${d(x,'players')||''}<i style="height:${d(x,'players')/peak*82}%"></i>${x.slice(8)}</div>`).join('')}</div></section>
  <div class="grid2"><section><h2>Modes: started · finished</h2>${rowsOf(modes,Math.max(0,...modes.map(m=>m[1])))}</section>
  <section><h2>Devices</h2>${rowsOf(devs,Math.max(0,...devs.map(m=>m[1])))}</section></div>
  <section><h2>Bug reports</h2>${reps.length?reps.map(([id,r])=>`<div class="rep${r.auto?' auto':''}"><p>${esc(r.msg)}</p><small>${esc(new Date(r.at).toLocaleString())} · v${esc(r.v||'?')} · ${esc(r.where||'')}${r.auto?' · crash':''}</small><small>${esc(r.ua||'')}</small><button data-del="${esc(id)}">Delete</button></div>`).join(''):'<p class="muted">None.</p>'}</section>
  <div class="grid2"><section><h2>Story: wins of tries</h2>${rowsOf(stages,Math.max(0,...stages.map(m=>m[1])))}</section>
  <section><h2>Most played fighters</h2>${rowsOf(chars,Math.max(0,...chars.map(m=>m[1])))}</section></div>
  <p class="muted">This browser's admin ID: ${esc(uid)}</p>`;
  const c=document.getElementById('copy'); if(c) c.onclick=()=>navigator.clipboard.writeText(rulesFor(uid)).then(()=>{ c.textContent='Copied'; });
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>firebase.database().ref('reports/'+b.dataset.del).remove().then(start));
}
async function start(){
  const get=p=>firebase.database().ref(p).get().then(s=>s.val()||{});
  const uid=firebase.auth().currentUser.uid; let denied=false;
  const [t,reports]=await Promise.all([get('track'),get('reports')]).catch(()=>{ denied=true; return [{},{}]; });
  draw(uid, t, await get('stats').catch(()=>({})), reports, denied);
}
(async()=>{ try{ localStorage.setItem('squad-draft-admin','1') }catch(e){}
  try{ for(const m of ['app','auth','database']) await load(`https://www.gstatic.com/firebasejs/${FB}/firebase-${m}-compat.js`);
    firebase.initializeApp(FIREBASE_CONFIG); await firebase.auth().signInAnonymously(); await start(); }
  catch(e){ document.getElementById('sub').textContent='Could not load: '+e.message; } })();
