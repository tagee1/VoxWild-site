/* hero-lab.js — animation for Hero #1 (type-to-voice panel).
   Hero #4 (app window) is pure CSS. Safe to load on any page: no-ops when the
   panel is absent. Respects reduced motion (renders one finished state). */
(() => {
  const demo = document.querySelector('.tts-demo');
  if (!demo) return;

  const typed   = demo.querySelector('.tts-typed');
  const caret   = demo.querySelector('.tts-caret');
  const barFill = demo.querySelector('.tts-bar-fill');
  const wave    = demo.querySelector('.tts-wave');
  const statusEl= demo.querySelector('.tts-status');
  const timeEl  = demo.querySelector('.tts-time');
  const voiceEl = demo.querySelector('.tts-voice');
  const genBtn  = demo.querySelector('.tts-generate');
  const reduce  = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LINES = [
    { voice: '🇺🇸 Female - Heart (Best)', text: 'First take, every time.',              dur: 3 },
    { voice: '🇬🇧 Male - George (Best)',  text: 'I live on your laptop. No monthly fees.', dur: 4 },
    { voice: '🇺🇸 Male - Michael',        text: 'Paste your script, pick a voice, export.', dur: 4 },
  ];
  const N = 42;

  const hash = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const mulberry = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const fmt = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let bars = [];
  function buildBars(seed) {
    wave.innerHTML = '';
    bars = [];
    const rnd = mulberry(hash(seed));
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const env = 0.4 + 0.5 * Math.sin(Math.PI * t);
      let h = env * 0.6 + (0.5 * rnd() + 0.3 * Math.sin(t * 20 + rnd() * 6)) * 0.55;
      h = Math.max(0.14, Math.min(1, h));
      const b = document.createElement('i');
      b.style.setProperty('--wh', Math.round(h * 100) + '%');
      wave.appendChild(b);
      bars.push(b);
    }
  }

  function ramp(setter, ms) {
    return new Promise(res => {
      const t0 = performance.now();
      (function step(now) {
        const p = Math.min(1, (now - t0) / ms);
        setter(p);
        if (p < 1) requestAnimationFrame(step); else res();
      })(performance.now());
    });
  }

  if (reduce) {
    const line = LINES[0];
    voiceEl.textContent = line.voice;
    buildBars(line.text);
    typed.textContent = line.text;
    caret.style.display = 'none';
    barFill.style.width = '100%';
    statusEl.textContent = '▶ Playing';
    timeEl.textContent = fmt(line.dur);
    bars.forEach(b => b.classList.add('on'));
    return;
  }

  let idx = 0;
  async function cycle() {
    const line = LINES[idx % LINES.length];
    voiceEl.textContent = line.voice;
    buildBars(line.text + idx);
    typed.textContent = '';
    barFill.style.width = '0%';
    statusEl.textContent = 'Ready';
    timeEl.textContent = '0:00';
    bars.forEach(b => b.classList.remove('on'));
    caret.style.display = 'inline-block';
    await sleep(500);

    for (let i = 0; i < line.text.length; i++) {   // type
      typed.textContent += line.text[i];
      await sleep(line.text[i] === ' ' ? 24 : 34);
    }
    await sleep(360);

    genBtn.classList.add('pulse');                 // generate
    statusEl.textContent = 'Generating…';
    caret.style.display = 'none';
    await ramp(p => { barFill.style.width = (p * 100) + '%'; }, 900);
    genBtn.classList.remove('pulse');

    statusEl.textContent = '▶ Playing';            // play + waveform sweep
    await ramp(p => {
      const upto = Math.floor(p * N);
      for (let i = 0; i < N; i++) bars[i].classList.toggle('on', i <= upto);
      timeEl.textContent = fmt(p * line.dur);
    }, line.dur * 460);

    statusEl.textContent = '✓ Done';
    await sleep(1150);
    idx++;
    cycle();
  }
  cycle();
})();
