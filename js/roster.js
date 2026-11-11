/* ================= ROSTER =================
   Every character card. Stats here are the source of truth (the stats spreadsheet is generated from them). */
const ROSTER = [];
function add(c){ c.fam = c.fam || c.id; c.sk = c.sk || c.fam; ROSTER.push(c); return c; }
// Mark-awakened version of a character: its own card in the same family (only one version per draft pool)
function markOf(base, o){
  return add(Object.assign({}, base, {
    id: base.id+'_mark', name: base.name+' (Mark)', short: base.short+' ✦', mark:true, fam: base.fam, sk: base.sk,
    hp: base.hp+8, pow: base.pow+4, spd: base.spd+2, def: base.def+1,
    sig: Object.assign({}, base.sig, {cd: Math.max(1, base.sig.cd-1)})
  }, o));
}

// Legends
add({id:'yoriichi',name:'Yoriichi Tsugikuni',short:'Yoriichi',g:'陽',type:'Sun Breathing · Legend',legend:true,cost:18,hp:50,pow:15,spd:12,def:7,
  strikes:2,cap:18,
  passive:'Transparent World: strikes twice every Attack and never takes more than 18 damage in a round.',
  sig:{name:'Sun Breathing: Thirteenth Form',desc:'Every enemy takes PWR, ignores DEF. Demons it hits lose their regeneration for good.',cd:3,kind:'all'}});
add({id:'yoriichi_old',fam:'yoriichi',sk:'yoriichi_old',name:'Yoriichi (Age 85)',short:'Old Yoriichi',g:'老',type:'Sun Breathing · Legend',legend:true,cost:17,hp:50,pow:13,spd:11,def:5,
  strikes:2,cap:12,
  passive:'Still the Strongest: strikes twice every Attack and never takes more than 12 damage in a round.',
  sig:{name:'The Last Strike',desc:'Strike for PWR+10, ignores DEF.',cd:3,kind:'single'}});

// Demons
add({id:'muzan',name:'Muzan Kibutsuji',short:'Muzan',g:'鬼',type:'Demon King',demon:true,cost:16,hp:62,pow:17,spd:11,def:8,regen:5,
  sig:{name:'Blood Whips',desc:'Every enemy takes PWR−7, ignores DEF, and Muzan heals 2 for each enemy hit.',cd:3,kind:'all'}});
// Final-Form Muzan: the other version of Muzan (one or the other is dealt)
add({id:'muzan_final',fam:'muzan',sk:'muzan_final',name:'Muzan Kibutsuji (Final Form)',short:'Final Muzan',g:'終',type:'Demon King · Final Form',demon:true,cost:18,hp:64,pow:17,spd:11,def:8,regen:5,
  revive:.35,
  passive:'Seven Hearts: the first time he falls, he gets back up with 35% health. If he hasn’t used it by sunrise, he burns his hearts to heal 35% at once instead; after sunrise he never gets back up.',
  sig:{name:'Thorned Flesh Whips',desc:'Every enemy takes PWR−6, ignores DEF, and he heals 3 for each enemy hit.',cd:3,kind:'all'}});
add({id:'kokushibo',name:'Kokushibo',short:'Kokushibo',g:'月',type:'Upper Moon 1',demon:true,upper:true,cost:15,hp:50,pow:17,spd:11,def:8,regen:3,
  sig:{name:'Moon Breathing',desc:'Every enemy takes PWR−4, ignores DEF.',cd:3,kind:'all'}});
add({id:'doma',name:'Doma',short:'Doma',g:'氷',type:'Upper Moon 2',demon:true,upper:true,cost:11,hp:44,pow:14,spd:11,def:6,regen:3,
  sig:{name:'Frozen Lotus',desc:'Every enemy takes PWR−4, ignores DEF.',cd:3,kind:'all'}});
add({id:'akaza',name:'Akaza',short:'Akaza',g:'拳',type:'Upper Moon 3',demon:true,upper:true,cost:10,hp:43,pow:15,spd:10,def:5,regen:2,
  sig:{name:'Destructive Death: Compass Needle',desc:'Strike for PWR+6.',cd:3,kind:'single'},
  sig2:{id:'annihilation',name:'Destructive Death: Annihilation Type',desc:'Every enemy takes PWR−4, ignoring DEF.',cd:3,kind:'all',tag:'hit all, ignores DEF',quote:'Destructive Death: Annihilation Type!'}});
// Gyutaro and Daki: two cards. Together they're "Two as One" (see synergies() and fall() in engine.js).
add({id:'gyutaro',name:'Gyutaro',short:'Gyutaro',g:'鎌',type:'Upper Moon 6',demon:true,upper:true,cost:8,hp:40,pow:12,spd:9,def:5,regen:2,
  passive:'Two as One: with Daki on his team he gets +2 PWR. If one of them falls while the other is still standing, they get back up at the end of the round with 30% health (once each). Knock both out in the same round to stop it.',
  sig:{name:'Flying Blood Sickles',desc:'Every enemy takes 4 and is poisoned 2/round for 2 rounds.',cd:3,kind:'all'}});
add({id:'daki',name:'Daki',short:'Daki',g:'帯',type:'Upper Moon 6',demon:true,upper:true,cost:6,hp:30,pow:10,spd:9,def:4,regen:2,
  passive:'Two as One: with Gyutaro on her team, if one of them falls while the other is still standing, they get back up at the end of the round with 30% health (once each).',
  sig:{name:'Obi Sashes',desc:'Every enemy takes PWR−3, even through Defend: her blade bends around any guard.',cd:3,kind:'all'}});
// Nakime never attacks: her basic move (in place of Attack) is Biwa Strum. See resolve() in engine.js.
add({id:'nakime',name:'Nakime',short:'Nakime',g:'琵',type:'Upper Moon 4 · Infinity Castle',demon:true,upper:true,cost:4,hp:32,pow:0,spd:9,def:4,regen:2,
  basic:{name:'Biwa Strum',tag:'enemy acts last',k:'琵',flee:'Nakime is alone. She flees into the castle.',desc:'Instead of attacking: pick an enemy. They act last this round. Always goes first.'},
  passive:"Biwa, not blade: she never attacks. Her basic move, Biwa Strum, makes an enemy act last this round. If she's the last one standing on her team, she flees and counts as knocked out.",
  sig:{name:'Castle Shift',desc:"Moves first. Sends an enemy to another room: they can't act and can't be hit this round.",cd:3,kind:'single',prio:3}});
add({id:'gyokko',name:'Gyokko',short:'Gyokko',g:'壺',type:'Upper Moon 5',demon:true,upper:true,cost:6,hp:32,pow:10,spd:8,def:4,regen:2,
  sig:{name:'Water Prison Pot',desc:'Traps one enemy: it takes PWR−2 (ignores DEF) and can\'t act next round.',cd:3,kind:'single'}});
// Hantengu splits when knocked out: Hantengu → all four emotions (Sekido, Karaku, Aizetsu, Urogi). When the last
// emotion falls they merge into Zohakuten (merge: the form that appears once every form with that merge is down).
// The split-off forms (spawn:true) are never dealt in the draft; they only appear in battle.
// Hantengu (reworked Nov 10, 2026 with CK): cut him and it gets worse. The first hit cuts his head off and Sekido and
// Karaku burst out; the first of them to fall brings Aizetsu and Urogi; when the last emotion falls they merge into
// Zohakuten and the real Hantengu hides (one of HT_SPOTS hiding places, new every round). Hunt him (wrong guess: that
// fighter is wide open for the round), or knock Zohakuten down to expose him for a round; if the real one survives it,
// Zohakuten gets back up with HT_RISE of his health and the real one hides again. Cut down the real one to win.
let HT_SPOTS = 3, HT_RISE = 1/3;
add({id:'hantengu',name:'Hantengu',short:'Hantengu',g:'怯',type:'Upper Moon 4',demon:true,upper:true,cost:9,hp:16,pow:0,spd:9,def:4,regen:1,noDefend:true,
  basic:{name:'Cower',tag:'takes half damage',k:'怯',kind:'self',cower:true,desc:'Instead of attacking: he cowers and takes half damage this round.'},
  splitOnHit:['sekido','karaku'],
  passive:'Cut him and it gets worse. The first hit cuts his head off and Sekido and Karaku burst out; the first of them to fall brings Aizetsu and Urogi. When the last emotion falls they merge into Zohakuten, and the real Hantengu hides. Hunt him (guess where he is; a wrong guess leaves that fighter wide open), or knock Zohakuten down to expose him for a round (if the real one survives it, Zohakuten gets back up). Cut down the real one to win.',
  sig:{name:'Cowering Hide',desc:'Moves first. Hides: attacks miss him this round, and he heals 6.',cd:3,kind:'self',prio:3}});
// His forms (never dealt). Sekido and Karaku come from the head cut, Aizetsu and Urogi from the first emotion to fall.
add({id:'sekido',spawn:true,name:'Sekido (Anger)',short:'Sekido',g:'怒',type:'Hantengu · Anger',demon:true,cost:0,hp:8,pow:8,spd:8,def:4,regen:1,emo:true,
  passive:'Anger: cut him or Karaku and more emotions appear. When the last emotion falls, they merge into Zohakuten.',
  sig:{name:'Lightning Staff',desc:'Every enemy takes 5, ignores DEF.',cd:3,kind:'all'}});
add({id:'karaku',spawn:true,name:'Karaku (Joy)',short:'Karaku',g:'楽',type:'Hantengu · Joy',demon:true,cost:0,hp:8,pow:8,spd:10,def:3,regen:1,emo:true,
  passive:'Joy: cut him or Sekido and more emotions appear. When the last emotion falls, they merge into Zohakuten.',
  sig:{name:'Gale Fan',desc:'Every enemy takes PWR−6.',cd:3,kind:'all'}});
add({id:'aizetsu',spawn:true,name:'Aizetsu (Sorrow)',short:'Aizetsu',g:'哀',type:'Hantengu · Sorrow',demon:true,cost:0,hp:6,pow:9,spd:9,def:3,regen:1,emo:true,
  passive:'Sorrow: when the last emotion falls, they merge into Zohakuten.',
  sig:{name:'Cross Spear',desc:'One enemy takes PWR+4, even through Defend.',cd:3,kind:'single'}});
add({id:'urogi',spawn:true,name:'Urogi (Pleasure)',short:'Urogi',g:'喜',type:'Hantengu · Pleasure',demon:true,cost:0,hp:6,pow:7,spd:11,def:2,regen:1,emo:true,
  passive:'Pleasure: when the last emotion falls, they merge into Zohakuten.',
  sig:{name:'Sky Dive',desc:'Moves first. One enemy takes PWR+2.',cd:3,kind:'single',prio:1}});
add({id:'zohakuten',spawn:true,name:'Zohakuten (Hatred)',short:'Zohakuten',g:'憎',type:'Hantengu merged · Hatred',demon:true,cost:0,hp:20,pow:10,spd:8,def:6,regen:1,noDefend:true,drums:true,kin:'hantengu_true',
  passive:'Hatred: the four emotions in one body. No Defend: Drums of Hatred gives him +2 PWR for good instead. The real Hantengu hides while he fights. Knock Zohakuten down and the real one is exposed for a round; if he survives it, Zohakuten gets back up (a third of his health) and the real one hides again. Cut down the real one and Zohakuten crumbles.',
  sig:{name:'Wood Dragons',desc:'Every enemy takes PWR, even through Defend.',cd:3,kind:'all'}});
add({id:'hantengu_true',fam:'hantengu',spawn:true,name:'Hantengu (the real one)',short:'Real Hantengu',g:'怯',type:'Hantengu · the real one',demon:true,cost:0,hp:12,pow:0,spd:12,def:4,regen:1,noDefend:true,
  basic:{name:'Tremble',tag:'half damage',k:'怯',kind:'self',cower:true,desc:'Instead of attacking: he trembles and takes half damage.'},
  passive:'The real one: he never attacks. Cut him down and Zohakuten crumbles with him.',
  sig:{id:'flee',name:'Flee',desc:'Moves first. He scurries away and hides: attacks miss him this round.',cd:3,kind:'self',prio:3}});
add({id:'kaigaku',name:'Kaigaku',short:'Kaigaku',g:'獪',type:'Upper Moon 6 · fallen Thunder',demon:true,upper:true,cost:5,hp:26,pow:9,spd:10,def:3,regen:1,
  passive:'Rival: an enemy Zenitsu gets +2 PWR against him.',
  sig:{name:'Black Thunder',desc:'Strike for PWR+3, and a second random enemy takes 4.',cd:3,kind:'single'}});
add({id:'enmu',name:'Enmu',short:'Enmu',g:'夢',type:'Lower Moon 1',demon:true,cost:4,hp:28,pow:8,spd:8,def:3,regen:1,
  sig:{name:'Forced Sleep',desc:'Every enemy has to wait 2 more rounds for their special.',cd:3,kind:'all'}});
add({id:'rui',name:'Rui',short:'Rui',g:'糸',type:'Lower Moon 5',demon:true,cost:4,hp:24,pow:7,spd:7,def:4,regen:1,
  sig:{name:'Cutting Thread Cage',desc:'Strike for PWR and stun the target next round.',cd:3,kind:'single'}});
add({id:'kyogai',name:'Kyogai',short:'Kyogai',g:'鼓',type:'Former Lower Moon',demon:true,cost:3,hp:22,pow:6,spd:6,def:3,regen:1,
  sig:{name:'Drum Room Spin',desc:'Flip the room. The target is stunned next round.',cd:4,kind:'single'}});
add({id:'susamaru',name:'Susamaru',short:'Susamaru',g:'鞠',type:'Temari demon',demon:true,cost:3,hp:22,pow:7,spd:8,def:3,regen:1,
  passive:"Temari & Arrows: with Yahaba on her team, her hits slip past Defend.",
  sig:{name:'Temari Barrage',desc:'Strike your target and one other enemy for PWR−1.',cd:3,kind:'single'}});
add({id:'yahaba',name:'Yahaba',short:'Yahaba',g:'矢',type:'Arrow demon',demon:true,cost:4,hp:20,pow:6,spd:9,def:3,regen:1,
  passive:"Temari & Arrows: with Susamaru on his team, his arrows guide her hits past Defend.",
  sig:{name:'Vector Arrows',desc:"Moves first. Bends an enemy's aim: every hit they throw this round misses.",cd:3,kind:'single',prio:3}});
add({id:'hand',name:'Hand Demon',short:'Hand Demon',g:'手',type:'Final Selection',demon:true,cost:2,hp:14,pow:4,spd:4,def:3,regen:1,
  sig:{name:'Grasping Arms',desc:'Strike for PWR+3.',cd:2,kind:'single'}});
add({id:'swamp',name:'Swamp Demon',short:'Swamp Demon',g:'沼',type:'Lesser demon',demon:true,cost:3,hp:16,pow:5,spd:8,def:2,regen:1,
  sig:{name:'Swamp Dive',desc:'Moves early. Sinks out of reach this round and strikes for PWR+1.',cd:2,kind:'single',prio:1}});

// Hashira (+ Marks)
const giyu = add({id:'giyu',name:'Giyu Tomioka',short:'Giyu',g:'水',type:'Water Hashira',hashira:true,cost:8,hp:32,pow:10,spd:8,def:5,
  sig:{name:'Dead Calm',desc:'Moves first. Your whole team takes no damage this round.',cd:4,kind:'self',prio:3}});
markOf(giyu,{cost:10});
const gyomei = add({id:'gyomei',name:'Gyomei Himejima',short:'Gyomei',g:'岩',type:'Stone Hashira',hashira:true,cost:8,hp:42,pow:13,spd:8,def:7,
  sig:{name:'Volcanic Rock',desc:'Every enemy takes 9, ignoring DEF.',cd:3,kind:'all',dmg:9}});
markOf(gyomei,{cost:12, sig:Object.assign({}, gyomei.sig, {cd:2, dmg:11, desc:'Every enemy takes 11, ignoring DEF.'})});
const sanemi = add({id:'sanemi',name:'Sanemi Shinazugawa',short:'Sanemi',g:'風',type:'Wind Hashira',hashira:true,cost:7,hp:38,pow:12,spd:9,def:5,
  sig:{name:'Black Wind Mountain Mist',desc:'Strike your target and one other enemy for PWR.',cd:3,kind:'single'}});
markOf(sanemi,{cost:11});   // Oct 27, 2026 (CK): Sanemi 7 pts 38/12, Mark 11 pts (second only to Gyomei ✦); 53% / 48% at 20 pts
const muichiro = add({id:'muichiro',name:'Muichiro Tokito',short:'Muichiro',g:'霞',type:'Mist Hashira',hashira:true,cost:6,hp:26,pow:10,spd:11,def:4,
  sig:{name:'Obscuring Clouds',desc:'Moves early. Vanishes into mist (attacks miss him this round) and strikes for PWR+2.',cd:3,kind:'single',prio:1}});
markOf(muichiro,{cost:10, hp:40});   // Nov 10, 2026 (CK): 34 HP was 38% at 20 and 30 pts
const mitsuri = add({id:'mitsuri',name:'Mitsuri Kanroji',short:'Mitsuri',g:'恋',type:'Love Hashira',hashira:true,cost:5,hp:28,pow:9,spd:9,def:4,
  sig:{name:'Catlove Shower',desc:'Every enemy takes PWR−3, even through Defend: her blade bends around any guard.',cd:3,kind:'all'}});
markOf(mitsuri,{cost:8});
const obanai = add({id:'obanai',name:'Obanai Iguro',short:'Obanai',g:'蛇',type:'Serpent Hashira',hashira:true,cost:5,hp:26,pow:9,spd:10,def:4,
  sig:{name:'Twin-Headed Reptile',desc:'Strike for PWR+4. Slips past guards (Defend does nothing).',cd:3,kind:'single'}});
markOf(obanai,{cost:8});
add({id:'rengoku',name:'Kyojuro Rengoku',short:'Rengoku',g:'炎',type:'Flame Hashira',hashira:true,cost:7,hp:38,pow:11,spd:9,def:5,
  sig:{name:'Fifth Form: Flame Tiger',desc:'Strike for PWR+4.',cd:3,kind:'single'},
  sig2:{id:'ninth',name:'Ninth Form: Rengoku',desc:'Strike for PWR+10, ignores DEF.',cd:3,kind:'single',tag:'huge hit, ignores DEF',quote:'Flame Breathing, Ninth Form: Rengoku!'}});
add({id:'tengen',name:'Tengen Uzui',short:'Tengen',g:'音',type:'Sound Hashira',hashira:true,cost:6,hp:34,pow:10,spd:10,def:5,
  sig:{name:'Constant Resounding Slashes',desc:'Every enemy takes PWR−2.',cd:3,kind:'all'}});
// Retired Tengen: the other version of Tengen (one or the other is dealt). Lost a hand and an eye, no longer a Hashira.
add({id:'tengen_retired',fam:'tengen',sk:'tengen_retired',name:'Tengen Uzui (Retired)',short:'Retired Tengen',g:'譜',type:'Former Sound Hashira',cost:4,hp:28,pow:8,spd:7,def:4,
  passive:'Retired: lost a hand and an eye, so he no longer counts as a Hashira.',
  sig:{name:'Bodyguard',desc:'Moves first. Shields an ally (or himself): they count as Defending this round and take half damage.',cd:2,kind:'ally',prio:3}});
add({id:'shinobu',name:'Shinobu Kocho',short:'Shinobu',g:'蟲',type:'Insect Hashira',hashira:true,cost:5,hp:24,pow:6,spd:10,def:3,
  passive:'Wisteria Body: if a demon lands the blow that knocks her out, it devours her and loses 5 HP every round for the rest of the match. (Not Akaza: he never eats women.)',
  sig:{name:'Wisteria Poison',desc:'Poison a target for 3 rounds: 6/round to demons, 3/round to humans.',cd:3,kind:'single'}});

// Main cast (+ Marks)
add({id:'kanae',name:'Kanae Kocho',short:'Kanae',g:'蝶',type:'Former Flower Hashira',cost:5,hp:28,pow:9,spd:9,def:4,
  passive:"Retired: she no longer counts as a Hashira. Kocho Sisters: with Shinobu on her team, Shinobu's poison lasts a round longer. Her student Kanao gets +1 PWR on her team.",
  sig:{name:'Crimson Hanagoromo',desc:'Strike for PWR+3, and your most hurt fighter heals 4.',cd:3,kind:'single'}});

const tanjiro = add({id:'tanjiro',name:'Tanjiro Kamado',short:'Tanjiro',g:'日',type:'Sun & Water',cost:5,hp:28,pow:8,spd:7,def:4,
  sig:{name:'Hinokami Kagura',desc:'Strike for PWR+5, ignores DEF.',cd:3,kind:'single'}});
markOf(tanjiro,{cost:9, hp:46, selfless:true});   // 9 pts, 46 HP (Oct 27, 2026): 49% at 20 pts once attacking reveals him in the Selfless State (40 HP gave 38%)
// Mark Tanjiro's second special: after his first Hinokami Kagura, the next one ready is the Selfless State (once per
// match; unlocked by winning Destructive Death in the story). See special() and hit() in engine.js.
const SELFLESS = {id:'selfless', name:'Selfless State', quote:'No wasted motion. No anger. Just breathe.', cd:Math.max(1,tanjiro.sig.cd-1), kind:'self', prio:3, tag:'untouchable · save allies',
  desc:"Once per match. Moves first. Until Hinokami Kagura is ready again, Tanjiro can't be hit, stunned or moved by the biwa, except on a round he Attacks: striking reveals him for that round (his attacks ignore DEF). Once in the state he can Save a teammate: they take no damage that round. Then his Hinokami Kagura can't be blocked by anything."};
// Demon King Tanjiro: the third version of Tanjiro (base, Mark or this one is dealt). Rare, like Final Muzan.
add({id:'tanjiro_demon',fam:'tanjiro',sk:'tanjiro_demon',name:'Tanjiro Kamado (Demon King)',short:'Demon Tanjiro',g:'王',type:'Demon King · Sun-proof',demon:true,cost:17,hp:54,pow:18,spd:11,def:8,regen:4,
  sunproof:true,
  passive:"Sun-proof: Yoriichi's sun can't stop his regeneration. Still Tanjiro: Siblings, Kamaboko Squad and Mentor bonuses all apply.",
  sig:{name:"Demon King's Rampage",desc:'Every enemy takes PWR−4, ignores DEF.',cd:3,kind:'all'}});
add({id:'nezuko',name:'Nezuko Kamado',short:'Nezuko',g:'血',type:'Demon ally',demon:true,cost:4,hp:28,pow:7,spd:7,def:3,regen:1,
  passive:"Conquers the sun: the first sunrise burns her, then the sun never hurts her again.",
  sig:{name:'Exploding Blood',desc:'Every enemy takes 5, ignores DEF. Demons it hits don\'t regenerate this round.',cd:3,kind:'all'}});
// Awakened Nezuko: the other version of Nezuko (one or the other is dealt)
add({id:'nezuko_awakened',fam:'nezuko',sk:'nezuko_awakened',name:'Nezuko Kamado (Awakened)',short:'Awakened Nezuko',g:'覚',type:'Demon ally · Awakened',demon:true,cost:9,hp:44,pow:12,spd:10,def:5,regen:3,
  noDefend:true,
  passive:"Berserk: she can't Defend. Conquers the sun: the first sunrise burns her, then the sun never hurts her again.",
  sig:{name:'Exploding Blood',desc:'Every enemy takes 10, ignores DEF, and poison burns off your whole team.',cd:3,kind:'all'}});
add({id:'zenitsu',name:'Zenitsu Agatsuma',short:'Zenitsu',g:'雷',type:'Thunder',cost:4,hp:26,pow:7,spd:10,def:2,
  sig:{name:'Thunderclap and Flash',desc:'Always moves first. Strike for PWR×2.',cd:3,kind:'single',prio:2},
  sig2:{id:'seventh',name:'Seventh Form: Flaming Thunder God',desc:'Always moves first. Strike for PWR×3, ignores DEF.',cd:3,kind:'single',prio:2,tag:'massive hit, first',quote:'Thunder Breathing, Seventh Form.',lock:'kaigaku'}});   // revealed against Kaigaku: locked until Senior Brother
add({id:'inosuke',name:'Inosuke Hashibira',short:'Inosuke',g:'獣',type:'Beast',cost:4,hp:28,pow:8,spd:8,def:3,
  sig:{name:'Fang Frenzy',desc:'Two wild strikes of PWR−1 at random enemies.',cd:2,kind:'auto'}});
add({id:'kanao',name:'Kanao Tsuyuri',short:'Kanao',g:'花',type:'Flower',cost:4,hp:24,pow:7,spd:10,def:3,
  sig:{name:'Equinoctial Vermilion Eye',desc:'Moves early. Strike for PWR+4.',cd:3,kind:'single',prio:1}});
add({id:'genya',name:'Genya Shinazugawa',short:'Genya',g:'銃',type:'Demon eater',cost:4,hp:30,pow:7,spd:7,def:3,
  sig:{name:'Demon Consumption',desc:'Heal 8 and gain +2 PWR for the rest of the match.',cd:3,kind:'self'}});
add({id:'tamayo',name:'Tamayo',short:'Tamayo',g:'薬',type:'Physician · Demon ally',demon:true,cost:3,hp:22,pow:5,spd:7,def:3,regen:2,
  passive:"Anti-Muzan Medicine: an enemy Muzan's regeneration drops by 2.",
  sig:{name:'Healing Blood Art',desc:'Heal an ally (or herself) for 10 and cure poison.',cd:2,kind:'ally'}});
add({id:'yushiro',name:'Yushiro',short:'Yushiro',g:'紙',type:'Tamayo\'s guardian · Demon ally',demon:true,cost:3,hp:20,pow:6,spd:9,def:3,regen:1,
  sig:{name:'Concealment Talisman',desc:'Moves first. Hide an ally (or himself): attacks against them miss this round.',cd:3,kind:'ally',prio:3}});
add({id:'sabito',name:'Sabito',short:'Sabito',g:'錆',type:'Spirit · Urokodaki\'s student',cost:4,hp:24,pow:7,spd:10,def:3,
  passive:"Urokodaki's student: he gets the Mentor bonus too.",
  sig:{name:'Spirit Training',desc:'Train an ally (or himself): +2 PWR for the rest of the match.',cd:3,kind:'ally'}});
add({id:'typezero',name:'Yoriichi Type Zero',short:'Type Zero',g:'傀',type:'Training puppet',cost:4,hp:28,pow:4,spd:8,def:4,strikes:3,
  passive:"Six Arms: strikes three times every Attack. Only a puppet: it doesn't count as Yoriichi, so Muzan isn't scared of it. Training partner: Muichiro gets +1 PWR on its team. Poison does nothing to a puppet.",
  noPoison:true,
  sig:{name:'Training Drill',desc:'Drill an ally (or itself): +2 SPD for the rest of the match.',cd:3,kind:'ally'}});
add({id:'urokodaki',name:'Sakonji Urokodaki',short:'Urokodaki',g:'師',type:'Former Water Hashira',cost:4,hp:26,pow:7,spd:7,def:4,
  passive:'Mentor: Tanjiro, Giyu and Sabito on his team get +1 DEF.',
  sig:{name:'Water Wheel',desc:'Strike for PWR+3.',cd:2,kind:'single'}});
// The Endless Dream's fighters (CK, Oct 30, 2026). Michikatsu is a version of Kokushibo and Hakuji a version of Akaza:
// one per draft, and they're dealt half as often as the demon they became.
add({id:'makomo',name:'Makomo',short:'Makomo',g:'菰',type:'Water · fox mask',cost:3,hp:16,pow:6,spd:11,def:2,
  sig:{name:'Flowing Step',desc:'Moves early. Slips away so attacks miss her this round, and strikes for PWR.',cd:3,kind:'single'}});
add({id:'hinatsuru',name:'Hinatsuru',short:'Hinatsuru',g:'雛',type:"Kunoichi · Tengen's wife",cost:2,hp:14,pow:4,spd:8,def:2,
  sig:{name:'Wisteria Kunai',desc:'Strike for PWR and poison the target for 3 rounds: 4 a round on demons, 2 on humans.',cd:3,kind:'single'}});
add({id:'makio',name:'Makio',short:'Makio',g:'牧',type:"Kunoichi · Tengen's wife",cost:2,hp:16,pow:5,spd:7,def:2,
  sig:{name:'Fierce Strike',desc:'Strike for PWR+3.',cd:3,kind:'single'}});
add({id:'suma',name:'Suma',short:'Suma',g:'須',type:"Kunoichi · Tengen's wife",cost:2,hp:14,pow:3,spd:9,def:2,
  sig:{name:'Panic Dodge',desc:'Moves first. Dodges everything this round, and flails at a random enemy for PWR.',cd:3,kind:'auto',prio:3}});
add({id:'michikatsu',fam:'kokushibo',sk:'michikatsu',name:'Michikatsu Tsugikuni',short:'Michikatsu',g:'道',type:'Human swordsman',cost:9,hp:48,pow:15,spd:11,def:5,
  sig:{name:'Envy of the Sun',desc:'Strike for PWR plus the round number (up to +6). He only gets stronger.',cd:3,kind:'single'}});
add({id:'hakuji',fam:'akaza',sk:'hakuji',name:'Hakuji',short:'Hakuji',g:'狛',type:'Human · Soryu fists',cost:4,hp:26,pow:8,spd:9,def:2,
  passive:'Vow: the first time a teammate falls, he gets +3 PWR for the rest of the match.',
  sig:{name:'Soryu Kick',desc:'Strike for PWR+3.',cd:3,kind:'single'}});
add({id:'tanjuro',name:'Tanjuro Kamado',short:'Tanjuro',g:'炭',type:'Keeper of the dance',cost:3,hp:18,pow:5,spd:6,def:2,
  sig:{name:'Hinokami Dance',desc:'His whole team heals 3. He never tires: it recharges in 2 rounds.',cd:2,kind:'self'}});
// A nameless enemy for one Endless Dream battle: never dealt, not in the Codex
add({id:'dojo_fighter',name:'Dojo Swordsman',short:'Swordsman',g:'剣',type:'Rival dojo',spawn:true,cost:2,hp:16,pow:6,spd:6,def:2,
  sig:{name:'Dirty Trick',desc:'Strike for PWR+2.',cd:3,kind:'single'}});
// Kagaya never attacks: his basic move (in place of Attack) heals the team. His special sacrifices him so the Hashira
// awaken their Marks (awakenMark() in engine.js). Killed by an enemy first, nobody awakens.
add({id:'kagaya',name:'Kagaya Ubuyashiki',short:'Kagaya',g:'産',type:'Corps Master',cost:2,hp:18,pow:2,spd:5,def:1,
  basic:{name:'Words of Resolve',tag:'team heals 2',k:'癒',kind:'self',desc:'Instead of attacking: every ally, himself included, heals 2.',flee:'Kagaya is alone. With no one left to lead, he falls.'},
  passive:"Master of the Corps: every Hashira on his team gets +1 DEF. He never attacks. If he's the last one standing on his team, he falls.",
  sig:{name:'Final Resolve',desc:"Kagaya gives his life (he's knocked out). Every Hashira on his team who has a Mark awakens it for the rest of the match. If an enemy knocks him out first, nobody awakens.",cd:3,kind:'self'}});
add({id:'murata',name:'Murata',short:'Murata',g:'村',type:'Water · rank and file',cost:2,hp:10,pow:4,spd:6,def:2,
  passive:'Somehow Survives: the first hit that would knock him out leaves him at 1 HP instead.',
  sig:{name:'Water Surface Slash',desc:'Strike for PWR+2.',cd:2,kind:'single'}});

// Back-pocket helpers: 1 pt each, not fighters. They sit in your "back pocket" (no fighter slot, can't attack or be
// attacked); you choose a round to use each one, it acts first that round, then it leaves. Effects live in useHelper().
const MICE_PWR = 2, AMBUSH_DMG = 5;   // Kiriya's trap: 5 → side with him wins ~59% (6 was 60%, 4 was 57%)
add({id:'chachamaru',name:'Chachamaru',short:'Chachamaru',g:'猫',type:"Tamayo's cat · back-pocket helper",helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Medicine Delivery',desc:'Your most hurt fighter heals half of what they’ve lost (20% becomes 60%).',kind:'helper'}});
add({id:'crow',name:'Kasugai Crow',short:'Kasugai Crow',g:'烏',type:'Messenger crow · back-pocket helper',helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Scouting Report',desc:"After both sides lock in, the crow shows you the enemy's moves, and you can change yours before the round plays.",kind:'helper'}});
add({id:'mice',name:'Muscle Mice',short:'Muscle Mice',g:'鼠',type:"Tengen's mice · back-pocket helper",helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Flex!',desc:`Every fighter on your team gets +${MICE_PWR} PWR for this round.`,kind:'helper'}});
add({id:'hotaru',name:'Hotaru Haganezuka',short:'Hotaru',g:'鋼',type:'Swordsmith · back-pocket helper',helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Reforged Blade',desc:'At the end of the round, your fighter with the longest wait for their special has it cut to 1 round (ready the round after next). Works on a special fired that same round, so you can use him in round 1.',kind:'helper'}});
add({id:'aoi',name:'Aoi Kanzaki',short:'Aoi',g:'葵',type:'Butterfly Estate · back-pocket helper',helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Field Medicine',desc:'Cures all poison on your team, and your most hurt fighter heals 4.',kind:'helper'}});
add({id:'chuntaro',name:'Chuntaro',short:'Chuntaro',g:'雀',type:"Zenitsu's sparrow · back-pocket helper",helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Wake Up!',desc:'Wakes one stunned fighter so they can act, and your whole team gets +2 SPD this round.',kind:'helper'}});
add({id:'goto',name:'Goto',short:'Goto',g:'隠',type:'Kakushi · back-pocket helper',helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Carried to Safety',desc:"Carries your most hurt fighter off for a round: they can't be hit, and they can't act.",kind:'helper'}});
add({id:'tecchin',name:'Tecchin',short:'Tecchin',g:'鉄',type:'Swordsmith chief · back-pocket helper',helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Masterwork Edge',desc:"Your hardest hitter's attacks ignore DEF this round.",kind:'helper'}});
// Kiriya (also speaks in the story finale): a trap on one of your fighters for one round
add({id:'kiriya',name:'Kiriya Ubuyashiki',short:'Kiriya',g:'産',type:'Corps commander · back-pocket helper',helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Ambush Orders',desc:`Pick one of your fighters. This round, every enemy that attacks them takes ${AMBUSH_DMG} damage back.`,kind:'helper'}});

// A few words shown under each fighter's Special button, like "hit one enemy" under Attack
const SPECIAL_TAGS = {
  makomo:'dodge + hit', hinatsuru:'hit + poison', makio:'strong hit', suma:'dodge + random hit', michikatsu:'hit grows each round', hakuji:'strong hit', tanjuro:'team heals 3', dojo_fighter:'strong hit',
  yoriichi:'hit all, stops regen', yoriichi_old:'huge hit, ignores DEF',
  muzan:'hit all, heal self', muzan_final:'hit all, heal self', kokushibo:'hit all enemies', doma:'hit all enemies',
  akaza:'big hit', gyutaro:'hit all + poison', daki:'hit all enemies', nakime:'send an enemy away', zohakuten:'hit all, through Defend', hantengu_true:'hides this round',
  susamaru:'hit two enemies', yahaba:"enemy's hits miss", kanae:'hit + heal ally', tanjiro_demon:'hit all enemies', nezuko_awakened:'hit all + cure poison',
  typezero:'ally +2 SPD', hotaru:'reload a special', hantengu:'hide + heal self', gyokko:'hit + stun', kaigaku:'hit two enemies',
  sekido:'every enemy 5', karaku:'hits every enemy', aizetsu:'through Defend', urogi:'moves first',
  enmu:'delay enemy specials', rui:'hit + stun', kyogai:'stun one enemy', hand:'strong hit', swamp:'dodge + hit',
  giyu:'team takes no damage', gyomei:'hit all enemies', sanemi:'hit two enemies', muichiro:'dodge + hit',
  mitsuri:'hit all enemies', obanai:'hit through Defend', rengoku:'strong hit', tengen:'hit all enemies',
  tengen_retired:'shield an ally', shinobu:'poison one enemy',
  tanjiro:'big hit, ignores DEF', nezuko:'hit all enemies', zenitsu:'first, double hit', inosuke:'2 random hits',
  kanao:'early strong hit', genya:'heal + PWR up', tamayo:'heal an ally', yushiro:'hide an ally',
  sabito:'ally +2 PWR', urokodaki:'strong hit', kagaya:'Hashira awaken Marks', murata:'strong hit',
  aoi:'cure poison + heal', chuntaro:'wake + team +2 SPD', goto:'protect one fighter', tecchin:'one fighter ignores DEF',
  chachamaru:'most hurt heals ½', crow:'see enemy moves', kiriya:`attackers take ${AMBUSH_DMG}`, mice:`team +${MICE_PWR} PWR, 1 round`,
};
ROSTER.forEach(c=>{ c.sig.tag = SPECIAL_TAGS[c.sk]; });
// One short line each fighter says when their special fires (shown on the fight stage)
const SPECIAL_QUOTES = {
  makomo:'Don’t be stiff. Flow.', hinatsuru:'Hold still. This won’t take long.', makio:'Get out of my way!', suma:'I don’t want to die!', michikatsu:'For once, look at me.', hakuji:'I swore I’d protect them.', tanjuro:'Breathe. Then dance.', dojo_fighter:'Nobody beats our dojo!',
  yoriichi:'Sun Breathing has thirteen forms. This is the last.', yoriichi_old:'Even now, my sword has not dulled.',
  muzan:'I decide who lives.', muzan_final:'I will not die. Not to the sun, not to you.', kokushibo:'Moonlight, cut them down.',
  doma:'Let me save you all.', daki:'How dare you look at me like that!', nakime:'The castle answers to me.',
  zohakuten:'Why do you torment the weak?!', hantengu_true:'How dare you hurt someone so weak!', susamaru:"Let's play temari!", yahaba:'Your aim belongs to me now.',
  kanae:"I'd rather we didn't fight. But if we must…", tanjiro_demon:"I can't hear anyone anymore…", nezuko_awakened:'Grrrr!',
  typezero:'*clack clack clack*', hotaru:"You chipped my blade?! I'll end you!", akaza:'Become a demon and fight me forever!', gyutaro:'Take it all from them!',
  hantengu:'Don\'t hurt me! I\'m so weak!', gyokko:'Admire my art!', kaigaku:'I was the one meant to rise.',
  sekido:'Anger burns the field!', karaku:'Ha! Blow them away!', aizetsu:'How sad. How very sad.', urogi:'Such joy, from up here!',
  enmu:'Sleep. Have a lovely dream.', rui:'You\'re not my family.', kyogai:'My writing was not trash!', hand:'I remember every student.',
  swamp:'Into the swamp with you.', giyu:'Water Breathing, Eleventh Form.', gyomei:'Namu Amida Butsu.', sanemi:'Come on, then. Try me.',
  muichiro:'The mist hides everything.', mitsuri:'I won\'t let anyone else get hurt!', obanai:'No one touches Kanroji.',
  rengoku:'Set your heart ablaze!', tengen:'Let\'s make this flashy!', tengen_retired:'Retired or not, stay behind me.',
  shinobu:'Shall we be friends? No? Then poison.', tanjiro:'Dance of the Fire God!', nezuko:'Mmph!', zenitsu:'Thunder Breathing, First Form.',
  inosuke:'Beast Breathing! Charge!', kanao:'I decide for myself now.', genya:'Give me your strength, demon.', tamayo:'Hold still. This will help.',
  yushiro:'Lady Tamayo, look at me!', sabito:'Again. Swing again.', urokodaki:'Your judgment is too slow.', kagaya:'My children, thank you.',
  murata:'Why am I always here?!', chachamaru:'Mrrow.', crow:'Caw! Caw! Report!', kiriya:'Everything is going according to plan.', mice:'*flexes*',
};
ROSTER.forEach(c=>{ c.sig.quote = SPECIAL_QUOTES[c.sk]; });

const BYID = Object.fromEntries(ROSTER.map(c=>[c.id,c]));
const MARK_PASSIVE = 'Mark awakened: boosted stats and the special recharges 1 round faster.';

// Codex lore: a line in the character's voice and a sentence of background, shown on each card in the Codex.
// Looked up by card id, then by family (so Mark versions share their character's lore).
const LORE = {
  makomo: ['Your body is strong. You just haven’t realized it.', 'One of Urokodaki’s lost pupils, she taught Tanjiro from beyond the grave alongside Sabito.'],
  hinatsuru: ['We’re Lord Tengen’s wives. We can handle this.', 'The eldest of Tengen’s three wives, a calm kunoichi with wisteria kunai.'],
  makio: ['Quit crying and fight, Suma!', 'Tengen’s fiery second wife, as loud as she is strong.'],
  suma: ['I don’t want to do this!', 'Tengen’s youngest wife. She panics constantly, and somehow survives everything.'],
  michikatsu: ['I wanted to be you.', 'Yoriichi’s elder twin, before envy of his brother turned him into Kokushibo.'],
  hakuji: ['I’ll protect you for the rest of my life.', 'A boy who fought with his bare hands for the people he loved, long before he became Akaza.'],
  tanjuro: ['There is a place where everything goes clear.', 'Tanjiro’s frail father, who could dance the Hinokami Kagura through a whole winter night.'],
  aoi: ['Stop moving, or it won’t heal.', 'She runs the Butterfly Estate’s sickroom. Nobody argues with her twice.'],
  chuntaro: ['Chirp!', 'Zenitsu’s sparrow, and very tired of Zenitsu.'],
  goto: ['Why is it always me carrying you?', 'A Kakushi who has hauled more injured slayers than anyone alive.'],
  tecchin: ['A blade is only as good as its maker.', 'The tiny chief of the Swordsmith Village, and its greatest smith.'],
  yoriichi: ['I was born to defeat you.', 'The first Breathing user and the creator of Sun Breathing. In four hundred years, nobody came closer to killing Muzan.'],
  yoriichi_old: ['Are you a demon now, brother?', 'At eighty-five he still faced his twin Kokushibo, and died with his sword raised mid-swing.'],
  muzan: ['I am the closest thing to perfection.', 'The first demon. A thousand years of hiding, afraid only of the sun and the man who wielded it.'],
  muzan_final: ['Why won’t you just die?', 'His last, swollen form at the end of the longest night, racing the dawn.'],
  kokushibo: ['Even as a demon, I could never catch you.', 'Upper Moon One, once Michikatsu Tsugikuni, Yoriichi’s twin. His Moon Breathing grew out of jealousy.'],
  doma: ['Isn’t it sad? I can’t feel a thing.', 'Upper Moon Two and leader of the Eternal Paradise Faith. He killed Kanae, and later Shinobu.'],
  akaza: ['Become a demon, Kyojuro!', 'Upper Moon Three, a martial artist who respects only the strong and never eats women.'],
  gyutaro: ['Whoever made my sister cry, I’ll take everything from them.', 'Upper Moon Six, born in Yoshiwara’s gutters. He shares one rank, and one life, with his sister.'],
  daki: ['Brother, they’re bullying me!', 'The proud oiran of Yoshiwara. Her obi sashes keep the people she means to eat.'],
  nakime: ['*strum*', 'The biwa player of the Infinity Castle. One note moves every room.'],
  gyokko: ['Admire my art!', 'Upper Moon Five, an artist of pots and fish who traps his victims in water.'],
  hantengu: ['Don’t hurt me! I’m so weak!', 'Upper Moon Four, a coward whose fear splits him into emotions, each one deadlier than the last.'],
  kaigaku: ['I was the one meant to rise.', 'Zenitsu’s senior under Jigoro Kuwajima. He took Muzan’s blood and became Upper Moon Six.'],
  enmu: ['Have a lovely dream.', 'Lower Moon One, who put the Mugen Train to sleep and fused with the train itself.'],
  rui: ['A family is bound by fear.', 'Lower Moon Five of Mount Natagumo, who tied a fake family together with threads.'],
  kyogai: ['My writing was not trash!', 'A failed writer turned demon. Every beat of his drums turns the rooms of his mansion.'],
  susamaru: ['Let’s play temari!', 'A temari-ball demon Muzan sent after Tanjiro in Asakusa.'],
  yahaba: ['My eyes see every path.', 'The arrow demon whose vectors bend every blow. Susamaru’s partner in Asakusa.'],
  hand: ['Another one of Urokodaki’s brats.', 'The Hand Demon of Final Selection, who hunted Urokodaki’s students for forty-seven years.'],
  swamp: ['This one is mine!', 'A demon who swims through the ground like water and splits into three to hunt.'],
  giyu: ['Don’t ever give others the power to decide your fate!', 'The Water Hashira who spared Nezuko and sent Tanjiro to Urokodaki.'],
  gyomei: ['Namu Amida Butsu.', 'The Stone Hashira, blind and always in tears: the strongest member of the Corps.'],
  sanemi: ['A demon is a demon.', 'The Wind Hashira, scarred head to toe, whose rare blood makes demons drunk. Genya’s older brother.'],
  muichiro: ['I’ll forget you soon anyway.', 'The Mist Hashira, a prodigy who became a Hashira two months after first holding a sword.'],
  mitsuri: ['I want a husband who’s stronger than me!', 'The Love Hashira. Muscles eight times denser than normal and a sword as thin as a ribbon.'],
  obanai: ['Kanroji… in the next life, I’ll find you.', 'The Serpent Hashira, with his snake Kaburamaru and a twisting blade.'],
  rengoku: ['Set your heart ablaze.', 'The Flame Hashira who protected all two hundred passengers of the Mugen Train.'],
  tengen: ['Let’s make it flashy!', 'The Sound Hashira, a former shinobi with three wives and two cleavers on a chain.'],
  tengen_retired: ['Flashier! FLASHIER!', 'Retired after Yoshiwara with one eye and one hand, he trains the Corps in its final weeks.'],
  shinobu: ['Ara ara.', 'The Insect Hashira, too small to cut a demon’s head, so she poisons them. She made her own body a trap for Doma.'],
  kanae: ['I want demons and humans to get along.', 'The former Flower Hashira, older sister to Shinobu and Kanao, killed by Doma.'],
  tanjiro: ['Nezuko, I’ll turn you back into a human!', 'A charcoal seller’s son who can smell the gap in any guard. Water Breathing and his family’s Hinokami Kagura.'],
  tanjiro_mark: ['I can see everything now.', 'Tanjiro with the Demon Slayer Mark. He learns the Transparent World, seeing inside his enemies’ bodies, then the Selfless State, where even Akaza can’t sense him.'],
  tanjiro_demon: ['Get away… I can’t stop…', 'Muzan’s last trick: Tanjiro as the King of Demons, immune to the sun.'],
  nezuko: ['Mmph!', 'Tanjiro’s sister, a demon who never ate a human and learned to walk in the sun.'],
  nezuko_awakened: ['Grrrrr…!', 'Nezuko’s awakened form, horned and vined, burning poison away with her blood.'],
  zenitsu: ['I’ll protect you, Nezuko!', 'A coward who fights in his sleep. He mastered only First Form, then made a Seventh of his own.'],
  inosuke: ['Pig Assault!', 'Raised by boars, he wears a boar’s head and fights with two jagged blades. Beast Breathing, self-taught.'],
  kanao: ['I’ll decide with my own heart.', 'Shinobu’s apprentice, who once flipped a coin for every choice. Her eyes catch every movement.'],
  genya: ['I want to apologize to my brother.', 'Sanemi’s little brother. He can’t use Breathing, so he eats demons to fight them.'],
  tamayo: ['My medicine is already inside you.', 'A demon doctor who broke free of Muzan and made the cure that turned Nezuko human.'],
  yushiro: ['Lady Tamayo is beautiful today, too.', 'The demon Tamayo made. His paper charms hide anything from sight.'],
  sabito: ['Again. Swing again.', 'Urokodaki’s student who fell at Final Selection, and still came back to train Tanjiro.'],
  typezero: ['*clack clack clack*', 'A six-armed training puppet built to copy Yoriichi’s movements.'],
  urokodaki: ['Your judgment is too slow.', 'The former Water Hashira in the tengu mask who trained Giyu, Sabito and Tanjiro.'],
  kagaya: ['What is eternal is human will.', 'Head of the Demon Slayer Corps. He never held a sword, and turned his own death into a trap for Muzan.'],
  murata: ['Why is it always me?!', 'An ordinary Water Breathing slayer who somehow survives everything.'],
  chachamaru: ['Mrrow.', 'Tamayo’s cat, hidden by Yushiro’s charm, carrying medicine across the battlefield.'],
  crow: ['Caw! Caw! Report!', 'Every slayer’s messenger, flying in orders and news.'],
  mice: ['*flexes*', 'Tengen’s muscular mice, strong enough to carry swords bigger than themselves.'],
  hotaru: ['You chipped my blade?!', 'Tanjiro’s swordsmith, a hot-tempered master who chases him with kitchen knives.'],
  kiriya: ['Everything is going according to plan.', 'Kagaya’s son and heir, who commanded the final battle at eight years old.'],
};
const loreOf = c => LORE[c.id] || LORE[c.fam] || null;
// One short line under each draft card: what the special does at a glance (the full text is on the card's details)
const SIG_CAPTION = {yoriichi:'Hits all · stops regen', yoriichi_old:'Huge single hit', muzan:'Hits all · heals him', muzan_final:'Hits all · heals him', kokushibo:'Hits all · ignores DEF', doma:'Hits all · ignores DEF',
  akaza:'Big single hit', gyutaro:'Hits all · poison', daki:'Hits all · through Defend', nakime:'Banishes one enemy', gyokko:'Hit + stun', hantengu:'Splits when cut · hunt the real one', kaigaku:'Hits two', enmu:'Delays all specials',
  rui:'Hit + stun', kyogai:'Stuns one enemy', susamaru:'Hits two', yahaba:'Enemy\'s hits miss', hand:'Big single hit', swamp:'Dodges + hits', giyu:'Team takes no damage', gyomei:'Hits all · ignores DEF',
  sanemi:'Hits two', muichiro:'Dodges + hits', mitsuri:'Hits all · through Defend', obanai:'Big hit · through Defend', rengoku:'Big single hit', tengen:'Hits all', tengen_retired:'Guards an ally', shinobu:'Poisons one enemy',
  kanae:'Hit + heals', tanjiro:'Big hit · ignores DEF', tanjiro_demon:'Hits all · ignores DEF', nezuko:'Hits all · ignores DEF', nezuko_awakened:'Hits all · cures poison', zenitsu:'Moves first · double hit', inosuke:'Two random hits',
  kanao:'Moves early · big hit', genya:'Heals · +2 PWR', tamayo:'Heals ally · cures poison', yushiro:'Hides an ally', sabito:'Ally +2 PWR', typezero:'Ally +2 SPD', urokodaki:'Big single hit', makomo:'Dodges + hits',
  hinatsuru:'Hit + poison', makio:'Big single hit', suma:'Dodges + random hit', michikatsu:'Stronger every round', hakuji:'Big single hit', tanjuro:'Heals whole team', kagaya:'Awakens Marks · he falls', murata:'Strong single hit'};
const sigCaption = c => SIG_CAPTION[c.id] || SIG_CAPTION[c.fam] || (c.sig && c.sig.name) || '';
