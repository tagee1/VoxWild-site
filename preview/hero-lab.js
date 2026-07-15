/* hero-lab.js — hero concept animations + real click-to-play.
   One clip plays at a time; visuals react to the actual audio via a Web-Audio
   analyser, with a currentTime fallback if Web Audio is unavailable. Respects
   reduced motion. No-ops for any hero not present on the page. */
(() => {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const baseOf = el => { const n = el.closest('[data-audiobase]'); return (n && n.dataset.audiobase) || 'audio/'; };

  // ── shared audio core ───────────────────────────────────────────────────
  let sharedCtx = null, activePlayer = null;
  function getCtx() {
    if (!sharedCtx) { const AC = window.AudioContext || window.webkitAudioContext; sharedCtx = AC ? new AC() : null; }
    return sharedCtx;
  }
  function createPlayer(base, opts) {
    const audio = new Audio();
    audio.preload = 'none';
    let analyser = null, srcNode = null, freq = null, raf = 0, wired = false;
    function wire() {
      const ctx = getCtx();
      if (!ctx || wired) return;
      wired = true;
      try {
        srcNode = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        freq = new Uint8Array(analyser.frequencyBinCount);
        srcNode.connect(analyser);
        analyser.connect(ctx.destination);
      } catch (e) {
        analyser = null;
        try { if (srcNode) srcNode.connect(ctx.destination); } catch (_) {}
      }
    }
    function loop() {
      if (analyser) { analyser.getByteFrequencyData(freq); opts.onFrame(freq, audio); }
      else opts.onFrame(null, audio);
      raf = requestAnimationFrame(loop);
    }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    async function toggle() {
      if (activePlayer && activePlayer !== api) activePlayer.stop();
      if (!audio.paused) { audio.pause(); return; }
      const ctx = getCtx();
      if (ctx && ctx.state === 'suspended') { try { await ctx.resume(); } catch (_) {} }
      wire();
      const want = base + opts.clipFor();
      if (audio.getAttribute('src') !== want) audio.src = want;
      activePlayer = api;
      if (opts.onStart) opts.onStart();
      try { await audio.play(); } catch (e) { if (opts.onStop) opts.onStop(false); return; }
      halt(); loop();
    }
    audio.addEventListener('ended', () => { halt(); if (opts.onStop) opts.onStop(true); });
    audio.addEventListener('pause', () => { halt(); if (opts.onStop) opts.onStop(false); });
    const api = { audio, toggle, stop: () => { if (!audio.paused) audio.pause(); } };
    return api;
  }

  // ── HERO #1 — type-to-voice panel ───────────────────────────────────────
  (function () {
    const demo = document.querySelector('.tts-demo');
    if (!demo) return;
    const typed = demo.querySelector('.tts-typed'), caret = demo.querySelector('.tts-caret'),
          wave = demo.querySelector('.tts-wave'), statusEl = demo.querySelector('.tts-status'),
          timeEl = demo.querySelector('.tts-time'), voiceEl = demo.querySelector('.tts-voice'),
          genBtn = demo.querySelector('.tts-generate'), barFill = demo.querySelector('.tts-bar-fill');
    const LINES = [
      { voice: '🇺🇸 Female - Heart (Best)', text: 'First take, every time.', clip: 'hero-heart.mp3' },
      { voice: '🇬🇧 Male - George (Best)',  text: 'I live on your laptop. No monthly fees.', clip: 'hero-george.mp3' },
      { voice: '🇺🇸 Male - Michael',        text: 'Paste your script, pick a voice, and hit export.', clip: 'hero-michael.mp3' },
    ];
    const N = 42;
    const hash = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const mul = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let bars = [];
    function build(seed) {
      wave.innerHTML = ''; bars = [];
      const r = mul(hash(seed));
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1), env = 0.4 + 0.5 * Math.sin(Math.PI * t);
        let h = env * 0.6 + (0.5 * r() + 0.3 * Math.sin(t * 20 + r() * 6)) * 0.55;
        h = Math.max(0.14, Math.min(1, h));
        const b = document.createElement('i'); b.style.setProperty('--wh', Math.round(h * 100) + '%');
        wave.appendChild(b); bars.push(b);
      }
    }
    let idx = 0, advTimer = 0, playing = false;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function showLine(i) {
      const line = LINES[i];
      voiceEl.textContent = line.voice; build(line.text + i);
      typed.textContent = ''; barFill.style.width = '0%'; statusEl.textContent = 'Ready — press ▸'; timeEl.textContent = '0:00';
      caret.style.display = 'inline-block';
      if (reduce) { typed.textContent = line.text; caret.style.display = 'none'; return; }
      for (let c = 0; c < line.text.length && !playing; c++) { typed.textContent += line.text[c]; await sleep(line.text[c] === ' ' ? 22 : 32); }
    }
    function scheduleAdvance() {
      clearTimeout(advTimer);
      if (reduce) return;
      advTimer = setTimeout(async () => { if (playing) return; idx = (idx + 1) % LINES.length; await showLine(idx); scheduleAdvance(); }, 4200);
    }
    const player = createPlayer(baseOf(demo), {
      clipFor: () => LINES[idx].clip,
      onStart: () => { playing = true; clearTimeout(advTimer); statusEl.textContent = '▶ Playing'; genBtn.classList.add('pulse'); caret.style.display = 'none'; },
      onStop: (ended) => {
        playing = false; genBtn.classList.remove('pulse');
        bars.forEach(b => { b.classList.remove('on'); b.style.height = ''; });
        barFill.style.width = '0%'; timeEl.textContent = '0:00';
        statusEl.textContent = ended ? '✓ Done' : 'Ready — press ▸';
        if (ended) { idx = (idx + 1) % LINES.length; showLine(idx).then(scheduleAdvance); } else scheduleAdvance();
      },
      onFrame: (freq, audio) => {
        if (freq) {
          const usable = Math.floor(freq.length * 0.66);
          for (let i = 0; i < bars.length; i++) { const bin = Math.floor(i / bars.length * usable); const lv = Math.max(0.08, freq[bin] / 255); bars[i].style.height = (lv * 100) + '%'; bars[i].classList.add('on'); }
        } else if (audio.duration) {
          const u = Math.floor(audio.currentTime / audio.duration * bars.length);
          for (let i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i <= u);
        }
        if (audio.duration) { barFill.style.width = (audio.currentTime / audio.duration * 100) + '%'; timeEl.textContent = fmt(audio.currentTime); }
      }
    });
    genBtn.style.cursor = 'pointer';
    genBtn.addEventListener('click', () => player.toggle());
    showLine(0).then(scheduleAdvance);
  })();

  // ── HERO #3 — radial voiceprint orb ─────────────────────────────────────
  (function () {
    const orb = document.querySelector('.orb');
    if (!orb) return;
    const ibars = Array.from(orb.querySelectorAll('.orb-ring i'));
    const cap = orb.querySelector('.orb-cap');
    const idle = '<span class="on">●</span> af_heart · tap to hear';
    const player = createPlayer(baseOf(orb), {
      clipFor: () => 'hero-heart.mp3',
      onStart: () => { orb.classList.add('reacting'); if (cap) cap.innerHTML = '<span class="on">●</span> af_heart · playing'; },
      onStop: () => { orb.classList.remove('reacting'); ibars.forEach(b => { b.style.transform = ''; }); if (cap) cap.innerHTML = idle; },
      onFrame: (freq) => {
        if (!freq) return;
        const usable = Math.floor(freq.length * 0.7);
        for (let i = 0; i < ibars.length; i++) { const bin = Math.floor(i / ibars.length * usable); const lv = 0.4 + 1.5 * (freq[bin] / 255); ibars[i].style.transform = 'rotate(var(--rot)) translateY(var(--R)) scaleY(' + lv.toFixed(3) + ')'; }
      }
    });
    orb.style.cursor = 'pointer';
    orb.addEventListener('click', () => player.toggle());
    if (cap) cap.innerHTML = idle;
  })();

  // ── HERO #4 — desktop app window ────────────────────────────────────────
  (function () {
    const win = document.querySelector('.appwin');
    if (!win) return;
    const fill = win.querySelector('.appwin-progress-fill'), gen = win.querySelector('.aw-primary'),
          play = win.querySelector('.aw-play'), cardTime = win.querySelector('.aw-card-time');
    const player = createPlayer(baseOf(win), {
      clipFor: () => 'hero-heart.mp3',
      onStart: () => { win.classList.add('playing'); if (play) play.textContent = '❚❚ Pause'; },
      onStop: () => { win.classList.remove('playing'); if (play) play.textContent = '▶ Play'; if (fill) fill.style.width = ''; if (cardTime) cardTime.textContent = '0:03'; },
      onFrame: (freq, audio) => { if (audio.duration) { if (fill) fill.style.width = (audio.currentTime / audio.duration * 100) + '%'; if (cardTime) cardTime.textContent = fmt(audio.currentTime); } }
    });
    [gen, play].forEach(b => { if (b) { b.style.cursor = 'pointer'; b.addEventListener('click', () => player.toggle()); } });
  })();

  // ── HERO #2 — full-bleed living waveform ────────────────────────────────
  (function () {
    const stage = document.querySelector('.wavehero');
    if (!stage) return;
    const canvas = stage.querySelector('.wavehero-canvas'), btn = stage.querySelector('.wavehero-play');
    const c = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, phase = 0, level = 0, target = 0, raf = 0;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function wave(mid, ampScale, freqK, ph, alpha, lw) {
      c.beginPath();
      for (let x = 0; x <= W; x += 5) {
        const t = x / W;
        const taper = Math.sin(t * Math.PI);
        const base = 0.5 * Math.sin(t * freqK + ph) + 0.32 * Math.sin(t * freqK * 2.3 - ph * 1.4) + 0.18 * Math.sin(t * freqK * 4.1 + ph * 0.7);
        const y = mid + base * (H * 0.16) * ampScale * taper * (0.5 + level);
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = 'rgba(0, 217, 139, ' + alpha + ')';
      c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round';
      c.shadowColor = 'rgba(0,217,139,0.6)'; c.shadowBlur = 10;
      c.stroke(); c.shadowBlur = 0;
    }
    function draw() {
      c.clearRect(0, 0, W, H);
      const mid = H * 0.52;
      level += (target - level) * 0.08;
      wave(mid, 1.0, 7.5, phase, 0.85, 2.2);
      wave(mid, 0.6, 5.0, -phase * 0.8 + 1.1, 0.4, 1.4);
      wave(mid, 0.35, 9.5, phase * 1.3 + 2.0, 0.22, 1);
      phase += 0.015 + level * 0.03;
      raf = requestAnimationFrame(draw);
    }
    const player = createPlayer(baseOf(stage), {
      clipFor: () => 'hero-heart.mp3',
      onStart: () => { stage.classList.add('playing'); if (btn) btn.innerHTML = '❚❚&nbsp;&nbsp;Playing'; },
      onStop: () => { stage.classList.remove('playing'); target = 0; if (btn) btn.innerHTML = '▶&nbsp;&nbsp;Hear a voice'; },
      onFrame: (freq) => { if (freq) { let s = 0; const u = Math.floor(freq.length * 0.7); for (let i = 0; i < u; i++) s += freq[i]; target = Math.min(2.2, (s / u / 255) * 3.2); } }
    });
    if (btn) { btn.addEventListener('click', () => player.toggle()); }
    resize();
    window.addEventListener('resize', resize);
    if (reduce) { level = 0.3; draw(); cancelAnimationFrame(raf); }
    else draw();
  })();
})();
