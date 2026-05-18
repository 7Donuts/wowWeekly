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
    version: 'v1.8.1',
    date: 'May 18, 2026',
    summary: 'Renamed to The Azeroth Agenda; light mode character modal fixes',
    entries: [
      { type: 'improve', text: 'Tracker renamed to The Azeroth Agenda across all pages', detail: 'All browser titles, page headings, back links, footer credits, the Discord copy output, and the welcome walkthrough now use the new name. Internal file names (midnight.css) and localStorage key prefixes (wow_mn_) are unchanged to avoid breaking existing data.' },
      { type: 'fix', text: 'Light mode — class picker inactive button borders were invisible (rgba(255,255,255,0.1) on ivory)', detail: 'Inactive class buttons now use var(--border) for their outline, making all 13 class options clearly visible on the parchment background.' },
      { type: 'fix', text: 'Light mode — active class text unreadable for light-colored classes (Priest white, Rogue yellow, Paladin pink, etc.)', detail: 'Active class button text now uses var(--text-primary) in light mode instead of the class color directly. The class color is still used for the border and background tint, preserving the visual identity without making text invisible.' },
      { type: 'fix', text: 'Light mode — role picker active text unreadable when selected', detail: 'Same fix as class picker: active role text uses var(--text-primary) in light mode. Role color still shows on the border.' },
      { type: 'fix', text: 'Light mode — class links bar fully invisible for light-colored classes', detail: 'The class links bar (Priest, Hunter, etc.) used the class color directly for all text, borders, and backgrounds. On ivory this made the entire bar invisible. In light mode the bar now uses CSS variables: var(--text-primary) for text, var(--border) for borders, var(--bg-card) for button backgrounds.' },
      { type: 'fix', text: 'Light mode — character chip border invisible for Priest and other white/near-white class colors', detail: 'Character chips with a class set now use var(--border-bright) for the border in light mode, with a faint class-color glow as a secondary indicator. Dark mode is unchanged.' },
    ]
  },
  {
    version: 'v1.8.0',
    date: 'May 18, 2026',
    summary: 'Cross-alt completion heatmap, clickable tag filters',
    entries: [
      { type: 'new', text: '🗺 Heatmap tab in Summary modal — grid of all characters × last 10 weeks, color-coded by completion %', detail: 'Each cell shows the character\'s completion for that reset week. Colors: green = 100%, teal = 60–99%, gold = 30–59%, purple = 1–29%, faded = no data. The current week is always included as live data (not from history). Cells show a ✓ for full completes and a % for partial. Hover any cell for exact done/total counts. Characters are sorted by role group (Main → Alt → Farm → Ungrouped). The active character is highlighted in gold.' },
      { type: 'improve', text: 'Task tags overhauled — section-redundant tags removed, cross-cutting tags (Vault, Currency, 12.0.5) made clickable', detail: 'Tags that duplicated section filter tabs (Raid, Mythic+, Delve, PvP, Void, World, Housing, Optional) no longer clutter task cards. Vault, Currency, and 12.0.5 tags remain and are now interactive — click any to filter the entire task list to only tasks with that tag, across all visible sections. Click again to clear. Active tag badge gets a glowing outline. Works in all views including Your List.' },
      { type: 'new', text: '📋 Copy for Discord — one-click weekly summary formatted for Discord paste', detail: 'Button lives in the Summary modal footer alongside Close. Generates a plain-text block using Discord markdown: bold section names, ✅/🔄/⬜ completion icons per section, and a 10-block progress bar. Includes character name, class, role tag, and week date. Falls back to a prompt() copy dialog if clipboard access is unavailable.' },
      { type: 'improve', text: 'Currency & Upgrades section renamed to Upgrades', detail: 'Section content is gear upgrade tasks, not currency tracking. The filter tab, section header, and Summary rows all reflect the new name. Internal category key (currency) and localStorage keys are unchanged.' },
      { type: 'improve', text: 'Light mode redesigned — Silvermoon / Sunwell palette replaces generic purple-on-white', detail: 'Backgrounds shift to sun-warm ivory and parchment (Silvermoon stone). Void-purple accent replaced with Silvermoon crimson (#8b1a1a). Void-glow replaced with Sunwell amber-gold (#b8820a). Progress bars now render a crimson-to-gold gradient. Text uses deep crimson-brown tones throughout. Borders are warm copper. All 14 scattered light-mode override blocks updated — tier buttons, event cards, section headers, view toggle, back links, welcome modal, heatmap cells.' },
    ]
  },
  {
    version: 'v1.7.0',
    date: 'May 18, 2026',
    summary: 'Character roles, shareable plans, event alerts, welcome guide',
    entries: [
      { type: 'new',     text: 'Character roles — tag characters as ⭐ Main, ◆ Alt, or 🌿 Farm', detail: 'Role picker added to the Add / Edit character modal. Role dot appears inline in the character bar. All Alts tab in Summary modal auto-groups rows by role with colored subheaders when any character has a role set.' },
      { type: 'new',     text: '🔗 Share Plan — copy a shareable URL encoding your current Your List', detail: 'Share Plan button appears in the toolbar when Your List has tasks. Copies a URL with encoded task IDs to the clipboard. Anyone opening the link sees an import banner with a task preview and a one-click Import button. Hash is cleared from the URL immediately so refresh does not re-trigger.' },
      { type: 'new',     text: 'Event Proximity Alerts — dismissible banners for events ending soon or starting tomorrow', detail: 'Active events ending within 3 days show a gold warning banner. Events starting tomorrow show a blue notice. Urgent events (ending today or tomorrow) use a red style. Each alert can be individually dismissed; dismissals persist for the session only so alerts reappear on next visit.' },
      { type: 'new',     text: '🧭 Welcome Walkthrough — 6-step first-visit guide covering all major features', detail: 'Fires automatically on first visit. Covers: character setup, Your List and Starter Guide, task tracking (boss bubbles, goal counters, reset timing), and all smart tools (Summary, Event Alerts, Last Chance, Share Plan, Data export). Navigable with Back / Next. Skip link on every step. Reopenable anytime via ⇅ Data → Site Guide.' },
      { type: 'improve', text: 'CSS consolidated — duplicate selectors merged, shared badge colors grouped, --color-danger variable added', detail: 'Duplicate .reset-bar-top definition removed (overflow:hidden merged into the first). .task-del and .task-hide share a grouped base rule. .byline-link:hover, .inline-event-btn:hover, and .back-link:hover share one grouped rule. Badge colors across .tag-*, .badge-*, and .ev-tag-* grouped by color theme. New --color-danger: #e07068 CSS variable replaces all hardcoded danger-red values. 1,888 → 1,862 lines.' },
    ]
  },
  {
    version: 'v1.6.0',
    date: 'May 18, 2026',
    summary: 'Template Profiles, Last Chance Mode, Section Efficiency Scores',
    entries: [
      { type: 'new',     text: 'Template Profiles — save and apply named configurations across characters', detail: 'Profiles capture Your List task selection and hidden tasks/sections. Accessible via ⇅ Data → Template Profiles. Save with any name, overwrite with confirmation, delete, or Apply to stamp onto any character. Metadata shows task count, hidden item count, and save date. Profiles are global — available to all characters.' },
      { type: 'new',     text: '⚡ Last Chance Mode — urgency view that hides all completed tasks', detail: 'Shows only what still needs doing. Auto-activates when fewer than 6 hours remain until Tuesday reset. Can also be toggled manually at any time. Button lives in the bottom bar next to the history strip. Active state shown with red highlight. A dismissible banner tracks remaining task count, updating live as tasks are checked.' },
      { type: 'new',     text: '📈 Efficiency Score tab in Summary modal — per-section completion rates across historical weeks', detail: 'Shows each section\'s average completion rate as a fill bar, a week sample count, and a trend arrow (↑ improving / → steady / ↓ declining) comparing last 3 weeks vs prior 3. Sections skipped most weeks surface a nudge suggesting you hide them. Graceful empty state until enough history accumulates.' },
      { type: 'improve', text: 'Weekly history snapshots now store per-section breakdown', detail: 'Each history entry gains a sections map ({ done, total, title } per section). Used by the Efficiency tab. Backward compatible — older entries without section data are silently skipped.' },
      { type: 'improve', text: 'Summary modal gains a third tab — Efficiency — alongside Current and All Alts', detail: '' },
      { type: 'improve', text: 'Last Chance button uses a dedicated CSS class (.btn-last-chance / .active) rather than inline style overrides', detail: 'Cleaner DOM, consistent theming, and proper hover/active states in both light and dark mode.' },
    ]
  },
  {
    version: 'v1.5.0',
    date: 'May 15, 2026',
    summary: 'New tasks, Your List overhaul, Event Calendar, grouped/flat view, Starter Guide',
    entries: [
      { type: 'content', text: 'World Quests and Rare Elite kills added to World Events section', detail: 'Both reward Adventurer-level gear (ilvl 220–237). World Quests are daily; Rare Elites are opportunistic kills while doing open-world content.' },
      { type: 'content', text: 'Prey System expanded — Normal, Hard, and Nightmare difficulty hunts each tracked separately', detail: 'Normal and Hard have +/− goal trackers capped at 2 per week. Nightmare uses a 3-kill tracker matching the weekly quest requirement. All three difficulties show milestone notes.' },
      { type: 'content', text: 'Delves reworked — Trovehunter\'s Bounty replaces the old "complete highest tier" task; Bountiful Delves get a 4-run goal tracker', detail: 'Trovehunter\'s Bounty is a single weekly checkbox. Bountiful Delves show milestone notes and include an inline T1–T11 tier selector that persists per character.' },
      { type: 'content', text: 'Crafting / Dawncrest empowerment task added to Currency & Upgrades', detail: 'Covers all three Dawncrest tiers (Adventurer, Veteran, Hero) with a reminder to spend at 80+.' },
      { type: 'new',     text: 'Event Calendar — standalone events.html page with live and upcoming world events', detail: 'LIVE / SOON / past-dimmed badges on each card. Filter by All, Upcoming, World, PvP, Dungeons, Delves. Grouped by month. Covers May 2026 through mid-2027. Shares midnight.css and persists light/dark preference.' },
      { type: 'new',     text: 'Inline event strip in reset bar — shows current live event or next upcoming event with days-until countdown and a 📅 All Events button', detail: 'Positioned left-justified on the history line, aligned with the weekly reset text.' },
      { type: 'new',     text: '⊞ Grouped / ☰ Flat List toggle — left of the search bar, applies to all views', detail: 'Grouped mode (default): sections render as collapsible cards with headers. Flat mode: all visible tasks merged into one scrollable list with no section dividers. Your List view also respects this toggle, with tasks sorted by saved drag order.' },
      { type: 'new',     text: 'Your List — grouped by section with sub-headers when in Grouped mode', detail: 'Each section group shows its icon, title, and done/total count. Done tasks sort to the bottom within each group independently.' },
      { type: 'new',     text: '🧭 Starter Guide — preset task lists for four progression stages', detail: 'Fresh 80, Early Gearing, Progressing, and Solo Endgame presets. Each auto-populates Your List with the most efficient solo-friendly tasks for that stage. Endgame preset includes Heroic and Mythic raids. Selecting a stage exits edit mode and takes you directly to Your List.' },
      { type: 'new',     text: 'Your List edit mode redesigned — Edit List button stays on Your List tab showing remove controls', detail: 'In edit mode on the Your List tab, each task shows a red ✕ Remove button. Switch to any other tab to see the full master list with ⭐/☆ highlight toggles for adding tasks.' },
      { type: 'new',     text: 'Edit bar (yellow) shown in both Your List and master list views while editing', detail: 'Contains: 🧭 Starter Guide, Copy to character dropdown, Clear All, and ✓ Done. The bar is identical in both views.' },
      { type: 'new',     text: 'Copy List to Character — select a specific character or All characters from a dropdown in the edit bar', detail: 'Replaces the old "Apply to All" toolbar button. Only visible when multiple characters exist.' },
      { type: 'new',     text: 'Goal trackers (+/− counters with milestone notes) now visible on all section views, not just Your List', detail: 'Previously the +/− tracker only appeared when tasks were added to Your List. Fixed by adding goal rendering to the main section render path.' },
      { type: 'improve', text: '⭐ Edit List button always visible in the top bar regardless of active tab, styled gold to match the Your List tab', detail: 'Previously only appeared when the Your List tab was active. Now accessible from any tab so users can jump into editing from anywhere.' },
      { type: 'improve', text: 'Text color improved across task cards, section tabs, and event calendar dates', detail: 'Italic descriptions, inactive filter tabs, section meta text, and event date/duration text all use --text-secondary (#9d90b8). All hardcoded hex values replaced with the CSS variable for consistent theming.' },
      { type: 'fix',     text: 'Edit mode master list was blank — caused by nested template literals inside innerHTML assignments being silently truncated by the browser', detail: 'Rebuilt all task HTML rendering functions (sectionTaskHtml, ylTaskHtml, ylEditTaskHtml, renderCustomSection, renderTierSelector, section headers) using pure string concatenation with no nested backticks.' },
      { type: 'remove',  text: 'Event Calendar removed from the main task list — moved to standalone events.html', detail: 'The Event Calendar filter tab is removed from the tracker. All 50+ events live in events.html with a richer card layout.' },
      { type: 'remove',  text: '"Apply to All" toolbar button removed', detail: 'Replaced by the Copy to Character dropdown in the edit bar.' },
    ]
  },
  {
    version: 'v1.4.0',
    date: 'May 14, 2026',
    summary: 'Raid boss tracking, task search, mobile fixes',
    entries: [
      { type: 'new',     text: 'Raid boss bubble tracker — all three Season 1 raids with per-difficulty boss kill tracking', detail: 'The Dreamrift (1 boss), The Voidspire (6 bosses), and March on Quel\'Danas (2 bosses) each have LFR / Normal / Heroic / Mythic rows. Click a boss bubble to mark it killed. Task auto-checks when all bosses are cleared. Right-click any bubble to open its Icy Veins guide. Boss kills reset weekly with task progress.' },
      { type: 'new',     text: 'Difficulty badges — LFR (purple), Normal (green), Heroic (blue), Mythic (gold) — matching in-game color language', detail: '' },
      { type: 'new',     text: 'Task search bar — live search across all tabs including Your List', detail: 'Searches task name, description, and section title. Sections with no matches are hidden. Sections with matches auto-expand. Matched text highlighted in purple. Result count shown ("12 of 47 tasks"). Escape clears search. Boss bubbles hidden in compact mode.' },
      { type: 'fix',     text: 'Conditional toolbar buttons (Show Hidden, Edit List, Apply to All) no longer push other buttons off-screen', detail: 'Switched from visibility:hidden (holds space) to display:none (takes no space). Wrapped in a display:contents group so the flex row gap remains consistent.' },
      { type: 'fix',     text: 'Edit List button hidden while in edit mode — the inline Done button handles exiting, no duplicate control needed', detail: '' },
      { type: 'fix',     text: 'Mobile layout — reset bar now stacks properly on narrow screens', detail: 'Progress bar stretches to fill width. Buttons wrap into rows. Invisible conditional buttons use display:none so they leave no ghost gaps on mobile.' },
      { type: 'fix',     text: 'History stat boxes moved to right side of history strip, sparkline bars on the left', detail: '' },
      { type: 'improve', text: 'Raid section rebuilt from scratch — replaced 5 generic tasks with 12 targeted rows (3 raids × 4 difficulties) plus the Bazaar weekly quest', detail: 'Old tasks: LFR Wings 1–3, Normal/Heroic, Bazaar quest. New tasks: per-raid per-difficulty rows with full boss lists sourced from Icy Veins.' },
    ]
  },
  {
    version: 'v1.3.0',
    date: 'May 14, 2026',
    summary: 'Dashboard redesign, inline history, alt overview',
    entries: [
      { type: 'new',     text: 'Inline weekly history strip — embedded in the reset bar, no modal required', detail: 'Sparkline bars for up to 12 weeks (current + 11 past). Each bar is color-coded by completion tier. Current week pulses. Hover any bar for exact date and done/total.' },
      { type: 'new',     text: 'History stat boxes — Weeks Tracked, Streak 🔥, Best Week, Avg Completion shown inline alongside the sparkline', detail: 'Replaces the former History modal breakout window. All stats update automatically when switching characters.' },
      { type: 'new',     text: 'Auto-snapshot on week rollover — all characters are snapshotted silently when a new reset week is detected on page load', detail: 'Stored per-character under wow_mn_history_{char}. Capped at 52 entries (~1 year). No action required from the user.' },
      { type: 'new',     text: 'All Alts tab inside Summary modal — shows every character\'s weekly completion at a glance', detail: 'Class icon, class color border, streak flame, and done/total progress bar per alt. Click any row to switch to that character.' },
      { type: 'improve', text: 'Reset bar restructured into two rows — info/progress/buttons on top, history strip on bottom', detail: 'Buttons reordered: Light · Compact · What\'s Next? · Summary · Reset Week · Data. Buttons are now right-aligned to the frame edge.' },
      { type: 'improve', text: 'Button layout stabilized — no more reflow when label text changes (e.g. Compact → Full)', detail: 'Conditional buttons (Show Hidden, Edit List, Apply to All) now use visibility:hidden instead of display:none so they hold their space.' },
      { type: 'remove',  text: 'Alts toolbar button removed — functionality merged into Summary modal All Alts tab', detail: '' },
      { type: 'remove',  text: 'History toolbar button removed — replaced by inline history strip in reset bar', detail: '' },
      { type: 'remove',  text: 'Patch Notes page and toolbar link removed', detail: 'Live RSS feed could not load in browser due to Content Security Policy restrictions.' },
    ]
  },
  {
    version: 'v1.2.1',
    date: 'May 14, 2026',
    summary: 'Class system, UX fixes',
    entries: [
      { type: 'new',     text: 'Class selection on character create/edit — all 13 WoW classes with official colors', detail: 'Class color dot appears on the character button in the char bar for quick identification.' },
      { type: 'new',     text: 'Class resource quick-links bar — appears below char bar when a class is set', detail: 'Links to Icy Veins, Murlok.io, Wowhead, and Blizzard class pages. All URLs corrected to proper guide pages.' },
      { type: 'fix',     text: 'Icy Veins class links corrected — singular /wow/mage-guide not /mage-guides', detail: '' },
      { type: 'fix',     text: 'Murlok.io links corrected — murlok.io/death-knight, murlok.io/mage etc.', detail: 'Previously linked to murlok.io root.' },
      { type: 'fix',     text: 'Wowhead class links corrected — wowhead.com/guides/classes#deathknight anchor format', detail: 'Hyphens stripped from class name for the anchor hash.' },
      { type: 'fix',     text: 'Weekly reset countdown no longer shifts layout as timer ticks', detail: 'Switched to Courier New monospace font so all digits occupy equal width. reset-info section locked to min-width to prevent reflow.' },
      { type: 'fix',     text: 'Checkbox restricted to checkbox area only — clicking task name, description, or tags no longer toggles completion', detail: 'Task card is now cursor:default. Only the checkbox square is interactive.' },
    ]
  },
  {
    version: 'v1.2.0',
    date: 'May 14, 2026',
    summary: 'Notes, dark/light mode, compact view, confetti, summary modal, export/import',
    entries: [
      { type: 'new',     text: 'Task Notes — 📝 button on every task to jot personal reminders', detail: 'Notes are per-character, auto-save as you type, never reset weekly, included in export/import, and hidden in compact mode. A gold 📝 indicates a task has a note.' },
      { type: 'new',     text: 'Dark / Light mode toggle — ☀️ Light button in toolbar', detail: 'Switches to a soft lavender light theme. Preference saved to localStorage and persists across sessions.' },
      { type: 'new',     text: 'Compact mode — ⊟ Compact button hides task descriptions and tags', detail: 'Shows roughly 2–3x more tasks on screen. Button turns purple when active. State persists across sessions.' },
      { type: 'new',     text: '🎲 What\'s Next? — randomly highlights an uncompleted task from Your List', detail: 'Scrolls to and pulses the task with a gold glow. Falls back to any uncompleted task if Your List is empty. Fires full celebration if everything is done.' },
      { type: 'new',     text: 'Confetti engine — particle burst on task completion', detail: 'Bursts from the task position on check. Fires a full-screen multi-point celebration when the last task for the week is completed. Void purples, golds, and pale whites. No external libraries.' },
      { type: 'new',     text: 'Weekly Summary modal — 📊 button shows per-section progress bars', detail: 'Each section shows done/total with a fill bar. Completed sections turn green. Overall progress shown at the bottom with percentage.' },
      { type: 'new',     text: 'Export / Import character data — ⇅ Data button', detail: 'Export current character or all characters as JSON. Import restores progress, custom tasks, hidden tasks, notes, and Your List. Preview shown before confirming overwrite.' },
      { type: 'new',     text: 'Apply Your List to all characters', detail: 'One-click copies current character\'s Your List to every other character.' },
      { type: 'improve', text: 'Font sizes increased across the board and tracker widened to 1400px', detail: 'Body base 17→19px, task names 15→17px, section titles 14→16px, tabs 11→13px, tags 10→12px. Fills a 1920px monitor with comfortable margins.' },
      { type: 'improve', text: 'Section header borders always visible (border-bright)', detail: 'Previously only appeared on hover. Hover now lightens background instead.' },
      { type: 'fix',     text: 'Notes appear in Your List view — previously only showed on master list', detail: '' },
    ]
  },
  {
    version: 'v1.1.0',
    date: 'May 13, 2026',
    summary: 'Launch day — multi-character, Your List, custom tasks, task hiding, full content pass',
    entries: [
      { type: 'content', text: 'Tracker fully rebuilt from real Patch 12.0.5 data sourced from Icy Veins and Wowhead', detail: 'Guide last updated May 4, 2026. All speculative content removed. No raid content by design.' },
      { type: 'content', text: 'Voidforge, Void Assaults, Ritual Sites, Bazaar Quests, Prey, Saltheril\'s Soiree, Stormarion Assault, Legends of the Haranir, and Abundance all added as confirmed 12.0.5 content', detail: '' },
      { type: 'new',     text: 'Void Assaults split into three separate tabs: Void Assaults, Ritual Sites, Voidforge', detail: 'Each independently filterable and combinable in multi-select mode.' },
      { type: 'new',     text: 'Event Calendar tab — 50+ upcoming world events with real Wowhead links', detail: 'All links use verified event IDs (e.g. /event=479/darkmoon-faire). Covers May 2026 through mid-2027.' },
      { type: 'new',     text: 'Multi-select category tabs — hold multiple filters at once', detail: 'All tab clears selections. Deselecting the last active category falls back to All.' },
      { type: 'new',     text: '⭐ Your List — personal curated task list built from the master list', detail: 'Select any tasks from any category. Stored per character. Edit mode shows ⭐/☆ selection state. Completed tasks sort to bottom.' },
      { type: 'new',     text: '✦ Custom tab — add personal tasks with name and optional description', detail: 'Persist per character, never auto-reset. Clicking a character name defaults to Custom view if they have tasks.' },
      { type: 'new',     text: 'Hide individual tasks — 🚫 button on hover, stored per character', detail: '👁 Show Hidden button appears when any tasks or sections are hidden.' },
      { type: 'new',     text: 'Hide entire sections from the All view', detail: 'Hidden sections collapse to a slim stub. Reveal with the global Show Hidden toggle.' },
      { type: 'new',     text: 'Character rename — ✏️ button migrates all localStorage data to new name', detail: 'All weekly progress, custom tasks, hidden tasks, Your List, and notes migrate automatically.' },
      { type: 'new',     text: 'Multi-character support with independent weekly progress per character', detail: '' },
      { type: 'new',     text: 'Weekly auto-reset every Tuesday at 15:00 UTC with live countdown timer', detail: '' },
      { type: 'new',     text: 'Priority dividers — Do First / Important / Optional in All view', detail: '' },
      { type: 'new',     text: 'WoW UI icons replace emoji for all 13 section types', detail: 'Embedded as base64 PNGs — no external image files required.' },
      { type: 'new',     text: 'Shared midnight.css extracted for use across tracker and changelog', detail: 'One CSS file to update for both pages.' },
      { type: 'new',     text: 'Changelog page created and linked from tracker header', detail: '' },
      { type: 'improve', text: '"Pick up quest" wording changed to "Complete quest" across all tasks', detail: '' },
      { type: 'fix',     text: 'Modals showing on page load — missing .modal-overlay CSS selector', detail: '' },
      { type: 'fix',     text: 'Sections not rendering on initial load — init call dropped during edit', detail: '' },
      { type: 'fix',     text: 'addEventListener errors — modal elements referenced before DOM was ready', detail: 'Moved all overlay listeners into a DOMContentLoaded block.' },
      { type: 'fix',     text: 'Bazaar icon missing from midnight.css after stylesheet extraction', detail: '' },
      { type: 'fix',     text: 'Mythic-Store removed from sources credit in footer', detail: '' },
    ]
  },
  {
    version: 'v1.0.0',
    date: 'May 13, 2026',
    summary: 'Initial release',
    entries: [
      { type: 'new', text: 'Initial tracker built with dark fantasy Midnight aesthetic', detail: 'Single self-contained HTML file. No server required — open in any browser.' },
      { type: 'new', text: 'Checkbox tasks with localStorage persistence per character per week', detail: 'Checks survive browser closes and reset automatically each Tuesday.' },
      { type: 'new', text: 'Collapsible sections with section-level done/total counts', detail: '' },
      { type: 'new', text: 'Progress bar showing completion for current view and character', detail: '' },
      { type: 'new', text: 'Curated by Seven — header credit, patch badge, and Changelog link', detail: 'Patch 12.0.5 · Lingering Shadows · Season 1.' },
    ]
  },
];
