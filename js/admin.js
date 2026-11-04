/* CK's private numbers page (admin.html): nothing links to it. Counters come from track() in app.js, written as flat keys in Firebase
   track/: players, dev_<device>, where_<time zone, / as ~>, d_<date>_<opens|players|new|games>, m_<mode>_<start|finish>, s_<stage>_<try|win>. Reading track and reports
   needs the rules this page prints, which only let CK's browser read them. Opening it also turns tracking off in this browser. */
const FB='10.12.2', esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const load=src=>new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
const MODE_NAMES={coop_final:'Co-op Final Form',coop_gauntlet:'Co-op Gauntlet',final:'Final Form',gauntlet:'Gauntlet',rush:'Upper Moon Rush',random:'Random Squads',mirror:'Mirror Match',cpu:'Quickplay',local:'Same Phone',practice:'Practice',story:'Story',daily:'Daily',online2:'Online 2 players',online3:'Online 3 players',online4:'Online 4 players'};
const modeName=k=>(k.startsWith('tv_')?'TV: ':'')+(MODE_NAMES[k.replace('tv_','')]||k);
const rowsOf=(list,max)=>list.map(([n,v,note],i)=>`<div class="row"><em>${i+1}</em><span>${esc(n)}</span><small>${note||v}</small><u><i style="width:${max?Math.max(2,v/max*100):0}%"></i></u></div>`).join('')||'<p class="empty">Nothing yet.</p>';
const card=(title,note,body,cls='')=>`<section class="${cls}"><header><h2>${title}</h2>${note?`<p>${note}</p>`:''}</header>${body}</section>`;
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
  const modes=Object.keys(t).map(k=>k.match(/^m_(.+)_start$/)).filter(Boolean).map(m=>m[1]).map(k=>[modeName(k),t[`m_${k}_start`]||0,`${t[`m_${k}_start`]||0} · ${t[`m_${k}_finish`]||0} done${t[`m_${k}_win`]?` · ${t[`m_${k}_win`]} won`:''}`]).sort((a,b)=>b[1]-a[1]);
  const stages=ALL_STAGES.filter(s=>t[`s_${s.id}_try`]||t[`s_${s.id}_win`]).map(s=>[s.title,t[`s_${s.id}_win`]||0,`${t[`s_${s.id}_win`]||0} of ${t[`s_${s.id}_try`]||0}`]);
  const chars=Object.entries(stats.chars||{}).filter(([id])=>BYID[id]).map(([id,c])=>[BYID[id].name,c.p||0,`${c.p||0} · ${c.p?Math.round((c.w||0)/c.p*100):0}% won`]).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const placeName=k=>{ const parts=k.split('~'), city=parts[parts.length-1].replace(/_/g,' '); return parts.length>1?`${city} · ${parts[0]}`:city; };
  const wheres=Object.keys(t).filter(k=>k.startsWith('where_')).map(k=>[placeName(k.slice(6)),t[k]]).sort((a,b)=>b[1]-a[1]);
  const devTotal=Math.max(1,sum(['ios','android','computer'].map(k=>t['dev_'+k]||0)));
  const devs=['ios','android','computer'].map(k=>[{ios:'iPhone / iPad',android:'Android',computer:'Computer'}[k],t['dev_'+k]||0]).map(([n,v])=>[n,v,`${v} · ${Math.round(v/devTotal*100)}%`]).sort((a,b)=>b[1]-a[1]);
  const reps=Object.entries(reports||{}).sort((a,b)=>b[1].at-a[1].at), crashes=reps.filter(([,r])=>r.auto).length;
  const week=sum(days.slice(7).map(x=>d(x,'players'))), lastWeek=sum(days.slice(0,7).map(x=>d(x,'players')));
  const trend=lastWeek?Math.round((week-lastWeek)/lastWeek*100):null;
  const wk=x=>'SMTWTFS'[new Date(x+'T12:00').getDay()];
  const tile=(n,label,note,cls='')=>`<div class="tile ${cls}"><b>${n}</b><span>${label}</span>${note?`<small>${note}</small>`:''}</div>`;
  document.getElementById('sub').textContent=`Updated ${new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`;
  document.getElementById('out').innerHTML=`
  ${denied?`<section class="warn"><header><h2>One setup step</h2></header><p>Firebase is blocking this page, so players aren't being counted yet. In the Firebase console open Realtime Database → Rules, paste this inside <b>"rules"</b> next to what's there (keep a comma between sections), and click Publish. It lets only this browser read the numbers.</p><pre id="rules">${esc(rulesFor(uid))}</pre><button id="copy">Copy</button></section>`:''}
  <div class="tiles">
    ${tile(d(today,'players'),'Played today',`${d(today,'opens')} opens`,'hot')}
    ${tile(week,'Players, 7 days',trend===null?'':`<i class="${trend>=0?'up':'down'}">${trend>=0?'▲':'▼'} ${Math.abs(trend)}%</i> vs week before`)}
    ${tile(sum(days.map(x=>d(x,'new'))),'New, 14 days','first-time browsers')}
    ${tile(t.players||0,'Players ever','browsers, not people')}
    ${tile(sum(days.map(x=>d(x,'games'))),'Games, 14 days','matches started')}
    ${tile(stats.games||0,'Finished games','counted in shared stats')}
  </div>
  ${card('Players each day','Different browsers that opened the game, by their local date.',`<div class="bars">${days.map(x=>{ const v=d(x,'players'); return `<div class="${x===today?'today':''}" title="${x}: ${v} players, ${d(x,'games')} games"><b>${v||''}</b><i style="height:${v/peak*100}%"></i><span>${wk(x)}<br>${+x.slice(8)}</span></div>`; }).join('')}</div>`)}
  <div class="grid2">
    ${card('Modes','Started · finished',rowsOf(modes,Math.max(0,...modes.map(m=>m[1]))))}
    ${card('Where','Each browser once, from its time zone. A rough region, not an exact city.',rowsOf(wheres.slice(0,15),Math.max(0,...wheres.map(m=>m[1]))))}
    ${card('Devices','From each browser’s first visit.',rowsOf(devs,Math.max(0,...devs.map(m=>m[1]))))}
    ${card('Most played fighters','Online and Quickplay matches.',rowsOf(chars,Math.max(0,...chars.map(m=>m[1]))))}
  </div>
  ${card('Story','Wins of tries, per battle.',rowsOf(stages,Math.max(0,...stages.map(m=>m[1]))))}
  ${card(`Bug reports <span class="pill">${reps.length}</span>${crashes?` <span class="pill red">${crashes} crash${crashes>1?'es':''}</span>`:''}`,'',reps.length?reps.map(([id,r])=>`<div class="rep${r.auto?' auto':''}"><div class="rephead"><span class="tag">${r.auto?'Crash':'Report'}</span><small>${esc(new Date(r.at).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}))} · v${esc(r.v||'?')} · ${esc(r.where||'')}</small><button data-del="${esc(id)}" aria-label="Delete report">Delete</button></div><p>${esc(r.msg)}</p><small class="ua">${esc(r.ua||'')}</small></div>`).join(''):'<p class="empty">None. 🎉</p>')}
  ${denied?'':card('Make a progress code','One code for one person. They enter it in Settings → Save. It adds progress and never removes any.',`<div class="mk">
    <select id="upto">${ALL_STAGES.map((s,i)=>`<option value="${i}"${i===ALL_STAGES.length-1?' selected':''}>${i===ALL_STAGES.length-1?'Whole game':'Through '+esc(s.title)}</option>`).join('')}</select>
    <button id="mkcode" class="primary">Make code</button></div><b id="newcode" class="code"></b>`)}
  <p class="foot">This browser's admin ID: ${esc(uid)}</p>`;
  const c=document.getElementById('copy'); if(c) c.onclick=()=>navigator.clipboard.writeText(rulesFor(uid)).then(()=>{ c.textContent='Copied'; });
  const mk=document.getElementById('mkcode'); if(mk) mk.onclick=()=>makeCode(+document.getElementById('upto').value);
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ if(confirm('Delete this report?')) firebase.database().ref('reports/'+b.dataset.del).remove().then(start); });
}
// A save with every battle up to stage i won at 3 stars, at a new recovery code (unlocks follow from the battles won)
async function makeCode(i){
  const ABC='ABCDEFGHJKMNPQRSTUVWXYZ23456789', code=()=>Array.from({length:12},()=>ABC[Math.floor(Math.random()*ABC.length)]).join('');
  const ids=ALL_STAGES.slice(0,i+1).map(s=>s.id), story={cleared:ids, stars:Object.fromEntries(ids.map(id=>[id,3])), goals:Object.fromEntries(ids.map(id=>[id,[true,true,true]]))};
  const c=code(), el=document.getElementById('newcode');
  try{ await firebase.database().ref('saves/'+c).set({v:1, at:Date.now(), rev:code(), data:{[STORY_KEY]:JSON.stringify(story), 'squad-draft-dream-reset':'1'}}); el.textContent=c.match(/.{4}/g).join('-'); }
  catch(e){ el.textContent='Could not make it: '+e.message; }
}
async function start(){
  const get=p=>firebase.database().ref(p).get().then(s=>s.val()||{});
  const uid=firebase.auth().currentUser.uid; let denied=false;
  const [t,reports]=await Promise.all([get('track'),get('reports')]).catch(()=>{ denied=true; return [{},{}]; });
  draw(uid, t, await get('stats').catch(()=>({})), reports, denied);
}
document.getElementById('refresh').onclick=async e=>{ const b=e.currentTarget; b.classList.add('spin'); b.textContent='Loading…'; try{ await start(); }finally{ b.classList.remove('spin'); b.textContent='Refresh'; } };
(async()=>{ try{ localStorage.setItem('squad-draft-admin','1') }catch(e){}
  try{ for(const m of ['app','auth','database']) await load(`https://www.gstatic.com/firebasejs/${FB}/firebase-${m}-compat.js`);
    firebase.initializeApp(FIREBASE_CONFIG); await firebase.auth().signInAnonymously(); await start(); }
  catch(e){ document.getElementById('sub').textContent='Could not load: '+e.message; } })();
