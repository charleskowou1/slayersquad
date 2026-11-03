// Smoke test: plays 300 computer-vs-computer games (all difficulty levels and point budgets) and draws every screen along the way.
// Catches crashes in js/views.js without opening a browser.
// Usage:  node tools/check-screens.js
const { loadGame } = require('./load-game');
const ctx = loadGame(['roster.js', 'engine.js', 'story.js', 'daily.js', 'online.js', 'notes.js', 'effects.js', 'clips.js', 'updates.js', 'views.js', 'sound.js', 'tv.js'], `
// the TV battle board (js/tv.js) for 2-team games: every playback beat, and the waiting board, as a 2-player TV match
const TVT={code:'TEST', phones:{a:{name:'A'}, b:{name:'B'}}, seats:['a','b'], names:{a:'A', b:'B'}, saves:{}};
function tvBoardCheck(b){ const keep=[S.tv,S.tvDuo]; S.tv=TVT; S.tvDuo=!b; try{ vTvBoard(b); tvWaiting(); vTvHome(); tvChoices('tvhome'); tvChoices('story'); globalThis.TVN=(globalThis.TVN||0)+1; } finally { [S.tv,S.tvDuo]=keep; } }
// Final Form: draft, auto-lock on a full squad, reveal, sun clock, the end screen and refilling the squad
function finalCheck(){
  for(let g=0;g<60;g++){
    S={phase:'setup',mode:'cpu',names:['A'],vol:{sfx:0,music:0},speed:1}; useModeCfg('cpu'); if(!vModeSet().includes('gamemode') || vSetup().includes('gamemode')) throw new Error('Final Form: wrong screen'); gmDraft('final');
    if(S.pool.some(id=>BYID[id].demon && !BYID[id].helper)) throw new Error('Final Form: demon in the pool');
    if(S.pool.some(id=>BYID[id].fam==='yoriichi')) throw new Error('Final Form: Yoriichi in the pool');
    vDraft(); let k=0; while(S.phase==='draft' && k++<40){ cpuDraftStep('hard'); if(S.phase==='draft') vDraft(); }
    if(S.phase!=='reveal') throw new Error('Final Form: no reveal after the draft');
    if(!selflessOpen() || !sig2Open(BYID.zenitsu)) throw new Error('Final Form: specials still locked');
    { const z=mkUnit('zohakuten',1); if(z.pow<=BYID.zohakuten.pow) throw new Error('Final Form: spawned forms not buffed'); }
    const foes=S.picks[1]; if(foes[0]!=='muzan_final' || foes.length!==4 || new Set(foes).size!==4 || foes.slice(1).some(id=>!BYID[id].upper)) throw new Error('Final Form: bad enemy team '+foes);
    if(S.teams[1][0].pow<Math.round(BYID.muzan_final.pow*(1+FINAL_POW))) throw new Error('Final Form: no buff'); vReveal();
    if(sunRise()!==FINAL_SUNRISE) throw new Error('Final Form: wrong sunrise'); S.phase='plan'; vPlan();
    k=0; while(S.phase!=='over' && k++<200){ cpuBothSides(); resolve(); if(S.phase==='result') S.round++; if(S.phase==='plan') vPlan(); }
    if(S.phase!=='over') throw new Error('Final Form: battle never ended'); gmRecord(S.winner===0); winHero(); overBar();
    gmAgain(); if(S.phase!=='draft' || S.picks[0].length) throw new Error('Try again did not open a fresh draft');
    S.mode='cpu'; if(sunRise()!==SUNRISE_ROUND) throw new Error('sunrise moved outside Final Form');
  }
  return 'Final Form: 60 runs passed.';
}
// Game Modes: every mode from its card to its end screen, including a run's next fight
function modesCheck(){
  S.unlockAll=true; const play=()=>{ vReveal(); S.phase='plan'; vPlan(); let k=0; while(S.phase!=='over' && k++<200){ cpuBothSides('hard',S.level); resolve(); if(S.phase==='result') S.round++; if(S.phase==='plan') vPlan(); } if(S.phase!=='over') throw new Error(S.mode+': battle never ended'); gmRecord(S.winner===0); winHero(); overBar(); };
  for(let g=0;g<80;g++){ const mode=Object.keys(GM)[g%3]; S={phase:'setup',mode:'cpu',names:['A'],vol:{sfx:0,music:0},speed:1,unlockAll:true}; useModeCfg('cpu'); vModeSet(); gmStart(mode);
    if(!S.unlockAll) throw new Error(mode+': not every character open');
    if(mode!=='random'){ vDraft(); let k=0; while(S.phase==='draft'&&k++<40) cpuDraftStep('hard'); }
    if(S.phase!=='reveal') throw new Error(mode+': no reveal');
    if(mode==='random' && (S.budget<5 || S.budget>50 || S.picks.some(t=>!t.length || t.reduce((x,id)=>x+BYID[id].cost,0)>S.budget))) throw new Error('random: bad deal at '+S.budget);
    if(mode==='random'){ S.qpClassic=true; S.mode='cpu'; useModeCfg('cpu'); if(!vModeSet().includes('cfglevel')) throw new Error('Classic: no settings'); S.qpClassic=false; S.mode=mode; }
    if(mode==='random' && S.picks[0].some(a=>S.picks[1].some(b=>BYID[a].fam===BYID[b].fam))) throw new Error('random: same character on both teams');
    for(const n of [3,4]){ const r=dealSquads('random',n).flat().map(id=>BYID[id].fam), m=dealSquads('mirror',n); if(new Set(r).size!==r.length) throw new Error('random: a character on two teams with '+n); if(m.some(t=>t.join()!==m[0].join())) throw new Error('mirror: teams differ with '+n); }
    if(mode==='rush' && S.picks[0].some(id=>BYID[id].demon)) throw new Error('rush: demon on your team');
    play(); let n=0;
    while(S.series && S.winner===0 && gmFights()>S.series.wave && n++<30){ const up=S.teams[0].filter(u=>u.alive).map(u=>u.hp); gmNext(); if(S.phase!=='reveal' || S.teams[0].some(u=>!u.alive) || S.teams[0].some((u,i)=>u.hp<up[i])) throw new Error(mode+': survivors did not carry over'); if(S.mode==='rush' && S.picks[1].slice(0,RUSH_FIGHTS[S.series.wave-1].length).join()!==RUSH_FIGHTS[S.series.wave-1].join()) throw new Error('rush: wrong fight'); play(); }
    if(!S.teams[0].length) throw new Error(mode+': empty team');
    gmAgain(); if(mode==='random' ? S.phase!=='reveal' : S.phase!=='draft' || S.picks[0].length) throw new Error(mode+': try again did not restart');
  }
  for(let g=0;g<24;g++){ const h=2+g%3, coop=g%2?'final':'gauntlet'; S={mode:'online',me:0,planFor:0,hostSeat:0,n:2,names:['A','B','C','D'].slice(0,h),phase:'lobby',cfg:{gm:coop,budget:20,poolType:'random'},lobby:{code:'TEST',seats:[1,2,3].map(i=>i<h?{name:'x',on:true}:null)},vol:{sfx:0,music:0},speed:1}; vLobby();
    if(!hostStartMatch()) throw new Error('co-op did not start'); coopStart(); vDraft(); let k=0; while(S.phase==='draft'&&k++<80){ cpuDraftStep('hard'); if(S.phase==='draft') vDraft(); }
    if(S.phase!=='plan' || S.teams.length!==h+1) throw new Error('co-op: no fight'); for(let f=0;f<4;f++){ vPlan(); k=0; while(S.phase!=='over'&&k++<200){ players().forEach(p=>cpuPlan(p,'hard')); resolve(); if(S.phase==='result') S.round++; if(S.phase==='plan') vPlan(); } S.final=true; winHero(); overBar(); if(!coopWon()||!S.series) break; S.final=false; coopAgain(); } }
  return 'Game Modes: 80 runs passed.';
}
function check(games){
  let errors=0, first='';
  // every character gets a test clip for every moment, so each clip beat gets drawn
  ROSTER.forEach(c=>{ CLIPS[c.id]=Object.assign(Object.fromEntries(Object.keys(CLIP_ACTS).map(a=>[a,'test.mp4'])), CLIPS[c.id]); });
  for(let g=0;g<games;g++){
    try{
      // cycles: 2, 3 and 4 players; Quickplay, Local and Online screens; every level, budget and pool type
      const level=['easy','normal','hard'][g%3], n=[2,3,4][g%3===0?0:(g%5)%3], mode=['cpu','local','online','practice'][g%4], maxTeam=[6,1,2,3,4,5,6][g%7];
      S={phase:'setup',mode,n,level,budget:[10,20,30][Math.floor(g/3)%3],poolType:g%10===0?'all':'random',maxTeam,unlockAll:g%2===0,bansOn:g%3===1,duo:n===4&&g%2===1,names:['A','B','C','D'].slice(0,n),me:mode==='online'?g%n:0};
      ['local','online','cpu','practice','story'].forEach(m=>{ S.mode=m; vSetup(); if(m!=='story') vModeSet(); }); S.mode=mode; S.settings=true; vSheet(); S.setTab='stats'; vSheet(); S.setTab='save'; vSheet(); S.setTab='general'; S.settings=false;
      S.install={ios:g%2===0,mobile:true,standalone:false,canPrompt:g%3===0}; vSetup(); S.install=null;
      if(mode==='online'){ S.phase='lobby'; S.lobby={code:'TEST',seats:[{name:'B',on:true},{name:'C',on:n>2},null]}; vLobby(); S.phase='setup'; }
      S.spin=newGuess(); vSpin(); if(guessPick(0,10) || guessPick(0,0)) throw new Error('number game took a number outside 1-9');
      players().forEach((q,i)=>{ if(i===1 && guessPick(q, S.spin.picks[0])) throw new Error('number game allowed the same number twice'); cpuGuess(q); vSpin(); });
      if(S.spin.state==='coin'){ vSpin(); if(guessCall(S.spin.tied.who[0],'edge')) throw new Error('coin took a bad side'); cpuCall(); }   // a tie: call the coin
      if(S.spin.state!=='done') throw new Error('number game did not finish'); vSpin();
      { const g=S.spin, d=g.picks.map(n=>Math.abs(n-g.secret)); if(d[g.r]!==Math.min(...d)) throw new Error('number game: the closest did not go first'); }
      if(S.spin.r<0||S.spin.r>=n) throw new Error('spin winner out of range');
      newDraft(S.spin.r);
      if(turn()!==S.spin.r) throw new Error('spin winner did not pick first');
      if(S.pool.some(id=>BYID[id].cost>maxCardCost())) throw new Error('card over the cost cap dealt');
      if(S.bansOn){ for(let b=0;b<n;b++){ if(!S.banning) throw new Error('ban round ended early'); vDraft(); S.sel=S.pool[0]; vSheet(); S.sel=null; cpuBan(); }
        if(S.banning || S.bans.length!==n) throw new Error('ban round did not finish'); if(S.pool.some(id=>S.bans.some(b=>BYID[b.id].fam===BYID[id].fam) && canPick(turn(),id))) throw new Error('banned card can be picked'); }
      let k=0; while(S.phase==='draft'&&k++<200){ vDraft(); if(k===1){ S.quitAsk=true; vSheet(); S.quitAsk=false; } { const keep=S.tv; S.tv=TVT; vTvDraft(); S.tv=keep; } S.pool.forEach(id=>{ S.sel=id; vSheet(); }); pocketDraft(turn()); S.sel=null; cpuDraftStep(level); }
      if(S.phase==='draft') throw new Error('draft did not finish');
      if(S.teams.length!==n) throw new Error('wrong number of teams');
      if(S.teams.some(t=>t.length>maxTeam)) throw new Error('a team is over the max fighters setting');
      S.helpers[0]=['crow']; vPass();
      while(S.phase!=='over'){
        const me=S.me||0;
        players().forEach(p=>{ if(!alive(p).length) return; S.planFor=p; S.focus=null; if(p===me) vPlan();
          alive(p).forEach(u=>{ if(u.stun) return; setMove(u,u.cd?'attack':'special'); const o=targetOptions(u,S.plans[p][u.uid]); if(o.length) S.plans[p][u.uid].t=o[0].uid; if(p===me) vPlan(); });
          if(!planReady(p)) throw new Error('plan not ready after choosing every move'); });
        players().forEach(p=>cpuHelpers(p)); S.scoutP=0; S.phase='scout'; vScout(); S.scouting=true; S.planFor=0; vPlan(); S.scouting=false; S.phase='ready'; vReady(); allUnits().forEach(u=>{ S.info=u.uid; vSheet(); }); S.info=null;
        resolve(); const ph=S.phase; S.phase='result';
        const steps=playSteps(S.log); for(let i=0;i<steps.length;i++){ S.play={k:i,done:false,steps}; S.play.clip=steps[i][1]>steps[i][0]?null:clipStep(S.log[steps[i][0]]); vResult(); if(n===2) tvBoardCheck(playBeat()); }
        if(n===2) tvBoardCheck(null); S.play=null; vResult(); S.phase=ph; if(S.phase==='result') S.round++;
      }
      vOver(); recordMatch(); if(n>2 && !S.duo && placings().flat().length!==n && S.winner>=0 && S.round<40) throw new Error('placings missing a team'); vSetup();
    }catch(e){ errors++; if(!first) first=e.stack; }
  }
  // codex: every filter and every card's entry
  try{ S={phase:'codex',mode:'cpu',names:['A']}; CODEX_GROUPS.forEach(([f])=>{ S.codexF=f; vCodex(); }); ROSTER.filter(c=>!c.spawn).forEach(c=>{ S.codexSel=c.id; vSheet(); }); }
  catch(e){ errors++; if(!first) first='codex: '+e.stack; }
  // daily challenge: the menu card, the battle and the result
  try{ S={phase:'setup',mode:'cpu',names:['A']}; vSetup(); dailyChallenge(); vSetup(); startDaily(); vDraft();
    if(S.locked[0] || !S.locked[1] || S.picks[1].length<2) throw new Error('daily draft not set up');
    let k=0; while(S.phase==='draft'&&k++<40){ cpuDraftStep('hard'); vDraft(); } vPlan();
    while(S.phase!=='over'){ cpuPlan(0); cpuPlan(1,S.level); resolve(); if(S.phase==='result') S.round++; } S.dailyMet=dailyMet(S.daily); vOver();
  }catch(e){ errors++; if(!first) first='daily: '+e.stack; }
  // story mode: every stage's map and scene, the preset battle (with repeat), a draft replay (with undo) and results
  let storyErrors=0, mids=0;
  for(const camp of ['main','dream','six']){ setCampaign(camp); for(let i=0;i<STAGES.length;i++){
    try{
      S={phase:'story',mode:'story',level:'hard',names:['A','B'],campaign:camp}; vStory(); vSetup();
      S.storySel=i; vStory(); S.starsGot=2; S.starsBest=1;
      startStage(i); for(S.sceneAt=0;S.sceneAt<STAGES[i].scene.length;S.sceneAt++) vScene(); S.sceneAt=0; S.sceneVs=true; vScene(); beginStage();
      if(S.phase==='order'){ S.waveOrder=['rengoku']; vOrder(); S.waveOrder=STAGES[i].mine.slice(); beginStage(); }
      if(S.phase!=='plan') throw new Error('preset stage did not start the battle');
      S.planFor=0; vPlan(); cpuPlan(0); S.lastPlans[0]=JSON.parse(JSON.stringify(S.plans[0])); cpuPlan(1,stageLevel()); resolve();
      if(S.phase==='result'){ S.round++; S.phase='plan'; repeatPlans(0); vPlan(); }
      while(S.phase!=='over'){ cpuPlan(0); cpuPlan(1,stageLevel()); resolve(); vResult();
        if(S.midScene && S.midScene.length){ const ph=S.phase; S.phase='scene'; S.sceneMid=true; for(S.sceneAt=0;S.sceneAt<S.midScene.length;S.sceneAt++) vScene(); applyAwakenings(); S.sceneMid=false; S.midScene=null; S.phase=ph; mids++; }   // a Mark awakening's cutscene
        if(S.phase==='result') S.round++; }
      if((STAGES[i].awaken||[]).length && !S.teams[0].some(u=>u.awoke) && S.round>1) throw new Error('nobody awakened their Mark');
      vOver(); mvpPanel();
      // the ending scene, every line, then the unlock reveal
      Object.assign(S,{phase:'scene', sceneOutro:true, sceneVs:false, sceneUnlock:false, newUnlocks:STAGE_UNLOCKS[STAGES[i].id]});
      for(S.sceneAt=0;S.sceneAt<STAGES[i].outro.length;S.sceneAt++) vScene(); S.sceneAt=0; S.sceneUnlock=true; for(S.unlockAt=0;S.unlockAt<Math.max(1,S.newUnlocks.length);S.unlockAt++) vScene(); S.sceneOutro=false; S.sceneUnlock=false;
      startStage(i,true); vScene(); beginStage(); vDraft();
      const cheap=S.pool.filter(id=>canPick(0,id)).sort((x,y)=>BYID[x].cost-BYID[y].cost)[0]; doPick(cheap); vDraft(); if(!undoable()) throw new Error('no undo after a pick'); undoPick();
      if(S.picks[0].length) throw new Error('undo did not remove the pick');
      let k=0; while(S.phase==='draft'&&k++<20){ cpuDraftStep('hard'); vDraft(); }
      while(S.phase!=='over'){ cpuPlan(0); cpuPlan(1,stageLevel()); resolve(); if(S.phase==='result') S.round++; }
      vOver();
    }catch(e){ storyErrors++; if(!first) first='story stage '+i+': '+e.stack; errors++; }
  }
  } setCampaign('main'); try{ S.title='Water'; vCeremony(); S.titleDone=true; vCeremony(); }catch(e){ errors++; first=first||'ceremony: '+e.stack; }
  return errors ? errors+' runs crashed. First error:\\n'+first : 'All '+games+' games and all '+STAGES.length+' story stages drew every screen without errors ('+mids+' Mark awakening scenes, '+(globalThis.TVN||0)+' TV board beats).';
}
`);
if(!require('./make-art-list').check()){ console.log('Picture list is out of date: run node tools/make-art-list.js'); process.exitCode=1; }
console.log(ctx.check(300));
console.log(ctx.finalCheck());
console.log(ctx.modesCheck());
