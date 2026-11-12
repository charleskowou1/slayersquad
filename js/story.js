/* ================= STORY MODE =================
   25 battles following the arcs, plus flashbacks (Kanae, two with Yoriichi). Each stage gives you a preset squad (the canon one)
   and opens with a short scene. Once cleared, a stage can be replayed drafting your own squad from the Corps and its
   allies, with the same points as the preset squad.
   After a win, a short ending scene (outro) plays, then any characters the battle unlocks are revealed.
   Twists (one line on the stage card, nothing hidden):
     survive: N        win by still standing at the end of round N (or by beating the enemy first)
     reinforce: [{id, round}]   each fighter joins your team at the start of that round
     start: {id: {hp, poison, devoured}}   an enemy starts the fight already hurt (part 2 of a two-part fight)
   Boosts tune a stage's difficulty and are shown on its card: [{side:0 you / 1 enemy, only:[ids], hp:×, pow:+, def:+, spd:+, label}]
   No DOM. Stage difficulty was checked with the simulator (see CLAUDE.md). */
const ARCS = {
  prologue:{title:'Prologue', g:'始'}, asakusa:{title:'Asakusa', g:'浅'}, flashback:{title:'Flashback', g:'昔'},
  tsuzumi:{title:'Tsuzumi Mansion', g:'鼓'}, natagumo:{title:'Mount Natagumo', g:'蜘'}, mugen:{title:'Mugen Train', g:'列'},
  district:{title:'Entertainment District', g:'遊'}, swordsmith:{title:'Swordsmith Village', g:'刀'},
  castle:{title:'Infinity Castle', g:'城'}, dawn:{title:'Until Dawn', g:'暁'},
  dream1:{title:'The Morning After', g:'朝'}, dream2:{title:'The Ones We Lost', g:'失'}, dream3:{title:'The Twins', g:'双'}, dream4:{title:'The Dreamer', g:'夢'}, dream5:{title:'The Last Dawn', g:'曙'}, six:{title:'Earned Every Star', g:'陽'},
};
// scene lines: [speaker card id, or '' for the narrator, text, options]; options: {img:'name'} shows the picture
//   img/scenes/<name>.jpg (or .png/.webp) for that line if the file exists; {awaken:true} plays the Mark awakening flash;
//   {clip:'card id'} plays that card's special clip (js/clips.js) in a wide box; {pic:'name'} shows that picture as the portrait.
// chain: {id, lines}: after that fighter of yours uses their first special, `lines` play between rounds and their second
//   special is ready at once (Senior Brother: Thunderclap and Flash, Kaigaku's trash talk, then Seventh Form).
// awaken: [{id, at, round, lines}] — that fighter of yours becomes their Mark card at the end of a round once hurt to
//   `at` of their health or after round `round`, and `lines` play as a short cutscene before the next round.
const MAIN_STAGES = [
  // Urokodaki's training (CK, Oct 27, 2026): the year before the boulder. Hold out against your teacher.
  {id:'mentor', arc:'prologue', title:'Sharpen Your Judgment', place:'Mount Sagiri, the year before', foe:'Urokodaki', mine:['tanjiro'], enemy:['urokodaki'], level:'easy',
    stars:{standing:1, hp2:40, health:55},
    twist:{survive:3},
    boosts:[{side:1, hp:1.5, label:'Urokodaki: +50% HP'}],
    beats:[{when:'round', round:2, id:'urokodaki', text:'Your judgment is too slow. Again!'}],
    outro:[['urokodaki','…You lasted. Your body is learning.'],['tanjiro','Thank you, Mr. Urokodaki! I won’t give up.'],['urokodaki','Then go up the mountain. There is a boulder waiting for you.']],
    blurb:'Your teacher in the tengu mask. Last three rounds against him.',
    scene:[['urokodaki','You want to be a demon slayer? Your judgment is too slow.'],
      ['tanjiro','Then teach me! I’ll do anything to turn Nezuko back into a human!'],
      ['urokodaki','Words mean nothing. Draw your sword. Stand against me until the sun moves.']]},
  {id:'training', arc:'prologue', title:'The Boulder', place:'Mount Sagiri', foe:'Sabito', mine:['tanjiro'], enemy:['sabito'], level:'easy',
    stars:{standing:1, hp2:45, rounds:5},
    beats:[{when:'low', id:'tanjiro', at:.4, text:'Breathe. Feel the gap in his guard.'}, {when:'low', id:'sabito', at:.35, text:'That’s it. Again!'}],
    outro:[['sabito','You cut it. You really cut the boulder.',{img:'sabito-smile'}],['tanjiro','Sabito? …He’s gone.'],['','Tanjiro is ready for Final Selection.']],
    boosts:[{side:1, hp:1.4, label:'Sabito: +40% HP'}],
    blurb:'A boy in a fox mask tests Tanjiro before he can cut the boulder.',
    scene:[['','Mount Sagiri. Half a year of training, and the boulder still stands.'],
      ['sabito',"You're slow. Your body has learned everything, but you haven't."],
      ['tanjiro',"Then I'll fight you until I understand!"],
      ['sabito','Good. Show me.']]},
  {id:'selection', arc:'prologue', title:'Final Selection', place:'Mount Fujikasane', foe:'Hand Demon', mine:['tanjiro'], enemy:['hand','swamp'], level:'easy',
    stars:{standing:1, hp2:45, rounds:5},
    beats:[{when:'round', round:1, id:'tanjiro', text:'That one hides in the swamp when it dives. I’ll cut it when it comes back up.'}, {when:'low', id:'tanjiro', at:.35, text:'I can’t die here. Nezuko is waiting for me!'}],
    outro:[['hand','Those eyes… like Urokodaki’s…'],['tanjiro','Rest now. May you be reborn somewhere kinder.'],['','Tanjiro survives seven nights and joins the Demon Slayer Corps.']],
    boosts:[{side:0, hp:1.3, label:'Urokodaki’s training: Tanjiro +30% HP'}],
    blurb:'Seven nights on a mountain full of demons. Survive them.',
    scene:[['','Wisteria blooms all year around the mountain. Inside, the demons wait.'],
      ['hand',"Another one of Urokodaki's brats. I remember every one I ate."],
      ['tanjiro',"Then you'll remember me too. As the last one!"]]},
  {id:'asakusa', arc:'asakusa', title:'Temari and Arrows', place:'Asakusa, Tokyo', foe:'Susamaru & Yahaba', mine:['tanjiro','nezuko','tamayo','yushiro'], enemy:['susamaru','yahaba'], level:'normal',
    stars:{standing:3, rounds:4},
    boosts:[{side:1, hp:1.5, pow:4, label:'Demons: +50% HP, +4 PWR'}],
    beats:[{when:'low', id:'tamayo', at:.5, text:'I’m fine. Don’t let them reach me.'}, {when:'ko', id:'susamaru', who:'yahaba', text:'Susamaru?! Impossible…'}],
    twist:{protect:'tamayo'},
    outro:[['tamayo','Thank you. Take my blood research, and come back alive.'],['yushiro','Don’t get the wrong idea. I only helped because she told me to.']],
    blurb:'Muzan sends two demons after the doctor hiding from him.',
    scene:[['tamayo',"Muzan's hunters have found us. Forgive me for dragging you into this."],
      ['susamaru',"Let's play temari! Whoever drops the ball dies!"],
      ['yahaba',"The arrows show me everything. Your aim belongs to me."],
      ['yushiro',"Lady Tamayo, stay behind me. You, slayer, try to be useful."]]},
  {id:'tsuzumi', arc:'tsuzumi', title:'Tsuzumi Mansion', place:'The drum house', foe:'Kyogai', mine:['tanjiro','zenitsu','inosuke'], enemy:['kyogai','swamp','hand'], level:'easy',
    stars:{standing:2, rounds:9},
    beats:[{when:'low', id:'zenitsu', at:.4, text:'Zzz… Thunder Breathing… First Form…'}, {when:'round', round:2, id:'kyogai', text:'Every beat of my drum is a new room!'}],
    outro:[['kyogai','You stepped around my pages… you didn’t trample them.'],['tanjiro','Your writing was not trash.'],['zenitsu','Did I faint again? Who killed it?!']],
    boosts:[{side:1, hp:1.5, pow:1, label:'Demons: +50% HP, +1 PWR'}],
    blurb:'Every drum beat turns the rooms upside down.',
    scene:[['zenitsu',"I can hear it! Something awful is in there! Let's go home!"],
      ['inosuke','Ha! Finally, something worth fighting!'],
      ['kyogai','My writing was not trash… This is MY house!'],
      ['tanjiro','Zenitsu, Inosuke, together!']]},
  {id:'natagumo', arc:'natagumo', title:'Spider Family', place:'Mount Natagumo', foe:'Rui', mine:['tanjiro','nezuko','crow'], enemy:['rui','kyogai'], level:'normal',
    stars:{standing:3, rounds:4},
    boosts:[{side:1, hp:1.25, pow:2, label:'Demons: +25% HP, +2 PWR'}],
    beats:[{when:'low', id:'nezuko', at:.5, text:'Mmph!'}, {when:'low', id:'tanjiro', at:.35, text:'Father… the Fire God dance…'}, {when:'round', round:3, id:'rui', text:'Who are you? You don’t belong to my family.'}],
    outro:[['giyu','Stand back.'],['rui','My… family…'],['','The Water Hashira arrives, and the spider family falls apart.']],
    twist:{reinforce:[{id:'giyu', round:3}], protect:'nezuko'},
    blurb:'A demon who wants a family, and threads that cut steel.',
    scene:[['rui',"You two have a real bond. I'll take it. Give me your sister."],
      ['tanjiro',"Nezuko is not a thing you can take!"],
      ['','Deep in the forest, another slayer is already running toward the threads.']]},
  {id:'mugen', arc:'mugen', title:'The Dream Train', place:'The Mugen Train', foe:'Enmu', mine:['tanjiro','zenitsu','inosuke','nezuko'], enemy:['enmu','swamp','hand'], level:'normal',
    stars:{standing:2, rounds:9},
    beats:[{when:'round', round:2, id:'enmu', text:'Isn’t the dream nicer? Go back to sleep.'}, {when:'low', id:'inosuke', at:.4, text:'You can’t eat me! I’m the king of the mountain!'}],
    outro:[['enmu','How can a dream be cut…?'],['inosuke','Ha! The train’s dead! Who’s the boss now?!'],['','Then the morning air turns cold. Something far stronger is coming.']],
    boosts:[{side:1, hp:2.5, pow:3, label:'Demons: +150% HP, +3 PWR'}],
    blurb:'Wake up. Cut the dream, then cut the demon.',
    scene:[['enmu','Sleep. Have a lovely dream. Your family is waiting for you there.'],
      ['tanjiro',"This isn't real. My family is gone. I have to wake up!"],
      ['inosuke','The whole train is the demon! I knew it!'],
      ['','Two hundred passengers sleep on. Only the slayers can save them.']]},
  {id:'mugen_akaza', arc:'mugen', title:'Set Your Heart Ablaze', place:'Beside the derailed train', foe:'Akaza', mine:['rengoku','tanjiro','inosuke'], enemy:['akaza'], level:'hard',
    stars:{standing:2, rounds:4},
    boosts:[{side:1, hp:1.5, label:'Akaza: +50% HP'}],   // +3 PWR before Annihilation Type became his second special (Oct 27, 2026)
    beats:[{when:'low', id:'rengoku', at:.3, text:'Set your heart ablaze! I will not fall here!'}, {when:'ko', id:'rengoku', who:'tanjiro', text:'Rengoku!'}, {when:'round', round:6, id:'akaza', text:'The sky is getting lighter… I don’t have long.'}],
    phases:[{id:'akaza', at:.5, pow:2, ready:true, second:true, label:'+2 PWR, Annihilation Type ready', line:'Destructive Death: Annihilation Type!'}],
    outro:[['akaza','The sun! I have to go—',{img:'akaza-sunrise'}],
      ['tanjiro','Don’t run! Come back and fight, coward! He fought you all night and never once ran!',{img:'tanjiro-yelling'}],
      ['rengoku','Enough, Tanjiro. Don’t shout. Your wounds will open. Come here… there’s something I have to tell you.'],
      ['rengoku','I believe in your sister. She fought to protect the passengers too. She is one of the Corps.'],
      ['rengoku','Tanjiro… set your heart ablaze. Go on, with your head held high.',{img:'rengoku-heart'}],
      ['rengoku','Inosuke, Zenitsu, Tanjiro… you will grow strong. The next generation is yours to protect.']],
    twist:{survive:10},
    blurb:'Upper Moon Three arrives before dawn. Hold him until the sun rises.',
    scene:[['akaza','What a fighting spirit. Become a demon, Kyojuro, and fight me forever!'],
      ['rengoku','I will never become a demon. Tanjiro, Inosuke, stay back!'],
      ['','The sky to the east is still dark. Dawn is ten rounds away.']]},
  {id:'district', arc:'district', title:'Two as One', place:'Yoshiwara', foe:'Gyutaro & Daki', mine:['tengen','tanjiro','zenitsu','inosuke','nezuko','mice'], enemy:['gyutaro','daki','hand'], level:'hard',
    stars:{standing:3, rounds:4},
    boosts:[{side:1, hp:2.0, pow:3, label:'Gyutaro & Daki: +100% HP, +3 PWR'}],   // retuned Oct 27, 2026 after Mark Tanjiro went to 46 HP and the Muscle Mice joined (94/74/98%)   // tougher once Nezuko awakens (Oct 26, 2026); +80% after Mark Tanjiro went to 40 HP
    beats:[{when:'ko', id:'daki', who:'gyutaro', text:'Sister! Get back up!'}, {when:'low', id:'tengen', at:.35, text:'Flashy to the very end!'}],
    phases:[{id:'gyutaro', at:.4, pow:2, spd:1, label:'+2 PWR, +1 SPD', line:'You hurt my sister. Now I’ll rip you apart.'}],
    awaken:[{id:'tanjiro', at:.5, round:3, lines:[['','Gyutaro’s blood sickles close in. Tanjiro’s heart pounds like a war drum.'],
      ['tanjiro','I can’t lose here. Not with everyone counting on me!'],
      ['tanjiro_mark','My forehead is burning… and my body feels light. Hinokami Kagura!',{awaken:true}]]},
      {id:'nezuko', to:'nezuko_awakened', at:.6, round:2, lines:[['daki','Is that all? A demon who won’t even eat humans is nothing.'],
      ['tanjiro','Nezuko? Nezuko, what’s happening to you?!'],
      ['nezuko_awakened','Grrrrr…!',{awaken:'鬼'}]]}],
    outro:[['daki','Brother! It’s not fair!'],['gyutaro','Wherever you’re going, I’m going with you.'],['tengen','Flashy. Now let me sit down for a second.']],
    blurb:'Two demons sharing one life. Cut both heads at the same time.',
    scene:[['daki',"How dare you look at me! Brother, they're bullying me!"],
      ['gyutaro',"Who made my sister cry? I'll take everything you have."],
      ['tengen','Listen up! Their heads have to fall at the same time. Let\'s make it flashy!']]},
  {id:'typezero', arc:'swordsmith', title:'Type Zero', place:'The hidden village', foe:'Yoriichi Type Zero', mine:['tanjiro','hotaru'], enemy:['typezero'], level:'normal',
    stars:{standing:1, hp2:55, rounds:2},
    beats:[{when:'low', id:'tanjiro', at:.4, text:'It sees every opening… then I’ll make a new one!'}],
    outro:[['','The puppet cracks open. Inside: a sword centuries old.'],['hotaru','This blade… I’ll polish it. Now hand me yours.'],['tanjiro','Yes, Hotaru! …Please put the knife down.']],
    blurb:'A six-armed training doll, built to copy the greatest swordsman.',
    scene:[['','Deep in the woods, a puppet with six arms waits for a challenger.'],
      ['tanjiro',"It moves like a real swordsman… Hotaru, my sword's still chipped!"],
      ['hotaru',"You CHIPPED it?! Fine. I'll reforge it. Then I'll kill you."]]},
  {id:'gyokko', arc:'swordsmith', title:'Pots and Mist', place:'The hidden village', foe:'Gyokko', mine:['muichiro'], enemy:['gyokko'], level:'normal',
    awaken:[{id:'muichiro', round:1, lines:[['','Trapped in the water prison, Muichiro is running out of air.'],
      ['muichiro','Father… Brother… I remember now. I was never useless.'],
      ['muichiro_mark','Cloud-shaped marks spread across his face. The water prison bursts apart.',{awaken:true}]]}],
    stars:{standing:1, hp2:45, rounds:7},
    beats:[{when:'low', id:'gyokko', at:.5, text:'My true form! Behold my perfect body!'}],
    outro:[['gyokko','Impossible! My masterpiece!'],['muichiro','I remember now. My brother. Why I fight.']],
    boosts:[{side:1, hp:1.5, label:'Gyokko: +50% HP'}],
    blurb:'Upper Moon Five and his pots against the Mist Hashira.',
    scene:[['gyokko','Admire my art! Every pot is a masterpiece!'],
      ['muichiro',"I don't care about pots. I'll forget you soon anyway."],
      ['gyokko','Forget ME?! I will drown you in my water prison!']]},
  {id:'swordsmith', arc:'swordsmith', title:'Splitting Emotions', place:'The hidden village', foe:'Hantengu', mine:['tanjiro_mark','genya','nezuko','mitsuri'], enemy:['hantengu','gyokko'], level:'hard',
    awaken:[{id:'mitsuri', at:.75, round:1, lines:[['','The demons tear through the village. Mitsuri plants herself in front of everyone.'],
      ['mitsuri','Everyone believed in me… I won’t let them down!'],
      ['mitsuri_mark','A heart-shaped mark blooms on her neck. Love Breathing, full power!',{awaken:true}]]}],
    stars:{standing:2, rounds:12},
    beats:[{when:'ko', id:'hantengu', who:'tanjiro', text:'He split again?!'}, {when:'low', id:'nezuko', at:.4, text:'Mmph!!'}],
    outro:[['','Tanjiro’s blade finds the real Hantengu at last, and Zohakuten crumbles with him.'],['nezuko','Mmph!'],['tanjiro','Nezuko… you’re standing in the sun!']],
    boosts:[{side:1, hp:2, pow:1, label:'Upper Moons: +100% HP, +1 PWR'}],
    blurb:'Two Upper Moons at once. Cut Hantengu down and four more appear. Then they merge.',
    scene:[['hantengu',"Don't hurt me! I'm so weak! So very weak!"],
      ['genya',"Cut his head off and he splits? Then I'll eat them all!"],
      ['mitsuri',"I won't let anyone else get hurt. Leave the big one to me!"],
      ['','Two Upper Moons attack the village at once. The Mark on Tanjiro’s forehead is already burning.']]},
  // Hashira Training (CK, Oct 27, 2026): the retired Sound Hashira drills the trio. Beat him.
  {id:'hashira_training', arc:'castle', title:'Hashira Training', place:'The Ubuyashiki estate, weeks before', foe:'Retired Tengen', mine:['tanjiro','zenitsu','inosuke'], enemy:['tengen_retired'], level:'normal',
    stars:{standing:2, rounds:7},
    boosts:[{side:1, hp:3.75, pow:6, label:'Retired Tengen: +275% HP, +6 PWR'}],
    beats:[{when:'round', round:2, id:'tengen_retired', text:'Too slow! Flashier! FLASHIER!'}],
    outro:[['tengen_retired','Not bad! You three are almost flashy enough.'],['zenitsu','Almost?! I’ve been running for nine hours!'],['inosuke','Again! I’m not done!']],
    blurb:'The retired Sound Hashira wants to see some flash. Knock him down.',
    scene:[['tengen_retired','Listen up! Muzan is coming, and every one of you has to get stronger. Fast!'],
      ['tanjiro','We’re ready, Mr. Uzui!'],
      ['tengen_retired','Ready? Then come at me, all three of you. Make it flashy!']]},
  // Kagaya's sacrifice (CK, Oct 27, 2026): he blows himself up in the opening scene (his Final Resolve clip), then five
  // Hashira and Tamayo hold Muzan until Nakime drops everyone into the castle. Winning unlocks Kagaya.
  {id:'estate', arc:'castle', title:'The Ubuyashiki Estate', place:'The Ubuyashiki mansion', foe:'Muzan', mine:['gyomei','sanemi','obanai','mitsuri','muichiro','tamayo'], enemy:['muzan'], level:'hard',
    stars:{standing:2, health:15},
    twist:{survive:7},
    boosts:[{side:0, only:['gyomei','sanemi','obanai','mitsuri','muichiro'], pow:2, spd:1, label:"Kagaya's Final Resolve: Hashira +2 PWR, +1 SPD"},
      {side:1, hp:5, pow:7, label:'Muzan: +400% HP, +7 PWR'}],   // ~70% at every level (+8 PWR is a cliff: his whips ignore DEF)
    beats:[{when:'round', round:3, id:'tamayo', text:'My medicine is working. Keep him here!'}, {when:'low', id:'muzan', at:.5, text:'Enough of this. Nakime!'}],
    outro:[['nakime','*strum*'],['gyomei','The floor is falling away… Everyone, stay alive. We meet again in his castle.'],['muzan','Come, then. I will kill every one of you in my own home.']],
    blurb:'Kagaya’s last gift. Five Hashira and Tamayo against Muzan himself.',
    scene:[['muzan','So this is where you hide, Ubuyashiki. A dying man in an empty house.'],
      ['kagaya','Welcome, Muzan. I knew you would come… and I knew it would be tonight.'],
      ['muzan','You disgust me. Your body rots from the inside, and still you smile.'],
      ['kagaya','You think of yourself as eternal. But what is eternal is human will. My children carry it… and they will cut you down.'],
      ['muzan','Your children are insects. I will crush every one of them.'],
      ['kagaya','Then let me give you my final resolve. My children… thank you.',{clip:'kagaya'}],
      ['gyomei','Namu Amida Butsu… Master. We will not waste this.'],
      ['tamayo','Muzan. Do you remember me? My medicine is already inside you.'],
      ['sanemi','Surround him! Nobody lets him out of this garden!']]},
  {id:'nakime', arc:'castle', title:'The Shifting Floors', place:'Infinity Castle', foe:'Nakime', mine:['tanjiro','giyu','murata'], enemy:['nakime','hand','swamp','kyogai'], level:'normal',
    stars:{standing:2, rounds:5},
    beats:[{when:'round', round:2, id:'nakime', text:'*strum*'}, {when:'low', id:'murata', at:.5, text:'Why is it always me?!'}],
    outro:[['nakime','*the strings snap*'],['murata','We’re alive! I’m alive! Somehow!'],['giyu','Keep moving. The upper floors are worse.']],
    boosts:[{side:1, pow:4, label:'Castle demons: +4 PWR'}],
    blurb:'One strum of the biwa and the whole castle moves.',
    scene:[['','The floor drops away. The slayers fall into a castle with no end.'],
      ['nakime','*strum* The castle answers to me.'],
      ['murata',"Why am I always here?!"],
      ['giyu','Stay close. The demons here are hers to command.']]},
  // Kanae's last night (CK, Oct 27, 2026): a flashback. Hold Doma until dawn; winning unlocks Kanae.
  {id:'kanae', arc:'flashback', title:'The Flower Hashira', place:'Four years earlier, before dawn', foe:'Doma', mine:['kanae'], enemy:['doma'], level:'hard',
    stars:{standing:1, hp2:10, health:20},
    twist:{survive:4},
    boosts:[{side:0, hp:1.3, label:"Kanae's resolve: +30% HP"}],   // attack blindly and she falls; Defend when hurt and she makes dawn
    beats:[{when:'low', id:'kanae', at:.4, text:'Just until the sun… just a little longer.'}],
    outro:[['doma','The sun! What a shame. You were such a lovely one.'],['kanae','Shinobu… don’t become a slayer for my sake. Live a happy life.'],['shinobu','No. I’ll find the demon who did this. And I’ll kill him.']],
    blurb:'The night Shinobu lost her sister. Hold the Upper Moon until the sun comes up.',
    scene:[['doma','What a beautiful Hashira. Your breathing smells of flowers. Shall I save you from your suffering?'],
      ['kanae','I wish demons and humans could get along. But you… you’ve eaten too many people.'],
      ['kanae','Flower Breathing. I only need to last until the sky turns light.']]},
  // Wisteria and Petals of Futility in one (CK, Oct 27, 2026): Shinobu alone first; the moment she falls (Doma devours
  // her and her wisteria poison starts eating him, 5 HP a round) Kanao and Inosuke arrive. Kept the id doma2.
  {id:'doma2', arc:'castle', title:'Petals of Futility', place:'Infinity Castle, the lotus pond', foe:'Doma', mine:['shinobu'], enemy:['doma'], level:'hard',
    stars:{standing:2, rounds:8},
    twist:{reinforce:[{id:'kanao', after:'shinobu', round:5},{id:'inosuke', after:'shinobu', round:5}]},
    beats:[{when:'low', id:'shinobu', at:.5, text:'Just a little longer. The poison is working.'}, {when:'ko', id:'shinobu', who:'doma', text:'Delicious! …Hm? Something is wrong with my body.'},
      {when:'low', id:'doma', at:.4, text:'My body is… melting? How interesting!'}],
    outro:[['doma','So this is what it feels like… to be in love?'],['kanao','Sister… Kanae… it’s over.'],['inosuke','…Mom.']],
    boosts:[{side:0, only:['shinobu'], hp:1.2, label:"Shinobu's resolve: +20% HP"}, {side:1, hp:1.3, label:'Doma: +30% HP'}],
    blurb:'Shinobu against the demon who killed her sister. When she falls, Kanao and Inosuke finish it.',
    scene:[['doma',"A Kocho! You smell like the girl I ate. Your sister, wasn't she?"],
      ['shinobu',"Shall we be friends? No? Then hold still while I poison you."],
      ['shinobu','Kanao… if I fall, it’s up to you. Every drop of me is wisteria.']]},
  {id:'kaigaku', arc:'castle', title:'Senior Brother', place:'Infinity Castle', foe:'Kaigaku', mine:['zenitsu'], enemy:['kaigaku'], level:'normal',
    stars:{standing:1, hp2:50, rounds:2},
    beats:[{when:'low', id:'zenitsu', at:.5, text:'Grandpa… I won’t lose to him.'}],
    outro:[['kaigaku','Thunder… a form I never learned…'],['zenitsu','I wanted to fight beside you, you know.']],
    boosts:[{side:1, hp:1.5, pow:1, label:'Kaigaku: +50% HP, +1 PWR'}],
    // Zenitsu opens with First Form; Kaigaku mocks it; then Seventh Form is ready straight away (CK, Oct 27, 2026)
    chain:{id:'zenitsu', lines:[['kaigaku','Thunderclap and Flash. That’s it? The only form you ever learned, and you still think it can touch me?'],
      ['kaigaku','Grandpa should have thrown you out years ago. You’re trash, Zenitsu. You always were.'],
      ['zenitsu','I told you. I made a form of my own. Thunder Breathing, Seventh Form…',{awaken:'雷'}]]},
    blurb:'Zenitsu faces the student who betrayed their master.',
    scene:[['kaigaku',"Still only one form, Zenitsu? Grandpa wasted his time on you."],
      ['zenitsu',"Grandpa cut his own belly because of you. I made a form of my own. For him."]]},
  {id:'akaza', arc:'castle', title:'Destructive Death', place:'Infinity Castle', foe:'Akaza', mine:['tanjiro','giyu'], enemy:['akaza'], level:'hard',
    stars:{standing:1, hp2:15, rounds:10},
    boosts:[{side:1, hp:1.85, pow:2, label:'Akaza: +85% HP, +2 PWR'}],   // was +20% / +1 before Tanjiro's Selfless State (Oct 27, 2026)
    beats:[{when:'low', id:'akaza', at:.5, text:'Your spirit… it’s just like Kyojuro’s.'}, {when:'low', id:'giyu', at:.4, text:'Tanjiro, keep going. I’ll hold.'}],
    awaken:[{id:'giyu', at:.5, round:4, lines:[['','Akaza’s fists shatter the floor. Giyu takes a blow meant for Tanjiro.'],
      ['giyu','I was never worthy of being a Hashira… but I won’t let him die.'],
      ['giyu_mark','A wave-shaped mark rises on his cheek. Water Breathing, Eleventh Form: Dead Calm.',{awaken:true}]]},
      // Tanjiro finds the Selfless State here (it unlocks for Mark Tanjiro everywhere once this battle is won)
      {id:'tanjiro', at:.5, round:3, lines:[['tanjiro','Father… I remember now. No wasted motion. No anger. Just breathe.'],
      ['akaza','What…? His fighting spirit… it’s gone. I can’t sense him at all!'],
      ['tanjiro_mark','The Selfless State. The Transparent World. I can see everything now.',{awaken:'透', pic:'tanjiro_selfless'}]]}],
    outro:[['akaza','Koyuki… I remember now.'],['','Akaza ends himself, choosing his memories over strength.'],['tanjiro','Rengoku… we did it.']],
    blurb:"Tanjiro and Giyu against the demon who killed Rengoku.",
    scene:[['akaza','You again. The weakling from the train.'],
      ['tanjiro',"Rengoku didn't lose to you. He protected everyone. Now it's my turn."],
      ['giyu',"Together, Tanjiro."]]},
  {id:'flash_kokushibo', arc:'flashback', title:'Brothers', place:'Sixty years later', foe:'Kokushibo', mine:['yoriichi_old'], enemy:['kokushibo'], level:'hard',
    stars:{standing:1, hp2:25, rounds:3},
    beats:[{when:'low', id:'kokushibo', at:.5, text:'Even now… you are so far ahead of me.'}],
    outro:[['','Yoriichi dies standing, mid-swing. His last strike was enough.'],['kokushibo','Even at the very end… I could not surpass you.']],
    boosts:[{side:1, pow:4, label:'Kokushibo: +4 PWR'}],
    blurb:'An old man, a demon, and the brother he never stopped chasing.',
    scene:[['','Decades pass. One night, a demon with six eyes meets an old man on the road.'],
      ['kokushibo','Yoriichi… You are old. You will die soon.'],
      ['yoriichi_old',"Brother. How sad. I'm here to cut you down."]]},
  {id:'kokushibo', arc:'castle', title:'Upper Moon One', place:'Infinity Castle, deep', foe:'Kokushibo', mine:['muichiro','genya','kiriya'], enemy:['kokushibo'], level:'hard',
    stars:{standing:2, rounds:7},
    boosts:[{side:1, hp:2.35, pow:5, label:'Kokushibo: +135% HP, +5 PWR'}],   // +120% until he got three specials (Nov 11, 2026); was +90% until Mark Muichiro got 40 HP (Nov 10, 2026); +65% before Nov 5, 2026: retuned Nov 5, 2026 when Sanemi and Gyomei started arriving with their synergies
    beats:[{when:'round', round:3, id:'sanemi', text:'Hands off my brother!'}, {when:'round', round:4, id:'gyomei', text:'Namu Amida Butsu. It ends here.'}],
    phases:[{id:'kokushibo', at:.5, pow:2, spd:1, ready:true, second:true, label:'+2 PWR, +1 SPD, Moonbow ready', line:'My blade grows. Moon Breathing, Sixteenth Form.'}],
    outro:[['kokushibo','What is this… monster I’ve become?'],['','Kokushibo crumbles. The Hashira who fought him gave everything.'],['sanemi','Genya… hang on.']],
    twist:{reinforce:[{id:'sanemi', round:3},{id:'gyomei', round:4}]},
    awaken:[{id:'muichiro', round:1, lines:[['muichiro_mark','My Mark is back. You won’t lay a finger on Genya.',{awaken:true}]]},
      {id:'sanemi', round:5, lines:[['','Kokushibo’s moon blades fill the hall. The Hashira are pushed to the edge.'],
        ['sanemi_mark','So this is the Mark. Good. Now I can keep up with you, monster!',{awaken:true}]]},
      {id:'gyomei', round:5, lines:[['gyomei_mark','Namu Amida Butsu. The Mark has come. I will carry it to the end.',{awaken:true}]]}],
    blurb:'The strongest demon after Muzan, once a slayer himself.',
    scene:[['kokushibo',"Mist… You are my descendant. Become a demon, like I did."],
      ['muichiro','Never.'],
      ['genya',"Hold on, Muichiro! My brother's coming, and Gyomei's right behind him!"]]},
  {id:'flash_muzan', arc:'flashback', title:'The Sun Itself', place:'Four hundred years ago', foe:'Muzan & Tamayo', mine:['yoriichi'], enemy:['muzan','tamayo'], level:'normal',
    stars:{standing:1, hp2:10, rounds:5},
    beats:[{when:'low', id:'muzan', at:.5, text:'Impossible… what IS this man?!'}],
    outro:[['muzan','That man… he will haunt me for centuries.'],['','Muzan shatters into pieces and flees. Yoriichi lets Tamayo go.'],['tamayo','I will spend my life finishing what he started.']],
    boosts:[{side:1, only:['tamayo'], hp:1.25, label:'Tamayo: +25% HP'}],
    blurb:'The only swordsman Muzan ever truly feared.',
    scene:[['','Four hundred years ago, on a quiet night road.'],
      ['muzan','A swordsman? Step aside before I lose my patience.'],
      ['yoriichi','What do you think the life of a person is?'],
      ['tamayo',"That man… Muzan is afraid. I've never seen him afraid."]]},
  {id:'dawn', arc:'dawn', title:'Until Dawn', place:'The city streets', foe:'Muzan (Final Form)', mine:['tanjiro_mark','giyu_mark','obanai_mark','kanao','chachamaru'], enemy:['muzan_final'], level:'hard',
    stars:{standing:2, health:30},
    boosts:[{side:1, hp:3.5, pow:4, label:'Muzan (Final Form): +250% HP, +4 PWR'}],
    beats:[{when:'round', round:5, id:'tanjiro', text:'Hold on! The sky is getting lighter!'}, {when:'low', id:'giyu_mark', at:.35, text:'Don’t stop. Not now.'}],
    phases:[{id:'muzan_final', at:.5, pow:3, ready:true, label:'+3 PWR, special ready', line:'Enough! I will destroy all of you before the sun!'}],
    outro:[['muzan_final','The sun… no… NO—'],['','The sun rises. Muzan Kibutsuji is gone.'],['tanjiro','It’s over… everyone…']],
    twist:{survive:9}, sunrise:true,   // the battle screen's sun rises round by round (app.js)
    blurb:'The last fight. Hold him until the sun comes up.',
    scene:[['muzan_final','I am the closest thing to perfection. Why won\'t you just die?'],
      ['tanjiro','Everyone fought to get us here. Hold him! Just until the sun rises!'],
      ['','Dawn is nine rounds away.']]},
  {id:'epilogue', arc:'dawn', title:'Demon King', place:'The rising sun', foe:'Demon King Tanjiro', mine:['kanao','inosuke','zenitsu','giyu'], enemy:['tanjiro_demon'], level:'hard',
    stars:{standing:2, rounds:4},
    beats:[{when:'low', id:'kanao', at:.5, text:'Tanjiro, it’s me! Come back!'}, {when:'round', round:3, id:'inosuke', text:'Monjiro! Snap out of it!'}],
    phases:[{id:'tanjiro_demon', at:.3, pow:1, label:'+1 PWR', line:'Get… away… from me…'}],
    outro:[['kanao','Tanjiro, come back!'],['tanjiro','…Kanao? Nezuko? I’m… home.'],['','The sun rises on the Demon Slayer Corps. Their war is over.']],
    blurb:"Muzan's last trick: he poured himself into Tanjiro. Bring him back.",
    scene:[['muzan_final','You think you’ve won, boy? The sun can take my body. It will never take my will.'],
      ['tanjiro','Muzan…? Get out… What are you doing to me?!'],
      ['muzan_final','I give you everything. My blood. My power. My dream. Tanjiro… become the King of Demons.'],
      ['tanjiro','No… I won’t… I won’t become you…'],
      ['tanjiro_demon','GRAAAAH!',{awaken:'王'}],
      ['tanjiro_demon',"Get away… I can't… stop…"],
      ['kanao',"Tanjiro! Shinobu left one more medicine. I just need to reach you!"],
      ['inosuke',"Wake up, Monjiro! Who's gonna be my rival?!"],
      ['zenitsu',"Nezuko's waiting for you! Come home!"]]},
];
// Story-locked abilities open once their battle is won, and inside that battle and the ones after it:
// Mark Tanjiro's Selfless State (Destructive Death), Zenitsu's Seventh Form (Senior Brother)
function storyReached(id){ const i=STAGES.findIndex(s=>s.id===id); return loadStory().cleared.includes(id) || (S.mode==='story' && S.stage>=i); }
const selflessUnlocked = () => storyReached('akaza');
// Story progress. CK reset everyone to 0 on Oct 26, 2026 (new key; the old 'squad-draft-story' is deleted on load).
// From here on progress is kept: don't change this key again unless CK asks for another reset.
/* ---------- The Endless Dream (CK, Oct 30, 2026) ----------
   A second story, opened by finishing the main one: 18 battles in 5 chapters. No stars: unlocking it is the reward.
   A third campaign holds one battle, Yoriichi vs the Six, opened by all 72 stars; beating it earns the Hashira Ceremony.
   STAGES is whichever campaign is being played (setCampaign). Saves share one cleared list: stage ids never repeat. */
const DREAM_STAGES = [
  {id:'dr_morning', arc:'dream1', title:'A Perfect Morning', place:'The Kamado home', foe:'Tanjuro', mine:['tanjiro'], enemy:['tanjuro'], level:'easy',
    blurb:'Tanjiro wakes up. Everyone is home.',
    scene:[['nezuko',"Brother, you're late for breakfast!"],['tanjiro','I had a terrible dream. Everyone was gone.'],['tanjuro','Then breathe, Tanjiro. Morning is here.'],['tanjiro',"Father… you're… Of course you're here. Why would I be surprised?"],['tanjuro',"Come. Show me the dance. Let's see how much you remember."]],
    outro:[['tanjuro',"You've grown strong. Stronger than I ever taught you."],['tanjiro','You taught me everything.'],['tanjuro','Did I? When?'],['tanjiro',"…I don't know. It feels like a long time ago."]]},
  {id:'dr_ablaze', pockets:['chuntaro'], arc:'dream1', title:'Heart Ablaze', place:'A training field in the sun', foe:'Rengoku', mine:['tanjiro','zenitsu','inosuke'], enemy:['rengoku'], level:'normal',
    blurb:'A living Rengoku wants to see how far you have come.',
    scene:[['zenitsu','Why are we training? The war is over! I want to nap!'],['inosuke','Fight me, Big Eyebrows!'],['rengoku','Excellent spirit! All three of you, at once!'],['tanjiro','Rengoku… you look well.'],['rengoku','Of course! Why would I not?']],
    outro:[['rengoku',"Well done! You've surpassed me, young Kamado!"],['tanjiro',"Please don't say that."],['rengoku','Why not? It is what every teacher hopes for.'],['inosuke','Hey. Why are you crying again?']]},
  {id:'dr_returned', arc:'dream1', title:'The Two Who Came Back', place:'Mount Sagiri', foe:'Hand Demon', mine:['sabito','makomo'], enemy:['hand'], level:'normal',
    blurb:'Sabito and Makomo get the fight they never finished.',
    scene:[['makomo',"You're late, Sabito."],['sabito','Late for what?'],['makomo',"I don't know. I just feel like we've been waiting a very long time."],['hand','The fox masks! I remember you! I REMEMBER ALL OF YOU!'],['sabito','Then remember this. Swing again.']],
    outro:[['makomo',"We won. That never happened before, did it?"],['sabito',"Don't be strange. We're the best Urokodaki ever trained."],['makomo','Sabito… where are the other children?'],['sabito','…What other children?']]},
  {id:'dr_wrongtrain', arc:'dream1', title:'The Wrong Train', place:'The Mugen Train', foe:'Akaza', mine:['rengoku'], enemy:['akaza'], level:'normal',
    boosts:[{side:0, hp:1.8, pow:3, label:'Rengoku: +80% HP, +3 PWR'}],
    blurb:'A demon is sighted on a train. An ordinary mission.',
    scene:[['tanjiro','Rengoku, why are we on this train?'],['rengoku',"A demon's been sighted! An ordinary mission!"],['tanjiro',"Please. Don't fight him alone."],['rengoku','Him? Who, Kamado?'],['akaza','Good evening, Kyojuro. Become a demon, and we can fight forever.']],
    outro:[['rengoku','Well fought! Upper Moon Three, defeated at last!'],['tanjiro',"You did it, Rengoku! You're all right!"],['rengoku','…Tanjiro. Why are you crying?'],['tanjiro',"I don't know. I just feel like I already said goodbye to you."],['rengoku','Strange. I remember a train. A sunrise. And then… nothing at all.']]},
  {id:'dr_flowers', pockets:['aoi'], arc:'dream2', title:'Flowers Together', place:'The Butterfly Estate', foe:'Doma', mine:['kanae','shinobu'], enemy:['doma'], level:'normal',
    boosts:[{side:1, hp:1.25, label:'Doma: +25% HP'}],   // added Nov 11, 2026 when Shinobu's poison went to 8 (was 85/90/70% with no boost)
    blurb:'Two sisters, and the demon they share.',
    scene:[['kanae',"Shinobu, you've grown so serious. Smile for me."],['shinobu',"Sister, I… I can't remember why I stopped."],['doma','What a lovely pair of sisters! Shall I save you both?'],['shinobu','You. I know that voice. I have hated that voice for a very long time.'],['kanae',"Then let's end it together."]],
    outro:[['kanae',"There. It's over."],['shinobu','It was never this easy. Why was it this easy?'],['kanae',"Maybe because this time, you weren't alone."]]},
  {id:'dr_wives', arc:'dream2', title:'Three Wives', place:'The Entertainment District', foe:'Daki', mine:['hinatsuru','makio','suma'], enemy:['daki'], level:'normal',
    blurb:"Tengen's wives go undercover, and things go badly.",
    scene:[['suma',"I don't want to go undercover! Lord Tengen said it would be fun, and it's NOT!"],['makio',"Stop crying or I'll give you something to cry about!"],['hinatsuru',"Focus, both of you. The Oiran is a demon, and he's counting on us."],['daki','Three ugly little mice. Which one should I wear first?']],
    outro:[['tengen',"Flashy work, my wives! I couldn't be prouder!"],['suma','We did it, Lord Tengen! Your eye is… you have both your eyes!'],['tengen','Of course I do. Why would I not?'],['hinatsuru',"…Yes. Of course. Forgive me. I don't know why I looked at it."]]},
  {id:'dr_selection', pockets:['goto'], arc:'dream2', title:'Final Selection, Again', place:'Mount Fujikasane', foe:'Hand Demon', mine:['giyu','sabito'], enemy:['hand','swamp'], level:'normal',
    blurb:'Giyu goes back to the mountain he never really left.',
    scene:[['giyu',"Sabito. You're supposed to…"],['sabito',"Supposed to what? Stay behind me, Giyu. I'll handle this."],['giyu','No. Not this time. This time I stand beside you.'],['sabito','Since when do you talk so much?']],
    outro:[['sabito','We passed. Both of us.'],['giyu','Both of us.'],['sabito','So why do you look like that? We won!'],['giyu',"Because I have never been this happy. And I don't trust it."]]},
  {id:'dr_nothing', pockets:['aoi'], arc:'dream2', title:'Nothing Stays Dead', place:'The Butterfly Estate, at dusk', foe:'Doma', mine:['kanae','shinobu','giyu','tanjiro'], enemy:['doma'], level:'hard',
    twist:{survive:6}, boosts:[{side:1, hp:4, pow:4, label:'Doma: +300% HP, +4 PWR'}],
    blurb:'Something that was finished is back.',
    scene:[['tanjiro',"Everyone's so happy. Why does it keep hurting?"],['doma','Good morning! Did you miss me?'],['shinobu','No. No, we killed you.'],['doma',"Did you? I wouldn't know. Nothing here seems to stick."],['giyu','Tanjiro, get back. This is wrong. All of this is wrong.']],
    outro:[['doma',"Keep trying. I don't mind. I can do this forever, and so can you."],['','He smiles and walks away, untouched.'],['shinobu',"The dead don't come back, Tanjiro."],['tanjiro','You did.'],['shinobu',"…Yes. That's what I'm afraid of."]]},
  {id:'dr_brothers', arc:'dream3', title:'Two Brothers', place:'The Tsugikuni lands', foe:'Hand Demon', mine:['yoriichi','michikatsu'], enemy:['gyokko','hand','swamp'], level:'normal',
    blurb:"A memory older than anyone living.",
    scene:[['tanjiro',"Where is this? I know these mountains. These are my ancestors' memories."],['michikatsu',"Stay close to me, Yoriichi. I'm the elder. I'll protect you."],['yoriichi','Yes, brother.'],['tanjiro',"Him… that's him? Before?"]],
    outro:[['michikatsu','You were everywhere at once. I barely touched my sword.'],['yoriichi',"We won together, brother. That's what matters."],['michikatsu','Together. Yes.'],['','His hand tightens on his blade.']]},
  {id:'dr_envy', arc:'dream3', title:"The Moon's Envy", place:'The Tsugikuni lands, at dusk', foe:'Michikatsu', mine:['yoriichi'], enemy:['michikatsu'], level:'hard',
    boosts:[{side:1, hp:1.7, pow:2, label:'Michikatsu: +70% HP, +2 PWR'}],
    blurb:'Every step he takes, his brother was already there.',
    scene:[['michikatsu','Every step I take, you were already there.'],['yoriichi','Brother, I never wanted to be ahead of you.'],['michikatsu','I know. That is what I cannot forgive.'],['michikatsu','Draw your sword. For once in my life, look at me as an equal.']],
    outro:[['yoriichi',"I've always looked up to you. All of my life."],['michikatsu',"…Even a dream won't let me win."],['yoriichi','A dream?'],['','They both go still, and turn toward where Tanjiro is standing.']]},
  {id:'dr_question', pockets:['tecchin'], arc:'dream3', title:'A Question from the Sun', place:'Beyond the memory', foe:'Yoriichi', mine:['tanjiro_mark'], enemy:['yoriichi'], level:'normal',
    boosts:[{side:0, hp:2.2, pow:4, label:'Tanjiro: +120% HP, +4 PWR'}],
    blurb:'He finally meets the man whose earrings he wears.',
    scene:[['yoriichi','You can see me, can\'t you? Child with my earrings.'],['tanjiro',"You're Yoriichi. You saved my family's line. I've wanted to thank you all my life."],['yoriichi','Then show me your dance.']],
    outro:[['yoriichi',"Your Sun Breathing is complete. I'm glad."],['tanjiro','Please, stay. Teach me more.'],['yoriichi','I died long ago, Tanjiro. Why are you dreaming of me?'],['','The sky above them flickers.']]},
  {id:'dr_hakuji', arc:'dream4', title:'Hakuji', place:'The Soryu dojo', foe:'Rival dojo', mine:['hakuji'], enemy:['dojo_fighter','dojo_fighter','dojo_fighter'], level:'normal',
    boosts:[{side:0, hp:2, pow:3, label:'Hakuji: +100% HP, +3 PWR'}],
    blurb:'A dream can hold more than one person.',
    scene:[['tanjiro','A dream. If this is a dream, then who else is in here?'],['hakuji',"Koyuki, stay inside. Master Keizo, I'll deal with them."],['tanjiro',"Akaza? No. That's who he was."],['hakuji','I swore I\'d protect them. This time I will be here.']],
    outro:[['hakuji',"You've seen how this ends, haven't you? You, boy."],['tanjiro','You can see me?'],['hakuji','Leave me this. Just this one morning. Please.'],['','Tanjiro bows, and walks away.']]},
  {id:'dr_train', pockets:['chuntaro'], arc:'dream4', title:'The Dream Train', place:'A train with no end', foe:'Enmu', mine:['tanjiro','zenitsu','inosuke','nezuko'], enemy:['enmu'], level:'normal',
    boosts:[{side:1, hp:3.5, pow:5, label:'Enmu: +250% HP, +5 PWR'}],
    blurb:'Only one demon could do something like this.',
    scene:[['inosuke','I smell a demon! Finally!'],['zenitsu',"There's a sound under everything. Like breathing. Like the whole world's asleep."],['tanjiro','It has to be Enmu. Only he could do this.'],['enmu','Oh, you came. How sweet. And how very, very late.']],
    outro:[['enmu',"Hit me all you like. I'm only a passenger here."],['tanjiro','Stop this dream!'],['enmu',"Me? Oh, you poor boy. You really don't know."]]},
  {id:'dr_confess', pockets:['tecchin'], arc:'dream4', title:"Enmu's Confession", place:'The last carriage', foe:'Enmu', mine:['tanjiro_mark'], enemy:['enmu','rengoku','kanae'], level:'normal',
    boosts:[{side:0, hp:1.6, pow:2, label:'Tanjiro: +60% HP, +2 PWR'},{side:1, hp:.6, label:'Shadows: −40% HP'}],
    blurb:'He has one thing left to tell you.',
    scene:[['enmu',"I've made hundreds of dreams. I know a borrowed one when I see one."],['enmu',"I didn't build this place. I just crawled in, to enjoy the view."],['tanjiro','Then who?'],['enmu',"Who woke up crying? Who can't let them go? Who needs them all alive?"]],
    outro:[['tanjiro',"No. No, that isn't…"],['enmu',"There it is. It's yours, boy. Every sunrise. Every smile."],['enmu',"You're the dreamer. And something else has been dreaming with you."],['','Far away, a voice laughs. Tanjiro knows that voice.']]},
  {id:'dr_heart', arc:'dream4', title:'Into the Heart', place:"Tanjiro's heart", foe:'Shadows', mine:['nezuko_awakened','zenitsu','inosuke','kanao'], enemy:['doma','akaza','kokushibo'], level:'normal',
    boosts:[{side:1, hp:.38, pow:-2, label:'Shadows: −62% HP, −2 PWR'}],
    blurb:'If he will not come out, they are going in.',
    scene:[['nezuko',"Brother won't wake up. He won't answer me."],['zenitsu',"Then we go in and get him! I'm terrified! Let's go!"],['kanao','I reached him once before. I can do it again.'],['inosuke','Nobody leaves my henchman behind!']],
    outro:[['nezuko','Brother! I can hear him!'],['kanao',"He's fighting something. Hurry."],['nezuko',"Brother, please. I'm here. I'm the one who's still here."]]},
  {id:'dr_wontwake', arc:'dream5', title:"The Boy Who Won't Wake", place:"Tanjiro's heart", foe:'Demon King Tanjiro', mine:['tanjiro_mark'], enemy:['tanjiro_demon'], level:'normal',
    boosts:[{side:0, hp:2, pow:4, label:'Tanjiro: +100% HP, +4 PWR'}],
    blurb:'The hardest fight of his life.',
    scene:[['tanjiro_demon',"Why would you leave? They're alive here. Father. Mother. Rengoku."],['tanjiro','None of this is real.'],['tanjiro_demon',"It's real enough. Stay, and nobody ever dies again. Isn't that what you wanted?"],['tanjiro','…More than anything.']],
    outro:[['tanjiro','But Nezuko is calling me. The real Nezuko.'],['tanjiro_demon',"Then you'll lose them all a second time."],['tanjiro','I know.'],['','The shadow breaks. Muzan stands behind it, where he has always been.'],['muzan_final',"Then I'll keep this world for myself."]]},
  {id:'dr_nine', pockets:['goto'], arc:'dream5', title:'Nine Hashira', place:'Where the dream is breaking', foe:'Final Muzan', mine:['giyu','shinobu','rengoku','muichiro','mitsuri','obanai','sanemi','gyomei','tengen'], enemy:['muzan_final'], level:'hard', waves:3,
    boosts:[{side:1, hp:2.85, pow:2, label:'Muzan: +185% HP, +2 PWR'}],   // was +260%: retuned Nov 5, 2026 (later waves now get their synergies)
    phases:[{id:'muzan_final', at:.25, rally:true, pow:3, label:'+3 PWR', line:'Why won\'t you stay DEAD?!', reply:{id:'rengoku', text:'Because he remembers us!'}}],
    blurb:'Three at a time. Choose the order. Everyone left charges in at the end.',
    scene:[['muzan_final',"You cling to the dead, boy. So I'll use them. I've lived in your grief since the last sunrise."],['tanjiro',"I can't beat him alone."],['rengoku','You never had to!'],['giyu','Tanjiro. Stay behind us.'],['shinobu','Just once more, all of us.'],['gyomei','Namu Amida Butsu. Hashira, to your places.']],
    outro:[['muzan_final',"You'll wake up alone. You'll beg to come back here."],['sanemi','Shut up.'],['tanjiro',"He's fading. All of it's fading."],['rengoku','Then there\'s one thing left to do, young Kamado.']]},
  {id:'dr_waking', pockets:['aoi'], arc:'dream5', title:'Waking', place:'The last dawn', foe:"Muzan's Will", mine:['tanjiro','giyu'], enemy:['muzan'], level:'hard',
    twist:{protect:'tanjiro', reinforce:[{id:'rengoku',round:2},{id:'tengen_retired',round:3},{id:'shinobu',round:4},{id:'kanae',round:5},{id:'sabito',round:6},{id:'makomo',round:7}]},
    boosts:[{side:1, hp:1.5, label:"Muzan's Will: +50% HP"}],   // was +80%: arrivals' synergies made Tanjiro Muzan's target (Nov 5, 2026)
    blurb:'Keep Tanjiro alive. If he falls, it all ends.',
    scene:[['muzan','Everything you love ends the moment you open your eyes.'],['tanjiro',"I know. I've already lived through it."],['rengoku',"Go on. We'll walk with you as far as we can."]],
    outro:[['','The dream turns to morning. They stand together one last time.'],['tanjuro',"You remembered the dance. That's all a father could ask."],['shinobu','Smile, Tanjiro. It suits you.'],['kanae','Thank you for looking after my sister.'],['sabito',"You never needed us to swing for you."],['makomo',"Be happy. That's an order."],['rengoku','Set your heart ablaze. Now, and always.'],['tanjiro','Thank you. All of you. Goodbye.'],['','Everything turns to white.']]},
];
const DREAM_FINALE = [
  ['nezuko',"Brother? Brother! You're awake!"],
  ['tanjiro','I had a dream.'],
  ['nezuko','Was it a sad one?'],
  ['tanjiro',"No. It was a good one. It's just over now."],
  ['','The sun rises through the window. The real one.'],
];
const SIX_STAGES = [
  {id:'six', arc:'six', title:'Yoriichi vs the Six', place:'A road at the end of the night', foe:'The Upper Moons', mine:['yoriichi'], enemy:['kokushibo','doma','akaza','hantengu','gyokko','gyutaro'], level:'hard',
    boosts:[{side:0, hp:2.7, pow:3, label:'Yoriichi: +170% HP, +3 PWR'}],   // +160% until Kokushibo and Doma got more specials (Nov 11, 2026)
    blurb:'For the ones who earned every star.',
    scene:[['yoriichi','Six moons, and no sun among them.'],['kokushibo','Brother.'],['yoriichi','You look tired, Michikatsu. Let me end this.']],
    outro:[['yoriichi',"It's done. Rest, all of you."]]},
];
const CAMPAIGNS = {main:MAIN_STAGES, dream:DREAM_STAGES, six:SIX_STAGES};
const ALL_STAGES = [...MAIN_STAGES, ...DREAM_STAGES, ...SIX_STAGES];
function setCampaign(c){ S.campaign=c; STAGES=CAMPAIGNS[c]||MAIN_STAGES; }
let STAGES = MAIN_STAGES;   // the campaign being played
const STORY_KEY = 'squad-draft-story-v2';   // {cleared:[ids], stars:{id: best stars 1–3}}
try{ localStorage.removeItem('squad-draft-story') }catch(e){}
// TV mode reads and writes a phone's save instead of this device's (tv.js sets STORY_SOURCE.get / .put): the players'
// progress lives on their phones, so the TV plays story and deals unlocks from theirs
const STORY_SOURCE = {get:null, put:null};
function loadStory(){
  const v=STORY_SOURCE.get && STORY_SOURCE.get(); if(v) return JSON.parse(JSON.stringify(v));
  try{ return JSON.parse(localStorage.getItem(STORY_KEY))||{cleared:[]} }catch(e){ return {cleared:[]} } }
function writeStory(s){ if(STORY_SOURCE.put && STORY_SOURCE.get && STORY_SOURCE.get()) return STORY_SOURCE.put(s); try{ localStorage.setItem(STORY_KEY,JSON.stringify(s)) }catch(e){} }
// Two saves combined: every battle either has won, and for each battle the better star run
function mergeStory(a, b){
  const out={cleared:[...new Set([...(a.cleared||[]), ...(b.cleared||[])])], goals:{}, stars:{}, title:b.title||a.title||undefined};
  [a,b].forEach(x=>Object.entries(x.stars||{}).forEach(([id,n])=>{ if(n>(out.stars[id]||0)){ out.stars[id]=n; if(x.goals&&x.goals[id]) out.goals[id]=x.goals[id]; else delete out.goals[id]; } }));
  return out;
}
// Stars: ★ win, ★★ win with at least `standing` fighters still up (or team health above `hp2`%), ★★★ win within `rounds` rounds (or, on some survive
// stages, with your team above `health`% at the end). Targets come from simulated strong-player wins (CLAUDE.md).
// ★★ is "fighters standing" where that means something; on solo battles (and wherever 1 fighter standing is all a win
// needs) it's "team above hp2% health" instead, so it's never the same as just winning (CK spotted that).
function starGoals(st){ const g=st.stars||{standing:1};
  return ['Win', g.hp2?`Win with your team above ${g.hp2}% health`:`Win with ${g.standing}+ fighters standing`,
    g.rounds?`Win within ${g.rounds} rounds`:`Finish with your team above ${g.health}% health`]; }
// The three star goals are separate (one star each): which ones the battle just finished met
function goalsMet(st){
  if(S.winner!==0) return [false,false,false]; const g=st.stars||{standing:1}, mine=S.teams[0].filter(u=>!u.spawn);
  const up=mine.filter(u=>u.alive).length, hp=mine.reduce((a,u)=>a+Math.max(0,u.hp),0)/mine.reduce((a,u)=>a+u.max,0)*100;
  return [true, g.hp2 ? hp>=g.hp2 : up>=g.standing, g.rounds ? S.round<=g.rounds && !S.survived : hp>=g.health];
}
const starsEarned = st => goalsMet(st).filter(Boolean).length;
// The goals met in this battle's best single win (most goals; stars don't add up across replays: CK, Oct 26, 2026).
// Saves that only kept a count show it as the first goals.
function goalsGot(id){ const s=loadStory(), g=(s.goals||{})[id], n=(s.stars||{})[id]||0; return [0,1,2].map(k=>!!(g&&g[k]) || (!g && k<n)); }
const stageStars = id => goalsGot(id).filter(Boolean).length;
const totalStars = () => MAIN_STAGES.reduce((a,st)=>a+stageStars(st.id),0);
function saveStars(id,met){ const n=met.filter(Boolean).length, s=loadStory(); if(n<=stageStars(id)) return;   // only a better run replaces the best
  s.goals=s.goals||{}; s.stars=s.stars||{}; s.goals[id]=met.map(Boolean); s.stars[id]=n; writeStory(s); }
const storyWon = () => loadStory().cleared.filter(id=>STAGES.some(s=>s.id===id)).length;
function saveStoryClear(id){ if(typeof track==='function') track([`s_${id}_win`]); const s=loadStory(); if(!s.cleared.includes(id)) s.cleared.push(id); writeStory(s); }
const stageCleared = i => loadStory().cleared.includes(STAGES[i].id);
const stageUnlocked = i => i===0 || stageCleared(i-1) || stageCleared(i);
// The battle to play next: the first unlocked one not won yet (or the last one)
const nextStage = () => { const i=STAGES.findIndex((st,k)=>stageUnlocked(k) && !stageCleared(k)); return i<0 ? STAGES.length-1 : i; };
const stageLevel = () => STAGES[S.stage].level;
// Points for the draft replay: what the preset squad costs
const stageBudget = st => st.mine.reduce((a,id)=>a+BYID[id].cost,0);
// One line describing a stage's twist (shown on the stage card and the battle screen)
function twistText(st){
  const t=st.twist||{}, out=[];
  if(t.survive) out.push(`Survive ${t.survive} rounds`);
  if(t.protect) out.push(`Protect ${BYID[t.protect].short}: lose if they fall`);
  if(t.reinforce) out.push(...t.reinforce.map(r=>r.after ? `${BYID[r.id].short} arrives when ${BYID[r.after].short} falls (or in round ${r.round})` : `${BYID[r.id].short} arrives in round ${r.round}`));
  if(st.start) out.push('Part 2: '+Object.keys(st.start).map(id=>`${BYID[id].short} starts hurt`).join(', '));
  (st.phases||[]).forEach(ph=>out.push(`Boss: ${BYID[ph.id].short} powers up at ${Math.round(ph.at*100)}%`));
  return out.join(' · ');
}
// Draft replay pool: the Corps and its allies (no demons, no Legends), plus whoever is in this stage's preset squad
// Start a stage: the scene first, then the battle with the preset squad (or the draft, when replaying with draft)
function startStage(i, draft=false){
  const st=STAGES[i]; if(typeof track==='function') track([`s_${st.id}_try`]);
  Object.assign(S,{stage:i, storyDraft:draft, phase:'scene', sceneAt:0, sceneVs:false, sceneMid:false, sceneOutro:false, showTheirs:false, awaken:st.awaken||null, chain:st.chain||null, n:2, maxTeam:MAXTEAM, budget:stageBudget(st), twist:st.twist?JSON.parse(JSON.stringify(st.twist)):null, startState:st.start||null, boosts:st.boosts||null, phases:st.phases||null, beats:st.beats||null,
    first:0, lastPicker:null, history:[], k:0, sel:null});
  S.names=[playerName()||'Player 1', st.foe];   // this phone's player name (Settings)
}
// The lines of the scene being shown: the opening, or the ending after a win
// The story's finale (after beating Demon King Tanjiro, "Finish the story" on the win screen), then the end credits
const FINALE = [
  ['kanao','Tanjiro… you’re back. You’re really back.'],
  ['tanjiro','Kanao… everyone… I’m sorry. I’m so sorry I hurt you.'],
  ['inosuke','Hmph! Took you long enough, Monjiro! I almost won our rivalry by default!'],
  ['zenitsu','Don’t ever scare us like that again! I cried so much I’m all dried out!'],
  ['nezuko','Big brother… welcome home.'],
  ['giyu','Tanjiro. You did well. All of you did.'],
  ['sanemi','Tch. Don’t get used to hearing it from me… but you earned your rest.'],
  ['kiriya','Everyone. On behalf of the Ubuyashiki family… thank you.'],
  ['kiriya','Muzan Kibutsuji is gone. With no demons left to hunt, the Demon Slayer Corps is disbanded as of today.'],
  ['kiriya','Giyu. Sanemi. You are the last of the Hashira. Your duty is done. Please… go and live.'],
  ['sanemi','Live, huh… Genya would’ve wanted that. Fine. I’ll live.'],
  ['giyu','Then I’ll live for the ones who couldn’t. For Sabito. For all of them.'],
  ['urokodaki','Giyu. Tanjiro. My boys came home.'],
  ['tengen_retired','Ha! Now THAT was a flashy ending! You kids really did it!'],
  ['tanjiro','Nezuko, Zenitsu, Inosuke… let’s go home. Back to the mountain.'],
  ['nezuko','Let’s light the stove again. Just like before.'],
  ['zenitsu','Nezuko, I’ll chop all the firewood! Every day! Forever!'],
  ['inosuke','And I’ll eat all the food! Every day! Forever!'],
  ['kanao','Tanjiro… may I come and visit?'],
  ['tanjiro','Any day you want, Kanao. The door’s always open.'],
  ['tanjiro','Mother. Father. Everyone. We did it. The sun is shining… and we’re home.'],
];
const FINALE_SURVIVORS = ['tanjiro','nezuko','zenitsu','inosuke','kanao','giyu','sanemi','kiriya','urokodaki','tengen_retired','murata','yushiro'];
const FINALE_FALLEN = ['kagaya','rengoku','shinobu','mitsuri','obanai','muichiro','gyomei','genya','kanae','sabito','tamayo'];
const sceneLines = () => S.sceneFinale ? (S.campaign==='dream' ? DREAM_FINALE : FINALE) : S.sceneMid ? S.midScene||[] : S.sceneOutro ? STAGES[S.stage].outro : STAGES[S.stage].scene;
// Every scene picture any stage asks for (app.js looks for the files at startup)
const scenePics = () => [...new Set(ALL_STAGES.flatMap(st=>[...(st.scene||[]), ...(st.outro||[]), ...(st.awaken||[]).flatMap(a=>a.lines||[])])
  .map(l=>l[2]&&l[2].img).filter(Boolean))];
// Which side of the scene a speaker stands on: your squad on the left, the enemy on the right
const sceneSide = (st, id) => st.enemy.some(e=>BYID[e].fam===BYID[id].fam) && !st.mine.includes(id) ? 'r' : 'l';
// After the scene: fight with the preset squad, or draft your own
function beginStage(){
  const st=STAGES[S.stage];
  if(st.waves && !S.storyDraft && S.phase!=='order'){ S.phase='order'; S.waveOrder=[]; return; }
  if(!S.storyDraft){
    // Nine Hashira: the first few fight, and the rest wait their turn (the order you chose)
    const order=st.waves ? (S.waveOrder||st.mine) : st.mine;
    S.picks=[[...order.slice(0,st.waves||order.length), ...(st.pockets||[])], st.enemy.slice()]; S.locked=[true,true]; S.pool=[];
    startBattle(); S.waveQ=st.waves ? order.slice(st.waves) : [];
    return;
  }
  S.phase='draft'; S.picks=[[],st.enemy.slice()]; S.locked=[false,true];
  // Draft replay: every character within the points except the ones you're fighting (any version of them), from your
  // unlocked characters plus the battle's own squad (CK, Oct 26, 2026; it used to be Corps and allies only)
  const fams=new Set(st.mine.map(id=>BYID[id].fam)), foes=new Set(st.enemy.map(id=>BYID[id].fam));
  S.pool=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=S.budget && !foes.has(c.fam) && (isUnlocked(c.id) || fams.has(c.fam))).map(c=>c.id)
    .sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name)).concat(dealHelpers());
}

/* ---------- unlocks ----------
   Winning a story battle unlocks the characters it introduces for every other mode (Local, Online, Quickplay,
   Practice, the daily challenge). Starting roster: the Corps' base slayers and allies (Nezuko, Tamayo, Yushiro),
   the small demons (Hand Demon, Swamp Demon) and the back-pocket helpers. Locked until the story reaches them:
   every other demon, every Mark ✦ version, the Legends and the alternate versions. */
const STARTER_DEMONS = ['nezuko','tamayo','yushiro','hand','swamp'];
const DREAM_CARDS = ['makomo','tanjuro','chuntaro','hinatsuru','makio','suma','aoi','michikatsu','tecchin','hakuji','goto'];
const lockable = c => DREAM_CARDS.includes(c.id) || !c.helper && !c.spawn && ((c.demon && !STARTER_DEMONS.includes(c.id)) || c.mark || c.legend || c.id!==c.fam || ['typezero','kagaya','kanae'].includes(c.id));
// Extra unlocks that never fight in a story battle themselves, tied to the battle where they belong in canon
const UNLOCK_EXTRAS = {estate:['kagaya'], kokushibo:['sanemi_mark','gyomei_mark']};
// Cards that unlock at a later battle than their first appearance (Doma: when Kanao and Inosuke finish him, not when he beats Shinobu)
const UNLOCK_AT = {doma:'doma2', muzan:'flash_muzan'};   // Muzan first fights at the Estate but unlocks late (CK)
// stage id → the card ids winning it unlocks (each card is unlocked by the first battle it appears in)
const STAGE_UNLOCKS = (()=>{ const seen=new Set(), out={};
  MAIN_STAGES.forEach(st=>{ const ids=[...st.mine, ...st.enemy, ...((st.twist||{}).reinforce||[]).map(r=>r.id), ...(st.awaken||[]).map(a=>a.to||a.id+'_mark'), ...(UNLOCK_EXTRAS[st.id]||[])];
    out[st.id]=[...new Set(ids)].filter(id=>BYID[id] && lockable(BYID[id]) && !seen.has(id) && (!UNLOCK_AT[id] || UNLOCK_AT[id]===st.id) && !DREAM_CARDS.includes(id)); out[st.id].forEach(id=>seen.add(id)); });
  DREAM_STAGES.concat(SIX_STAGES).forEach(st=>{ out[st.id]=[]; });
  // The Endless Dream: a character unlocks in the battle they fight in (CK)
  Object.assign(out, {dr_morning:['tanjuro'], dr_ablaze:['chuntaro'], dr_returned:['makomo'], dr_flowers:['aoi'], dr_wives:['hinatsuru','makio','suma'], dr_selection:['goto'], dr_brothers:['michikatsu'], dr_question:['tecchin'], dr_hakuji:['hakuji']});
  return out; })();
// Lockable cards that no battle unlocks start unlocked
const UNLOCKED_FROM_STORY = new Set(Object.values(STAGE_UNLOCKS).flat());
function isUnlocked(id){
  const c=BYID[id]; if(!c || !UNLOCKED_FROM_STORY.has(id)) return true;
  const won=loadStory().cleared; return ALL_STAGES.some(st=>won.includes(st.id) && STAGE_UNLOCKS[st.id].includes(id));
}
// Which story battle unlocks a card (for the Codex and locked cards), or null
const unlockStage = id => MAIN_STAGES.findIndex(st=>STAGE_UNLOCKS[st.id].includes(id));
// What finishing things opens: the Endless Dream, Demon Side Quickplay, Yoriichi vs the Six
const dreamOpen = () => loadStory().cleared.includes(MAIN_STAGES[MAIN_STAGES.length-1].id);
const dreamDone = () => loadStory().cleared.includes('dr_waking');
const sixOpen = () => totalStars()===MAIN_STAGES.length*3;
const starsOn = () => !S.campaign || S.campaign==='main';
// The Hashira Ceremony: the title lives in the story save, so it follows the save to a TV and into the cloud backup
function hashiraTitle(){ return loadStory().title||''; }
function saveHashiraTitle(t){ const s=loadStory(); s.title=t; writeStory(s); }
const titled = name => hashiraTitle() && name && name===playerName() ? `${hashiraTitle()} Hashira ${name}` : name;
