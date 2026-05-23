/* -------------------------------------------
   CHANGELOG DATA
   Semantic versioning: MAJOR.MINOR.PATCH
     MAJOR — architectural shift or breaking change
     MINOR — new features, backward compatible
     PATCH — bug fixes, small improvements, refactors
   Add new versions at the top of the VERSIONS array.
   Types: new | fix | improve | content | remove
------------------------------------------- */
const VERSIONS = [
  {
    version: 'v2.2.0',
    date: 'May 23, 2026',
    summary: 'Cross-device cloud sync, character management overhaul, realm-aware identifiers',
    entries: [
      { type: 'new',     text: 'Cross-device cloud sync — your characters, progress, and settings stay identical on every device you log into', detail: 'Cloud is the single source of truth. Logging in on a new device pulls your full profile. Any change you make is pushed to the cloud within a few seconds and picked up on your other devices the next time they load the page.' },
      { type: 'new',     text: 'Realm-aware character identifiers — you can now track two characters with the same name on different realms as separate entries', detail: 'Characters imported from Battle.net are stored as Name@realm-slug. The realm badge appears on character cards only when a name conflict exists.' },
      { type: 'new',     text: 'Character portrait shown in the character bar for each synced character, pulled from the Battle.net character media API', detail: '' },
      { type: 'new',     text: 'Edit ▾ menu replaces the old inline edit and remove buttons on each character card — keeps the character bar clean', detail: 'Menu options: Edit character (blocked for Battle.net-synced characters), Remove character, and Rearrange list.' },
      { type: 'new',     text: 'Remove Character shows a list of all characters with individual remove buttons instead of only targeting the active character', detail: '' },
      { type: 'new',     text: 'Weekly reset countdown powered by the Blizzard Mythic Keystone API — shows the exact time remaining until the current M+ period ends', detail: 'Falls back to a calculated time if the API is unavailable.' },
      { type: 'improve', text: 'Welcome guide Battle.net path now imports characters immediately — logged-in users go straight from the connection confirmation to Your List setup, skipping the manual character entry step', detail: '' },
      { type: 'improve', text: 'Character creation step in the welcome guide is no longer skippable for offline users — a character name is required to continue', detail: '' },
      { type: 'improve', text: 'After syncing characters to a new device, armory data (portrait, item level, Mythic+ rating) is fetched automatically using the embedded realm slug — no re-import needed', detail: '' },
      { type: 'fix',     text: 'Battle.net import dialog no longer re-offers characters that are already in your list, including characters added before the realm-aware system', detail: '' },
      { type: 'fix',     text: 'Sync was silently skipping cloud pulls due to a stale sessionStorage flag that persisted through hard refreshes — replaced with a 10-minute timestamp that correctly re-pulls on fresh sessions and tab focus', detail: '' },
    ]
  },
  {
    version: 'v2.1.0',
    date: 'May 22, 2026',
    summary: 'Full armory sync via Blizzard API — gear, icons, raid kills, and M+ all auto-tracked',
    entries: [
      { type: 'new',     text: 'Raid boss kills auto-checked after each reset. The tracker reads your kill history from Battle.net and marks every boss you\'ve already cleared this week', detail: 'Compares each kill timestamp against the Tuesday 15:00 UTC reset. Works for LFR, Normal, Heroic, and Mythic across all three current raids.' },
      { type: 'new',     text: 'Equipped gear icons fetched from the Blizzard media API and stored with armory data for all 16 equipment slots', detail: '' },
      { type: 'new',     text: '🔄 Sync button in the character bar force-refreshes all characters regardless of cache age — runs BiS checks, M+ counters, and raid auto-checks immediately', detail: 'Shows ⏳ Syncing… while running and reports how many characters were updated.' },
      { type: 'new',     text: 'Mythic+ rating and color displayed in the character bar badge and class resource bar, sourced directly from Blizzard', detail: '' },
      { type: 'improve', text: 'Armory sync now uses the Blizzard Battle.net API directly instead of Raider.IO — item level, spec, class, Mythic+ rating, equipped gear, and weekly M+ runs all come from Blizzard', detail: 'Raider.IO profile link is kept in the class resource bar as a useful community reference.' },
      { type: 'improve', text: 'BiS gear tasks in Your List are auto-checked when your synced gear matches the item — works on both manual sync and auto-sync at login', detail: '' },
      { type: 'improve', text: 'Auto-sync on login now re-fetches characters whose cached data is missing gear or raid kill fields, not just data older than one hour', detail: '' },
    ]
  },
  {
    version: 'v2.0.0',
    date: 'May 22, 2026',
    summary: 'Battle.net account login, cloud save, and character import',
    entries: [
      { type: 'new',     text: '🔑 Log in with Battle.net — connect your account for automatic syncing and cross-device cloud saves', detail: 'Uses Blizzard\'s official OAuth 2.0 flow. The site only requests read access to your WoW profile — no write permissions.' },
      { type: 'new',     text: 'Cloud save — your characters, task lists, and progress are backed up to the cloud when logged in and synced to any device you sign into', detail: 'Local saves are always the source of truth; the cloud backup is pulled on first load and pushed whenever you make changes.' },
      { type: 'new',     text: '⬇ Import — pull all your level 80+ characters directly from Battle.net with one click. Realm and class are set automatically', detail: 'Character class icons are shown in the import picker. After import, armory sync runs automatically for any character with a realm set.' },
      { type: 'improve', text: 'Sync and Import buttons in the character bar now use a styled purple button matching the app aesthetic instead of the dashed add-character style', detail: '' },
    ]
  },
  {
    version: 'v1.9.1',
    date: 'May 21, 2026',
    summary: 'Mythic+ weekly run tracker with vault preview and auto-filled counters',
    entries: [
      { type: 'new',     text: 'Mythic+ counters are automatically filled from your synced runs each week. The vault counter caps at 8 and the 10+ key counter has no limit', detail: '' },
      { type: 'new',     text: 'Vault Preview shown on the Mythic+ task card. Displays expected reward track, upgrade level, and item level for each of your three vault slots based on keys completed this week', detail: 'Slot 1 is based on your best key, slot 2 on your 4th best, and slot 3 on your 8th best. Locked slots show how many more runs are needed.' },
      { type: 'new',     text: 'This week\'s run list shown in the Mythic+ section with dungeon name, key level, and timer result for every run', detail: '' },
      { type: 'improve', text: '10+ key counter on the farm task has no cap and tracks every high key run without a ceiling', detail: '' },
    ]
  },
  {
    version: 'v1.9.0',
    date: 'May 21, 2026',
    summary: 'Armory sync via Raider.IO: pull character stats and auto-check acquired BiS gear',
    entries: [
      { type: 'new',     text: '🔄 Armory Sync button on each character. Pulls your spec, guild, item level, and Mythic+ rating from Raider.IO with no setup required', detail: 'Just add your realm name to a character and hit the sync button. No API keys or accounts needed.' },
      { type: 'new',     text: 'Character bar shows your synced spec, class, and guild on the left with item level and Mythic+ rating badges on the right', detail: '' },
      { type: 'new',     text: '📈 Raider.IO profile link in the class resource bar for quick access to your character page', detail: 'Only appears when a realm is set for the character.' },
      { type: 'new',     text: 'BiS items in Your List are automatically checked off when a sync finds them already equipped on your character', detail: '' },
      { type: 'improve', text: 'Your first character is now selected and active by default when the tracker loads', detail: '' },
    ]
  },
  {
    version: 'v1.8.6',
    date: 'May 20, 2026',
    summary: 'Best in Slot gear system for all 40 specs',
    entries: [
      { type: 'new',     text: '⚔️ BiS Gear button in the toolbar opens a picker to browse and import Best in Slot items by class and spec', detail: 'Pick your class and spec, browse the full gear list, check what you want, and import. Items land in Your List under their own BiS section.' },
      { type: 'new',     text: 'Full Best in Slot lists for all 40 playable specs covering the current patch', detail: '' },
      { type: 'new',     text: 'Gear slot icons shown on every BiS item in the picker and in Your List', detail: '' },
      { type: 'new',     text: 'Role icons shown next to each spec so you can quickly tell DPS, Healer, and Tank apart', detail: '' },
      { type: 'new',     text: 'BiS items live in their own section in Your List and do not count toward your weekly progress bar', detail: '' },
      { type: 'new',     text: 'Edit button on BiS task cards lets you swap in a different item if your situation differs from the default list', detail: '' },
    ]
  },
  {
    version: 'v1.8.4',
    date: 'May 18, 2026',
    summary: 'Section headers link to Icy Veins guides',
    entries: [
      { type: 'new',     text: 'Every section header is now a clickable link to its matching Icy Veins guide, opening in a new tab', detail: '' },
    ]
  },
  {
    version: 'v1.8.3',
    date: 'May 19, 2026',
    summary: 'Welcome back popup shows new patch notes on every update',
    entries: [
      { type: 'new',     text: 'A welcome back popup appears automatically whenever the tracker is updated, showing what changed since your last visit', detail: 'Check the box to hide it until the next update, or leave it unchecked to see it every visit.' },
    ]
  },
  {
    version: 'v1.8.2',
    date: 'May 19, 2026',
    summary: 'Welcome walkthrough improvements',
    entries: [
      { type: 'improve', text: 'The welcome walkthrough now lets you add your first character inline without leaving the guide', detail: '' },
      { type: 'improve', text: 'The walkthrough now lets you pick a Starter Guide preset inline so you can start tracking right away', detail: '' },
    ]
  },
  {
    version: 'v1.8.1',
    date: 'May 18, 2026',
    summary: 'Renamed to The Azeroth Agenda, light mode appearance fixes',
    entries: [
      { type: 'improve', text: 'Tracker renamed to The Azeroth Agenda', detail: '' },
      { type: 'fix',     text: 'Light mode appearance fixes for the class picker, spec picker, class links bar, and character chips', detail: '' },
    ]
  },
  {
    version: 'v1.8.0',
    date: 'May 18, 2026',
    summary: 'Completion heatmap, clickable tag filters, Discord copy, light mode refresh',
    entries: [
      { type: 'new',     text: '🗺 Heatmap tab in Summary shows all your characters across the last 10 weeks color-coded by completion', detail: '' },
      { type: 'improve', text: 'Tags like Vault and Currency are now clickable to filter the task list to only tasks with that tag', detail: '' },
      { type: 'new',     text: 'Copy for Discord button in Summary generates a formatted weekly progress summary ready to paste', detail: '' },
      { type: 'improve', text: 'Currency and Upgrades section renamed to Upgrades', detail: '' },
      { type: 'improve', text: 'Light mode updated with a warm Silvermoon and Sunwell color palette', detail: '' },
    ]
  },
  {
    version: 'v1.7.0',
    date: 'May 18, 2026',
    summary: 'Character roles, shareable plans, event alerts, welcome guide',
    entries: [
      { type: 'new',     text: 'Character roles let you tag each character as Main, Alt, or Farm for better organization', detail: '' },
      { type: 'new',     text: '🔗 Share Plan copies a link to your current Your List so others can import your setup', detail: '' },
      { type: 'new',     text: 'Event proximity alerts show banners when an event is ending soon or starting tomorrow', detail: '' },
      { type: 'new',     text: '🧭 Welcome walkthrough added for first-time visitors covering all the major features', detail: '' },
    ]
  },
  {
    version: 'v1.6.0',
    date: 'May 18, 2026',
    summary: 'Template Profiles, Last Chance Mode, Efficiency Scores',
    entries: [
      { type: 'new',     text: 'Template Profiles let you save a named task list configuration and apply it to any character', detail: '' },
      { type: 'new',     text: '⚡ Last Chance Mode hides completed tasks so you can focus on what is left before the reset', detail: 'Auto-activates when fewer than 6 hours remain until the weekly reset.' },
      { type: 'new',     text: '📈 Efficiency Score tab in Summary shows your average completion rate per section over time', detail: '' },
    ]
  },
  {
    version: 'v1.5.0',
    date: 'May 15, 2026',
    summary: 'New tasks, Your List overhaul, Event Calendar, grouped view, Starter Guide',
    entries: [
      { type: 'content', text: 'World Quests and Rare Elite kills added to World Events', detail: '' },
      { type: 'content', text: 'Prey System expanded with separate tracking for Normal, Hard, and Nightmare hunts', detail: '' },
      { type: 'content', text: 'Delves reworked with Trovehunter\'s Bounty and a goal tracker for Bountiful Delves', detail: '' },
      { type: 'content', text: 'Crafting and Dawncrest empowerment tasks added to Upgrades', detail: '' },
      { type: 'new',     text: 'Event Calendar page with live and upcoming world events', detail: '' },
      { type: 'new',     text: 'Live event strip in the reset bar shows the current event and the next upcoming one', detail: '' },
      { type: 'new',     text: 'Grouped and Flat List view toggle for switching between section cards and a single scrollable list', detail: '' },
      { type: 'new',     text: 'Your List grouped view shows tasks organized by section with headers and counts', detail: '' },
      { type: 'new',     text: '🧭 Starter Guide presets for four progression stages to quickly populate Your List', detail: '' },
      { type: 'new',     text: 'Copy List to Character option in the edit bar for pushing your list to other characters', detail: '' },
      { type: 'improve', text: 'Edit List button always visible in the toolbar regardless of the active tab', detail: '' },
      { type: 'improve', text: 'Goal trackers visible across all views, not just Your List', detail: '' },
      { type: 'remove',  text: 'Apply to All toolbar button replaced by the Copy to Character dropdown in the edit bar', detail: '' },
    ]
  },
  {
    version: 'v1.4.0',
    date: 'May 14, 2026',
    summary: 'Raid boss tracking, task search, mobile fixes',
    entries: [
      { type: 'new',     text: 'Raid boss bubble tracker for all three Season 1 raids across all four difficulties', detail: '' },
      { type: 'new',     text: 'Difficulty badges for LFR, Normal, Heroic, and Mythic using in-game color coding', detail: '' },
      { type: 'new',     text: 'Task search bar with live filtering across all tabs including Your List', detail: '' },
      { type: 'improve', text: 'Raid section rebuilt with per-raid, per-difficulty rows covering all bosses', detail: '' },
      { type: 'fix',     text: 'Toolbar and reset bar layout fixes for mobile and narrow screens', detail: '' },
    ]
  },
  {
    version: 'v1.3.0',
    date: 'May 14, 2026',
    summary: 'Inline history strip, alt overview, dashboard redesign',
    entries: [
      { type: 'new',     text: 'Inline weekly history strip embedded in the reset bar with sparkline bars for up to 12 weeks', detail: '' },
      { type: 'new',     text: 'History stat boxes showing Weeks Tracked, Streak, Best Week, and Average Completion', detail: '' },
      { type: 'new',     text: 'Automatic weekly snapshots saved for all characters whenever a new reset week is detected', detail: '' },
      { type: 'new',     text: 'All Alts tab in Summary modal shows every character\'s weekly completion at a glance', detail: '' },
      { type: 'improve', text: 'Reset bar redesigned into two rows for a cleaner layout', detail: '' },
      { type: 'remove',  text: 'Standalone Alts and History buttons removed, replaced by Summary modal tabs', detail: '' },
    ]
  },
  {
    version: 'v1.2.1',
    date: 'May 14, 2026',
    summary: 'Class system and resource links',
    entries: [
      { type: 'new',     text: 'Class selection when adding or editing a character, with all 13 WoW classes and their official colors', detail: '' },
      { type: 'new',     text: 'Class resource links bar below the character bar with links to Icy Veins, Murlok.io, Wowhead, and Blizzard', detail: '' },
      { type: 'fix',     text: 'Multiple link corrections and small layout fixes', detail: '' },
    ]
  },
  {
    version: 'v1.2.0',
    date: 'May 14, 2026',
    summary: 'Task notes, dark and light mode, compact view, confetti, summary, data export',
    entries: [
      { type: 'new',     text: 'Task Notes let you jot personal per-character reminders on any task', detail: '' },
      { type: 'new',     text: 'Dark and Light mode toggle with preference saved between sessions', detail: '' },
      { type: 'new',     text: 'Compact mode hides descriptions and tags to show more tasks on screen at once', detail: '' },
      { type: 'new',     text: '🎲 What\'s Next button highlights a random uncompleted task from Your List', detail: '' },
      { type: 'new',     text: 'Confetti burst on task completion, with a full celebration when the last task is done', detail: '' },
      { type: 'new',     text: 'Weekly Summary modal with per-section progress bars', detail: '' },
      { type: 'new',     text: 'Export and import character data as a JSON file', detail: '' },
      { type: 'new',     text: 'Copy Your List to all characters at once', detail: '' },
    ]
  },
  {
    version: 'v1.1.0',
    date: 'May 13, 2026',
    summary: 'Launch day: full content pass, multi-character, Your List, custom tasks',
    entries: [
      { type: 'content', text: 'All task content rebuilt from current Patch 12.0.5 data', detail: '' },
      { type: 'content', text: 'Voidforge, Void Assaults, Ritual Sites, Prey System, and other 12.0.5 content added', detail: '' },
      { type: 'new',     text: 'Multi-character support with independent weekly progress per character', detail: '' },
      { type: 'new',     text: '⭐ Your List for building a personal curated task list from the master list', detail: '' },
      { type: 'new',     text: 'Custom Tasks tab for adding your own personal to-dos per character', detail: '' },
      { type: 'new',     text: 'Hide individual tasks or entire sections from your view', detail: '' },
      { type: 'new',     text: 'Character rename with automatic data migration', detail: '' },
      { type: 'new',     text: 'Priority dividers in the All view to surface the most important tasks first', detail: '' },
    ]
  },
  {
    version: 'v1.0.0',
    date: 'May 13, 2026',
    summary: 'Initial release',
    entries: [
      { type: 'new',     text: 'Initial release with dark fantasy Midnight aesthetic', detail: '' },
      { type: 'new',     text: 'Weekly task tracking with per-character progress saved between sessions', detail: '' },
      { type: 'new',     text: 'Collapsible sections with done and total counts per section', detail: '' },
      { type: 'new',     text: 'Progress bar showing completion for the current view and character', detail: '' },
    ]
  },
];
