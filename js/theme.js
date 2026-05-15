/* ═══════════════════════════════════════════
   THEME & UI STATE
   Persisted UI preferences shared across pages.
   Depends on: no external deps (pure DOM + localStorage)
   Exports: isLightMode, isCompact, yourListGrouped,
            searchQuery, toggleTheme(), toggleCompact(),
            toggleYourListView(), onSearchInput(),
            clearSearch()
═══════════════════════════════════════════ */
let revealHidden    = false;
let editingYourList = false;
let isCompact       = localStorage.getItem('wow_mn_compact') === 'true';
let isLightMode     = localStorage.getItem('wow_mn_theme') === 'light';
let yourListGrouped = localStorage.getItem('wow_mn_yl_grouped') !== 'false'; // default grouped
let searchQuery     = '';

function onSearchInput(val) {
  searchQuery = val.trim().toLowerCase();
  document.getElementById('search-clear-btn').style.display = searchQuery ? '' : 'none';
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

if (isCompact)   document.body.classList.add('compact-mode');
if (isLightMode) { document.body.classList.add('light-mode'); }


function toggleTheme() {
  isLightMode = !isLightMode;
  document.body.classList.toggle('light-mode', isLightMode);
  localStorage.setItem('wow_mn_theme', isLightMode ? 'light' : 'dark');
  const btn = document.getElementById('btn-theme');
  btn.textContent = isLightMode ? '🌙 Dark' : '☀️ Light';
}

/* ═══════════════════════════════════════════
   COMPACT MODE
═══════════════════════════════════════════ */
function toggleCompact() {
  isCompact = !isCompact;
  document.body.classList.toggle('compact-mode', isCompact);
  localStorage.setItem('wow_mn_compact', isCompact);
  const btn = document.getElementById('btn-compact');
  btn.textContent = isCompact ? '⊞ Full' : '⊟ Compact';
  btn.style.color       = isCompact ? 'var(--void-glow)' : '';
  btn.style.borderColor = isCompact ? 'var(--void-purple)' : '';
}

function toggleYourListView() {
  yourListGrouped = !yourListGrouped;
  localStorage.setItem('wow_mn_yl_grouped', yourListGrouped);
  render();
}

