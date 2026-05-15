/* ═══════════════════════════════════════════
   CONFETTI ENGINE
   Self-contained particle system using the
   <canvas id="confetti-canvas"> element.
   API: _confetti.burst(x, y, count, big)
        _confetti.celebrate()
   Requires: confetti-canvas element in DOM.
═══════════════════════════════════════════ */
═══════════════════════════════════════════ */
const _confetti = (() => {
  const canvas  = document.getElementById('confetti-canvas');
  const ctx     = canvas.getContext('2d');
  let particles = [];
  let raf       = null;
  let W, H;

  // WoW Midnight palette — void purples, golds, pale whites
  const COLORS = [
    '#a07de0','#7c5cbf','#c9a84c','#e8d9a0',
    '#6abf80','#e07068','#b090e0','#ffffff',
    '#d4af37','#c084fc',
  ];

  const SHAPES = ['circle','square','ribbon'];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function randomBetween(a, b) { return a + Math.random() * (b - a); }

  function makeParticle(x, y, big) {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return {
      x, y,
      vx: randomBetween(-6, 6) * (big ? 1.4 : 1),
      vy: randomBetween(-14, -6) * (big ? 1.5 : 1),
      ax: 0,
      ay: randomBetween(0.3, 0.55),
      r:  randomBetween(big ? 5 : 3, big ? 11 : 7),
      rot: randomBetween(0, Math.PI * 2),
      rotV: randomBetween(-0.2, 0.2),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      shape,
      wobble: randomBetween(0, Math.PI * 2),
      wobbleV: randomBetween(0.05, 0.15),
      life: big ? 220 : 140,
      age: 0,
    };
  }

  function drawParticle(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'square') {
      ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
    } else {
      // ribbon — thin rectangle with wobble-based skew
      ctx.fillRect(-p.r * 0.4, -p.r * 1.5, p.r * 0.8, p.r * 3);
    }
    ctx.restore();
  }

  function step() {
    ctx.clearRect(0, 0, W, H);
    particles = particles.filter(p => p.age < p.life && p.y < H + 40);

    particles.forEach(p => {
      p.age++;
      p.wobble += p.wobbleV;
      p.vx += p.ax + Math.sin(p.wobble) * 0.15;
      p.vy += p.ay;
      p.vx *= 0.99;
      p.x  += p.vx;
      p.y  += p.vy;
      p.rot += p.rotV;
      // Fade in last 40% of life
      const fadeStart = p.life * 0.6;
      if (p.age > fadeStart) {
        p.alpha = 1 - (p.age - fadeStart) / (p.life - fadeStart);
      }
      drawParticle(p);
    });

    if (particles.length > 0) {
      raf = requestAnimationFrame(step);
    } else {
      raf = null;
    }
  }

  function burst(x, y, count, big) {
    for (let i = 0; i < count; i++) particles.push(makeParticle(x, y, big));
    if (!raf) raf = requestAnimationFrame(step);
  }

  function celebrate() {
    // Full-screen celebration — fire from multiple points
    const points = [
      [W * 0.2, H * 0.4], [W * 0.5, H * 0.35],
      [W * 0.8, H * 0.4], [W * 0.35, H * 0.5],
      [W * 0.65, H * 0.5],
    ];
    points.forEach(([x, y], i) => {
      setTimeout(() => burst(x, y, 55, true), i * 120);
    });
  }

  return { burst, celebrate };
})();

// Get click position from a task element for the burst origin
function _getTaskPos(taskEl) {
  if (!taskEl) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const rect = taskEl.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Check if all visible tasks are done after a toggle
function _checkCompletion() {
  const done   = loadDone();
  const hidden = loadHidden();
  let total = 0, completed = 0;
  SECTIONS.forEach(sec => {
    sec.tasks.filter(t => !hidden[t.id]).forEach(t => {
      total++;
      if (done[t.id]) completed++;
    });
  });
  loadCustomTasks().forEach(t => {
    total++;
    if (done['custom_' + t.id]) completed++;
  });
  return total > 0 && completed === total;
}
