/* The merge rules, and nothing else.

   Four sources can tick a task and they disagree often enough that the rules
   have to be written down. They used to be written down twice: once in
   js/ledger.js for the browser, and once implicitly in _worker.js where it
   re-derived a week key to parse a blob the browser had written. The rules
   themselves were carefully order-independent, and then the sync layer above
   them replaced the whole localStorage blob on every save, which threw that
   away: two devices open at once meant whoever pushed last erased the other's
   evening.

   So this is one implementation, it runs on the server, and it is a pure
   function of (current row, observation). No I/O, no clock, no storage: the
   caller supplies `at` on the observation, which makes every rule below
   testable by writing down two values and reading the third.

   ── The rules ───────────────────────────────────────────────────────────
   1. Anything a source reports done is done.
   2. A box the member un-ticks stays un-ticked for that week. Without this an
      automatic source re-ticks it on the next sync and the member cannot get
      rid of it, which is the most annoying way automatic completion can fail.
      The member ticking it again clears the tombstone.
   3. An automatic source reporting "not done" says nothing. It has not seen
      the thing; that is not a claim the thing did not happen. Only the member
      can assert an un-tick.
   4. Counters take the maximum across automatic sources, never the latest:
      observations arrive out of order as a matter of course (one of the
      sources is a paste), and latest-wins walks a counter backwards. The
      member is the exception, because they are correcting the number rather
      than reporting it, and a maximum would make a correction downward
      impossible. Their observations are ordered against each other by
      timestamp so two devices do not depend on arrival order.
   5. Attribution goes to the highest-ranked source that has reported it done,
      because the badge answers "why is this ticked" and "you did" is the
      truest answer available when it applies. The timestamp goes to the
      earliest, because that answers a different question: when was this
      done. They can legitimately come from different observations.
*/

/* Higher wins attribution. The member's own word ranks above the game's
   observation not because it is more reliable but because it is what the
   member needs to see: a box they ticked themselves is theirs, and labelling
   it "the armory saw this" would send them to the wrong place when they came
   to ask why. */
export const SOURCE_RANK = {
  member: 4,        // clicked on the site
  'member-game': 3, // ticked on the addon's in-game display
  addon: 2,         // the game reported it, via the addon
  armory: 1,        // the Battle.net profile API reported it
};

export const SOURCES = Object.keys(SOURCE_RANK);

/* The member speaking, on either screen. Only these may un-tick, and only
   these clear a tombstone. */
export function isMemberSource(source) {
  return source === 'member' || source === 'member-game';
}

export function isKnownSource(source) {
  return Object.prototype.hasOwnProperty.call(SOURCE_RANK, source);
}

/* An absent row, so callers never branch on null. A task nobody has touched
   and a task explicitly at zero are the same state, and making every caller
   distinguish them only invites each one to get it wrong. */
export function emptyTaskState() {
  return {
    done: 0, done_source: null, done_at: null,
    value: 0, value_source: null, value_at: null,
    untick_at: null,
  };
}

/* current: a task_state row, or null.
   observation: { done?: boolean, value?: number, source, at }

   Returns { next, changed }. `changed` is false when the observation told us
   nothing new, which is the common case on a re-sync and the signal not to
   write. */
export function mergeTaskObservation(current, observation) {
  const row = { ...emptyTaskState(), ...(current || {}) };
  const next = { ...row };
  const at = Number(observation.at) || 0;
  const source = observation.source;

  // Rule 4. Before the done rules, because a counter reaching its goal is
  // reported as a separate `done` on the same observation and should see the
  // value already merged.
  if (observation.value != null) {
    const value = Math.max(0, Math.floor(Number(observation.value) || 0));

    // The member typing a number is correcting it, so it is set rather than
    // merged: a maximum would make a correction downward impossible, and the
    // site has always let them decrement one by hand. Ordered by the
    // observation's own timestamp rather than by arrival, so two devices
    // cannot depend on which request landed first.
    //
    // An automatic source can still raise it past what they typed, because
    // the game counting eight keys is a fact and four was a guess. That is
    // also what the site did locally before any of this moved server-side, so
    // a correction downward surviving the next sync was never the behaviour
    // and is not being taken away here.
    // Branched on the source rather than combined, deliberately. A member
    // observation that loses on timestamp is finished: falling through to the
    // maximum rule would let a superseded correction of 9 beat the current 3
    // simply because 9 is larger, which is the automatic rule applied to
    // somebody it does not describe.
    let set = false;
    if (isMemberSource(source)) {
      set = (!row.value_at || at >= row.value_at) && value !== row.value;
    } else {
      set = value > row.value;
    }

    if (set) {
      next.value = value;
      next.value_source = source;
      next.value_at = at;
    }
  }

  if (observation.done === true) {
    const tombstoned = row.untick_at != null;

    if (isMemberSource(source)) {
      // Rule 2, second half: their tick, their tombstone to clear.
      next.untick_at = null;
    }

    // Rule 1, subject to rule 2.
    if (isMemberSource(source) || !tombstoned) {
      next.done = 1;
      // Rule 5, the timestamp half: earliest wins, so history says when it
      // was done rather than when it was last confirmed.
      next.done_at = (row.done && row.done_at) ? Math.min(row.done_at, at || row.done_at) : at;
      // Rule 5, the attribution half: highest rank wins.
      const incoming = SOURCE_RANK[source] || 0;
      const held = SOURCE_RANK[row.done_source] || 0;
      if (!row.done || incoming > held) next.done_source = source;
    }
  } else if (observation.done === false) {
    // Rule 3: an automatic source saying nothing happened is not evidence.
    if (isMemberSource(source)) {
      next.done = 0;
      next.done_source = null;
      next.done_at = null;
      // Rule 2, first half. The count behind the box is kept: it came from
      // play, and un-ticking hides the checkmark rather than denying the
      // work. That is also what the site has always done locally.
      next.untick_at = at;
    }
  }

  const changed = next.done !== row.done
    || next.done_source !== row.done_source
    || next.done_at !== row.done_at
    || next.value !== row.value
    || next.value_source !== row.value_source
    || next.value_at !== row.value_at
    || next.untick_at !== row.untick_at;

  return { next, changed };
}

/* ── The reset week ─────────────────────────────────────────────────────
   The one key every weekly row is filed under, so it gets computed in exactly
   one place. US realms reset Tuesday and EU realms Wednesday, and the hour is
   a Blizzard fact rather than something to assert from memory: the anchor is
   learned from Blizzard's own keystone period and stored per account. Until
   the first successful learn every region keeps Tuesday 15:00 UTC, which is
   what this site has always done, so the default is "unchanged" rather than a
   different guess.
------------------------------------------------------------------------- */

export const DEFAULT_RESET_ANCHOR = { day: 2, hour: 15, source: 'default' };

export function validAnchor(anchor) {
  return !!anchor
    && Number.isInteger(anchor.day) && anchor.day >= 0 && anchor.day <= 6
    && Number.isInteger(anchor.hour) && anchor.hour >= 0 && anchor.hour <= 23;
}

export function weekStartMs(anchor, nowMs) {
  const a = validAnchor(anchor) ? anchor : DEFAULT_RESET_ANCHOR;
  const now = new Date(nowMs == null ? Date.now() : nowMs);
  const d = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), a.hour, 0, 0));
  while (d.getUTCDay() !== a.day) d.setUTCDate(d.getUTCDate() - 1);
  if (now < d) d.setUTCDate(d.getUTCDate() - 7);
  return d.getTime();
}

export function weekKeyFor(anchor, nowMs) {
  return new Date(weekStartMs(anchor, nowMs)).toISOString().slice(0, 10);
}

/* Which reset week a moment belongs to, rather than which week a label claims.

   The addon computes its own Tuesday-anchored label because it cannot know
   each region's reset hour, so its label can differ from the site's for the
   same moment. Bucketing by timestamp means an EU member's addon needs no
   configuration, and a payload written twenty minutes ago is not rejected for
   disagreeing about what to call the week it was written in. */
export function weekKeyForMoment(anchor, unixSeconds) {
  if (!unixSeconds) return null;
  return weekKeyFor(anchor, unixSeconds * 1000);
}
