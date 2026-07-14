(() => {
      const PLAY  = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>';
      const PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>';
      let current = null;

      function fmt(s) {
        s = Math.max(0, Math.floor(s || 0));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      }

      document.querySelectorAll('.clip[data-src]').forEach(clip => {
        const btn   = clip.querySelector('.clip-btn');
        const fill  = clip.querySelector('.clip-fill');
        const time  = clip.querySelector('.clip-time');
        const track = clip.querySelector('.clip-track');

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
          if (audio.duration) {
            fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
            time.textContent = fmt(audio.currentTime);
          }
        });
        audio.addEventListener('ended', () => {
          fill.style.width = '0%';
          time.textContent = fmt(audio.duration);
        });
        track.addEventListener('click', (e) => {
          if (!audio.duration) return;
          const r = track.getBoundingClientRect();
          audio.currentTime = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * audio.duration;
        });
      });

      const rev = document.getElementById('clone-reveal');
      const ans = document.getElementById('clone-answer');
      if (rev && ans) {
        rev.addEventListener('click', () => { ans.hidden = false; rev.hidden = true; });
      }
    })();
