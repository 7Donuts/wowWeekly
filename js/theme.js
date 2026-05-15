/* -------------------------------------------
   THEME & COMPACT — shared across all pages
   Reads persisted preference on load and
   applies the right body class immediately,
   so there's no flash of wrong theme.
   Exports: isLightMode, isCompact,
            toggleTheme(), toggleCompact()
------------------------------------------- */
let isLightMode = localStorage.getItem('wow_mn_theme') === 'light';
let isCompact   = localStorage.getItem('wow_mn_compact') === 'true';

if (isLightMode) document.body.classList.add('light-mode');
if (isCompact)   document.body.classList.add('compact-mode');

function toggleTheme() {
  isLightMode = !isLightMode;
  document.body.classList.toggle('light-mode', isLightMode);
  localStorage.setItem('wow_mn_theme', isLightMode ? 'light' : 'dark');
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = isLightMode ? '🌙 Dark' : '☀️ Light';
}

function toggleCompact() {
  isCompact = !isCompact;
  document.body.classList.toggle('compact-mode', isCompact);
  localStorage.setItem('wow_mn_compact', isCompact);
  const btn = document.getElementById('btn-compact');
  if (btn) {
    btn.textContent       = isCompact ? '⊞ Full' : '⊟ Compact';
    btn.style.color       = isCompact ? 'var(--void-glow)' : '';
    btn.style.borderColor = isCompact ? 'var(--void-purple)' : '';
  }
}
