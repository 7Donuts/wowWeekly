/* -------------------------------------------
   ARMORY.JS — WoW character sync via Raider.IO
   Uses the free Raider.IO public API — no API
   keys, no OAuth, no setup required.
   https://raider.io/api
------------------------------------------- */

const _ARMORY_CLASS_MAP = {
  'Death Knight':  'death-knight',
  'Demon Hunter':  'demon-hunter',
  'Druid':         'druid',
  'Evoker':        'evoker',
  'Hunter':        'hunter',
  'Mage':          'mage',
  'Monk':          'monk',
  'Paladin':       'paladin',
  'Priest':        'priest',
  'Rogue':         'rogue',
  'Shaman':        'shaman',
  'Warlock':       'warlock',
  'Warrior':       'warrior',
};

/* ── SYNC ── */
async function armorySync(charName) {
  const realm = loadCharRealm(charName);
  if (!realm) {
    alert('Please set a realm for ' + charName + ' by clicking the ✏️ edit button.');
    return;
  }

  const creds  = loadBnetCreds() || {};
  const region = creds.region || 'us';

  const btn = document.querySelector('[data-armory-char="' + charName + '"]');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    const params = new URLSearchParams({
      region: region,
      realm:  realm,
      name:   charName,
      fields: 'gear,guild,mythic_plus_scores_by_season:current,mythic_plus_recent_runs',
    });

    const res  = await fetch('https://raider.io/api/v1/characters/profile?' + params);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Character not found. Check the name and realm spelling.');
    }

    // Filter recent runs to the current reset week
    const weekStart   = new Date(getWeekKey() + 'T15:00:00.000Z');
    const recentRuns  = data.mythic_plus_recent_runs || [];
    const thisWeekRuns = recentRuns.filter(r => r.completed_at && new Date(r.completed_at) >= weekStart);

    const armory = {
      className:   data.class                                           || '',
      spec:        data.active_spec_name                                || '',
      guild:       data.guild?.name                                     || '',
      ilvl:        data.gear?.item_level_equipped                       ?? 0,
      mythicScore: Math.round(data.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0),
      gearItems:   data.gear?.items                                     || {},
      weeklyRuns:  { week: getWeekKey(), runs: thisWeekRuns },
      lastSync:    new Date().toISOString(),
    };
    saveArmoryData(charName, armory);

    const autoChecked  = armoryAutoCheckBis(charName);
    const mpTracked    = armoryAutoTrackMythicPlus(charName);

    // Auto-apply class if none is set yet
    if (armory.className && !loadCharClass(charName)) {
      const classId = _ARMORY_CLASS_MAP[armory.className];
      if (classId) saveCharClass(charName, classId);
    }

    renderChars();
    renderClassLinksBar();
    render();
    const specClass   = [armory.spec, armory.className].filter(Boolean).join(' ');
    const bisMsg      = autoChecked > 0 ? ` · ✅ ${autoChecked} BiS item${autoChecked > 1 ? 's' : ''} checked` : '';
    const mpMsg       = mpTracked.total > 0 ? ` · 🗝 ${mpTracked.total} run${mpTracked.total > 1 ? 's' : ''} tracked` : '';
    showToast(charName + ' synced — ' + specClass + ' · iLvl ' + armory.ilvl + (armory.mythicScore ? ' · M+ ' + armory.mythicScore : '') + bisMsg + mpMsg);
  } catch (err) {
    if (btn) { btn.textContent = '🔄'; btn.disabled = false; }
    alert('Armory sync failed: ' + err.message);
  }
}

/* ── REGION SELECTOR ── */
function openArmoryRegionModal() {
  const creds = loadBnetCreds() || {};
  document.getElementById('armory-region-select').value = creds.region || 'us';
  document.getElementById('modal-armory-region').classList.add('open');
}

function closeArmoryRegionModal() {
  document.getElementById('modal-armory-region').classList.remove('open');
}

function saveArmoryRegion() {
  const region = document.getElementById('armory-region-select').value;
  saveBnetCreds({ region });
  closeArmoryRegionModal();
  showToast('Region set to ' + region.toUpperCase());
}

/* ── BIS AUTO-CHECK ── */

// Maps BiS slot display names (from task names like "[Head]") → Raider.IO gear item keys
const _BIS_SLOT_MAP = {
  'head':       'head',
  'neck':       'neck',
  'shoulder':   'shoulder',
  'shoulders':  'shoulder',
  'back':       'back',
  'chest':      'chest',
  'wrist':      'wrist',
  'wrists':     'wrist',
  'hands':      'hands',
  'waist':      'waist',
  'legs':       'legs',
  'feet':       'feet',
  'ring 1':     'finger1',
  'ring 2':     'finger2',
  'trinket 1':  'trinket1',
  'trinket 2':  'trinket2',
  'main hand':  'main_hand',
  'off hand':   'off_hand',
  'shield':     'off_hand',
};

function armoryAutoCheckBis(charName) {
  const armory = loadArmoryData(charName);
  if (!armory?.gearItems || !Object.keys(armory.gearItems).length) return 0;

  // Load YL and custom tasks for this character
  const yourList    = JSON.parse(localStorage.getItem('wow_mn_yourlist_' + charName) || '[]');
  const customTasks = JSON.parse(localStorage.getItem('wow_mn_custom_'   + charName) || '[]');
  if (!yourList.length || !customTasks.length) return 0;

  // Build id → task lookup
  const customMap = {};
  customTasks.forEach(t => { customMap[t.id] = t; });

  // Load this week's done state for the character
  const weekKey = getWeekKey();
  const doneKey = 'wow_mn_' + charName + '_' + weekKey;
  const done    = JSON.parse(localStorage.getItem(doneKey) || '{}');

  let autoChecked = 0;

  yourList.forEach(ylId => {
    // BiS items in YL are referenced as "custom_bis_…"
    if (!ylId.startsWith('custom_bis_')) return;

    const task = customMap[ylId.slice('custom_'.length)];
    if (!task) return;

    // Parse "[Slot] Item Name" from the task name
    const nameMatch = task.name.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (!nameMatch) return;

    const rioSlot     = _BIS_SLOT_MAP[nameMatch[1].toLowerCase().trim()];
    const bisItemName = nameMatch[2].trim();
    if (!rioSlot) return;

    const equipped = armory.gearItems[rioSlot];
    if (!equipped?.name) return;

    if (equipped.name.toLowerCase() === bisItemName.toLowerCase()) {
      if (!done[ylId]) {
        done[ylId] = true;
        autoChecked++;
      }
    }
  });

  if (autoChecked > 0) {
    localStorage.setItem(doneKey, JSON.stringify(done));
  }

  return autoChecked;
}

/* ── MYTHIC+ AUTO-TRACK ── */

function armoryAutoTrackMythicPlus(charName) {
  const armory = loadArmoryData(charName);
  const weeklyData = armory?.weeklyRuns;
  if (!weeklyData || !weeklyData.runs) return { total: 0, highKeys: 0 };

  // Only count runs from the current reset week
  if (weeklyData.week !== getWeekKey()) return { total: 0, highKeys: 0 };

  const runs     = weeklyData.runs;
  const total    = runs.length;                                    // all runs this week
  const highKeys = runs.filter(r => r.mythic_level >= 10).length; // 10+ runs only

  const goalsKey = 'wow_mn_goals_' + charName + '_' + getWeekKey();
  const doneKey  = 'wow_mn_'       + charName + '_' + getWeekKey();
  const goals    = JSON.parse(localStorage.getItem(goalsKey) || '{}');
  const done     = JSON.parse(localStorage.getItem(doneKey)  || '{}');

  // m1: vault run counter — capped at 8
  const m1Val = Math.min(total, 8);
  goals['m1'] = m1Val;
  if (m1Val >= 8) { done['m1'] = true; }
  else            { delete done['m1']; }

  // m4: 10+ key counter — uncapped, never auto-check (user decides when done)
  goals['m4'] = highKeys;

  localStorage.setItem(goalsKey, JSON.stringify(goals));
  localStorage.setItem(doneKey,  JSON.stringify(done));

  return { total, highKeys };
}

/* ── TOAST HELPER ── */
function showToast(msg) {
  const t = document.getElementById('share-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}
