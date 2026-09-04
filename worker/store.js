/* The authoritative store. Every statement that touches D1 lives here.

   The worker used to be a dumb blob store: `user:<sub>` held the member's
   whole localStorage and `ledger:<sub>` held the last envelope the addon
   produced, both written only by the browser and both overwritten wholesale.
   This replaces that with rows the server reconciles, which is what makes the
   two systems actually stay in sync rather than race.

   One boundary worth being explicit about, because it decides what is not
   here: **the worker does not know the task catalogue.** Section titles, goal
   thresholds, boss lists and the mapping from a mount's name to a task id all
   live in js/data-tasks.js, they change every patch, and they ship as a
   static file. So this stores facts and never derives a task from them: the
   client reports "these bosses are dead" *and* "therefore this task is done",
   the same division the addon and site already had. A worker that carried the
   catalogue would need redeploying every patch to keep a checkbox correct.
*/

import {
  mergeTaskObservation, isKnownSource,
  DEFAULT_RESET_ANCHOR, validAnchor, weekKeyFor, weekKeyForMoment,
} from './merge.js';

/* A batch of observations is bounded so one request cannot become an
   unbounded write. The realistic maximum is a first sync of a member with a
   dozen alts and a full season behind them; well inside this. */
const MAX_OBSERVATIONS = 5000;

function nowSeconds() { return Math.floor(Date.now() / 1000); }

export class Store {
  constructor(db) { this.db = db; }

  /* D1 returns { results }. Unwrapped here so no caller has to remember. */
  async #all(sql, ...args) {
    const stmt = args.length ? this.db.prepare(sql).bind(...args) : this.db.prepare(sql);
    const out = await stmt.all();
    return (out && out.results) || [];
  }

  async #first(sql, ...args) {
    const stmt = args.length ? this.db.prepare(sql).bind(...args) : this.db.prepare(sql);
    return await stmt.first();
  }

  #stmt(sql, ...args) {
    return args.length ? this.db.prepare(sql).bind(...args) : this.db.prepare(sql);
  }

  /* Written in one batch so a request either lands or does not. Partial
     application is the state nothing here knows how to reason about: the
     merge rules are order-independent, but "half of this evening" is not an
     order. */
  async #batch(statements) {
    if (!statements.length) return;
    await this.db.batch(statements);
  }

  /* ── The account and its reset anchor ────────────────────────────────── */

  async anchor(sub) {
    const row = await this.#first(
      'SELECT reset_day AS day, reset_hour AS hour, reset_source AS source FROM account WHERE sub = ?',
      sub);
    return validAnchor(row) ? { day: row.day, hour: row.hour, source: row.source } : DEFAULT_RESET_ANCHOR;
  }

  /* A learned anchor replaces the default; the default never replaces a
     learned one. Adopting one is the client's decision about when (never
     mid-session, or half a week files under each key), but which anchor is
     current is the server's, so both screens agree on what week it is. */
  async learnAnchor(sub, anchor) {
    if (!validAnchor(anchor)) return await this.anchor(sub);
    const at = nowSeconds();
    const source = anchor.source === 'blizzard' ? 'blizzard' : 'default';
    const current = await this.#first('SELECT reset_source FROM account WHERE sub = ?', sub);

    if (current && current.reset_source === 'blizzard' && source !== 'blizzard') {
      return await this.anchor(sub);
    }

    await this.#stmt(
      `INSERT INTO account (sub, reset_day, reset_hour, reset_source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET
         reset_day = excluded.reset_day,
         reset_hour = excluded.reset_hour,
         reset_source = excluded.reset_source,
         updated_at = excluded.updated_at`,
      sub, anchor.day, anchor.hour, source, at, at).run();

    return { day: anchor.day, hour: anchor.hour, source };
  }

  /* ── Characters ──────────────────────────────────────────────────────── */

  async characters(sub) {
    return await this.#all(
      `SELECT char_id, name, realm_slug, ledger_key, class_name, level,
              ilvl, mythic_rating, position
         FROM character WHERE sub = ?
        -- NULL is "no opinion", so those sort after the ones the member has
        -- actually ordered rather than jumping to the front.
        ORDER BY position IS NULL, position, char_id`, sub);
  }

  characterStatement(sub, char, at) {
    // Only the fields the caller actually knows are overwritten. The armory
    // knows the class and level and the addon knows the ledger key; neither
    // should blank the other's column by not mentioning it.
    return this.#stmt(
      `INSERT INTO character
         (sub, char_id, name, realm_slug, ledger_key, class_name, level,
          ilvl, mythic_rating, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sub, char_id) DO UPDATE SET
         name          = COALESCE(excluded.name, character.name),
         realm_slug    = COALESCE(excluded.realm_slug, character.realm_slug),
         ledger_key    = COALESCE(excluded.ledger_key, character.ledger_key),
         class_name    = COALESCE(excluded.class_name, character.class_name),
         level         = COALESCE(excluded.level, character.level),
         ilvl          = COALESCE(excluded.ilvl, character.ilvl),
         mythic_rating = COALESCE(excluded.mythic_rating, character.mythic_rating),
         position      = COALESCE(excluded.position, character.position),
         updated_at    = excluded.updated_at`,
      sub, char.charId, char.name || char.charId, char.realmSlug || null,
      char.ledgerKey || null, char.className || null, char.level || null,
      char.ilvl == null ? null : Math.round(Number(char.ilvl)) || null,
      char.mythicRating == null ? null : Number(char.mythicRating),
      char.position == null ? null : char.position, at, at);
  }

  async upsertCharacters(sub, characters, at) {
    at = at || nowSeconds();
    await this.#batch((characters || [])
      .filter((c) => c && c.charId)
      .map((c) => this.characterStatement(sub, c, at)));
  }

  /* Match an addon envelope's character key to one of the member's. Exact on
     the addon's own key first, then on name where the site never recorded a
     realm slug, which is the case that would otherwise silently drop an
     entire character's week. */
  async matchLedgerCharacter(sub, ledgerKey, name) {
    if (ledgerKey) {
      const exact = await this.#first(
        'SELECT char_id FROM character WHERE sub = ? AND ledger_key = ?', sub, ledgerKey);
      if (exact) return exact.char_id;
    }
    if (name) {
      const byName = await this.#first(
        `SELECT char_id FROM character
          WHERE sub = ? AND ledger_key IS NULL AND LOWER(name) = LOWER(?)`, sub, name);
      if (byName) return byName.char_id;
    }
    return null;
  }

  /* ── Observations ────────────────────────────────────────────────────── */

  /* The one write path for weekly state, whatever the source.

     Each observation carries its own timestamp and is filed by the week that
     timestamp falls in, not by a week the caller names. That is what stops an
     envelope written last Monday from ticking this week's boxes, and it does
     it structurally rather than with a flag the caller has to check.

     Returns the reconciled rows, so the caller writes back what the server
     decided rather than what it hoped for. */
  async observe(sub, payload) {
    const at = nowSeconds();
    const anchor = payload.anchor
      ? await this.learnAnchor(sub, payload.anchor)
      : await this.anchor(sub);

    if (payload.characters && payload.characters.length) {
      await this.upsertCharacters(sub, payload.characters, at);
    }

    const tasks = (payload.tasks || []).slice(0, MAX_OBSERVATIONS);
    const bosses = (payload.bosses || []).slice(0, MAX_OBSERVATIONS);
    const collections = (payload.collections || []).slice(0, MAX_OBSERVATIONS);

    const report = { week: weekKeyFor(anchor), anchor, applied: 0, ignored: 0, weeks: {} };

    /* Normalise first, so the read below can be one query per week rather
       than one per observation. An observation with an unknown source or no
       character is dropped here and counted, never guessed at: a wrong source
       would mislabel a badge and a guessed character would put somebody's
       progress on the wrong alt. */
    const wanted = new Map();   // week -> Set of char_id
    const normalised = [];
    for (const obs of tasks) {
      if (!obs || !obs.charId || !obs.taskId || !isKnownSource(obs.source)) {
        report.ignored++;
        continue;
      }
      const week = weekKeyForMoment(anchor, Number(obs.at) || at);
      normalised.push({ ...obs, at: Number(obs.at) || at, week });
      if (!wanted.has(week)) wanted.set(week, new Set());
      wanted.get(week).add(obs.charId);
    }

    const current = new Map();  // week|char|task -> row
    for (const [week, chars] of wanted) {
      const ids = [...chars];
      const holes = ids.map(() => '?').join(',');
      const rows = await this.#all(
        `SELECT char_id, task_id, done, done_source, done_at, value, value_source,
                value_at, untick_at
           FROM task_state
          WHERE sub = ? AND week = ? AND char_id IN (${holes})`,
        sub, week, ...ids);
      for (const row of rows) current.set(`${week}|${row.char_id}|${row.task_id}`, row);
    }

    const writes = [];
    for (const obs of normalised) {
      const key = `${obs.week}|${obs.charId}|${obs.taskId}`;
      const { next, changed } = mergeTaskObservation(current.get(key), obs);
      current.set(key, { char_id: obs.charId, task_id: obs.taskId, ...next });

      if (changed) {
        report.applied++;
        writes.push(this.#stmt(
          `INSERT INTO task_state
             (sub, char_id, week, task_id, done, done_source, done_at,
              value, value_source, value_at, untick_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(sub, char_id, week, task_id) DO UPDATE SET
             done = excluded.done, done_source = excluded.done_source,
             done_at = excluded.done_at, value = excluded.value,
             value_source = excluded.value_source, value_at = excluded.value_at,
             untick_at = excluded.untick_at, updated_at = excluded.updated_at`,
          sub, obs.charId, obs.week, obs.taskId,
          next.done, next.done_source, next.done_at,
          next.value, next.value_source, next.value_at, next.untick_at, at));
      }

      const bucket = report.weeks[obs.week] || (report.weeks[obs.week] = {});
      const charBucket = bucket[obs.charId] || (bucket[obs.charId] = {});
      charBucket[obs.taskId] = {
        done: !!next.done, source: next.done_source, doneAt: next.done_at,
        value: next.value, untickAt: next.untick_at,
      };
    }

    /* Boss kills are facts and never retracted here: a kill the game reported
       happened, and the derived task tick arrives as its own observation
       above, from the client that holds the boss list. */
    for (const kill of bosses) {
      if (!kill || !kill.charId || !kill.taskId || !kill.bossId) { report.ignored++; continue; }
      const when = Number(kill.at) || at;
      writes.push(this.#stmt(
        `INSERT INTO boss_kill (sub, char_id, week, task_id, boss_id, source, killed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(sub, char_id, week, task_id, boss_id) DO NOTHING`,
        sub, kill.charId, weekKeyForMoment(anchor, when), kill.taskId,
        kill.bossId, kill.source || null, when));
    }

    /* Collections are account-wide and permanent. Matched on name, because
       the addon's mount journal and the Blizzard profile API return the same
       localized name for the same mount, and the site's task entries already
       carry it. One key all three sides agree on beats three id spaces kept
       in step by hand. */
    for (const item of collections) {
      if (!item || !item.kind || !item.key) { report.ignored++; continue; }
      writes.push(this.#stmt(
        `INSERT INTO collection (sub, kind, key, source, observed_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(sub, kind, key) DO NOTHING`,
        sub, String(item.kind), String(item.key), item.source || null,
        Number(item.at) || at));
    }

    await this.#batch(writes);
    return report;
  }

  /* ── Reading it back ─────────────────────────────────────────────────── */

  /* Everything the client needs to render one week, in one round trip. The
     weekly rows plus the not-weekly ones (the list, custom tasks,
     collections), because a client that has to make four calls to draw a page
     will draw it wrong once in four. */
  async weekState(sub, week) {
    const anchor = await this.anchor(sub);
    week = week || weekKeyFor(anchor);

    const [characters, taskRows, bossRows, listRows, customRows, collectionRows, agenda] =
      await Promise.all([
        this.characters(sub),
        this.#all(
          `SELECT char_id, task_id, done, done_source, done_at, value, value_source, untick_at
             FROM task_state WHERE sub = ? AND week = ?`, sub, week),
        this.#all(
          `SELECT char_id, task_id, boss_id, source, killed_at
             FROM boss_kill WHERE sub = ? AND week = ?`, sub, week),
        this.#all(
          `SELECT char_id, task_id, position, hidden FROM list_entry
            WHERE sub = ? ORDER BY position, task_id`, sub),
        this.#all(
          `SELECT char_id, task_id, name, descr FROM custom_task WHERE sub = ?`, sub),
        this.#all('SELECT kind, key, observed_at FROM collection WHERE sub = ?', sub),
        this.agendaList(sub),
      ]);

    const byChar = {};
    const bucket = (charId) => (byChar[charId] || (byChar[charId] = {
      tasks: {}, bosses: {}, list: [], hidden: {}, custom: [],
    }));

    for (const c of characters) bucket(c.char_id);
    for (const r of taskRows) {
      bucket(r.char_id).tasks[r.task_id] = {
        done: !!r.done, source: r.done_source, doneAt: r.done_at,
        value: r.value, valueSource: r.value_source, untickAt: r.untick_at,
      };
    }
    for (const r of bossRows) {
      const b = bucket(r.char_id).bosses;
      (b[r.task_id] || (b[r.task_id] = {}))[r.boss_id] = r.killed_at;
    }
    for (const r of listRows) {
      if (r.hidden) bucket(r.char_id).hidden[r.task_id] = true;
      else bucket(r.char_id).list.push(r.task_id);
    }
    for (const r of customRows) {
      bucket(r.char_id).custom.push({ id: r.task_id, name: r.name, desc: r.descr || undefined });
    }

    const collections = { mount: [], toy: [], achievement: [] };
    for (const r of collectionRows) {
      (collections[r.kind] || (collections[r.kind] = [])).push(r.key);
    }

    return { week, anchor, characters, byChar, collections, agenda };
  }

  /* Every week this account has rows for, newest first. The thing the blob
     design could not answer at all, and the reason weekly rows are kept
     rather than pruned. */
  async weeks(sub, limit = 104) {
    const rows = await this.#all(
      `SELECT week, COUNT(*) AS tasks, SUM(done) AS done
         FROM task_state WHERE sub = ?
        GROUP BY week ORDER BY week DESC LIMIT ?`, sub, limit);
    return rows.map((r) => ({ week: r.week, tasks: r.tasks, done: r.done || 0 }));
  }

  /* ── The share view, for Tabard ──────────────────────────────────────── */

  /* What /api/share/agenda answers, built from rows.

     Shaped to that endpoint's existing response on purpose: Tabard is a
     separate deployment on its own release cadence, and a change of store
     here should not be a change of contract there. Everything below is the
     same data it already reads, sourced from tables instead of from a
     localStorage blob a browser happened to have pushed.

     "Your List" is the denominator rather than the whole checklist, for the
     reason the card already gives: nobody does all of it, so a percentage
     against everything is always low and never means anything. */
  async shareView(sub, week) {
    const anchor = await this.anchor(sub);
    week = week || weekKeyFor(anchor);

    const [characters, listRows, taskRows] = await Promise.all([
      this.characters(sub),
      this.#all(
        `SELECT char_id, task_id FROM list_entry
          WHERE sub = ? AND hidden = 0 ORDER BY position, task_id`, sub),
      this.#all(
        `SELECT char_id, task_id, done, done_source, value
           FROM task_state WHERE sub = ? AND week = ?`, sub, week),
    ]);

    const state = new Map();
    for (const r of taskRows) state.set(`${r.char_id}|${r.task_id}`, r);

    const tracked = new Map();
    for (const r of listRows) {
      if (!tracked.has(r.char_id)) tracked.set(r.char_id, []);
      tracked.get(r.char_id).push(r.task_id);
    }

    const out = [];
    for (const c of characters) {
      const ids = tracked.get(c.char_id) || [];
      if (!ids.length) continue;
      const items = ids.map((id) => {
        const row = state.get(`${c.char_id}|${id}`);
        return {
          id,
          done: !!(row && row.done),
          value: row && row.value ? row.value : null,
          source: (row && row.done_source) || null,
        };
      });
      out.push({
        name: c.char_id,
        realm: c.realm_slug || null,
        className: c.class_name || null,
        ilvl: c.ilvl || null,
        mythicRating: c.mythic_rating || null,
        tracked: items.length,
        done: items.filter((i) => i.done).length,
        items,
      });
    }

    return { week, characters: out };
  }

  /* ── Your List ───────────────────────────────────────────────────────── */

  /* Replaced wholesale per character, and deliberately: what the member means
     by saving their list is "this is the list now". Merging two would need a
     rule for a task that is in the old one and not the new, and there isn't
     one that is ever right. Scoped to one character so saving on an alt
     cannot touch the main's. */
  async replaceList(sub, charId, entries, customTasks) {
    const at = nowSeconds();
    const writes = [
      this.#stmt('DELETE FROM list_entry WHERE sub = ? AND char_id = ?', sub, charId),
    ];

    (entries || []).forEach((entry, index) => {
      const taskId = typeof entry === 'string' ? entry : entry && entry.taskId;
      if (!taskId) return;
      const hidden = typeof entry === 'object' && entry.hidden ? 1 : 0;
      writes.push(this.#stmt(
        `INSERT INTO list_entry (sub, char_id, task_id, position, hidden, added_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        sub, charId, taskId, index, hidden, at));
    });

    if (customTasks) {
      writes.push(this.#stmt('DELETE FROM custom_task WHERE sub = ? AND char_id = ?', sub, charId));
      for (const task of customTasks) {
        if (!task || !task.id) continue;
        writes.push(this.#stmt(
          `INSERT INTO custom_task (sub, char_id, task_id, name, descr, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          sub, charId, task.id, task.name || task.id, task.desc || null, at));
      }
    }

    await this.#batch(writes);
  }

  /* ── What the addon last handed over, and what it is holding ─────────── */

  async recordLedgerReceipt(sub, envelope) {
    const at = nowSeconds();
    await this.#stmt(
      `INSERT INTO ledger_receipt (sub, addon, generated_at, week, received_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET
         addon = excluded.addon, generated_at = excluded.generated_at,
         week = excluded.week, received_at = excluded.received_at`,
      sub, envelope.addon || null, envelope.generated || null,
      envelope.week || null, at).run();
  }

  async ledgerReceipt(sub) {
    return await this.#first(
      'SELECT addon, generated_at, week, received_at FROM ledger_receipt WHERE sub = ?', sub);
  }

  /* Which list the game client is holding. A hash, not the list: returning
     the site its own data to diff against itself is not what it is for. */
  async recordAgendaList(sub, agenda) {
    const at = nowSeconds();
    await this.#stmt(
      `INSERT INTO agenda_list (sub, sig, week, tasks, imported_at, generated_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET
         sig = excluded.sig, week = excluded.week, tasks = excluded.tasks,
         imported_at = excluded.imported_at, generated_at = excluded.generated_at,
         updated_at = excluded.updated_at`,
      sub, (agenda && agenda.sig) || null, (agenda && agenda.week) || null,
      (agenda && agenda.tasks) || 0, (agenda && agenda.imported) || null,
      (agenda && agenda.generated) || null, at).run();
  }

  async agendaList(sub) {
    const row = await this.#first(
      `SELECT sig, week, tasks, imported_at, generated_at FROM agenda_list WHERE sub = ?`, sub);
    if (!row) return null;
    return {
      sig: row.sig, week: row.week, tasks: row.tasks,
      imported: row.imported_at, generated: row.generated_at,
    };
  }

  /* ── The cutover from the KV blobs ──────────────────────────────────── */

  /* Whether this account's pre-cutover localStorage has been folded into the
     tables above.

     The import is client-driven, and not for convenience: the old blob stored
     boss kills under `taskId + "_" + bossId` concatenated into one string, and
     both halves contain underscores ("vab_h_nekzali"), so splitting it needs
     the boss lists. Those live in the task catalogue, which is a static file
     the client already has and the worker deliberately does not.

     So the client reads its own localStorage once, sends it as observations,
     and this records that it happened. Until it does, readers fall back to the
     blob, which means a member who never opens the site again keeps working
     rather than going quiet. */
  async isMigrated(sub) {
    const row = await this.#first(
      'SELECT migrated_at, weeks, tasks FROM blob_migration WHERE sub = ?', sub);
    return row ? { at: row.migrated_at, weeks: row.weeks, tasks: row.tasks } : null;
  }

  /* Idempotent on purpose. A member who opens the site on three devices at
     once submits three imports; the merge rules make that harmless and this
     keeps the first record of when it happened rather than the last. */
  async markMigrated(sub, summary) {
    const at = nowSeconds();
    await this.#stmt(
      `INSERT INTO blob_migration (sub, migrated_at, weeks, tasks, note)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET
         weeks = MAX(blob_migration.weeks, excluded.weeks),
         tasks = MAX(blob_migration.tasks, excluded.tasks)`,
      sub, at, (summary && summary.weeks) || 0, (summary && summary.tasks) || 0,
      (summary && summary.note) || null).run();
    return await this.isMigrated(sub);
  }

  /* ── Deleting it ─────────────────────────────────────────────────────── */

  /* Revoking has to be one operation, or it is not a thing anyone will
     actually do. Every table keyed by sub, in one batch. */
  async deleteAccount(sub) {
    await this.#batch([
      'task_state', 'boss_kill', 'list_entry', 'custom_task', 'collection',
      'agenda_list', 'ledger_receipt', 'character', 'account', 'blob_migration',
    ].map((table) => this.#stmt(`DELETE FROM ${table} WHERE sub = ?`, sub)));
  }
}
