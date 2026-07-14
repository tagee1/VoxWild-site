/* VoxWild — progressive visual enhancements (scroll reveal + cost chart).
   Dependency-free. Degrades gracefully with no JS or reduced motion. */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ── Scroll reveal ──────────────────────────────────────────────────── */
  const SELECTORS = [
    '.section-head', '.clip', '.engine', '.buy-strip > div',
    '.compare-wrap', '.manifesto', '.faq-item', '.tech-list',
    '.tech-specs', '.wedge-text'
  ].join(', ');

  root.classList.add('js-reveal');
  const els = Array.from(document.querySelectorAll(SELECTORS));

  els.forEach(el => {
    el.classList.add('reveal');
    // Stagger siblings that reveal together (e.g. clip cards, buy tiles).
    const sibs = el.parentElement
      ? Array.from(el.parentElement.children).filter(c => c === el || SELECTORS_matches(c))
      : [el];
    const idx = sibs.indexOf(el);
    if (idx > 0) el.style.transitionDelay = Math.min(idx * 60, 360) + 'ms';
  });

  function SELECTORS_matches(node) {
    return node.nodeType === 1 && node.matches && node.matches(SELECTORS);
  }

  const show = el => el.classList.add('in');
  if (reduce || !hasIO) {
    els.forEach(show);
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) { show(e.target); obs.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(el => io.observe(el));
  }

  /* ── Cost chart: grow bars + count values when scrolled into view ───── */
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function paintFinal(chart) {
    chart.classList.add('in');
    chart.querySelectorAll('[data-count]').forEach(v => {
      const target = parseFloat(v.dataset.count) || 0;
      v.textContent = (v.dataset.prefix || '') + target.toLocaleString();
    });
  }

  function animateChart(chart) {
    chart.classList.add('in'); // triggers the CSS bar-width transition
    const vals = Array.from(chart.querySelectorAll('[data-count]'));
    if (!vals.length) return;
    const dur = 1250;
    let start = null;
    function step(now) {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / dur);
      const e = easeOut(p);
      vals.forEach(v => {
        const target = parseFloat(v.dataset.count) || 0;
        const n = Math.round(target * e);
        v.textContent = (v.dataset.prefix || '') + n.toLocaleString();
      });
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  document.querySelectorAll('.costchart').forEach(chart => {
    if (reduce || !hasIO) { paintFinal(chart); return; }
    // JS is driving: start values at 0 so they count up (no 792→0 flash).
    chart.querySelectorAll('[data-count]').forEach(v => {
      v.textContent = (v.dataset.prefix || '') + '0';
    });
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) { animateChart(chart); obs.unobserve(chart); }
      });
    }, { threshold: 0.3 });
    io.observe(chart);
  });
})();
