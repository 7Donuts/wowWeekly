/* A D1 binding backed by real SQLite.

   node:sqlite means the migrations and every statement in worker/store.js are
   actually executed rather than matched against a fake. That matters more than
   usual here: the store leans on ON CONFLICT upserts, COALESCE column
   preservation and multi-statement batches, and a hand-written stub would
   happily accept SQL that D1 rejects. What it cannot check is D1's own
   dialect quirks, so treat a passing suite as "the SQL is valid SQLite", not
   as a deployment.

   The surface mirrored here is the part of D1 the store uses:
   prepare().bind().first()/.all()/.run(), and batch(). all() returns
   { results } because that is what D1 returns and the store unwraps it. */

const fs = require('node:fs');
const path = require('node:path');
const sqlite = require('node:sqlite');

const MIGRATIONS = path.join(__dirname, '..', 'migrations');

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
}

function makeD1() {
  const db = new sqlite.DatabaseSync(':memory:');
  for (const file of migrationFiles()) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }

  // D1 rejects undefined and booleans; so does node:sqlite, differently.
  // Normalising here would hide a store that passes them, which is a real bug
  // in production, so instead it throws with the statement that did it.
  const check = (sql, args) => args.map((a) => {
    if (a === undefined) throw new Error('bound undefined in: ' + sql);
    if (typeof a === 'boolean') throw new Error('bound a boolean in: ' + sql);
    return a;
  });

  const statement = (sql, args = []) => ({
    bind: (...a) => statement(sql, a),
    async first() {
      const row = db.prepare(sql).get(...check(sql, args));
      return row === undefined ? null : row;
    },
    async all() {
      return { results: db.prepare(sql).all(...check(sql, args)), success: true };
    },
    async run() {
      const out = db.prepare(sql).run(...check(sql, args));
      return { success: true, meta: { changes: Number(out.changes) } };
    },
  });

  return {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    // Test-only escape hatch for asserting on rows the store has no reader for.
    query: (sql, ...args) => db.prepare(sql).all(...args),
  };
}

module.exports = { makeD1, migrationFiles };
