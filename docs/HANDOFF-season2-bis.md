# Handoff: populate the Midnight Season 2 BiS lists

Written 2026-09-03. Delete this file once the lists are populated.

## Why this exists

The Season 2 content overhaul is complete and pushed. One piece could not be
finished: the actual Best in Slot item tables. The session that did the
overhaul ran in a cloud environment set to **Trusted** network access, which
allowlists package registries, GitHub and cloud SDKs and nothing else, so
`icy-veins.com` returned a 403 at the egress proxy for both WebFetch and curl.
Web search still worked (it does not go through the session's network), and all
the Season 2 *task* content was sourced that way, but search returns
synthesized prose, not tables. Transcribing 80 lists from search fragments
would have meant inventing item names on a BiS tracker, so the data was left
empty and the plumbing built around it instead.

If you are reading this in a session whose environment allows
`icy-veins.com`, that blocker is gone. Verify before starting:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://www.icy-veins.com/wow/frost-mage-pve-dps-gear-best-in-slot
```

A `200` means you are clear. A `403`, or `curl: (56) CONNECT tunnel failed`,
means the environment still has not picked up the change. Configuration is
read once at session startup, so a session started before the change was saved
will still be blocked; start a fresh one rather than retrying. Do not try to
route around a policy denial.

## Repo state

- Repo: `7Donuts/wowWeekly`
- Branch: `claude/wow-midnight-s2-overhaul-z2q992` (pushed, no PR opened)
- Base commit for the overhaul: `43d72ab` "Rebuild site content for Midnight
  Season 2 (Patch 12.1)"

Do all work on that same branch. Do not open a PR unless asked.

## What is already done (do not redo)

- `js/data-tasks.js`: 132 tasks in 21 sections rebuilt for Patch 12.1. Every
  section carries `season: 1` or `season: 2`; every task carries a `cadence` of
  `daily`, `weekly` or `longterm`. Four genuinely new 12.1 sections carry
  `isNew: true`.
- `js/app.js`: Season 1 hide toggle (`hideSeason1`, default hidden, persisted in
  `wow_mn_hide_s1`), routed through `activeSections()` so it applies to panels,
  rail counts, the progress bar, Your List and the weekly summary at once.
  Cadence rail views. BiS mode switch. Season 2 Mythic+ Great Vault item levels.
- `js/data-bis.js`: Season 1 items erased; dual-list structure in place for all
  40 specs; `icyVeinsBisUrl()` builds the correct per-spec, per-role URL.
- `js/data-item-ids.js`: emptied (every entry was a Season 1 item).
- `patchnotes.html`, `index.html`, `events.html`, `js/data-events.js`,
  `js/data-changelog.js`, `midnight.css`: updated. Changelog entry is `v3.0.0`.

## The remaining task

Fill in `BIS_DATA` in `js/data-bis.js`. 13 classes, 40 specs, two lists each,
so 80 lists.

### Structure

```js
BIS_DATA[classKey][specKey] = {
  raid:  [ { slot, item, source, location }, ... ],
  mplus: [ { slot, item, source, location }, ... ],
}
```

- `raid` is Icy Veins' true BiS: the strongest setup across every Season 2
  source, mixing The Venomous Abyss, crafted pieces and Mythic+ drops. Icy
  Veins prefers raid items where they tie, because they are easier to target.
- `mplus` is their Mythic+ and crafted list: the strongest setup reachable
  without entering the raid.

On each gear page the first table is the raid list and the Mythic+ table is
second. If a page publishes only one list, put it in `raid` and leave `mplus`
empty rather than duplicating it. The UI handles an empty list per mode and
falls back to a deep link, so a partial transcription is safe to ship.

### Slot strings

Each `slot` must be one of these 16 strings, matching `_BIS_DOLL_SLOTS` in
`js/app.js` character for character:

```
Head, Neck, Shoulders, Back, Chest, Wrists, Main Hand, Off Hand,
Hands, Waist, Legs, Feet, Ring 1, Ring 2, Trinket 1, Trinket 2
```

A slot string outside that set renders nothing on the gear board, silently.

Array order does not matter for the gear board: `renderBisGrid` looks slots up
by name and places them in fixed positions. It only sets the row order in the
import list, so transcribe in whatever order the source page uses. Specs with
no off-hand simply omit that row; do not pad with a placeholder.

### Item names

`item` must match the keys in `js/data-item-ids.js` verbatim, apostrophes and
capitalisation included, for icons to resolve by ID. Items missing from that
map still resolve via a slower name search that occasionally picks the wrong
item when names collide across expansions, so add an explicit ID for anything
ambiguous. Item IDs are the numeric part of a Wowhead item URL, which needs
`wowhead.com` allowed too.

### URLs

`icyVeinsBisUrl(classKey, specKey)` in `js/data-bis.js` generates these. The
pattern is:

```
https://www.icy-veins.com/wow/{spec-slug}-{class-slug}-pve-{role}-gear-best-in-slot
  role: dps | tank | healing
```

Note the role segment: an earlier version of this code hardcoded `-pve-dps-`
for every spec, so every tank and healer link was broken. Tanks use `-pve-tank-`
and healers `-pve-healing-`. Beast Mastery's slug is hyphenated
(`beast-mastery`); every other spec key maps 1:1.

All 40 pages:

| Class | Spec | Role | URL |
| --- | --- | --- | --- |
| Death Knight | Blood | tank | https://www.icy-veins.com/wow/blood-death-knight-pve-tank-gear-best-in-slot |
| Death Knight | Frost | dps | https://www.icy-veins.com/wow/frost-death-knight-pve-dps-gear-best-in-slot |
| Death Knight | Unholy | dps | https://www.icy-veins.com/wow/unholy-death-knight-pve-dps-gear-best-in-slot |
| Demon Hunter | Havoc | dps | https://www.icy-veins.com/wow/havoc-demon-hunter-pve-dps-gear-best-in-slot |
| Demon Hunter | Vengeance | tank | https://www.icy-veins.com/wow/vengeance-demon-hunter-pve-tank-gear-best-in-slot |
| Demon Hunter | Devourer | dps | https://www.icy-veins.com/wow/devourer-demon-hunter-pve-dps-gear-best-in-slot |
| Druid | Balance | dps | https://www.icy-veins.com/wow/balance-druid-pve-dps-gear-best-in-slot |
| Druid | Feral | dps | https://www.icy-veins.com/wow/feral-druid-pve-dps-gear-best-in-slot |
| Druid | Guardian | tank | https://www.icy-veins.com/wow/guardian-druid-pve-tank-gear-best-in-slot |
| Druid | Restoration | heal | https://www.icy-veins.com/wow/restoration-druid-pve-healing-gear-best-in-slot |
| Evoker | Augmentation | dps | https://www.icy-veins.com/wow/augmentation-evoker-pve-dps-gear-best-in-slot |
| Evoker | Devastation | dps | https://www.icy-veins.com/wow/devastation-evoker-pve-dps-gear-best-in-slot |
| Evoker | Preservation | heal | https://www.icy-veins.com/wow/preservation-evoker-pve-healing-gear-best-in-slot |
| Hunter | Beast Mastery | dps | https://www.icy-veins.com/wow/beast-mastery-hunter-pve-dps-gear-best-in-slot |
| Hunter | Marksmanship | dps | https://www.icy-veins.com/wow/marksmanship-hunter-pve-dps-gear-best-in-slot |
| Hunter | Survival | dps | https://www.icy-veins.com/wow/survival-hunter-pve-dps-gear-best-in-slot |
| Mage | Arcane | dps | https://www.icy-veins.com/wow/arcane-mage-pve-dps-gear-best-in-slot |
| Mage | Fire | dps | https://www.icy-veins.com/wow/fire-mage-pve-dps-gear-best-in-slot |
| Mage | Frost | dps | https://www.icy-veins.com/wow/frost-mage-pve-dps-gear-best-in-slot |
| Monk | Brewmaster | tank | https://www.icy-veins.com/wow/brewmaster-monk-pve-tank-gear-best-in-slot |
| Monk | Mistweaver | heal | https://www.icy-veins.com/wow/mistweaver-monk-pve-healing-gear-best-in-slot |
| Monk | Windwalker | dps | https://www.icy-veins.com/wow/windwalker-monk-pve-dps-gear-best-in-slot |
| Paladin | Holy | heal | https://www.icy-veins.com/wow/holy-paladin-pve-healing-gear-best-in-slot |
| Paladin | Protection | tank | https://www.icy-veins.com/wow/protection-paladin-pve-tank-gear-best-in-slot |
| Paladin | Retribution | dps | https://www.icy-veins.com/wow/retribution-paladin-pve-dps-gear-best-in-slot |
| Priest | Discipline | heal | https://www.icy-veins.com/wow/discipline-priest-pve-healing-gear-best-in-slot |
| Priest | Holy | heal | https://www.icy-veins.com/wow/holy-priest-pve-healing-gear-best-in-slot |
| Priest | Shadow | dps | https://www.icy-veins.com/wow/shadow-priest-pve-dps-gear-best-in-slot |
| Rogue | Assassination | dps | https://www.icy-veins.com/wow/assassination-rogue-pve-dps-gear-best-in-slot |
| Rogue | Outlaw | dps | https://www.icy-veins.com/wow/outlaw-rogue-pve-dps-gear-best-in-slot |
| Rogue | Subtlety | dps | https://www.icy-veins.com/wow/subtlety-rogue-pve-dps-gear-best-in-slot |
| Shaman | Elemental | dps | https://www.icy-veins.com/wow/elemental-shaman-pve-dps-gear-best-in-slot |
| Shaman | Enhancement | dps | https://www.icy-veins.com/wow/enhancement-shaman-pve-dps-gear-best-in-slot |
| Shaman | Restoration | heal | https://www.icy-veins.com/wow/restoration-shaman-pve-healing-gear-best-in-slot |
| Warlock | Affliction | dps | https://www.icy-veins.com/wow/affliction-warlock-pve-dps-gear-best-in-slot |
| Warlock | Demonology | dps | https://www.icy-veins.com/wow/demonology-warlock-pve-dps-gear-best-in-slot |
| Warlock | Destruction | dps | https://www.icy-veins.com/wow/destruction-warlock-pve-dps-gear-best-in-slot |
| Warrior | Arms | dps | https://www.icy-veins.com/wow/arms-warrior-pve-dps-gear-best-in-slot |
| Warrior | Fury | dps | https://www.icy-veins.com/wow/fury-warrior-pve-dps-gear-best-in-slot |
| Warrior | Protection | tank | https://www.icy-veins.com/wow/protection-warrior-pve-tank-gear-best-in-slot |
## Season 2 landmarks, for sanity-checking a transcription

If a page you fetch names Season 1 content (Voidspire, Dreamrift, March on
Quel'Danas, Sporefall, Voidcores, Dawncrest, "12.0.x", ilvl in the 220 to 300
band), you have a stale or cached page. Season 2 should reference:

- Raid: The Venomous Abyss, 8 bosses: Nek'zali, Entombed Sentinels, Lost
  Explorers, Vashnik, Sszorak, Twin Fangs, Coiled Altar, Ula'tek
- Lair: The Tidebound Grotto (raid-level loot, feeds the Raid Vault row)
- Mythic+ pool: Altar of Fangs, Murder Row, Den of Nalorakk, The Blinding Vale,
  Voidscar Arena, King's Rest, Temple of Sethraliss, Ruby Life Pools
- Tier token: Slumbering Coil Curio from Ula'tek, traded to Kirana in Silvermoon
- Upgrade currency: Mistcrests (five tiers), Venomblight Manaflux for the
  Catalyst, Ascendant Venomstones past the Myth ceiling
- Item levels: standard tracks run 266 to 334; the last two Mythic Venomous
  Abyss bosses reach 344
- Known Very Rare weapons: Zatha'tek and Jan'thrazet, the Soul Fang (Ula'tek),
  Maze-roa, Warlord's Fury (Coiled Altar)
- Known top trinkets seen in Season 2 rankings: Vexhul's Everflowing Gland and
  Gebbo's Bottomless Bag (The Venomous Abyss), Wavecaller's Seastone (The
  Tidebound Grotto)

Icy Veins flags some 12.1 gear pages as partially placeholder because
embellishments were untestable at the time of writing. Transcribe what is
published; do not fill gaps with guesses. An empty list is correct behaviour
here, an invented item name is not.

## Validation

Run all of these before committing.

Syntax:

```bash
node --check js/data-bis.js && node --check js/data-item-ids.js && node --check js/app.js
```

Data integrity (task data, unchanged by this work but cheap to re-verify):

```bash
node -e "
const fs=require('fs');
const raw=fs.readFileSync('js/data-tasks.js','utf8');
eval(raw.replace(/function openBeginnerPreset[\s\S]*\$/,'')+'\n;globalThis.S=SECTIONS;globalThis.B=BEGINNER_STAGES;');
const ids=new Set(),dupes=[];
globalThis.S.forEach(s=>s.tasks.forEach(t=>{if(ids.has(t.id))dupes.push(t.id);ids.add(t.id);}));
console.log('tasks:',ids.size,'dupes:',dupes.length?dupes:'none');
const miss=[];globalThis.B.forEach(st=>st.tasks.forEach(i=>{if(!ids.has(i))miss.push(st.id+':'+i);}));
console.log('beginner refs missing:',miss.length?miss:'none');
"
```

BiS slot strings match the character sheet, and no list is half-filled:

```bash
node -e "
const fs=require('fs');
const raw=fs.readFileSync('js/data-bis.js','utf8');
eval(raw.slice(raw.indexOf('const WOW_CLASSES'))+'\n;globalThis.D=BIS_DATA;globalThis.WC=WOW_CLASSES;');
const app=fs.readFileSync('js/app.js','utf8');
const L=JSON.parse(app.match(/_BIS_DOLL_LEFT\s*=\s*(\[[^\]]*\])/)[1].replace(/'/g,'\"'));
const R=JSON.parse(app.match(/_BIS_DOLL_RIGHT\s*=\s*(\[[^\]]*\])/)[1].replace(/'/g,'\"'));
const valid=new Set([...L,...R]);
let filled=0,empty=0,bad=[];
globalThis.WC.forEach(c=>c.specs.forEach(sp=>{
  ['raid','mplus'].forEach(m=>{
    const rows=(globalThis.D[c.key]&&globalThis.D[c.key][sp.key]&&globalThis.D[c.key][sp.key][m])||[];
    if(!rows.length){empty++;return;}
    filled++;
    rows.forEach(r=>{
      if(!valid.has(r.slot)) bad.push(c.key+'/'+sp.key+'/'+m+': bad slot \"'+r.slot+'\"');
      if(!r.item||!r.source) bad.push(c.key+'/'+sp.key+'/'+m+': missing item or source');
    });
  });
}));
console.log('lists filled:',filled,'| empty:',empty,'| of 80');
console.log('problems:',bad.length?bad.slice(0,20):'none');
"
```

Icon classes (the stylesheet ships a subset, an undeclared class renders as
nothing):

```bash
bash tools/check-icons.sh
```

Browser smoke test. Playwright and Chromium are preinstalled; do not run
`playwright install`. Serve the directory and drive it:

```bash
npx --yes http-server -p 8199 -s &
sleep 3
```

Then in a `.mjs` file, `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`,
load `http://127.0.0.1:8199/index.html`, and check:

- No `pageerror` events. Two 404s on `/api/reset-time` and `/api/user` are
  expected on a static server; those endpoints live in the Cloudflare Worker.
- `openBisModal()` then `_bisPickClass(...)` then `_bisPickSpec(...)` renders
  rows, and the two `.bis-mode-btn` counts match the array lengths.
- `_bisSetMode('mplus')` re-renders and persists to `localStorage`
  (`wow_mn_bis_mode`).
- `_bisImportSelected()` creates custom tasks named `[Slot] Item Name` and adds
  them to Your List.
- The modal uses `classList.add('open')`, not an inline `display` style. Setting
  `style.display = 'none'` on `.modal-overlay` in a test will override the class
  and make the modal appear not to open.

## House rules

- No em dashes anywhere. Use commas, parentheses, semicolons or separate
  sentences. The whole repo is currently clean of them; keep it that way.
  Check with `grep -c $'\u2014' <file>`, which should return 0.
- Bold only where it materially aids comprehension, not for emphasis.
- Bump the `?v=` cache-bust query on the changed `<script>` and `<link>` tags in
  `index.html` when shipping (currently `v=1.11.0`).
- Add a `js/data-changelog.js` entry for the work. Newest first; the current top
  entry is `v3.0.0`.
- Commit messages end with the co-author trailer already used on `43d72ab`.
  Never put a model identifier in a commit message, PR body or code comment.
- Push with `git push -u origin claude/wow-midnight-s2-overhaul-z2q992`.

## Suggested order

1. Verify egress with the curl above.
2. Fetch one page end to end (Frost Mage is a good probe, it has both lists) and
   confirm the two tables parse the way this doc describes before scaling up.
3. Work class by class. Commit every few classes rather than in one 80-list
   commit, so a bad transcription is easy to isolate.
4. Collect item IDs from Wowhead as you go and add them to
   `js/data-item-ids.js`. Icons are the main reason to bother.
5. Run the full validation set, add the changelog entry, bump the cache-bust,
   push.
6. Delete this file.
