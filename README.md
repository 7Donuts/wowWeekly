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
| `_worker.js` | OAuth, the Battle.net profile and collections APIs, KV sync, the share API |
| `js/data-tasks.js` | The checklist itself: sections, tasks, goals, boss lists |
| `js/storage.js` | Namespaced localStorage, week keys, per-character state |
| `js/app.js` | Rendering and interaction |
| `js/armory.js` | Battle.net character sync, and the auto-checks it drives |
| `js/ledger.js` | The Party Ledger addon bridge, and the merge rules every automatic source goes through |
| `js/sync.js` | Cross-device sync against KV |

## Three sources can tick a box

The member, the Battle.net profile API, and the Party Ledger addon. They
disagree often enough that the rules have to be written down:

- Anything a source reports done is done.
- **A box the member un-ticks stays un-ticked for that week.** Without this an
  automatic source re-ticks it on the next sync and the member cannot get rid
  of it, which is the most annoying way this can fail.
- Progress counters merge by taking the **maximum**, not the most recent. A
  member playing on two machines syncs them in whatever order they open the
  site, and latest-wins would walk progress backwards.
- Every automatic tick records which source made it, and the site shows a small
  badge saying so, because a tick nobody made is otherwise unexplainable.

All of it goes through `applyAutoTask` and `applyAutoBoss` in `js/ledger.js`.
Nothing else may write to the done map on an automatic path.

## The addon bridge

Party Ledger records boss kills, keystones, delves and collectibles as they
happen. An addon cannot make a network request, so it writes a saved variable
and the member hands the file over: the site reads it directly through the File
System Access API after a single permission grant, or the member pastes the
string from `/ledger sync`.

The file is only written by the game at logout or `/reload`, so the site
reports how old the *game data* is rather than how recently it was imported.
Those are different numbers and confusing them makes the feature look broken.

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
