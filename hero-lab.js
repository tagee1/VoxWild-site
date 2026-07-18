/* hero-lab.js — hero concept animations + real click-to-play.
   One clip plays at a time; visuals react to the actual audio via a Web-Audio
   analyser, with a currentTime fallback. Respects reduced motion. No-ops for
   any hero not present on the page. */
(() => {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const baseOf = el => { const n = el.closest('[data-audiobase]'); return (n && n.dataset.audiobase) || 'audio/'; };

  // Shared voice set — text MUST match the generated clips exactly.
  const SET = [
    { label: '🇺🇸 Female - Heart (Best)', flag: '🇺🇸', name: 'Heart', clip: 'hero-heart.mp3',
      text: "Type what you want to say, and I'll say it. First take, every time — no second takes." },
    { label: '🇬🇧 Male - George (Best)', flag: '🇬🇧', name: 'George', clip: 'hero-george.mp3',
      text: "No subscription. No cloud. No catch. I run right on your laptop, even with the Wi-Fi off." },
    { label: '🇺🇸 Male - Michael', flag: '🇺🇸', name: 'Michael', clip: 'hero-michael.mp3',
      text: "It's midnight, the video's due, and the studio is closed. Paste your script, pick a voice, hit export." },
    { label: '🇬🇧 Female - Emma', flag: '🇬🇧', name: 'Emma', clip: 'hero-emma.mp3',
      text: "Thirteen voices built in, plus your own, cloned from just six seconds of audio." },
  ];

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
    const N = 46;
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
      const line = SET[i];
      voiceEl.textContent = line.label; build(line.text + i);
      typed.textContent = ''; barFill.style.width = '0%'; statusEl.textContent = 'Ready — press ▸'; timeEl.textContent = '0:00';
      caret.style.display = 'inline-block';
      if (reduce) { typed.textContent = line.text; caret.style.display = 'none'; return; }
      for (let c = 0; c < line.text.length && !playing; c++) { typed.textContent += line.text[c]; await sleep(line.text[c] === ' ' ? 14 : 24); }
    }
    function scheduleAdvance() {
      clearTimeout(advTimer);
      if (reduce) return;
      advTimer = setTimeout(async () => { if (playing) return; idx = (idx + 1) % SET.length; await showLine(idx); scheduleAdvance(); }, 3200);
    }
    const player = createPlayer(baseOf(demo), {
      clipFor: () => SET[idx].clip,
      onStart: () => { playing = true; clearTimeout(advTimer); statusEl.textContent = '▶ Playing'; genBtn.classList.add('pulse'); caret.style.display = 'none'; },
      onStop: (ended) => {
        playing = false; genBtn.classList.remove('pulse');
        bars.forEach(b => { b.classList.remove('on'); b.style.height = ''; });
        barFill.style.width = '0%'; timeEl.textContent = '0:00';
        statusEl.textContent = ended ? '✓ Done' : 'Ready — press ▸';
        if (ended) { idx = (idx + 1) % SET.length; showLine(idx).then(scheduleAdvance); } else scheduleAdvance();
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

  // ── HERO #2 — full-bleed living waveform ────────────────────────────────
  (function () {
    const stage = document.querySelector('.wavehero');
    if (!stage) return;
    const canvas = stage.querySelector('.wavehero-canvas'), btn = stage.querySelector('.wavehero-play'),
          now = stage.querySelector('.wavehero-now');
    const c = canvas.getContext('2d');
    let W = 0, H = 0, phase = 0, level = 0, target = 0, raf = 0, idx = 0;
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function edges() {
      const mid = H * 0.56, amp = H * 0.34 * (0.16 + level * 0.5), tops = [], bots = [];
      for (let x = 0; x <= W; x += 4) {
        const t = x / W, taper = Math.sin(t * Math.PI), bias = 0.45 + 0.55 * t;
        let s = 0.55 * Math.sin(t * 38 + phase * 2.1) + 0.30 * Math.sin(t * 71 - phase * 1.4) + 0.18 * Math.sin(t * 113 + phase * 0.7);
        const h = amp * taper * bias * (0.25 + Math.abs(s));
        tops.push([x, mid - h]); bots.push([x, mid + h]);
      }
      return { mid, amp, tops, bots };
    }
    function draw() {
      c.clearRect(0, 0, W, H);
      level += (target - level) * 0.08;
      const { mid, amp, tops, bots } = edges();
      c.beginPath();
      c.moveTo(tops[0][0], tops[0][1]);
      for (const p of tops) c.lineTo(p[0], p[1]);
      for (let i = bots.length - 1; i >= 0; i--) c.lineTo(bots[i][0], bots[i][1]);
      c.closePath();
      const g = c.createLinearGradient(0, mid - amp, 0, mid + amp);
      g.addColorStop(0, 'rgba(0,217,139,0.05)'); g.addColorStop(0.5, 'rgba(0,217,139,0.26)'); g.addColorStop(1, 'rgba(0,217,139,0.05)');
      c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(46,229,160,0.85)'; c.lineWidth = 2; c.lineJoin = 'round';
      c.shadowColor = 'rgba(0,217,139,0.6)'; c.shadowBlur = 12;
      c.beginPath(); c.moveTo(tops[0][0], tops[0][1]); for (const p of tops) c.lineTo(p[0], p[1]); c.stroke();
      c.beginPath(); c.moveTo(bots[0][0], bots[0][1]); for (const p of bots) c.lineTo(p[0], p[1]); c.stroke();
      c.shadowBlur = 0;
      phase += 0.02 + level * 0.045;
      raf = requestAnimationFrame(draw);
    }
    function setNow(state) {
      if (!now) return;
      const v = SET[idx];
      if (state === 'play') now.innerHTML = '<span class="wn-live">● playing</span> ' + v.flag + ' ' + v.name + ' <span class="wn-line">“' + v.text + '”</span>';
      else now.innerHTML = '<span class="wn-hint">▸ tap to hear ' + SET.length + ' voices</span>';
    }
    const player = createPlayer(baseOf(stage), {
      clipFor: () => SET[idx].clip,
      onStart: () => { stage.classList.add('playing'); if (btn) btn.innerHTML = '❚❚&nbsp;&nbsp;Playing…'; setNow('play'); },
      onStop: (ended) => {
        stage.classList.remove('playing'); target = 0;
        if (ended) idx = (idx + 1) % SET.length;
        if (btn) btn.innerHTML = '▶&nbsp;&nbsp;Hear ' + SET[idx].name;
        setNow('idle');
      },
      onFrame: (freq) => { if (freq) { let s = 0; const u = Math.floor(freq.length * 0.7); for (let i = 0; i < u; i++) s += freq[i]; target = Math.min(2.2, (s / u / 255) * 3.2); } }
    });
    if (btn) { btn.addEventListener('click', () => player.toggle()); btn.innerHTML = '▶&nbsp;&nbsp;Hear ' + SET[idx].name; }
    setNow('idle');
    resize();
    window.addEventListener('resize', resize);
    if (reduce) { level = 0.3; draw(); cancelAnimationFrame(raf); }
    else draw();
  })();

  // ── HERO #3 — radial voiceprint orb (plays Heart) ───────────────────────
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

  // ── HERO #4 — desktop app window (types the spoken line, cycles 4 voices) ─
  (function () {
    const win = document.querySelector('.appwin');
    if (!win) return;
    const fill = win.querySelector('.appwin-progress-fill'), gen = win.querySelector('.aw-primary'),
          play = win.querySelector('.aw-play'), cardTime = win.querySelector('.aw-card-time'),
          typed = win.querySelector('.aw-typed'), voiceSel = win.querySelector('.aw-select span'),
          counter = win.querySelector('.aw-counter'), cardVoice = win.querySelector('.aw-card-voice'),
          cardText = win.querySelector('.aw-card-text'), statusEl = win.querySelector('.appwin-status');
    const READY = 'Ready · Ctrl+Enter to generate · Ctrl+P to play · Esc to stop';
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const est = t => Math.max(1, Math.round(t.length / 14));
    const firstSentence = t => { const m = t.match(/^.*?[.!?—](?:\s|$)/); return (m ? m[0] : t).trim().replace(/[—\s]+$/, ''); };
    let idx = 0, advTimer = 0, playing = false;

    function chrome(line) {
      if (voiceSel) voiceSel.textContent = line.label;
      const words = line.text.trim().split(/\s+/).length;
      if (counter) counter.textContent = 'Words: ' + words + ' · Chars: ' + line.text.length + ' · Audio: ~' + est(line.text) + 's · Processing: ~1s';
      if (cardVoice) cardVoice.textContent = line.label.replace(/\s*\(Best\)$/, '');
      if (cardText) cardText.textContent = '"' + firstSentence(line.text) + '"';
    }
    async function showLine(i) {
      const line = SET[i];
      chrome(line);
      if (statusEl) statusEl.textContent = READY;
      if (fill) fill.style.width = '';
      typed.textContent = '';
      if (reduce) { typed.textContent = line.text; return; }
      for (let c = 0; c < line.text.length && !playing; c++) { typed.textContent += line.text[c]; await sleep(line.text[c] === ' ' ? 14 : 24); }
    }
    function scheduleAdvance() {
      clearTimeout(advTimer);
      if (reduce) return;
      advTimer = setTimeout(async () => { if (playing) return; idx = (idx + 1) % SET.length; await showLine(idx); scheduleAdvance(); }, 2800);
    }
    const player = createPlayer(baseOf(win), {
      clipFor: () => SET[idx].clip,
      onStart: () => {
        playing = true; clearTimeout(advTimer);
        win.classList.add('playing'); if (play) play.textContent = '❚❚ Pause';
        typed.textContent = SET[idx].text;
        if (statusEl) statusEl.textContent = '▶ Generating · ' + SET[idx].name;
      },
      onStop: (ended) => {
        playing = false; win.classList.remove('playing'); if (play) play.textContent = '▶ Play';
        if (fill) fill.style.width = '';
        if (cardTime) cardTime.textContent = fmt(est(SET[idx].text));
        if (statusEl) statusEl.textContent = ended ? '✓ Done · ' + SET[idx].name : READY;
        if (ended) { idx = (idx + 1) % SET.length; showLine(idx).then(scheduleAdvance); }
        else scheduleAdvance();
      },
      onFrame: (freq, audio) => { if (audio.duration) { if (fill) fill.style.width = (audio.currentTime / audio.duration * 100) + '%'; if (cardTime) cardTime.textContent = fmt(audio.currentTime); } }
    });
    [gen, play].forEach(b => { if (b) { b.style.cursor = 'pointer'; b.addEventListener('click', () => player.toggle()); } });
    showLine(0).then(scheduleAdvance);
  })();
})();
