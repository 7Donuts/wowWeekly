-- The Agenda's authoritative store.
--
-- Until now everything lived in two KV blobs: `user:<sub>`, the member's whole
-- localStorage, and `ledger:<sub>`, the last envelope the addon produced. Both
-- were written only by the member's browser and overwritten wholesale, which
-- had three consequences worth stating, because this schema exists to fix them
-- rather than because rows are tidier than JSON.
--
--   Lost updates. The merge rules (any source ticks, a manual un-tick leaves a
--   tombstone, counters take the maximum) were carefully written to be
--   order-independent, and then applied only to local state. The sync layer
--   above them replaced the whole blob, so two devices open at once meant
--   whoever pushed last erased the other's evening. The rules now run here,
--   per task, so arriving out of order is no longer a way to lose work.
--
--   No history. Each import replaced the last, so "what did I actually do in
--   week X" had no answer anywhere. Weekly rows are kept indefinitely: they
--   are small, and the question is worth being able to ask.
--
--   Unbounded blobs. Nothing pruned old weekly keys, so a member with six
--   characters was pushing about 420KB in full on every checkbox click after a
--   year, on a path with no size guard and no quota handling.
--
-- Everything here is keyed by the Battle.net `sub`, which both this site and
-- Tabard already hold from OAuth. No new identity is introduced.

-- Account-level facts. The reset anchor is here rather than derived per
-- request because the week key is the one thing every table above is filed
-- under, and it was previously computed twice: once in the browser and once in
-- the worker, from a blob the browser had written. One stored anchor, one
-- implementation, and a client that disagrees is told which week its
-- observation actually landed in.
CREATE TABLE account (
  sub          TEXT    PRIMARY KEY,
  reset_day    INTEGER,            -- 0-6, UTC. NULL means the Tuesday default.
  reset_hour   INTEGER,            -- 0-23, UTC
  reset_source TEXT,               -- 'default' | 'blizzard'
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- Characters the member tracks. `char_id` is the site's own identifier,
-- "Name" or "Name@realm-slug", kept as-is so existing local state maps across
-- without a rename. `ledger_key` is the addon's key for the same character,
-- stored so an envelope can be matched without the addon learning this
-- site's naming.
CREATE TABLE character (
  sub         TEXT    NOT NULL,
  char_id     TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  realm_slug  TEXT,
  ledger_key  TEXT,
  class_name  TEXT,
  level       INTEGER,
  -- Read from the Battle.net profile API by the client and stored here so a
  -- Discord card can be drawn without Tabard reaching into a localStorage
  -- blob. Nullable: a character the member added by hand but never synced has
  -- neither, and 0 would read as "naked" rather than as "unknown".
  ilvl          INTEGER,
  mythic_rating REAL,
  -- Nullable, and NULL means "no opinion". A caller that knows nothing about
  -- ordering (the addon, which sees characters and not a character list) has
  -- to be able to upsert a row without asserting a position, and a NOT NULL
  -- column cannot express that: passing 0 would silently move the character
  -- to the front of the member's list.
  position    INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (sub, char_id)
);

CREATE INDEX idx_character_ledger ON character(sub, ledger_key);

-- One row per character, week and task. This is where the merge happens, and
-- the columns are shaped by it: `done` and `value` each carry their own source
-- and timestamp because they can come from different places, and a row can be
-- half asserted by the member and half observed by the game.
CREATE TABLE task_state (
  sub          TEXT    NOT NULL,
  char_id      TEXT    NOT NULL,
  week         TEXT    NOT NULL,          -- the worker's week key, YYYY-MM-DD
  task_id      TEXT    NOT NULL,
  done         INTEGER NOT NULL DEFAULT 0,
  done_source  TEXT,                      -- member | member-game | addon | armory
  done_at      INTEGER,
  value        INTEGER NOT NULL DEFAULT 0,
  value_source TEXT,
  value_at     INTEGER,
  -- The tombstone, and the reason this table cannot be a plain upsert. When
  -- the member un-ticks a box by hand, automatic sources must not put it back
  -- on the next sync: that is the single most annoying way automatic
  -- completion can fail. Set to the moment they un-ticked it, cleared when
  -- they tick it again.
  untick_at    INTEGER,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (sub, char_id, week, task_id)
);

CREATE INDEX idx_task_state_week ON task_state(sub, week);

-- Raid boss kills. Kept as their own rows rather than folded into task_state
-- because a raid task is done when every boss on its list is dead, and the
-- boss list lives in the site's task data and moves every patch. The rows are
-- the facts; the derivation is the caller's.
CREATE TABLE boss_kill (
  sub       TEXT    NOT NULL,
  char_id   TEXT    NOT NULL,
  week      TEXT    NOT NULL,
  task_id   TEXT    NOT NULL,
  boss_id   TEXT    NOT NULL,
  source    TEXT,
  killed_at INTEGER NOT NULL,
  PRIMARY KEY (sub, char_id, week, task_id, boss_id)
);

CREATE INDEX idx_boss_kill_week ON boss_kill(sub, week);

-- Your List: the to-do list itself, per character. Not weekly. This is what
-- the site means by "the member's list", what Tabard counts against, and what
-- the addon draws in game, so all three now read one place.
CREATE TABLE list_entry (
  sub      TEXT    NOT NULL,
  char_id  TEXT    NOT NULL,
  task_id  TEXT    NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  hidden   INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (sub, char_id, task_id)
);

-- Tasks the member typed themselves, including Best in Slot imports. Their
-- ids carry no "custom_" prefix here: that prefix is how the site
-- distinguishes them inside one flat done map, and a table keyed by task_id
-- does not need it. The API adds and strips it at the edge.
CREATE TABLE custom_task (
  sub        TEXT    NOT NULL,
  char_id    TEXT    NOT NULL,
  task_id    TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  descr      TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (sub, char_id, task_id)
);

-- Mounts, toys and achievements. Account-wide rather than per character,
-- which is why they are not in task_state: one mount ticks its task on every
-- character, and recording it per character would make six rows out of one
-- fact and then need them kept in step.
CREATE TABLE collection (
  sub         TEXT    NOT NULL,
  kind        TEXT    NOT NULL,   -- mount | toy | achievement
  key         TEXT    NOT NULL,   -- localized name, or achievement id as text
  source      TEXT,
  observed_at INTEGER NOT NULL,
  PRIMARY KEY (sub, kind, key)
);

-- Which list the member's game client is holding, as reported by the addon's
-- envelope. One row per account: the addon holds one list at a time. Lets the
-- site say "the display in game is showing a list you have since changed",
-- which is otherwise unanswerable because a paste is a snapshot and nothing
-- else records which snapshot.
CREATE TABLE agenda_list (
  sub          TEXT    PRIMARY KEY,
  sig          TEXT,
  week         TEXT,
  tasks        INTEGER NOT NULL DEFAULT 0,
  imported_at  INTEGER,
  generated_at INTEGER,
  updated_at   INTEGER NOT NULL
);

-- What the addon last handed over, and when. The envelope itself stays in KV:
-- it is a document with its own shape and its own lifetime, and revoking it
-- should stay one delete. What belongs here is the fact of it, so the site can
-- report freshness without fetching the whole thing.
CREATE TABLE ledger_receipt (
  sub          TEXT    PRIMARY KEY,
  addon        TEXT,
  generated_at INTEGER,
  week         TEXT,
  received_at  INTEGER NOT NULL
);

-- Whether this account's KV blobs have been folded into the tables above.
-- The import runs once, on the first authenticated touch, and is idempotent:
-- a member who never opens the site again keeps their data, and one who
-- opens it on three devices at once does not get three imports.
CREATE TABLE blob_migration (
  sub         TEXT    PRIMARY KEY,
  migrated_at INTEGER NOT NULL,
  weeks       INTEGER NOT NULL DEFAULT 0,
  tasks       INTEGER NOT NULL DEFAULT 0,
  note        TEXT
);
