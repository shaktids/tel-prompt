(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORE_KEY = 'teleprompter:v1';

  const FONTS = {
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
    mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif',
  };
  const THEMES = {
    dark: { bg: '#000000', fg: '#ffffff' },
    light: { bg: '#ffffff', fg: '#111111' },
    amber: { bg: '#0a0700', fg: '#ffcc66' },
  };

  const DEFAULTS = {
    fontSize: 64,
    lineHeight: 1.5,
    margin: 10,
    fontFamily: 'sans',
    align: 'left',
    theme: 'dark',
    speed: 6,
    guidePos: 35,
    countdown: 3,
    mirrorX: false,
    mirrorY: false,
    showGuide: true,
    dimOthers: true,
    autoFullscreen: false,
  };

  const SAMPLE = `Welcome to your teleprompter.

Paste your script into the editor, adjust the text size and speed, then press Start prompting.

[PAUSE]

While prompting, press the space bar to play or pause. Use the up and down arrow keys to change the speed, and the plus and minus keys to resize the text.

Turn on mirror mode if you are reading through beam-splitter glass.

Your script and settings are saved automatically in this browser.

[SMILE]

Good luck with your recording!`;

  // ---------- State ----------
  const state = load();
  let script = state.script ?? SAMPLE;
  const s = { ...DEFAULTS, ...(state.settings || {}) };
  if (!state.settings && window.innerWidth < 600) { s.fontSize = 40; s.margin = 5; }

  let pos = 0;            // current scroll offset in px
  let maxPos = 0;
  let playing = false;
  let lastTs = 0;
  let rafId = 0;
  let countdownTimer = 0;
  let wakeLock = null;
  let idleTimer = 0;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ script, settings: s })); } catch { /* storage unavailable */ }
    }, 250);
  }

  // ---------- Elements ----------
  const editorView = $('editorView');
  const prompterView = $('prompterView');
  const scriptInput = $('scriptInput');
  const stage = $('stage');
  const scroller = $('scroller');
  const prompterText = $('prompterText');
  const guide = $('guide');
  const fadeTop = $('fadeTop');
  const fadeBottom = $('fadeBottom');
  const controls = $('controls');
  const countdownOverlay = $('countdownOverlay');
  const progressBar = $('progressBar');

  // ---------- Editor ----------
  scriptInput.value = script;
  updateStats();

  scriptInput.addEventListener('input', () => {
    script = scriptInput.value;
    updateStats();
    save();
  });

  function wordCount(text) {
    const m = text.replace(/\[[^\]]*\]/g, ' ').match(/\S+/g);
    return m ? m.length : 0;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), r = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
  }
  function updateStats() {
    const w = wordCount(script);
    $('wordCount').textContent = `${w.toLocaleString()} word${w === 1 ? '' : 's'}`;
    $('readTime').textContent = `~${fmtTime((w / 150) * 60)} at 150 wpm`;
  }

  $('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    script = await file.text();
    scriptInput.value = script;
    updateStats();
    save();
    e.target.value = '';
  });

  $('clearBtn').addEventListener('click', () => {
    if (script.trim() && !confirm('Clear the script?')) return;
    script = '';
    scriptInput.value = '';
    updateStats();
    save();
    scriptInput.focus();
  });

  // ---------- Settings binding ----------
  const fmt = {
    fontSize: (v) => `${v}px`,
    lineHeight: (v) => Number(v).toFixed(2),
    margin: (v) => `${v}%`,
    speed: (v) => Number(v).toFixed(1),
    guidePos: (v) => `${v}%`,
    countdown: (v) => (Number(v) ? `${v}s` : 'Off'),
  };

  Object.keys(fmt).forEach((key) => {
    const input = $(key);
    const out = $(key + 'Out');
    input.value = s[key];
    out.textContent = fmt[key](s[key]);
    input.addEventListener('input', () => {
      s[key] = Number(input.value);
      out.textContent = fmt[key](s[key]);
      applySettings();
      save();
    });
  });

  const fontSel = $('fontFamily');
  fontSel.value = s.fontFamily;
  fontSel.addEventListener('change', () => { s.fontFamily = fontSel.value; applySettings(); save(); });

  ['mirrorX', 'mirrorY', 'showGuide', 'dimOthers', 'autoFullscreen'].forEach((key) => {
    const cb = $(key);
    cb.checked = !!s[key];
    cb.addEventListener('change', () => { s[key] = cb.checked; applySettings(); save(); });
  });

  ['align', 'theme'].forEach((key) => {
    const group = $(key);
    const sync = () => group.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.value === s[key])));
    group.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      s[key] = b.dataset.value;
      sync(); applySettings(); save();
    });
    sync();
  });

  function syncSettingInputs() {
    Object.keys(fmt).forEach((key) => {
      $(key).value = s[key];
      $(key + 'Out').textContent = fmt[key](s[key]);
    });
    $('mirrorX').checked = s.mirrorX;
  }

  function applySettings() {
    const root = document.documentElement.style;
    const theme = THEMES[s.theme] || THEMES.dark;
    root.setProperty('--p-size', `${s.fontSize}px`);
    root.setProperty('--p-line', s.lineHeight);
    root.setProperty('--p-margin', `${s.margin}vw`);
    root.setProperty('--p-guide', `${s.guidePos}vh`);
    root.setProperty('--p-bg', theme.bg);
    root.setProperty('--p-fg', theme.fg);
    root.setProperty('--p-font', FONTS[s.fontFamily] || FONTS.sans);
    prompterView.dataset.theme = s.theme;
    prompterText.classList.toggle('center', s.align === 'center');
    stage.classList.toggle('mx', s.mirrorX);
    stage.classList.toggle('my', s.mirrorY);
    guide.hidden = !s.showGuide;
    fadeTop.hidden = fadeBottom.hidden = !s.dimOthers;
    $('mirrorBtn').classList.toggle('active', s.mirrorX);
    $('speedLive').textContent = s.speed.toFixed(1);
    $('sizeLive').textContent = s.fontSize;
    if (!prompterView.hidden) measure();
  }

  // ---------- Rendering ----------
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function renderScript(text) {
    const paras = text.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
    return paras.map((p) => {
      const lines = p.split('\n').map((line) => {
        const t = line.trim();
        if (/^\[.*\]$/.test(t)) return `<span class="cue">${escapeHtml(t)}</span>`;
        return escapeHtml(line).replace(/\[([^\]]+)\]/g, '<span class="cue">[$1]</span>');
      });
      return `<p>${lines.join('<br>')}</p>`;
    }).join('');
  }

  function measure() {
    const ratio = maxPos ? pos / maxPos : 0;
    // Distance until the last line has passed the reading line.
    const last = prompterText.lastElementChild;
    const textH = prompterText.offsetHeight;
    const lineH = s.fontSize * s.lineHeight;
    maxPos = Math.max(0, (last ? last.offsetTop + last.offsetHeight - prompterText.offsetTop : textH) - lineH);
    pos = ratio * maxPos;
    render();
  }

  // pixels per second — scaled with font size so words-per-minute stays roughly constant
  const pxPerSec = () => s.speed * s.fontSize * 0.12;

  function render() {
    scroller.style.transform = `translate3d(0, ${-pos}px, 0)`;
    progressBar.style.width = `${maxPos ? (pos / maxPos) * 100 : 0}%`;
    $('timeLeft').textContent = fmtTime((maxPos - pos) / pxPerSec());
  }

  // ---------- Playback ----------
  function tick(ts) {
    if (!playing) return;
    const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    pos += pxPerSec() * dt;
    if (pos >= maxPos) {
      pos = maxPos;
      render();
      pause();
      showControls();
      return;
    }
    render();
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (playing || countdownTimer) return;
    if (pos >= maxPos) pos = 0;
    if (pos < 1 && s.countdown > 0) return startCountdown();
    startScrolling();
  }
  function startScrolling() {
    playing = true;
    lastTs = 0;
    prompterView.classList.add('playing');
    rafId = requestAnimationFrame(tick);
    scheduleIdle();
  }
  function pause() {
    cancelCountdown();
    playing = false;
    cancelAnimationFrame(rafId);
    prompterView.classList.remove('playing');
    showControls();
  }
  const toggle = () => (playing || countdownTimer ? pause() : play());

  function startCountdown() {
    let n = s.countdown;
    const span = countdownOverlay.firstElementChild;
    countdownOverlay.hidden = false;
    span.textContent = n;
    prompterView.classList.add('playing');
    countdownTimer = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        cancelCountdown();
        startScrolling();
      } else {
        span.textContent = n;
        // restart animation
        span.style.animation = 'none'; void span.offsetWidth; span.style.animation = '';
      }
    }, 1000);
    scheduleIdle();
  }
  function cancelCountdown() {
    if (!countdownTimer) return;
    clearInterval(countdownTimer);
    countdownTimer = 0;
    countdownOverlay.hidden = true;
  }

  function nudge(px) {
    pos = Math.min(maxPos, Math.max(0, pos + px));
    render();
  }
  function setSpeed(v) {
    s.speed = Math.round(Math.min(30, Math.max(1, v)) * 2) / 2;
    applySettings(); syncSettingInputs(); save();
  }
  function setSize(v) {
    s.fontSize = Math.min(160, Math.max(24, v));
    applySettings(); syncSettingInputs(); save();
  }

  // ---------- Open / close prompter ----------
  function openPrompter() {
    prompterText.innerHTML = renderScript(script || ' ');
    editorView.hidden = true;
    prompterView.hidden = false;
    pos = 0; maxPos = 0;
    applySettings();
    measure();
    showControls();
    requestWakeLock();
    if (s.autoFullscreen) enterFullscreen();
    // fonts may shift layout slightly once ready
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }
  function closePrompter() {
    pause();
    prompterView.hidden = true;
    editorView.hidden = false;
    releaseWakeLock();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    scriptInput.focus({ preventScroll: true });
  }

  function enterFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else enterFullscreen();
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch { /* not allowed */ }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !prompterView.hidden) requestWakeLock();
  });

  // ---------- Controls auto-hide ----------
  function showControls() {
    controls.classList.remove('idle');
    prompterView.classList.remove('hide-cursor');
    scheduleIdle();
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    if (!playing && !countdownTimer) return;
    idleTimer = setTimeout(() => {
      if (playing || countdownTimer) {
        controls.classList.add('idle');
        prompterView.classList.add('hide-cursor');
      }
    }, 2500);
  }

  // ---------- Event wiring ----------
  $('startBtn').addEventListener('click', openPrompter);
  $('exitBtn').addEventListener('click', closePrompter);
  $('playBtn').addEventListener('click', toggle);
  $('restartBtn').addEventListener('click', () => { pause(); pos = 0; render(); });
  $('fasterBtn').addEventListener('click', () => setSpeed(s.speed + 0.5));
  $('slowerBtn').addEventListener('click', () => setSpeed(s.speed - 0.5));
  $('biggerBtn').addEventListener('click', () => setSize(s.fontSize + 4));
  $('smallerBtn').addEventListener('click', () => setSize(s.fontSize - 4));
  $('mirrorBtn').addEventListener('click', () => { s.mirrorX = !s.mirrorX; applySettings(); syncSettingInputs(); save(); });
  $('fullscreenBtn').addEventListener('click', toggleFullscreen);

  prompterView.addEventListener('mousemove', showControls);

  // Wheel: manual scroll
  prompterView.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = s.mirrorY ? -1 : 1;
    nudge(e.deltaY * dir * (e.deltaMode === 1 ? 30 : 1));
    showControls();
  }, { passive: false });

  // Pointer: drag to scroll, tap to play/pause
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    drag = { y: e.clientY, startPos: pos, moved: false, id: e.pointerId };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 6) drag.moved = true;
    if (drag.moved) {
      const dir = s.mirrorY ? 1 : -1;
      pos = Math.min(maxPos, Math.max(0, drag.startPos + dy * dir));
      render();
    }
  });
  const endDrag = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && e.type === 'pointerup') { toggle(); showControls(); }
    drag = null;
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  document.addEventListener('keydown', (e) => {
    if (prompterView.hidden) {
      // Ctrl/Cmd+Enter starts from the editor
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); openPrompter(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const jump = s.fontSize * s.lineHeight * 3;
    let handled = true;
    switch (e.key) {
      case ' ': case 'k': case 'K': toggle(); break;
      case 'ArrowUp': setSpeed(s.speed + 0.5); break;
      case 'ArrowDown': setSpeed(s.speed - 0.5); break;
      case 'ArrowLeft': case 'PageUp': nudge(-jump); break;
      case 'ArrowRight': case 'PageDown': nudge(jump); break;
      case '+': case '=': setSize(s.fontSize + 4); break;
      case '-': case '_': setSize(s.fontSize - 4); break;
      case 'm': case 'M': $('mirrorBtn').click(); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'Home': pause(); pos = 0; render(); break;
      case 'End': pos = maxPos; render(); break;
      case 'Escape': if (!document.fullscreenElement) closePrompter(); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); showControls(); }
  });

  window.addEventListener('resize', () => { if (!prompterView.hidden) measure(); });

  applySettings();
})();
