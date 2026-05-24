/* -----------------------------------------------------------
   TASK DATA  —  Patches 12.0.5–12.0.6 Lingering Shadows  (May 2026)
   12.0.7 content (Showdown Zones) arrives June 16.
   Sources: Icy Veins weekly to-do list, Icy Veins world
   events guide, Mythic-Store weekly checklist.
   No raid content included by design.

   To update for a new patch:
     - Edit task name/desc fields below
     - Add new sections following the same object shape
     - Remove or set priority:3 for outdated content
     - tag-new marks 12.0.5-introduced content
     - BEGINNER_STAGES task IDs must match task ids in SECTIONS
----------------------------------------------------------- */
const SECTIONS = [

  // ── PRIORITY 1  (Do First) ─────────────────────────────

  {
    id: 'voidforge',
    icon: '', iconClass: 'icon-void',
    title: 'Voidforge',
    url: 'https://www.icy-veins.com/wow/turboboost-and-bonus-rolls-in-midnight-season-1-the-voidforge',
    meta: '12.0.5 · Top priority if not yet complete · Powers endgame bonus rolls',
    categories: ['voidforge', 'currency'],
    priority: 1,
    tasks: [
      { id: 'vf1', name: 'Check Voidforge quest status: visit Decimus at 51.2, 68.4 in The Voidstorm',
        desc: 'Requires campaign completion up to "Domus Penumbra." If behind, Decimus offers all 6 catch-up weeks at once.',
        tags: ['tag-void', 'tag-new'] },
      { id: 'vf2', name: 'Complete this week\'s Voidforge quest',
        desc: 'Completed Voidforge rewards 2 Nebulous Voidcores per week. Weekly cap increases by 2 each week for the rest of the season.',
        tags: ['tag-void', 'tag-new'] },
      { id: 'vf3', name: 'Use Nebulous Voidcores as bonus rolls on weak gear slots',
        desc: 'Available from Mythic+, Bountiful Delves, and Nightmare Prey Hunts. Check your class guide on Icy Veins for optimal slot priorities.',
        tags: ['tag-void', 'tag-gold', 'tag-new'] },
      { id: 'vf4', name: 'Use Ascendant Voidcores on trinkets or weapons (if in endgame)',
        desc: 'Drops from Season 1 endgame content. Upgrades max ilvl trinkets and weapons beyond normal caps.',
        tags: ['tag-void', 'tag-gold', 'tag-new'] },
    ]
  },

  {
    id: 'prey',
    icon: '', iconClass: 'icon-prey',
    title: 'Prey System',
    url: 'https://www.icy-veins.com/wow/prey-system-guide',
    meta: 'Open-world hunting · Great Vault World row · Enable via Astalor Bloodsworn in Murder Row, Silvermoon',
    categories: ['prey'],
    priority: 1,
    tasks: [
      { id: 'pr_norm', goal: {max:2, label:'hunts', milestones:[
          {at:1, note:'1 / 2 Normal hunts done'},
          {at:2, note:'✓ Both Normal hunts complete'},
        ]},
        name: 'Normal Prey Hunts (2 per week)',
        desc: 'Rewards Adventurer-level gear (ilvl 220–237). Twice-weekly lockout. Enable via Astalor Bloodsworn in Murder Row, Silvermoon.',
        tags: ['tag-world'] },
      { id: 'pr_hard', goal: {max:2, label:'hunts', milestones:[
          {at:1, note:'1 / 2 Hard hunts done'},
          {at:2, note:'✓ Both Hard hunts complete'},
        ]},
        name: 'Hard Prey Hunts (2 per week)',
        desc: 'Rewards Veteran-level gear (ilvl 233–250). Twice-weekly lockout. Harder targets may require a partner.',
        tags: ['tag-world'] },
      { id: 'pr_nm', goal: {max:3, label:'hunts', milestones:[
          {at:1, note:'1 / 3 Nightmare hunts done'},
          {at:2, note:'2 / 3 Nightmare hunts done'},
          {at:3, note:'✓ Weekly Prey quest complete'},
        ]},
        name: 'Nightmare Prey Hunts (weekly quest: 3 kills)',
        desc: 'Rewards Champion-level gear (ilvl 246–263). Also drops Nebulous Voidcores for bonus rolls. Core Icy Veins weekly priority.',
        tags: ['tag-world', 'tag-void'] },
      { id: 'pr3', name: 'Check Prey target list for transmog / mount / housing drops',
        desc: 'Specific Prey targets drop unique achievements, transmog, mounts, and housing decor.',
        tags: ['tag-world', 'tag-optional'] },
    ]
  },

  {
    id: 'delves',
    icon: '', iconClass: 'icon-delve',
    title: 'Delves',
    url: 'https://www.icy-veins.com/wow/delves-guide',
    meta: 'Solo/2-player instanced content · Contributes to Great Vault World row',
    categories: ['delve'],
    priority: 1,
    tasks: [
      { id: 'd1', name: 'Use Trovehunter\'s Bounty in highest tier Delve possible',
        desc: 'Trovehunter\'s Bounty reveals the Hidden Trove inside a Delve. Always use it at your highest manageable tier: Champion gear at T1–T7, Hero gear at T8+. One use per week.',
        tags: ['tag-delve', 'tag-gold'] },
      { id: 'd_bountiful', goal: {max:4, label:'delves', milestones:[
          {at:1, note:'1 / 4 Bountiful Delves done'},
          {at:2, note:'2 / 4 Bountiful Delves done'},
          {at:3, note:'3 / 4 Bountiful Delves done'},
          {at:4, note:'✓ Weekly Bountiful Delve goal complete'},
        ]},
        name: 'Complete Bountiful Delves (up to 4 per week)',
        desc: 'Bountiful Delves reward end-of-run caches and are eligible Voidforge bonus roll sources. Set your current max tier below — gear quality scales with tier.',
        tags: ['tag-delve', 'tag-void'],
        tierSelector: true },
      { id: 'd3', name: 'Collect Delve weekly cache reward',
        desc: 'Check for any active weekly Delve quest associated with your current tier.',
        tags: ['tag-delve', 'tag-gold'] },
    ]
  },

  {
    id: 'currency',
    icon: '', iconClass: 'icon-currency',
    title: 'Upgrades',
    url: 'https://www.icy-veins.com/wow/midnight-pve-gearing-guide',
    meta: 'Weekly caps: spend before reset or lose value',
    categories: ['currency'],
    priority: 1,
    tasks: [
      { id: 'cu1', name: 'Spend all Crests of Champion quality and below on gear upgrades',
        desc: 'Lower-tier Crests lose value if stockpiled. Prioritize weakest item level slots each week.',
        tags: ['tag-gold'] },
      { id: 'cu2', name: 'Use weekly Catalyst charge (if available)',
        desc: 'Catalyst converts eligible gear into tier set pieces. 1 charge accrues per week.',
        tags: ['tag-gold'] },
      { id: 'cu3', name: 'Collect and spend Brimming Arcana (from Soiree / subfaction quartermasters)',
        desc: 'Popular Blood Elf currency. Subfaction QMs and Silvermoon Court QM sell cosmetics, housing decor, and crafting recipes.',
        tags: ['tag-gold'] },
      { id: 'cu4', name: 'Open Relic Coffers with accumulated Key shards (from Bazaar caches)',
        desc: 'Relic Coffer Key shards drop from Ranger\'s Cache rewards. Combine to open Coffers for additional loot.',
        tags: ['tag-gold'] },
      { id: 'cu5', name: 'Craft or empower gear with Dawncrest (if holding 80+)',
        desc: 'Dawncrest comes in three tiers — Adventurer (ilvl 220–237), Veteran (ilvl 233–250), and Hero (ilvl 259–276). Spend 80 of the appropriate Dawncrest at a crafter or workbench to empower a crafted piece to that tier. Don\'t sit on 80+ — it\'s dead value.',
        tags: ['tag-gold'] },
    ]
  },

  {
    id: 'vault',
    icon: '', iconClass: 'icon-vault',
    title: 'Great Vault',
    url: 'https://www.icy-veins.com/wow/great-vault-guide',
    meta: 'Opens Tuesday reset. Claim before anything else.',
    categories: ['currency'],
    priority: 1,
    tasks: [
      { id: 'v1', name: 'Open your Great Vault',
        desc: 'First thing every Tuesday. Choose from up to 9 unlocked reward slots across World, Dungeon, and Raid rows.',
        tags: ['tag-vault'] },
      { id: 'v2', name: 'Plan your Vault rows intentionally this week',
        desc: 'World row: Delves + Prey + Ritual Sites. Dungeon row: Mythic+ runs. Build rows with a goal — don\'t fill randomly.',
        tags: ['tag-vault'] },
    ]
  },

  // ── PRIORITY 2  (Important) ────────────────────────────

  {
    id: 'mythicplus',
    icon: '', iconClass: 'icon-mythic',
    title: 'Mythic+ Dungeons',
    url: 'https://www.icy-veins.com/wow/midnight-mythic-season-1-guide',
    meta: 'No lockout. Farm freely. Vault slots unlock at 1 / 4 / 8 runs.',
    categories: ['mythic'],
    priority: 2,
    tasks: [
      { id: 'm1', goal: {max:8, label:'runs', milestones:[
          {at:1, note:'🔓 Vault slot 1 unlocked'},
          {at:4, note:'🔓🔓 Vault slots 1–2 unlocked'},
          {at:8, note:'🔓🔓🔓 All 3 Vault slots unlocked'},
        ]},
        name: 'Complete Mythic+ keys for Great Vault',
        desc: 'Run 1 for slot 1, 4 for slot 2, 8 for all 3 slots.',
        tags: ['tag-mythic', 'tag-vault'] },
      { id: 'm4', goal: {max: 0, label: '10+ keys'},
        name: 'Farm the highest keys you can, up to +10s',
        desc: 'Icy Veins weekly recommendation for optimal Crest income this week.',
        tags: ['tag-mythic', 'tag-gold'] },
      { id: 'm5', name: 'Spend all Crests of Champion quality and below on upgrades',
        desc: 'Lower-tier Crests should be spent each week. Upgrade your weakest gear slots first.',
        tags: ['tag-mythic', 'tag-gold'] },
    ]
  },

  {
    id: 'ritual-sites',
    icon: '🔮', iconClass: 'icon-void',
    title: 'Ritual Sites',
    url: 'https://www.icy-veins.com/wow/ritual-sites-guide',
    meta: '12.0.5 · 1–5 players · Great Vault World row · Do early in the week',
    categories: ['ritual-sites'],
    priority: 2,
    tasks: [
      { id: 'rs1', goal: {max:5, label:'sites'}, name: 'Complete Ritual Sites this week (flexible — solo or small group)',
        desc: 'Repeatable instanced content with escalating tiers and greater rewards at higher difficulties. Counts toward Great Vault World row.',
        tags: ['tag-void', 'tag-world', 'tag-new'] },
    ]
  },

  {
    id: 'bazaar',
    icon: '', iconClass: 'icon-bazaar',
    title: 'Bazaar Weekly Quests',
    url: 'https://www.icy-veins.com/wow/weekly-to-do-list',
    meta: 'Free weekly value. Easy to forget; never skip.',
    categories: ['world', 'currency'],
    priority: 2,
    tasks: [
      { id: 'bq1', name: 'Complete quest from Ranger Captain Lilatha (2nd floor, The Bazaar)',
        desc: 'Rewards a Ranger\'s Cache containing Field Accolades, Relic Coffer Key shards, gear-upgrade materials, and gold.',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'bq2', name: 'Complete quest from Kul\'amara the Fierce (2nd floor, The Bazaar)',
        desc: 'Second free Ranger\'s Cache weekly. Takes minutes and runs naturally alongside Void Assault activity.',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'bq3', name: 'Complete Weekly World Event quest from Lady Liadrin',
        desc: 'Rewards a Spark (used for crafted gear progression).',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'bq4', name: 'Complete Housing Weekly quest from Vaeli (outside Silvermoon bank)',
        desc: 'Weekly housing quest for decor rewards and housing progression.',
        tags: ['tag-housing', 'tag-world'] },
      { id: 'bq5', name: "Complete Halduron Brightwing's Renown Dungeon Quest",
        desc: "Weekly dungeon assigned by Halduron Brightwing at The Bazaar. Completing the specified dungeon rewards 1,500 Renown rep with your chosen faction. The dungeon rotates each reset. Check Halduron for this week's assignment.",
        tags: ['tag-world', 'tag-gold'] },
    ]
  },

  {
    id: 'professions',
    icon: '⚒️', iconClass: 'icon-crafting',
    title: 'Professions',
    url: 'https://www.icy-veins.com/wow/professions-guide',
    meta: 'Weekly profession content: knowledge points, crafting orders, contracts',
    categories: ['professions'],
    priority: 2,
    tasks: [
      { id: 'pf1', name: 'Complete Weekly Profession Quest (Silvermoon trainer)',
        desc: 'Pick up from your profession trainer near the Silvermoon Forgegrounds. Rewards Knowledge Points to advance your profession skill tree. One quest per profession per week.',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'pf2', goal: {max:5, label:'orders'}, name: 'Fill Crafting Orders at the Forgegrounds',
        desc: 'Public and guild crafting orders available at the Forgegrounds in Silvermoon. Fill orders to earn tips, crafting experience, and Patron Order completions for special rewards.',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'pf3', name: 'Complete Darkmoon Faire profession quests (once per month)',
        desc: 'When Darkmoon Faire is active (first week of each month), complete your profession quests at the Faire for +2 skill points and +3 Knowledge Points per profession.',
        tags: ['tag-world', 'tag-optional'] },
      { id: 'pf4', name: 'Renew Inscription Contracts (if applicable)',
        desc: 'Inscriptionists: craft and apply faction Contracts to earn bonus reputation on every World Quest completion. Contracts expire weekly — reapply each reset.',
        tags: ['tag-gold', 'tag-optional'] },
    ]
  },

  {
    id: 'world-events',
    icon: '', iconClass: 'icon-world',
    title: 'World Events',
    url: 'https://www.icy-veins.com/wow/midnight-world-events-guide',
    meta: 'Rotating across all four Midnight zones each week',
    categories: ['world'],
    priority: 2,
    tasks: [
      { id: 'we0a', name: 'Complete World Quests (daily)',
        desc: 'World Quests reward Adventurer-level gear (ilvl 220–237), gold, and rep. Check your map each day — they rotate frequently and are the lowest barrier gearing activity available at max level.',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'we0b', name: 'Kill Rare Elites (as encountered)',
        desc: 'Rare mobs reward Adventurer-level gear (ilvl 220–237) on kill. Not on a strict lockout — kill rares as you encounter them while doing world content. Higher-threat rares may require a small group.',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'we1', name: 'World Bosses — kill each available boss once',
        desc: 'One kill per boss per week. Four world bosses total across the four Midnight zones. Rewards Champion-quality loot.',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'we2', name: 'Abundance — complete Weekly: Abundance quest (20,000 points)',
        desc: 'Events spawn in zone caverns and rotate every 8 hours. Use Shards of Dundun to empower runs (up to 8 shards per week from outdoor activities). Rewards Overflowing Abundant Satchel + 1,000 Amani Tribe rep.',
        tags: ['tag-world'] },
      { id: 'we3', name: 'Stormarion Assault — complete Stand Your Ground weekly',
        desc: 'Tower defense event at Stormarion Citadel in The Voidstorm, every 30 minutes. Defend 3 waves of void attackers. Rewards Victorious Stormarion Pinnacle Cache.',
        tags: ['tag-world', 'tag-void'] },
      { id: 'we4', name: 'Saltheril\'s Soiree — complete weekly faction quests in Eversong Woods',
        desc: 'Choose your subfaction (Magisters / Blood Knights / Farstriders / Shades of the Row). Fortify the Runestones quest rewards pinnacle chest + 150 Brimming Arcana + 2,000 Silvermoon Court rep. Actions can affect standing with other subfactions.',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'we5', name: 'Legends of the Haranir — complete Lost Legends weekly (Harandar)',
        desc: 'Choose one of 7 Hara\'ti relics and play through its history in a scenario. Rewards Avid Learner\'s Supply Pack (counts as a Midnight Weekly Cache) + 1,000 Hara\'ti rep + a housing decor item based on your relic choice.',
        tags: ['tag-world', 'tag-housing'] },
      { id: 'we6', name: 'Timewalking — complete 5 Timewalking dungeons for weekly quest',
        desc: 'When Timewalking is the active bonus event (check Adventure Guide), complete 5 Timewalking dungeons to earn the weekly quest reward — a piece of current-tier loot. Uses a scaled version of your character in classic dungeons.',
        tags: ['tag-world', 'tag-gold'] },
      { id: 'we7', name: 'Turbulent Timeways — complete Timewalking bonus event quest (if active)',
        desc: 'Special event rotating through Dragonflight Timewalking. Complete the weekly quest for a mount reward. Check the Adventure Guide to see if this event is currently active this week.',
        tags: ['tag-world', 'tag-optional'] },
    ]
  },

  {
    id: 'raid',
    icon: '', iconClass: 'icon-raid',
    title: 'Raids',
    url: 'https://www.icy-veins.com/wow/midnight-season-1-raid-guide',
    meta: 'Personal loot lockout resets Tuesday · Click boss bubbles to track kills',
    categories: ['raid'],
    priority: 2,
    tasks: [
      // ── THE DREAMRIFT ──
      { id: 'rd_lfr',    name: 'The Dreamrift — LFR',
        desc: 'Queue via Group Finder. Rewards Veteran-quality gear and Crests.',
        tags: ['tag-raid'],
        bosses: [{ id: 'chimaerus', name: 'Chimaerus', url: 'https://www.icy-veins.com/wow/chimaerus-raid-guide' }],
        diff: 'LFR' },
      { id: 'rd_n',      name: 'The Dreamrift — Normal',
        desc: 'Personal loot lockout. Counts toward Raid vault row.',
        tags: ['tag-raid'],
        bosses: [{ id: 'chimaerus', name: 'Chimaerus', url: 'https://www.icy-veins.com/wow/chimaerus-raid-guide' }],
        diff: 'Normal' },
      { id: 'rd_h',      name: 'The Dreamrift — Heroic',
        desc: 'Personal loot lockout. Higher ilvl rewards.',
        tags: ['tag-raid'],
        bosses: [{ id: 'chimaerus', name: 'Chimaerus', url: 'https://www.icy-veins.com/wow/chimaerus-raid-guide' }],
        diff: 'Heroic' },
      { id: 'rd_m',      name: 'The Dreamrift — Mythic',
        desc: 'Weekly lockout. Hall of Fame eligible. Highest ilvl in the game.',
        tags: ['tag-raid'],
        bosses: [{ id: 'chimaerus', name: 'Chimaerus', url: 'https://www.icy-veins.com/wow/chimaerus-raid-guide' }],
        diff: 'Mythic' },

      // ── THE VOIDSPIRE ──
      { id: 'vs_lfr',   name: 'The Voidspire — LFR',
        desc: 'Queue via Group Finder. Multiple wings — each awards Veteran-quality gear.',
        tags: ['tag-raid'],
        bosses: [
          { id: 'averzian',  name: 'Imperator Averzian',    url: 'https://www.icy-veins.com/wow/imperator-averzian-raid-guide' },
          { id: 'vorasius',  name: 'Vorasius',              url: 'https://www.icy-veins.com/wow/vorasius-raid-guide' },
          { id: 'salhadaar', name: 'Fallen-King Salhadaar', url: 'https://www.icy-veins.com/wow/fallen-king-salhadaar-raid-guide' },
          { id: 'vaelgor',   name: 'Vaelgor & Ezzorak',     url: 'https://www.icy-veins.com/wow/vaelgor-and-ezzorak-raid-guide' },
          { id: 'vanguard',  name: 'Lightblinded Vanguard', url: 'https://www.icy-veins.com/wow/lightblinded-vanguard-raid-guide' },
          { id: 'cosmos',    name: 'Crown of the Cosmos',   url: 'https://www.icy-veins.com/wow/crown-of-the-cosmos-raid-guide' },
        ],
        diff: 'LFR' },
      { id: 'vs_n',     name: 'The Voidspire — Normal',
        desc: 'Personal loot lockout. Each kill counts toward Raid vault row.',
        tags: ['tag-raid'],
        bosses: [
          { id: 'averzian',  name: 'Imperator Averzian',    url: 'https://www.icy-veins.com/wow/imperator-averzian-raid-guide' },
          { id: 'vorasius',  name: 'Vorasius',              url: 'https://www.icy-veins.com/wow/vorasius-raid-guide' },
          { id: 'salhadaar', name: 'Fallen-King Salhadaar', url: 'https://www.icy-veins.com/wow/fallen-king-salhadaar-raid-guide' },
          { id: 'vaelgor',   name: 'Vaelgor & Ezzorak',     url: 'https://www.icy-veins.com/wow/vaelgor-and-ezzorak-raid-guide' },
          { id: 'vanguard',  name: 'Lightblinded Vanguard', url: 'https://www.icy-veins.com/wow/lightblinded-vanguard-raid-guide' },
          { id: 'cosmos',    name: 'Crown of the Cosmos',   url: 'https://www.icy-veins.com/wow/crown-of-the-cosmos-raid-guide' },
        ],
        diff: 'Normal' },
      { id: 'vs_h',     name: 'The Voidspire — Heroic',
        desc: 'Personal loot lockout. Higher ilvl, tier tokens available.',
        tags: ['tag-raid'],
        bosses: [
          { id: 'averzian',  name: 'Imperator Averzian',    url: 'https://www.icy-veins.com/wow/imperator-averzian-raid-guide' },
          { id: 'vorasius',  name: 'Vorasius',              url: 'https://www.icy-veins.com/wow/vorasius-raid-guide' },
          { id: 'salhadaar', name: 'Fallen-King Salhadaar', url: 'https://www.icy-veins.com/wow/fallen-king-salhadaar-raid-guide' },
          { id: 'vaelgor',   name: 'Vaelgor & Ezzorak',     url: 'https://www.icy-veins.com/wow/vaelgor-and-ezzorak-raid-guide' },
          { id: 'vanguard',  name: 'Lightblinded Vanguard', url: 'https://www.icy-veins.com/wow/lightblinded-vanguard-raid-guide' },
          { id: 'cosmos',    name: 'Crown of the Cosmos',   url: 'https://www.icy-veins.com/wow/crown-of-the-cosmos-raid-guide' },
        ],
        diff: 'Heroic' },
      { id: 'vs_m',     name: 'The Voidspire — Mythic',
        desc: 'Weekly lockout. Hall of Fame eligible.',
        tags: ['tag-raid'],
        bosses: [
          { id: 'averzian',  name: 'Imperator Averzian',    url: 'https://www.icy-veins.com/wow/imperator-averzian-raid-guide' },
          { id: 'vorasius',  name: 'Vorasius',              url: 'https://www.icy-veins.com/wow/vorasius-raid-guide' },
          { id: 'salhadaar', name: 'Fallen-King Salhadaar', url: 'https://www.icy-veins.com/wow/fallen-king-salhadaar-raid-guide' },
          { id: 'vaelgor',   name: 'Vaelgor & Ezzorak',     url: 'https://www.icy-veins.com/wow/vaelgor-and-ezzorak-raid-guide' },
          { id: 'vanguard',  name: 'Lightblinded Vanguard', url: 'https://www.icy-veins.com/wow/lightblinded-vanguard-raid-guide' },
          { id: 'cosmos',    name: 'Crown of the Cosmos',   url: 'https://www.icy-veins.com/wow/crown-of-the-cosmos-raid-guide' },
        ],
        diff: 'Mythic' },

      // ── MARCH ON QUEL'DANAS ──
      { id: 'mq_lfr',   name: "March on Quel'Danas — LFR",
        desc: "Queue via Group Finder. Final raid of Season 1 — Sunwell storyline conclusion.",
        tags: ['tag-raid'],
        bosses: [
          { id: 'beloren', name: "Belo'ren, Child of A'lar", url: 'https://www.icy-veins.com/wow/beloren-raid-guide' },
          { id: 'midnight', name: 'Midnight Falls',           url: 'https://www.icy-veins.com/wow/midnight-falls-raid-guide' },
        ],
        diff: 'LFR' },
      { id: 'mq_n',     name: "March on Quel'Danas — Normal",
        desc: 'Personal loot lockout. Each kill counts toward Raid vault row.',
        tags: ['tag-raid'],
        bosses: [
          { id: 'beloren', name: "Belo'ren, Child of A'lar", url: 'https://www.icy-veins.com/wow/beloren-raid-guide' },
          { id: 'midnight', name: 'Midnight Falls',           url: 'https://www.icy-veins.com/wow/midnight-falls-raid-guide' },
        ],
        diff: 'Normal' },
      { id: 'mq_h',     name: "March on Quel'Danas — Heroic",
        desc: 'Personal loot lockout. Higher ilvl rewards.',
        tags: ['tag-raid'],
        bosses: [
          { id: 'beloren', name: "Belo'ren, Child of A'lar", url: 'https://www.icy-veins.com/wow/beloren-raid-guide' },
          { id: 'midnight', name: 'Midnight Falls',           url: 'https://www.icy-veins.com/wow/midnight-falls-raid-guide' },
        ],
        diff: 'Heroic' },
      { id: 'mq_m',     name: "March on Quel'Danas — Mythic",
        desc: 'Weekly lockout. Hall of Fame eligible. Highest ilvl gear.',
        tags: ['tag-raid'],
        bosses: [
          { id: 'beloren', name: "Belo'ren, Child of A'lar", url: 'https://www.icy-veins.com/wow/beloren-raid-guide' },
          { id: 'midnight', name: 'Midnight Falls',           url: 'https://www.icy-veins.com/wow/midnight-falls-raid-guide' },
        ],
        diff: 'Mythic' },

      // ── WEEKLY QUEST ──
      { id: 'ra8', name: 'Complete weekly raid quest from The Bazaar (if active)',
        desc: 'Some weekly reset quests reward bonus loot or Crests for completing a raid boss. Check Lady Liadrin and the Adventure Guide.',
        tags: ['tag-raid', 'tag-gold'] },
    ]
  },

  // ── PRIORITY 3  (Optional / Collector) ────────────────

  {
    id: 'housing',
    icon: '', iconClass: 'icon-housing',
    title: 'Player Housing',
    url: 'https://www.icy-veins.com/wow/player-housing-guide',
    meta: 'Decor sources spread across multiple weekly systems',
    categories: ['housing'],
    priority: 3,
    tasks: [
      { id: 'h1', name: 'Complete Housing Weekly quest from Vaeli (outside Silvermoon bank)',
        desc: 'Complete every reset. Weekly housing quest with decor rewards.',
        tags: ['tag-housing', 'tag-gold'] },
      { id: 'h2', name: 'Spend Field Accolades on housing decor at Silvermoon vendors',
        desc: 'Both Void Assaults and Ritual Sites generate Field Accolades, redeemable for housing items, mounts, and pets.',
        tags: ['tag-housing', 'tag-gold', 'tag-new'] },
      { id: 'h4', name: 'Check Ritual Sites Field Accolade vendor for new decor unlocks',
        desc: 'New housing items become purchasable after completing associated Ritual Site weeklies.',
        tags: ['tag-housing', 'tag-new'] },
    ]
  },

  {
    id: 'pvp',
    icon: '', iconClass: 'icon-pvp',
    title: 'PvP',
    url: 'https://www.icy-veins.com/wow/midnight-pvp-season-1-guide',
    meta: 'Conquest cap resets Tuesday',
    categories: ['pvp'],
    priority: 3,
    tasks: [
      { id: 'pv1', goal: {max:1750, label:'conquest'}, name: 'Earn weekly Conquest cap',
        desc: 'Fastest via Rated BGs and Arena (2v2 / 3v3). Conquest cap increases each week of the season.',
        tags: ['tag-pvp'] },
      { id: 'pv2', name: 'Queue Decor Duels — prop hunt PvP in instanced Silvermoon City',
        desc: '12.0.5 new mode. No combat involved — hide using housing decor to blend in. Recommended even for PvP-averse players. Rewards housing decor.',
        tags: ['tag-pvp', 'tag-housing', 'tag-new'] },
      { id: 'pv3', name: 'Complete PvP Weekly Bonus Event quest (if active)',
        desc: 'Check Adventure Guide. Rewards Honor + gear when PvP is the featured weekly activity.',
        tags: ['tag-pvp', 'tag-gold'] },
      { id: 'pv4', name: 'Queue Rated Arena — 2v2 for accessible rated play',
        desc: 'Most accessible rated PvP format. Awards Conquest toward the weekly cap, gear, and contributes to your rating. A few matches each week keeps progression moving.',
        tags: ['tag-pvp'] },
      { id: 'pv5', name: 'Queue Rated Arena — 3v3 for Conquest and rating',
        desc: 'Higher skill ceiling than 2v2 with the same Conquest rewards. Best for players with a consistent two-partner group.',
        tags: ['tag-pvp'] },
      { id: 'pv6', name: 'Queue Solo Shuffle for solo rated PvP',
        desc: '6-player round-robin rated format — each player scores independently, no premade partner needed. Rewards Conquest and a personal rating. Ideal for solo players.',
        tags: ['tag-pvp'] },
      { id: 'pv7', name: 'Queue Rated Battlegrounds for team play',
        desc: '10v10 rated format (Epic BGs at 40v40). Best Conquest per hour for organised groups. Rewards Conquest, gear, and battleground-exclusive cosmetics.',
        tags: ['tag-pvp'] },
    ]
  },

  {
    id: 'void-assaults',
    icon: '🌀', iconClass: 'icon-void',
    title: 'Void Assaults',
    url: 'https://www.icy-veins.com/wow/void-assaults-hub',
    meta: 'Start here each reset · Rotates between Eversong Woods and Zul\'Aman weekly',
    categories: ['void-assaults'],
    priority: 3,
    tasks: [
      { id: 'va1', name: 'Check which zone has the active Void Assault this week',
        desc: 'Void Strikes rotate weekly between Eversong Woods and Zul\'Aman. Check your map at reset.',
        tags: ['tag-void', 'tag-new'] },
      { id: 'va2', goal: {max:5, label:'strikes'}, name: 'Complete Void Strikes in the active zone',
        desc: 'Smaller targeted attacks — easily soloable or in a small group. Defeating one spawns another nearby. Each awards Field Accolades.',
        tags: ['tag-void', 'tag-world'] },
      { id: 'va3', name: 'Participate in the Void Incursion (once bar reaches 100%)',
        desc: 'Larger assault requiring more players. Triggered by clearing enough Void Strikes. Best Void Assault rewards.',
        tags: ['tag-void', 'tag-world'] },
      { id: 'va4', name: 'Complete Void Assault weekly quest',
        desc: 'Rewards Ranger\'s Cache Pinnacle cache. Worth doing even if you no longer need Veteran-quality gear.',
        tags: ['tag-void', 'tag-gold'] },
    ]
  },

  {
    id: 'showdown-zones',
    icon: '⚔️', iconClass: 'icon-pvp',
    title: 'Showdown Zones',
    url: 'https://www.icy-veins.com/wow/showdown-zones-guide',
    meta: '🚧 Coming June 16 · Patch 12.0.7 · Open-world PvPvE content rotating weekly',
    categories: ['world', 'pvp'],
    priority: 3,
    tasks: [
      { id: 'sz1', name: '[Coming June 16] Check active Showdown Zone — follow portal from Silvermoon',
        desc: 'Patch 12.0.7 · Showdown Zones are rotating open-world areas with mixed PvPvE objectives. A new zone activates each weekly reset. Access via the portal in Silvermoon City.',
        tags: ['tag-world', 'tag-pvp'] },
      { id: 'sz2', name: '[Coming June 16] Complete Showdown Zone activities',
        desc: 'Patch 12.0.7 · Each zone has unique objectives — capture points, supply runs, and player elimination targets. Rewards gear, currency, and zone-exclusive cosmetics.',
        tags: ['tag-world', 'tag-pvp', 'tag-gold'] },
      { id: 'sz3', name: '[Coming June 16] Kill World Boss in the active Showdown Zone',
        desc: 'Patch 12.0.7 · Each active Showdown Zone contains a World Boss encounter, unlocked by completing zone activities. Rewards Champion-quality loot. One kill per character per week.',
        tags: ['tag-world', 'tag-pvp', 'tag-gold'] },
    ]
  },

  {
    id: 'optional',
    icon: '', iconClass: 'icon-optional',
    title: 'Optional & Collector Content',
    meta: '12.0.5 permanent side content — no core power progression, great for collectors',
    categories: ['optional'],
    priority: 3,
    tasks: [
      { id: 'op1', name: 'Abyss Anglers — visit Depthdiver Jeju at 68.2, 20.0 off Zul\'Aman coast',
        desc: 'Deep-sea spearfishing activity. Earns Angler Pearls for new armor sets, housing decor, pets, and a floppy fish mace. Upgrade diving gear to reach deeper zones with better treasure.',
        tags: ['tag-optional', 'tag-housing', 'tag-new'] },
      { id: 'op2', goal: {max:8, label:'shards'}, name: 'Collect up to 8 Shards of Dundun for Abundance runs',
        desc: 'Weekly cap of 8 shards from outdoor activities, gathering, and Patron Crafting Orders. Used to Empower Abundance events for bonus Unalloyed Abundance (tradeable for transmog and housing decor).',
        tags: ['tag-optional', 'tag-world'] },
    ]
  },

];

/* ── BEGINNER PRESET STAGES ── */
const BEGINNER_STAGES = [
  {
    id: 'fresh',
    label: 'Fresh 80 — Just hit max level',
    sublabel: 'ilvl ~200–219 · Adventurer gear is your target',
    color: 'var(--success-bright)',
    tasks: [
      'bq1','bq2','bq3',           // Bazaar weeklies — free, high value
      'we0a','we0b',               // World Quests + Rare mobs — easiest gear
      'va2','va3','va4',           // Void Assaults — strong intro content
      'we1',                       // World Bosses
      'we4',                       // Saltheril's Soiree
      'we2',                       // Abundance
      'pr_norm',                   // Normal Prey (2x, Adventurer gear)
      'd_bountiful',               // Bountiful Delves (scales to your tier)
      'd3',                        // Delve weekly cache
      'v1','v2',                   // Great Vault — always open it
      'cu1',                       // Spend Crests
    ]
  },
  {
    id: 'gearing',
    label: 'Early Gearing — Building toward Veteran',
    sublabel: 'ilvl 220–232 · Pushing into Veteran content',
    color: 'var(--light-gold)',
    tasks: [
      'bq1','bq2','bq3','bq5',     // Bazaar weeklies incl. Halduron
      'we0a','we0b',
      'va2','va3','va4',
      'we1','we4','we2','we3',
      'pr_norm','pr_hard',         // Normal + Hard Prey
      'rs1',                       // Ritual Sites
      'd1',                        // Trovehunter's Bounty
      'd_bountiful',
      'd3',
      'pf1','pf2',                 // Weekly Profession Quest + Crafting Orders
      'v1','v2',
      'cu1','cu2','cu5',           // Crests + Catalyst + Dawncrest crafting
      'vf1','vf2','vf3',           // Voidforge questline
    ]
  },
  {
    id: 'progressing',
    label: 'Progressing — Veteran to Champion',
    sublabel: 'ilvl 233–249 · Solo content fully unlocked',
    color: 'var(--void-glow)',
    tasks: [
      'bq1','bq2','bq3','bq5',
      'we0a','we0b',
      'va2','va3','va4',
      'we1','we4','we2','we3','we5','we6',
      'pr_norm','pr_hard','pr_nm', // All three Prey difficulties
      'pr3',                       // Prey transmog check
      'rs1',
      'd1','d_bountiful','d3',
      'm1','m4','m5',              // Mythic+ for vault + Crests
      'pf1','pf2','pf3','pf4',     // Full professions
      'pv4','pv6',                 // Rated Arena 2v2 + Solo Shuffle
      'v1','v2',
      'cu1','cu2','cu3','cu4','cu5',
      'vf1','vf2','vf3','vf4',
    ]
  },
  {
    id: 'endgame',
    label: 'Solo Endgame — Champion and beyond',
    sublabel: 'ilvl 250+ · Maximising every weekly system',
    color: '#c0b8d8',
    tasks: [
      'bq1','bq2','bq3','bq5',
      'we0a','we0b',
      'va2','va3','va4',
      'we1','we4','we2','we3','we5','we6',
      'pr_hard','pr_nm','pr3',
      'rs1',
      'd1','d_bountiful','d2','d3',
      'm1','m4','m5',
      'rd_h','rd_m',               // Dreamrift Heroic + Mythic
      'vs_h','vs_m',               // Voidspire Heroic + Mythic
      'mq_h','mq_m',               // March on Quel'Danas Heroic + Mythic
      'ra8',                       // Weekly raid quest
      'pf1','pf2','pf3','pf4',
      'pv1','pv4','pv5','pv6','pv7', // Full PvP rotation
      'v1','v2',
      'cu1','cu2','cu3','cu4','cu5',
      'vf1','vf2','vf3','vf4',
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
      <span class="beginner-stage-arrow">→</span>
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
