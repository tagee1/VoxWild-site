(() => {
      const PLAY  = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>';
      const PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>';
      let current = null;

      function fmt(s) {
        s = Math.max(0, Math.floor(s || 0));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      }

      // Deterministic per-clip waveform so each card looks distinct but stable.
      function hashStr(s) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
      }
      function mulberry32(a) {
        return function () {
          a |= 0; a = (a + 0x6D2B79F5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      function waveHeights(seed, n) {
        const rnd = mulberry32(hashStr(seed));
        const out = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const env = 0.35 + 0.5 * Math.sin(Math.PI * t);      // centre hump
          const noise = 0.55 * rnd() + 0.28 * Math.sin(t * 21 + rnd() * 6);
          let h = env * 0.62 + noise * 0.55;
          h = Math.max(0.14, Math.min(1, h));
          out.push(Math.round(h * 100));
        }
        return out;
      }

      function buildWave(wave, seed) {
        const N = 44;
        const heights = waveHeights(seed, N);
        const fill = document.createElement('div');
        fill.className = 'wv-fill';
        const frag = document.createDocumentFragment();
        heights.forEach(h => {
          const b = document.createElement('i');
          b.className = 'wv';
          b.style.setProperty('--wh', h + '%');
          frag.appendChild(b);
          const f = document.createElement('i');
          f.className = 'wv';
          f.style.setProperty('--wh', h + '%');
          fill.appendChild(f);
        });
        wave.appendChild(frag);
        wave.appendChild(fill);
        return fill;
      }

      document.querySelectorAll('.clip[data-src]').forEach((clip, idx) => {
        const btn   = clip.querySelector('.clip-btn');
        const time  = clip.querySelector('.clip-time');
        const wave  = clip.querySelector('.clip-wave');
        const fillRow = wave ? buildWave(wave, clip.dataset.src || String(idx)) : null;

        const audio = new Audio();
        audio.preload = 'metadata';
        audio.src = clip.dataset.src;

        // Missing/broken file → grey the card out instead of a dead button.
        audio.addEventListener('error', () => clip.classList.add('pending'));
        audio.addEventListener('loadedmetadata', () => {
          time.textContent = fmt(audio.duration);
        });

        btn.addEventListener('click', () => {
          if (audio.paused) {
            if (current && current !== audio) current.pause();
            current = audio;
            audio.play().catch(() => clip.classList.add('pending'));
          } else {
            audio.pause();
          }
        });
        audio.addEventListener('play', () => {
          btn.innerHTML = PAUSE;
          btn.setAttribute('aria-label', 'Pause sample');
        });
        audio.addEventListener('pause', () => {
          btn.innerHTML = PLAY;
          btn.setAttribute('aria-label', 'Play sample');
        });
        audio.addEventListener('timeupdate', () => {
          if (audio.duration && fillRow) {
            const pct = audio.currentTime / audio.duration * 100;
            fillRow.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
            time.textContent = fmt(audio.currentTime);
          }
        });
        audio.addEventListener('ended', () => {
          if (fillRow) fillRow.style.clipPath = 'inset(0 100% 0 0)';
          time.textContent = fmt(audio.duration);
        });
        if (wave) {
          wave.addEventListener('click', (e) => {
            if (!audio.duration) return;
            const r = wave.getBoundingClientRect();
            audio.currentTime = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * audio.duration;
          });
        }
      });

      const rev = document.getElementById('clone-reveal');
      const ans = document.getElementById('clone-answer');
      if (rev && ans) {
        rev.addEventListener('click', () => { ans.hidden = false; rev.hidden = true; });
      }
    })();
