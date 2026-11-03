/* ================= POOL NOTES =================
   Plain-language notes on the synergies and matchups that are possible with the characters dealt this draft.
   Keep the wording in step with synergies(), the passives and the specials in engine.js. No DOM. */
function poolNotes(){
  // fam → a card of that character in the pool (inPool) and every version of it in the pool (versions; several in the All pool)
  const inPool = {}, versions = {}; S.pool.forEach(id=>{ const f=BYID[id].fam; inPool[f]=inPool[f]||id; (versions[f]=versions[f]||[]).push(id); });
  const has = f => f in inPool;
  const who = f => S.picks.findIndex(team=>team.some(id=>BYID[id].fam===f));   // owner, or -1
  const famsWhere = test => Object.keys(inPool).filter(f=>test(BYID[inPool[f]]));
  const free = fs => fs.filter(f=>who(f)<0);

  // Points: a note only counts as possible if a team can still afford the characters it needs.
  const cost = f => Math.min(...versions[f].map(id=>BYID[id].cost));          // cheapest version of that character in the pool
  const sum = fs => fs.reduce((a,f)=>a+cost(f),0);
  const cheapest = (fs,n) => fs.slice().sort((a,b)=>cost(a)-cost(b)).slice(0,n);
  const fighters = p => S.picks[p].filter(id=>!BYID[id].helper).length;
  // can team p still add these (not yet picked) characters: enough points left and fighter slots, and not locked
  const canAdd = (p,fs) => !S.locked[p] && spent(p)+sum(fs) <= budget() && fighters(p)+fs.length <= teamCap();
  const fits = fs => sum(fs) <= budget() && fs.length <= teamCap();   // affordable at all on a fresh team

  // state of a note: 'on' (a team has it, p = that team), 'open' (still possible), 'off' (can't happen any more),
  // or 'never' (no team could ever afford it in this match: the note isn't shown)
  // all of these fighters on one team
  const together = fs => Object.assign(together_(fs), {rule:{type:'all', fams:fs}});
  function together_(fs){
    if(!fits(fs)) return {state:'never'};
    const o=fs.map(who), owners=[...new Set(o.filter(x=>x>=0))];
    if(owners.length>1) return {state:'off'};
    if(owners.length===1){ const p=owners[0]; if(o.every(x=>x===p)) return {state:'on',p}; return {state: canAdd(p,free(fs))?'open':'off'}; }
    return {state: players().some(p=>canAdd(p,fs))?'open':'off'};
  }
  // two or more of these fighters on one team
  const twoOf = fs => Object.assign(twoOf_(fs), {rule:{type:'two', fams:fs}});
  function twoOf_(fs){
    if(!fits(cheapest(fs,2))) return {state:'never'};
    for(const p of players()) if(fs.filter(f=>who(f)===p).length>=2) return {state:'on',p};
    const can=players().some(p=>{ const need=2-fs.filter(f=>who(f)===p).length, pick=cheapest(free(fs),need); return pick.length===need && canAdd(p,pick); });
    return {state: can?'open':'off'};
  }
  // `anchor` plus at least one of `others` on one team
  const withAnchor = (anchor, others) => Object.assign(withAnchor_(anchor, others), {rule:{type:'anchor', anchor, fams:[anchor,...others]}});
  function withAnchor_(anchor, others){
    if(!fits([anchor, ...cheapest(others,1)])) return {state:'never'};
    const m=who(anchor);
    if(m>=0 && others.some(f=>who(f)===m)) return {state:'on',p:m};
    const can=players().some(p=>{
      if(m>=0 && m!==p) return false;
      const need=m===p?[]:[anchor];
      if(others.some(f=>who(f)===p)) return canAdd(p,need);
      const o=cheapest(free(others),1); return o.length && canAdd(p,[...need,...o]);
    });
    return {state: can?'open':'off'};
  }
  // a fighter from A on a different team to a fighter from B
  function facing(A, B){
    for(const a of A) for(const b of B){ const x=who(a), y=who(b); if(x>=0 && y>=0 && x!==y) return {state:'on'}; }
    const can=(f,p)=>who(f)===p || (who(f)<0 && canAdd(p,[f]));
    return {state: A.some(a=>B.some(b=>a!==b && players().some(p=>others(p).some(q=>can(a,p)&&can(b,q))))) ? 'open' : 'off'};
  }

  const N=[];
  const add=(kind, fams, title, text, st) => { if(st.state!=='never') N.push(Object.assign({kind, ids:fams.flatMap(f=>versions[f]), side:kind==='vs'?versions[fams[0]]:null, title, text}, st)); };

  // same team
  const kama=['tanjiro','zenitsu','inosuke'];
  if(kama.every(has)) add('team', kama, 'Kamaboko Squad', 'All three on one team: the whole team gets +2 SPD.', together(kama));
  if(has('tanjiro')&&has('nezuko')) add('team', ['tanjiro','nezuko'], 'Siblings', 'On one team: when either is hit, the other strikes back at the attacker for 3 damage.', together(['tanjiro','nezuko']));
  if(has('yoriichi')&&has('tanjiro')) add('team', ['yoriichi','tanjiro'], 'Sun Lineage', 'Yoriichi and Tanjiro on one team: Tanjiro gets +2 PWR.', together(['yoriichi','tanjiro']));
  if(has('tamayo')&&has('yushiro')) add('team', ['tamayo','yushiro'], 'Devoted', 'Tamayo and Yushiro on one team: Yushiro gets +2 PWR.', together(['tamayo','yushiro']));
  if(has('gyutaro')&&has('daki')) add('team', ['gyutaro','daki'], 'Two as One', 'Gyutaro and Daki on one team: Gyutaro gets +2 PWR, and if one falls while the other still stands, they get back up at the end of the round with 30% (once each). Knock both out in the same round to stop it.', together(['gyutaro','daki']));
  if(has('susamaru')&&has('yahaba')) add('team', ['susamaru','yahaba'], 'Temari & Arrows', "Susamaru and Yahaba on one team: Yahaba's arrows guide Susamaru's hits past Defend.", together(['susamaru','yahaba']));
  if(has('kanae')&&has('shinobu')) add('team', ['kanae','shinobu'], 'Kocho Sisters', "Kanae and Shinobu on one team: Shinobu's poison lasts 4 rounds instead of 3.", together(['kanae','shinobu']));
  if(has('kanae')&&has('kanao')) add('team', ['kanae','kanao'], "Kanae's student", 'Kanae and Kanao on one team: Kanao gets +1 PWR.', together(['kanae','kanao']));
  if(has('sanemi')&&has('genya')) add('team', ['sanemi','genya'], 'Brothers', 'Sanemi and Genya on one team: both get +2 PWR.', together(['sanemi','genya']));
  if(has('obanai')&&has('mitsuri')) add('team', ['obanai','mitsuri'], 'Love Hashira', 'Obanai and Mitsuri on one team: both get +1 PWR and +1 SPD.', together(['obanai','mitsuri']));
  if(has('rengoku')&&has('tanjiro')) add('team', ['rengoku','tanjiro'], 'Set Your Heart Ablaze', 'Rengoku and any Tanjiro on one team: Tanjiro gets +1 PWR and Rengoku +1 DEF.', together(['rengoku','tanjiro']));
  if(has('giyu')&&has('sabito')) add('team', ['giyu','sabito'], 'Old Friends', 'Giyu and Sabito on one team: Giyu gets +2 PWR and +1 DEF, Sabito +1 SPD.', together(['giyu','sabito']));
  if(has('typezero')&&has('muichiro')) add('team', ['typezero','muichiro'], 'Training partner', 'Yoriichi Type Zero and Muichiro on one team: Muichiro gets +1 PWR.', together(['typezero','muichiro']));
  const wiveList=['hinatsuru','makio','suma'].filter(has);
  if(wiveList.length===3) add('team', wiveList, 'The Three Wives', 'Hinatsuru, Makio and Suma on one team: all three get +1 SPD.', together(wiveList));
  if(has('tengen')&&wiveList.length) add('team', ['tengen',...wiveList], "Tengen's Family", 'Tengen or Retired Tengen plus any of his wives on one team: Tengen gets +1 PWR.', withAnchor('tengen',wiveList));
  if(has('tanjuro')&&has('tanjiro')) add('team', ['tanjuro','tanjiro'], 'Father and Son', 'Tanjuro and any Tanjiro on one team: Tanjiro gets +2 PWR.', together(['tanjuro','tanjiro']));
  if(has('makomo')&&has('sabito')) add('team', ['makomo','sabito'], "Urokodaki's Pupils", 'Makomo and Sabito on one team: both get +1 SPD.', together(['makomo','sabito']));
  const hashira=famsWhere(c=>c.hashira);
  if(hashira.length>=2) add('team', hashira, 'Hashira', 'Two or more Hashira on one team: each Hashira gets +1 PWR.', twoOf(hashira));
  const upper=famsWhere(c=>c.upper);
  if(upper.length>=2) add('team', upper, 'Upper Moons', 'Two or more Upper Moons on one team: each regenerates 1 more HP a round.', twoOf(upper));
  const marks=famsWhere(c=>c.mark);
  if(marks.length>=2) add('team', marks, 'Marks spread', 'Two or more Mark ✦ fighters on one team: each gets +1 SPD.', twoOf(marks));
  const kin=famsWhere(c=>c.demon && c.fam!=='muzan' && c.fam!=='nezuko');
  if(has('muzan')&&kin.length) add('team', ['muzan',...kin], "Muzan's Blood", 'Muzan plus another demon (not Nezuko) on one team: Muzan and those demons get +1 PWR.', withAnchor('muzan',kin));

  const pupils=['tanjiro','giyu','sabito'].filter(has);
  if(has('urokodaki')&&pupils.length) add('team', ['urokodaki',...pupils], 'Mentor', 'Urokodaki plus Tanjiro, Giyu or Sabito on one team: his pupils get +1 DEF.', withAnchor('urokodaki',pupils));
  if(has('kagaya')&&hashira.length) add('team', ['kagaya',...hashira], 'Corps Master', 'Kagaya plus any Hashira on one team: every Hashira on that team gets +1 DEF.', withAnchor('kagaya',hashira));
  const markable=hashira.filter(f=>!BYID[inPool[f]].mark && BYID[f+'_mark']);   // Hashira with a Mark card still to awaken (not Rengoku, Tengen or Shinobu)
  if(has('kagaya')&&markable.length) add('team', ['kagaya',...markable], 'Final Resolve', "Kagaya's special knocks himself out and every Hashira on his team who has a Mark awakens it. If an enemy knocks him out first, nobody awakens.", withAnchor('kagaya',markable));

  // opposing teams
  if(has('rengoku')&&has('akaza')) add('vs', ['rengoku','akaza'], 'Rival', 'Facing Akaza, Rengoku gets +2 PWR.', facing(['rengoku'],['akaza']));
  const avengers=['kanao','inosuke'].filter(has);
  if(has('doma')&&avengers.length) add('vs', [...avengers,'doma'], 'Revenge on Doma', 'Facing Doma, Kanao and Inosuke get +2 SPD, and their hits on Doma do 4 more damage and ignore his DEF.', facing(avengers,['doma']));
  if(has('kaigaku')&&has('zenitsu')) add('vs', ['zenitsu','kaigaku'], 'Rivals', 'Facing Kaigaku, Zenitsu gets +2 PWR.', facing(['zenitsu'],['kaigaku']));
  if(has('muzan')&&has('yoriichi')) add('vs', ['muzan','yoriichi'], 'Muzan fears the Sun', 'Facing Yoriichi, Muzan gets −3 PWR and −2 SPD.', facing(['muzan'],['yoriichi']));
  if(has('kokushibo')&&has('yoriichi')) add('vs', ['kokushibo','yoriichi'], 'Kokushibo shaken', 'Facing Yoriichi, Kokushibo gets −1 DEF.', facing(['kokushibo'],['yoriichi']));
  if(has('tamayo')&&has('muzan')) add('vs', ['tamayo','muzan'], "Tamayo's medicine", 'Facing Tamayo, Muzan regenerates 2 less HP a round.', facing(['tamayo'],['muzan']));
  const demons=famsWhere(c=>c.demon);
  const eaters=demons.filter(f=>f!=='akaza');   // demons who would devour Shinobu (Akaza never eats women)
  if(has('shinobu')&&eaters.length) add('vs', ['shinobu',...eaters], 'Wisteria Body', 'If a demon lands the blow that knocks Shinobu out, it devours her and loses 5 HP every round for the rest of the match. Akaza is the exception: he never eats women.', facing(['shinobu'],eaters));
  const regen=demons.filter(f=>BYID[inPool[f]].regen && !BYID[inPool[f]].sunproof);   // Demon King Tanjiro is sun-proof
  if(S.pool.includes('yoriichi') && regen.length) add('vs', ['yoriichi',...regen], 'Sun Breathing', "Yoriichi's special hits every enemy, and demons it hits stop regenerating for the rest of the match.", facing(['yoriichi'],regen));
  const poison=['shinobu','gyutaro'].filter(has);
  if(has('tamayo')&&poison.length) add('vs', ['tamayo',...poison], 'Antidote', "Tamayo's heal also cures poison, so she can undo Shinobu's and Gyutaro's poison on her team.", facing(['tamayo'],poison));

  // Partner lists in the panel: only list characters that some team could still complete the synergy with, within
  // its points and slots. "All of these" notes keep every member (they're already off if no team can afford them).
  N.forEach(n=>{ const r=n.rule; if(!r || r.type==='all') return;
    // could team t still complete this synergy using f (alongside what t already has, or one more free member)?
    const couldUse=(t,f)=> r.type==='two'
      ? (r.fams.some(x=>x!==f && who(x)===t) ? canAdd(t,[f]) : r.fams.some(x=>x!==f && who(x)<0 && canAdd(t,[f,x])))
      : (who(r.anchor)===t ? canAdd(t,[f]) : who(r.anchor)<0 && canAdd(t,[f,r.anchor]));
    const keep=f=> f===r.anchor || who(f)>=0 || players().some(t=>couldUse(t,f));
    n.ids=n.ids.filter(id=>keep(BYID[id].fam)); });
  const rank={on:0, open:1, off:2};
  return N.sort((a,b)=>rank[a.state]-rank[b.state]);
}

// Every synergy and matchup a character can ever be part of (for the Codex): the notes for a pool holding every card
function allNotesFor(id){
  const keep={pool:S.pool, picks:S.picks, locked:S.locked, n:S.n, budget:S.budget, maxTeam:S.maxTeam, duo:S.duo};
  Object.assign(S,{pool:ROSTER.filter(c=>!c.spawn).map(c=>c.id), picks:[[],[]], locked:[false,false], n:2, budget:30, maxTeam:MAXTEAM, duo:false});
  try{ return poolNotes().filter(n=>n.ids.includes(id)); } finally { Object.assign(S,keep); }
}
// Notes for one card, from the point of view of the player who'd draft it (p): a "same team" note only appears if p
// could afford that character together with the partners it needs (points left and fighter slots), and only those
// partners are listed. Example at 20 pts: viewing Giyu ✦ (10) won't suggest Gyomei ✦ (12) for the Hashira bonus.
function notesForCard(id, p){
  const c=BYID[id], f=c.fam, notes=poolNotes().filter(n=>n.ids.includes(id));
  if(others(p).some(q=>S.picks[q].includes(id))) return notes;      // another player has it: show as is
  const owned=S.picks[p].includes(id);
  const left=budget()-spent(p)-(owned?0:c.cost), slots=teamCap()-fighterIds(p).length-(owned||c.helper?0:1);
  const mine=fam=>S.picks[p].some(x=>BYID[x].fam===fam);
  const free=fam=>!allPicks().some(x=>BYID[x].fam===fam);
  const cost=fam=>Math.min(...S.pool.filter(x=>BYID[x].fam===fam).map(x=>BYID[x].cost));
  const fits=fams=>{ const need=fams.filter(x=>!mine(x)); return need.every(free) && need.reduce((a,x)=>a+cost(x),0)<=left && need.length<=slots; };
  return notes.map(n=>{
    const r=n.rule; if(n.kind!=='team' || !r || n.state==='off') return n;
    let ok;
    if(r.type==='all') ok = fits(r.fams.filter(x=>x!==f)) ? r.fams : [];
    if(r.type==='two') ok = r.fams.filter(x=>x!==f && (mine(x)||fits([x])));
    if(r.type==='anchor') ok = f===r.anchor ? r.fams.filter(x=>x!==f && (mine(x)||fits([x]))) : (mine(r.anchor)||fits([r.anchor])) ? [r.anchor] : [];
    if(!ok.length) return null;
    return Object.assign({}, n, {ids:n.ids.filter(x=>x===id || ok.includes(BYID[x].fam))});
  }).filter(Boolean);
}
