(() => {
  const body = document.body;
  const menuButton = document.getElementById('characterSelect');
  const menu = document.getElementById('characterMenu');
  const search = document.getElementById('questSearch');
  const toast = document.getElementById('toast');
  let toastTimer;

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  };

  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menu.hidden = open;
  });

  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) {
      menu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== search) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === 'Escape') {
      search.value = '';
      search.dispatchEvent(new Event('input'));
      search.blur();
      menu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });

  document.querySelectorAll('.collapse-button').forEach((button) => {
    button.addEventListener('click', () => {
      const list = button.closest('.quest-group').querySelector('.quest-list');
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      button.setAttribute('aria-label', `${expanded ? 'Expand' : 'Collapse'} ${button.closest('.quest-group').querySelector('h3').textContent}`);
      button.querySelector('i').className = `ph ph-caret-${expanded ? 'down' : 'up'}`;
      list.hidden = expanded;
    });
  });

  const updateProgress = () => {
    const rows = [...document.querySelectorAll('.quest-row')];
    const checked = rows.filter((row) => row.querySelector('input').checked).length;
    const total = 26;
    const baseComplete = 12;
    const complete = baseComplete + checked;
    const open = total - complete;
    const percent = Math.round((complete / total) * 100);
    document.getElementById('completeCount').textContent = complete;
    document.getElementById('openTaskCount').textContent = open;
    document.getElementById('legendOpenCount').textContent = open;
    document.getElementById('progressPercent').textContent = `${percent}%`;
    document.getElementById('progressRing').style.setProperty('--progress', percent);
  };

  document.querySelectorAll('.quest-row input').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const row = checkbox.closest('.quest-row');
      row.classList.toggle('is-complete', checkbox.checked);
      updateProgress();
      showToast(checkbox.checked ? 'Objective complete' : 'Objective restored');
    });
  });

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.quest-group').forEach((group) => {
      let groupMatches = 0;
      group.querySelectorAll('.quest-row').forEach((row) => {
        const matches = !query || row.dataset.title.toLowerCase().includes(query) || row.textContent.toLowerCase().includes(query);
        row.hidden = !matches;
        if (matches) groupMatches += 1;
      });
      group.hidden = groupMatches === 0;
      if (query && groupMatches) {
        group.querySelector('.quest-list').hidden = false;
        group.querySelector('.collapse-button').setAttribute('aria-expanded', 'true');
        group.querySelector('.collapse-button i').className = 'ph ph-caret-up';
      }
      visible += groupMatches;
    });
    document.getElementById('noResults').hidden = visible !== 0;
  });

  document.getElementById('focusToggle').addEventListener('click', (event) => {
    const active = body.classList.toggle('focus-mode');
    event.currentTarget.setAttribute('aria-pressed', String(active));
    showToast(active ? 'Focus mode: unfinished objectives only' : 'All objectives visible');
  });

  document.querySelectorAll('.view-controls button').forEach((button, index, buttons) => {
    button.addEventListener('click', () => {
      buttons.forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      body.classList.toggle('compact-mode', index === 1);
    });
  });

  document.querySelectorAll('.realm-nav__item[href]').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.realm-nav__item').forEach((navItem) => navItem.classList.remove('is-active'));
      item.classList.add('is-active');
    });
  });

  document.querySelectorAll('.character-option:not(.add-character)').forEach((option) => {
    option.addEventListener('click', () => {
      const name = option.querySelector('strong').textContent;
      document.querySelector('.character-select__copy strong').childNodes[0].nodeValue = `${name} `;
      menu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      showToast(`Now tracking ${name}`);
    });
  });

  document.getElementById('beginQuest').addEventListener('click', () => showToast('Quest pinned to your focus route'));
  document.getElementById('mobileNext').addEventListener('click', () => document.getElementById('beginQuest').click());
  document.querySelectorAll('.quick-grid button').forEach((button) => button.addEventListener('click', () => showToast(`${button.querySelector('strong').textContent} opened`)));

  updateProgress();
})();
