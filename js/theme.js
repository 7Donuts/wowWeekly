/* -------------------------------------------
   THEME & COMPACT: shared across all pages
   Reads persisted preference on load and
   applies the right body class immediately,
   so there's no flash of wrong theme.
   Both toggles are icon-only buttons: the
   glyph shows the mode you switch INTO, the
   title says it in words.
   Exports: isLightMode, isCompact,
            toggleTheme(), toggleCompact(),
            updateThemeBtn(), updateCompactBtn()
------------------------------------------- */
let isLightMode = localStorage.getItem('wow_mn_theme') === 'light';
let isCompact   = localStorage.getItem('wow_mn_compact') === 'true';

if (isLightMode) document.body.classList.add('light-mode');
if (isCompact)   document.body.classList.add('compact-mode');

function updateThemeBtn() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  btn.innerHTML = '<i class="ph ' + (isLightMode ? 'ph-moon' : 'ph-sun') + '"></i>';
  btn.title = isLightMode ? 'Switch to dark mode' : 'Switch to light mode';
}

function updateCompactBtn() {
  const btn = document.getElementById('btn-compact');
  if (!btn) return;
  btn.innerHTML = '<i class="ph ' + (isCompact ? 'ph-squares-four' : 'ph-rows') + '"></i>';
  btn.title = isCompact ? 'Switch to full rows' : 'Switch to compact rows';
}

function toggleTheme() {
  isLightMode = !isLightMode;
  document.body.classList.toggle('light-mode', isLightMode);
  localStorage.setItem('wow_mn_theme', isLightMode ? 'light' : 'dark');
  updateThemeBtn();
  // The roster and class bar bake theme-dependent colours into their markup.
  if (typeof renderChars === 'function') renderChars();
  if (typeof renderClassLinksBar === 'function') renderClassLinksBar();
}

function toggleCompact() {
  isCompact = !isCompact;
  document.body.classList.toggle('compact-mode', isCompact);
  localStorage.setItem('wow_mn_compact', isCompact);
  updateCompactBtn();
}
