/* -----------------------------------------------
   APP — main application logic for index.html
   Depends on (loaded before this file):
     data-tasks.js, data-events.js, data-classes.js,
     storage.js, confetti.js, theme.js
----------------------------------------------- */

/* -------------------------------------------
   STORAGE — namespaced localStorage abstraction
   All keys follow the prefix "wow_mn_" to avoid
   collisions. Change the schema here and it
   propagates to every page that loads this file.
------------------------------------------- */
function getWeekKey() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0));
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() - 1);
  if (now < d) d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

function storageKey() { return 'wow_mn_' + currentChar + '_' + getWeekKey(); }
function loadDone()   { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); }
function saveDone(d)  { localStorage.setItem(storageKey(), JSON.stringify(d)); }

function hiddenKey()      { return 'wow_mn_hidden_' + currentChar; }
function loadHidden()     { return JSON.parse(localStorage.getItem(hiddenKey()) || '{}'); }
function saveHidden(h)    { localStorage.setItem(hiddenKey(), JSON.stringify(h)); }

function yourListKey()      { return 'wow_mn_yourlist_' + currentChar; }
function loadYourList()     { return JSON.parse(localStorage.getItem(yourListKey()) || '[]'); }
function saveYourList(l)    { localStorage.setItem(yourListKey(), JSON.stringify(l)); }

function notesKey()         { return 'wow_mn_notes_' + currentChar; }
function loadNotes()        { return JSON.parse(localStorage.getItem(notesKey()) || '{}'); }
function saveNotes(n)       { localStorage.setItem(notesKey(), JSON.stringify(n)); }

function yourListOrderKey()  { return 'wow_mn_ylorder_' + currentChar; }
function loadYourListOrder() { return JSON.parse(localStorage.getItem(yourListOrderKey()) || '[]'); }
function saveYourListOrder(o){ localStorage.setItem(yourListOrderKey(), JSON.stringify(o)); }

function bossKey()           { return 'wow_mn_bosses_' + currentChar + '_' + getWeekKey(); }
function loadBossKills()     { return JSON.parse(localStorage.getItem(bossKey()) || '{}'); }
function saveBossKills(b)    { localStorage.setItem(bossKey(), JSON.stringify(b)); }

function toggleBoss(taskId, bossId) {
  const kills = loadBossKills();
  const k = taskId + '_' + bossId;
  kills[k] = !kills[k];
  saveBossKills(kills);

  // Auto-check task if all bosses killed; auto-uncheck if any unchecked
  const task = SECTIONS.flatMap(s => s.tasks).find(t => t.id === taskId);
  if (task && task.bosses) {
    const allKilled = task.bosses.every(b => kills[taskId + '_' + b.id]);
    const done = loadDone();
    if (allKilled) done[taskId] = true;
    else delete done[taskId];
    saveDone(done);
  }
  render();
}

function goalsKey()          { return 'wow_mn_goals_' + currentChar + '_' + getWeekKey(); }
function loadGoals()         { return JSON.parse(localStorage.getItem(goalsKey()) || '{}'); }
function saveGoals(g)        { localStorage.setItem(goalsKey(), JSON.stringify(g)); }

/* ── CHAR PREFS (non-weekly, per-character settings) ── */
function charPrefsKey()      { return 'wow_mn_prefs_' + currentChar; }
function loadCharPrefs()     { return JSON.parse(localStorage.getItem(charPrefsKey()) || '{}'); }
function saveCharPref(k, v)  { const p = loadCharPrefs(); p[k] = v; localStorage.setItem(charPrefsKey(), JSON.stringify(p)); }
function getCharPref(k, def) { return loadCharPrefs()[k] ?? def; }

/* ── DELVE TIER SELECTOR ── */
function renderTierSelector(taskId) {
  const cur = getCharPref('delveTier', 7);
  const gearLabel = cur >= 8 ? 'Hero (ilvl 259–276)' : 'Champion (ilvl 246–263)';
  const gearColor = cur >= 8 ? 'var(--void-glow)' : 'var(--light-gold)';
  let btns = '';
  for (let t = 1; t <= 11; t++) {
    btns += '<button class="tier-btn' + (cur === t ? ' active' : '') + '" onclick="setDelveTier(' + t + ',\'' + taskId + '\')">T' + t + '</button>';
  }
  return '<div class="tier-selector" onclick="event.stopPropagation()">'
    + '<span class="tier-label">Your max Delve tier:</span>'
    + '<div class="tier-btns">' + btns + '</div>'
    + '<span class="tier-gear-label" style="color:' + gearColor + ';">→ ' + gearLabel + '</span>'
    + '</div>';
}

function setDelveTier(tier, taskId) {
  saveCharPref('delveTier', tier);
  render();
}

function historyKey(charName) { return 'wow_mn_history_' + (charName || currentChar); }
function loadHistory(charName) { return JSON.parse(localStorage.getItem(historyKey(charName)) || '[]'); }
function saveHistory(entries, charName) { localStorage.setItem(historyKey(charName), JSON.stringify(entries)); }

function snapshotWeekForChar(charName, weekKey) {
  // Compute done/total for this character's weekKey
  const done    = JSON.parse(localStorage.getItem('wow_mn_' + charName + '_' + weekKey) || '{}');
  const hidden  = JSON.parse(localStorage.getItem('wow_mn_hidden_' + charName) || '{}');
  const custom  = JSON.parse(localStorage.getItem('wow_mn_custom_' + charName) || '[]');
  let total = 0, completed = 0;
  const sections = {};
  SECTIONS.forEach(sec => {
    let secTotal = 0, secDone = 0;
    sec.tasks.filter(t => !hidden[t.id]).forEach(t => {
      total++; secTotal++;
      if (done[t.id]) { completed++; secDone++; }
    });
    if (secTotal > 0) sections[sec.id] = { done: secDone, total: secTotal, title: sec.title };
  });
  const nonBisCustom = custom.filter(t => !t.id.startsWith('bis_'));
  if (nonBisCustom.length) {
    let cTotal = 0, cDone = 0;
    nonBisCustom.forEach(t => {
      total++; cTotal++;
      if (done['custom_' + t.id]) { completed++; cDone++; }
    });
    sections['custom'] = { done: cDone, total: cTotal, title: 'Custom Tasks' };
  }
  if (total === 0) return; // nothing to record
  const history = loadHistory(charName);
  // Avoid duplicate entries for same week
  if (!history.find(e => e.week === weekKey)) {
    history.unshift({ week: weekKey, done: completed, total, sections });
    if (history.length > 52) history.pop(); // keep ~1 year
    saveHistory(history, charName);
  }
}


function customStorageKey() { return 'wow_mn_custom_' + currentChar; }
function loadCustomTasks()  { return JSON.parse(localStorage.getItem(customStorageKey()) || '[]'); }
function saveCustomTasks(t) { localStorage.setItem(customStorageKey(), JSON.stringify(t)); }


/* ═══════════════════════════════════════════
   APP STATE — global mutable state for the
   current session. Not persisted here; the
   storage.js layer handles persistence.
   Note: isLightMode and isCompact live in
   theme.js so they apply before first paint.
═══════════════════════════════════════════ */
let characters      = JSON.parse(localStorage.getItem('wow_midnight_chars') || '["Main"]');
let currentChar     = characters[0] || 'Main';
let activeFilters   = new Set(['yourlist']);
let activeTagFilter = '';               // 'tag-vault' | 'tag-gold' | 'tag-new' | ''
let collapsed       = {};
let revealHidden    = false;
let editingYourList = false;
let yourListGrouped = localStorage.getItem('wow_mn_yl_grouped') !== 'false'; // default grouped
let searchQuery     = '';
let lastChanceMode  = false; // session-only urgency mode

const FUNCTIONAL_TAGS = new Set(['tag-vault', 'tag-gold', 'tag-new']);

function onSearchInput(val) {
  searchQuery = val.trim().toLowerCase();
  document.getElementById('search-clear-btn').style.display = searchQuery ? '' : 'none';
  if (searchQuery && !activeFilters.has('all') && !activeFilters.has('yourlist')) {
    activeFilters = new Set(['all']);
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
    });
  }
  render();
}

function clearSearch() {
  searchQuery = '';
  const inp = document.getElementById('task-search');
  if (inp) inp.value = '';
  document.getElementById('search-clear-btn').style.display = 'none';
  document.getElementById('search-result-count').textContent = '';
  render();
}

function toggleYourListView() {
  yourListGrouped = !yourListGrouped;
  localStorage.setItem('wow_mn_yl_grouped', yourListGrouped);
  render();
}


/* ═══════════════════════════════════════════
   RENDER
═══════════════════════════════════════════ */
const PRIORITY_META = {
  1: ['p1', '⬡ Do First: highest weekly value'],
  2: ['p2', '◈ Important: fill out your week'],
  3: ['p3', '◇ Optional: collector & side content'],
};

function tagLabel(cls) {
  const m = {
    'tag-vault':'Vault','tag-raid':'Raid','tag-mythic':'Mythic+','tag-delve':'Delve',
    'tag-void':'Void','tag-world':'World','tag-gold':'Currency',
    'tag-pvp':'PvP','tag-optional':'Optional','tag-housing':'Housing','tag-new':'12.0.5'
  };
  return m[cls] || cls;
}

function highlightMatch(text, query) {
  if (!query || !text) return text || '';
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return text;
  return text.slice(0, idx)
    + `<span class="search-highlight">${text.slice(idx, idx + query.length)}</span>`
    + highlightMatch(text.slice(idx + query.length), query);
}

function updateSearchResultCount(matched, total) {
  const el = document.getElementById('search-result-count');
  if (!el) return;
  if (!searchQuery) { el.textContent = ''; el.className = 'search-result-count'; return; }
  if (matched === 0) { el.textContent = 'No results'; el.className = 'search-result-count no-results'; return; }
  el.textContent = `${matched} of ${total} tasks`;
  el.className = 'search-result-count has-results';
}

/* ── SECTION TASK HTML (main list + edit mode) — pure string concat, no nested backticks ── */
function sectionTaskHtml(t, done, hidden, yourList, goals, bossKills, notes) {
  const id = t.id;
  const goalDef = t.goal;
  const goalVal = goalDef ? (goals[id] || 0) : null;

  let milestoneNote = '';
  if (goalDef && goalDef.milestones) {
    const passed = goalDef.milestones.filter(m => goalVal >= m.at);
    if (passed.length) milestoneNote = passed[passed.length - 1].note;
  }

  let goalHtml = '';
  if (goalDef && !editingYourList) {
    const gUncapped = !goalDef.max;
    const gComplete = !gUncapped && goalVal >= goalDef.max;
    const gMaxHtml  = gUncapped ? '' : '<span class="goal-max"> / ' + goalDef.max + '</span>';
    goalHtml = '<div class="goal-tracker" onclick="event.stopPropagation()">'
      + '<button class="goal-btn" onclick="adjustGoal(\'' + id + '\',' + goalDef.max + ',-1)">−</button>'
      + '<span class="goal-val ' + (gComplete ? 'goal-complete' : '') + '">' + goalVal + gMaxHtml + '</span>'
      + '<button class="goal-btn" onclick="adjustGoal(\'' + id + '\',' + goalDef.max + ',1)">+</button>'
      + '<span class="goal-label">' + goalDef.label + '</span>'
      + '</div>';
  }

  let bossHtml = '';
  if (t.bosses && !editingYourList) {
    bossHtml = '<div class="boss-bubbles">';
    if (t.diff) bossHtml += '<span class="diff-badge diff-' + t.diff.toLowerCase() + '">' + t.diff + '</span>';
    t.bosses.forEach(function(b) {
      const killed = !!(bossKills || {})[id + '_' + b.id];
      bossHtml += '<button class="boss-bubble' + (killed ? ' killed' : '') + '"'
        + ' title="' + b.name + ': click to mark killed"'
        + ' onclick="event.stopPropagation();toggleBoss(\'' + id + '\',\'' + b.id + '\')"'
        + ' oncontextmenu="event.preventDefault();window.open(\'' + b.url + '\',\'_blank\')">'
        + b.name + '</button>';
    });
    bossHtml += '</div>';
  }

  let tagsHtml = '';
  if (t.tags && t.tags.length) {
    const visibleTags = t.tags.filter(tg => FUNCTIONAL_TAGS.has(tg));
    if (visibleTags.length) {
      tagsHtml = '<div class="task-tags">'
        + visibleTags.map(function(tg) {
            const isActive = activeTagFilter === tg;
            return '<span class="tag ' + tg + (isActive ? ' tag-filter-active' : '') + '"'
              + ' onclick="event.stopPropagation();filterByTag(\'' + tg + '\')"'
              + ' title="' + (isActive ? 'Clear filter' : 'Filter: ' + tagLabel(tg)) + '">'
              + tagLabel(tg) + (isActive ? ' ×' : '')
              + '</span>';
          }).join('')
        + '</div>';
    }
  }

  const hn = highlightMatch(t.name, searchQuery);
  const hd = t.desc ? highlightMatch(t.desc, searchQuery) : '';
  const inList = yourList.has(id);
  const isDone = !!done[id];
  const isHidden = !!hidden[id];

  const checkClick = editingYourList
    ? 'toggleYourListTask(\'' + id + '\')'
    : 'toggle(\'' + id + '\',this)';

  let rightCol = '';
  if (editingYourList) {
    rightCol = '<span style="flex-shrink:0;font-size:13px;color:' + (inList ? 'var(--light-gold)' : 'var(--text-muted)') + ';">'
      + (inList ? '⭐' : '☆') + '</span>';
  } else {
    rightCol = '<div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0;align-items:center;">'
      + (inList ? '<span style="font-size:13px;color:var(--light-gold);line-height:1;" title="In Your List">⭐</span>' : '')
      + noteBtnHtml(id, notes)
      + '<button class="task-hide" title="' + (isHidden ? 'Unhide task' : 'Hide task') + '" onclick="toggleHideTask(event,\'' + id + '\')">' + (isHidden ? '👁' : '🚫') + '</button>'
      + '</div>';
  }

  const _editSelClass = editingYourList && inList ? ' yl-edit-selected' : '';
  const _editCardAttrs = editingYourList
    ? ' onclick="toggleYourListTask(\'' + id + '\')" style="cursor:pointer;"'
    : '';
  return '<div class="task' + (isDone ? ' done' : '') + (isHidden ? ' task-hidden' : '') + (inList ? ' in-yourlist' : '') + _editSelClass + '"' + _editCardAttrs + '>'
    + '<div class="task-check" onclick="event.stopPropagation();' + checkClick + '" style="cursor:pointer;"></div>'
    + '<div class="task-body">'
    + '<div class="task-name">' + _bisTaskNameHtml(t.name, searchQuery) + '</div>'
    + (hd ? '<div class="task-desc">' + hd + '</div>' : '')
    + (milestoneNote ? '<div class="milestone-note">' + milestoneNote + '</div>' : '')
    + (id === 'm1' ? _m1VaultPreviewHtml() : '')
    + tagsHtml
    + (t.tierSelector && !editingYourList ? renderTierSelector(id) : '')
    + bossHtml
    + (!editingYourList ? noteHtml(id, notes) : '')
    + '</div>'
    + goalHtml
    + rightCol
    + '</div>';
}

/* ── YOUR LIST EDIT-MODE TASK (remove toggle, shown on yourlist tab while editing) ── */
function ylEditTaskHtml(t) {
  const id = t.id;
  return '<div class="task yl-task yl-edit-task yl-edit-selected" data-id="' + id + '"'
    + ' onclick="removeFromYourList(\'' + id + '\')" style="cursor:pointer;">'
    + '<div class="task-body" style="flex:1;">'
    + '<div class="task-name">' + (t.name || '') + '</div>'
    + (t.sectionTitle ? '<div style="font-size:12px;color:var(--text-muted);font-style:italic;margin-top:2px;">' + (t.sectionIcon || '') + ' ' + t.sectionTitle + '</div>' : '')
    + '</div>'
    + '<button onclick="event.stopPropagation();removeFromYourList(\'' + id + '\')" title="Remove from Your List" style="'
    + 'flex-shrink:0;background:transparent;border:1px solid rgba(192,83,74,0.35);border-radius:4px;'
    + 'color:#e07068;font-size:13px;padding:3px 8px;cursor:pointer;transition:all 0.15s;white-space:nowrap;"'
    + ' onmouseover="this.style.background=\'rgba(192,83,74,0.12)\'" onmouseout="this.style.background=\'transparent\'">'
    + '✕ Remove</button>'
    + '</div>';
}

function removeFromYourList(id) {
  const list = loadYourList();
  const idx  = list.indexOf(id);
  if (idx !== -1) { list.splice(idx, 1); saveYourList(list); }
  render();
}

/* ── BIS GRID — always renders all 16 standard slots so positions never shift ── */
// Interleaved order mirrors WoW character sheet: left col (Head→Wrists) / right col (Hands→Ring 2)
const _BIS_GRID_SLOTS = [
  'Head',     'Hands',
  'Neck',     'Waist',
  'Shoulders','Legs',
  'Back',     'Feet',
  'Chest',    'Ring 1',
  'Wrists',   'Ring 2',
  'Trinket 1','Trinket 2',
  'Main Hand','Off Hand',
];

function renderBisGrid(tasks, done) {
  const cache  = JSON.parse(localStorage.getItem('wow_mn_item_icons') || '{}');
  const bySlot = {};
  tasks.forEach(t => {
    const m = (t.name || '').match(/^\[([^\]]+)\]/);
    if (m && !bySlot[m[1]]) bySlot[m[1]] = t;
    // Shield and Ranged fall into Off Hand / Main Hand columns
    if (m && m[1] === 'Shield'  && !bySlot['Off Hand'])  bySlot['Off Hand']  = t;
    if (m && m[1] === 'Ranged'  && !bySlot['Main Hand']) bySlot['Main Hand'] = t;
  });

  return _BIS_GRID_SLOTS.map(slot => {
    const t = bySlot[slot];
    if (!t) {
      const ph = _BIS_SLOT_ICONS[slot]
        ? '<img src="' + _BIS_SLOT_ICONS[slot] + '" class="bis-grid-icon bis-task-icon--placeholder" style="opacity:0.18;" alt="">'
        : '<div class="bis-grid-icon"></div>';
      return '<div class="bis-grid-card bis-grid-empty" onclick="openBisSlotCreate(\'' + slot + '\')" title="Add item for ' + slot + '">' + ph
        + '<div class="bis-grid-info"><div class="bis-grid-slot">' + slot + '</div>'
        + '<div class="bis-grid-name bis-grid-add">+ Add item</div></div></div>';
    }
    const id     = t.id;
    const isDone = !!done[id];
    const m2     = (t.name || '').match(/^\[([^\]]+)\]\s*(.+)$/);
    const item   = m2 ? m2[2] : (t.name || '');
    const apiIcon = cache[item.toLowerCase()];
    const iconSrc = apiIcon || _BIS_SLOT_ICONS[slot] || '';
    const iconHtml = iconSrc
      ? '<img src="' + escHtml(iconSrc) + '" class="bis-grid-icon' + (apiIcon ? '' : ' bis-task-icon--placeholder') + '" alt="' + escHtml(slot) + '">'
      : '';
    return '<div class="task bis-grid-card' + (isDone ? ' done' : '') + '">'
      + '<div class="task-check" onclick="event.stopPropagation();toggle(\'' + id + '\',this)" style="cursor:pointer;flex-shrink:0;"></div>'
      + iconHtml
      + '<div class="bis-grid-info">'
      + '<div class="bis-grid-slot">' + escHtml(slot) + '</div>'
      + '<div class="bis-grid-name" title="' + escHtml(item) + '">' + escHtml(item) + '</div>'
      + '</div>'
      + '<button class="bis-grid-edit-btn" onclick="event.stopPropagation();openBisEditModal(event,\'custom_' + id + '\')" title="Edit item">✏</button>'
      + '</div>';
  }).join('');
}

/* ── YOUR LIST TASK HTML HELPER (shared by grouped + flat views) ── */
function ylTaskHtml(t, done, goals, notes, bossKills) {
  const id = t.id;
  const goalDef = t.goal;
  const goalVal = goalDef ? (goals[id] || 0) : null;

  let milestoneNote = '';
  if (goalDef && goalDef.milestones) {
    const passed = goalDef.milestones.filter(m => goalVal >= m.at);
    if (passed.length) milestoneNote = passed[passed.length - 1].note;
  }

  let goalHtml = '';
  if (goalDef) {
    const gUncapped = !goalDef.max;
    const gComplete = !gUncapped && goalVal >= goalDef.max;
    const gMaxHtml  = gUncapped ? '' : '<span class="goal-max"> / ' + goalDef.max + '</span>';
    goalHtml = '<div class="goal-tracker" onclick="event.stopPropagation()">'
      + '<button class="goal-btn" onclick="adjustGoal(\'' + id + '\',' + goalDef.max + ',-1)">−</button>'
      + '<span class="goal-val ' + (gComplete ? 'goal-complete' : '') + '">' + goalVal + gMaxHtml + '</span>'
      + '<button class="goal-btn" onclick="adjustGoal(\'' + id + '\',' + goalDef.max + ',1)">+</button>'
      + '<span class="goal-label">' + goalDef.label + '</span>'
      + '</div>';
  }

  let bossHtml = '';
  if (t.bosses) {
    bossHtml = '<div class="boss-bubbles">';
    if (t.diff) bossHtml += '<span class="diff-badge diff-' + t.diff.toLowerCase() + '">' + t.diff + '</span>';
    t.bosses.forEach(function(b) {
      const killed = !!(bossKills || {})[id + '_' + b.id];
      bossHtml += '<button class="boss-bubble' + (killed ? ' killed' : '') + '"'
        + ' onclick="event.stopPropagation();toggleBoss(\'' + id + '\',\'' + b.id + '\')"'
        + ' oncontextmenu="event.preventDefault();window.open(\'' + b.url + '\',\'_blank\')">'
        + b.name + '</button>';
    });
    bossHtml += '</div>';
  }

  let sectionTag = '';
  if (t.sectionTitle && !yourListGrouped) {
    sectionTag = '<div class="task-tags" style="margin-top:0.35rem;">'
      + '<span class="tag" style="background:rgba(201,168,76,0.1);color:var(--light-gold);border-color:rgba(201,168,76,0.25);font-size:10px;">' + t.sectionIcon + ' ' + t.sectionTitle + '</span>'
      + '</div>';
  }

  const hn = highlightMatch(t.name, searchQuery);
  const hd = t.desc ? highlightMatch(t.desc, searchQuery) : '';

  const taskHtml = '<div class="task yl-task' + (done[id] ? ' done' : '') + '" draggable="true" data-id="' + id + '"'
    + ' ondragstart="ylDragStart(event)" ondragover="ylDragOver(event)" ondrop="ylDrop(event)" ondragend="ylDragEnd(event)">'
    + '<div class="yl-drag-handle" onclick="event.stopPropagation()" title="Drag to reorder">⠿</div>'
    + '<div class="task-check" onclick="event.stopPropagation();toggle(\'' + id + '\',this)" style="cursor:pointer;"></div>'
    + '<div class="task-body">'
    + '<div class="task-name">' + _bisTaskNameHtml(t.name, searchQuery) + '</div>'
    + (hd ? '<div class="task-desc">' + hd + '</div>' : '')
    + (milestoneNote ? '<div class="milestone-note">' + milestoneNote + '</div>' : '')
    + (id === 'm1' ? _m1VaultPreviewHtml() : '')
    + (t.tierSelector ? renderTierSelector(id) : '')
    + bossHtml
    + sectionTag
    + noteHtml(id, notes)
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0;">'
    + noteBtnHtml(id, notes)
    + (id.startsWith('custom_bis_') ? '<button class="task-hide" title="Edit item" onclick="openBisEditModal(event,\'' + id + '\')">✏️</button>' : '')
    + '</div>'
    + goalHtml
    + '</div>';
  return taskHtml + (id === 'm1' ? renderMythicPlusRunsHtml() : '');
}

/* ── MYTHIC+ VAULT PREVIEW ── */

// Key level → [minKey, track label, upgrade #, upgrade max, ilvl, color]
// Source: Midnight Season 1 Great Vault reward table
const _M_VAULT_TABLE = [
  [2,  'Hero', 1, 6, 259, '#a335ee'],  // keys 2–3
  [4,  'Hero', 2, 6, 263, '#a335ee'],  // keys 4–5
  [6,  'Hero', 3, 6, 266, '#a335ee'],  // key 6
  [7,  'Hero', 4, 6, 269, '#a335ee'],  // keys 7–9
  [10, 'Myth', 1, 6, 272, '#ff8000'],  // keys 10+
];

function _vaultRewardForKey(keyLevel) {
  if (!keyLevel || keyLevel < 2) return null;
  // Find the highest bracket that keyLevel meets
  let row = _M_VAULT_TABLE[0];
  for (const r of _M_VAULT_TABLE) {
    if (keyLevel >= r[0]) row = r;
    else break;
  }
  return { track: row[1], upLevel: row[2], upMax: row[3], ilvl: row[4], color: row[5] };
}

function _m1VaultPreviewHtml() {
  if (typeof loadArmoryData !== 'function') return '';
  const armory = loadArmoryData(currentChar);
  const weeklyData = armory?.weeklyRuns;
  if (!weeklyData || weeklyData.week !== getWeekKey()) return '';

  // Sort runs highest key first
  const sorted = [...weeklyData.runs].sort((a, b) => b.mythic_level - a.mythic_level);
  const total  = sorted.length;

  const SLOTS = [
    { label: 'Slot 1', runIdx: 0, needed: 1  },
    { label: 'Slot 2', runIdx: 3, needed: 4  },
    { label: 'Slot 3', runIdx: 7, needed: 8  },
  ];

  const rows = SLOTS.map(s => {
    const unlocked = total >= s.needed;
    if (unlocked) {
      const run = sorted[s.runIdx] || sorted[sorted.length - 1];
      const r   = _vaultRewardForKey(run.mythic_level);
      if (!r) return '';
      return '<div class="vault-slot">'
        + '<span class="vault-slot-label">🔓 ' + s.label + '</span>'
        + '<span class="vault-slot-track" style="color:' + r.color + '">'
        + r.track + ' ' + r.upLevel + '/' + r.upMax + '</span>'
        + '<span class="vault-slot-ilvl">' + r.ilvl + '</span>'
        + '</div>';
    } else {
      const need = s.needed - total;
      return '<div class="vault-slot vault-slot-locked">'
        + '<span class="vault-slot-label">🔐 ' + s.label + '</span>'
        + '<span class="vault-slot-missing">' + need + ' more run' + (need > 1 ? 's' : '') + ' needed</span>'
        + '</div>';
    }
  }).join('');

  if (!rows) return '';

  return '<div class="vault-preview">'
    + '<div class="vault-preview-title">Vault Preview</div>'
    + rows
    + '</div>';
}

/* ── MYTHIC+ WEEKLY RUNS DISPLAY ── */
function renderMythicPlusRunsHtml() {
  if (typeof loadArmoryData !== 'function') return '';
  const armory = loadArmoryData(currentChar);
  const weeklyData = armory?.weeklyRuns;
  if (!weeklyData || !weeklyData.runs || !weeklyData.runs.length) return '';
  // Only show if data is from the current reset week
  if (weeklyData.week !== getWeekKey()) return '';

  const runs = weeklyData.runs;
  const timerIcons = { 3: '⏱⏱⏱', 2: '⏱⏱', 1: '⏱', 0: '' };

  const rows = runs.map(r => {
    const lvlColor = r.mythic_level >= 10 ? 'var(--light-gold)' : 'var(--text-secondary)';
    const timer    = timerIcons[r.num_keystone_upgrades] || '';
    return '<div class="mp-run-row">'
      + '<span class="mp-run-level" style="color:' + lvlColor + '">+' + r.mythic_level + '</span>'
      + '<span class="mp-run-name">' + (r.dungeon || r.short_name || 'Unknown') + '</span>'
      + (timer ? '<span class="mp-run-timer" title="Timed">' + timer + '</span>' : '')
      + '</div>';
  }).join('');

  return '<div class="mp-runs-wrap">'
    + '<div class="mp-runs-label">This week\'s runs <span style="font-size:10px;opacity:0.5;">(from armory sync)</span></div>'
    + '<div class="mp-runs-grid">' + rows + '</div>'
    + '</div>';
}

function render() {
  const done      = loadDone();
  const hidden    = loadHidden();
  const yourList  = new Set(loadYourList());
  const notes     = loadNotes();
  const bossKills = loadBossKills();
  const goals     = loadGoals();
  const container = document.getElementById('sections-container');
  container.innerHTML = '';
  let totalVisible = 0, totalDone = 0, lastPriority = null;
  let anyHidden = false;

  // Refresh Last Chance banner remaining count on every render
  if (lastChanceMode) renderLastChanceBanner();

  // ── YOUR LIST VIEW (normal + edit-on-yourlist) ──────────────
  if (activeFilters.has('yourlist')) {
    // Render the edit bar inside the yourlist view when editing
    if (editingYourList) {
      container.appendChild(buildEditBar());
    }

    // Your List identity banner (with inline Edit button)
    const ylBanner = document.createElement('div');
    ylBanner.className = 'yl-view-banner';
    ylBanner.innerHTML = '<span class="yl-banner-icon">⭐</span>'
      + '<span class="yl-banner-title">Your List</span>'
      + '<span class="yl-banner-char">' + charDisplayName(currentChar) + '</span>'
      + '<button id="btn-edit-yourlist" class="yl-edit-btn" onclick="startEditingYourList()">'
      + (editingYourList ? '✓ Done' : '✏ Edit') + '</button>';
    container.appendChild(ylBanner);

    // Gather all tasks from SECTIONS that are in the list
    const selected = [];
    SECTIONS.forEach(sec => {
      sec.tasks.forEach(t => {
        if (yourList.has(t.id)) selected.push({ ...t, sectionTitle: sec.title, sectionIcon: sec.icon, sectionIconClass: sec.iconClass });
      });
    });
    loadCustomTasks().forEach(t => {
      if (yourList.has('custom_' + t.id))
        selected.push({ ...t, id: 'custom_' + t.id, sectionTitle: t.id.startsWith('bis_') ? 'Best in Slot Gear' : 'Custom', sectionIcon: t.id.startsWith('bis_') ? '⚔️' : '✦', sectionIconClass: 'icon-custom' });
    });

    // Apply search + tag filters
    const matchesSearch = t => {
      if (!searchQuery) return true;
      return (t.name || '').toLowerCase().includes(searchQuery) ||
             (t.desc || '').toLowerCase().includes(searchQuery) ||
             (t.sectionTitle || '').toLowerCase().includes(searchQuery);
    };
    const filteredSelected = selected.filter(t =>
      matchesSearch(t) && (!activeTagFilter || (t.tags && t.tags.includes(activeTagFilter)))
    );

    if (filteredSelected.length === 0) {
      if (editingYourList) {
        // Empty list in edit mode — show helpful prompt
        const emptyEl = document.createElement('div');
        emptyEl.className = 'yourlist-empty';
        emptyEl.innerHTML = '<div style="font-size:2rem;margin-bottom:0.5rem;">⭐</div>'
          + 'Your list is empty.<br>'
          + '<span style="font-size:13px;margin-top:0.4rem;display:block;">Switch to the <strong style="font-style:normal;color:var(--light-gold);">All</strong> tab to pick tasks to add.</span>';
        container.appendChild(emptyEl);
      } else {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'yourlist-empty';
        emptyEl.innerHTML = selected.length === 0
          ? '<div style="font-size:2rem;margin-bottom:0.5rem;">⭐</div>Your list is empty.<br><span style="font-size:13px;margin-top:0.4rem;display:block;">Click <strong style="font-style:normal;color:var(--light-gold);">✏ Edit</strong> above to pick tasks.</span>'
          : '<div style="font-size:2rem;margin-bottom:0.5rem;">🔍</div>No tasks match <strong style="color:var(--void-glow);">"' + searchQuery + '"</strong>';
        container.appendChild(emptyEl);
      }
    } else if (yourListGrouped) {
      // ── GROUPED VIEW ─────────────────────────────────────
      const order = loadYourListOrder();

      const sectionGroups = [];
      SECTIONS.forEach(sec => {
        const secTasks = sec.tasks
          .filter(t => yourList.has(t.id) && matchesSearch({ ...t, sectionTitle: sec.title }))
          .map(t => ({ ...t, sectionTitle: sec.title, sectionIcon: sec.icon, sectionId: sec.id, sectionIconClass: sec.iconClass }));
        if (secTasks.length) sectionGroups.push({ sec, tasks: secTasks });
      });
      const allCustom = loadCustomTasks()
        .filter(t => yourList.has('custom_' + t.id));
      const bisSelected = allCustom
        .filter(t => t.id.startsWith('bis_') && matchesSearch({ ...t, id: 'custom_' + t.id, sectionTitle: 'Best in Slot Gear' }))
        .map(t => ({ ...t, id: 'custom_' + t.id, sectionTitle: 'Best in Slot Gear', sectionIcon: '⚔️', sectionId: 'bis', sectionIconClass: 'icon-custom' }));
      const customSelected = allCustom
        .filter(t => !t.id.startsWith('bis_') && matchesSearch({ ...t, id: 'custom_' + t.id, sectionTitle: 'Custom' }))
        .map(t => ({ ...t, id: 'custom_' + t.id, sectionTitle: 'Custom', sectionIcon: '✦', sectionId: 'custom', sectionIconClass: 'icon-custom' }));
      if (bisSelected.length) sectionGroups.push({ sec: { title: 'Best in Slot Gear', icon: '⚔️', iconClass: 'icon-custom', id: 'bis' }, tasks: bisSelected });
      if (customSelected.length) sectionGroups.push({ sec: { title: 'Custom', icon: '✦', iconClass: 'icon-custom', id: 'custom' }, tasks: customSelected });

      const nonBisSelected = filteredSelected.filter(t => !t.id.startsWith('custom_bis_'));
      totalVisible = nonBisSelected.length;
      totalDone    = nonBisSelected.filter(t => done[t.id]).length;

      sectionGroups.forEach(({ sec, tasks }) => {
        const isBis = sec.id === 'bis';
        const sortedTasks = [...tasks].sort((a, b) => {
          if (isBis) return _bisSlotRank(a.name) - _bisSlotRank(b.name);
          const aDone = done[a.id] ? 1 : 0, bDone = done[b.id] ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });

        const secDone = sortedTasks.filter(t => done[t.id]).length;
        const wrap = document.createElement('div');
        wrap.className = 'yl-section-group';
        const ylHeader = document.createElement('div');
        ylHeader.className = 'yl-section-header';
        ylHeader.innerHTML = '<div class="section-icon ' + sec.iconClass + '">' + sec.icon + '</div>'
          + '<div class="section-title-wrap">' + ylSecTitleHtml(sec) + '</div>'
          + '<span class="yl-section-count"><span class="done">' + secDone + '</span> / ' + sortedTasks.length + '</span>';
        wrap.appendChild(ylHeader);

        const body = document.createElement('div');
        body.className = 'section-body yl-section-body' + (isBis && !editingYourList ? ' bis-grid-body' : '');
        body.dataset.secId = sec.id;
        body.innerHTML = (isBis && !editingYourList)
          ? renderBisGrid(sortedTasks, done)
          : sortedTasks.map(t => editingYourList ? ylEditTaskHtml(t) : ylTaskHtml(t, done, goals, notes, bossKills)).join('');
        wrap.appendChild(body);
        container.appendChild(wrap);
      });

    } else {
      // ── FLAT VIEW ─────────────────────────────────────────
      const order = loadYourListOrder();
      const sorted = [...filteredSelected].sort((a, b) => {
        const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
        const aPos = ai === -1 ? 999 : ai;
        const bPos = bi === -1 ? 999 : bi;
        const aDone = done[a.id] ? 1 : 0, bDone = done[b.id] ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return aPos - bPos;
      });

      const nonBisFlat = filteredSelected.filter(t => !t.id.startsWith('custom_bis_'));
      totalVisible = nonBisFlat.length;
      totalDone    = nonBisFlat.filter(t => done[t.id]).length;

      const body = document.createElement('div');
      body.className = 'section-body';
      body.id = 'yourlist-body';
      body.style.cssText = 'border-radius:8px;border:1px solid var(--border-bright);';
      body.innerHTML = sorted.map(t => editingYourList ? ylEditTaskHtml(t) : ylTaskHtml(t, done, goals, notes, bossKills)).join('');
      container.appendChild(body);
    }

    const pct = totalVisible ? Math.round((totalDone / totalVisible) * 100) : 0;
    document.getElementById('prog-fill').style.width = pct + '%';
    document.getElementById('prog-label').textContent = totalDone + ' / ' + totalVisible + ' done';
    document.getElementById('btn-reveal').style.display = 'none';
    updateSearchResultCount(filteredSelected.length, selected.length);

    // Update toolbar buttons
    const _viewBtn = document.getElementById('btn-yourlist-view');
    _viewBtn.textContent = yourListGrouped ? '☰ Flat List' : '⊞ Grouped';
    _viewBtn.title = yourListGrouped ? 'Switch to flat list' : 'Switch to grouped by category';
    return;
  }

/* ── BUILD EDIT BAR (shared by yourlist + master list paths) ── */
function buildEditBar() {
  const editBar = document.createElement('div');
  editBar.className = 'yourlist-edit-bar';
  const charOpts = characters.filter(c => c !== currentChar)
    .map(c => '<option value="' + c + '">' + c + '</option>').join('');
  const copyHtml = characters.length > 1
    ? '<select id="copy-to-select" style="font-family:\'Cinzel\',serif;font-size:11px;padding:0.35rem 0.5rem;background:var(--bg-panel);border:1px solid var(--border-bright);border-radius:4px;color:var(--text-secondary);cursor:pointer;margin-right:2px;">'
      + '<option value="">Copy to…</option>'
      + '<option value="__all__">All characters</option>'
      + charOpts
      + '</select>'
      + '<button class="btn-cancel" style="font-family:\'Cinzel\',serif;font-size:11px;padding:0.4rem 0.9rem;cursor:pointer;" onclick="copyListToSelected()">Copy</button>'
    : '';
  editBar.innerHTML = '<span>Tap a task to add or remove it from <strong>Your List</strong>.</span>'
    + '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">'
    + '<button class="btn-cancel" style="font-family:\'Cinzel\',serif;font-size:11px;padding:0.4rem 0.9rem;cursor:pointer;" onclick="openBeginnerPreset()">🧭 Starter Guide</button>'
    + copyHtml
    + '<button class="btn-cancel" style="font-family:\'Cinzel\',serif;font-size:11px;padding:0.4rem 0.9rem;cursor:pointer;" onclick="clearYourList()">Clear All</button>'
    + '<button class="btn-primary" style="font-size:11px;padding:0.4rem 0.9rem;" onclick="doneEditingYourList()">✓ Done</button>'
    + '</div>';
  return editBar;
}

  // ── EDIT YOUR LIST MODE — master list with highlight toggles ──
  if (editingYourList) container.appendChild(buildEditBar());

  let searchMatchTotal = 0, searchTotal = 0;

  // Collect all section data first so flat mode can render one unified list
  const allSectionData = [];

  SECTIONS.forEach(sec => {
    const isAll = activeFilters.has('all');
    const tasks = sec.tasks.filter(t => {
      if (isAll) return true;
      return sec.categories.some(c => activeFilters.has(c));
    });
    if (!tasks.length) return;

    const matchesSearch = t => {
      if (!searchQuery) return true;
      return (t.name || '').toLowerCase().includes(searchQuery) ||
             (t.desc || '').toLowerCase().includes(searchQuery) ||
             sec.title.toLowerCase().includes(searchQuery);
    };

    const visibleTasks = tasks.filter(t => {
      if (!revealHidden && hidden[t.id]) return false;
      if (lastChanceMode && done[t.id]) return false; // hide completed in Last Chance Mode
      if (activeTagFilter && !(t.tags && t.tags.includes(activeTagFilter))) return false;
      return matchesSearch(t);
    });
    const hiddenCount  = tasks.filter(t => hidden[t.id]).length;
    if (hiddenCount > 0) anyHidden = true;

    if (searchQuery) {
      searchTotal      += tasks.filter(t => !hidden[t.id]).length;
      searchMatchTotal += visibleTasks.filter(t => !hidden[t.id]).length;
    }

    if (!visibleTasks.length) return;

    totalVisible += visibleTasks.filter(t => !hidden[t.id]).length;
    const secDone = visibleTasks.filter(t => done[t.id] && !hidden[t.id]).length;
    totalDone += secDone;

    allSectionData.push({ sec, visibleTasks, hiddenCount, secDone });
  });

  if (!yourListGrouped) {
    // ── FLAT MODE: one unified body, no section headers ──────────
    const flatBody = document.createElement('div');
    flatBody.className = 'section-body';
    flatBody.style.cssText = 'border-radius:8px;border:1px solid var(--border-bright);margin-bottom:1rem;';
    const allTasks = allSectionData.flatMap(({ visibleTasks }) => visibleTasks);
    flatBody.innerHTML = allTasks.map(t => sectionTaskHtml(t, done, hidden, yourList, goals, bossKills, notes)).join('');
    container.appendChild(flatBody);
  } else {
    // ── GROUPED MODE: per-section cards with headers ──────────────
    allSectionData.forEach(({ sec, visibleTasks, hiddenCount, secDone }) => {
      const isAll = activeFilters.has('all');
      const isOpen = searchQuery ? true : !collapsed[sec.id];
      const isSectionHidden = hidden['section_' + sec.id];

      if (isAll && sec.priority !== lastPriority) {
        lastPriority = sec.priority;
        const [cls, text] = PRIORITY_META[sec.priority];
        const lbl = document.createElement('div');
        lbl.className = 'priority-label ' + cls;
        lbl.textContent = text;
        container.appendChild(lbl);
      }

      if (isSectionHidden && !revealHidden && !editingYourList) {
        const d = document.createElement('div');
        d.className = 'section section-hidden';
        d.innerHTML = '<div class="section-header" onclick="">'
          + '<div class="section-icon ' + sec.iconClass + '" style="width:40px;height:40px;font-size:22px;">' + sec.icon + '</div>'
          + '<div class="section-title-wrap">'
          + secTitleHtml(sec)
          + '<div class="section-meta">Hidden from All view</div>'
          + '</div>'
          + '<button class="section-hide" title="Unhide section" onclick="toggleHideSection(event,\'' + sec.id + '\')">👁</button>'
          + '</div>';
        container.appendChild(d);
        return;
      }

      const div = document.createElement('div');
      div.className = 'section' + (isSectionHidden ? ' section-hidden' : '');
      div.dataset.section = sec.id;
      const hiddenCountSpan = hiddenCount > 0 ? '<span class="hidden-count">(' + hiddenCount + ' hidden)</span>' : '';
      div.innerHTML = '<div class="section-header' + (isOpen ? ' open' : '') + '" onclick="toggleSection(\'' + sec.id + '\')">'
        + '<div class="section-icon ' + sec.iconClass + '" style="width:40px;height:40px;font-size:22px;">' + sec.icon + '</div>'
        + '<div class="section-title-wrap">'
        + secTitleHtml(sec)
        + '<div class="section-meta">' + sec.meta + '</div>'
        + '</div>'
        + '<span class="section-count"><span class="done">' + secDone + '</span>&thinsp;/&thinsp;' + visibleTasks.filter(function(t){return !hidden[t.id];}).length + hiddenCountSpan + '</span>'
        + '<button class="section-hide" title="' + (isSectionHidden ? 'Unhide section' : 'Hide section from All view') + '" onclick="toggleHideSection(event,\'' + sec.id + '\')">' + (isSectionHidden ? '👁' : '🚫') + '</button>'
        + '<span class="chevron" style="transform:rotate(' + (isOpen ? '0' : '-90') + 'deg)">▼</span>'
        + '</div>';

      const secBody = document.createElement('div');
      secBody.className = 'section-body' + (isOpen ? '' : ' hidden');
      secBody.id = 'body-' + sec.id;
      secBody.innerHTML = visibleTasks.map(t => sectionTaskHtml(t, done, hidden, yourList, goals, bossKills, notes)).join('');
      if (sec.id === 'mythicplus') secBody.innerHTML += renderMythicPlusRunsHtml();
      div.appendChild(secBody);
      container.appendChild(div);
    });
  }

  const pct = totalVisible ? Math.round((totalDone / totalVisible) * 100) : 0;
  document.getElementById('prog-fill').style.width = pct + '%';
  document.getElementById('prog-label').textContent = totalDone + ' / ' + totalVisible + ' done';

  updateSearchResultCount(searchMatchTotal, searchTotal);

  // Show/update the reveal hidden button
  const revealBtn = document.getElementById('btn-reveal');
  revealBtn.style.display = (anyHidden || revealHidden) ? '' : 'none';
  revealBtn.textContent = revealHidden ? '🚫 Hide Hidden' : '👁 Show Hidden';


  // Update view toggle label
  const viewBtn = document.getElementById('btn-yourlist-view');
  viewBtn.textContent = yourListGrouped ? '☰ Flat List' : '⊞ Grouped';
  viewBtn.title = yourListGrouped ? 'Switch to flat list' : 'Switch to grouped by category';

  // Apply to All hidden when not on yourlist tab

  renderCustomSection();
}

function toggle(id, taskEl) {
  const done    = loadDone();
  const wasDown = !!done[id];
  done[id] ? delete done[id] : (done[id] = true);
  saveDone(done);
  if (!wasDown) {
    // Task just checked — burst from task position
    const pos = _getTaskPos(taskEl);
    _confetti.burst(pos.x, pos.y, 28, false);
    // Check for full completion
    if (_checkCompletion()) setTimeout(() => _confetti.celebrate(), 200);
  }
  render();
}
function toggleSection(id) { collapsed[id] = !collapsed[id]; render(); }

function secTitleHtml(sec) {
  if (!sec.url) return '<div class="section-title">' + sec.title + '</div>';
  return '<div class="section-title">'
    + '<a href="' + sec.url + '" target="_blank" rel="noopener" class="section-title-link"'
    + ' onclick="event.stopPropagation()" title="Icy Veins guide">'
    + sec.title + '</a>'
    + '</div>';
}

function ylSecTitleHtml(sec) {
  if (!sec.url) return '<span class="yl-section-title">' + sec.title + '</span>';
  return '<span class="yl-section-title">'
    + '<a href="' + sec.url + '" target="_blank" rel="noopener" class="section-title-link yl-section-title-link"'
    + ' onclick="event.stopPropagation()" title="Icy Veins guide">'
    + sec.title + '</a>'
    + '</span>';
}

function toggleHideTask(e, id) {
  e.stopPropagation();
  const hidden = loadHidden();
  hidden[id] ? delete hidden[id] : (hidden[id] = true);
  saveHidden(hidden);
  render();
}

function toggleHideSection(e, id) {
  e.stopPropagation();
  const hidden = loadHidden();
  const key = 'section_' + id;
  hidden[key] ? delete hidden[key] : (hidden[key] = true);
  saveHidden(hidden);
  render();
}

function toggleRevealHidden() {
  revealHidden = !revealHidden;
  render();
}

/* ── YOUR LIST ── */
function startEditingYourList() {
  if (editingYourList) { doneEditingYourList(); return; }
  editingYourList = true;
  activeFilters = new Set(['yourlist']);
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-filter') === 'yourlist');
  });
  render();
}

function doneEditingYourList() {
  editingYourList = false;
  activeFilters = new Set(['yourlist']);
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-filter') === 'yourlist');
  });
  render();
}

function toggleYourListTask(id) {
  const list = loadYourList();
  const idx  = list.indexOf(id);
  if (idx === -1) list.push(id); else list.splice(idx, 1);
  saveYourList(list);
  render();
}

function clearYourList() {
  if (!confirm('Clear all tasks from Your List?')) return;
  saveYourList([]);
  render();
}

/* ── DRAG TO REORDER YOUR LIST ── */
let ylDragSrcId = null;

function ylDragStart(e) {
  ylDragSrcId = e.currentTarget.dataset.id;
  e.currentTarget.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
}

function ylDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.yl-task').forEach(el => el.classList.remove('yl-drag-over'));
  e.currentTarget.classList.add('yl-drag-over');
}

function ylDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  if (!targetId || targetId === ylDragSrcId) return;

  // Build new order from current DOM, then swap
  const items = [...document.querySelectorAll('.yl-task')].map(el => el.dataset.id);
  const srcIdx = items.indexOf(ylDragSrcId);
  const tgtIdx = items.indexOf(targetId);
  if (srcIdx === -1 || tgtIdx === -1) return;
  items.splice(srcIdx, 1);
  items.splice(tgtIdx, 0, ylDragSrcId);
  saveYourListOrder(items);
  render();
}

function ylDragEnd(e) {
  e.currentTarget.style.opacity = '';
  document.querySelectorAll('.yl-task').forEach(el => el.classList.remove('yl-drag-over'));
}

/* ── WEEKLY GOAL TRACKER ── */
function adjustGoal(id, max, delta) {
  const goals   = loadGoals();
  const cur     = goals[id] || 0;
  const uncapped = !max; // max === 0 means no upper limit
  const next    = uncapped ? Math.max(0, cur + delta) : Math.max(0, Math.min(max, cur + delta));
  goals[id]     = next;
  saveGoals(goals);
  // Auto-check only when capped goal is fully met; uncapped goals never auto-check
  const done = loadDone();
  if (!uncapped && next >= max) { done[id] = true; }
  else if (!uncapped)           { delete done[id]; }
  saveDone(done);
  render();
}

function copyListToSelected() {
  const sel = document.getElementById('copy-to-select');
  if (!sel || !sel.value) { alert('Please choose a character to copy to.'); return; }
  const list = loadYourList();
  if (sel.value === '__all__') {
    const others = characters.filter(c => c !== currentChar);
    if (!others.length) { alert('No other characters to copy to.'); return; }
    others.forEach(c => localStorage.setItem('wow_mn_yourlist_' + c, JSON.stringify(list)));
    alert('Copied to: ' + others.join(', '));
  } else {
    localStorage.setItem('wow_mn_yourlist_' + sel.value, JSON.stringify(list));
    alert('Copied to ' + sel.value);
  }
}
function resetAll() {
  if (!confirm('Reset all tasks for ' + currentChar + ' this week?')) return;
  // Save a history snapshot before clearing
  snapshotWeekForChar(currentChar, getWeekKey());
  localStorage.removeItem(storageKey());
  localStorage.removeItem(bossKey());
  render();
}
function setFilter(f, btn) {
  if (f === 'all') {
    activeFilters = new Set(['all']);
  } else if (f === 'yourlist') {
    activeFilters = new Set(['yourlist']);
  } else {
    activeFilters = new Set([f]);
  }

  // When switching to Your List, ensure the first character is active
  if (f === 'yourlist') {
    if (!characters.includes(currentChar)) currentChar = characters[0];
    currentChar = currentChar || characters[0];
    renderChars();
  }

  document.querySelectorAll('.tab-btn').forEach(b => {
    const val = b.getAttribute('data-filter');
    b.classList.toggle('active', activeFilters.has(val));
  });
  render();
}

function filterByTag(tag) {
  activeTagFilter = (activeTagFilter === tag) ? '' : tag;
  render();
}

/* ═══════════════════════════════════════════
   CHARACTERS
═══════════════════════════════════════════ */
function renderChars() {
  document.getElementById('char-list').innerHTML = characters.map(c => {
    const cls = loadCharClass(c);
    const def = cls ? CLASSES.find(x => x.id === cls) : null;
    const borderStyle = def
      ? isLightMode
        ? `border-color:var(--border-bright); box-shadow:0 0 0 1px ${def.color}44;`
        : `border-color:${def.color}; box-shadow:0 0 0 1px ${def.color}22;`
      : '';
    const group = loadCharGroupFor(c);
    const gm = GROUP_META[group];
    const groupDot = gm ? `<span style="font-size:9px;color:${gm.color};line-height:1;" title="${gm.label.replace(/[⭐◆🌿]/g,'').trim()}">${gm.dot}</span>` : '';
    const armory = loadArmoryData(c);
    const ilvlBadge = armory && armory.ilvl
      ? `<span class="char-ilvl-badge" title="iLvl ${armory.ilvl} · synced ${new Date(armory.lastSync).toLocaleDateString()}">${armory.ilvl}</span>`
      : '';
    const mythicBadge = armory && armory.mythicRating
      ? `<span class="char-ilvl-badge" style="color:${armory.mythicColor||'var(--void-glow)'};" title="Mythic+ Rating ${armory.mythicRating}">${armory.mythicRating}</span>`
      : '';
    const portrait = armory?.portrait;
    const displayName = charDisplayName(c);
    const realmSlug = charRealmSlugFromId(c);
    const showRealm = realmSlug && characters.filter(x => charDisplayName(x) === displayName).length > 1;
    const realmBadge = showRealm ? `<span class="char-realm-badge">${realmSlug.replace(/-/g, ' ')}</span>` : '';
    const iconHtml = portrait
      ? `<img src="${portrait}" class="char-portrait" alt="${displayName}">`
      : def ? `<img src="${def.icon}" class="char-class-icon" alt="${displayName}">` : '';
    return `<button class="char-btn${c===currentChar?' active':''}" onclick="switchChar('${c}')" style="display:inline-flex;align-items:center;gap:6px;${borderStyle}">
        ${iconHtml}${displayName}${realmBadge}${groupDot}${ilvlBadge}${mythicBadge}
      </button>`;
  }).join('');
}
let _charMenuOpen = false;

function toggleCharMenu(e) {
  e.stopPropagation();
  _charMenuOpen = !_charMenuOpen;
  const menu = document.getElementById('char-manage-menu');
  const btn  = document.getElementById('char-manage-btn');
  if (_charMenuOpen) {
    const isSynced  = !!loadArmoryData(currentChar);
    const multiChar = characters.length > 1;
    menu.innerHTML =
      `<button class="char-manage-item${isSynced ? ' char-manage-item--disabled' : ''}"
          onclick="${isSynced ? '' : `openRenameChar('${currentChar}');closeCharMenu()`}">
        ✏ Edit character
        ${isSynced ? '<span class="char-manage-hint">synced via Battle.net</span>' : ''}
      </button>`
      + (multiChar
        ? `<button class="char-manage-item char-manage-item--danger" onclick="openRemoveCharModal();closeCharMenu()">
            ✕ Remove character
           </button>
           <button class="char-manage-item" onclick="openRearrangeModal();closeCharMenu()">
            ⇅ Rearrange list
           </button>`
        : '');
    menu.classList.add('open');
    btn.classList.add('active');
  } else {
    closeCharMenu();
  }
}

function closeCharMenu() {
  _charMenuOpen = false;
  document.getElementById('char-manage-menu').classList.remove('open');
  document.getElementById('char-manage-btn').classList.remove('active');
}

function openRearrangeModal() {
  renderRearrangeList();
  document.getElementById('modal-rearrange').classList.add('open');
}

function closeRearrangeModal() {
  document.getElementById('modal-rearrange').classList.remove('open');
}

function renderRearrangeList() {
  document.getElementById('rearrange-list').innerHTML = characters.map((c, i) => {
    const armory  = loadArmoryData(c);
    const portrait = armory?.portrait;
    const cls = loadCharClass(c);
    const def = cls ? CLASSES.find(x => x.id === cls) : null;
    const imgHtml = portrait
      ? `<img src="${portrait}" class="char-portrait" style="width:28px;height:28px;" alt="${c}">`
      : def ? `<img src="${def.icon}" class="char-class-icon" alt="${c}">` : '';
    return `<div class="rearrange-row">
      ${imgHtml}
      <span class="rearrange-name">${escHtml(charDisplayName(c))}${charRealmSlugFromId(c) ? `<span class="char-realm-badge" style="margin-left:4px;">${charRealmSlugFromId(c).replace(/-/g,' ')}</span>` : ''}</span>
      <div class="rearrange-arrows">
        <button class="rearrange-btn" ${i===0?'disabled':''} onclick="moveChar(${i},-1)">↑</button>
        <button class="rearrange-btn" ${i===characters.length-1?'disabled':''} onclick="moveChar(${i},1)">↓</button>
      </div>
    </div>`;
  }).join('');
}

function openRemoveCharModal() {
  renderRemoveList();
  document.getElementById('modal-remove-char').classList.add('open');
}

function closeRemoveCharModal() {
  document.getElementById('modal-remove-char').classList.remove('open');
}

function renderRemoveList() {
  document.getElementById('remove-char-list').innerHTML = characters.map(c => {
    const armory  = loadArmoryData(c);
    const portrait = armory?.portrait;
    const cls = loadCharClass(c);
    const def = cls ? CLASSES.find(x => x.id === cls) : null;
    const imgHtml = portrait
      ? `<img src="${portrait}" class="char-portrait" style="width:28px;height:28px;" alt="${charDisplayName(c)}">`
      : def ? `<img src="${def.icon}" class="char-class-icon" alt="${charDisplayName(c)}">` : '';
    const realmBadge = charRealmSlugFromId(c)
      ? `<span class="char-realm-badge" style="margin-left:4px;">${charRealmSlugFromId(c).replace(/-/g,' ')}</span>` : '';
    return `<div class="rearrange-row">
      ${imgHtml}
      <span class="rearrange-name">${escHtml(charDisplayName(c))}${realmBadge}</span>
      <button class="rearrange-btn rearrange-btn--danger" onclick="deleteCharFromList('${escHtml(c)}')">✕</button>
    </div>`;
  }).join('');
}

function deleteCharFromList(name) {
  if (!confirm('Remove ' + charDisplayName(name) + ' and all saved data?')) return;
  deleteChar(name);
  if (characters.length === 0) { closeRemoveCharModal(); return; }
  renderRemoveList();
}

function moveChar(idx, dir) {
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= characters.length) return;
  [characters[idx], characters[swapIdx]] = [characters[swapIdx], characters[idx]];
  localStorage.setItem('wow_midnight_chars', JSON.stringify(characters));
  renderChars();
  renderRearrangeList();
}

document.addEventListener('click', () => { if (_charMenuOpen) closeCharMenu(); });

function switchChar(name) {
  currentChar = name;
  revealHidden = false;
  editingYourList = false;
  activeFilters = new Set(['yourlist']);
  document.querySelectorAll('.tab-btn').forEach(b => {
    const val = b.getAttribute('data-filter');
    b.classList.toggle('active', activeFilters.has(val));
  });
  renderChars();
  renderClassLinksBar();
  render();
  renderInlineHistory();
}
function deleteChar(name) {
  if (!confirm('Remove ' + charDisplayName(name) + ' and all saved data?')) return;
  Object.keys(localStorage).filter(k => k.startsWith('wow_mn_' + name + '_') || k === 'wow_mn_hidden_' + name || k === 'wow_mn_custom_' + name || k === 'wow_mn_yourlist_' + name || k === 'wow_mn_ylorder_' + name || k === 'wow_mn_notes_' + name || k === classKey(name) || k === 'wow_mn_realm_' + name || k === 'wow_mn_armory_' + name).forEach(k => localStorage.removeItem(k));
  characters = characters.filter(c => c !== name);
  localStorage.setItem('wow_midnight_chars', JSON.stringify(characters));
  if (currentChar === name) currentChar = characters[0];
  renderChars(); render();
}
function openAddChar() {
  document.getElementById('char-modal-title').textContent = 'Add Character';
  document.getElementById('modal').dataset.renaming = '';
  document.getElementById('modal').classList.add('open');
  document.getElementById('char-input').value = '';
  renderClassPicker('');
  renderGroupPicker('');
  setTimeout(() => document.getElementById('char-input').focus(), 50);
}
function openRenameChar(oldName) {
  document.getElementById('char-modal-title').textContent = 'Edit Character';
  document.getElementById('modal').dataset.renaming = oldName;
  document.getElementById('modal').classList.add('open');
  document.getElementById('char-input').value = charDisplayName(oldName);
  document.getElementById('char-realm-input').value = loadCharRealm(oldName);
  renderClassPicker(loadCharClass(oldName));
  renderGroupPicker(loadCharGroupFor(oldName));
  setTimeout(() => { const el = document.getElementById('char-input'); el.focus(); el.select(); }, 50);
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }
function saveChar() {
  const newName  = document.getElementById('char-input').value.trim();
  if (!newName) return;
  const oldName  = document.getElementById('modal').dataset.renaming;
  const isRename = oldName && oldName !== '';
  const realmInput   = document.getElementById('char-realm-input').value.trim();
  const newRealmSlug = realmInput ? realmToSlug(realmInput) : (charRealmSlugFromId(oldName) || '');
  const newId        = charIdentifier(newName, newRealmSlug);

  if (isRename) {
    if (newId === oldName) {
      // Identifier unchanged — just save class/group/realm display update
      saveCharClass(oldName, _modalSelectedClass);
      saveCharGroupFor(oldName, _modalSelectedGroup);
      if (realmInput) saveCharRealm(oldName, realmInput);
      closeModal(); renderChars(); renderClassLinksBar();
      return;
    }
    if (characters.includes(newId)) { alert('A character with that name already exists.'); return; }
    const prefix = 'wow_mn_';
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix + oldName + '_') || k === prefix + 'hidden_' + oldName || k === prefix + 'custom_' + oldName)
      .forEach(k => {
        const newKey = k.replace(prefix + oldName, prefix + newId);
        localStorage.setItem(newKey, localStorage.getItem(k));
        localStorage.removeItem(k);
      });
    const existingClass  = loadCharClass(oldName);
    const existingRealm  = loadCharRealm(oldName);
    const existingArmory = loadArmoryData(oldName);
    localStorage.removeItem(classKey(oldName));
    localStorage.removeItem('wow_mn_realm_' + oldName);
    localStorage.removeItem('wow_mn_armory_' + oldName);
    saveCharClass(newId, _modalSelectedClass || existingClass);
    saveCharGroupFor(newId, _modalSelectedGroup);
    saveCharRealm(newId, realmInput || existingRealm);
    if (existingArmory) saveArmoryData(newId, existingArmory);
    const idx = characters.indexOf(oldName);
    characters[idx] = newId;
    localStorage.setItem('wow_midnight_chars', JSON.stringify(characters));
    if (currentChar === oldName) currentChar = newId;
    closeModal(); renderChars(); renderClassLinksBar(); render();
  } else {
    if (!characters.includes(newId)) {
      characters.push(newId);
      localStorage.setItem('wow_midnight_chars', JSON.stringify(characters));
    }
    saveCharClass(newId, _modalSelectedClass);
    saveCharGroupFor(newId, _modalSelectedGroup);
    saveCharRealm(newId, realmInput);
    if (newRealmSlug) saveCharRealmSlug(newId, newRealmSlug);
    closeModal(); switchChar(newId);
    if (realmInput && typeof autoSyncArmory === 'function') autoSyncArmory();
  }
}


/* ═══════════════════════════════════════════
   EVENT PROXIMITY ALERTS
   Shows dismissible banners for active events
   ending within 3 days, and events starting
   tomorrow. Dismissed per session only.
═══════════════════════════════════════════ */
function renderEventAlerts() {
  const el = document.getElementById('event-alerts');
  if (!el || typeof EVENTS === 'undefined') return;

  const now   = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const parseD = s => new Date(s + 'T00:00:00Z');
  const dismissed = new Set(JSON.parse(sessionStorage.getItem('wow_mn_dismissed_alerts') || '[]'));

  const alerts = [];
  EVENTS.forEach(e => {
    const start = parseD(e.start);
    const end   = parseD(e.end);
    if (start <= today && today < end) {
      // Active event — warn if ending within 3 days
      const daysLeft = Math.round((end - today) / 86400000);
      if (daysLeft <= 3 && !dismissed.has(e.name)) {
        alerts.push({ event: e, daysLeft, type: 'ending' });
      }
    } else if (start > today) {
      // Upcoming — notify if starting tomorrow
      const daysUntil = Math.round((start - today) / 86400000);
      if (daysUntil === 1 && !dismissed.has('start_' + e.name)) {
        alerts.push({ event: e, daysUntil, type: 'starting' });
      }
    }
  });

  if (!alerts.length) { el.innerHTML = ''; return; }

  el.innerHTML = alerts.map(a => {
    const key = a.type === 'starting' ? 'start_' + a.event.name : a.event.name;
    const icon = a.type === 'ending' ? '⚠️' : '📅';
    const timeStr = a.type === 'ending'
      ? (a.daysLeft === 0 ? 'ends today!' : a.daysLeft === 1 ? 'ends tomorrow' : 'ends in ' + a.daysLeft + ' days')
      : 'starts tomorrow';
    const isUrgent = a.type === 'ending' && a.daysLeft <= 1;
    const safeKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div class="event-alert' + (isUrgent ? ' urgent' : '') + '">'
      + '<span class="ea-icon">' + icon + '</span>'
      + '<span class="ea-text"><a href="' + a.event.url + '" target="_blank" class="ea-link">' + a.event.name + '</a>'
      + ' <span class="ea-when">' + timeStr + '</span></span>'
      + '<button class="ea-dismiss" onclick="dismissEventAlert(\'' + safeKey + '\')" title="Dismiss">&times;</button>'
      + '</div>';
  }).join('');
}

function dismissEventAlert(key) {
  const dismissed = JSON.parse(sessionStorage.getItem('wow_mn_dismissed_alerts') || '[]');
  if (!dismissed.includes(key)) dismissed.push(key);
  sessionStorage.setItem('wow_mn_dismissed_alerts', JSON.stringify(dismissed));
  renderEventAlerts();
}


/* ═══════════════════════════════════════════
   COUNTDOWN
═══════════════════════════════════════════ */
let _resetTimestamp = null;

async function _fetchResetTime() {
  try {
    const res = await fetch('/api/reset-time');
    if (!res.ok) return;
    const data = await res.json();
    if (data?.end_timestamp) _resetTimestamp = data.end_timestamp;
  } catch (_) {}
}

function _hardcodedNextReset() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0));
  while (next.getUTCDay() !== 2) next.setUTCDate(next.getUTCDate() + 1);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

function updateCountdown() {
  const now  = new Date();
  const next = (_resetTimestamp && _resetTimestamp > now.getTime())
    ? new Date(_resetTimestamp)
    : _hardcodedNextReset();

  // Once the API timestamp expires, re-fetch so the next period is picked up
  if (_resetTimestamp && _resetTimestamp <= now.getTime()) {
    _resetTimestamp = null;
    _fetchResetTime();
  }

  const diff = next - now;
  const d = Math.floor(diff/86400000);
  const h = Math.floor((diff%86400000)/3600000);
  const m = Math.floor((diff%3600000)/60000);
  const s = Math.floor((diff%60000)/1000);
  document.getElementById('countdown').textContent =
    (d>0?d+'d ':'')+String(h).padStart(2,'0')+'h '+String(m).padStart(2,'0')+'m '+String(s).padStart(2,'0')+'s';

  // Auto-enable Last Chance Mode when < 6 hours remain
  const sixHours = 6 * 3600 * 1000;
  if (!lastChanceMode && diff < sixHours) {
    lastChanceMode = true;
    renderLastChanceBanner();
    updateLastChanceBtn();
  }
}

/* ── LAST CHANCE MODE ── */
function toggleLastChance() {
  lastChanceMode = !lastChanceMode;
  renderLastChanceBanner();
  updateLastChanceBtn();
  render();
}

function updateLastChanceBtn() {
  const btn = document.getElementById('btn-last-chance');
  if (!btn) return;
  btn.classList.toggle('active', lastChanceMode);
  btn.textContent = lastChanceMode ? '⚡ Last Chance ON' : '⚡ Last Chance';
}

function renderLastChanceBanner() {
  let banner = document.getElementById('last-chance-banner');
  if (!lastChanceMode) {
    if (banner) banner.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'last-chance-banner';
    banner.className = 'last-chance-banner';
    // Insert below reset-bar
    const resetBar = document.querySelector('.reset-bar');
    if (resetBar && resetBar.parentNode) {
      resetBar.parentNode.insertBefore(banner, resetBar.nextSibling);
    }
  }
  const done    = loadDone();
  const hidden  = loadHidden();
  let remaining = 0;
  SECTIONS.forEach(sec => sec.tasks.filter(t => !hidden[t.id] && !done[t.id]).forEach(() => remaining++));
  loadCustomTasks().forEach(t => { if (!done['custom_' + t.id]) remaining++; });
  banner.innerHTML = '<span class="lc-pulse">⚡</span>'
    + '<span class="lc-text">Last Chance Mode: showing only uncompleted tasks</span>'
    + '<span class="lc-count">' + remaining + ' remaining</span>'
    + '<button class="lc-close" onclick="toggleLastChance()" title="Exit Last Chance Mode">✕</button>';
}

/* ═══════════════════════════════════════════
   CUSTOM TASKS
   Stored per character (not per week — persist
   until manually deleted)
═══════════════════════════════════════════ */

function renderCustomSection() {
  const existing = document.getElementById('custom-section-wrap');
  if (existing) existing.remove();

  if (!activeFilters.has('all') && !activeFilters.has('custom')) return;

  const tasks    = loadCustomTasks().filter(t => !t.id.startsWith('bis_'));
  const done     = loadDone();
  const yourList = new Set(loadYourList());
  const notes    = loadNotes();
  const wrap     = document.createElement('div');
  wrap.id        = 'custom-section-wrap';
  wrap.className = 'custom-section-wrap';

  if (activeFilters.has('all')) {
    const lbl = document.createElement('div');
    lbl.className = 'priority-label p-custom';
    lbl.textContent = '✦ Custom Tasks';
    wrap.appendChild(lbl);
  }

  const isCustomOnly = activeFilters.has('custom') && !activeFilters.has('all');

  if (isCustomOnly) {
    const addBar = document.createElement('div');
    addBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;';
    const countText = tasks.length === 0 ? 'No custom tasks yet'
      : (tasks.filter(t => done['custom_' + t.id]).length + ' / ' + tasks.length + ' done');
    addBar.innerHTML = '<div style="font-family:\'Cinzel\',serif;font-size:13px;color:var(--text-secondary);letter-spacing:0.05em;">' + countText + '</div>'
      + '<button class="btn-primary" style="font-size:12px;padding:0.5rem 1.2rem;letter-spacing:0.1em;" onclick="openCustomModal()">+ Add Task</button>';
    wrap.appendChild(addBar);
  }

  const isOpen = !collapsed['custom'];
  const header = document.createElement('div');
  header.className = 'section';

  function customTaskHtml(t) {
    const id = 'custom_' + t.id;
    const inList = yourList.has(id);
    const isDone = !!done[id];
    const checkFn = editingYourList
      ? 'toggleYourListTask(\'' + id + '\')'
      : 'toggleCustom(\'' + t.id + '\',this)';
    const starCol = editingYourList
      ? '<span style="flex-shrink:0;font-size:13px;color:' + (inList ? 'var(--light-gold)' : 'var(--text-muted)') + ';">' + (inList ? '⭐' : '☆') + '</span>'
      : '<div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0;">'
        + noteBtnHtml(id, notes)
        + '<button class="task-del" title="Delete task" onclick="deleteCustomTask(event,\'' + t.id + '\')">✕</button>'
        + '</div>';
    return '<div class="task' + (isDone ? ' done' : '') + (inList ? ' in-yourlist' : '') + '">'
      + '<div class="task-check" onclick="event.stopPropagation();' + checkFn + '" style="cursor:pointer;"></div>'
      + '<div class="task-body">'
      + '<div class="task-name">' + _bisTaskNameHtml(t.name, null) + '</div>'
      + (t.desc ? '<div class="task-desc">' + escHtml(t.desc) + '</div>' : '')
      + (!editingYourList ? noteHtml(id, notes) : '')
      + '</div>'
      + starCol
      + '</div>';
  }

  const emptyHtml = '<div class="custom-empty" style="border:none;padding:2.5rem 1rem;"><div style="font-size:2rem;margin-bottom:0.5rem;">✦</div>Nothing here yet. Hit <strong>+ Add Task</strong> above to get started.</div>';

  if (isCustomOnly) {
    const body = document.createElement('div');
    body.className = 'section-body';
    body.id = 'body-custom';
    body.style.cssText = 'border-radius:8px;border:1px solid var(--border-bright);';
    body.innerHTML = tasks.length === 0 ? emptyHtml : tasks.map(customTaskHtml).join('');
    header.appendChild(body);
  } else {
    const secHead = document.createElement('div');
    secHead.className = 'section-header' + (isOpen ? ' open' : '');
    secHead.setAttribute('onclick', 'toggleSection(\'custom\')');
    secHead.style.marginBottom = '0';
    secHead.innerHTML = '<div class="section-icon icon-optional">✦</div>'
      + '<div class="section-title-wrap">'
      + '<div class="section-title">Custom Tasks</div>'
      + '<div class="section-meta">Your personal weekly to-dos · Saved per character · Never auto-reset</div>'
      + '</div>'
      + '<span class="section-count"><span class="done">' + tasks.filter(t => done['custom_' + t.id]).length + '</span>&thinsp;/&thinsp;' + tasks.length + '</span>'
      + '<span class="chevron" style="transform:rotate(' + (isOpen ? '0' : '-90') + 'deg)">▼</span>';
    header.appendChild(secHead);

    const body = document.createElement('div');
    body.className = 'section-body' + (isOpen ? '' : ' hidden');
    body.id = 'body-custom';
    const addBtn = document.createElement('div');
    addBtn.style.cssText = 'padding:0.65rem 1rem; border-bottom:1px solid var(--border); display:flex; gap:0.6rem;';
    addBtn.innerHTML = '<button class="btn-primary" style="font-size:11px;padding:0.35rem 0.9rem;" onclick="openCustomModal()">+ Add Task</button>';
    body.appendChild(addBtn);
    if (tasks.length === 0) {
      const emp = document.createElement('div');
      emp.className = 'custom-empty';
      emp.textContent = 'No custom tasks yet. Add one above.';
      body.appendChild(emp);
    } else {
      body.innerHTML += tasks.map(customTaskHtml).join('');
    }
    header.appendChild(body);
  }

  wrap.appendChild(header);
  const container = document.getElementById('sections-container');
  container.insertBefore(wrap, container.firstChild);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleCustom(id, taskEl) {
  const done    = loadDone();
  const key     = 'custom_' + id;
  const wasDown = !!done[key];
  done[key] ? delete done[key] : (done[key] = true);
  saveDone(done);
  if (!wasDown) {
    const pos = _getTaskPos(taskEl);
    _confetti.burst(pos.x, pos.y, 28, false);
    if (_checkCompletion()) setTimeout(() => _confetti.celebrate(), 200);
  }
  render();
}

function deleteCustomTask(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this custom task?')) return;
  const tasks = loadCustomTasks().filter(t => t.id !== id);
  saveCustomTasks(tasks);
  // also clear done state
  const done = loadDone();
  delete done['custom_' + id];
  saveDone(done);
  render();
}

function openCustomModal() {
  document.getElementById('modal-custom').classList.add('open');
  document.getElementById('custom-name-input').value = '';
  document.getElementById('custom-desc-input').value = '';
  setTimeout(() => document.getElementById('custom-name-input').focus(), 50);
}

function closeCustomModal() { document.getElementById('modal-custom').classList.remove('open'); }

function saveCustomTask() {
  const name = document.getElementById('custom-name-input').value.trim();
  if (!name) return;
  const desc  = document.getElementById('custom-desc-input').value.trim();
  const tasks = loadCustomTasks();
  tasks.push({ id: Date.now().toString(36), name, desc });
  saveCustomTasks(tasks);
  closeCustomModal();
  render();
}



/* ═══════════════════════════════════════════
   BEST IN SLOT IMPORT
═══════════════════════════════════════════ */
let _bisClass = null;
let _bisSpec  = null;

const _BIS_SLOT_ORDER = ['Head','Neck','Shoulders','Back','Chest','Wrists','Hands','Waist','Legs','Feet','Ring 1','Ring 2','Trinket 1','Trinket 2','Main Hand','Off Hand','Shield','Ranged'];
function _bisSlotRank(name) {
  const m = (name || '').match(/^\[([^\]]+)\]/);
  const idx = m ? _BIS_SLOT_ORDER.indexOf(m[1]) : -1;
  return idx === -1 ? 999 : idx;
}

const _BIS_SLOT_ICONS = {
  'Head':      'img/headslot.webp',
  'Neck':      'img/neckslot.webp',
  'Shoulders': 'img/shoulderslot.webp',
  'Back':      'img/chestslot.webp',
  'Chest':     'img/chestslot.webp',
  'Wrists':    'img/wristslot.webp',
  'Hands':     'img/handslot.webp',
  'Waist':     'img/waistslot.webp',
  'Legs':      'img/legsslot.webp',
  'Feet':      'img/feetslot.webp',
  'Ring 1':    'img/fingerslot.webp',
  'Ring 2':    'img/fingerslot.webp',
  'Trinket 1': 'img/trinketslot.webp',
  'Trinket 2': 'img/trinketslot.webp',
  'Main Hand': 'img/mainhandslot.webp',
  'Off Hand':  'img/secondaryhandslot.webp',
  'Shield':    'img/secondaryhandslot.webp',
  'Ranged':    'img/mainhandslot.webp',
};

// Used in the BiS gear list modal rows
function _bisSlotIcon(slot, itemName) {
  const cache = JSON.parse(localStorage.getItem('wow_mn_item_icons') || '{}');
  const apiIcon = itemName && cache[itemName.toLowerCase()];
  if (apiIcon) return `<img src="${apiIcon}" class="bis-slot-icon" title="${itemName}" alt="${slot}">`;
  const src = _BIS_SLOT_ICONS[slot];
  if (!src) return `<span class="bis-slot-label">${slot}</span>`;
  return `<img src="${src}" class="bis-slot-icon bis-slot-icon--placeholder" title="${slot}" alt="${slot}">`;
}

// Used in task cards for imported BiS items — replaces "[Head] Item" with icon + name
function _bisTaskNameHtml(name, searchQuery) {
  const m = (name || '').match(/^\[([^\]]+)\]\s*(.+)$/);
  if (m) {
    const slot = m[1], itemName = m[2];
    const cache = JSON.parse(localStorage.getItem('wow_mn_item_icons') || '{}');
    const apiIcon = cache[itemName.toLowerCase()];
    let iconHtml;
    if (apiIcon) {
      iconHtml = `<img src="${apiIcon}" class="bis-task-icon" title="${itemName}" alt="${slot}">`;
    } else if (_BIS_SLOT_ICONS[slot]) {
      iconHtml = `<img src="${_BIS_SLOT_ICONS[slot]}" class="bis-task-icon bis-task-icon--placeholder" title="${slot}" alt="${slot}">`;
    }
    if (iconHtml) {
      const itemHtml = searchQuery ? highlightMatch(itemName, searchQuery) : escHtml(itemName);
      return `<span class="bis-task-name-wrap">${iconHtml}${itemHtml}</span>`;
    }
  }
  return searchQuery ? highlightMatch(name, searchQuery) : escHtml(name);
}

let _allIconsPrefetched = false;

async function _prefetchAllBisIcons() {
  if (_allIconsPrefetched) return;
  _allIconsPrefetched = true;

  await _seedIconCacheFromKV();

  if (typeof BIS_ITEM_IDS === 'undefined') return;
  const cache = JSON.parse(localStorage.getItem('wow_mn_item_icons') || '{}');
  const missing = Object.entries(BIS_ITEM_IDS)
    .filter(([name]) => !cache[name.toLowerCase()])
    .map(([name, id]) => ({ name, id }));
  if (!missing.length) return;

  for (let i = 0; i < missing.length; i += 40) {
    try {
      const res = await fetch('/api/item-icons-by-id', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items: missing.slice(i, i + 40) }),
      });
      if (!res.ok) continue;
      const found = await res.json();
      if (Object.keys(found).length) Object.assign(cache, found);
    } catch (_) {}
  }

  localStorage.setItem('wow_mn_item_icons', JSON.stringify(cache));
  render();
}

function openBisModal() {
  _bisClass = null;
  _bisSpec  = null;
  document.getElementById('modal-bis').classList.add('open');
  _renderBisPhase('class');
  _prefetchAllBisIcons();
}

function closeBisModal() {
  document.getElementById('modal-bis').classList.remove('open');
}

let _bisEditId   = null;
let _bisEditSlot = null;

function openBisEditModal(event, fullId) {
  if (event) event.stopPropagation();
  _bisEditId   = fullId;
  _bisEditSlot = null;
  const rawId = fullId.replace(/^custom_/, '');
  const task  = loadCustomTasks().find(t => t.id === rawId);
  if (!task) return;
  const m        = (task.name || '').match(/^\[([^\]]+)\]\s*(.*)$/);
  const slot     = m ? m[1] : '';
  const itemName = m ? m[2] : task.name;
  document.getElementById('bis-edit-title').textContent     = 'Edit: ' + slot;
  document.getElementById('bis-edit-slot-label').textContent = '[' + slot + '] (slot is fixed)';
  document.getElementById('bis-edit-name').value = itemName;
  document.getElementById('bis-edit-desc').value = task.desc || '';
  document.getElementById('modal-bis-edit').classList.add('open');
  setTimeout(() => document.getElementById('bis-edit-name').focus(), 50);
}

function openBisSlotCreate(slot) {
  _bisEditId   = null;
  _bisEditSlot = slot;
  document.getElementById('bis-edit-title').textContent     = 'Add Item: ' + slot;
  document.getElementById('bis-edit-slot-label').textContent = '[' + slot + '] (slot is fixed)';
  document.getElementById('bis-edit-name').value = '';
  document.getElementById('bis-edit-desc').value = '';
  document.getElementById('modal-bis-edit').classList.add('open');
  setTimeout(() => document.getElementById('bis-edit-name').focus(), 50);
}

function closeBisEditModal() {
  document.getElementById('modal-bis-edit').classList.remove('open');
  _bisEditId = null; _bisEditSlot = null;
}

function saveBisEdit() {
  const newItem = document.getElementById('bis-edit-name').value.trim();
  const newDesc = document.getElementById('bis-edit-desc').value.trim();
  if (!newItem) return;

  if (_bisEditId) {
    const rawId = _bisEditId.replace(/^custom_/, '');
    const tasks = loadCustomTasks();
    const task  = tasks.find(t => t.id === rawId);
    if (!task) return;
    const m    = (task.name || '').match(/^\[([^\]]+)\]/);
    const slot = m ? m[1] : '';
    task.name  = slot ? '[' + slot + '] ' + newItem : newItem;
    task.desc  = newDesc;
    saveCustomTasks(tasks);
  } else if (_bisEditSlot) {
    const id       = 'bis_' + Date.now().toString(36);
    const taskName = '[' + _bisEditSlot + '] ' + newItem;
    const tasks    = loadCustomTasks();
    tasks.push({ id, name: taskName, desc: newDesc });
    saveCustomTasks(tasks);
    const yourList = loadYourList();
    yourList.push('custom_' + id);
    saveYourList(yourList);
  } else {
    return;
  }

  _fetchIconForItem(newItem);
  closeBisEditModal();
  render();
}

async function _fetchIconForItem(itemName) {
  if (!itemName) return;
  const cache = JSON.parse(localStorage.getItem('wow_mn_item_icons') || '{}');
  if (cache[itemName.toLowerCase()]) { render(); return; }

  let found = false;

  // Try known ID first
  const knownId = (typeof BIS_ITEM_IDS !== 'undefined') && BIS_ITEM_IDS[itemName];
  if (knownId) {
    try {
      const res = await fetch('/api/item-icons-by-id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ name: itemName, id: knownId }] }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Object.keys(data).length) { Object.assign(cache, data); found = true; }
      }
    } catch (_) {}
  }

  // Fall back to name search
  if (!found) {
    try {
      const res = await fetch('/api/item-icons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: [itemName] }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Object.keys(data).length) { Object.assign(cache, data); found = true; }
      }
    } catch (_) {}
  }

  if (found) {
    localStorage.setItem('wow_mn_item_icons', JSON.stringify(cache));
    render();
  }
}

function _renderBisPhase(phase) {
  const content  = document.getElementById('bis-content');
  const footer   = document.getElementById('bis-footer');
  const breadEl  = document.getElementById('bis-breadcrumb');
  const titleEl  = document.getElementById('bis-title');
  const subEl    = document.getElementById('bis-subtitle');

  if (phase === 'class') {
    titleEl.textContent = 'Best in Slot Gear';
    subEl.textContent   = 'Select your class to get started.';
    breadEl.innerHTML   = '';
    footer.innerHTML    = '<button class="btn-cancel" onclick="closeBisModal()">Close</button>';

    const grid = WOW_CLASSES.map(cls => {
      const colorStyle = `border-left: 3px solid ${cls.color};`;
      const classesId  = cls.key.replace('deathknight','death-knight').replace('demonhunter','demon-hunter');
      const classDef   = CLASSES.find(c => c.id === classesId);
      const iconHtml   = classDef
        ? `<img src="${classDef.icon}" style="width:20px;height:20px;flex-shrink:0;image-rendering:auto;">`
        : `<span class="bis-class-icon">${cls.icon}</span>`;
      return `<button class="bis-class-btn" style="${colorStyle}" onclick="_bisPickClass('${cls.key}')">
        ${iconHtml}
        <span class="bis-class-label">${cls.label}</span>
      </button>`;
    }).join('');
    content.innerHTML = `<div class="bis-class-grid">${grid}</div>`;

  } else if (phase === 'spec') {
    const cls = WOW_CLASSES.find(c => c.key === _bisClass);
    titleEl.textContent = cls.label;
    subEl.textContent   = `${cls.armor} armor · Choose a specialization.`;
    breadEl.innerHTML   = `<button class="bis-crumb-btn" onclick="_renderBisPhase('class')">← Classes</button>`;

    const roleBadge = {
      tank: '<img src="img/tankrole.webp" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;opacity:0.9;">',
      heal: '<img src="img/healerrole.webp" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;opacity:0.9;">',
      dps:  '<img src="img/dpsrole.webp" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;opacity:0.9;">',
    };
    const specs = cls.specs.map(sp => {
      const hasData = BIS_DATA[_bisClass] && BIS_DATA[_bisClass][sp.key] && BIS_DATA[_bisClass][sp.key].items.length > 0;
      const newTag  = sp.tag === 'new' ? '<span class="bis-spec-tag">New</span>' : '';
      const role    = roleBadge[sp.role] || '';
      const dimmed  = !hasData ? 'opacity:0.5;' : '';
      return `<button class="bis-spec-btn" style="${dimmed}" onclick="_bisPickSpec('${sp.key}')">${sp.label}${role}${newTag}</button>`;
    }).join('');
    content.innerHTML   = `<div class="bis-spec-grid">${specs}</div>`;
    footer.innerHTML    = '<button class="btn-cancel" onclick="_renderBisPhase(\'class\')">← Back</button>';

  } else if (phase === 'gear') {
    const cls  = WOW_CLASSES.find(c => c.key === _bisClass);
    const sp   = cls.specs.find(s => s.key === _bisSpec);
    const data = (BIS_DATA[_bisClass] && BIS_DATA[_bisClass][_bisSpec]) ? BIS_DATA[_bisClass][_bisSpec].items : [];

    titleEl.textContent = `${cls.label}: ${sp.label}`;
    subEl.textContent   = `Select items to add to Your List as tasks. Each imports as a completable gear-tracking task.`;
    breadEl.innerHTML   = `<button class="bis-crumb-btn" onclick="_renderBisPhase('class')">← Classes</button>
      <span style="margin:0 0.3rem;opacity:0.5;">›</span>
      <button class="bis-crumb-btn" onclick="_renderBisPhase('spec')">${cls.label}</button>`;

    if (!data.length) {
      content.innerHTML = `<div class="bis-empty">
        BiS list for <strong>${cls.label} · ${sp.label}</strong> is coming soon.<br>
        Check <a href="https://www.icy-veins.com/wow/${_bisClass.replace('deathknight','death-knight').replace('demonhunter','demon-hunter')}-${_bisSpec}-pve-dps-gear-best-in-slot" target="_blank" rel="noopener">Icy Veins</a> for up-to-date gear recommendations.
      </div>`;
      footer.innerHTML = '<button class="btn-cancel" onclick="_renderBisPhase(\'spec\')">← Back</button>';
      return;
    }

    // Check which items are currently in Your List (not just in customTasks storage)
    const _existingCustom = loadCustomTasks();
    const _existingByName = new Map(_existingCustom.map(t => [t.name, t.id]));
    const _yourListSet    = new Set(loadYourList());
    const rows = data.map((item, i) => {
      const taskName  = `[${item.slot}] ${item.item}`;
      const existId   = _existingByName.get(taskName);
      const inList    = !!(existId && _yourListSet.has('custom_' + existId));
      const selClass  = inList ? 'selected' : '';
      const checked   = inList ? 'checked' : '';
      return `<label class="bis-gear-row ${selClass}" id="bis-row-${i}">
        <input type="checkbox" class="bis-gear-check" id="bis-chk-${i}" ${checked}
               onchange="_bisRowToggle(${i})" onclick="event.stopPropagation()">
        ${_bisSlotIcon(item.slot, item.item)}
        <span class="bis-item-name">${item.item}</span>
        <span class="bis-item-source" title="${item.source} · ${item.location}">${item.source}</span>
      </label>`;
    }).join('');

    content.innerHTML = `
      <div class="bis-select-all-bar">
        <button onclick="_bisSelectAll(true)">Select All</button>
        <button onclick="_bisSelectAll(false)">Deselect All</button>
        <span>${data.length} slots</span>
      </div>
      <div class="bis-gear-list">${rows}</div>`;

    footer.innerHTML = `
      <button class="btn-cancel" onclick="_renderBisPhase('spec')">← Back</button>
      <button class="btn-primary" onclick="_bisImportSelected()">⚔ Import Selected</button>`;

    // Fetch icons for items not yet in cache, then re-render if any found
    _fetchMissingBisIcons(data);
  }
}

let _kvIconCacheSeeded = false;

async function _seedIconCacheFromKV() {
  if (_kvIconCacheSeeded) return;
  _kvIconCacheSeeded = true;
  try {
    const res = await fetch('/api/item-icons-cache');
    if (!res.ok) return;
    const remote = await res.json();
    if (!Object.keys(remote).length) return;
    const local = JSON.parse(localStorage.getItem('wow_mn_item_icons') || '{}');
    const merged = Object.assign({}, remote, local);
    localStorage.setItem('wow_mn_item_icons', JSON.stringify(merged));
  } catch (_) {}
}

async function _fetchMissingBisIcons(items) {
  await _seedIconCacheFromKV();

  const cache = JSON.parse(localStorage.getItem('wow_mn_item_icons') || '{}');

  // Split uncached items into those with known IDs vs name-only
  const byId   = [];  // { name, id }
  const byName = [];  // name strings
  for (const { item } of items) {
    if (cache[item.toLowerCase()]) continue;
    const id = (typeof BIS_ITEM_IDS !== 'undefined') && BIS_ITEM_IDS[item];
    if (id) byId.push({ name: item, id });
    else    byName.push(item);
  }
  if (!byId.length && !byName.length) return;

  let anyFound = false;

  // Direct ID-based lookup — worker also persists results to KV
  if (byId.length) {
    try {
      const res = await fetch('/api/item-icons-by-id', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items: byId }),
      });
      if (res.ok) {
        const found = await res.json(); // { "name lowercase": "https://...", ... }
        if (Object.keys(found).length) {
          Object.assign(cache, found);
          anyFound = true;
        }
      }
    } catch (_) {}
  }

  // Name-based fallback for items without known IDs
  if (byName.length) {
    try {
      const res = await fetch('/api/item-icons', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ names: byName }),
      });
      if (res.ok) {
        const found = await res.json();
        if (Object.keys(found).length) {
          Object.assign(cache, found);
          anyFound = true;
        }
      }
    } catch (_) {}
  }

  if (anyFound) {
    localStorage.setItem('wow_mn_item_icons', JSON.stringify(cache));
    _renderBisPhase('gear');
  }
}

function _bisPickClass(classKey) {
  _bisClass = classKey;
  _renderBisPhase('spec');
}

function _bisPickSpec(specKey) {
  _bisSpec = specKey;
  _renderBisPhase('gear');
}

function _bisRowToggle(i) {
  const chk = document.getElementById('bis-chk-' + i);
  const row = document.getElementById('bis-row-' + i);
  if (chk.checked) row.classList.add('selected');
  else row.classList.remove('selected');
}

function _bisSelectAll(checked) {
  const data = (BIS_DATA[_bisClass] && BIS_DATA[_bisClass][_bisSpec]) ? BIS_DATA[_bisClass][_bisSpec].items : [];
  data.forEach((_, i) => {
    const chk = document.getElementById('bis-chk-' + i);
    const row = document.getElementById('bis-row-' + i);
    if (chk) { chk.checked = checked; }
    if (row) { checked ? row.classList.add('selected') : row.classList.remove('selected'); }
  });
}

function _bisImportSelected() {
  const cls  = WOW_CLASSES.find(c => c.key === _bisClass);
  const sp   = cls ? cls.specs.find(s => s.key === _bisSpec) : null;
  const data = (BIS_DATA[_bisClass] && BIS_DATA[_bisClass][_bisSpec]) ? BIS_DATA[_bisClass][_bisSpec].items : [];

  const existing    = loadCustomTasks();
  const existByName = new Map(existing.map(t => [t.name, t.id]));
  const yourList    = loadYourList();
  const yourListSet = new Set(yourList);
  let   imported    = 0;

  data.forEach((item, i) => {
    const chk = document.getElementById('bis-chk-' + i);
    if (!chk || !chk.checked) return;
    const taskName = `[${item.slot}] ${item.item}`;
    const existId  = existByName.get(taskName);
    if (existId) {
      // Task exists in storage — re-add to list if it was removed
      const customId = 'custom_' + existId;
      if (!yourListSet.has(customId)) {
        yourList.push(customId);
        yourListSet.add(customId);
        imported++;
      }
      return;
    }
    // New item — add to customTasks and yourList
    const desc = `${item.source} · ${item.location}`;
    const id   = 'bis_' + Date.now().toString(36) + '_' + i;
    existing.push({ id, name: taskName, desc });
    yourList.push('custom_' + id);
    imported++;
  });

  if (imported === 0) {
    // All selected items were already imported — just close
    closeBisModal();
    render();
    return;
  }

  saveCustomTasks(existing);
  saveYourList(yourList);
  closeBisModal();
  render();

  // Show a brief toast
  const toast = document.getElementById('share-toast');
  if (toast) {
    toast.textContent = `${imported} BiS item${imported === 1 ? '' : 's'} added to Your List`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
}

/* ═══════════════════════════════════════════
   WEEKLY SUMMARY  (with All Alts tab)
═══════════════════════════════════════════ */
function openSummary() {
  document.getElementById('modal-summary').classList.add('open');
  renderSummaryTab('current');
}

function renderSummaryTab(tab) {
  const content = document.getElementById('summary-content');
  const week    = getWeekKey();
  const d       = new Date(week + 'T15:00:00Z');
  const weekLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  const tabBar = `
    <div class="summary-tabs">
      <button class="summary-tab${tab==='current'?' active':''}" onclick="renderSummaryTab('current')">📊 ${currentChar}</button>
      <button class="summary-tab${tab==='alts'?' active':''}" onclick="renderSummaryTab('alts')">👥 All Alts</button>
      <button class="summary-tab" onclick="renderEfficiencyTab()">📈 Efficiency</button>
      <button class="summary-tab" onclick="renderHeatmapTab()">🗺 Heatmap</button>
    </div>`;

  if (tab === 'current') {
    const done   = loadDone();
    const hidden = loadHidden();
    const ylArr  = loadYourList();
    const isYLScope = activeFilters.has('yourlist') && ylArr.length > 0;
    const ylSet  = new Set(ylArr);
    document.getElementById('summary-title').textContent = isYLScope ? 'Your List Summary' : 'Weekly Summary';
    let rows = [], grandTotal = 0, grandDone = 0;
    SECTIONS.forEach(sec => {
      const visible = isYLScope
        ? sec.tasks.filter(t => ylSet.has(t.id))
        : sec.tasks.filter(t => !hidden[t.id]);
      if (!visible.length) return;
      const secDone = visible.filter(t => done[t.id]).length;
      grandTotal += visible.length;
      grandDone  += secDone;
      rows.push({ title: sec.title, icon: sec.icon, iconClass: sec.iconClass, done: secDone, total: visible.length });
    });
    const customTasks = isYLScope
      ? loadCustomTasks().filter(t => ylSet.has('custom_' + t.id) && !t.id.startsWith('bis_'))
      : loadCustomTasks().filter(t => !t.id.startsWith('bis_'));
    if (customTasks.length) {
      const cDone = customTasks.filter(t => done['custom_' + t.id]).length;
      grandTotal += customTasks.length;
      grandDone  += cDone;
      rows.push({ title: 'Custom Tasks', icon: '✦', iconClass: 'icon-optional', done: cDone, total: customTasks.length });
    }
    const pct = grandTotal ? Math.round((grandDone / grandTotal) * 100) : 0;
    content.innerHTML = tabBar + `
      <div class="summary-week">Reset week of ${weekLabel}</div>
      ${rows.map(r => {
        const p = r.total ? Math.round((r.done / r.total) * 100) : 0;
        const complete = r.done === r.total && r.total > 0;
        return `
        <div class="summary-section">
          <div class="section-icon ${r.iconClass}" style="width:22px;height:22px;font-size:11px;flex-shrink:0;">${r.icon}</div>
          <span class="summary-label" title="${r.title}">${r.title}</span>
          <div class="summary-bar-track">
            <div class="summary-bar-fill${complete?' complete':''}" style="width:${p}%"></div>
          </div>
          <span class="summary-count" style="${complete?'color:var(--success-bright)':''}">${r.done}/${r.total}</span>
        </div>`;
      }).join('')}
      <div class="summary-total">
        <span class="summary-label">Overall Progress</span>
        <div class="summary-bar-track">
          <div class="summary-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--light-gold),var(--void-glow))"></div>
        </div>
        <span class="summary-count" style="color:var(--light-gold);font-size:12px;">${grandDone}/${grandTotal} &nbsp;${pct}%</span>
      </div>`;

  } else {
    // All alts tab
    document.getElementById('summary-title').textContent = `Weekly Summary`;
    const altRows = characters.map(c => {
      const done   = JSON.parse(localStorage.getItem('wow_mn_' + c + '_' + week) || '{}');
      const hidden = JSON.parse(localStorage.getItem('wow_mn_hidden_' + c) || '{}');
      const custom = JSON.parse(localStorage.getItem('wow_mn_custom_' + c) || '[]');
      const cls    = localStorage.getItem('wow_mn_class_' + c) || '';
      let total = 0, completed = 0;
      SECTIONS.forEach(sec => {
        sec.tasks.filter(t => !hidden[t.id]).forEach(t => { total++; if (done[t.id]) completed++; });
      });
      custom.forEach(t => { total++; if (done['custom_' + t.id]) completed++; });
      const pct    = total ? Math.round((completed / total) * 100) : 0;
      const clsDef = cls ? CLASSES.find(x => x.id === cls) : null;
      const history = loadHistory(c);
      let streak = 0;
      for (const e of history) { if (e.done === e.total && e.total > 0) streak++; else break; }
      const group = loadCharGroupFor(c);
      return { name: c, done: completed, total, pct, clsDef, streak, group };
    });

    const altRowHtml = r => {
      const barColor = r.pct === 100 ? 'var(--success-bright)'
        : r.pct >= 60 ? 'var(--void-glow)'
        : r.pct >= 30 ? 'var(--light-gold)'
        : 'var(--void-purple)';
      const clsColor = r.clsDef ? r.clsDef.color : 'var(--border-bright)';
      return '<div class="alt-row' + (r.name === currentChar ? ' alt-row-active' : '') + '" onclick="closeSummary();switchChar(\'' + r.name + '\')">'
        + '<div class="alt-row-left">'
        + (r.clsDef
            ? '<img src="' + r.clsDef.icon + '" style="width:18px;height:18px;flex-shrink:0;border-radius:2px;">'
            : '<div style="width:18px;height:18px;border-radius:2px;background:var(--bg-panel);border:1px solid var(--border);flex-shrink:0;"></div>')
        + '<div class="alt-row-name" style="border-left:3px solid ' + clsColor + ';">'
        + r.name + (r.name === currentChar ? ' <span style="color:var(--text-muted);font-size:10px;">(active)</span>' : '')
        + '</div></div>'
        + '<div class="alt-row-right">'
        + (r.streak > 0 ? '<span class="alt-streak" title="' + r.streak + ' week streak">🔥 ' + r.streak + '</span>' : '')
        + '<div class="alt-progress-wrap">'
        + '<div class="alt-progress-track"><div class="alt-progress-fill" style="width:' + r.pct + '%;background:' + barColor + ';"></div></div>'
        + '<span class="alt-progress-label" style="color:' + (r.pct===100?'var(--success-bright)':'var(--text-secondary)') + ';">' + r.done + '/' + r.total + '</span>'
        + '</div>'
        + '<span class="alt-pct" style="color:' + barColor + ';">' + r.pct + '%</span>'
        + '</div></div>';
    };

    // Group rows if any character has a group set
    const hasGroups = altRows.some(r => r.group);
    let rowsHtml = '';
    if (hasGroups) {
      const groupMap = { main: [], alt: [], farm: [], '': [] };
      altRows.forEach(r => { (groupMap[r.group] || groupMap['']).push(r); });
      GROUP_ORDER.forEach(g => {
        if (!groupMap[g] || !groupMap[g].length) return;
        const gm = GROUP_META[g];
        const headerColor = gm ? gm.color : 'var(--text-muted)';
        rowsHtml += '<div class="alts-group-header" style="color:' + headerColor + ';">' + GROUP_LABELS[g] + '</div>';
        rowsHtml += groupMap[g].map(altRowHtml).join('');
      });
    } else {
      rowsHtml = altRows.map(altRowHtml).join('');
    }

    content.innerHTML = tabBar
      + '<div class="summary-week">Week of ' + weekLabel + ' · ' + altRows.filter(r=>r.pct===100).length + '/' + altRows.length + ' fully complete</div>'
      + rowsHtml
      + '<div style="margin-top:0.75rem;font-family:\'Cinzel\',serif;font-size:11px;color:var(--text-muted);text-align:right;">Click any row to switch character</div>';
  }
}

function closeSummary() { document.getElementById('modal-summary').classList.remove('open'); }

function copyDiscordSummary() {
  const week      = getWeekKey();
  const d         = new Date(week + 'T15:00:00Z');
  const weekLabel = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const done      = loadDone();
  const hidden    = loadHidden();
  const ylArr     = loadYourList();
  const isYLScope = activeFilters.has('yourlist') && ylArr.length > 0;
  const ylSet     = new Set(ylArr);

  const cls    = loadCharClass(currentChar);
  const clsDef = cls ? CLASSES.find(x => x.id === cls) : null;
  const group  = loadCharGroupFor(currentChar);
  const gm     = GROUP_META[group];

  const SHORT = {
    'Mythic+ Dungeons': 'Mythic+', 'Optional & Collector Content': 'Optional',
    'Bazaar Weekly Quests': 'Bazaar', 'Player Housing': 'Housing',
    'Prey System': 'Prey', 'Showdown Zones': 'Showdown',
  };

  const rows = [];
  let grandTotal = 0, grandDone = 0;
  SECTIONS.forEach(sec => {
    const visible = isYLScope
      ? sec.tasks.filter(t => ylSet.has(t.id))
      : sec.tasks.filter(t => !hidden[t.id]);
    if (!visible.length) return;
    const secDone = visible.filter(t => done[t.id]).length;
    grandTotal += visible.length;
    grandDone  += secDone;
    rows.push({ title: SHORT[sec.title] || sec.title, done: secDone, total: visible.length });
  });
  const customTasks = isYLScope
    ? loadCustomTasks().filter(t => ylSet.has('custom_' + t.id) && !t.id.startsWith('bis_'))
    : loadCustomTasks().filter(t => !t.id.startsWith('bis_'));
  if (customTasks.length) {
    const cDone = customTasks.filter(t => done['custom_' + t.id]).length;
    grandTotal += customTasks.length;
    grandDone  += cDone;
    rows.push({ title: 'Custom', done: cDone, total: customTasks.length });
  }

  const pct    = grandTotal ? Math.round((grandDone / grandTotal) * 100) : 0;
  const filled = Math.round(pct / 5);
  const bar    = '█'.repeat(filled) + '░'.repeat(20 - filled);

  const complete = rows.filter(r => r.done === r.total && r.total > 0);
  const partial  = rows.filter(r => r.done > 0 && r.done < r.total);
  const untouched = rows.filter(r => r.done === 0);

  const sectionLines = [];
  if (complete.length)  sectionLines.push('✅ ' + complete.map(r => r.title).join(' · '));
  if (partial.length)   sectionLines.push('🔄 ' + partial.map(r => r.title + ' ' + r.done + '/' + r.total).join(' · '));
  if (untouched.length) sectionLines.push('⬜ ' + untouched.map(r => r.title).join(' · '));

  let charLine = '**' + currentChar + '**';
  if (clsDef) charLine += ' · ' + clsDef.name;
  if (gm)     charLine += ' · ' + gm.label.replace(/^[^ ]+ /, '');

  const scopeLabel = isYLScope ? ' · Your List' : '';

  const text = [
    '📊 **The Azeroth Agenda**' + scopeLabel + ' — ' + weekLabel,
    charLine,
    '',
    grandDone + '/' + grandTotal + ' tasks · ' + pct + '% \`' + bar + '\`',
    '',
    ...sectionLines,
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showShareToast('📋 Summary copied for Discord!');
  }).catch(() => {
    prompt('Copy this summary:', text);
  });
}


/* ═══════════════════════════════════════════
   EXPORT / IMPORT CHARACTER DATA
═══════════════════════════════════════════ */
function getAllCharData(charName) {
  const prefix = 'wow_mn_';
  const data = {
    version: '1.0', character: charName, exported: new Date().toISOString(),
    weeklyDone: {},
    hidden:      JSON.parse(localStorage.getItem(`${prefix}hidden_${charName}`)    || '{}'),
    customTasks: JSON.parse(localStorage.getItem(`${prefix}custom_${charName}`)    || '[]'),
    yourList:    JSON.parse(localStorage.getItem(`${prefix}yourlist_${charName}`)  || '[]'),
    notes:       JSON.parse(localStorage.getItem(`${prefix}notes_${charName}`)     || '{}'),
  };
  Object.keys(localStorage)
    .filter(k => k.startsWith(`${prefix}${charName}_`))
    .forEach(k => {
      const week = k.replace(`${prefix}${charName}_`, '');
      data.weeklyDone[week] = JSON.parse(localStorage.getItem(k) || '{}');
    });
  return data;
}

function openExportImport() {
  const modal   = document.getElementById('modal-data');
  const content = document.getElementById('data-modal-content');
  const btns    = document.getElementById('data-modal-btns');
  document.getElementById('data-modal-title').textContent = `Character Data: ${currentChar}`;
  btns.innerHTML = `<button class="btn-cancel" onclick="closeDataModal()">Close</button>`;
  content.innerHTML = `
    <div class="data-option" onclick="exportCharData()">
      <div class="data-option-icon">📤</div>
      <div class="data-option-body">
        <div class="data-option-title">Export Character</div>
        <div class="data-option-desc">Download ${currentChar}'s progress, custom tasks, hidden tasks, and Your List as a JSON file.</div>
      </div>
    </div>
    <div class="data-option" onclick="openImportPicker()">
      <div class="data-option-icon">📥</div>
      <div class="data-option-body">
        <div class="data-option-title">Import Character</div>
        <div class="data-option-desc">Load a previously exported JSON file to restore or transfer character data.</div>
      </div>
    </div>
    <div class="data-option" onclick="exportAllData()">
      <div class="data-option-icon">💾</div>
      <div class="data-option-body">
        <div class="data-option-title">Export All Characters</div>
        <div class="data-option-desc">Download every character's data as a single backup JSON file.</div>
      </div>
    </div>
    <div class="data-option" onclick="closeDataModal();localStorage.removeItem('wow_mn_welcomed');openWelcome()">
      <div class="data-option-icon">🧭</div>
      <div class="data-option-body">
        <div class="data-option-title">Site Guide</div>
        <div class="data-option-desc">Reopen the feature walkthrough shown on your first visit.</div>
      </div>
    </div>`;
  modal.classList.add('open');
}

function closeDataModal() { document.getElementById('modal-data').classList.remove('open'); }


function exportCharData() {
  const data = getAllCharData(currentChar);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `wow-tracker-${currentChar.toLowerCase().replace(/\s+/g,'-')}-${getWeekKey()}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function exportAllData() {
  const all = { version: '1.0', exported: new Date().toISOString(), characters: {} };
  characters.forEach(c => { all.characters[c] = getAllCharData(c); });
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `wow-tracker-all-characters-${getWeekKey()}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function openImportPicker() {
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-file-input').click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try { showImportPreview(JSON.parse(e.target.result)); }
    catch { alert('Invalid file. Could not parse JSON.'); }
  };
  reader.readAsText(file);
}

function showImportPreview(data) {
  const content  = document.getElementById('data-modal-content');
  const btns     = document.getElementById('data-modal-btns');
  document.getElementById('data-modal-title').textContent = 'Import Preview';

  const isAllChars = !!data.characters;
  const entries    = isAllChars ? Object.entries(data.characters) : [[data.character, data]];
  const exported   = new Date(data.exported).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

  const charList = entries.map(([charName, d]) => {
    const weekCount     = Object.keys(d.weeklyDone || {}).length;
    const customCount   = (d.customTasks || []).length;
    const yourListCount = (d.yourList || []).length;
    const exists        = characters.includes(charName);
    return `<div style="display:flex;gap:0.5rem;align-items:baseline;margin-bottom:3px;flex-wrap:wrap;">
      <span style="font-family:'Cinzel',serif;font-size:12px;color:var(--light-pale);">${charName}</span>
      <span style="font-size:12px;color:var(--text-muted);">${weekCount} week${weekCount!==1?'s':''} · ${customCount} custom · ${yourListCount} list items</span>
      ${exists
        ? '<span style="font-size:11px;color:#e07068;font-style:italic;">overwrites existing</span>'
        : '<span style="font-size:11px;color:var(--success-bright);font-style:italic;">new character</span>'}
    </div>`;
  }).join('');

  content.innerHTML = `
    <div class="import-preview">
      <strong>Exported:</strong> ${exported}<br>
      <strong>Characters:</strong>
      <div style="margin-top:0.4rem;">${charList}</div>
    </div>
    <div class="import-warning">⚠ Existing data for matching characters will be overwritten. This cannot be undone.</div>`;

  window._pendingImport = data;
  btns.innerHTML = `
    <button class="btn-cancel" onclick="openExportImport()">← Back</button>
    <button class="btn-primary" onclick="confirmFileImport()">✓ Confirm Import</button>`;
}

function confirmFileImport() {
  const data = window._pendingImport;
  if (!data) return;
  const prefix     = 'wow_mn_';
  const isAllChars = !!data.characters;
  const entries    = isAllChars ? Object.entries(data.characters) : [[data.character, data]];

  entries.forEach(([charName, d]) => {
    if (!characters.includes(charName)) {
      characters.push(charName);
      localStorage.setItem('wow_midnight_chars', JSON.stringify(characters));
    }
    Object.entries(d.weeklyDone || {}).forEach(([week, done]) => {
      localStorage.setItem(`${prefix}${charName}_${week}`, JSON.stringify(done));
    });
    if (d.hidden)      localStorage.setItem(`${prefix}hidden_${charName}`,   JSON.stringify(d.hidden));
    if (d.customTasks) localStorage.setItem(`${prefix}custom_${charName}`,   JSON.stringify(d.customTasks));
    if (d.yourList)    localStorage.setItem(`${prefix}yourlist_${charName}`, JSON.stringify(d.yourList));
    if (d.notes)       localStorage.setItem(`${prefix}notes_${charName}`,    JSON.stringify(d.notes));
  });

  window._pendingImport = null;
  closeDataModal(); renderChars(); render();
  alert(`Import complete. ${entries.length} character${entries.length!==1?'s':''} restored.`);
}

/* ═══════════════════════════════════════════
   WHAT'S NEXT
═══════════════════════════════════════════ */
function whatsNext() {
  const done     = loadDone();
  const yourList = new Set(loadYourList());
  const hidden   = loadHidden();

  // Gather all uncompleted tasks from Your List
  const candidates = [];
  SECTIONS.forEach(sec => {
    sec.tasks.forEach(t => {
      if (yourList.has(t.id) && !done[t.id] && !hidden[t.id]) {
        candidates.push({ id: t.id, type: 'section' });
      }
    });
  });
  loadCustomTasks().forEach(t => {
    const key = 'custom_' + t.id;
    if (yourList.has(key) && !done[key]) {
      candidates.push({ id: key, type: 'custom' });
    }
  });

  if (candidates.length === 0) {
    // Fall back to any uncompleted task if Your List is empty or all done
    SECTIONS.forEach(sec => {
      sec.tasks.forEach(t => {
        if (!done[t.id] && !hidden[t.id]) candidates.push({ id: t.id, type: 'section' });
      });
    });
  }

  if (candidates.length === 0) {
    alert('Everything is done! Great work this week. 🎉');
    _confetti.celebrate();
    return;
  }

  // Pick a random candidate
  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  // Switch to the right view to reveal it
  if (!activeFilters.has('all')) {
    activeFilters = new Set(['all']);
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
    });
    render();
  }

  // Find the task element and scroll + highlight it
  // Tasks render with onclick containing the id — find by that
  setTimeout(() => {
    const taskEl = [...document.querySelectorAll('.task')].find(el => {
      const oc = el.getAttribute('onclick') || '';
      return oc.includes(`'${pick.id}'`) || oc.includes(`"${pick.id}"`);
    });
    if (taskEl) {
      // Ensure section is expanded
      const body = taskEl.closest('.section-body');
      if (body && body.classList.contains('hidden')) {
        const header = body.previousElementSibling;
        if (header) header.click();
      }
      taskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      taskEl.classList.remove('whats-next-highlight');
      void taskEl.offsetWidth; // force reflow to restart animation
      taskEl.classList.add('whats-next-highlight');
      taskEl.addEventListener('animationend', () => {
        taskEl.classList.remove('whats-next-highlight');
      }, { once: true });
    }
  }, 100);
}

/* ═══════════════════════════════════════════
   TASK NOTES
═══════════════════════════════════════════ */
function toggleNote(e, id) {
  e.stopPropagation();
  const area = document.getElementById('note-area-' + id);
  if (!area) return;
  const isOpen = area.classList.toggle('open');
  if (isOpen) {
    const input = area.querySelector('.task-note-input');
    if (input) setTimeout(() => input.focus(), 50);
  }
}

function saveNote(id) {
  const input = document.getElementById('note-input-' + id);
  if (!input) return;
  const notes = loadNotes();
  const val   = input.value.trim();
  if (val) notes[id] = val; else delete notes[id];
  saveNotes(notes);
  // Update toggle button appearance without full re-render
  const btn = document.getElementById('note-btn-' + id);
  if (btn) btn.classList.toggle('has-note', !!val);
  // Flash saved indicator
  const saved = document.getElementById('note-saved-' + id);
  if (saved) {
    saved.classList.add('show');
    setTimeout(() => saved.classList.remove('show'), 1500);
  }
}

function noteHtml(id, notes) {
  const val = notes[id] || '';
  return `
    <div class="task-note-area${val ? ' open' : ''}" id="note-area-${id}" onclick="event.stopPropagation()">
      <textarea class="task-note-input" id="note-input-${id}"
        placeholder="Add a personal note… e.g. 'Use Voidcore on trinket slot' or 'Skip, already capped'"
        oninput="saveNote('${id}')"
        onblur="saveNote('${id}')"
      >${escHtml(val)}</textarea>
      <div class="task-note-saved" id="note-saved-${id}">✓ Saved</div>
    </div>`;
}

function noteBtnHtml(id, notes) {
  const hasNote = !!(notes[id]);
  return `<button class="task-note-toggle${hasNote ? ' has-note' : ''}" id="note-btn-${id}" title="${hasNote ? 'Edit note' : 'Add note'}" onclick="toggleNote(event,'${id}')">📝</button>`;
}

/* ═══════════════════════════════════════════
   AUTO-SNAPSHOT ON WEEK ROLLOVER
   If the stored "last seen week" differs from the current week,
   it means a reset just happened — snapshot every character's
   previous week before anything is overwritten.
═══════════════════════════════════════════ */
(function autoSnapshotOnRollover() {
  const LAST_WEEK_KEY = 'wow_mn_last_seen_week';
  const currentWeek   = getWeekKey();
  const lastWeek      = localStorage.getItem(LAST_WEEK_KEY);
  if (lastWeek && lastWeek !== currentWeek) {
    // New week detected — snapshot all characters for the previous week
    characters.forEach(c => snapshotWeekForChar(c, lastWeek));
  }
  localStorage.setItem(LAST_WEEK_KEY, currentWeek);
})();

/* ═══════════════════════════════════════════
   INLINE HISTORY BAR
   Renders a compact per-week sparkline strip
   in the lower-right of the reset bar.
═══════════════════════════════════════════ */
function renderInlineHistory() {
  const el = document.getElementById('inline-history');
  if (!el) return;

  const history    = loadHistory(currentChar);
  const currentWeek = getWeekKey();
  const doneCur    = loadDone();
  const hiddenCur  = loadHidden();
  const customCur  = loadCustomTasks();
  let curTotal = 0, curDone = 0;
  SECTIONS.forEach(sec => {
    sec.tasks.filter(t => !hiddenCur[t.id]).forEach(t => { curTotal++; if (doneCur[t.id]) curDone++; });
  });
  customCur.forEach(t => { curTotal++; if (doneCur['custom_' + t.id]) curDone++; });

  // Build display weeks: current + up to 11 past = 12 bars max
  const allWeeks = [];
  if (curTotal > 0) allWeeks.push({ done: curDone, total: curTotal, isCurrent: true, week: currentWeek });
  history.filter(e => e.week !== currentWeek).slice(0, 11).forEach(e => allWeeks.push(e));

  if (allWeeks.length === 0) {
    el.innerHTML = '<span style="font-family:\'Cinzel\',serif;font-size:11px;color:var(--text-muted);font-style:italic;">No history yet</span>';
    return;
  }

  // Streak count from history (past completed weeks)
  let streak = 0;
  for (const e of history) { if (e.done === e.total && e.total > 0) streak++; else break; }

  const best = [...allWeeks].sort((a, b) => (b.done/b.total) - (a.done/a.total))[0];

  const bars = allWeeks.map(e => {
    const pct  = e.total ? Math.round((e.done / e.total) * 100) : 0;
    const full = e.done === e.total && e.total > 0;
    const color = full ? 'var(--success-bright)'
      : pct >= 60 ? 'var(--void-glow)'
      : pct >= 30 ? 'var(--light-gold)'
      : 'var(--void-purple)';
    const d     = new Date(e.week + 'T15:00:00Z');
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const title = `${label}: ${e.done}/${e.total} (${pct}%)${full?' ⭐':''}`;
    return `<div class="hist-bar-wrap" title="${title}">
      <div class="hist-bar-track">
        <div class="hist-bar-fill${e.isCurrent?' hist-bar-now':''}" style="height:${Math.max(4,pct)}%;background:${color};"></div>
      </div>
      ${e.isCurrent ? '<div class="hist-bar-dot"></div>' : ''}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="inline-history-inner">
      <div class="inline-history-label">History</div>
      <div class="inline-history-bars">${bars}</div>
      <div class="inline-history-stats">
        <div class="inline-hist-stat">
          <div class="inline-hist-stat-val">${allWeeks.length}</div>
          <div class="inline-hist-stat-label">Weeks</div>
        </div>
        <div class="inline-hist-stat">
          <div class="inline-hist-stat-val" style="color:var(--light-gold);">🔥 ${streak}</div>
          <div class="inline-hist-stat-label">Streak</div>
        </div>
        <div class="inline-hist-stat">
          <div class="inline-hist-stat-val" style="color:var(--success-bright);">${best ? Math.round((best.done/best.total)*100) : 0}%</div>
          <div class="inline-hist-stat-label">Best Week</div>
        </div>
        <div class="inline-hist-stat">
          <div class="inline-hist-stat-val">${Math.round(allWeeks.reduce((s,e) => s + (e.done/e.total), 0) / allWeeks.length * 100)}%</div>
          <div class="inline-hist-stat-label">Avg</div>
        </div>
      </div>
    </div>`;
}


/* ═══════════════════════════════════════════
   PER-SECTION EFFICIENCY SCORE
   Reads historical snapshots to compute how
   consistently each section gets completed.
═══════════════════════════════════════════ */
function renderEfficiencyTab() {
  const history = loadHistory(currentChar);
  const content = document.getElementById('summary-content');
  const week    = getWeekKey();
  const d       = new Date(week + 'T15:00:00Z');
  const weekLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  const tabBar = '<div class="summary-tabs">'
    + '<button class="summary-tab" onclick="renderSummaryTab(\'current\')">📊 ' + currentChar + '</button>'
    + '<button class="summary-tab" onclick="renderSummaryTab(\'alts\')">👥 All Alts</button>'
    + '<button class="summary-tab active" onclick="renderEfficiencyTab()">📈 Efficiency</button>'
    + '<button class="summary-tab" onclick="renderHeatmapTab()">🗺 Heatmap</button>'
    + '</div>';

  // Gather per-section stats from history entries that have section data
  const sectionStats = {}; // { secId: { title, appearances, totalDone, totalTasks } }
  const weeksWithData = history.filter(e => e.sections);

  weeksWithData.forEach(e => {
    Object.entries(e.sections).forEach(([secId, s]) => {
      if (!sectionStats[secId]) sectionStats[secId] = { title: s.title, appearances: 0, totalDone: 0, totalTasks: 0 };
      sectionStats[secId].appearances++;
      sectionStats[secId].totalDone  += s.done;
      sectionStats[secId].totalTasks += s.total;
    });
  });

  const rows = Object.entries(sectionStats).map(([id, s]) => {
    const rate    = s.totalTasks ? (s.totalDone / s.totalTasks) : 0;
    const pct     = Math.round(rate * 100);
    const secDef  = SECTIONS.find(sec => sec.id === id);
    const icon    = secDef ? secDef.icon : '✦';
    const iconCls = secDef ? secDef.iconClass : 'icon-optional';
    // Trend: compare last 3 weeks vs prior 3 weeks
    const recent  = weeksWithData.slice(0, 3).filter(e => e.sections && e.sections[id]);
    const older   = weeksWithData.slice(3, 6).filter(e => e.sections && e.sections[id]);
    let trend = '';
    if (recent.length >= 2 && older.length >= 1) {
      const rAvg = recent.reduce((a, e) => a + (e.sections[id].done / e.sections[id].total), 0) / recent.length;
      const oAvg = older.reduce((a, e) => a + (e.sections[id].done / e.sections[id].total), 0) / older.length;
      if (rAvg - oAvg > 0.15)       trend = '<span class="eff-trend up" title="Improving">↑</span>';
      else if (oAvg - rAvg > 0.15)  trend = '<span class="eff-trend down" title="Declining">↓</span>';
      else                           trend = '<span class="eff-trend flat" title="Steady">→</span>';
    }
    // Nudge for consistently skipped sections
    const skipNudge = (s.appearances >= 3 && pct < 25)
      ? '<div class="eff-nudge">Skipped most weeks. Consider hiding this section if it\'s not relevant.</div>' : '';
    return { id, title: s.title, icon, iconCls, pct, appearances: s.appearances, trend, skipNudge };
  }).sort((a, b) => b.pct - a.pct);

  if (weeksWithData.length === 0) {
    content.innerHTML = tabBar + '<div class="profile-empty" style="margin-top:1rem;">No section history yet.<br><span style="font-size:12px;color:var(--text-muted);">Efficiency scores build up over multiple weeks. Complete your first reset to start tracking.</span></div>';
    return;
  }

  const rowsHtml = rows.map(r => {
    const barColor = r.pct >= 80 ? 'var(--success-bright)'
      : r.pct >= 50 ? 'var(--void-glow)'
      : r.pct >= 25 ? 'var(--light-gold)'
      : 'var(--void-purple)';
    return '<div class="eff-row">'
      + '<div class="section-icon ' + r.iconCls + '" style="width:22px;height:22px;font-size:11px;flex-shrink:0;">' + r.icon + '</div>'
      + '<span class="summary-label" title="' + r.title + '">' + r.title + '</span>'
      + r.trend
      + '<div class="summary-bar-track">'
      + '<div class="summary-bar-fill" style="width:' + r.pct + '%;background:' + barColor + ';"></div>'
      + '</div>'
      + '<span class="eff-pct" style="color:' + barColor + ';">' + r.pct + '%</span>'
      + '<span class="eff-weeks">' + r.appearances + 'w</span>'
      + '</div>'
      + r.skipNudge;
  }).join('');

  content.innerHTML = tabBar
    + '<div class="summary-week">Based on ' + weeksWithData.length + ' week' + (weeksWithData.length !== 1 ? 's' : '') + ' of data for ' + currentChar + ' · Week of ' + weekLabel + '</div>'
    + '<div class="eff-legend"><span class="eff-trend up">↑</span> Improving &nbsp; <span class="eff-trend flat">→</span> Steady &nbsp; <span class="eff-trend down">↓</span> Declining</div>'
    + rowsHtml;
}


/* ── CROSS-ALT COMPLETION HEATMAP ── */
function renderHeatmapTab() {
  const content     = document.getElementById('summary-content');
  const currentWeek = getWeekKey();

  const tabBar = '<div class="summary-tabs">'
    + '<button class="summary-tab" onclick="renderSummaryTab(\'current\')">📊 ' + currentChar + '</button>'
    + '<button class="summary-tab" onclick="renderSummaryTab(\'alts\')">👥 All Alts</button>'
    + '<button class="summary-tab" onclick="renderEfficiencyTab()">📈 Efficiency</button>'
    + '<button class="summary-tab active" onclick="renderHeatmapTab()">🗺 Heatmap</button>'
    + '</div>';

  if (characters.length === 0) {
    content.innerHTML = tabBar + '<div class="profile-empty" style="margin-top:1rem;">No characters found.</div>';
    return;
  }

  // Build per-char data: history entries + live current week
  const charData = characters.map(c => {
    const history = loadHistory(c);
    const weekMap = {};
    history.forEach(e => { weekMap[e.week] = { done: e.done, total: e.total }; });

    // Live data for current week
    const done   = JSON.parse(localStorage.getItem('wow_mn_' + c + '_' + currentWeek) || '{}');
    const hidden = JSON.parse(localStorage.getItem('wow_mn_hidden_' + c) || '{}');
    const custom = JSON.parse(localStorage.getItem('wow_mn_custom_' + c) || '[]');
    let total = 0, completed = 0;
    SECTIONS.forEach(sec => {
      sec.tasks.filter(t => !hidden[t.id]).forEach(t => { total++; if (done[t.id]) completed++; });
    });
    custom.forEach(t => { total++; if (done['custom_' + t.id]) completed++; });
    if (total > 0) weekMap[currentWeek] = { done: completed, total };

    const group  = loadCharGroupFor(c);
    const cls    = localStorage.getItem('wow_mn_class_' + c) || '';
    const clsDef = cls ? CLASSES.find(x => x.id === cls) : null;
    return { name: c, weekMap, group, clsDef };
  });

  // Union of all weeks across all chars, newest first, max 10
  const weekSet = new Set();
  charData.forEach(c => Object.keys(c.weekMap).forEach(w => weekSet.add(w)));
  const weeks = [...weekSet].sort((a, b) => b.localeCompare(a)).slice(0, 10);

  if (weeks.length === 0) {
    content.innerHTML = tabBar + '<div class="profile-empty" style="margin-top:1rem;">No weekly data yet.<br><span style="font-size:12px;color:var(--text-muted);">Complete at least one reset to start seeing data here.</span></div>';
    return;
  }

  // Week label: 2-line "May<br>18"
  function fmtWeekLabel(w) {
    const d = new Date(w + 'T15:00:00Z');
    const mo  = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' });
    return mo + '<br>' + day;
  }
  function fmtWeekPlain(w) {
    const d = new Date(w + 'T15:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function cellBg(pct, hasData) {
    if (!hasData)    return 'var(--bg-deep)';
    if (pct === 100) return 'var(--success-bright)';
    if (pct >= 60)   return 'var(--void-glow)';
    if (pct >= 30)   return 'var(--light-gold)';
    if (pct > 0)     return '#7744aa';
    return 'var(--bg-panel)';
  }

  // Sort chars by group order
  const sorted = [...charData].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.group || '');
    const bi = GROUP_ORDER.indexOf(b.group || '');
    return ai - bi;
  });

  const headerCells = weeks.map(w => {
    const isCur = w === currentWeek;
    return '<div class="hm-week-label' + (isCur ? ' hm-cur' : '') + '" title="Week of ' + fmtWeekPlain(w) + (isCur ? ' (current)' : '') + '">' + fmtWeekLabel(w) + '</div>';
  }).join('');

  const rowsHtml = sorted.map(c => {
    const clsColor  = c.clsDef ? c.clsDef.color : 'var(--border-bright)';
    const groupDot  = GROUP_META[c.group] ? '<span style="color:' + GROUP_META[c.group].color + ';margin-right:3px;">' + GROUP_META[c.group].dot + '</span>' : '';
    const isActive  = c.name === currentChar;

    const cells = weeks.map(w => {
      const entry   = c.weekMap[w];
      const hasData = !!entry && entry.total > 0;
      const pct     = hasData ? Math.round((entry.done / entry.total) * 100) : 0;
      const bg      = cellBg(pct, hasData);
      const isCur   = w === currentWeek;
      const tooltip = hasData
        ? c.name + ' · ' + fmtWeekPlain(w) + ': ' + entry.done + '/' + entry.total + ' (' + pct + '%)'
        : c.name + ' · ' + fmtWeekPlain(w) + ': no data';
      const opacity = hasData ? '' : ';opacity:0.18';
      const label   = pct === 100 && hasData ? '✓' : (hasData && pct > 0 ? pct + '%' : '');
      return '<div class="hm-cell' + (isCur ? ' hm-cur' : '') + '" style="background:' + bg + opacity + ';" title="' + tooltip + '">' + label + '</div>';
    }).join('');

    return '<div class="hm-row' + (isActive ? ' hm-row-active' : '') + '">'
      + '<div class="hm-char" style="border-left:3px solid ' + clsColor + ';">' + groupDot + c.name + '</div>'
      + '<div class="hm-cells">' + cells + '</div>'
      + '</div>';
  }).join('');

  const completedCount  = sorted.filter(c => { const e = c.weekMap[currentWeek]; return e && e.done === e.total && e.total > 0; }).length;

  content.innerHTML = tabBar
    + '<div class="summary-week">Last ' + weeks.length + ' week' + (weeks.length !== 1 ? 's' : '') + ' · ' + completedCount + '/' + characters.length + ' fully done this week</div>'
    + '<div class="hm-table">'
    + '<div class="hm-header"><div class="hm-char hm-char-lbl">Character</div><div class="hm-cells">' + headerCells + '</div></div>'
    + rowsHtml
    + '</div>'
    + '<div class="hm-legend">'
    + '<span class="hm-swatch" style="background:var(--success-bright)"></span> 100%'
    + ' <span class="hm-swatch" style="background:var(--void-glow)"></span> 60–99%'
    + ' <span class="hm-swatch" style="background:var(--light-gold)"></span> 30–59%'
    + ' <span class="hm-swatch" style="background:#7744aa"></span> 1–29%'
    + ' <span class="hm-swatch" style="background:var(--bg-deep);opacity:0.18;"></span> No data'
    + '</div>';
}


/* ── BEGINNER PRESET ── */


/* ── INLINE EVENT DISPLAY ── */
function renderInlineEvent() {
  const el = document.getElementById('inline-event');
  if (!el) return;
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const parseD = s => new Date(s + 'T00:00:00Z');

  const active = EVENTS.filter(e => parseD(e.start) <= today && today < parseD(e.end));
  const upcoming = EVENTS
    .filter(e => parseD(e.start) > today)
    .sort((a,b) => parseD(a.start) - parseD(b.start))
    .slice(0, 1);

  let inner = '';
  if (active.length) {
    const names = active.map(e =>
      `<a href="${e.url}" target="_blank" class="inline-event-link">${e.name}</a>`
    ).join(', ');
    inner = `<span class="inline-event-badge live">LIVE</span>${names}`;
  } else if (upcoming.length) {
    const e = upcoming[0];
    const startDate = parseD(e.start);
    const daysUntil = Math.round((startDate - today) / 86400000);
    const daysStr = daysUntil === 1 ? 'tomorrow' : `in ${daysUntil}d`;
    inner = `<span class="inline-event-badge soon">SOON</span><a href="${e.url}" target="_blank" class="inline-event-link">${e.name}</a><span class="inline-event-when">${daysStr}</span>`;
  } else {
    inner = `<span class="inline-event-none">No upcoming events</span>`;
  }

  el.innerHTML = `${inner}<a href="events.html" class="inline-event-btn">📅 All Events</a>`;
}

/* ═══════════════════════════════════════════
   WELCOME WALKTHROUGH
   Shows once on first visit. Stored in
   localStorage under wow_mn_welcomed.
═══════════════════════════════════════════ */
const WELCOME_STEPS = [
  {
    icon: '⚜️',
    title: 'Welcome to The Azeroth Agenda',
    body: 'Your weekly reset tracker for World of Warcraft. Every character, every task, every boss, all in one place. Make every Tuesday count.',
    note: null,
  },
  {
    icon: '🔑',
    title: 'Choose Your Experience',
    body: 'Connect Battle.net for automatic syncing, or dive in offline and track manually.',
    note: null,
    interactive: 'bnet-choice',
  },
  {
    icon: '⬇️',
    title: 'Import Your Characters',
    body: 'Select the characters you want to track. All level 80+ characters on your account are listed below.',
    note: null,
    interactive: 'bnet-import',
  },
  {
    icon: '🧝',
    title: 'Add Your Characters',
    body: 'Each character tracks its own progress independently. Add your main to get started. You can add alts anytime from the character bar.',
    note: null,
    interactive: 'char-setup',
  },
  {
    icon: '📜',
    title: 'Build Your List',
    body: '<strong>Your List</strong> is your personal weekly checklist: only the tasks that matter to you. Pick a preset to get started instantly, or skip and build it yourself.',
    note: null,
    interactive: 'list-setup',
  },
  {
    icon: '🏆',
    title: 'Everything That\'s Tracked',
    body: '<ul class="welcome-feature-list">'
      + '<li><strong>Raids:</strong> per-boss bubble tracking across all four difficulties; boss kills auto-checked from Battle.net after each reset</li>'
      + '<li><strong>Mythic+:</strong> weekly run counter with Vault Preview showing reward tiers per key level; auto-filled from your API data</li>'
      + '<li><strong>Delves:</strong> tier selector and run counting toward the Great Vault</li>'
      + '<li><strong>⚔️ BiS Gear:</strong> all 40 specs covered; items auto-checked off when you equip them via armory sync</li>'
      + '<li><strong>Custom Tasks:</strong> add anything not in the default list</li>'
      + '<li><strong>📊 Summary · ⚡ Last Chance · 🔗 Share Plan:</strong> weekly history, focus mode, and shareable links</li>'
      + '</ul>',
    note: 'Everything resets automatically each Tuesday at 15:00 UTC.',
  },
  {
    icon: '🌟',
    title: "You're All Set!",
    body: 'Your progress saves automatically every time you check something off. Come back after each reset and work through your list.'
      + '<ul class="welcome-feature-list" style="margin-top:0.75rem;">'
      + '<li>Use <strong>🔑 Battle.net</strong> in the header to connect your account at any time</li>'
      + '<li>Once connected, hit <strong>🔄 Sync</strong> to pull your latest data from Blizzard</li>'
      + '<li>Check <strong>📅 Events</strong> and <strong>📋 Changelog</strong> in the header to stay up to date</li>'
      + '</ul>',
    note: 'Reopen this guide anytime from the ⇅ Data menu.',
  },
];

let _welcomeStep = 0;

function _welcomeIsLoggedIn() {
  const el = document.getElementById('auth-logout');
  return el && el.style.display !== 'none';
}

const _WELCOME_BNET_IMPORT_STEP = 2;
const _WELCOME_CHAR_STEP = 3;
const _WELCOME_LIST_STEP = 4;

const _BNET_CLASS_MAP = {
  'Death Knight': 'death-knight', 'Demon Hunter': 'demon-hunter',
  'Druid': 'druid',    'Evoker': 'evoker',    'Hunter': 'hunter',
  'Mage':  'mage',     'Monk':   'monk',       'Paladin': 'paladin',
  'Priest':'priest',   'Rogue':  'rogue',       'Shaman': 'shaman',
  'Warlock':'warlock', 'Warrior':'warrior',
};
const _BNET_FACTION_COLOR = { ALLIANCE: '#4a8cc4', HORDE: '#c44a4a' };
let _importChars = [];

function openWelcome() {
  // If the user just returned from Battle.net OAuth, restore the step they left from.
  // Do NOT remove the key here — initSync() removes it after auth is confirmed so that
  // a cloud-pull reload doesn't lose the step before auth has been checked.
  const savedStep = sessionStorage.getItem('azeroth_welcome_return_step');
  if (savedStep !== null) {
    _welcomeStep = parseInt(savedStep, 10) || 0;
  } else {
    _welcomeStep = 0;
  }
  renderWelcomeStep();
  document.getElementById('modal-welcome').classList.add('open');
}

function closeWelcome() {
  localStorage.setItem('wow_mn_welcomed', '1');
  sessionStorage.removeItem('azeroth_welcome_return_step');
  document.getElementById('modal-welcome').classList.remove('open');
  if (shouldShowWhatsNew()) openWhatsNew();
}

function loginWithBnet() {
  sessionStorage.setItem('azeroth_pending_import', '1');
  if (document.getElementById('modal-welcome')?.classList.contains('open')) {
    sessionStorage.setItem('azeroth_welcome_return_step', String(_welcomeStep));
  }
  // Visual feedback — redirect can take a moment to initiate
  const loginEl = document.getElementById('auth-login');
  if (loginEl) { loginEl.textContent = 'Connecting…'; loginEl.style.opacity = '0.55'; loginEl.style.pointerEvents = 'none'; }
  const welcomeBtn = document.querySelector('.welcome-bnet-login-btn');
  if (welcomeBtn) { welcomeBtn.textContent = 'Connecting…'; welcomeBtn.disabled = true; }
  window.location.href = '/auth/login?region=us';
}

function welcomeNext() {
  // Char-setup: require at least one non-default character before proceeding.
  if (_welcomeStep === _WELCOME_CHAR_STEP) {
    if (!characters.some(c => c !== 'Main')) return;
  }
  // bnet-import and char-setup both jump to list-setup (skipping the other path's step).
  if (_welcomeStep === _WELCOME_BNET_IMPORT_STEP || _welcomeStep === _WELCOME_CHAR_STEP) {
    _welcomeStep = _WELCOME_LIST_STEP;
    renderWelcomeStep();
    return;
  }
  if (_welcomeStep < WELCOME_STEPS.length - 1) { _welcomeStep++; renderWelcomeStep(); }
  else closeWelcome();
}

function welcomeBack() {
  // bnet-import and char-setup both go back to the bnet-choice step.
  if (_welcomeStep === _WELCOME_BNET_IMPORT_STEP || _welcomeStep === _WELCOME_CHAR_STEP) {
    _welcomeStep = 1;
    renderWelcomeStep();
    return;
  }
  // list-setup goes back to whichever path step the user came from.
  if (_welcomeStep === _WELCOME_LIST_STEP) {
    _welcomeStep = _welcomeIsLoggedIn() ? _WELCOME_BNET_IMPORT_STEP : _WELCOME_CHAR_STEP;
    renderWelcomeStep();
    return;
  }
  if (_welcomeStep > 0) { _welcomeStep--; renderWelcomeStep(); }
}

function renderWelcomeStep() {
  const step  = WELCOME_STEPS[_welcomeStep];
  const total = WELCOME_STEPS.length;
  const isLast = _welcomeStep === total - 1;

  // Dots
  document.getElementById('welcome-dots').innerHTML = WELCOME_STEPS.map((_, i) =>
    '<span class="welcome-dot' + (i === _welcomeStep ? ' active' : '') + '"></span>'
  ).join('');

  document.getElementById('welcome-icon').textContent  = step.icon;
  document.getElementById('welcome-title').textContent = step.title;
  document.getElementById('welcome-body').innerHTML    = step.body;

  const noteEl = document.getElementById('welcome-note');
  if (step.note) { noteEl.textContent = step.note; noteEl.style.display = ''; }
  else           { noteEl.style.display = 'none'; }

  // Interactive elements
  const interactEl = document.getElementById('welcome-interactive');
  if (step.interactive === 'bnet-choice') {
    interactEl.innerHTML =
      '<div class="welcome-bnet-cards">'
      + '<div class="welcome-bnet-card welcome-bnet-card--primary">'
      + '<div class="welcome-bnet-card-tag">Recommended</div>'
      + '<div class="welcome-bnet-card-title">Battle.net Connected</div>'
      + '<ul class="welcome-feature-list welcome-bnet-list">'
      + '<li>Import all level 80+ characters from your account</li>'
      + '<li>Gear, item level &amp; M+ rating sync from Blizzard</li>'
      + '<li>Raid boss kills auto-checked each reset</li>'
      + '<li>BiS items checked off when you equip them</li>'
      + '<li>Progress backed up to the cloud</li>'
      + '</ul>'
      + '<button class="welcome-bnet-login-btn" onclick="loginWithBnet()">Connect Battle.net →</button>'
      + '</div>'
      + '<div class="welcome-bnet-card">'
      + '<div class="welcome-bnet-card-tag" style="color:var(--text-muted);">No account needed</div>'
      + '<div class="welcome-bnet-card-title">Offline Mode</div>'
      + '<ul class="welcome-feature-list welcome-bnet-list">'
      + '<li>Add characters by name manually</li>'
      + '<li>Full task tracker: raids, M+, Delves</li>'
      + '<li>BiS gear browser for all 40 specs</li>'
      + '<li>Weekly history &amp; streaks</li>'
      + '<li>Saves locally in your browser</li>'
      + '</ul>'
      + '<button class="welcome-offline-btn" onclick="_welcomeChooseOffline()">Continue Offline →</button>'
      + '</div>'
      + '</div>';
  } else if (step.interactive === 'bnet-import') {
    interactEl.innerHTML = '<div style="text-align:center;padding:1.5rem 0;color:var(--text-muted);font-style:italic;">Loading characters from Battle.net…</div>';
    _importChars = [];
    fetch('/api/characters').then(async function(res) {
      if (res.status === 401) {
        interactEl.innerHTML = '<div style="color:var(--color-danger);padding:0.5rem 0;">Session expired. Please sign out and in again.</div>';
        return;
      }
      if (!res.ok) throw new Error();
      _importChars = (await res.json()).map(function(c) { return Object.assign({}, c, { selected: false }); });
      _renderWelcomeImportList(interactEl);
    }).catch(function() {
      interactEl.innerHTML = '<div style="color:var(--color-danger);padding:0.5rem 0;">Could not load characters. Check your connection and try again.</div>';
    });
  } else if (step.interactive === 'list-setup') {
    interactEl.innerHTML = '<div class="welcome-stage-list">'
      + BEGINNER_STAGES.map(s =>
          '<div class="beginner-stage-card" onclick="welcomeApplyStage(\'' + s.id + '\')">'
          + '<div class="beginner-stage-dot" style="background:' + s.color + ';"></div>'
          + '<div class="beginner-stage-text">'
          + '<div class="beginner-stage-label">' + s.label + '</div>'
          + '<div class="beginner-stage-sub">' + s.sublabel + '</div>'
          + '</div>'
          + '<span class="beginner-stage-arrow">→</span>'
          + '</div>'
        ).join('')
      + '</div>'
      + '<div class="welcome-stage-skip">or <button class="welcome-skip-inline" onclick="welcomeNext()">skip: I\'ll build it manually</button></div>';
  } else if (step.interactive === 'char-setup') {
    const hint = _welcomeIsLoggedIn()
      ? '<div class="welcome-import-hint">💡 After setup, use <strong>⬇ Import</strong> in the character bar to pull all your alts from Battle.net automatically.</div>'
      : '';
    interactEl.innerHTML =
      '<div class="welcome-char-form" id="welcome-char-form">'
      + '<div class="welcome-char-row">'
      + '<input id="welcome-char-input" type="text" class="welcome-char-input" placeholder="Character name…" maxlength="24"'
      + ' onkeydown="if(event.key===\'Enter\')welcomeAddChar()" />'
      + '<button class="btn-primary welcome-char-btn" onclick="welcomeAddChar()">Add</button>'
      + '</div>'
      + hint
      + '</div>';
    setTimeout(() => {
      const inp = document.getElementById('welcome-char-input');
      if (inp) inp.focus();
    }, 50);
  } else {
    interactEl.innerHTML = '';
  }

  const backBtn = document.getElementById('welcome-back');
  backBtn.style.visibility = _welcomeStep === 0 ? 'hidden' : '';

  const nextBtn = document.getElementById('welcome-next');
  const skipBtn = document.querySelector('#modal-welcome .welcome-skip');

  // bnet-choice: navigation is via the two card buttons — hide Next and Skip.
  if (_welcomeStep === 1) {
    nextBtn.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'none';
  } else {
    nextBtn.style.display = '';
    nextBtn.textContent = isLast ? "Let's Go!" : 'Next →';
    // Char-setup: Next is locked until the user has added at least one real character.
    nextBtn.disabled = (_welcomeStep === _WELCOME_CHAR_STEP && !characters.some(c => c !== 'Main'));
    // Skip is hidden on char-setup (must add a char) and bnet-import (Next serves as skip).
    if (skipBtn) {
      skipBtn.style.display = (_welcomeStep === _WELCOME_CHAR_STEP || _welcomeStep === _WELCOME_BNET_IMPORT_STEP) ? 'none' : '';
    }
  }
}

function welcomeAddChar() {
  const input = document.getElementById('welcome-char-input');
  if (!input) return;
  const name = input.value.trim();
  if (!name) { input.focus(); return; }

  if (!characters.includes(name)) {
    characters.push(name);
    localStorage.setItem('wow_midnight_chars', JSON.stringify(characters));
  }
  switchChar(name);
  renderChars();

  // Unlock the Next button now that a character exists.
  const nextBtn = document.getElementById('welcome-next');
  if (nextBtn) nextBtn.disabled = false;

  const form = document.getElementById('welcome-char-form');
  if (form) {
    form.innerHTML = '<div class="welcome-char-success">✓ <strong>' + name + '</strong> added. Let\'s keep going!</div>';
  }
  setTimeout(welcomeNext, 900);
}

function welcomeApplyStage(stageId) {
  applyBeginnerPreset(stageId); // saves list, switches to Your List tab
  const stage = BEGINNER_STAGES.find(s => s.id === stageId);
  const label = stage ? stage.label.split(': ')[0] : stageId;
  const interactEl = document.getElementById('welcome-interactive');
  if (interactEl) {
    interactEl.innerHTML = '<div class="welcome-char-success">✓ Your List set up for <strong>' + label + '</strong>!</div>';
  }
  setTimeout(welcomeNext, 900);
}

function _welcomeChooseOffline() {
  _welcomeStep = _WELCOME_CHAR_STEP;
  renderWelcomeStep();
}

function onSyncAuthConfirmed(user) {
  const welcomeEl = document.getElementById('modal-welcome');
  if (!welcomeEl?.classList.contains('open')) return;
  if (user && _welcomeStep === 1) {
    // User just authenticated — advance from bnet-choice to the import step.
    _welcomeStep = _WELCOME_BNET_IMPORT_STEP;
    // Persist so a cloud-pull reload reopens on bnet-import, not step 0.
    sessionStorage.setItem('azeroth_welcome_return_step', String(_WELCOME_BNET_IMPORT_STEP));
  }
  renderWelcomeStep();
}

function _renderWelcomeImportList(el) {
  if (!_importChars.length) {
    el.innerHTML = '<div style="color:var(--text-muted);padding:0.5rem 0;font-style:italic;">No level 80+ characters found on this account.</div>';
    return;
  }
  var rowBase = 'display:flex;align-items:center;gap:0.55rem;padding:0.4rem 0.5rem;border-bottom:1px solid var(--border);';
  var checkStyle = 'style="width:18px;height:18px;border:1.5px solid var(--border-bright);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:transparent;"';
  var html = '<div style="max-height:240px;overflow-y:auto;margin-bottom:0.75rem;">';
  _importChars.forEach(function(c, i) {
    var slug    = c.realmSlug || realmToSlug(c.realm || '');
    var already = isCharAlreadyAdded(c.name, slug);
    var classId = _BNET_CLASS_MAP[c.className] || '';
    var classDef = CLASSES.find(function(x) { return x.id === classId; });
    var iconHtml = classDef
      ? '<img src="' + classDef.icon + '" style="width:17px;height:17px;flex-shrink:0;image-rendering:auto;" title="' + c.className + '">'
      : '<span style="width:17px;height:17px;flex-shrink:0;display:inline-block;"></span>';
    var fc = _BNET_FACTION_COLOR[c.faction] || 'var(--text-secondary)';
    var nameSpan  = '<span style="flex:1;min-width:0;font-family:\'Cinzel\',serif;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + c.name + '</span>';
    var classSpan = '<span style="font-size:11px;color:var(--text-secondary);flex-shrink:0;white-space:nowrap;">' + (c.className || '') + '</span>';
    var realmSpan = '<span style="font-size:11px;color:' + fc + ';flex-shrink:0;white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;">' + (c.realm || '') + '</span>';
    if (already) {
      html += '<div style="' + rowBase + 'opacity:0.5;">'
        + '<div class="task-check" ' + checkStyle + '></div>'
        + iconHtml + nameSpan + classSpan + realmSpan
        + '</div>';
    } else {
      html += '<div class="import-row" id="import-row-' + i + '" onclick="toggleImportChar(' + i + ')" style="' + rowBase + 'cursor:pointer;">'
        + '<div class="task-check" ' + checkStyle + '></div>'
        + iconHtml + nameSpan + classSpan + realmSpan
        + '</div>';
    }
  });
  html += '</div>'
    + '<button class="btn-primary" style="width:100%;" onclick="_welcomeAddBnetChars()">✓ Add Selected Characters</button>';
  el.innerHTML = html;
}

function _welcomeAddBnetChars() {
  var added = 0;
  _importChars.forEach(function(c) {
    if (!c.selected) return;
    var slug = c.realmSlug || realmToSlug(c.realm || '');
    if (isCharAlreadyAdded(c.name, slug)) return;
    var id = charIdentifier(c.name, slug);
    characters.push(id);
    localStorage.setItem('wow_midnight_chars', JSON.stringify(characters));
    var classId = _BNET_CLASS_MAP[c.className] || '';
    if (classId) saveCharClass(id, classId);
    if (c.realm)     saveCharRealm(id, c.realm);
    if (c.realmSlug) saveCharRealmSlug(id, c.realmSlug);
    added++;
  });
  if (added > 0) {
    renderChars(); render();
    var interactEl = document.getElementById('welcome-interactive');
    if (interactEl) {
      interactEl.innerHTML = '<div class="welcome-char-success">✓ ' + added + ' character' + (added !== 1 ? 's' : '') + ' added. Syncing armory data in the background…</div>';
    }
    if (typeof autoSyncArmory === 'function') autoSyncArmory();
    setTimeout(welcomeNext, 1200);
  } else {
    welcomeNext();
  }
}

/* ── WHAT'S NEW ── */
const _WN_BADGE = { new: 'badge-new', fix: 'badge-fix', improve: 'badge-improve', content: 'badge-content', remove: 'badge-fix' };
const _WN_LABEL = { new: 'New', fix: 'Fix', improve: 'Improved', content: 'Content', remove: 'Removed' };

function shouldShowWhatsNew() {
  return localStorage.getItem('wow_mn_seen_version') !== VERSIONS[0].version;
}

function openWhatsNew() {
  const v = VERSIONS[0];
  const isReturning = !!localStorage.getItem('wow_mn_seen_version');

  document.getElementById('wn-icon').textContent = isReturning ? '🔮' : '🌙';
  document.getElementById('wn-title').textContent = isReturning
    ? 'Welcome back, ' + currentChar + '!'
    : "What's New";

  document.getElementById('wn-meta').innerHTML =
    '<span class="wn-version-tag">' + v.version + '</span>'
    + ' <span class="wn-version-dot">·</span> '
    + '<span class="wn-version-date">' + v.date + '</span>'
    + '<div class="wn-version-summary">' + v.summary + '</div>';

  document.getElementById('wn-entries').innerHTML = v.entries.map(e =>
    '<div class="cl-entry">'
    + '<span class="cl-badge ' + (_WN_BADGE[e.type] || 'badge-new') + '">' + (_WN_LABEL[e.type] || 'New') + '</span>'
    + '<div class="cl-text">' + e.text
    + (e.detail ? '<span>' + e.detail + '</span>' : '')
    + '</div></div>'
  ).join('');

  document.getElementById('modal-whats-new').classList.add('open');
}

function closeWhatsNew() {
  const cb = document.getElementById('wn-hide-version');
  if (cb && cb.checked) {
    localStorage.setItem('wow_mn_seen_version', VERSIONS[0].version);
  }
  if (cb) cb.checked = false;
  document.getElementById('modal-whats-new').classList.remove('open');
}

/* ── INIT ── */
renderChars(); renderClassLinksBar(); render(); renderInlineHistory(); renderInlineEvent(); updateCountdown(); setInterval(updateCountdown, 1000); _fetchResetTime();
updateLastChanceBtn(); renderLastChanceBanner();
renderEventAlerts();
function shouldShowWelcome() {
  // Always show if we're mid-welcome-flow (e.g. OAuth return that triggered a cloud reload).
  if (sessionStorage.getItem('azeroth_welcome_return_step')) return true;
  if (!localStorage.getItem('wow_mn_welcomed')) return true;
  const chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '["Main"]');
  if (chars.length === 1 && chars[0] === 'Main') {
    const yourList = JSON.parse(localStorage.getItem('wow_mn_yourlist_Main') || '[]');
    if (yourList.length === 0) return true;
  }
  return false;
}

if (shouldShowWelcome()) {
  openWelcome();
} else if (shouldShowWhatsNew()) {
  openWhatsNew();
}

// Sync toolbar button labels to persisted state
document.getElementById('btn-theme').textContent   = isLightMode ? '🌙 Dark'   : '☀️ Light';
document.getElementById('btn-compact').textContent  = isCompact   ? '⊞ Full'   : '⊟ Compact';
if (isCompact) {
  document.getElementById('btn-compact').style.color       = 'var(--void-glow)';
  document.getElementById('btn-compact').style.borderColor = 'var(--void-purple)';
}


/* ---- Modal overlay close listeners ---- */
document.addEventListener('DOMContentLoaded', function() {
  ['modal','modal-custom','modal-summary','modal-data','modal-profiles','modal-welcome','modal-bis','modal-bis-edit','modal-armory-region'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function(e) {
      if (e.target === el) el.classList.remove('open');
    });
  });
  var wnEl = document.getElementById('modal-whats-new');
  if (wnEl) wnEl.addEventListener('click', function(e) {
    if (e.target === wnEl) closeWhatsNew();
  });

  var impEl = document.getElementById('modal-import');
  if (impEl) impEl.addEventListener('click', function(e) {
    if (e.target === impEl) closeImportModal();
  });
});

/* ═══════════════════════════════════════════
   BATTLE.NET CHARACTER IMPORT
═══════════════════════════════════════════ */

function isCharAlreadyAdded(name, slug) {
  // Checks both the realm-aware identifier ("Name@realm-slug") and the legacy
  // plain-name form ("Name") so characters imported before the realm-aware
  // system was introduced are not offered for re-import.
  return characters.includes(charIdentifier(name, slug)) || characters.includes(name);
}

async function openImportChars() {
  const overlay    = document.getElementById('modal-import');
  const content    = document.getElementById('import-chars-content');
  const confirmBtn = document.getElementById('btn-confirm-import');
  overlay.classList.add('open');
  confirmBtn.style.display = 'none';
  content.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);font-style:italic;">Loading characters…</div>';

  try {
    const res = await fetch('/api/characters', { credentials: 'same-origin' });
    if (res.status === 401) {
      content.innerHTML = '<div style="color:var(--color-danger);padding:0.5rem 0;">Session expired — signing you back in…</div>';
      setTimeout(() => { window.location.href = '/auth/login?region=us'; }, 1800);
      return;
    }
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + (msg ? ': ' + msg : ''));
    }
    _importChars = (await res.json()).map(c => ({ ...c, selected: false }));
    renderImportList();
  } catch (err) {
    const detail = err && err.message ? ' (' + err.message + ')' : '';
    content.innerHTML = '<div style="color:var(--color-danger);padding:0.5rem 0;">'
      + 'Failed to load characters' + detail + '.'
      + ' <button class="btn-reset-all" style="margin-top:0.4rem;" onclick="openImportChars()">↺ Retry</button>'
      + '</div>';
  }
}

function renderImportList() {
  const content    = document.getElementById('import-chars-content');
  const confirmBtn = document.getElementById('btn-confirm-import');

  if (!_importChars.length) {
    content.innerHTML = '<div style="color:var(--text-muted);padding:0.5rem 0;font-style:italic;">No level 80+ characters found on this account.</div>';
    return;
  }

  let html = '<div style="max-height:360px;overflow-y:auto;">';
  _importChars.forEach((c, i) => {
    const slug     = c.realmSlug || realmToSlug(c.realm || '');
    const already  = isCharAlreadyAdded(c.name, slug);
    const classId  = _BNET_CLASS_MAP[c.className] || '';
    const classDef = CLASSES.find(x => x.id === classId);
    const iconHtml = classDef
      ? '<img src="' + classDef.icon + '" style="width:18px;height:18px;flex-shrink:0;image-rendering:auto;" title="' + c.className + '">'
      : '<span style="width:18px;height:18px;flex-shrink:0;display:inline-block;"></span>';
    const fc = _BNET_FACTION_COLOR[c.faction] || 'var(--text-secondary)';

    if (already) {
      html += '<div class="task done" style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.6rem;">'
        + '<div class="task-check"></div>'
        + iconHtml
        + '<span style="flex:1;font-family:\'Cinzel\',serif;font-size:13px;">' + c.name + '</span>'
        + '<span style="font-size:12px;color:var(--text-secondary);">' + c.className + '</span>'
        + '<span style="font-size:11px;color:' + fc + ';min-width:60px;text-align:right;">' + c.realm + '</span>'
        + '<span style="font-size:11px;color:var(--text-muted);min-width:36px;text-align:right;">Lv ' + c.level + '</span>'
        + '</div>';
    } else {
      html += '<div class="task import-row" id="import-row-' + i + '" onclick="toggleImportChar(' + i + ')" style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.6rem;cursor:pointer;">'
        + '<div class="task-check"></div>'
        + iconHtml
        + '<span style="flex:1;font-family:\'Cinzel\',serif;font-size:13px;">' + c.name + '</span>'
        + '<span style="font-size:12px;color:var(--text-secondary);">' + c.className + '</span>'
        + '<span style="font-size:11px;color:' + fc + ';min-width:60px;text-align:right;">' + c.realm + '</span>'
        + '<span style="font-size:11px;color:var(--text-muted);min-width:36px;text-align:right;">Lv ' + c.level + '</span>'
        + '</div>';
    }
  });
  html += '</div>';
  content.innerHTML = html;
  confirmBtn.style.display = '';
}

function toggleImportChar(i) {
  const c = _importChars[i];
  if (!c) return;
  c.selected = !c.selected;
  const row = document.getElementById('import-row-' + i);
  if (row) row.classList.toggle('selected', c.selected);
}

function confirmImport() {
  let added = 0;
  _importChars.forEach(c => {
    if (!c.selected) return;
    const slug = c.realmSlug || realmToSlug(c.realm || '');
    if (isCharAlreadyAdded(c.name, slug)) return;
    const id   = charIdentifier(c.name, slug);
    characters.push(id);
    localStorage.setItem('wow_midnight_chars', JSON.stringify(characters));
    const classId = _BNET_CLASS_MAP[c.className] || '';
    if (classId) saveCharClass(id, classId);
    if (c.realm)     saveCharRealm(id, c.realm);
    if (c.realmSlug) saveCharRealmSlug(id, c.realmSlug);
    added++;
  });
  closeImportModal();
  if (added > 0) {
    renderChars(); render();
    if (typeof autoSyncArmory === 'function') autoSyncArmory();
  }
}

function closeImportModal() {
  document.getElementById('modal-import').classList.remove('open');
}
