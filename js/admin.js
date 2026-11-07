/* CK's private numbers page (admin.html): nothing links to it. Counters come from track() in app.js, written as flat keys in Firebase
   track/: players, dev_<device>, where_<time zone, / as ~>, d_<date>_<opens|players|new|games>, m_<mode>_<start|finish>, src_<link source>, s_<stage>_<try|win>,
   and (from v117) dated copies d_<date>_m_… / d_<date>_s_…. seen/<browser id>: {dev, tz, p (recovery-code fingerprint), old, days/<date>}: people are
   browsers grouped by p. Dates are New York days (TRACK_TZ in app.js). Reading needs the rules this page prints, which only let CK's browser
   read them. Opening it also turns tracking off in this browser. */
const FB='10.12.2', esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const load=src=>new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
const MODE_NAMES={coop_final:'Co-op Final Form',coop_gauntlet:'Co-op Gauntlet',final:'Final Form',gauntlet:'Gauntlet',rush:'Upper Moon Rush',random:'Random Squads',mirror:'Mirror Match',cpu:'Quickplay',local:'Same Phone',practice:'Practice',story:'Story',daily:'Daily',online2:'Online 2 players',online3:'Online 3 players',online4:'Online 4 players'};
const modeName=k=>(k.startsWith('tv_')?'TV: ':'')+(MODE_NAMES[k.replace('tv_','')]||k);
const rowsOf=(list,max)=>list.map(([n,v,note],i)=>`<div class="row"><em>${i+1}</em><span>${esc(n)}</span><small>${note||v}</small><u><i style="width:${max?Math.max(2,v/max*100):0}%"></i></u></div>`).join('')||'<p class="empty">Nothing yet.</p>';
const card=(title,note,body,cls='',kanji='')=>`<section class="${cls}">${kanji?`<span class="kj" aria-hidden="true">${kanji}</span>`:''}<header><h2>${title}</h2>${note?`<p>${note}</p>`:''}</header>${body}</section>`;
// A card's picture: its own, else its family's (Marks borrow the base picture), else none
const portrait=id=>{ const files=(typeof ART_FILES!=='undefined'&&ART_FILES.img)||[], c=BYID[id]||{}, has=n=>files.find(f=>f.replace(/\.[^.]+$/,'')===n);
  const f=has(id)||has(c.fam)||has(String(id).split('_')[0]); return f?`img/${f}`:null; };
const DEV_COLORS={ios:'#e0573b',android:'#7a8be0',computer:'#b8893a'};   // fixed per device, checked for colour-blind separation on the panel colour
const TZ='America/New_York';   // must match TRACK_TZ in app.js
const nyDay=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ, year:'numeric', month:'2-digit', day:'2-digit'}).format(d);
const shiftDay=(day,n)=>{ const d=new Date(day+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const daysFrom=(a,b)=>{ const out=[]; for(let x=a; x<=b && out.length<800; x=shiftDay(x,1)) out.push(x); return out; };
function dayKeys(n){ const t=nyDay(); return daysFrom(shiftDay(t,-(n-1)), t); }
const RANGES=[['today','Today'],['7','7 days'],['30','30 days'],['all','All time']];
let RANGE='7'; try{ RANGE=localStorage.getItem('squad-admin-range')||'7'; }catch(e){}
function rulesFor(uid){ const me=`auth != null && auth.uid === '${uid}'`, plusOne='newData.isNumber() && newData.val() === (data.exists() ? data.val() : 0) + 1'; return `{
  "rules": {
    "rooms": { "$code": { ".read": "auth != null && $code.matches(/^[A-Z]{4}$/)", ".write": "auth != null && $code.matches(/^[A-Z]{4}$/)" } },
    "games": { "$code": { ".read": "auth != null && $code.matches(/^[A-Z]{6}$/)", ".write": "auth != null && $code.matches(/^[A-Z]{6}$/)" } },
    "saves": { "$code": { ".read": "auth != null && $code.matches(/^[A-Z2-9]{12}$/)", ".write": "auth != null && $code.matches(/^[A-Z2-9]{12}$/)" } },
    "stats": {
      ".read": "auth != null",
      "games": { ".write": "auth != null", ".validate": "${plusOne}" },
      "chars": { "$id": { "$k": { ".write": "auth != null && $id.length <= 40 && $k.matches(/^[drpw]$/)", ".validate": "${plusOne}" } } }
    },
    "track": {
      ".read": "${me}",
      "$key": { ".write": "auth != null && $key.length <= 60", ".validate": "${plusOne}" }
    },
    "seen": {
      ".read": "${me}",
      "$id": {
        ".write": "auth != null && $id.matches(/^[a-z0-9]{12}$/) && newData.exists()",
        "dev": { ".validate": "newData.isString() && newData.val().length <= 12" },
        "tz": { ".validate": "newData.isString() && newData.val().length <= 50" },
        "p": { ".validate": "newData.isString() && newData.val().length <= 16" },
        "old": { ".validate": "newData.isBoolean()" },
        "days": { "$d": { ".validate": "$d.matches(/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/) && newData.val() === true" } },
        "$other": { ".validate": false }
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
    }
  }
}`; }
let LAST=null;
function draw(uid, t, stats, reports, denied, seen){
  LAST={uid, t, stats, reports, denied, seen};
  const sum=a=>a.reduce((x,y)=>x+y,0), d=(day,k)=>t[`d_${day}_${k}`]||0, today=nyDay(), pct=(a,b)=>b?Math.round(a/b*100):0, fmt=n=>Number(n||0).toLocaleString();
  // ---- people: browsers grouped by recovery-code fingerprint ----
  const people={}; Object.entries(seen||{}).forEach(([id,b])=>{ const k=b.p||id, q=people[k]||(people[k]={days:new Set(), browsers:0, old:false, dev:b.dev, tz:b.tz});
    q.browsers++; Object.keys(b.days||{}).forEach(x=>q.days.add(x)); if(b.old) q.old=true; if(b.dev) q.dev=b.dev; if(b.tz) q.tz=b.tz; });
  const plist=Object.values(people).map(q=>Object.assign(q,{first:[...q.days].sort()[0]||today}));
  const hasSeen=plist.length>0, seenStart=hasSeen?plist.reduce((m,q)=>q.first<m?q.first:m,today):today;
  // ---- the time range ----
  const allDays=Object.keys(t).map(k=>k.match(/^d_(\d{4}-\d{2}-\d{2})_/)).filter(Boolean).map(m=>m[1]).concat(hasSeen?[seenStart]:[]).sort();
  const firstDay=allDays[0]&&allDays[0]<today?allDays[0]:today;
  const span=RANGE==='today'?1:RANGE==='all'?null:+RANGE, isAll=span===null;
  const days=isAll?daysFrom(firstDay,today):dayKeys(span), prev=isAll?[]:daysFrom(shiftDay(days[0],-span),shiftDay(days[0],-1));
  const inRange=(q,list)=>list.some(x=>q.days.has(x));
  // Days before the people count started (seenStart) only have the old per-browser daily counts, so ranges that reach back
  // add those, minus players from then who have since shown up in the new count (old:true), so they aren't counted twice.
  const pre=list=>hasSeen?list.filter(x=>x<seenStart):list;
  const activeIn=list=>{ const old=sum(pre(list).map(x=>d(x,'players'))); if(!hasSeen) return old;
    const ppl=plist.filter(q=>inRange(q,list)); return ppl.length+(old?Math.max(0, old-ppl.filter(q=>q.old).length):0); };
  const active=activeIn(days), before=isAll?null:activeIn(prev);
  const trend=before?Math.round((active-before)/before*100):null;
  const newIn=list=>sum(pre(list).map(x=>d(x,'new')))+(hasSeen?plist.filter(q=>!q.old&&list.includes(q.first)).length:0);
  const fresh=newIn(days), returning=Math.max(0,active-fresh);
  const games=sum(days.map(x=>d(x,'games'))), opens=sum(days.map(x=>d(x,'opens')));
  const browsersActive=hasSeen?Object.values(seen).filter(b=>days.some(x=>(b.days||{})[x])).length:null;
  const settled=plist.filter(q=>q.first<today), cameBack=settled.filter(q=>q.days.size>1).length;
  const rangeName={today:'today','7':'the last 7 days','30':'the last 30 days',all:'all time'}[RANGE];
  // ---- per-range counters: mode and story keys have dated copies from v117; All time uses the running totals ----
  const ctr=k=>isAll?(t[k]||0):sum(days.map(x=>t[`d_${x}_${k}`]||0));
  const modes=Object.keys(t).map(k=>k.match(/^m_(.+)_start$/)).filter(Boolean).map(m=>m[1]).map(k=>({name:modeName(k), start:ctr(`m_${k}_start`), fin:ctr(`m_${k}_finish`), win:ctr(`m_${k}_win`)})).filter(m=>m.start).sort((a,b)=>b.start-a.start);
  const storyRows=list=>list.map((s,i)=>({n:i+1, title:s.title, tries:ctr(`s_${s.id}_try`), wins:ctr(`s_${s.id}_win`)})).filter(r=>r.tries);
  const main=storyRows(MAIN_STAGES), dream=storyRows(DREAM_STAGES.concat(SIX_STAGES));
  const chars=Object.entries(stats.chars||{}).filter(([id])=>BYID[id]).map(([id,c])=>({id, name:BYID[id].name, p:c.p||0, w:c.w||0})).sort((a,b)=>b.p-a.p).slice(0,10);
  const placeName=k=>{ const parts=k.split(/[~\/]/), city=parts[parts.length-1].replace(/_/g,' '); return parts.length>1?`${city} · ${parts[0]}`:city; };
  const act=plist.filter(q=>inRange(q,days)), tally=(list,f)=>{ const m={}; list.forEach(q=>{ const k=f(q); if(k) m[k]=(m[k]||0)+1; }); return m; };
  const oldWhere=Object.fromEntries(Object.keys(t).filter(k=>k.startsWith('where_')).map(k=>[k.slice(6).replace(/~/g,'/'),t[k]]));
  const reachesBack=hasSeen&&days[0]<seenStart, both=(a,b)=>{ const m={...a}; Object.entries(b).forEach(([k,v])=>{ m[k]=Math.max(m[k]||0,v); }); return m; };
  const whereMap=!hasSeen?oldWhere:reachesBack?both(oldWhere,tally(act,q=>q.tz)):tally(act,q=>q.tz);
  const wheres=Object.entries(whereMap).map(([k,v])=>[placeName(k),v]).sort((a,b)=>b[1]-a[1]);
  const srcName=k=>({direct:'Typed it in / other', tiktok:'TikTok', ig:'Instagram', instagram:'Instagram', yt:'YouTube', youtube:'YouTube', x:'X', twitter:'X', reddit:'Reddit', discord:'Discord'})[k]||k;
  const srcs=Object.keys(t).filter(k=>/^src_/.test(k)).map(k=>[srcName(k.slice(4)),ctr(k)]).filter(m=>m[1]).reduce((m,[n,v])=>{ m[n]=(m[n]||0)+v; return m; },{});
  const froms=Object.entries(srcs).sort((a,b)=>b[1]-a[1]);
  const oldDev={ios:t.dev_ios||0, android:t.dev_android||0, computer:t.dev_computer||0};
  const devMap=!hasSeen?oldDev:reachesBack?both(oldDev,tally(act,q=>q.dev)):tally(act,q=>q.dev);
  const devs=[['ios','iPhone / iPad'],['android','Android'],['computer','Computer']].map(([k,n])=>({k,n,v:devMap[k]||0})), devTotal=sum(devs.map(x=>x.v));
  const reps=Object.entries(reports||{}).sort((a,b)=>b[1].at-a[1].at), crashes=reps.filter(([,r])=>r.auto).length;
  const tile=(n,label,note)=>`<div class="tile"><b>${n}</b><span>${label}</span>${note?`<small>${note}</small>`:''}</div>`;
  const story=(rows,first)=>rows.length?`<div class="funnel">${rows.map(r=>{ const rate=pct(r.wins,r.tries), hard=r.tries>=5&&rate<50;
      return `<div class="frow${hard?' hard':''}" title="${esc(r.title)}: ${r.wins} wins of ${r.tries} tries"><em>${r.n}</em><span>${esc(r.title)}${hard?' <i class="tag red">hard</i>':''}</span><small>${r.tries} tries · <b>${rate}%</b> won</small><u><i style="width:${Math.max(2,r.tries/first*100)}%"></i><i class="won" style="width:${Math.max(0,r.wins/first*100)}%"></i></u></div>`; }).join('')}</div>`:'<p class="empty">Nothing in this time range.</p>';
  const mixNote=hasSeen&&days[0]<seenStart&&sum(pre(days).map(x=>d(x,'players')))?`<p class="mixnote">Days before ${new Date(seenStart+'T12:00').toLocaleDateString([], {month:'short', day:'numeric'})} were counted per browser, so totals reaching back to them are close estimates.</p>`:'';
  const datedFrom=Object.keys(t).map(k=>k.match(/^d_(\d{4}-\d{2}-\d{2})_[ms]_/)).filter(Boolean).map(m=>m[1]).sort()[0];
  const datedNote=isAll?'':datedFrom?` Counted by day since ${new Date(datedFrom+'T12:00').toLocaleDateString([], {month:'short', day:'numeric'})}.`:' Daily counts start with this update; until then use All time.';
  document.getElementById('sub').textContent=`Updated ${new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})} · New York time`;
  document.getElementById('ranges').innerHTML=RANGES.map(([k,n])=>`<button data-range="${k}" class="${k===RANGE?'on':''}" aria-pressed="${k===RANGE}">${n}</button>`).join('');
  document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{ RANGE=b.dataset.range; try{ localStorage.setItem('squad-admin-range',RANGE); }catch(e){} draw(...Object.values(LAST)); });
  const heroLabel={today:'Playing today','7':'Players, last 7 days','30':'Players, last 30 days',all:'Players, all time'}[RANGE];
  document.getElementById('out').innerHTML=`
  ${denied?`<section class="warn"><header><h2>One setup step</h2></header><p>Firebase is blocking part of this page, so some players aren't being counted. In the Firebase console open <b>Realtime Database → Rules</b>, select everything in the box, delete it, paste this, and click <b>Publish</b>. It's your complete set of rules (online games, saves, stats and this page). Only this browser can read the numbers.</p><pre id="rules">${esc(rulesFor(uid))}</pre><button id="copy">Copy</button></section>`:''}
  <section class="hero">
    <div class="today"><span class="lbl">${heroLabel}</span><b>${fmt(active)}</b>
      <small>${hasSeen?`${fmt(fresh)} new · ${fmt(returning)} returning`:`${fmt(fresh)} new`} · ${fmt(games)} games${RANGE==='today'&&d(shiftDay(today,-1),'players')?` · yesterday ${fmt(activeIn([shiftDay(today,-1)]))}`:''}</small></div>
    ${isAll?`<div class="weekbox"><span class="lbl">Came back another day</span><b>${pct(cameBack,settled.length)}%</b><small>${fmt(cameBack)} of ${fmt(settled.length)} people</small></div>`
      :`<div class="weekbox"><span class="lbl">${RANGE==='today'?'Yesterday':'The '+span+' days before'}</span><b>${fmt(before)}</b><small>${trend===null?'players':`<i class="${trend>=0?'up':'down'}">${trend>=0?'▲':'▼'} ${Math.abs(trend)}%</i> now vs then`}</small></div>`}
  </section>
  ${mixNote}
  <div class="tiles">
    ${tile(fmt(hasSeen?plist.length+Math.max(0,sum(allDays.filter(x=>x<seenStart).filter((x,i,a)=>a.indexOf(x)===i).map(x=>d(x,'new')))-plist.filter(q=>q.old).length):t.players),'Players ever',hasSeen?`people · ${fmt(Object.keys(seen).length)} browsers`:'browsers, not people')}
    ${tile(fmt(fresh),'New players',rangeName)}
    ${tile(fmt(games),'Games started',`${fmt(opens)} opens`)}
    ${tile(hasSeen?pct(cameBack,settled.length)+'%':'–','Came back','played on 2+ days')}
  </div>
  ${card('Players each day',`People who opened the game each New York day. Hover or tap a day.`,`<div id="chart" class="chart"></div>`,'','日')}
  <div class="grid2">
    ${card('Where',`People active in ${rangeName}, by their device's time zone. A rough region, not an exact city.`,rowsOf(wheres.slice(0,12),Math.max(0,...wheres.map(m=>m[1]))),'','地')}
    ${card('Came from',`New players in ${rangeName}, by the link they opened (slayersquad.app/?from=tiktok). Counted from Nov 4, 2026.`,froms.length?rowsOf(froms.slice(0,10),Math.max(...froms.map(m=>m[1]))):'<p class="empty">Nothing yet. Share links with ?from= on the end.</p>','','源')}
  </div>
  <div>
    ${card('Devices',`People active in ${rangeName}.`,devTotal?`<div class="stack" role="img" aria-label="${devs.map(x=>`${x.n} ${pct(x.v,devTotal)}%`).join(', ')}">${devs.filter(x=>x.v).map(x=>`<i style="flex:${x.v};background:${DEV_COLORS[x.k]}" title="${x.n}: ${x.v}"></i>`).join('')}</div>
      <div class="legend">${devs.map(x=>`<div><i style="background:${DEV_COLORS[x.k]}"></i><span>${x.n}</span><b>${pct(x.v,devTotal)}%</b><small>${fmt(x.v)}</small></div>`).join('')}</div>`:'<p class="empty">Nothing in this time range.</p>','','機')}
  </div>
  ${card('Modes',`Matches started in ${rangeName}, and how many were played to the end.${datedNote}`,modes.length?`<div class="modes">${modes.map(m=>`<div class="mode"><span>${esc(m.name)}</span><b>${fmt(m.start)}</b><small>${pct(m.fin,m.start)}% finished${m.win?` · ${m.win} won`:''}</small><u><i style="width:${Math.max(2,m.start/modes[0].start*100)}%"></i></u></div>`).join('')}</div>`:'<p class="empty">Nothing in this time range.</p>','','戦')}
  <div class="grid2">
    ${card('Story',`Tries per battle in story order, ${rangeName}. Gold is wins, so a falling bar shows where players stop.${datedNote}`,story(main,Math.max(1,...main.map(r=>r.tries))),'','物')}
    ${card('Most played fighters <span class="pill">All time</span>','Online, Quickplay and Same Phone matches.',chars.length?`<div class="fighters">${chars.map((c,i)=>{ const img=portrait(c.id);
      return `<div class="fighter"><em>${i+1}</em>${img?`<img src="${img}" alt="" loading="lazy">`:`<span class="noimg">${esc(c.name[0])}</span>`}<span class="fn">${esc(c.name)}</span><small>${fmt(c.p)} picks</small><b class="${pct(c.w,c.p)>=50?'good':''}">${pct(c.w,c.p)}%</b></div>`; }).join('')}</div>`:'<p class="empty">Nothing yet.</p>','','剣')}
  </div>
  ${dream.length?card('The Endless Dream',`Tries per battle after the main story, ${rangeName}.`,story(dream,Math.max(1,...dream.map(r=>r.tries))),'','夢'):''}
  ${card(`Bug reports <span class="pill">${reps.length}</span>${crashes?` <span class="pill red">${crashes} crash${crashes>1?'es':''}</span>`:''}`,'',reps.length?reps.map(([id,r])=>`<div class="rep${r.auto?' auto':''}"><div class="rephead"><span class="tag">${r.auto?'Crash':'Report'}</span><small>${esc(new Date(r.at).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}))} · v${esc(r.v||'?')} · ${esc(r.where||'')}</small><button data-del="${esc(id)}" aria-label="Delete report">Delete</button></div><p>${esc(r.msg)}</p><small class="ua">${esc(r.ua||'')}</small></div>`).join(''):'<p class="empty">None. 🎉</p>','','虫')}
  ${denied?'':card('Make a progress code','One code for one person. They enter it in Settings → Save. It adds progress and never removes any.',`<div class="mk">
    <select id="upto">${ALL_STAGES.map((s,i)=>`<option value="${i}"${i===ALL_STAGES.length-1?' selected':''}>${i===ALL_STAGES.length-1?'Whole game':'Through '+esc(s.title)}</option>`).join('')}</select>
    <button id="mkcode" class="primary">Make code</button></div><b id="newcode" class="code"></b>`,'','鍵')}
  <p class="foot">This browser's admin ID: ${esc(uid)}</p>`;
  const chartDays=days.length>=14?days:dayKeys(14);
  drawChart(chartDays.map(x=>{ const ppl=hasSeen&&x>=seenStart?plist.filter(q=>q.days.has(x)).length:d(x,'players'); return {day:x, players:ppl, games:d(x,'games'), fresh:hasSeen&&x>=seenStart?plist.filter(q=>!q.old&&q.first===x).length:d(x,'new'), opens:d(x,'opens'), on:days.includes(x)}; }));
  const c=document.getElementById('copy'); if(c) c.onclick=()=>navigator.clipboard.writeText(rulesFor(uid)).then(()=>{ c.textContent='Copied'; });
  const mk=document.getElementById('mkcode'); if(mk) mk.onclick=()=>makeCode(+document.getElementById('upto').value);
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ if(confirm('Delete this report?')) firebase.database().ref('reports/'+b.dataset.del).remove().then(start); });
}
// Players each day: one gold area line, sized to its box, with a hover/tap read-out for each day
let CHART=[];
function drawChart(rows){
  if(rows) CHART=rows; const el=document.getElementById('chart'); if(!el) return;
  const W=el.clientWidth||600, H=W<480?170:210, L=30, R=12, T=14, B=34, iw=W-L-R, ih=H-T-B, n=CHART.length;
  const max=Math.max(4,...CHART.map(r=>r.players)), step=Math.max(1,Math.ceil(max/4)), top=step*4;
  const x=i=>L+(n<2?iw/2:i*iw/(n-1)), y=v=>T+ih-v/top*ih;
  const pts=CHART.map((r,i)=>[x(i),y(r.players)]), line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const wd=s=>new Date(s+'T12:00').toLocaleDateString([], {weekday:'short'}), md=s=>new Date(s+'T12:00').toLocaleDateString([], {month:'short', day:'numeric'});
  const every=Math.max(W<480?3:2, Math.ceil(n/(W<480?5:8))), on0=CHART.findIndex(r=>r.on);
  el.innerHTML=`<svg width="${W}" height="${H}" role="img" aria-label="Players each day over the last 14 days">
    <defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d6a54d" stop-opacity=".35"/><stop offset="1" stop-color="#d6a54d" stop-opacity="0"/></linearGradient></defs>
    ${[0,1,2,3,4].map(k=>`<line x1="${L}" x2="${W-R}" y1="${y(k*step)}" y2="${y(k*step)}" class="grid"/><text x="${L-8}" y="${y(k*step)+4}" class="ax" text-anchor="end">${k*step}</text>`).join('')}
    ${CHART.map((r,i)=>(i%every===(n-1)%every)?`<text x="${x(i)}" y="${H-16}" class="ax${i===n-1?' now':''}" text-anchor="middle">${i===n-1?'Today':wd(r.day)}</text><text x="${x(i)}" y="${H-3}" class="ax sm" text-anchor="middle">${+r.day.slice(8)}</text>`:'').join('')}
    ${on0>0?`<rect x="${x(on0)-(iw/(n-1))/2}" y="${T}" width="${x(n-1)-x(on0)+(iw/(n-1))/2}" height="${ih}" class="band"/><text x="${x(on0)-(iw/(n-1))/2+6}" y="${T+12}" class="ax sm">selected</text>`:''}
    <path d="${line} L${x(n-1)} ${T+ih} L${x(0)} ${T+ih} Z" fill="url(#ga)"/>
    <path d="${line}" class="ln"/>
    <line id="cx" y1="${T}" y2="${T+ih}" class="cross" style="display:none"/>
    <circle id="cd" r="5" class="dot" style="display:none"/>
    <circle cx="${pts[n-1][0]}" cy="${pts[n-1][1]}" r="5" class="dot now"/>
    <text x="${pts[n-1][0]-8}" y="${pts[n-1][1]-10}" class="val" text-anchor="end">${CHART[n-1].players}</text>
    <rect x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent" id="hit"/>
  </svg><div class="tip" id="tip"></div>`;
  const svg=el.querySelector('svg'), tip=el.querySelector('#tip'), cx=el.querySelector('#cx'), cd=el.querySelector('#cd');
  const show=e=>{ const r=svg.getBoundingClientRect(), px=(e.touches?e.touches[0].clientX:e.clientX)-r.left, i=Math.max(0,Math.min(n-1,Math.round((px-L)/(iw/(n-1))))), c=CHART[i];
    cx.setAttribute('x1',x(i)); cx.setAttribute('x2',x(i)); cx.style.display=''; cd.setAttribute('cx',pts[i][0]); cd.setAttribute('cy',pts[i][1]); cd.style.display='';
    tip.innerHTML=`<b>${i===n-1?'Today':wd(c.day)+', '+md(c.day)}</b><div><span>Players</span><em>${c.players}</em></div><div><span>New</span><em>${c.fresh}</em></div><div><span>Games</span><em>${c.games}</em></div><div><span>Opens</span><em>${c.opens}</em></div>`;
    tip.style.display='block'; const tw=tip.offsetWidth; tip.style.left=Math.max(0,Math.min(W-tw,x(i)-tw/2))+'px'; tip.style.top=Math.max(0,pts[i][1]-tip.offsetHeight-14)+'px'; };
  const hide=()=>{ tip.style.display='none'; cx.style.display='none'; cd.style.display='none'; };
  const hit=el.querySelector('#hit'); hit.addEventListener('pointermove',show); hit.addEventListener('pointerdown',show); hit.addEventListener('pointerleave',hide);
}
let RESIZE; addEventListener('resize',()=>{ clearTimeout(RESIZE); RESIZE=setTimeout(()=>drawChart(),150); });
// A save with every battle up to stage i won at 3 stars, at a new recovery code (unlocks follow from the battles won)
async function makeCode(i){
  const ABC='ABCDEFGHJKMNPQRSTUVWXYZ23456789', code=()=>Array.from({length:12},()=>ABC[Math.floor(Math.random()*ABC.length)]).join('');
  const ids=ALL_STAGES.slice(0,i+1).map(s=>s.id), story={cleared:ids, stars:Object.fromEntries(ids.map(id=>[id,3])), goals:Object.fromEntries(ids.map(id=>[id,[true,true,true]]))};
  const c=code(), el=document.getElementById('newcode');
  try{ await firebase.database().ref('saves/'+c).set({v:1, at:Date.now(), rev:code(), data:{[STORY_KEY]:JSON.stringify(story), 'squad-draft-dream-reset':'1'}}); el.textContent=c.match(/.{4}/g).join('-'); }
  catch(e){ el.textContent='Could not make it: '+e.message; }
}
// Copy all data (CK, Nov 7, 2026): everything start() loaded, as one JSON block to paste into Claude for analysis
let COPY_DATA=null;
document.getElementById('copyall').onclick=async e=>{
  const b=e.currentTarget, done=t=>{ b.textContent=t; setTimeout(()=>{ b.textContent='Copy all data'; },2500); };
  if(!COPY_DATA) return done('Still loading…');
  const text='Slayer Squad admin data\n'+JSON.stringify(COPY_DATA);
  try{ await navigator.clipboard.writeText(text); }
  catch(err){ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e2){} ta.remove(); }
  done(`Copied ✓ (${Math.max(1,Math.round(text.length/1024))} KB)`);
};
async function start(){
  const get=p=>firebase.database().ref(p).get().then(s=>s.val()||{});
  const uid=firebase.auth().currentUser.uid; let denied=false; const no=()=>{ denied=true; return {}; };
  const [t,reports,seen]=await Promise.all([get('track').catch(no),get('reports').catch(no),get('seen').catch(no)]);
  const stats=await get('stats').catch(()=>({}));
  COPY_DATA={copied:new Date().toISOString(), denied, track:t, stats, seen, reports};   // what Copy all data copies
  draw(uid, t, stats, reports, denied, seen);
}
document.getElementById('refresh').onclick=async e=>{ const b=e.currentTarget; b.classList.add('spin'); b.textContent='Loading…'; try{ await start(); }finally{ b.classList.remove('spin'); b.textContent='Refresh'; } };
(async()=>{ try{ localStorage.setItem('squad-draft-admin','1') }catch(e){}
  try{ for(const m of ['app','auth','database']) await load(`https://www.gstatic.com/firebasejs/${FB}/firebase-${m}-compat.js`);
    firebase.initializeApp(FIREBASE_CONFIG); await firebase.auth().signInAnonymously(); await start(); }
  catch(e){ document.getElementById('sub').textContent='Could not load: '+e.message; } })();
