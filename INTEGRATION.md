# Cross-platform integration: Party Ledger, The Azeroth Agenda, Tabard

One member, three programs, one Battle.net account. This document is the
contract between them. It is copied verbatim into all three repositories;
change it in one and copy it to the other two in the same change.

## The three programs

| Repo | What it is | Runs where |
|---|---|---|
| `rateaplayer` (Party Ledger) | WoW addon, Lua 5.1 | The game client |
| `wowWeekly` (The Azeroth Agenda) | Static site + Worker, KV | Cloudflare |
| `tabard` (Guild Identity) | Discord bot, Worker, D1 | Cloudflare |

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
carrying its data across (see "The addon bridge"), which is also what makes it
consent-bearing by construction.

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

Every arrow is pull-based except the first. Nothing is pushed to Discord that
the member has not consented to.

## The envelope (PLW1)

The addon produces one JSON document per export. It is the only thing that
crosses the addon boundary.

```jsonc
{
  "fmt": "PLW1",
  "v": 1,
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
        "v2": { "done": false, "value": 4, "max": 6, "at": 1756900000 }
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
  "ratings": {                    // ratings THIS member authored. See "Ratings".
    "at": 1756900000,
    "authored": 214,
    "runs": 340,
    "byGrade": { "-2": 3, "-1": 9, "0": 40, "1": 120, "2": 42 },
    "recent": [
      { "name": "Bobkin", "realm": "Illidan", "class": "PALADIN",
        "grade": 2, "at": 1756800000, "tags": ["cds", "comms"],
        "content": "MYTHICPLUS", "encounters": 4 }
    ]
  }
}
```

Rules:

- `fmt` and `v` are mandatory. A consumer that does not know `v` refuses the
  document rather than guessing at it.
- Unknown keys are ignored, never dropped on a round trip.
- Unknown task ids in `objectives` are ignored. The Agenda's task list moves
  every patch and the addon's copy will lag it.
- Timestamps are unix seconds. The client clock is not trusted for anything
  but display ordering.
- `collections` matches on name, not id. Both the addon (`C_MountJournal`) and
  the Blizzard profile API return localized names for the same collection, and
  the Agenda's task entries already carry the name. Ids are carried as an
  optional override where one is known for certain.

### Transport

The addon writes the envelope into its own SavedVariable, base64 in a single
field so no Lua string escaping is in the path:

```lua
PartyLedgerBridgeDB = {
  ["v"] = 1,
  ["written"] = 1756900000,
  ["summary"] = { ... },   -- plain-text counts, so the file is inspectable
  ["b64"] = "eyJmbXQiOiJQTFcxIiwidiI6MSwi...",
}
```

`summary` exists so a member can read the file and see what it contains
without decoding anything. It is advisory; `b64` is authoritative.

## The addon bridge

WoW addons cannot make HTTP requests. There are exactly three ways data leaves
the client, and the Agenda supports two of them:

1. **SavedVariables read (primary).** The Agenda asks once for read access to
   the member's WoW folder through the File System Access API, remembers the
   handle in IndexedDB, and re-reads
   `WTF/Account/<ACCOUNT>/SavedVariables/PartyLedger.lua` on demand. Chromium
   only. The file is only written by the game at logout or `/reload`, so the
   Agenda tells the member how old the data is rather than pretending it is
   live.
2. **Paste (fallback).** `/ledger sync` prints the same base64 string into a
   copy box. Works in every browser.

There is no third path. The addon never sees the network.

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

## The share API

Served by the Agenda worker. Two callers: the member's own browser (session
cookie) and Tabard (service token).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/api/consent` | session | Read your own consent record |
| PUT  | `/api/consent` | session | Update your own consent record |
| PUT  | `/api/ledger`  | session | Upload a decoded PLW1 envelope |
| GET  | `/api/ledger`  | session | Read back what was uploaded |
| GET  | `/api/share/agenda?sub=` | service | Weekly completion for one member |
| GET  | `/api/share/rating?sub=&player=` | service | Your own grade for one player |
| GET  | `/api/share/profile?sub=` | service | Rater profile, if published |
| POST | `/api/share/bind` | service | Record the Discord id against a sub |

Service auth is `Authorization: Bearer <AGENDA_SERVICE_TOKEN>`, a shared
secret held as a Worker secret on both sides. It authenticates Tabard, it does
not authorize the read: every `/api/share/*` response is additionally gated on
the member's consent record, and returns 403 with a machine-readable reason
when a scope is off, so Tabard can tell the member which switch to flip.

Rate limits are the Worker's own. Tabard caches share reads in D1 for five
minutes, which is well inside the Agenda's own sync cadence.

## Auto-completion of agenda tasks

Three sources can tick a task, in increasing order of authority:

1. **The member**, clicking it. Always wins, always reversible.
2. **The Blizzard profile API**, via the Agenda worker. Authoritative but
   lagging: raid kills and M+ runs land within minutes to hours, collections
   within a similar window.
3. **The addon**, via the bridge. Immediate but only as fresh as the last
   `/reload`.

The merge rule is: a task that any source reports done is done, and a manual
uncheck sets a tombstone for the current week that automatic sources do not
overturn. Progress counters take the maximum across sources. This is the only
rule that survives a member playing on two machines and syncing out of order.

Every automatically-ticked task records its source, and the Agenda shows it,
so a wrong tick is traceable to the thing that made it.
