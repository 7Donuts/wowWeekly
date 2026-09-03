/* -----------------------------------------------------------
   TASK DATA :  Midnight Season 2  ·  Patch 12.1 "Curse of Ula'tek"
   Patch live August 11, 2026 · Season 2 opened August 18, 2026

   Sources: Icy Veins weekly to-do list and 12.1 guides, Wowhead
   patch guides, Blizzard 12.1 patch notes, Method and Warcraft Wiki.

   ── SEASON MODEL ────────────────────────────────────────────
   Every section carries `season: 1` or `season: 2`.
   Season 1 sections are retired content kept for players still
   mopping up Voidforge, Omnium Folio, Void Assaults, the S1 raids
   and the Val / Naigtal invasion zones. The site hides them by
   default (see hideSeason1 in app.js); the "Season 1" toggle in
   the utility bar brings them back.

   Carried-over systems (Delves, Ritual Sites, Prey, Great Vault,
   Mythic+, Professions, PvP, Housing, World Events) are NOT
   duplicated per season. They exist once, with Season 2 content,
   because that is the version live in the game.

   ── CADENCE ─────────────────────────────────────────────────
   Every task carries `cadence`:
     'daily'    resets daily, or is repeatable on a short loop
     'weekly'   resets Tuesday (NA) / Wednesday (EU)
     'longterm' season-long or account-long: campaigns, renown,
                achievement metas, collections, one-time unlocks

   To update for a new patch:
     - Edit task name/desc fields below
     - Add new sections following the same object shape
     - Flip `season` on the outgoing season's sections
     - tag-121 marks 12.1-introduced content
     - BEGINNER_STAGES task IDs must match task ids in SECTIONS
----------------------------------------------------------- */
const SECTIONS = [

  /* ═══════════════════════════════════════════════════════════
     SEASON 2  ·  PRIORITY 1  (Do First)
  ═══════════════════════════════════════════════════════════ */

  {
    id: 'vault',
    icon: 'img/cat-vault.png',
    title: 'Great Vault',
    url: 'https://www.icy-veins.com/wow/great-vault-guide',
    meta: 'Opens Tuesday reset · Claim before you spend a single Mistcrest',
    categories: ['currency'],
    season: 2,
    priority: 1,
    tasks: [
      { id: 'v1', name: 'Open your Great Vault before doing anything else',
        desc: 'First action every reset. Compare all nine slots against what you are wearing before you touch Mistcrests or a Venomblight Manaflux charge: the Vault may hand you that slot for free.',
        cadence: 'weekly', tags: ['tag-vault', 'tag-121'] },
      { id: 'v2', name: 'Fill the Raid row: 2 / 4 / 6 boss kills',
        goal: {max:6, label:'bosses', milestones:[
          {at:2, note:'<i class="ph-fill ph-lock-open"></i>Raid slot 1 unlocked'},
          {at:4, note:'<i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i>Raid slots 1-2 unlocked'},
          {at:6, note:'<i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i>All 3 Raid slots unlocked'},
        ]},
        desc: 'Season 2 pays the Raid row one difficulty tier above the content you cleared: a Normal clear returns Hero 1/6, a Heroic clear returns Myth 1/6. Lair kills (The Tidebound Grotto) also feed this row.',
        cadence: 'weekly', tags: ['tag-vault', 'tag-raid', 'tag-121'] },
      { id: 'v3', name: 'Fill the Dungeon row: 1 / 4 / 8 Mythic+ keys',
        goal: {max:8, label:'keys', milestones:[
          {at:1, note:'<i class="ph-fill ph-lock-open"></i>Dungeon slot 1 unlocked'},
          {at:4, note:'<i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i>Dungeon slots 1-2 unlocked'},
          {at:8, note:'<i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i>All 3 Dungeon slots unlocked'},
        ]},
        desc: 'Eight +10s fills all three Dungeon slots at the highest item level Mythic+ can offer. The row caps at Myth 1/6 from +10 upward, so keys above +10 raise your score and your crest income, not your Vault ceiling.',
        cadence: 'weekly', tags: ['tag-vault', 'tag-mythic', 'tag-121'] },
      { id: 'v4', name: 'Fill the World row: 2 / 4 / 8 completions',
        goal:{max:8, label:'runs', milestones:[
          {at:2, note:'<i class="ph-fill ph-lock-open"></i>World slot 1 unlocked'},
          {at:4, note:'<i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i>World slots 1-2 unlocked'},
          {at:8, note:'<i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i>All 3 World slots unlocked'},
        ]},
        desc: 'Delves, Prey Hunts and Ritual Sites all count. Tier 8 Bountiful Delves and Nightmare Prey cap the row at Hero 1/6 (ilvl 305). The World row cannot produce Myth-track gear, so do not skip Raid or Dungeon rows for it.',
        cadence: 'weekly', tags: ['tag-vault', 'tag-world', 'tag-121'] },
      { id: 'v5', name: 'Plan your rows on purpose, not by accident',
        desc: 'Pick the two rows that actually improve your weakest slots and drive those to their thresholds. Nine random completions beat nothing, but three deliberate ones beat nine random ones.',
        cadence: 'weekly', tags: ['tag-vault'] },
      { id: 'v6', name: 'Take a Nebulous Voidcore bonus roll once three slots are filled',
        desc: 'New in Season 2: the Vault offers a Nebulous Voidcore as a reward option once you fill at least three slots for the following week. That is one bonus roll per week, and a raid boss now costs a single roll rather than two, the same as Mythic+. Rolling on a Heroic kill returns the item on the Myth 1/6 track, so bonus rolls are how you reach Mythic item levels on bosses you are not killing on Mythic.',
        cadence: 'weekly', tags: ['tag-vault', 'tag-raid', 'tag-121'] },
      { id: 'v7', name: 'Take Thalassian Tokens of Merit when no Vault slot is an upgrade',
        goal: {max:3, label:'slots', milestones:[
          {at:1, note:'2 Thalassian Tokens of Merit'},
          {at:2, note:'4 Thalassian Tokens of Merit'},
          {at:3, note:'6 Thalassian Tokens of Merit'},
        ]},
        desc: 'A Vault with nothing worth taking is not a wasted Vault. Trade the week for currency instead, at Vaultkeeper Elysa beside the Great Vault. Six tokens buys a Miasmic Jewelbinder, which adds a socket to a Season 2 helm, bracers or belt that does not have one, or a Spark of Tides, which lifts a crafted piece past the seasonal cap. Cheaper rows buy Mistcrest packs and gold.',
        cadence: 'weekly', tags: ['tag-vault', 'tag-gold', 'tag-121'] },
    ]
  },

  {
    id: 'mistcrests',
    icon: 'img/cat-currency.png',
    title: 'Mistcrests & Upgrades',
    url: 'https://www.icy-veins.com/wow/midnight-pve-gearing-guide',
    meta: '12.1 · Five crest tiers, 100 weekly cap each · Fixed 20 crests per upgrade rank',
    categories: ['currency'],
    season: 2,
    isNew: true,   // new system or instance in 12.1
    priority: 1,
    tasks: [
      { id: 'mc1', name: 'Spend Adventurer, Veteran and Champion Mistcrests before reset',
        desc: 'Season 2 replaced the old crest system with Mistcrests: five tiers (Adventurer, Veteran, Champion, Hero, Myth) matching the five upgrade tracks exactly, with no crossover between them. Every rank costs a flat 20 crests, 100 for a full 1/6 to 6/6 track. Low-tier crests are dead value once your gear passes them, so spend them the week you earn them.',
        cadence: 'weekly', tags: ['tag-gold', 'tag-121'] },
      { id: 'mc2', goal: {max:100, label:'Hero crests'},
        name: 'Work the Hero Mistcrest cap (100 per week)',
        desc: 'Hero Mistcrest is the workhorse of the season. The +4 to +8 Mythic+ band is the most reliable repeatable source and doubles as Great Vault progress. The cap is per tier, per week, and cannot be cleared in one sitting: plan across the reset.',
        cadence: 'weekly', tags: ['tag-gold', 'tag-mythic', 'tag-121'] },
      { id: 'mc3', goal: {max:100, label:'Myth crests'},
        name: 'Chase Myth Mistcrests (Mythic raid and +9 or higher keys only)',
        desc: 'The scarce tier. Myth Mistcrest comes only from Mythic: The Venomous Abyss and Mythic Keystone dungeons at +9 and above, and upgrades Myth gear through roughly ilvl 315 to 328. If you can clear +9s, every one you skip is a rank you cannot buy back.',
        cadence: 'weekly', tags: ['tag-gold', 'tag-mythic', 'tag-raid', 'tag-121'] },
      { id: 'mc4', name: 'Convert surplus crests upward (3 to 1)',
        desc: 'Three crests of one tier become one of the tier above, so 60 Champion Mistcrests convert into 20 Hero Mistcrests, exactly one upgrade rank. Convert anything you cannot spend rather than letting it sit.',
        cadence: 'weekly', tags: ['tag-gold', 'tag-121'] },
      { id: 'mc5', name: 'Spend a Venomblight Manaflux charge on your worst tier slot',
        desc: 'Season 2 renamed Catalyst charges to Venomblight Manaflux. Charges accrue weekly and also drop from Delves and raid boss kills once your 4-piece is unlocked. Converted pieces inherit the secondary stat spread of the item you feed in, so pick the donor carefully. Open the Vault first.',
        cadence: 'weekly', tags: ['tag-gold', 'tag-raid', 'tag-121'] },
      { id: 'mc6', name: 'Bank Ascendant Venomstones for weapons and trinkets',
        desc: 'Ascendant Venomstones push select items past the normal Myth 6/6 ceiling toward the ilvl 344 band that the last two Mythic Venomous Abyss bosses drop at. Weapons and trinkets carry the most stat weight, so spend there first.',
        cadence: 'weekly', tags: ['tag-gold', 'tag-raid', 'tag-121'] },
      { id: 'mc_scion', name: 'Earn Midnight Season 2: Serpent Scion for a free Catalyst charge',
        desc: 'Charges accrue on their own, one at season start and one every two weeks after. This achievement is the only way to get ahead of that clock, and it pays a full extra charge once per season. Any one of three routes finishes it: 1,600 rated PvP, 2,000 Mythic+ rating, or killing Ula\'tek on Heroic or Mythic.',
        cadence: 'longterm', tags: ['tag-vault', 'tag-raid', 'tag-mythic', 'tag-pvp', 'tag-121'] },
      { id: 'mc7', name: 'Missed weeks are not lost: check your catch-up ceiling',
        desc: 'Each week a crest tier has been earnable raises your personal ceiling whether or not you played. A character starting the season late can farm past the nominal 100 to close the gap, so do not assume a skipped week is gone.',
        cadence: 'weekly', tags: ['tag-gold', 'tag-121'] },
    ]
  },

  {
    id: 'coiled-isle',
    icon: 'img/cat-world.png',
    title: 'The Coiled Isle',
    url: 'https://www.icy-veins.com/wow/midnight-patch-12-1-guide',
    meta: '12.1 · New zone off the Zul\'Aman coast · Unlocked by the Curse of Ula\'tek campaign',
    categories: ['world', 'currency', 'coiled-isle'],
    season: 2,
    isNew: true,   // new system or instance in 12.1
    priority: 1,
    tasks: [
      { id: 'ci1', name: 'Complete World Quests on the Coiled Isle (daily)',
        desc: 'The zone\'s baseline income: gear, gold, and Zul\'jarra\'s Forces renown. World quests sit behind campaign progress, so finish the intro chapters first if your map is empty.',
        cadence: 'daily', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'ci2', goal: {max:5, label:'surges'},
        name: 'Clear Cursed Surges as they rotate (5 locations)',
        desc: 'Cursed Surges are rare elite encounters that rotate between five spots on the isle. Soloable or trivial in a small group. Each rewards Adventurer-level gear and Season 2 crests, and infuses the surrounding land and water for 30 minutes afterward.',
        cadence: 'daily', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'ci3', name: 'Fish the 30-minute Cursed Fishing window after a Surge',
        desc: 'Killing a Surge enables Cursed Fishing plus Cursed Land and Waters at that location for 30 minutes. This is the main Captain Tokka reputation engine and the source of the special fish and quest items. Do not clear a Surge and walk away.',
        cadence: 'daily', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'ci4', name: 'Complete "Turn Back the Surge" weekly',
        desc: 'The weekly wrapper for Cursed Surge activity. Free value, easy to forget.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'ci5', goal: {max:3, label:'vaults'},
        name: 'Run the Vaults of Atal\'Utek public events',
        desc: 'Group content in the isle\'s mountain region. Difficulty scales with headcount and so do the rewards, which land in the blue and purple gear band. Gated behind a campaign step.',
        cadence: 'daily', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'ci6', name: 'Complete "Purging the Vaults" weekly (500 renown)',
        desc: 'Weekly quest tied to the Vaults of Atal\'Utek. Worth 500 Zul\'jarra\'s Forces reputation, which is a fifth of a renown rank on its own.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'ci7', name: 'Complete the "Open Sea Fishing" World Quest (500 rep)',
        desc: 'Appears weekly and pays 500 Captain Tokka reputation, the single largest repeatable chunk on that track.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'ci8', name: 'Spend points in the Altar of Corrosion talent tree',
        desc: 'A zone-wide progression tree granting exploration, combat, mobility and reward bonuses across the Coiled Isle. Unlocked during the campaign. Take the reward and mobility nodes early: they compound over the whole season.',
        cadence: 'longterm', tags: ['tag-world', 'tag-121'] },
      { id: 'ci9', name: 'Apply a Contract: Zul\'jarra\'s Forces before farming World Quests',
        desc: 'Craftable or purchasable, and worth 10 or 15 bonus reputation on every World Quest you complete depending on contract rank. Cheap, and it applies to work you were doing anyway.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-121'] },
    ]
  },

  {
    id: 'prey',
    icon: 'img/cat-prey.png',
    title: 'Prey System',
    url: 'https://www.icy-veins.com/wow/prey-system-guide',
    meta: 'Season 2 · New affixes, four snake-themed Coiled Isle hunts · Great Vault World row',
    categories: ['prey'],
    season: 2,
    priority: 1,
    tasks: [
      { id: 'pr_quest', name: 'Start Season 2 Prey: complete "Prey: A Slithering Threat"',
        desc: 'Unlocks the reset Preyhunter\'s Journey track and the Season 2 hunts. Nightmare Mode and Curse of the Isle opened the week of August 19.',
        cadence: 'longterm', tags: ['tag-world', 'tag-121'] },
      { id: 'pr_norm', goal: {max:2, label:'hunts', milestones:[
          {at:1, note:'1 / 2 Normal hunts done'},
          {at:2, note:'<i class="ph-fill ph-check"></i>Both Normal hunts complete'},
        ]},
        name: 'Normal Prey Hunts (2 per week)',
        desc: 'Twice-weekly lockout, and the gentlest entry point. Season 2 runs only the Pack Ambush affix on Normal: a pack of serpentine enemies ambushes you mid-hunt.',
        cadence: 'weekly', tags: ['tag-world', 'tag-121'] },
      { id: 'pr_hard', goal: {max:2, label:'hunts', milestones:[
          {at:1, note:'1 / 2 Hard hunts done'},
          {at:2, note:'<i class="ph-fill ph-check"></i>Both Hard hunts complete'},
        ]},
        name: 'Hard Prey Hunts (2 per week)',
        desc: 'Hard and Nightmare run all three Season 2 affixes, including Exploding Corpse Snakes: defeated enemies release snakes that poison you. Season 1 affixes are gone entirely.',
        cadence: 'weekly', tags: ['tag-world', 'tag-121'] },
      { id: 'pr_nm', goal: {max:2, label:'hunts'},
        name: 'Nightmare Prey Hunts (Great Vault World row, Hero 1/6)',
        desc: 'Four new Nightmare targets in Season 2. Nightmare completions feed the Great Vault World row at Hero 1/6 (ilvl 305), the highest that row can pay.',
        cadence: 'weekly', tags: ['tag-world', 'tag-vault', 'tag-121'] },
      { id: 'pr_ralkala', name: 'Hunt Ral\'kala, Terror of the Isle (Nightmare only)',
        desc: 'A new Nightmare-exclusive encounter added with the Coiled Isle hunts. Worth a look even if you are only there for the achievement.',
        cadence: 'weekly', tags: ['tag-world', 'tag-121'] },
      { id: 'pr_souls', name: 'Spend Corrosive Souls on bracer and belt powers',
        desc: 'Successful hunts now award Corrosive Souls, which buy special bracer and belt powers unique to Season 2. A quiet but real power source that many players leave uncollected.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'pr_afflicted', name: 'Use Afflicted / Tormented Souls to reveal your next Nightmare Prey',
        desc: 'Afflicted Souls unlock at Preyhunter\'s Journey Rank 4 and Tormented Souls at Rank 9. Both drop from Tier 6 and higher Bountiful Delves, instantly reveal your next Nightmare Prey, and hand over an extra Champion or Hero level piece respectively.',
        cadence: 'weekly', tags: ['tag-world', 'tag-delve', 'tag-gold', 'tag-121'] },
      { id: 'pr_rank', name: 'Push Preyhunter\'s Journey to Rank 2 for profession recipes',
        desc: 'Prey rank 2 is one of only three sources of the new 12.1 profession recipes, alongside renown 5 with a new faction and fishing the new isle.',
        cadence: 'longterm', tags: ['tag-world', 'tag-professions', 'tag-121'] },
      { id: 'pr3', name: 'Check the Prey vendor for Season 2 transmog and cosmetics',
        desc: 'New season, new cosmetic track. Sweep the vendor before the season ends rather than after.',
        cadence: 'longterm', tags: ['tag-optional', 'tag-121'] },
    ]
  },

  {
    id: 'delves',
    icon: 'img/cat-delve.png',
    title: 'Delves',
    url: 'https://www.icy-veins.com/wow/delves-guide',
    meta: 'Season 2 · Bountiful and Nemesis live since Aug 18 · Best solo gearing lever in the game',
    categories: ['delve'],
    season: 2,
    priority: 1,
    tasks: [
      { id: 'd1', name: 'Use Trovehunter\'s Bounty in the highest tier you can clear',
        desc: 'One use per week, and it reveals the Hidden Trove inside a Delve. Always spend it at your ceiling, not your comfort tier: the reward band tracks the tier you used it in.',
        cadence: 'weekly', tags: ['tag-delve', 'tag-gold'] },
      { id: 'd_bountiful', goal: {max:8, label:'delves', milestones:[
          {at:2, note:'2 / 8 · World Vault slot 1 unlocked'},
          {at:4, note:'4 / 8 · World Vault slot 2 unlocked'},
          {at:8, note:'<i class="ph-fill ph-check"></i>All 3 World Vault slots unlocked'},
        ]},
        name: 'Complete Bountiful Delves (8 fills the World row)',
        desc: 'Every Delve counts toward the weekly Great Vault World lockout. Tier 8 pays up to ilvl 305 (Hero 1/6), which makes eight to ten Delves a week the most efficient solo gearing route available. Set your current max tier below.',
        cadence: 'weekly', tags: ['tag-delve', 'tag-vault', 'tag-121'],
        tierSelector: true },
      { id: 'd3', name: 'Collect the weekly Delve cache for your tier',
        desc: 'Check for the active weekly Delve quest attached to your current tier and claim it before reset.',
        cadence: 'weekly', tags: ['tag-delve', 'tag-gold'] },
      { id: 'd_souls', name: 'Farm Tier 6+ Delves for Afflicted and Tormented Souls',
        desc: 'Tier 6 and above drop the souls that reveal your next Nightmare Prey and pay an extra Champion or Hero piece. Delves and Prey feed each other in Season 2, so run them in the same week.',
        cadence: 'weekly', tags: ['tag-delve', 'tag-gold', 'tag-121'] },
      { id: 'd_nemesis', name: 'Defeat Azta\'rec, the Season 2 Nemesis (Venomfall Deeps)',
        desc: 'Found in Venomfall Deeps on the Coiled Isle. Rewards a toy, cosmetics, a title and a mount. The solo achievement "Let Me Solo Him: Azta\'rec" requires beating it alone at the higher difficulty; the live achievement supplies the exact tier.',
        cadence: 'longterm', tags: ['tag-delve', 'tag-optional', 'tag-121'] },
      { id: 'd_journey', name: 'Push the reset Delver\'s Journey track',
        desc: 'Season 2 resets Delver\'s Journey with new rewards: the Corroded Soul Crusher, a Delve-O-Bot upgrade, new housing decor, the Snake Eater title, and gear benefits on the late track.',
        cadence: 'longterm', tags: ['tag-delve', 'tag-optional', 'tag-housing', 'tag-121'] },
      { id: 'd_glory', name: 'Work "Glory of the Midnight Delver" for the Giganto Manis mount',
        desc: 'The Season 2 Delve meta-achievement. A long collector project rather than a weekly, but every Delve week chips at it.',
        cadence: 'longterm', tags: ['tag-delve', 'tag-optional', 'tag-121'] },
    ]
  },

  /* ═══════════════════════════════════════════════════════════
     SEASON 2  ·  PRIORITY 2  (Important)
  ═══════════════════════════════════════════════════════════ */

  {
    id: 'mythicplus',
    icon: 'img/cat-mythic.png',
    title: 'Mythic+ Dungeons',
    url: 'https://www.icy-veins.com/wow/midnight-season-2-guide',
    meta: 'Season 2 pool of 8 · No lockout, farm freely · Vault slots at 1 / 4 / 8',
    categories: ['mythic'],
    season: 2,
    priority: 2,
    tasks: [
      { id: 'm1', goal: {max:8, label:'runs', milestones:[
          {at:1, note:'<i class="ph-fill ph-lock-open"></i>Vault slot 1 unlocked'},
          {at:4, note:'<i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i>Vault slots 1-2 unlocked'},
          {at:8, note:'<i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i><i class="ph-fill ph-lock-open"></i>All 3 Vault slots unlocked'},
        ]},
        name: 'Complete 8 Mythic+ keys for the full Dungeon row',
        desc: 'Season 2 runs eight dungeons: Altar of Fangs (new in 12.1), Murder Row, Den of Nalorakk, The Blinding Vale and Voidscar Arena from Midnight, plus King\'s Rest, Temple of Sethraliss and Ruby Life Pools returning.',
        cadence: 'weekly', tags: ['tag-mythic', 'tag-vault', 'tag-121'] },
      { id: 'm2', name: 'Learn Altar of Fangs: new to the Mythic+ pool in 12.1',
        desc: 'The premier new dungeon of the season and the one your group is least likely to know. It entered Heroic and Mythic 0 with the patch on August 11 and joined ranked Mythic+ with Season 2 on August 18.',
        cadence: 'longterm', tags: ['tag-mythic', 'tag-121'] },
      { id: 'm4', goal: {max: 0, label: 'keys'},
        name: 'Farm the +4 to +8 band for Hero Mistcrests',
        desc: 'The most reliable repeatable Hero Mistcrest source in the game, and it fills your Vault row at the same time. Push higher when your group can, but this band is where the crest income lives.',
        cadence: 'weekly', tags: ['tag-mythic', 'tag-gold', 'tag-121'] },
      { id: 'm5', goal: {max: 0, label: '+9s'},
        name: 'Run +9 or higher for Myth Mistcrests',
        desc: 'Myth Mistcrest drops only from +9 and up (and Mythic raid). If you can clear them, these are the keys that raise your gear ceiling rather than just your Vault.',
        cadence: 'weekly', tags: ['tag-mythic', 'tag-gold', 'tag-121'] },
      { id: 'm6', name: 'Complete the weekly dungeon quest in Silvermoon City',
        desc: 'A rotating assigned dungeon with a flat reputation and reward payout. Takes one run you were probably making anyway.',
        cadence: 'weekly', tags: ['tag-mythic', 'tag-gold', 'tag-121'] },
    ]
  },

  {
    id: 'venomous-abyss',
    icon: 'img/cat-raid.png',
    title: 'The Venomous Abyss',
    url: 'https://www.icy-veins.com/wow/midnight-season-2-guide',
    meta: 'Season 2 raid · 8 bosses, ending at Ula\'tek · Click boss bubbles to track kills',
    categories: ['raid'],
    season: 2,
    isNew: true,   // new system or instance in 12.1
    priority: 2,
    tasks: [
      { id: 'vab_story', name: 'The Venomous Abyss: Story Mode',
        desc: 'Solo-friendly narrative run through the raid. No gear progression worth planning around, but it closes the Curse of Ula\'tek story.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-121'],
        diff: 'Story' },
      { id: 'vab_lfr', name: 'The Venomous Abyss: LFR',
        desc: 'Queue via Group Finder. Wing-based, Veteran band rewards.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-121'],
        bosses: [
          { id: 'nekzali',   name: "Nek'zali",           url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'sentinels', name: 'Entombed Sentinels', url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'explorers', name: 'Lost Explorers',     url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'vashnik',   name: 'Vashnik',            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'sszorak',   name: 'Sszorak',            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'twinfangs', name: 'Twin Fangs',         url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'coiledaltar', name: 'Coiled Altar',     url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'ulatek',    name: "Ula'tek",            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
        ],
        diff: 'LFR' },
      { id: 'vab_n', name: 'The Venomous Abyss: Normal',
        desc: 'Personal loot lockout. Each kill counts toward the Raid Vault row, and a Normal clear returns Hero 1/6 from the Vault.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-vault', 'tag-121'],
        bosses: [
          { id: 'nekzali',   name: "Nek'zali",           url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'sentinels', name: 'Entombed Sentinels', url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'explorers', name: 'Lost Explorers',     url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'vashnik',   name: 'Vashnik',            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'sszorak',   name: 'Sszorak',            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'twinfangs', name: 'Twin Fangs',         url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'coiledaltar', name: 'Coiled Altar',     url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'ulatek',    name: "Ula'tek",            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
        ],
        diff: 'Normal' },
      { id: 'vab_h', name: 'The Venomous Abyss: Heroic',
        desc: 'Personal loot lockout. A Heroic clear returns Myth 1/6 from the Raid Vault row, which is the cheapest Myth-track access in the game.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-vault', 'tag-121'],
        bosses: [
          { id: 'nekzali',   name: "Nek'zali",           url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'sentinels', name: 'Entombed Sentinels', url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'explorers', name: 'Lost Explorers',     url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'vashnik',   name: 'Vashnik',            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'sszorak',   name: 'Sszorak',            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'twinfangs', name: 'Twin Fangs',         url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'coiledaltar', name: 'Coiled Altar',     url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'ulatek',    name: "Ula'tek",            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
        ],
        diff: 'Heroic' },
      { id: 'vab_m', name: 'The Venomous Abyss: Mythic',
        desc: 'Weekly lockout, Hall of Fame eligible, and the only source of Myth Mistcrests outside +9 keys. The last two bosses drop at up to ilvl 344, above the normal Myth 6/6 ceiling.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-gold', 'tag-121'],
        bosses: [
          { id: 'nekzali',   name: "Nek'zali",           url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'sentinels', name: 'Entombed Sentinels', url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'explorers', name: 'Lost Explorers',     url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'vashnik',   name: 'Vashnik',            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'sszorak',   name: 'Sszorak',            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'twinfangs', name: 'Twin Fangs',         url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'coiledaltar', name: 'Coiled Altar',     url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
          { id: 'ulatek',    name: "Ula'tek",            url: 'https://www.icy-veins.com/wow/midnight-season-2-guide' },
        ],
        diff: 'Mythic' },
      { id: 'vab_curio', name: 'Loot the Slumbering Coil Curio from Ula\'tek and hand it to Kirana',
        desc: 'Ula\'tek drops a universal omni-token instead of a class tier token. Turn it in to Kirana in Silvermoon for any class set piece you choose. You can only hold one at a time, so exchange it before your next kill.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-gold', 'tag-121'] },
      { id: 'vab_tier', name: 'Assemble your Season 2 four-piece tier set',
        goal: {max:4, label:'pieces', milestones:[
          {at:2, note:'2-set bonus active'},
          {at:4, note:'4-set bonus active'},
        ]},
        desc: 'Four sources feed the same set, so you rarely need the raid for all of it. Tokens drop from five bosses, one slot each: Vashnik the Malignant for Chest, Entombed Sentinels for Gloves, The Lost Explorers for Shoulders, Sszorak for Legs and The Twin Fangs for Helm. The rest comes from the Slumbering Coil Curio, class set pieces in the Great Vault, and converting seasonal non-set gear at the Catalyst.',
        cadence: 'longterm', tags: ['tag-raid', 'tag-vault', 'tag-121'] },
      { id: 'vab_venomcursed', name: 'Take every Venomcursed piece you are offered',
        desc: 'Four Venomcursed armour pieces sit in the raid pool with unique visuals and stat profiles. They are heavily over-budget for their item level, often worth equipping over a higher-track piece from elsewhere.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-121'] },
      { id: 'vab_veryrare', name: 'Watch for Very Rare drops: Zatha\'tek, Jan\'thrazet, Maze-roa',
        desc: 'Zatha\'tek and Jan\'thrazet, the Soul Fang are Very Rare daggers from Ula\'tek; Maze-roa, Warlord\'s Fury is a Very Rare from the Coiled Altar. Weapons carry more stat weight than any other slot, so these reshuffle a BiS list on their own.',
        cadence: 'longterm', tags: ['tag-raid', 'tag-optional', 'tag-121'] },
      { id: 'vab_mount', name: 'Chase the Mythic Ula\'tek mount',
        desc: 'The Mythic-only mount drops from the final boss pool. A season-long project for organised groups.',
        cadence: 'longterm', tags: ['tag-raid', 'tag-optional', 'tag-121'] },
    ]
  },

  {
    id: 'lairs',
    icon: 'img/cat-raid.png',
    title: 'Lairs',
    url: 'https://www.icy-veins.com/wow/midnight-patch-12-1-guide',
    meta: '12.1 · Instanced world bosses replacing open-world spawns · Feeds the Raid Vault row',
    categories: ['raid', 'world', 'lairs'],
    season: 2,
    isNew: true,   // new system or instance in 12.1
    priority: 2,
    tasks: [
      { id: 'lr1', name: 'Kill Nymrissa Wavecaller in The Tidebound Grotto this week',
        desc: 'The first Lair boss, at 60.0, 66.0 on the Coiled Isle, at the bottom of a large body of water, with a summoning stone outside. Each Lair puts its boss in a private instance, so no shared-world tagging and no lag. Loot is raid-level and the kill contributes to the Great Vault Raid row. The lockout is per difficulty, so a World clear does not stop you killing her again on Normal.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-world', 'tag-vault', 'tag-121'] },
      { id: 'lr2', name: 'Pick your Lair difficulty deliberately',
        desc: 'Lairs offer World, Normal, Heroic and a flexible Mythic for 15 to 25 players. Reward tracks scale with difficulty, from Veteran gear at World tier up to Myth-track plus a Great Vault slot on Mythic. World difficulty drops you straight in and fills to 40 players around you; every other difficulty needs a premade before you can zone in, and Normal and Heroic take 10 to 30.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-121'] },
      { id: 'lr3', name: 'Farm the Tidebound Grotto trinket if it is on your BiS list',
        desc: 'The Wavecaller\'s Seastone from The Tidebound Grotto sits at or near the top of several Season 2 trinket rankings, which makes a weekly Lair clear worth it well past the point the gear stops mattering.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-gold', 'tag-121'] },
    ]
  },

  {
    id: 'ritual-sites',
    icon: 'img/cat-void.png',
    title: 'Ritual Sites',
    url: 'https://www.icy-veins.com/wow/ritual-sites-guide',
    meta: 'Carried into Season 2 · 1-5 players · Tiers 1-6 retuned to match Season 2 Delves',
    categories: ['ritual-sites'],
    season: 2,
    priority: 2,
    tasks: [
      { id: 'rs1', goal: {max:5, label:'sites'},
        name: 'Complete Ritual Sites this week (Great Vault World row)',
        desc: 'Repeatable instanced content for 1 to 5 players, and it survived the season change intact. Tier 1 through 6 Great Vault rewards were retuned in 12.1 to match Season 2 Delve rewards at the same tier.',
        cadence: 'weekly', tags: ['tag-void', 'tag-world', 'tag-vault', 'tag-121'] },
      { id: 'rs2', name: 'Bank Season 2 crests from Tier 6 Ritual Sites',
        desc: 'Ritual Sites now pay Season 2 Mistcrests equivalent to a Delve at the same tier, which makes Tier 6 a genuine alternative crest route if you prefer small-group content to solo Delves.',
        cadence: 'weekly', tags: ['tag-void', 'tag-gold', 'tag-121'] },
      { id: 'rs3', name: 'Exchange Dark Particles at Trima Dawnsetter in Silvermoon',
        desc: 'Still 150 Dark Particles per cosmetic pouch. A collector sink rather than a power one, but the particles pile up whether you spend them or not.',
        cadence: 'longterm', tags: ['tag-void', 'tag-optional'] },
    ]
  },

  {
    id: 'professions',
    icon: 'ph-fill ph-hammer',
    title: 'Professions',
    url: 'https://www.icy-veins.com/wow/midnight-patch-12-1-guide',
    meta: '12.1 · One-time Knowledge Point reset · New recipes, embellishments and fishing gear',
    categories: ['professions'],
    season: 2,
    priority: 2,
    tasks: [
      { id: 'pf_reset', name: 'Use your one-time Knowledge Point reset (Theremis, Silvermoon)',
        desc: 'Patch 12.1 grants a single Knowledge Point reset per Midnight profession. Theremis stands in the Bazaar near the crafting order table. Resetting refunds every spent point and unlearns the recipes those points bought, so plan the new spend before you talk to him. You get one shot per profession.',
        cadence: 'longterm', tags: ['tag-professions', 'tag-gold', 'tag-121'] },
      { id: 'pf1', name: 'Complete the Weekly Profession Quest (Silvermoon trainer)',
        desc: 'One per profession per week, from your trainer near the Silvermoon Forgegrounds. Still the steadiest Knowledge Point income in the game.',
        cadence: 'weekly', tags: ['tag-professions', 'tag-gold'] },
      { id: 'pf_spark', name: 'Claim your weekly Spark of Tides',
        desc: 'One Spark per week from the repeatable weekly quest in the expansion hub, and most content will hand you one at random if you have fallen behind the cap. Two Sparks make a crafted piece, four make a two-hander, so keeping up is what sets the pace of crafted gear. Add 80 Hero Mistcrests to reach 318, or 80 Myth to reach 331.',
        cadence: 'weekly', tags: ['tag-professions', 'tag-gold', 'tag-121'] },
      { id: 'pf2', goal: {max:5, label:'orders'},
        name: 'Fill Crafting Orders at the Forgegrounds',
        desc: 'Public and guild orders. Tips, crafting experience, and Patron Order completions toward the special rewards.',
        cadence: 'weekly', tags: ['tag-professions', 'tag-gold'] },
      { id: 'pf_recipes', name: 'Unlock the new 12.1 recipes (renown 5, isle fishing, or Prey rank 2)',
        desc: 'Almost every new recipe in the patch comes from one of three places: renown 5 with a 12.1 faction, fishing on the Coiled Isle, or Preyhunter\'s Journey rank 2. Pick the route that matches how you already play.',
        cadence: 'longterm', tags: ['tag-professions', 'tag-121'] },
      { id: 'pf_embellish', name: 'Re-check your embellishments against the Season 2 list',
        desc: '12.1 added new embellishments, and the best pairing shifted for most specs. Two of the same new embellishment is the answer for several of them, so verify before you commit crafted slots.',
        cadence: 'longterm', tags: ['tag-professions', 'tag-gold', 'tag-121'] },
      { id: 'pf_gather', name: 'Gather the new Coiled Isle materials and fishing nodes',
        desc: 'The isle carries its own profession nodes, fishing pools and faction-gated crafting rewards. Early-season prices on the new materials are the best they will be all season.',
        cadence: 'daily', tags: ['tag-professions', 'tag-gold', 'tag-121'] },
      { id: 'pf_rod', name: 'Buy the Coiled Huntress fishing rod at max Captain Tokka reputation',
        desc: 'Sold by Second Mate Sluggs at Tokka\'s Folly once you hit the final rank. The best rod available, and the reason to finish that track rather than stall at rank 4.',
        cadence: 'longterm', tags: ['tag-professions', 'tag-optional', 'tag-121'] },
      { id: 'pf3', name: 'Complete Darkmoon Faire profession quests (monthly)',
        desc: 'First week of each month. Plus 2 skill points and plus 3 Knowledge Points per profession, for about five minutes of work.',
        cadence: 'longterm', tags: ['tag-professions', 'tag-optional'] },
      { id: 'pf4', name: 'Renew Inscription Contracts',
        desc: 'Contracts expire weekly. Reapply each reset to keep the bonus reputation flowing on every World Quest you were completing anyway.',
        cadence: 'weekly', tags: ['tag-professions', 'tag-gold'] },
    ]
  },

  {
    id: 'world-events',
    icon: 'img/cat-world.png',
    title: 'World Events',
    url: 'https://www.icy-veins.com/wow/weekly-to-do-list',
    meta: 'Rotating world content across Quel\'Thalas, Harandar and the Coiled Isle',
    categories: ['world'],
    season: 2,
    priority: 2,
    tasks: [
      { id: 'we0a', name: 'Complete World Quests (daily)',
        desc: 'The lowest barrier gearing activity at max level, and the base layer under every reputation track in the patch. Check your map daily: they rotate constantly.',
        cadence: 'daily', tags: ['tag-world', 'tag-gold'] },
      { id: 'we0b', name: 'Kill Rare Elites as you encounter them',
        desc: 'No strict lockout on most rares. Kill them while you are passing through; higher-threat rares want a small group.',
        cadence: 'daily', tags: ['tag-world', 'tag-gold'] },
      { id: 'we_wt', name: 'Run Heroic World Tier for better crests',
        desc: 'World Boss and weekly quests pay Season 2 Adventurer Mistcrests on Normal World Tier and Season 2 Veteran Mistcrests on Heroic. If you can hold Heroic tier, the same content pays a tier better.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'we2', name: 'Abundance: complete the weekly Abundance quest',
        desc: 'Cavern events rotating every 8 hours. Rewards the Overflowing Abundant Satchel plus Amani Tribe reputation.',
        cadence: 'weekly', tags: ['tag-world'] },
      { id: 'we4', name: 'Saltheril\'s Soiree: complete your subfaction weekly',
        desc: 'Pick a subfaction (Magisters, Blood Knights, Farstriders, Shades of the Row) and run Fortify the Runestones for a pinnacle chest, Brimming Arcana and Silvermoon Court reputation. Your choices move standing with the other three.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold'] },
      { id: 'we5', name: 'Legends of the Haranir: complete Lost Legends weekly (Harandar)',
        desc: 'Choose one of seven Hara\'ti relics and play its history as a scenario. Rewards an Avid Learner\'s Supply Pack, Hara\'ti reputation, and a housing decor item keyed to the relic you picked.',
        cadence: 'weekly', tags: ['tag-world', 'tag-housing'] },
      { id: 'we6', name: 'Timewalking: complete 5 dungeons for the weekly quest',
        desc: 'When Timewalking is the active bonus event, five dungeons pays a current-tier piece. Check the Adventure Guide for the active week.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold'] },
      { id: 'we_bonus', name: 'Check the active Bonus Event and claim its weekly',
        desc: 'The weekly bonus event rotates through world quests, dungeons, PvP, pet battles and Timewalking. Each has a one-quest weekly attached that most players walk past.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold'] },
      { id: 'we_worldboss', name: 'Kill the rotating Midnight world boss',
        desc: 'Lairs did not replace the launch world bosses. Lu\'ashal, Cragpine, Thorm\'belan and Predaxas stay on a fixed rotation with exactly one spawning each week, and each drops item level 246 Warbound-until-equipped gear worth sending to an alt. Look for the world quest marked with a skull to see which one is up.',
        cadence: 'weekly', tags: ['tag-world', 'tag-121'] },
      { id: 'we_trading_post', name: 'Fill the Traveler\'s Log before the month turns over',
        desc: 'The Trading Post resets monthly and unclaimed Trader\'s Tender does not roll over. Filling the log is worth a month of Tender for activities you are doing anyway, and the month\'s stock disappears when it rotates.',
        cadence: 'longterm', tags: ['tag-world', 'tag-gold'] },
    ]
  },

  /* ═══════════════════════════════════════════════════════════
     SEASON 2  ·  PRIORITY 3  (Optional / Long term)
  ═══════════════════════════════════════════════════════════ */

  {
    id: 'pvp',
    icon: 'img/cat-pvp.png',
    title: 'PvP',
    url: 'https://www.icy-veins.com/wow/midnight-season-2-guide',
    meta: 'PvP Season 2 opened Aug 18 (NA) / Aug 19 (EU) · Conquest cap resets Tuesday',
    categories: ['pvp'],
    season: 2,
    priority: 3,
    tasks: [
      { id: 'pv1', name: 'Hit the weekly Conquest cap',
        desc: 'The cap rises every week of the season, and unspent Conquest is not the problem: unearned Conquest is. Rated BGs and Arena pay fastest.',
        cadence: 'weekly', tags: ['tag-pvp'] },
      { id: 'pv_weapons', name: 'Earn 2,500 season Conquest for two free weapon tokens',
        desc: 'The "Venomous Weapons of Conquest" achievement tracks 2,500 total Conquest across the season and pays out two Venomous Gladiator\'s Weapon Tokens. It is cumulative, so it lands whether you cap every week or not.',
        cadence: 'longterm', tags: ['tag-pvp', 'tag-gold', 'tag-121'] },
      { id: 'pv4', name: 'Queue Rated Arena 2v2',
        desc: 'The most accessible rated bracket. Conquest toward the cap, gear, and rating.',
        cadence: 'weekly', tags: ['tag-pvp'] },
      { id: 'pv5', name: 'Queue Rated Arena 3v3',
        desc: 'Higher ceiling, same Conquest. Best if you have two consistent partners.',
        cadence: 'weekly', tags: ['tag-pvp'] },
      { id: 'pv6', name: 'Queue Solo Shuffle',
        desc: 'Six-player round robin where everyone scores independently. No premade partner needed, which makes it the solo player\'s rated route.',
        cadence: 'weekly', tags: ['tag-pvp'] },
      { id: 'pv7', name: 'Queue Rated Battlegrounds',
        desc: '10v10, or 40v40 for Epic BGs. Best Conquest per hour for an organised group, plus battleground-exclusive cosmetics.',
        cadence: 'weekly', tags: ['tag-pvp'] },
      { id: 'pv_gear', name: 'Upgrade PvP gear toward the 337 Conquest ceiling',
        desc: 'Conquest gear scales to 337 PvP item level in Season 2; Honor and War Mode gear stop at 324. Inside instanced PvP that scaling beats most PvE pieces regardless of their raw item level.',
        cadence: 'weekly', tags: ['tag-pvp', 'tag-gold', 'tag-121'] },
      { id: 'pv_elite', name: 'Push rating for the Elite appearance milestones',
        desc: '1,800 completes the main Elite armour appearance, 1,950 awards Venomcoil, 2,100 unlocks the prestige cloak, and 2,300 reaches Elite. Each is a separate achievement, so partial progress still pays.',
        cadence: 'longterm', tags: ['tag-pvp', 'tag-optional', 'tag-121'] },
      { id: 'pv_mounts', name: 'Earn the Season 2 PvP mounts',
        desc: 'Vicious Lightbloom Boar comes from winning rated matches at 1,000 rating or higher. Venomous Gladiator\'s Goredrake needs 50 3v3 wins at Elite rank.',
        cadence: 'longterm', tags: ['tag-pvp', 'tag-optional', 'tag-121'] },
    ]
  },

  {
    id: 'housing',
    icon: 'img/cat-housing.png',
    title: 'Player Housing',
    url: 'https://www.icy-veins.com/wow/player-housing-guide',
    meta: '12.1 · Blueprints, pet placement, Level 12 upgrades, four new Neighborhood Endeavors',
    categories: ['housing'],
    season: 2,
    priority: 3,
    tasks: [
      { id: 'h1', name: 'Complete the Housing weekly from Vaeli (outside the Silvermoon bank)',
        desc: 'Every reset. Decor rewards and housing progression, and it takes minutes.',
        cadence: 'weekly', tags: ['tag-housing', 'tag-gold'] },
      { id: 'h_endeavors', name: 'Work the four new Neighborhood Endeavors',
        desc: '12.1 added four Endeavors alongside the new housing levels. Neighborhood-scoped, so coordinate with neighbours rather than grinding them alone.',
        cadence: 'weekly', tags: ['tag-housing', 'tag-121'] },
      { id: 'h_blueprints', name: 'Save your build as a Blueprint',
        desc: 'The Blueprints system saves and shares interiors, exteriors, whole builds or individual rooms. Codes work cross-region (China excluded) and can be pasted in chat. Importing shows every required room, decor item and the total decor budget before you commit.',
        cadence: 'longterm', tags: ['tag-housing', 'tag-121'] },
      { id: 'h_level12', name: 'Push your house to the new Level 12 cap',
        desc: '12.1 raised the housing level ceiling and added new decoration categories and customisation options alongside it.',
        cadence: 'longterm', tags: ['tag-housing', 'tag-121'] },
      { id: 'h_pets', name: 'Place your pets in your house',
        desc: 'Pet placement arrived with 12.1. Purely cosmetic, and one of the most-requested features in the housing system.',
        cadence: 'longterm', tags: ['tag-housing', 'tag-optional', 'tag-121'] },
      { id: 'h_decor', name: 'Collect Coiled Isle themed decor',
        desc: '12.1 seeded isle-themed decor across renown, Delver\'s Journey, Captain Tokka reputation and Vaults of Atal\'Utek. It comes from content you are already running.',
        cadence: 'longterm', tags: ['tag-housing', 'tag-optional', 'tag-121'] },
    ]
  },

  {
    id: 'longterm',
    icon: 'img/cat-optional.png',
    title: 'Long Term Goals',
    url: 'https://www.icy-veins.com/wow/midnight-patch-12-1-guide',
    meta: 'Season-long and account-long projects: campaign, renown, achievement metas, mounts',
    categories: ['optional', 'longterm'],
    season: 2,
    priority: 3,
    tasks: [
      { id: 'lt_campaign', name: 'Finish the Curse of Ula\'tek campaign',
        desc: 'Five storylines: the 17-quest Legacy of the Amani lead-in, then An Island of Fangs, Ghosts of the Past, Original Sin and The Battle for Atal\'Utek, 41 quests between them. World quests, the Vaults of Atal\'Utek, the Altar of Corrosion tree, the Zul\'jarra\'s Forces renown track and the reward vendor all sit behind campaign steps, so this is the first thing to clear.',
        cadence: 'longterm', tags: ['tag-world', 'tag-121'] },
      { id: 'lt_unlock', name: 'Unlock the Coiled Isle (first two campaign chapters)',
        desc: '"What Lies Beyond the Fog" sends you to the island proper, and the unlock needs nothing beyond the first two chapters. The flight path then unlocks for every character in your warband.',
        cadence: 'longterm', tags: ['tag-world', 'tag-121'] },
      { id: 'lt_zuljarra', goal: {max:20, label:'ranks'},
        name: 'Push Zul\'jarra\'s Forces to Renown 20',
        desc: 'Twenty ranks at 2,500 reputation each, earned account-wide. Rewards mounts, pets, housing decor, gear upgrades and the 12.1 profession recipes at rank 5. World quests plus a contract plus the Purging the Vaults weekly is the efficient loop.',
        cadence: 'longterm', tags: ['tag-world', 'tag-gold', 'tag-121'] },
      { id: 'lt_tokka', name: 'Reach Bloodsworn Crew with Captain Tokka (8,400 rep)',
        desc: 'A fishing-flavoured friendship track. Sources: the "Venom Fishing: Maximum Potency" questline, daily quests from Tokka\'s crew at Tokka\'s Folly, Cursed Fishing on the isle, and the weekly Open Sea Fishing world quest at 500 rep. Pays the Sea-Dwelling Isle Serpent mount, housing decor and the best fishing rod in the game.',
        cadence: 'longterm', tags: ['tag-world', 'tag-optional', 'tag-121'] },
      { id: 'lt_serpent', name: 'Earn the Sea-Dwelling Isle Serpent mount',
        desc: 'Guaranteed if you commit to the Filament grind on the Captain Tokka track. Not random, just long.',
        cadence: 'longterm', tags: ['tag-optional', 'tag-121'] },
      { id: 'lt_rares', goal: {max:12, label:'rares'},
        name: 'Kill all 12 Coiled Isle rares for "Coiled to Strike"',
        desc: 'Twelve rares scattered across the isle. Most are soloable, and they overlap with your daily world quest route.',
        cadence: 'longterm', tags: ['tag-world', 'tag-optional', 'tag-121'] },
      { id: 'lt_treasures', goal: {max:22, label:'treasures'},
        name: 'Find all 22 treasures for "Treasures of the Coiled Isle"',
        desc: 'Twenty-two treasures on the isle. Take the Altar of Corrosion exploration nodes first: they make the sweep considerably faster.',
        cadence: 'longterm', tags: ['tag-world', 'tag-optional', 'tag-121'] },
      { id: 'lt_hof', name: 'Complete the Season 2 keystone and raid achievement metas',
        desc: 'Season-long Mythic+ and Venomous Abyss achievement chains, including the Hall of Fame race for Mythic raiders. Track them in the Adventure Guide rather than guessing.',
        cadence: 'longterm', tags: ['tag-optional', 'tag-raid', 'tag-mythic', 'tag-121'] },
      { id: 'lt_alts', name: 'Bank the account-wide unlocks for your alts',
        desc: 'Zul\'jarra\'s Forces renown, the Coiled Isle flight path and the warband-wide unlocks carry across your whole account. Doing them once on your main is worth more than doing them badly on three characters.',
        cadence: 'longterm', tags: ['tag-optional', 'tag-121'] },
    ]
  },

  /* ═══════════════════════════════════════════════════════════
     SEASON 1  ·  RETIRED CONTENT
     Hidden by default. Use the "Season 1" toggle in the utility
     bar to bring these back if you are still finishing them.
  ═══════════════════════════════════════════════════════════ */

  {
    id: 'voidforge',
    icon: 'img/cat-void.png',
    title: 'Voidforge',
    url: 'https://www.icy-veins.com/wow/turboboost-and-bonus-rolls-in-midnight-season-1-the-voidforge',
    meta: 'Season 1 · 12.0.5 · Retired with Season 2 · Kept for players still finishing the chain',
    categories: ['voidforge', 'currency'],
    season: 1,
    priority: 3,
    tasks: [
      { id: 'vf1', name: 'Check Voidforge quest status: visit Decimus at 51.2, 68.4 in The Voidstorm',
        desc: 'Requires campaign completion up to "Domus Penumbra." If behind, Decimus offers all 6 catch-up weeks at once.',
        cadence: 'weekly', tags: ['tag-void', 'tag-s1'] },
      { id: 'vf2', name: 'Complete this week\'s Voidforge quest',
        desc: 'Rewards 2 Nebulous Voidcores per week, with the weekly cap rising by 2 each week of Season 1.',
        cadence: 'weekly', tags: ['tag-void', 'tag-s1'] },
      { id: 'vf3', name: 'Use Nebulous Voidcores as bonus rolls on weak gear slots',
        desc: 'Available from Mythic+, Bountiful Delves and Nightmare Prey Hunts.',
        cadence: 'weekly', tags: ['tag-void', 'tag-gold', 'tag-s1'] },
      { id: 'vf4', name: 'Use Ascendant Voidcores on trinkets or weapons',
        desc: 'Drops from Season 1 endgame content. Upgrades max item level trinkets and weapons beyond the normal caps.',
        cadence: 'weekly', tags: ['tag-void', 'tag-gold', 'tag-s1'] },
    ]
  },

  {
    id: 'omnium-folio',
    icon: 'img/cat-void.png',
    title: 'Omnium Folio',
    url: 'https://www.wowhead.com/guide/midnight/omnium-folio-unlock-buffs-rewards',
    meta: 'Season 1 · 12.0.7 · 5-week gated power system · Grand Master Rommath, Silvermoon City',
    categories: ['currency', 'voidforge'],
    season: 1,
    priority: 3,
    tasks: [
      { id: 'of1', name: 'Complete this week\'s "Seeking Knowledge" Omnium Folio quest',
        desc: 'Five-week chain from Grand Master Rommath. Each week unlocks a new rune row. One row per reset, no skipping.',
        cadence: 'weekly', tags: ['tag-void', 'tag-s1'] },
      { id: 'of2', name: 'Swap Omnium Folio runes to match your content for the week',
        desc: 'Unlocked runes swap freely out of combat. All unlocked rows stay available permanently.',
        cadence: 'weekly', tags: ['tag-void', 'tag-s1'] },
    ]
  },

  {
    id: 'bazaar',
    icon: 'img/cat-bazaar.png',
    title: 'Bazaar Weekly Quests',
    url: 'https://www.icy-veins.com/wow/weekly-to-do-list',
    meta: 'Season 1 · Silvermoon Bazaar weeklies from the 12.0.x cycle',
    categories: ['world', 'currency'],
    season: 1,
    priority: 3,
    tasks: [
      { id: 'bq1', name: 'Complete quest from Ranger Captain Lilatha (2nd floor, The Bazaar)',
        desc: 'Rewards a Ranger\'s Cache containing Field Accolades, Relic Coffer Key shards, upgrade materials and gold.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-s1'] },
      { id: 'bq2', name: 'Complete quest from Kul\'amara the Fierce (2nd floor, The Bazaar)',
        desc: 'A second free Ranger\'s Cache, and it runs naturally alongside Void Assault activity.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-s1'] },
      { id: 'bq3', name: 'Complete the Weekly World Event quest from Lady Liadrin',
        desc: 'Rewards a Spark used for crafted gear progression.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-s1'] },
      { id: 'bq5', name: 'Complete Halduron Brightwing\'s Renown Dungeon Quest',
        desc: 'A rotating assigned dungeon worth 1,500 Renown with your chosen faction. Check Halduron at The Bazaar for the week\'s assignment.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-s1'] },
    ]
  },

  {
    id: 'void-assaults',
    icon: 'img/cat-void.png',
    title: 'Void Assaults',
    url: 'https://www.icy-veins.com/wow/void-assaults-hub',
    meta: 'Season 1 · Rotated weekly between Eversong Woods and Zul\'Aman',
    categories: ['void-assaults'],
    season: 1,
    priority: 3,
    tasks: [
      { id: 'va1', name: 'Check which zone has the active Void Assault this week',
        desc: 'Void Strikes rotated weekly between Eversong Woods and Zul\'Aman.',
        cadence: 'weekly', tags: ['tag-void', 'tag-s1'] },
      { id: 'va2', goal: {max:5, label:'strikes'}, name: 'Complete Void Strikes in the active zone',
        desc: 'Small targeted attacks, soloable. Clearing one spawns another nearby, and each awards Field Accolades.',
        cadence: 'daily', tags: ['tag-void', 'tag-world', 'tag-s1'] },
      { id: 'va3', name: 'Participate in the Void Incursion (once the bar reaches 100%)',
        desc: 'The larger assault, triggered by clearing enough Void Strikes. Best rewards in the system.',
        cadence: 'weekly', tags: ['tag-void', 'tag-world', 'tag-s1'] },
      { id: 'va4', name: 'Complete the Void Assault weekly quest',
        desc: 'Rewards a Ranger\'s Cache pinnacle cache.',
        cadence: 'weekly', tags: ['tag-void', 'tag-gold', 'tag-s1'] },
    ]
  },

  {
    id: 'showdown-zones',
    icon: 'img/cat-void.png',
    title: 'Invasion Zones: Val & Naigtal',
    url: 'https://www.icy-veins.com/wow/news/two-new-world-bosses-and-locations-12-0-7s-val-and-naigtal-rewards-quests-and-more/',
    meta: 'Season 1 · 12.0.7 · Superseded by the 12.1 Lairs system',
    categories: ['world', 'currency'],
    season: 1,
    priority: 3,
    tasks: [
      { id: 'sz1', name: 'Check the active Invasion Zone this week (Val or Naigtal)',
        desc: 'Val is a frozen Legion-era world under Imperator Pertinax; Naigtal is fungal and arcane-infested under Nexus-Captain Leth\'ir. Access via the unstable portal in Voidstorm, one zone active per week.',
        cadence: 'weekly', tags: ['tag-world', 'tag-s1'] },
      { id: 'sz2', name: 'Complete World Quests in the active Invasion Zone',
        desc: '10 Field Accolades per quest on Normal World Tier, 30 on Heroic. Also rewards Voidlight Marl.',
        cadence: 'daily', tags: ['tag-world', 'tag-gold', 'tag-s1'] },
      { id: 'sz3', name: 'Complete Bonus Objectives in the active Invasion Zone',
        desc: '10 Field Accolades each on Normal, 16 on Heroic. Quick alongside the world quests.',
        cadence: 'daily', tags: ['tag-world', 'tag-gold', 'tag-s1'] },
      { id: 'sz4', name: 'Kill the weekly World Boss (Imperator Pertinax or Nexus-Captain Leth\'ir)',
        desc: 'One kill per character per week for Hero-track gear. All drops are Bind on Equip and tradeable. The kill also unlocks Heroic World Tier for both zones at once.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-s1'] },
      { id: 'sz5', name: 'Complete the "Showdown" weekly for a Riftstalker\'s Cache',
        desc: 'The wrapper quest for the active Invasion Zone.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-s1'] },
      { id: 'sz6', name: '[Heroic World Tier] Kill the World Boss for a Void Commander\'s Emblem',
        desc: 'One per character per week. Four over four weeks completes "Knocking Off the Top" for a Myth-track cloak, belt or bracer of your choice.',
        cadence: 'weekly', tags: ['tag-world', 'tag-gold', 'tag-s1'] },
    ]
  },

  {
    id: 'raid-s1',
    icon: 'img/cat-raid.png',
    title: 'Raids (Season 1)',
    url: 'https://www.icy-veins.com/wow/midnight-season-1-raid-guide',
    meta: 'Season 1 · The Dreamrift, The Voidspire, March on Quel\'Danas, Sporefall',
    categories: ['raid'],
    season: 1,
    priority: 3,
    tasks: [
      { id: 'rd_n', name: 'The Dreamrift: Normal',
        desc: 'Season 1 raid. Personal loot lockout.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [{ id: 'chimaerus', name: 'Chimaerus', url: 'https://www.icy-veins.com/wow/chimaerus-raid-guide' }],
        diff: 'Normal' },
      { id: 'rd_h', name: 'The Dreamrift: Heroic',
        desc: 'Season 1 raid. Higher item level rewards.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [{ id: 'chimaerus', name: 'Chimaerus', url: 'https://www.icy-veins.com/wow/chimaerus-raid-guide' }],
        diff: 'Heroic' },
      { id: 'rd_m', name: 'The Dreamrift: Mythic',
        desc: 'Season 1 raid. Weekly lockout.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [{ id: 'chimaerus', name: 'Chimaerus', url: 'https://www.icy-veins.com/wow/chimaerus-raid-guide' }],
        diff: 'Mythic' },

      { id: 'vs_n', name: 'The Voidspire: Normal',
        desc: 'Season 1 raid. Personal loot lockout.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [
          { id: 'averzian',  name: 'Imperator Averzian',    url: 'https://www.icy-veins.com/wow/imperator-averzian-raid-guide' },
          { id: 'vorasius',  name: 'Vorasius',              url: 'https://www.icy-veins.com/wow/vorasius-raid-guide' },
          { id: 'salhadaar', name: 'Fallen-King Salhadaar', url: 'https://www.icy-veins.com/wow/fallen-king-salhadaar-raid-guide' },
          { id: 'vaelgor',   name: 'Vaelgor & Ezzorak',     url: 'https://www.icy-veins.com/wow/vaelgor-and-ezzorak-raid-guide' },
          { id: 'vanguard',  name: 'Lightblinded Vanguard', url: 'https://www.icy-veins.com/wow/lightblinded-vanguard-raid-guide' },
          { id: 'cosmos',    name: 'Crown of the Cosmos',   url: 'https://www.icy-veins.com/wow/crown-of-the-cosmos-raid-guide' },
        ],
        diff: 'Normal' },
      { id: 'vs_h', name: 'The Voidspire: Heroic',
        desc: 'Season 1 raid. Tier tokens available.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [
          { id: 'averzian',  name: 'Imperator Averzian',    url: 'https://www.icy-veins.com/wow/imperator-averzian-raid-guide' },
          { id: 'vorasius',  name: 'Vorasius',              url: 'https://www.icy-veins.com/wow/vorasius-raid-guide' },
          { id: 'salhadaar', name: 'Fallen-King Salhadaar', url: 'https://www.icy-veins.com/wow/fallen-king-salhadaar-raid-guide' },
          { id: 'vaelgor',   name: 'Vaelgor & Ezzorak',     url: 'https://www.icy-veins.com/wow/vaelgor-and-ezzorak-raid-guide' },
          { id: 'vanguard',  name: 'Lightblinded Vanguard', url: 'https://www.icy-veins.com/wow/lightblinded-vanguard-raid-guide' },
          { id: 'cosmos',    name: 'Crown of the Cosmos',   url: 'https://www.icy-veins.com/wow/crown-of-the-cosmos-raid-guide' },
        ],
        diff: 'Heroic' },
      { id: 'vs_m', name: 'The Voidspire: Mythic',
        desc: 'Season 1 raid. Weekly lockout.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [
          { id: 'averzian',  name: 'Imperator Averzian',    url: 'https://www.icy-veins.com/wow/imperator-averzian-raid-guide' },
          { id: 'vorasius',  name: 'Vorasius',              url: 'https://www.icy-veins.com/wow/vorasius-raid-guide' },
          { id: 'salhadaar', name: 'Fallen-King Salhadaar', url: 'https://www.icy-veins.com/wow/fallen-king-salhadaar-raid-guide' },
          { id: 'vaelgor',   name: 'Vaelgor & Ezzorak',     url: 'https://www.icy-veins.com/wow/vaelgor-and-ezzorak-raid-guide' },
          { id: 'vanguard',  name: 'Lightblinded Vanguard', url: 'https://www.icy-veins.com/wow/lightblinded-vanguard-raid-guide' },
          { id: 'cosmos',    name: 'Crown of the Cosmos',   url: 'https://www.icy-veins.com/wow/crown-of-the-cosmos-raid-guide' },
        ],
        diff: 'Mythic' },

      { id: 'mq_n', name: 'March on Quel\'Danas: Normal',
        desc: 'Season 1 raid. The Sunwell storyline conclusion.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [
          { id: 'beloren',  name: 'Belo\'ren, Child of A\'lar', url: 'https://www.icy-veins.com/wow/beloren-raid-guide' },
          { id: 'midnight', name: 'Midnight Falls',             url: 'https://www.icy-veins.com/wow/midnight-falls-raid-guide' },
        ],
        diff: 'Normal' },
      { id: 'mq_h', name: 'March on Quel\'Danas: Heroic',
        desc: 'Season 1 raid. Higher item level rewards.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [
          { id: 'beloren',  name: 'Belo\'ren, Child of A\'lar', url: 'https://www.icy-veins.com/wow/beloren-raid-guide' },
          { id: 'midnight', name: 'Midnight Falls',             url: 'https://www.icy-veins.com/wow/midnight-falls-raid-guide' },
        ],
        diff: 'Heroic' },
      { id: 'mq_m', name: 'March on Quel\'Danas: Mythic',
        desc: 'Season 1 raid. Weekly lockout, Hall of Fame eligible.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [
          { id: 'beloren',  name: 'Belo\'ren, Child of A\'lar', url: 'https://www.icy-veins.com/wow/beloren-raid-guide' },
          { id: 'midnight', name: 'Midnight Falls',             url: 'https://www.icy-veins.com/wow/midnight-falls-raid-guide' },
        ],
        diff: 'Mythic' },

      { id: 'sf_h', name: 'Sporefall: Heroic',
        desc: 'Season 1 · 12.0.7 catch-up raid. Sporefused gear dropped fully upgraded with no Voidcore cost.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [{ id: 'rotmire', name: 'Rotmire', url: 'https://www.wowhead.com/guide/midnight/raids/sporefall-overview-location-rewards-boss' }],
        diff: 'Heroic' },
      { id: 'sf_m', name: 'Sporefall: Mythic',
        desc: 'Season 1 · Mythic Flex for 15 to 25 players.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-s1'],
        bosses: [{ id: 'rotmire', name: 'Rotmire', url: 'https://www.wowhead.com/guide/midnight/raids/sporefall-overview-location-rewards-boss' }],
        diff: 'Mythic' },
      { id: 'sf_snack', name: 'Collect Delicious Sporesnack from Rotmire (any difficulty)',
        desc: 'One per account per week. Four combine into the Luminous Sporeglider mount, so this is still worth running if you never finished it.',
        cadence: 'weekly', tags: ['tag-raid', 'tag-optional', 'tag-s1'] },
    ]
  },

  {
    id: 'optional',
    icon: 'img/cat-optional.png',
    title: 'Optional & Collector Content (Season 1)',
    meta: 'Season 1 · Permanent side content from the 12.0.x cycle, no current power progression',
    categories: ['optional'],
    season: 1,
    priority: 3,
    tasks: [
      { id: 'op1', name: 'Abyss Anglers: visit Depthdiver Jeju at 68.2, 20.0 off the Zul\'Aman coast',
        desc: 'Deep-sea spearfishing. Earns Angler Pearls for armour sets, housing decor, pets and a floppy fish mace. Upgrade your diving gear to reach the deeper zones.',
        cadence: 'longterm', tags: ['tag-optional', 'tag-housing', 'tag-s1'] },
      { id: 'op2', goal: {max:8, label:'shards'}, name: 'Collect up to 8 Shards of Dundun for Abundance runs',
        desc: 'Weekly cap of 8 from outdoor activities, gathering and Patron Crafting Orders. Empowers Abundance events for bonus Unalloyed Abundance.',
        cadence: 'weekly', tags: ['tag-optional', 'tag-world', 'tag-s1'] },
    ]
  },

];

/* ── BEGINNER PRESET STAGES (Season 2) ── */
const BEGINNER_STAGES = [
  {
    id: 'fresh',
    label: 'Fresh max level: just arrived in Season 2',
    sublabel: 'Adventurer and Veteran gear is your target',
    color: 'var(--success-bright)',
    tasks: [
      'lt_unlock','lt_campaign',       // Unlock the isle: everything else is gated behind it
      'ci1','ci2','ci3',               // Coiled Isle dailies
      'we0a','we0b','we_worldboss',    // World quests, rares, weekly world boss
      'we2','we4',                     // Abundance + Soiree
      'pr_quest','pr_norm',            // Start Prey, run Normal hunts
      'd_bountiful','d3',              // Bountiful Delves + weekly cache
      'v1','v4',                       // Open the Vault, fill the World row
      'mc1',                           // Spend low-tier Mistcrests
    ]
  },
  {
    id: 'gearing',
    label: 'Early gearing: building toward Champion',
    sublabel: 'Solo systems doing the heavy lifting',
    color: 'var(--light-gold)',
    tasks: [
      'lt_campaign','ci8',             // Finish campaign, open the Altar of Corrosion
      'ci1','ci2','ci3','ci4','ci5','ci6','ci9',
      'we0a','we0b','we_wt','we2','we4','we5','we_worldboss',
      'pr_norm','pr_hard','pr_souls',
      'rs1',                           // Ritual Sites
      'd1','d_bountiful','d3','d_souls',
      'lr1','lr2',                     // Lairs: raid-level loot without a raid group
      'pf1','pf2','pf_spark','pf_reset','pf_gather',
      'v1','v2','v4','v5',
      'mc1','mc2','mc4','mc5',
      'lt_zuljarra',
    ]
  },
  {
    id: 'progressing',
    label: 'Progressing: Champion into Hero',
    sublabel: 'Mythic+ and the raid open up',
    color: 'var(--void-glow)',
    tasks: [
      'ci1','ci2','ci3','ci4','ci5','ci6','ci7','ci9',
      'we0a','we0b','we_wt','we2','we4','we5','we6','we_bonus','we_worldboss',
      'pr_norm','pr_hard','pr_nm','pr_souls','pr_afflicted','pr_ralkala',
      'rs1','rs2',
      'd1','d_bountiful','d3','d_souls','d_journey',
      'm1','m2','m4','m6',
      'lr1','lr2','lr3',
      'vab_n','vab_curio','vab_venomcursed','vab_tier',
      'pf1','pf2','pf_spark','pf_recipes','pf_embellish','pf4',
      'v1','v2','v3','v4','v5','v6','v7',
      'mc1','mc2','mc4','mc5','mc7',
      'lt_zuljarra','lt_tokka',
    ]
  },
  {
    id: 'endgame',
    label: 'Endgame: Hero into Myth',
    sublabel: 'Squeezing every weekly system for Myth track',
    color: '#c0b8d8',
    tasks: [
      'ci1','ci2','ci3','ci4','ci5','ci6','ci7','ci9',
      'we0a','we_wt','we2','we4','we5','we6','we_bonus',
      'pr_hard','pr_nm','pr_souls','pr_afflicted','pr_ralkala',
      'rs1','rs2',
      'd1','d_bountiful','d_souls','d_nemesis','d_journey',
      'm1','m4','m5','m6',
      'lr1','lr2','lr3',
      'vab_h','vab_m','vab_curio','vab_venomcursed','vab_veryrare','vab_tier',
      'pf1','pf2','pf_spark','pf_embellish','pf4',
      'pv1','pv4','pv5','pv6','pv7','pv_gear',
      'v1','v2','v3','v4','v5','v6','v7',
      'mc1','mc2','mc3','mc4','mc5','mc6','mc7','mc_scion',
      'lt_zuljarra','lt_hof',
    ]
  },
];

function openBeginnerPreset() {
  const stagesEl = document.getElementById('beginner-stages');
  stagesEl.innerHTML = BEGINNER_STAGES.map(s => `
    <div class="beginner-stage-card" onclick="applyBeginnerPreset('${s.id}')">
      <div class="beginner-stage-dot" style="background:${s.color};"></div>
      <div class="beginner-stage-text">
        <div class="beginner-stage-label">${s.label}</div>
        <div class="beginner-stage-sub">${s.sublabel}</div>
      </div>
      <span class="beginner-stage-arrow"><i class="ph ph-arrow-right"></i></span>
    </div>`).join('');
  document.getElementById('modal-beginner').style.display = 'flex';
}

function closeBeginnerModal() {
  document.getElementById('modal-beginner').style.display = 'none';
}

function applyBeginnerPreset(stageId) {
  const stage = BEGINNER_STAGES.find(s => s.id === stageId);
  if (!stage) return;
  saveYourList(stage.tasks);
  saveYourListOrder(stage.tasks);
  closeBeginnerModal();
  doneEditingYourList();
}
