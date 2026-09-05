# Cross-platform integration: Party Ledger, The Azeroth Agenda, Tabard

One member, three programs, one Battle.net account. This document is the
contract between them. It is copied verbatim into all three repositories;
change it in one and copy it to the other two in the same change.

## The three programs

| Repo | What it is | Runs where |
|---|---|---|
| `rateaplayer` (Party Ledger) | WoW addon, Lua 5.1 | The game client |
| `wowWeekly` (The Azeroth Agenda) | Static site + Worker, D1 and KV | `agenda.7donuts.dev` |
| `tabard` (Guild Identity) | Discord bot, Worker, D1 | `tabard.7donuts.dev` |

Tabard reads the Agenda; the Agenda never calls Tabard. One direction, so
there is only one shared secret and only one side that has to be reachable.

## The join key

Both the Agenda and Tabard authenticate the member through Battle.net OAuth,
and both already keep the opaque `sub` from `/userinfo`:

- Agenda: `sub` is the JWT subject and the KV key (`user:<sub>`).
- Tabard: `bnet_account.bnet_sub` -> `identity_id` -> `discord_account.discord_user_id`.

So the same person is already identifiable across both without a new account
system. `sub` is the join key. Nothing in this integration introduces another
identity, and nothing keys on BattleTag or character name, both of which
change.

The addon has no Battle.net identity at all: it runs inside the game and knows
only characters. It is joined to the other two by the member physically
carrying its data across, in both directions (see "The addon bridge" and "The
list, going the other way"), which is also what makes it consent-bearing by
construction.

## Data flow

```
  Party Ledger (in game)
      | writes PartyLedgerBridgeDB to SavedVariables at logout/reload
      v
  SavedVariables/PartyLedger.lua on the member's disk
      | member grants read access once (File System Access API)
      v
  The Azeroth Agenda (browser)  <---- Blizzard profile API (worker, OAuth)
      | pushes into its existing KV blob, keyed by bnet sub
      v
  Agenda Worker  /api/share/*   (service token + per-member consent)
      | HTTPS, scoped, consent-gated
      v
  Tabard  ->  Discord cards
```

And back the other way, which is a separate document and a separate transport:

```
  The Azeroth Agenda (browser)
      | AGL payload: the member's own to-do list, one string
      v
  the member's clipboard
      | /ledger list import
      v
  Party Ledger  ->  the heads-up display in game
```

Every arrow is pull-based except the first, and both of the addon's arrows are
carried by the member rather than by a program. Nothing is pushed to Discord
that the member has not consented to.

The two directions answer questions only one side can answer:

| Question | Who knows | Which document |
|---|---|---|
| What did I do? | the game | PLW, addon to site |
| What am I trying to do? | the site | AGL, site to addon |

## The envelope (PLW2)

The addon produces one JSON document per export. It is what the addon knows
and the site does not.

```jsonc
{
  "fmt": "PLW2",
  "v": 2,
  "generated": 1756900000,        // unix seconds, client clock
  "addon": "0.3.0",
  "week": "2026-09-01",           // WoW week key, Tuesday 15:00 UTC
  "characters": {
    "kaelthas-area52": {          // lowercased name-realm, the addon's NameKey
      "name": "Kaelthas",
      "realm": "Area 52",
      "class": "MAGE",
      "level": 80,
      "objectives": {             // keyed by Agenda task id
        "m1": { "done": true,  "value": 8, "max": 8, "at": 1756900000 },
        "v2": { "done": false, "value": 4, "max": 6, "at": 1756900000 },
        // src is present only on a tick the member made themselves, on the
        // in-game display. Absent means the game reported it. See "Ticking a
        // box in game".
        "ci4": { "done": true, "at": 1756900100, "src": "manual" }
      },
      "bosses": {                 // keyed by Agenda task id, then boss id
        "vab_h": { "nekzali": true, "sentinels": true }
      }
    }
  },
  "collections": {                // account-wide, not per character
    "at": 1756900000,
    "mounts":       ["Ashes of Al'ar", "Invincible's Reins"],
    "toys":         ["Blazing Wings"],
    "achievements": [2336, 7520]
  },
  "agenda": {                     // which list is on the in-game display
    "sig": "2abec521",            // hash of the AGL payload currently held
    "week": "2026-09-01",
    "imported": 1756900000,
    "generated": 1756899000,      // when the site built that payload
    "characters": 2,
    "tasks": 24
  },
  "ratings": {                    // ratings THIS member authored. See "Ratings".
    "at": 1756900000,
    "authored": 214,
    "runs": 340,
    "byGrade": { "-2": 3, "-1": 9, "0": 40, "1": 120, "2": 42 },
    "recent": [
      { "name": "Bobkin", "realm": "Illidan", "class": "PALADIN",
        "grade": 2, "at": 1756800000, "tags": ["cds", "comms"],
        "content": "MYTHICPLUS", "zone": "Manaforge Omega",
        "bosses": ["Plexus Sentinel", "Nexus-King"],
        "encounters": 4 }
    ]
  },
  "stats": {                      // per-run scorecards. See "Scorecards".
    "at": 1756900000,
    "window": 10,                 // recent runs per player in this payload
    "runs": 340,                  // scorecards held locally, all players
    "measured": 210,              // how many of those carried Details numbers
    "players": [
      {
        "guid": "Player-3676-0A1B2C3D",
        "name": "Bobkin", "realm": "Illidan",
        "key": "bobkin-illidan",  // the addon's NameKey, lowercased
        "class": "PALADIN",
        "grade": 2,               // null when never graded
        "held": 34,               // runs held locally, so you know this is a window
        "career": {
          "runs": 34, "deaths": 41, "timed": 22, "upgrades": 29,
          "bestKey": 14, "bestRating": 3102,
          "avgdps": 1284000, "avghps": 41000,
          "avginterrupts": 3.2, "avgavoidable": 890000,
          "bestdps": 1710000,
          "measured": { "dps": 21, "hps": 21, "interrupts": 21, "avoidable": 21 }
        },
        "recent": [
          { "at": 1756800000, "content": "MYTHICPLUS", "zone": "Ara-Kara",
            "bosses": ["Avanoxx", "Anub'zekt", "Ki'katal the Harvester"],
            "keyLevel": 12, "difficulty": null, "upgrade": 2, "timed": true,
            "result": "completed", "role": "DAMAGER",
            "left": null,             // true when they left before the end
            "deaths": 1, "rating": 2847,
            "dps": 1310000, "hps": 0, "interrupts": 4,
            "avoidable": 720000, "taken": 8900000,
            "seconds": 1740, "source": "details",
            "scope": "overall",       // see "Scorecards"
            "runDeaths": 4 }
        ]
      }
    ]
  }
}
```

Rules:

- `fmt` and `v` are mandatory, and they are checked **as a pair**. There are
  two known pairs and no others:

  | `fmt` | `v` | Body |
  |---|---|---|
  | `PLW1` | 1 | base64 of the JSON |
  | `PLW2` | 2 | base64 of zlib of the JSON, prefixed `PLW2:` |

  A document claiming `PLW2` at version 1 is not something the addon
  produces, so it is a corrupted or hand-edited payload and is refused. Both
  pairs stay readable: an addon older than the site is a normal state, and the
  member is not the person who should have to work out which half is behind.
  The table lives in `Agenda.TRANSPORTS`-shaped constants on each side
  (`LEDGER_FORMATS` in `js/ledger.js` and `_worker.js`).
- Unknown keys are ignored, never dropped on a round trip.
- Unknown task ids in `objectives` are ignored. The Agenda's task list moves
  every patch and the addon's copy will lag it.
- Timestamps are unix seconds. `generated` is load-bearing: the Agenda decides
  which reset week a payload belongs to from that, not from `week`.
- `week` is **advisory**. The reset is not the same moment in every region and
  an addon cannot know each region's reset hour, so the label the addon
  computes may differ from the site's for the same moment. Matching labels
  would reject a payload written twenty minutes ago; matching timestamps does
  not. See "The reset week" below.
- `collections` matches on name, not id. Both the addon (`C_MountJournal`) and
  the Blizzard profile API return localized names for the same collection, and
  the Agenda's task entries already carry the name. Ids are carried as an
  optional override where one is known for certain.

### Transport

The addon writes the envelope into its own SavedVariable, base64 in a single
field so no Lua string escaping is in the path:

```lua
PartyLedgerBridgeDB = {
  ["v"] = 2,
  ["fmt"] = "PLW2",
  ["enc"] = "deflate+base64",
  ["written"] = 1756900000,
  ["summary"] = { ... },   -- plain-text counts, so the file is inspectable
  ["b64"] = "PLW2:eJx1UV9LwzAQ/y733I6kMh19GwgiDPFB8EF...",
}
```

`summary` exists so a member can read the file and see what it contains
without decoding anything. It is advisory; `b64` is authoritative.

**The transport names itself on the string.** A `b64` value beginning `PLW2:`
is deflated; one with no prefix is a PLW1 payload from before this. The prefix
is on the string rather than only in the neighbouring `fmt` and `enc` fields
so that the file path and the paste path follow one rule, and so that a member
who pastes a bare string still gets the right answer.

Two consequences that are easy to get wrong, and both of which have been:

- **The reader's pattern has to allow the colon.** A base64-only character
  class does not degrade gracefully against a prefixed value: it stops
  matching entirely, and the member is told the file contains no payload when
  the payload is right there.
- **zlib, not raw deflate.** The addon uses LibDeflate's `CompressZlib`, whose
  wrapper carries an Adler-32 checksum worth having on a path where the
  payload is copied and pasted by hand. In a browser that is
  `DecompressionStream("deflate")`; `"deflate-raw"` is the unwrapped variant
  and fails on this input. Nothing but a real payload from the other repo
  proves which one a change meant, which is why both repos carry a checked-in
  fixture produced by the other (`tests/fixtures/`).

## Two tiers, and which answers what

There are two automatic sources and they answer different questions. Neither
is a fallback for the other.

**Battle.net (`/api/armory`, `/api/collections`, `/api/characters`).** Raid
boss kills per difficulty, keystone runs this period, item level, spec, gear,
PvP rating, mounts, toys, achievements, and the roster itself. Needs nothing
installed and no reload, and refreshes whenever the member opens the page. It
is silent for anyone not signed in to Battle.net, and it can only see what
Blizzard chose to publish.

**Party Ledger (the envelope below).** Delves, world content, currencies, and
everything the ledger exists for: who you grouped with, what you thought of
them, and anything measured through Details. Sees whatever the client sees,
but only reaches the site through a file the game writes at a reload.

Everything else is the member's to tick by hand, and most of the checklist is
that. It is not a gap to be closed.

### Neither side describes the other

Each tier reports the task ids it can answer, in its own payload, under
`covers`. The site subtracts one from the other to decide what to tell the
member. Nothing on the site carries a list of what the addon can do, and
nothing in the addon carries a list of what the API can do, because either
list would be wrong the first time the opposite side gained a row.

`/api/armory` builds its declaration from the same maps that do the ticking,
so a raid added to `RAID_INSTANCE_MAP` is covered the moment it is mapped. The
addon builds its from `TaskMap:KnownTasks()`. Coverage does not depend on
anything having happened: a member who has not entered the raid is still
covered for it, because the endpoint would report the kills if there were any.

### The overlap, and who drops it

Both tiers see raid kills and keystones. The addon used to report all of them
in every envelope, which was a second copy of what the site already had from a
source that needed nothing of the member.

The site now marks them on the way out, as the `settled` field appended to
each `t` record in the AGL document (version 2). The addon reads the marks and
omits those objectives from its envelope. Two guards make that safe to do:

- **Only for the current week.** A list is a snapshot and the member may hold
  one from before the reset. Last week's "already answered" says nothing about
  this week's lockout.
- **Only where the site says done, never merely covered.** A task the API
  could answer but has not is still the addon's to report, because the API may
  simply be lagging. What is suppressed is only ever a duplicate, never an
  observation the site lacks.

Boss kills are never dropped, only task-level objectives: the site's raid
coverage is per task, and a task it counts as done can still be missing
individual kills the addon saw while Blizzard catches up.

### Whether the Battle.net tier is really the faster one

Treat this as unmeasured. Several profile endpoints refresh lazily rather than
live, and an endpoint that waits on the character logging out is no fresher
than the addon's own file, which would put its tasks on the wrong side of the
split. `/api/armory` therefore returns a `freshness` block carrying each
sub-request's `Last-Modified` age and the character's `last_login_timestamp`,
and the browser keeps a rolling sample of it (`blizzardLagReport()` in
`js/armory.js`, rendered under Diagnostics in the addon modal). An endpoint
whose lag tracks time-since-logout rather than staying flat is waiting on the
logout, and its tasks should move.

### Completed quests: read, do not tick

`/quests/completed` is fetched and surfaced, and deliberately wired to
nothing. It returns bare quest ids with no completion timestamp, so "done this
reset" and "done last year" are the same answer, which is the one distinction
this site is built on. It is separately documented as returning an incomplete
list, because a quest that 404s in the data API is dropped from the profile
result. The ids are there to be verified against a completion somebody watched
happen, which is the posture `TaskMap.lua` already takes: an unverified quest
id stays unmapped, because an invented one is a silently wrong checkbox.

## The addon bridge

WoW addons cannot make HTTP requests. There are exactly three ways data leaves
the client, and the Agenda supports two of them:

1. **SavedVariables read (primary).** The Agenda asks once for read access to
   the member's WoW folder through the File System Access API, remembers the
   handle in IndexedDB, and re-reads
   `WTF/Account/<ACCOUNT>/SavedVariables/PartyLedger.lua`. Chromium only. The
   file is only written by the game at logout or `/reload`, so the Agenda
   tells the member how old the data is rather than pretending it is live.

   The read happens on its own: on page load, on returning to the tab, and on
   a ten second poll while the tab is visible, each time comparing the file's
   `lastModified` against the last one applied. Two rules hold on every
   automatic path. It never calls `requestPermission`, only `queryPermission`,
   because a prompt raised from a timer is either unseen or spends the
   member's one chance to grant on a moment they were not looking at the page.
   And it stays silent unless the import changed something, because a poll
   that reports every time it ran is noise.
2. **Paste (fallback).** `/ledger sync` prints the same base64 string into a
   copy box. Works in every browser. The Agenda imports as soon as a string
   whose prefix names a known transport is pasted, so the button below it is a
   retry rather than a required step.

There is no third path. The addon never sees the network.

### Why the reload is in the loop, and stays there

No API flushes saved variables. The client serialises them at logout, at a
disconnect, at quit, and on a UI reload, and nowhere else; `PLAYER_LOGOUT` is
a hook for changing the table before that happens, not a way of making it
happen. The alternatives do not survive contact: the combat and chat logs are
flushed continuously but no addon can put arbitrary text in either, CVars have
the same flush semantics and are not a data channel, and retail keeps macros
on the server.

So the reload is load-bearing, and both sides make it cheap rather than
pretending it is not there. The addon's `/ledger sync` window has a write-and-
reload button, `/ledger sync auto` will do it unprompted once enough has piled
up (out of combat, outside instances, alive, announced first, off by default),
and the heads-up display and minimap tooltip both show how many changes are
not on disk yet. The site polls, so a reload in game shows up in the browser
within seconds without the member touching anything.

The inbound direction has one path only, and by choice: the member copies the
AGL string from the Agenda and runs `/ledger list import`. See "Why a paste,
and not a file" for why the file access the site already has is not used for
this.

## The list, going the other way (AGL)

The envelope above is "what did I do". This is "what am I trying to do", and
the site is the only side that can answer it: the Agenda's **Your List** is
curated by hand in a browser, and until it is handed over the addon has no
idea which of the checklist's 160-odd items the member actually picked.

Without it the addon reports on whatever it happens to observe and there is no
to-do list in game at all, which is the gap this closes.

### Why a paste, and not a file

The site already holds a directory handle for the WoW folder, so writing the
list to disk looks free. It is not, and the two obvious places are both worse
than a paste:

- **SavedVariables** are the game's to write. It rewrites `PartyLedger.lua`
  wholesale at every logout, so anything the site put there is either
  destroyed or, worse, merged into a file that also holds the member's entire
  grade database. A bad write costs them years of records.
- **Interface/AddOns** is the other place an addon reads at load, and files
  there are Lua the client executes. A browser page that can write executable
  Lua into the game's addon folder is a code-execution channel into the
  client, opened by a web origin. That it would be convenient is not a reason
  to build it.

A paste is data, it is inspectable before it is used, and the member is the
one who moves it. That is the same property that makes the inbound direction
consent-bearing by construction, and it is worth keeping in both directions.

### The document

Line-oriented, tab-separated, one record per line, the first field says what
the record is. Not JSON, and for one reason: the consumer is a WoW addon that
has no JSON parser. A hand-written one is a few hundred lines whose failure
mode on a truncated paste is an error inside a recursive descent, at a call
depth that tells the member nothing. A split on tabs cannot fail that way.

```
AGENDALIST	2
w	2026-09-01
g	1756900000
h	agenda.7donuts.dev
s	vault	1	Great Vault
s	mythicplus	2	Mythic+ Dungeons
c	kaelthas-area52	Kaelthas	area-52
t	v2	vault	weekly	6	bosses	0	4	Fill the Raid row: 2 / 4 / 6 boss kills	0
t	v1	vault	weekly	0		1	0	Open your Great Vault	0
t	m1	mythicplus	weekly	8	runs	1	8	Complete 8 Mythic+ keys	1
```

| Record | Fields |
|---|---|
| `AGENDALIST` | document version |
| `w` | the site's week key |
| `g` | generated, unix seconds |
| `h` | the host that produced it |
| `s` | section id, priority, title |
| `c` | character key, display name, realm slug |
| `t` | task id, section id, cadence, goal max, goal label, done (0/1), value, name, settled (0/1) |

`settled` is document version 2. It means the Battle.net tier has already
answered this task for this character, so the addon need not report it back;
see "The overlap, and who drops it". It is set only where the site has the
task **done** from that tier, never merely where the tier covers it, and the
addon additionally refuses to believe it on a list from another week. A
version 1 document has no such field and every task reads as unsettled, which
is what the addon did before it existed.

Rules:

- The `AGENDALIST` header is the **document** version. It is separate from the
  transport prefix below, so "which shape is this" and "how is it packed"
  cannot be confused for one another. (In PLW they share a name, and that is
  what produced the confusion the transport rules above now spell out.)
- A version **higher** than the reader knows is refused, not guessed at.
- An **unknown record prefix is skipped**, not fatal. A newer site adding a
  record type is the expected case and refusing the document over it would
  break every member on an older addon. For the same reason a `t` record may
  grow fields on the end: a reader that stops early still gets what it knows.
- Field order on `t` is the contract, because the addon indexes it
  positionally. Reordering it is a display with the goal in the name column,
  and nothing on either side would say so. Both repos carry a fixture from the
  other to catch exactly that.
- `t` records appear **grouped by section, in section order**, so the addon
  draws the payload as it arrives rather than re-deriving an order the site
  already decided. Within a section the order is the site's own: finished
  tasks sink, and the rest keep whatever order the member dragged them into.
- A `t` record before any `c` is an error. Silently dropping it would show the
  member a short list and no reason for it.
- The character key is the **addon's** key (`ledgerCharKey`, lowercased
  name-realm with spaces, apostrophes and hyphens stripped from the realm), so
  the addon can match the list to whoever is logged in without being taught
  the site's naming.
- Only starred tasks go in, and **hidden ones stay out**. Hiding a task is the
  member saying they are not doing it; putting it on a heads-up display is the
  opposite of what hiding it meant. This is the same filter the Discord card
  applies.
- `done` and `value` are the site's state **at the moment of export**, so the
  display is right the instant it is imported rather than showing a week of
  finished work as still to do. They are not authority and they age. See
  "What the list is not" below.
- Names are sanitised on the way out: tabs and newlines become spaces, and
  `|` becomes `/`. The pipe is WoW's own escape character, so a literal one in
  a display string starts a colour or texture code and eats what follows.
  Names are also cut to 120 characters, because the addon draws them in a
  fixed-width row. Checklist names contain none of these; custom tasks are
  typed by the member and can contain all of them.
- An import **replaces** whatever the addon held. What a member means by
  re-importing is always "this is the list now", and merging would need a rule
  for a task that is in the old list and not the new one.

### Transport

Mirrors PLW deliberately: one rule for both directions.

| Prefix | Body |
|---|---|
| `AGL1:` | base64 of the text |
| `AGL2:` | base64 of zlib of the text |

The site emits `AGL2` where the browser has `CompressionStream` and `AGL1`
where it does not: a longer paste is a worse experience, and handing the
member nothing because the compressor is missing is no experience at all. The
addon reads both. Base64 is taken over the **UTF-8 bytes**, not the string:
`btoa` refuses anything above U+00FF and the checklist is full of curly
apostrophes.

The addon refuses a payload over **128KB**, a document over **256KB** once
inflated, or more than **4000 records**. These are not a security boundary:
the string is one the member pasted themselves, copied from a site they chose
to open, so there is no attacker who can put anything in here. They are there
because Lua's inflate and the addon's parse loop are both pure Lua, and an
accidental paste of something enormous otherwise freezes the client with no
explanation. The whole 160-item checklist is roughly 20KB of text, about 7KB
compressed, so the ceilings are far above anything the site should ever
produce. If a future list could approach them, the fix is on the site: send
one character's list rather than every character's.

### What the list is not

It is not a second source of truth. It carries the site's state so the display
starts out right, and after that it ages: a task ticked on the site an hour ago
still reads unticked in game. That is a property of a paste, not a defect to
engineer around, which is why the display says how old the list is instead of
implying it is live.

So the addon reports one thing about it and nothing more: **which list it
holds**, as the `agenda.sig` hash in the envelope. The site compares that
against the list as it currently stands and can then tell the member that the
display in front of them is showing a list they have since changed. Without
it, "why isn't my new task in the heads-up display" has no answer anywhere.

The site keeps a second signature beside it, locally, and the two must not be
conflated. `agenda.sig` is what the addon confirms it holds, and it can only
be refreshed by an inbound envelope, which needs a `/reload`. The other is
what the site last put on the member's clipboard. With only the first, a
member who copies their list is told it is out of date until they log out and
sync: precisely wrong, at the moment they have just done what was asked of
them. So a copy reads as *pending*, an envelope confirming it supersedes and
clears the pending record, and a list edited again without ever being pasted
still goes stale. The second signature is site-local state and never travels.

The hash is djb2 over the payload bytes, reduced modulo 4294967291, printed as
eight hex digits. Deliberately not a bitwise hash: the addon computes it in
Lua 5.1, where arithmetic is doubles and a 32-bit rotate is a library call
that may or may not be present in a given client. Multiply-and-mod is exact in
both languages at these magnitudes, so the two implementations cannot drift.
It resists nothing and does not need to; its only job is "same list or not".

The list itself never travels back. Returning the site its own data for it to
diff against itself is not what the hash is for.

### Ticking a box in game

The display is additive, and only additive:

- A member can tick a row the game did not notice. That is recorded as theirs
  (`manual`), travels back in the envelope as `src: "manual"`, and the site
  labels it differently from an observed tick, because "I did this" and "the
  game saw this" are different claims that fail in different ways.
- A member can take back their own tick.
- A member **cannot** un-tick something the game reported. The addon has no
  tombstone and should not grow one: a second store of "no, really, not done"
  is a second source of truth for the same question, and the site already
  holds that one. The display says so rather than doing nothing silently.

### One more thing the list decides

`TaskMap.lua` carries its own copy of each task's goal, and a copy ages. Where
a list has been imported, **its** goal is the ceiling the addon counts to. With
the site at ten keys and the map still at eight, clamping at eight stops
counting two keys early and the site never gets to hear about them.

## The reset week

US realms reset Tuesday and EU realms Wednesday, and the exact hour is a
Blizzard fact rather than something any of these three programs should assert
from memory. Guessing it moves every weekly storage key to a value that is
also wrong, and then moves them again when the guess is corrected.

So nothing is guessed:

- The Agenda **learns** the anchor from Blizzard's own mythic keystone period,
  which `/api/reset-time?region=` already returns, and caches it as
  `wow_mn_reset_anchor` (`{day, hour}`, UTC). That key syncs, so the worker
  reads the same anchor the browser used.
- Until the first successful learn, **every region keeps Tuesday 15:00 UTC**,
  which is what the site has always done. The default is "unchanged", never a
  different guess.
- A learned anchor is adopted at page load and never mid-session, and adopting
  one migrates the current week's keys across rather than appearing to erase
  them.
- The **addon does not participate**. It keeps its own Tuesday-anchored label
  for its internal pruning, and the Agenda buckets its payloads by `generated`.
  This is why an EU member's addon needs no configuration.

The site and the worker are two implementations of one rule and are tested
against each other across a full year at half-hour resolution, under several
anchors. They key every piece of weekly data, so a disagreement writes into a
bucket the other does not read, and nothing errors: the week simply looks
empty.

## Consent and scopes

The Agenda holds a consent record per member, in KV at `consent:<sub>`:

```jsonc
{
  "v": 1,
  "updated": 1756900000,
  "scopes": {
    "agenda.weekly":  true,   // weekly objective completion may be read by Tabard
    "rating.self":    true,   // your own authored-ratings lookup, shown only to you
    "rating.profile": false   // your rater profile may be shown to the guild
  },
  "discord": "218510314835148800"   // set when Tabard first binds, for audit
}
```

Absent record means every scope is false. Tabard's reads fail closed.

## Ratings: what can and cannot be published

Party Ledger records the grades **you gave other people**. It does not record
grades other people gave you, and there is no central pool that could compute
one. This is a deliberate design limit recorded in `HANDOFF.md`:

> Sharing is off by default in both directions, guild and group channels only,
> no central sync. This is a deliberate scope limit, not an unfinished
> feature: addons in this space have drawn scrutiny when they grew into
> broadly distributed blacklists.

The integration keeps that limit. Concretely:

- **`rating.self`** lets you ask Tabard what *you* thought of a player. The
  answer is ephemeral, visible only to you, and sourced from your own ledger.
  It is your notebook, read back to you in a different room.
- **`rating.profile`** lets you publish *your own* grading profile: how many
  players you have graded, your grade distribution, how many runs you have
  logged. It says something about you, not about anyone else.
- There is deliberately **no** endpoint that answers "what does the guild
  think of player X". That is the distributed blacklist shape, and building it
  would make the guild the accountable party for a reputation record on people
  who never consented to being in it.

A consequence worth stating plainly, because it is easy to expect otherwise:
"show me my reputation score" cannot be built from this data at all. Nothing
records it.

## Who owns what

Worth stating plainly, because the answer changed and because two of the three
programs assumed otherwise for a while.

**The Agenda worker is authoritative for weekly state.** Task completion,
counters, boss kills, Your List, custom tasks and collections are rows in its
D1 database, and it reconciles them. The rules are in `worker/merge.js` and
there is one copy of them.

Before this, all of it lived in two KV blobs that only the member's browser
wrote and that were replaced wholesale on every save. The merge rules were
order-independent and then defeated by the transport above them: two devices
open at once meant whoever saved last erased the other's evening, there was no
history because each write replaced the last, and nothing pruned the weekly
keys so the blob grew without bound.

**The Agenda does not own the task catalogue at the server.** Section titles,
goal thresholds, boss lists and the mapping from a mount's name to a task id
live in `js/data-tasks.js`, a static file that changes every patch. So the
worker stores facts and never derives a task from them: a client reports "these
bosses are dead" *and* "therefore this task is done". This is the same division
the addon and the site already had, and it is why `/api/observe` accepts a
derived conclusion alongside the observation it came from.

**The addon owns nothing durable that the site needs.** It records what the
game did, and everything it records is reproducible from the game. Its saved
variables are a buffer, not a store, which is why an import replaces the list
it holds rather than merging into it.

**Tabard owns nothing here at all.** `agenda_cache` in its own D1 is a cache
in front of `/api/share/*` with a five-minute TTL, and its own migration says
so. Everything in it is reconstructible by fetching again.

### The state API

Session-authenticated, for the member's own browser. Not for Tabard: it reads
`/api/share/*` and always has.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/observe` | Submit observations. The one write path for weekly state |
| GET  | `/api/state?week=` | One week, plus the not-weekly things needed to draw it |
| GET  | `/api/weeks` | Every week the account has rows for |
| PUT  | `/api/list` | Replace one character's Your List |

An observation is `{ charId, taskId, done?, value?, source, at }`. Four sources
are recognised, and an unknown one is dropped and counted rather than guessed
at: `member`, `member-game`, `addon`, `armory`.

Each observation is filed by the reset week **its own timestamp falls in**, not
by a week the caller names. That is what stops an envelope written last Monday
from ticking this week's boxes, and it does it structurally rather than with a
flag every caller has to remember to check.

The reset anchor is stored per account (`account.reset_day`/`reset_hour`) and
the worker computes the week key from it. There used to be a copy of that rule
in the worker, a copy in the browser, and a third inert copy shadowing the
browser's; see "The reset week" below.

### When D1 is not bound

The worker reads `env.DB` where it is bound and falls back to the KV blobs
where it is not, so the cutover is not a flag day and can be reversed by
unbinding. `/api/observe` and `/api/state` answer `{ unavailable: true }`, the
client's state layer becomes a no-op, and the old whole-blob sync remains the
whole mechanism.

The import off the old blobs is **client-driven**, and for a concrete reason:
the blob stored boss kills under `taskId + "_" + bossId` concatenated, and both
halves contain underscores (`vab_h_nekzali`), so splitting one needs the boss
lists from the catalogue. Until a member's browser has done it,
`/api/share/agenda` reads their blob, so somebody who has not opened the site
since the cutover keeps working rather than going quiet.

## The share API

Served by the Agenda worker. Two callers: the member's own browser (session
cookie) and Tabard (service token).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/api/consent` | session | Read your own consent record |
| PUT  | `/api/consent` | session | Update your own consent record |
| PUT  | `/api/ledger`  | session | Upload a decoded PLW1 envelope |
| GET  | `/api/ledger`  | session | Read back what was uploaded |
| GET  | `/api/share/agenda?sub=` | service | Weekly completion for one member, plus `agenda`: the hash of whichever list is in game |
| GET  | `/api/share/rating?sub=&player=` | service | Your own grade for one player |
| GET  | `/api/share/profile?sub=` | service | Rater profile, if published |
| POST | `/api/share/bind` | service | Record the Discord id against a sub |

Served from `https://agenda.7donuts.dev`, and called only by
`tabard.7donuts.dev`. Service auth is `Authorization: Bearer
<AGENDA_SERVICE_TOKEN>`, a shared secret held as a Worker secret on both sides
(`wrangler secret put AGENDA_SERVICE_TOKEN`, the same value in each repo).
Tabard reaches it through `AGENDA_BASE_URL`, a var rather than a secret since
the hostname is not sensitive. It authenticates Tabard, it does
not authorize the read: every `/api/share/*` response is additionally gated on
the member's consent record, and returns 403 with a machine-readable reason
when a scope is off, so Tabard can tell the member which switch to flip.

Rate limits are the Worker's own. Tabard caches share reads in D1 for five
minutes, which is well inside the Agenda's own sync cadence.

## Auto-completion of agenda tasks

Four sources can tick a task, in increasing order of authority:

1. **The member on the site**, clicking it. Always wins, always reversible.
2. **The member in game**, on the heads-up display. Their own claim, carried
   in the envelope as `src: "manual"`, and shown on the site as such. It is
   not evidence: nothing confirmed it but the person saying so.
3. **The Blizzard profile API**, via the Agenda worker. Authoritative but
   lagging: raid kills and M+ runs land within minutes to hours, collections
   within a similar window.
4. **The addon's own observation**, via the bridge. Immediate but only as
   fresh as the last `/reload`.

The merge rule is: a task that any source reports done is done, and a manual
uncheck sets a tombstone for the current week that automatic sources do not
overturn. Progress counters take the maximum across sources. This is the only
rule that survives a member playing on two machines and syncing out of order.

The tombstone lives on the site and only on the site. That is why the in-game
display is additive: two stores of "no, really, not done" would be two answers
to one question. The addon merges the same way for display purposes, and its
merge is a view rather than a write.

Every automatically-ticked task records its source, and the Agenda shows it as
a badge (`Ledger`, `In game`, `Armory`), so a wrong tick is traceable to the
thing that made it.
