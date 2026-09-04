/* -------------------------------------------------------------------------
   LEDGER-OUT.JS: the other half of the bridge. The site's list, handed to
   the addon.

   ledger.js reads what the game saw. This file writes what the member chose,
   because the two halves answer different questions and only one of them can
   be answered by either side:

     what did I do            the game knows, the site does not
     what am I trying to do   the site knows, the game cannot

   Your List is the second one. It is curated by hand, it lives in the
   browser, and until now the addon had no way to see it: the addon's
   TaskMap.lua carried a hardcoded guess at the site's checklist and nothing
   told it which of those items the member had actually picked. So the addon
   reported on everything it happened to observe and the in-game side of the
   to-do list did not exist.

   This produces a payload the member pastes into `/ledger list import`. The
   addon then knows the list, the section it belongs to, the goal on it and
   what the site already has ticked, which is everything a heads-up display
   needs and nothing more.

   ── Why a paste, and not a file ─────────────────────────────────────────
   The site already holds a directory handle for the WoW folder, so writing
   the list to disk looks free. It is not:

     - SavedVariables files are the game's to write. It rewrites
       PartyLedger.lua wholesale at every logout, so anything the site put
       there is either destroyed or, worse, merged into a file that also
       holds the member's entire grade database. A bad write costs them
       years of records.
     - The other place an addon reads at load is Interface/AddOns, and files
       there are Lua the client executes. A browser page that can write
       executable Lua into the game's addon folder is a code-execution
       channel into the client, opened by a web origin. That it would be
       convenient is not a reason to build it.

   A paste is data, it is inspectable before it is used, and the member is
   the one who moves it. That is the same property that makes the inbound
   direction consent-bearing by construction, and it is worth keeping in
   both directions.

   ── The transport ──────────────────────────────────────────────────────
   Mirrors PLW exactly, deliberately: one rule for both directions.

     AGL1:<base64 of the text>              always readable
     AGL2:<base64 of zlib of the text>      when the browser can deflate

   The document names its own version on its first line, separately from the
   transport, so "which shape is this" and "how is it packed" never get
   confused for each other again.
------------------------------------------------------------------------- */

const AGENDA_LIST_DOC     = 'AGENDALIST';
const AGENDA_LIST_VERSION = 1;

/* Tabs separate fields and newlines separate records, so neither can appear
   in a value. Task names from data-tasks.js contain neither, but custom tasks
   are typed by the member and a stray tab would silently shift every field
   after it. Truncated too: the addon draws these in a fixed-width row, and a
   400-character name is not a name.

   The pipe is stripped rather than escaped. It is WoW's own escape character:
   a literal "|" in a display string starts a colour or texture code and eats
   whatever follows it. Doubling it would be correct for a chat frame and
   wrong for a tooltip line, and the addon should not have to know which
   context each string lands in. */
function agendaListField(value) {
  return String(value == null ? '' : value)
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\|/g, '/')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 120);
}

/* djb2 over the UTF-8 bytes, reduced by a prime under 2^32.

   Deliberately not a bitwise hash: the addon computes the same value in Lua
   5.1, where the arithmetic is doubles and a 32-bit rotate is a library call
   that may or may not be there. Multiply-and-mod stays exact in both
   languages for these magnitudes, so the two sides cannot disagree.

   Its job is to answer one question: is the list in game the list the member
   is looking at? So it needs to change when the list changes and it does not
   need to resist anyone. */
function agendaListSignature(text) {
  const bytes = new TextEncoder().encode(String(text));
  let h = 5381;
  for (let i = 0; i < bytes.length; i++) {
    h = (h * 33 + bytes[i]) % 4294967291;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

/* Every character with something on their list, in the order the site knows
   them. A character with an empty list contributes nothing: the addon would
   have nothing to draw for it, and an empty block only makes the payload
   longer. */
function agendaListCharacters() {
  const chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '[]');
  return chars.filter((c) => {
    const list = JSON.parse(localStorage.getItem('wow_mn_yourlist_' + c) || '[]');
    return list.length > 0;
  });
}

/* One character's selected tasks, resolved against the checklist and the
   member's own additions, in the order the list view shows them.

   `hidden` is honoured for the same reason the Discord card honours it: a
   hidden task is one the member has said they are not doing, and putting it
   on a heads-up display is the opposite of what hiding it meant. */
function agendaListTasksFor(charName) {
  const list    = JSON.parse(localStorage.getItem('wow_mn_yourlist_' + charName) || '[]');
  const hidden  = JSON.parse(localStorage.getItem('wow_mn_hidden_' + charName) || '{}');
  const order   = JSON.parse(localStorage.getItem('wow_mn_ylorder_' + charName) || '[]');
  const custom  = JSON.parse(localStorage.getItem('wow_mn_custom_' + charName) || '[]');

  const weekKey = getWeekKey();
  const done    = JSON.parse(localStorage.getItem('wow_mn_' + charName + '_' + weekKey) || '{}');
  const goals   = JSON.parse(localStorage.getItem('wow_mn_goals_' + charName + '_' + weekKey) || '{}');

  const selected = new Set(list);
  const rank = new Map(order.map((id, i) => [id, i]));

  /* The same comparator the grouped list view uses: finished items sink, and
     everything else keeps the order the member dragged it into. Reproduced
     rather than shared because it lives inside a render function over DOM
     nodes, and what matters is that the two agree. If the site's sort ever
     changes, this is the other place to change. */
  const inListOrder = (a, b) => {
    const aDone = a.done ? 1 : 0, bDone = b.done ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    const ra = rank.has(a.id) ? rank.get(a.id) : 999;
    const rb = rank.has(b.id) ? rank.get(b.id) : 999;
    return ra - rb;
  };

  const row = (task, id, sectionId) => ({
    id,
    section: sectionId,
    cadence: task.cadence || 'weekly',
    max: (task.goal && task.goal.max) || 0,
    label: (task.goal && task.goal.label) || '',
    done: !!done[id],
    value: goals[id] || 0,
    name: task.name,
  });

  const groups = [];
  const sections = (typeof activeSections === 'function')
    ? activeSections()
    : (typeof SECTIONS !== 'undefined' ? SECTIONS : []);

  for (const sec of sections) {
    const rows = sec.tasks
      .filter((t) => selected.has(t.id) && !hidden[t.id])
      .map((t) => row(t, t.id, sec.id))
      .sort(inListOrder);
    if (rows.length) {
      groups.push({
        section: { id: sec.id, title: sec.title, priority: sec.priority || 9 },
        rows,
      });
    }
  }

  /* Custom tasks carry a "custom_" prefix in Your List but not in their own
     storage. That is resolved here, once, so the addon only ever sees the id
     the site ticks boxes under. Best in Slot imports get their own group for
     the same reason the site gives them one: there can be a dozen of them and
     they are not really weekly tasks. */
  const forCustom = (isBis) => custom
    .filter((t) => t.id.startsWith('bis_') === isBis
                && selected.has('custom_' + t.id) && !hidden['custom_' + t.id])
    .map((t) => row(t, 'custom_' + t.id, isBis ? 'bis' : 'custom'))
    .sort(inListOrder);

  const bisRows = forCustom(true);
  if (bisRows.length) {
    groups.push({ section: { id: 'bis', title: 'Best in Slot', priority: 9 }, rows: bisRows });
  }
  const customRows = forCustom(false);
  if (customRows.length) {
    groups.push({ section: { id: 'custom', title: 'Custom', priority: 9 }, rows: customRows });
  }

  return groups;
}

/* The document itself: line-oriented, tab-separated, one record per line.

   Not JSON, and for one reason: the consumer is a WoW addon, and the addon
   would need a JSON parser it does not have. A hand-written one in Lua is a
   few hundred lines whose failure mode on a truncated paste is an error
   inside a recursive descent, at a call depth that tells the member nothing.
   A split on tabs cannot fail that way. The line prefix says what each
   record is, unknown prefixes are skipped, and a version bump can add a
   field to the end of any line without breaking a reader that stops early.

   Field order per line is fixed and documented in INTEGRATION.md. */
function buildAgendaListText(charNames) {
  charNames = charNames || agendaListCharacters();

  const out = [];
  out.push([AGENDA_LIST_DOC, AGENDA_LIST_VERSION].join('\t'));
  out.push(['w', getWeekKey()].join('\t'));
  out.push(['g', Math.floor(Date.now() / 1000)].join('\t'));
  out.push(['h', (typeof location !== 'undefined' && location.host) || 'agenda.7donuts.dev'].join('\t'));

  const emitted = new Set();
  const blocks = [];
  let taskCount = 0, charCount = 0;

  for (const charName of charNames) {
    const groups = agendaListTasksFor(charName);
    if (!groups.length) continue;
    charCount++;

    // Section records are account-wide: two characters starring tasks from
    // the same section should not put that section in the payload twice.
    for (const g of groups) {
      if (emitted.has(g.section.id)) continue;
      emitted.add(g.section.id);
      out.push(['s', agendaListField(g.section.id), g.section.priority,
                agendaListField(g.section.title)].join('\t'));
    }

    const lines = [['c',
      ledgerCharKey(charDisplayName(charName), loadCharRealmSlug(charName)),
      agendaListField(charDisplayName(charName)),
      agendaListField(loadCharRealmSlug(charName) || ''),
    ].join('\t')];

    // Emitted grouped and in order, so the addon draws the payload as it
    // arrives rather than re-deriving an order the site already decided.
    for (const g of groups) {
      for (const r of g.rows) {
        lines.push(['t', agendaListField(r.id), agendaListField(r.section),
                    agendaListField(r.cadence), r.max, agendaListField(r.label),
                    r.done ? 1 : 0, r.value, agendaListField(r.name)].join('\t'));
        taskCount++;
      }
    }
    blocks.push(lines.join('\n'));
  }

  const text = out.join('\n') + (blocks.length ? '\n' + blocks.join('\n') : '') + '\n';
  return { text, characters: charCount, tasks: taskCount,
           signature: agendaListSignature(text) };
}

/* btoa takes a string of char codes 0-255, and refuses anything above U+00FF.
   Task names carry curly apostrophes, so both encoders below go through UTF-8
   bytes first and then through here. */
function bytesToB64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function agendaListDeflate(text) {
  const bytes = new TextEncoder().encode(text);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return bytesToB64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

function agendaListB64(text) {
  return bytesToB64(new TextEncoder().encode(text));
}

/* The string the member pastes. Deflated where the browser can, and plain
   where it cannot, because a longer paste is a worse experience and a failed
   one is no experience at all. */
async function encodeAgendaList(charNames) {
  const built = buildAgendaListText(charNames);

  if (typeof CompressionStream === 'function') {
    try {
      return { ...built, payload: 'AGL2:' + await agendaListDeflate(built.text),
               transport: 'AGL2' };
    } catch (_) {
      // Fall through: an unexplained failure in the compressor is not a
      // reason to hand the member nothing.
    }
  }
  return { ...built, payload: 'AGL1:' + agendaListB64(built.text), transport: 'AGL1' };
}

/* -------------------------------------------------------------------------
   Is the list in game the list on screen?

   The addon reports the signature of whatever list it currently holds in its
   own envelope. Comparing it against the list as it stands now is the only
   way to tell the member that the heads-up display they are looking at in
   game is showing them a list they have since changed. Without this the
   answer to "why isn't my new task in the HUD" is invisible.
------------------------------------------------------------------------- */

function agendaListStatus() {
  const state = loadLedgerState();
  const held  = state.agendaSignature || null;
  const built = buildAgendaListText();

  if (!built.tasks) {
    return { state: 'empty',
             text: 'Nothing on your list yet. Star a few tasks and they can go in game.' };
  }
  if (!held) {
    return { state: 'never', signature: built.signature, tasks: built.tasks,
             text: 'The addon has not been given your list yet.' };
  }
  if (held === built.signature) {
    return { state: 'current', signature: built.signature, tasks: built.tasks,
             text: 'The list in game matches this one.' };
  }
  return { state: 'stale', signature: built.signature, tasks: built.tasks,
           text: 'Your list has changed since you last put it in game. '
               + 'Paste it again to bring the in-game display up to date.' };
}

/* Recorded from the inbound envelope, so the comparison above has something
   to compare against. Called by applyLedgerEnvelope. */
function noteAgendaListInGame(agenda) {
  if (!agenda) return;
  const state = loadLedgerState();
  state.agendaSignature = agenda.sig || null;
  state.agendaImported  = agenda.imported || null;
  state.agendaTasks     = agenda.tasks || 0;
  saveLedgerState(state);
}
