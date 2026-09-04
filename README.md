# The Azeroth Agenda

World of Warcraft weekly task tracker. A static site with a Cloudflare Worker
behind it for Battle.net OAuth, the profile API, and cross-device sync.

## Running the tests

    npm test

No dependencies. `tests/harness.js` evaluates the site's scripts the way the
page does, into one shared scope with a minimal browser around them, so the
storage and merge logic can be tested without a DOM.

## Where things live

| File | Responsibility |
|---|---|
| `_worker.js` | OAuth, the Battle.net profile and collections APIs, the state and share APIs |
| `worker/merge.js` | The merge rules and the reset week, as pure functions. One implementation, server-side |
| `worker/store.js` | Every statement that touches D1 |
| `migrations/` | The D1 schema. `wrangler d1 migrations apply` |
| `js/data-tasks.js` | The checklist itself: sections, tasks, goals, boss lists |
| `js/storage.js` | Namespaced localStorage, week keys, per-character state. The only definition of each: see the guard in tests/wiring.test.js |
| `js/state.js` | The client half of the authoritative store: the observation queue, hydration, and the one-time import |
| `js/app.js` | Rendering and interaction |
| `js/armory.js` | Battle.net character sync, and the auto-checks it drives |
| `js/ledger.js` | The Party Ledger addon bridge inbound, and the merge rules every automatic source goes through |
| `js/ledger-out.js` | The other half of that bridge: the member's list, handed to the addon |
| `js/sync.js` | Cross-device sync against KV |

## Where state actually lives

The worker owns weekly state and reconciles it. That is a change from how this
worked for most of the site's life, and the reasons are worth keeping written
down because they are the failure modes, not preferences:

Everything used to live in two KV blobs, `user:<sub>` holding the member's
entire localStorage and `ledger:<sub>` holding the last envelope the addon
produced. Both were written only by the browser and replaced wholesale. So:

- **Lost updates.** The merge rules below were written to be order-independent
  and then applied only to local state. `pullFromCloud` overwrote local with
  the server's copy key by key and `pushToCloud` sent everything, so two
  devices open at once meant whoever saved last erased the other's evening.
  The rules now run in `worker/merge.js`, once, per task.
- **No history.** Each import replaced the last, so "what did I do in week X"
  had no answer anywhere. Weekly rows are kept indefinitely; `/api/weeks` is
  the reader.
- **Unbounded blobs.** Nothing pruned the old weekly keys. Six characters
  after a year is about 1,500 keys and a 420KB PUT on every checkbox click,
  on a path with no size guard and no quota handling.

The shape now:

| Where | What |
|---|---|
| D1 | weekly task state, boss kills, Your List, custom tasks, collections, characters, the reset anchor, what the addon is holding |
| KV `ledger:<sub>` | the addon's envelope document, for the ratings and scorecards Tabard reads |
| KV `user:<sub>` | everything else that syncs: notes, device preferences, the history rollup |
| KV, with a TTL | the Battle.net token and the profile API caches |

Writes are optimistic. `js/state.js` writes localStorage first so a checkbox
never waits for a round trip, queues an observation, and then writes the
server's reconciled answer back over the top. Where they disagree the server
wins. The queue lives in localStorage, so losing the network does not lose the
work, and every rule in `worker/merge.js` is written so that an observation
which sat in a queue for a day arriving after one made later elsewhere does
not matter.

The renderer still reads localStorage. That is deliberate: making it async and
server-driven in the same change that introduced the schema would have been
two risky changes at once, so localStorage became a mirror of what the server
decided rather than the source of truth it used to be.

**What the worker does not have is the task catalogue.** Section titles, goal
thresholds, boss lists and the mapping from a mount's name to a task id all
live in `js/data-tasks.js` and change every patch. So the worker stores facts
and never derives a task from them: the client reports "these bosses are dead"
*and* "therefore this task is done". A worker carrying the catalogue would
need redeploying to keep a checkbox correct.

## Turning on the D1 store

The binding is commented out in `wrangler.jsonc`, and the worker reads
`env.DB` when it is bound and falls back to the KV blobs when it is not. So
this is not a flag day, and it can be undone by commenting the binding out
again.

    wrangler d1 create azeroth-agenda
    # paste the printed id into wrangler.jsonc and uncomment the block
    wrangler d1 migrations apply azeroth-agenda --remote

The deploy workflow applies migrations before deploying, and they are additive
by construction, so the currently-live worker keeps working against the new
schema for the seconds between the two steps.

**The import off the old blobs is client-driven, and that is not laziness.**
The blob stored boss kills under `taskId + "_" + bossId` concatenated into one
string, and both halves contain underscores (`vab_h_nekzali`), so splitting
one needs the boss lists. Those are in the catalogue, which the page has and
the worker deliberately does not. So each member's browser reads its own
localStorage once, sends it as observations, and the worker records that it
happened. It is idempotent: three devices at once produce one set of rows.

Until a member's account has been imported, `/api/share/agenda` falls back to
reading their blob, so somebody who has not opened the site since the cutover
keeps working rather than going quiet on Discord.

## Four sources can tick a box

The member here, the member on the in-game display, the Battle.net profile API,
and the Party Ledger addon's own observation. They disagree often enough that
the rules have to be written down:

- Anything a source reports done is done.
- **A box the member un-ticks stays un-ticked for that week.** Without this an
  automatic source re-ticks it on the next sync and the member cannot get rid
  of it, which is the most annoying way this can fail.
- Progress counters merge by taking the **maximum**, not the most recent. A
  member playing on two machines syncs them in whatever order they open the
  site, and latest-wins would walk progress backwards.
- Every automatic tick records which source made it, and the site shows a small
  badge saying so, because a tick nobody made is otherwise unexplainable.
- A tick the member made on the in-game display gets its own badge (`In game`)
  rather than sharing the addon's. The addon observing a boss kill and the
  member saying they did something are different claims, and they fail in
  different ways.

Locally all of it goes through `applyAutoTask` and `applyAutoBoss` in
`js/ledger.js`, and nothing else may write to the done map on an automatic
path. The authoritative version of the same rules is `mergeTaskObservation` in
`worker/merge.js`, which is a pure function of (current row, observation) and
is where a disagreement is actually settled.

One rule reads oddly until you hit it: the member setting a counter by hand
**sets** it, while automatic sources take the maximum. A maximum would make
correcting a mis-click downward impossible. An automatic source can still
raise it past what they typed, because the game counting eight keys is a fact
and four was a guess, and that is what the site did locally before any of this
moved server-side.

## The addon bridge

Party Ledger records boss kills, keystones, delves and collectibles as they
happen. An addon cannot make a network request, so it writes a saved variable
and the member hands the file over: the site reads it directly through the File
System Access API after a single permission grant, or the member pastes the
string from `/ledger sync`.

The file is only written by the game at logout or `/reload`, so the site
reports how old the *game data* is rather than how recently it was imported.
Those are different numbers and confusing them makes the feature look broken.

The string names its own transport: `PLW2:` means the JSON was deflated
(zlib, so `DecompressionStream("deflate")`), and no prefix means the
uncompressed PLW1 an older addon writes. Both stay readable, because an addon
older than the site is a normal state. `tests/fixtures/plw2-from-addon.txt` is
a payload the real addon produced, so a test fails if the two repos drift; a
suite that builds its own fixtures cannot catch that, and did not.

## The list, going the other way

The bridge above answers "what did I do". Your List answers "what am I trying
to do", and only this side knows it, so the addon cannot show a to-do list in
game unless it is handed one.

`js/ledger-out.js` builds an AGL payload from Your List: the tasks, the section
each belongs to, the goal on it and what is already ticked. The member copies
it from the Addon & Discord panel and runs `/ledger list import`. The addon
draws it grouped by activity, in the order arranged here, and ticks the rows
the game can confirm.

It is a paste rather than a file write, even though the site already has a
directory handle for the WoW folder. `SavedVariables` are rewritten wholesale
by the game at logout, so a write there is destroyed or merged into the file
holding the member's entire grade database; and the other place an addon reads
at load is `Interface/AddOns`, where files are Lua the client executes. A page
that can write executable Lua into the game's addon folder is a
code-execution channel into the client opened by a web origin, and being
convenient is not a reason to build one.

The addon reports back a hash of whichever list it holds, so the panel can say
that the display in game is showing a list the member has since changed.
Without that, "why isn't my new task in the HUD" has no answer anywhere.

## Sharing with Discord

Tabard reads a member's weekly progress and their own grades through
`/api/share/*`, authenticated with a service token and authorized separately by
a per-member consent record. Every scope is off until the member turns it on.

There is deliberately no endpoint that answers "what does the guild think of
player X". Party Ledger records what *you* thought of people and keeps no
pooled reputation; building one would make the guild answerable for a record on
people who never agreed to be in it. See `INTEGRATION.md`.

## Configuration

Served from `agenda.7donuts.dev`.

Worker secrets: `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET`, `SESSION_SECRET`, and
`AGENDA_SERVICE_TOKEN`. KV namespace `USER_DATA`.

`AGENDA_SERVICE_TOKEN` is shared with Tabard at `tabard.7donuts.dev`, which
must hold the identical value in its own `AGENDA_SERVICE_TOKEN` secret and
point `AGENDA_BASE_URL` here. Unset on either side means the share API is off,
not open. The token authenticates Tabard and authorizes nothing: every
`/api/share/*` response is gated separately on the member's own consent
record.
