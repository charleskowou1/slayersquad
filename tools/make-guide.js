// Builds Slayer-Squad-Guide.txt: rules, every character's stats and special, synergies, helpers, modes, simulated
// win rates and worked examples, written for an AI assistant giving strategy advice. Numbers come from the game files,
// so rebuild after any change:  node tools/make-guide.js
const fs = require('fs'), path = require('path');
const { loadGame } = require('./load-game');
const N = +process.env.N || 6000;   // simulated drafts for the win-rate table
const g = loadGame(['roster.js', 'engine.js', 'story.js', 'notes.js'], `
function winRates(n){ const st={};
  for(let i=0;i<n;i++){ S.mode='cpu'; S.budget=20; S.poolType='random'; newDraft(); let k=0; while(S.phase==='draft'&&k++<60) cpuDraftStep();
    const t=[S.picks[0].slice(),S.picks[1].slice()]; S.names=['A','B']; S.picks=t; startBattle();
    while(S.phase!=='over'){ cpuBothSides(); resolve(); if(S.phase==='result') S.round++; }
    t.forEach((team,p)=>team.forEach(id=>{ st[id]=st[id]||[0,0]; st[id][0]++; if(S.winner===p) st[id][1]++; })); }
  return st; }
function data(){ return {ROSTER, BYID, STAGES, LEVELS, MICE_PWR, AMBUSH_DMG, SUNRISE_ROUND, ARCS, twistText}; }`);
const { ROSTER, BYID, STAGES, LEVELS, MICE_PWR, AMBUSH_DMG, SUNRISE_ROUND, ARCS, twistText } = g.data();
const T = []; const out = s => T.push(s); const hr = t => out('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78));
const PRIO = { 3: 'acts first (priority 3)', 2: 'acts very early (priority 2)', 1: 'acts early (priority 1)' };

// The version is the offline cache number (bumped with every push); the change log is tools/changelog.js
const VERSION = +(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8').match(/squad-draft-v(\d+)/)||[])[1];
const CHANGES = require('./changelog');
if(CHANGES[0][0] !== VERSION) console.warn(`Note: sw.js is v${VERSION} but the newest line in tools/changelog.js is v${CHANGES[0][0]}. Add this version's change.`);
const fmtDate = d => new Date(d+'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
out(`SLAYER SQUAD — COMPLETE GUIDE FOR STRATEGY ADVICE
Version ${VERSION} · generated ${fmtDate(new Date().toISOString().slice(0,10))} from the game's own data.
A Demon Slayer squad-battler (personal fan game by Charles Kowou, inspired by Amelia Gray).

WHAT CHANGED, VERSION BY VERSION (newest first; the biggest change in each)
${CHANGES.map(([v,d,t])=>`  v${String(v).padEnd(3)} ${fmtDate(d).padEnd(13)} ${t}`).join('\n')}

HOW TO USE THIS FILE (for the assistant reading it)
You are helping a player (Mia) get better at Slayer Squad. Everything below is exact game data and rules.
Use it to recommend drafts, counter-picks, move choices and when to use helpers. Health is shown in the game as
a percent of each fighter's own max HP; the raw numbers here (HP, PWR, DEF…) are what the engine uses.
The simulated win rates near the end come from computer-vs-computer games: treat them as hints, not truth.`);

hr('1. THE GAME IN ONE MINUTE');
out(`- Two sides draft a squad of fighters on a points budget, then battle in rounds.
- Each round, every fighter secretly picks ATTACK, DEFEND or their SPECIAL. Then everything resolves.
- Last side with anyone standing wins. A match stopped at round 40 is a draw.
- Modes: Same Phone (one phone passed between 2 players), Online (Quick Match against anyone, or Play Friends with a code for 2 to 4 players. Friends choose Draft or Random against each other, or team up against the computer in Final Form or Gauntlet. 2 players against each other play live or take turns; 3 or 4, and all co-op, play live),
  Quickplay (Classic: you vs the computer at Easy/Normal/Hard, or its Game Modes: Gauntlet (one 30-point squad against bigger random waves; survivors keep their damage, recover 20% and have specials ready), Upper Moon Rush (35 points, slayers only; eight fights from Kaigaku to Final Muzan, each with more lesser demons, survivors carry over the same way), Random Squads (both teams dealt at random, the same 5 to 50 points for each)), Final Form (also under Game Modes; the hardest mode, replayable: 45 points of Marked slayers and Corps support; after you lock in, Muzan answers with Final Muzan and three Upper Moons chosen to counter your squad, all at +15% PWR, playing their best moves; the sun rises in round 7 instead of 10, and at sunrise the demons gain +50% PWR and can no longer Defend. Marks have all their specials here, unlocked or not), Practice (you draft every team, the computers' too, then fight
  them; doesn't count toward records) and Story Mode (${STAGES.length} battles with preset squads).
- Each mode (not Story) also sets MAX FIGHTERS PER TEAM, 1–6 (default 6). 1 = one-on-one duels.
- 2v2 TEAMS (4 players): players 1 & 3 vs 2 & 4 (Quickplay: you + an allied computer vs two). Each player drafts
  and controls their own squad; heals, hides, shields and training can target the partner's fighters; Giyu's Dead
  Calm covers both squads; a side wins when the other side has nobody left. The 12-pt card cap applies.
- OPTIONAL BANS (off by default, under "More options"): before the draft each player bans one character.
- SUNRISE: from round ${SUNRISE_ROUND} (not in Story) demons burn 10% of their max HP that round, 5% more every round after (15%, 20%, 25%…), and stop regenerating
  (Demon King Tanjiro is sun-proof; Nezuko burns only on the first morning, then she has conquered the sun). Long games end; Final Muzan got weaker in long fights.
- STORY UNLOCKS: winning a story battle unlocks the demons, Marks, Legends and alternate versions it introduces for
  every other mode. Base slayers, allies, Hand/Swamp Demon and helpers are always available.
- DAILY CHALLENGE: one preset battle per day with a goal (win / win within N rounds / keep X standing / no losses),
  the same on every phone. Doesn't count toward stats.
- FREE-FOR-ALL (3 or 4 players): every team fights every other team; last team standing wins (places 1st–4th).
  A special that hits "every enemy" hits every fighter on the ONE team you aim it at. Cards over 12 pts aren't dealt
  (big single cards dominated: the first picker won ~60%; with the cap the pick order splits ~40/33/26%).
  The computer gangs up on whichever team is ahead. Draft is snake order through all players (A B C C B A A B C…).`);

hr('2. THE DRAFT');
out(`- Budget: 10, 20 (default), 30 or Unlimited points per side (set per mode on the main menu). With Unlimited only the fighter limit stops a team.
- Team size: 1 to 6 fighters. You can lock your team at any time ("Lock team"); you auto-lock if nothing is affordable.
- Who picks first: a character thinks of a number from 1 to 9; each player takes a different number (the computer picks at random); the closest picks first (on a tie, the players call heads or tails). Then snake order: A, B, B, A, A, B, B, A…
  Once one side locks, the other keeps picking until they lock or can't afford anything.
- Each character has versions (base, Mark ✦, or Yoriichi prime/age 85, Tengen/Retired Tengen, Muzan/Final Form).
  Only ONE version of a character can be drafted per match, by either side. Taking Giyu rules out Giyu ✦ for everyone.
- POOL (Settings): "Random" (default) deals 12 characters (14 at 30 points), always at least 3 costing 4 or less;
  "All" offers every character; "Slayers" and "Demons" offer every character on that side (Nezuko, Tamayo and Yushiro count as Slayers). The 10-point 6-pt card cap applies only to Random deals with 2+ fighters. Re-deal is allowed before the first pick (Random pool only).
- Big cards come with a rival: any card costing 9+ is always dealt with another character within 3 points of it
  (a mid-priced card is swapped out for one if needed), so one giant isn't simply decided by who picks first.
- 10-point games only deal cards costing 6 or less. 30-point games favour pricier characters and Mark versions.
- Rarity: Yoriichi is dealt in about 1 draft in 8 (prime about 1 in 23); Final-Form Muzan about 1 in 10.
- BACK-POCKET HELPERS (always offered, 1 pt, max ONE per player, no fighter slot): see section 7.
- POOL NOTES in the game list synergies/matchups that are still affordable and possible in the current deal.`);

hr('3. HOW A ROUND RESOLVES');
out(`- Moves: ATTACK (hit one enemy with PWR; Legends strike twice), DEFEND (take half damage this round),
  or SPECIAL (when off cooldown; see each character). Stunned fighters skip the round.
- ORDER: specials with priority act first (priority 3 > 2 > 1), then everyone else by SPD (highest first),
  ties broken randomly. Attacks and Defend have priority 0. Defend takes effect at the start of the round.
- DAMAGE of a hit with base B against a target with DEF D:
    damage = max(1, B − D, ceil(B / 2))      ← DEF can never cut a hit below half
    "ignores DEF":   damage = B
    target DEFENDING: damage = ceil(damage / 2)  (Obanai's special slips past Defend)
    Yoriichi caps: he never takes more than 18 per round (Age 85: 12).
- If an attacker's target is already down, the hit goes to a random living enemy.
- COOLDOWN "N": usable from round 1; after using it, it's ready again N rounds later (cooldown 3: rounds 1, 4, 7…).
  Mark versions recharge 1 round faster.
- END OF ROUND, in order: poison ticks → Shinobu's wisteria damage → demon regeneration → cooldowns tick down.
- STUN: the target loses its next round. POISON: fixed damage at end of round for a number of rounds.
- Back-pocket helpers act at the very start of the round they're used.`);

hr('4. TEAM SYNERGIES AND MATCHUPS (applied at the start of battle)');
out(`Same team:
- Kamaboko Squad: Tanjiro + Zenitsu + Inosuke → whole team +2 SPD.
- Siblings: Tanjiro + Nezuko → when either is hit, the other counter-hits the attacker for 3 (not vs area specials).
- Hashira: 2+ Hashira → each Hashira +1 PWR.
- Upper Moons: 2+ Upper Moons → each +1 regen.
- Muzan's Blood: Muzan + another demon (not Nezuko) → Muzan and those demons +1 PWR.
- Marks spread: 2+ Mark ✦ fighters → each +1 SPD.
- Devoted: Tamayo + Yushiro → Yushiro +2 PWR.
- Sun Lineage: Yoriichi (either) + Tanjiro → Tanjiro +2 PWR.
- Mentor: Urokodaki + Tanjiro / Giyu / Sabito → those pupils +1 DEF.
- Corps Master: Kagaya + any Hashira → every Hashira +1 DEF.
- Final Resolve: Kagaya's special knocks himself out; every Hashira on his team with a Mark card (Giyu, Gyomei, Sanemi,
  Muichiro, Mitsuri, Obanai) awakens it. Killed by an enemy first = nothing. Rengoku, Tengen and Shinobu get nothing.
- Two as One: Gyutaro + Daki → Gyutaro +2 PWR, and if one falls while the other still stands, they get back up at the
  end of the round with 30% (once each). Knock both out in the same round to stop it. (Strong: ~58% when paired.)
- Temari & Arrows: Susamaru + Yahaba → Susamaru's hits slip past Defend.
- Kocho Sisters: Kanae + Shinobu → Shinobu's poison lasts 4 rounds instead of 3.
- Kanae's student: Kanae + Kanao → Kanao +1 PWR.
- Training partner: Yoriichi Type Zero + Muichiro → Muichiro +1 PWR.
- Brothers: Sanemi + Genya → both +2 PWR.
- Love Hashira: Obanai + Mitsuri → both +1 PWR, +1 SPD.
- Set Your Heart Ablaze: Rengoku + any Tanjiro → Tanjiro +1 PWR, Rengoku +1 DEF.
- Old Friends: Giyu + Sabito → Giyu +2 PWR +1 DEF, Sabito +1 SPD.
Opposing teams:
- Muzan fears the Sun: Muzan facing Yoriichi → Muzan −3 PWR, −2 SPD.
- Kokushibo shaken: Kokushibo facing Yoriichi → −1 DEF.
- Tamayo's medicine: Muzan facing Tamayo → Muzan regen −2.
- Rivals: Zenitsu facing Kaigaku → Zenitsu +2 PWR.
- Rival: Rengoku facing Akaza → Rengoku +2 PWR.
- Revenge on Doma: Kanao or Inosuke facing Doma → +2 SPD, and +4 damage on Doma through his DEF.
- Wisteria Body: a demon that knocks out Shinobu loses 5 HP every round after (not Akaza: he never eats women).
- Sun Breathing: Yoriichi's special stops every demon it hits from regenerating for good (not Demon King Tanjiro: sun-proof).
Special rules on single cards:
- Nakime never attacks. Her basic move (in place of Attack) is Biwa Strum: an enemy she picks acts last this round
  (always happens first). Castle Shift sends an enemy away for the round: they can't act and can't be hit. If she's
  the last one standing on her team she flees, which counts as a knockout, so never leave her alone.
- Mark Tanjiro ✦ (9 pts): after his first Hinokami Kagura, his next special is the Selfless State (once per match;
  unlocked by winning Destructive Death in the story). It goes before everything, even the biwa. Until Hinokami is
  ready again he can't be hit, stunned, sent away, strummed or arrowed, EXCEPT on a round he Attacks: striking
  reveals him for that round (his attacks ignore DEF). He can Save a teammate once per state (they take no damage and
  can't be stunned that round). Poison still ticks. When the state ends, his next Hinokami Kagura can't be blocked
  by anything (Defend, Dead Calm, hides, dodges, Castle Shift, arrows). Tip: Save when a teammate is about to fall,
  and only attack when the hit is worth being exposed for.
- Kagaya never attacks either. His basic move is Words of Resolve (every ally heals 2, in normal speed order). His
  special Final Resolve knocks himself out and awakens the Mark of every Hashira on his team who has one (stats rise,
  special keeps its current wait). He's slow (SPD 5, 14 HP, 1 DEF) and the special has no priority, so enemies can
  kill him first. Alone on his team he falls, like Nakime.
- Yahaba's Vector Arrows (moves first): every hit the chosen enemy throws this round misses.
- Awakened Nezuko can't Defend (berserk).
- Yoriichi Type Zero can't be poisoned: it's a puppet.
- Hakuji's Vow: the first time a teammate falls, he gets +3 PWR for the match.
- Michikatsu shares a family with Kokushibo, and Hakuji with Akaza: only one version per draft.
- Yoriichi Type Zero strikes three times per Attack at low PWR (great vs low DEF, poor vs tanks). It's a puppet:
  it doesn't count as Yoriichi, so Muzan isn't scared of it.
- Second versions share a slot with the original (one or the other is dealt): Demon King Tanjiro (rare),
  Awakened Nezuko, Retired Tengen, Final-Form Muzan.
- Hantengu never attacks. His Cower takes half damage. When he falls, all four emotions appear (Sekido, Karaku, Aizetsu,
  Urogi; small). When the last emotion falls, Zohakuten (28 HP) and the real Hantengu (14 HP, 8 DEF) appear. Zohakuten stops
  at 1 HP while the real Hantengu lives. The real Hantengu never attacks: each round his Hatred adds +2 PWR to Zohakuten for good,
  or he hides and heals 6. When he falls, Zohakuten falls with him. Reach him fast.`);

hr('5. EVERY CHARACTER');
out(`Order: most expensive first. Line 2 = cost | HP | PWR | SPD | DEF | regen per round. Hantengu's split forms are listed last; they can't be drafted.`);
// extra tags not already in the card's type line
const tags = c => [c.legend&&'Legend', c.mark&&'Mark ✦', c.hashira&&'Hashira', c.upper&&'Upper Moon', c.demon&&!c.upper&&'Demon', c.spawn&&'split form (not draftable)'].filter(t=>t && !c.type.includes(t.replace(' ✦',''))).join(', ');
const fighters = ROSTER.filter(c => !c.helper).slice().sort((a,b)=> (a.spawn?1:0)-(b.spawn?1:0) || b.cost-a.cost || a.name.localeCompare(b.name));
for (const c of fighters) {
  const s = c.sig, prio = PRIO[s.prio] ? ` · ${PRIO[s.prio]}` : '';
  out(`\n${c.name}  [id: ${c.id}]  — ${c.type}${tags(c)?' · '+tags(c):''}
  ${c.spawn?'—':c.cost+' pts'} | HP ${c.hp} | PWR ${c.pow} | SPD ${c.spd} | DEF ${c.def} | regen ${c.regen||0}${c.strikes>1?` | strikes ×${c.strikes} per Attack, damage cap ${c.cap}/round`:''}
  Special: ${s.name} (cooldown ${s.cd}${prio}) — ${s.desc}${c.sig2?`\n  Then: ${c.sig2.name} (cooldown ${c.sig2.cd}) — ${c.sig2.desc} The two specials take turns.`:''}${c.passive?`\n  Passive: ${c.passive}`:''}${c.mark?'\n  Mark ✦: boosted stats; special recharges 1 round faster.':''}${c.splits?`\n  Splits into: ${c.splits.map(id=>BYID[id].short).join(', ')} when knocked out.`:''}`);
}

hr('6. VERSIONS (only one per match)');
out(`- Yoriichi (prime, 18 pts) or Yoriichi Age 85 (17). Prime is the strongest card in the game and rare.
- Muzan (16) or Muzan Final Form (18, revives once). Final Form is rare.
- Tengen (6, Hashira) or Retired Tengen (4, not a Hashira, shields an ally).
- Mark ✦ versions of Giyu, Gyomei, Sanemi, Muichiro, Mitsuri, Obanai and Tanjiro: +8 HP, +4 PWR, +2 SPD, +1 DEF,
  faster special, higher cost. They also count for "Marks spread" with another Mark.`);

hr('7. BACK-POCKET HELPERS (1 pt, max one per player, no fighter slot, never on the battlefield)');
out(`Each draft offers 3 of the 5 helpers, chosen at random. Drafted from a separate row at the bottom of the draft. In battle, tap the helper chip next to "Lock in moves" on the
round you want; it acts first that round and is then gone.
- Chachamaru (Tamayo's cat): your most hurt fighter (lowest health %) heals half of their CURRENT HP (50% → 75%).
- Kasugai Crow: after both sides lock in, you see the enemy's planned moves (and helper) and may change yours.
  Vs computer, the computer's crow switches any of its fighters you're about to knock out to Defend.
- Muscle Mice (Tengen's mice): every fighter on your team gets +${MICE_PWR} PWR for that round only.
- Hotaru Haganezuka (swordsmith): at the END of the round, your fighter with the longest wait for their special has
  it cut to 1 round (ready the round after next; if it was already 1, ready next round). Use him the round you fire
  your best special and it comes back fast, even in round 1.
- Kiriya Ubuyashiki (Ambush Orders): pick one of your fighters; that round every enemy that attacks them takes ${AMBUSH_DMG}
  damage back (once per attacker). The other side only learns where the trap was when it springs. Best on the
  fighter the enemy most wants to finish (usually your most hurt one).
Helper strength in simulated realistic matches (side with the helper vs without; 50% = no effect):
Chachamaru ~61%, Kiriya ~59%, Hotaru ~58%, Muscle Mice ~54%, Kasugai Crow ~54% (a thinking human gets more from the Crow).`);

hr('8. MODES AND SETTINGS');
out(`- Vs Computer difficulty: Easy (simple, random-ish), Normal (smart but sloppy), Hard (goes for knockouts, spreads
  damage, saves specials, uses helpers well). Hard beats Normal ~59%, Normal beats Easy ~57%.
- Settings: points (10/20/30/Unlimited), pool (Random/All/Slayers/Demons), playback speed, sound.
- Online clock: 1 minute per pick, 1 minute to watch a round, 2 minutes for moves. When time runs out the computer picks, and fighters block (those who can't block attack). In 2-player games it only runs while both players are in the game.
- Online with 2 players: no need to be on at the same time, but it plays live if you are. Each phone drafts or locks in
  moves when it's that player's turn; a resolved round plays back right away, or the next time that player opens the game. The home screen lists
  these games and says whose turn it is. Both phones play the number game to decide who picks first; on a tie, the players call heads or tails.
- Daily challenge: the same set enemy team, points and goal for everyone that day; you draft from your unlocked
  characters. Goals: win, win within N rounds, or win with a named character still standing. For that last goal the
  named character is already on your squad when the draft opens (its points already spent).
- Battle log: the win screen has a Battle log of every round with a Copy button. The copied text lists both squads, the
  result, then for each round what every player chose for each fighter ("Mia chose: Giyu: Dead Calm · Tanjiro: Attack →
  Akaza") followed by what happened, with damage and healing as % of the fighter's max HP. If a player pastes one,
  use it to point out the rounds where a different move or target would have changed the outcome.
- Shared stats: Settings → Stats and every card show how everyone's games went (win rate, and how often a character
  is picked when dealt), counted from players' finished Local, Online and Quickplay games.
- Story mode: ${STAGES.length} battles with preset (canon) squads, each opening with a short scene. Win a battle to unlock the
  next; won battles can be replayed drafting your own squad (every unlocked character within the same points as the
  preset squad, except any version of the enemies). Twists: survive N rounds, reinforcements joining on a set round,
  and two-part fights where part 2 starts with the enemy already hurt. Boosts (shown on each card) tune the difficulty.
- Stars: each battle has 3 goals (win, plus two harder ones); each goal met is a star. A battle's stars are your
  best single win, not added up across replays.
- Mid-battle awakenings: some fighters awaken during the fight (Tanjiro and Nezuko in Two as One, Muichiro, Mitsuri,
  Giyu, Tanjiro in Destructive Death, Sanemi and Gyomei). A short cutscene plays between rounds and they become the
  stronger card on their awakening line, with their special ready.
- Story tips: in The Flower Hashira (Kanae holding Doma until dawn) attacking every round loses; Defend whenever
  she's under half health and she lasts. In Petals of Futility, Shinobu fights Doma alone first: poison him early.
  When she falls he devours her and her wisteria poison eats him every round, and Kanao and Inosuke arrive at once
  (or in round 5 if she's still standing) to finish him. In Senior Brother, open with Thunderclap and
  Flash: Kaigaku mocks it and Seventh Form is ready straight after, back to back. The Ubuyashiki Estate is a 7-round
  hold against a huge Muzan whose whips hit everyone through DEF: spread out the damage, Defend the low ones, and
  let Tamayo's medicine (it cuts his regeneration) work. Helpers are in some battles' squads (Muscle Mice in Two as
  One, Kasugai Crow in Spider Family, Kiriya in Upper Moon One, Chachamaru in Until Dawn): use them on the round
  that matters. Mark Tanjiro's Selfless State unlocks when Destructive Death is won.
  Battles:`);
STAGES.forEach((s,i)=>out(`  ${i+1}. ${s.title} (${ARCS[s.arc].title}) — you: ${s.mine.map(id=>BYID[id].short).join(', ')} · enemy: ${s.enemy.map(id=>BYID[id].short).join(', ')}`
  + [twistText(s), ...(s.boosts||[]).map(b=>b.label)].filter(Boolean).map(x=>' · '+x).join('')));

hr('9. SIMULATED WIN RATES (20-point Random drafts, Hard computer both sides, ' + N + ' drafts)');
out('Share of matches won by teams that drafted each character. Above ~55% = strong for its cost; below ~45% = weak.');
const wr = g.winRates(N);
Object.entries(wr).filter(([id])=>!BYID[id].helper).map(([id,[n,w]])=>[id,w/n,n]).sort((a,b)=>b[1]-a[1])
  .forEach(([id,r,n])=>out(`  ${BYID[id].name.padEnd(30)} ${BYID[id].cost.toString().padStart(2)} pts  ${(r*100).toFixed(0).padStart(3)}%   (${n} teams)`));

hr('10. STRATEGY NOTES (general)');
out(`- Points efficiency matters more than raw power: what fits exactly into the budget often wins.
- Cheap durable fodder (Murata survives one knockout; Hand Demon) soaks hits and fills leftover points.
- Area specials (Doma, Kokushibo, Gyomei, Mitsuri, Tengen, Nezuko, Muzan) shine against many small fighters;
  big single hits (Rengoku, Akaza, Zenitsu, Old Yoriichi) shine against one or two big fighters.
- Ignore-DEF hits (Tanjiro's special, Doma, Kokushibo, Nezuko, Muzan's whips) are best into high-DEF Hashira/Marks.
- Speed decides who acts first; priority specials (Giyu's Dead Calm, Yushiro, Hantengu, Retired Tengen) go before
  everything — Dead Calm makes your whole team untouchable that round, so baiting enemy specials into it is strong.
- Defend halves damage: use it when you expect a big special on a low-health fighter (Obanai ignores it).
- Stuns (Rui, Kyogai, Gyokko) are very strong in small teams (10-point games).
- Demons regenerate every round: finish them, don't spread chip damage. Yoriichi's special stops regeneration.
- The Crow is best on the round when the enemy's big specials come off cooldown.
- Against people: moves are secret, so mixing Defend and Special timing ("mind games") matters.
- Free-for-all: don't look like the leader. Everyone (the computer too) piles onto the strongest team.`);

hr('11. WORKED EXAMPLES');
out(`EXAMPLE DRAFT (20 points, Random pool). Dealt: Doma 11, Giyu 8, Rengoku 7, Tanjiro 5, Nezuko 4, Zenitsu 4,
Inosuke 4, Kanao 4, Murata 2, Hand Demon 2 (12 are dealt now; this example shows 10), plus 3 of the helpers.
  Pick 1  A: Doma (11)            A has 9 left
  Pick 2  B: Tanjiro (5)          B has 15 left
  Pick 3  B: Nezuko (4)           B has 11 left   → Siblings (Tanjiro + Nezuko) on B
  Pick 4  A: Rengoku (7)          A has 2 left
  Pick 5  A: Murata (2)           A has 0 left    → A auto-locks; B keeps picking
  Pick 6  B: Zenitsu (4)          B has 7 left
  Pick 7  B: Inosuke (4)          B has 3 left    → Kamaboko Squad complete on B: +2 SPD for B's whole team
  Pick 8  B: Hand Demon (2)       B has 1 left
  Pick 9  B: Kasugai Crow (1)     B has 0 left    (helper, no fighter slot)
  Result: A = Doma, Rengoku, Murata (3 fighters).  B = Tanjiro, Nezuko, Zenitsu, Inosuke, Hand Demon + Crow.

EXAMPLE DAMAGE: Rengoku (PWR 11) attacks Zenitsu (DEF 2): max(1, 11−2, ceil(11/2)) = 9.
  If Zenitsu Defends: ceil(9/2) = 5. Rengoku's special (PWR+8 = 19) on Zenitsu: max(1, 17, 10) = 17 (Zenitsu has 22 HP).
  Doma's Frozen Lotus (PWR−4 = 10, ignores DEF) hits EVERY enemy for 10, Defend halves it to 5.

EXAMPLE ROUND (teams above): Zenitsu uses Thunderclap and Flash (priority 2), so he acts before everyone using
  Attack, whatever their SPD. He hits Doma for PWR×2 = 14 → max(1, 14−6, 7) = 8 damage.
  Doma uses Frozen Lotus (PWR 14 − 4 = 10, ignores DEF): 10 damage to each of B's fighters; anyone Defending takes 5.
  Tanjiro is hit, but Siblings counters don't trigger on area specials, so Nezuko doesn't strike back this time.
  End of round: Doma regenerates 3 (demons heal every round, so finish them rather than chip at them).`);

const file = path.join(__dirname, '..', '..', 'Slayer Squad Docs', 'Slayer-Squad-Guide.txt');   // CK keeps the guide and the playbook together, outside the repo
fs.mkdirSync(path.dirname(file), {recursive:true});
fs.writeFileSync(file, T.join('\n') + '\n');
console.log('Wrote ' + file + ' (' + T.join('\n').length + ' characters)');
