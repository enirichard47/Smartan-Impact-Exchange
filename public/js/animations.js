/* ==========================================================================
   SIX — motion layer
   Loader, opening sequence, smooth scroll, scroll-driven scenes, reveals.
   Exposes helpers on window.SIX for main.js.
   ========================================================================== */
(() => {
  'use strict';

  const SIX = (window.SIX = window.SIX || {});
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  SIX.reduced = reduced;

  /* ---------- utils ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  SIX.util = { clamp, lerp, easeOut, easeInOut };

  SIX.tween = (from, to, dur, onUpdate, ease = easeOut) => {
    if (reduced || dur <= 0) { onUpdate(to); return () => {}; }
    const start = performance.now();
    let raf = 0;
    const step = now => {
      const t = clamp((now - start) / dur);
      onUpdate(from + (to - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  };

  /* ---------- tiny sticky event bus ---------- */
  const fired = new Set();
  const handlers = {};
  SIX.on = (name, fn) => { if (fired.has(name)) fn(); else (handlers[name] ||= []).push(fn); };
  SIX.emit = name => { fired.add(name); (handlers[name] || []).forEach(fn => fn()); handlers[name] = []; };

  /* ---------- once-in-view ---------- */
  SIX.once = (el, fn, opts = {}) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { io.disconnect(); fn(el); } });
    }, { threshold: opts.threshold ?? 0.2, rootMargin: opts.rootMargin ?? '0px' });
    io.observe(el);
  };

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduced && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.stop();
  }
  SIX.lenis = lenis;

  SIX.scrollTo = target => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const offset = target === '#top' ? 0 : -56;
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.4 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: reduced ? 'auto' : 'smooth' });
  };

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    e.preventDefault();
    document.body.classList.remove('menu-open');
    SIX.setMenu && SIX.setMenu(false);
    SIX.scrollTo(id);
  });

  /* ---------- central frame loop ---------- */
  const scrollSubs = [];
  const frameSubs = [];
  SIX.onScroll = fn => scrollSubs.push(fn);
  SIX.onFrame = fn => frameSubs.push(fn);
  let lastY = -1, lastH = -1;
  const loop = t => {
    if (lenis) lenis.raf(t);
    const y = window.scrollY, h = window.innerHeight;
    if (y !== lastY || h !== lastH) {
      lastY = y; lastH = h;
      for (const fn of scrollSubs) fn(y, h);
    }
    for (const fn of frameSubs) fn(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => { lastY = -1; }, { passive: true });
  SIX.refreshScroll = () => { lastY = -1; };

  /* ---------- reveals ---------- */
  document.querySelectorAll('[data-stagger]').forEach(parent => {
    const step = Number(parent.dataset.stagger) || 80;
    [...parent.querySelectorAll(':scope > *, :scope > li > *')]
      .filter(c => c.hasAttribute('data-reveal'))
      .forEach((c, i) => c.style.setProperty('--d', `${i * step}ms`));
  });
  const revealIO = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          revealIO.unobserve(e.target);
        });
      }, { threshold: 0, rootMargin: '0px 0px -12% 0px' })
    : null;
  SIX.on('ready', () => {
    document.querySelectorAll('[data-reveal]').forEach(el => revealIO ? revealIO.observe(el) : el.classList.add('is-in'));
  });

  /* ---------- scroll-scrubbed words ---------- */
  const splitWords = el => {
    const out = [];
    [...el.childNodes].forEach(node => {
      const text = node.textContent;
      const cls = node.nodeType === 1 ? node.className : '';
      text.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { out.push(document.createTextNode(' ')); return; }
        const s = document.createElement('span');
        s.className = `sw ${cls}`.trim();
        s.textContent = part;
        out.push(s);
      });
    });
    el.textContent = '';
    out.forEach(n => el.appendChild(n));
    return [...el.querySelectorAll('.sw')];
  };
  document.querySelectorAll('[data-scrub]').forEach(el => {
    const words = splitWords(el);
    let lit = -1;
    SIX.onScroll((y, h) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > h + 200) return;
      const p = clamp((h * 0.88 - r.top) / (h * 0.5));
      const n = Math.round(p * words.length);
      if (n === lit) return;
      lit = n;
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    });
  });

  /* ---------- parallax ---------- */
  if (!reduced) {
    document.querySelectorAll('[data-parallax]').forEach(el => {
      const f = Number(el.dataset.parallax) || 0.1;
      SIX.onScroll((y, h) => {
        if (window.innerWidth < 961) { el.style.transform = ''; el.dataset.py = '0'; return; }
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > h + 100) return;
        const applied = parseFloat(el.dataset.py) || 0;
        const off = r.top - applied + r.height / 2 - h / 2;
        const t = -off * f;
        el.dataset.py = String(t);
        el.style.transform = `translate3d(0, ${t.toFixed(1)}px, 0)`;
      });
    });
  }

  /* ---------- nav state + active section ---------- */
  const nav = document.getElementById('nav');
  const navLinks = [...document.querySelectorAll('[data-nav]')];
  const navTargets = navLinks.map(a => document.getElementById(a.dataset.nav)).filter(Boolean);
  SIX.onScroll((y, h) => {
    nav.classList.toggle('is-scrolled', y > 24);
    let active = null;
    navTargets.forEach(sec => {
      const r = sec.getBoundingClientRect();
      if (r.top < h * 0.45 && r.bottom > h * 0.45) active = sec.id;
    });
    navLinks.forEach(a => a.classList.toggle('is-active', a.dataset.nav === active));
  });

  /* ---------- mobile menu ---------- */
  const burger = document.getElementById('burger');
  const mmenu = document.getElementById('mobileMenu');
  SIX.setMenu = open => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mmenu.setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => SIX.setMenu(!document.body.classList.contains('menu-open')));
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) SIX.setMenu(false); });

  /* ---------- light / dark theme ---------- */
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const syncThemeUI = () => {
    const light = root.getAttribute('data-theme') === 'light';
    const label = light ? 'Switch to dark mode' : 'Switch to light mode';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    if (metaTheme) metaTheme.setAttribute('content', light ? '#F7F8FA' : '#07090D');
  };
  SIX.theme = () => root.getAttribute('data-theme') || 'dark';
  SIX.setTheme = (theme, persist = true) => {
    if (!reduced) {
      root.classList.add('theme-anim');
      clearTimeout(SIX._themeT);
      SIX._themeT = setTimeout(() => root.classList.remove('theme-anim'), 500);
    }
    root.setAttribute('data-theme', theme);
    if (persist) { try { localStorage.setItem('six-theme', theme); } catch (e) { /* storage unavailable */ } }
    syncThemeUI();
    document.dispatchEvent(new CustomEvent('six:theme', { detail: { theme } }));
  };
  toggle.addEventListener('click', () => SIX.setTheme(SIX.theme() === 'light' ? 'dark' : 'light'));
  syncThemeUI();
  // follow the OS setting until the visitor picks a theme themselves
  const mqLight = window.matchMedia('(prefers-color-scheme: light)');
  const onSystem = e => {
    let saved = null;
    try { saved = localStorage.getItem('six-theme'); } catch (err) { /* ignore */ }
    if (!saved) SIX.setTheme(e.matches ? 'light' : 'dark', false);
  };
  if (mqLight.addEventListener) mqLight.addEventListener('change', onSystem);

  /* ---------- sticky scene helper ---------- */
  // Returns 0..1 progress of a tall section scrolling past its sticky child.
  SIX.sceneProgress = (section, h) => {
    const r = section.getBoundingClientRect();
    const total = r.height - h;
    return total <= 0 ? 0 : clamp(-r.top / total);
  };

  /* ---------- cinematic statement ---------- */
  const cinema = document.getElementById('cinema');
  if (cinema) {
    const words = [...cinema.querySelectorAll('.cw')];
    const bar = document.getElementById('cinemaBar');
    const marks = [0.06, 0.22, 0.38, 0.54, 0.72];
    SIX.onScroll((y, h) => {
      const r = cinema.getBoundingClientRect();
      if (r.bottom < 0 || r.top > h) return;
      const p = SIX.sceneProgress(cinema, h);
      bar.style.setProperty('--p', p.toFixed(3));
      const finalOn = p >= marks[4];
      words.forEach((w, i) => {
        const on = p >= marks[i];
        const next = i < 3 ? p >= marks[i + 1] : finalOn;
        if (i === 4) { w.classList.toggle('is-on', finalOn); return; }
        w.classList.toggle('is-on', on && !next);
        w.classList.toggle('is-past', on && next);
      });
    });
  }

  /* ---------- scramble + split-flap ---------- */
  const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const DIGITS = '0123456789';

  // Text scramble: characters settle left to right. Punctuation/₦ stay put.
  SIX.scramble = (el, text, dur = 1100) => {
    if (reduced) { el.textContent = text; return; }
    const start = performance.now();
    const step = now => {
      const t = clamp((now - start) / dur);
      const settled = Math.floor(t * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        out += i < settled || !/[0-9A-Z]/.test(ch) ? ch : (/[0-9]/.test(ch) ? DIGITS : FLAP_CHARS)[Math.floor(Math.random() * 10)];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // Split-flap board: one tile per character, each cycling before it lands.
  SIX.flap = (el, text, { delay = 0, stagger = 45, spins = 7 } = {}) => {
    const label = text;
    el.setAttribute('aria-label', label);
    el.innerHTML = `<span class="flap" aria-hidden="true">${[...text].map(c => `<span class="flap__t${c === ' ' ? ' flap__t--sp' : ''}">${c === ' ' ? '' : '&nbsp;'}</span>`).join('')}</span>`;
    const tiles = [...el.querySelectorAll('.flap__t')];
    const timers = [];
    tiles.forEach((tile, i) => {
      const ch = text[i];
      if (ch === ' ') return;
      if (reduced) { tile.textContent = ch; tile.classList.add('is-set'); return; }
      let n = 0;
      const total = spins + Math.floor(Math.random() * 4);
      const spin = () => {
        tile.classList.remove('is-tick'); void tile.offsetWidth; tile.classList.add('is-tick');
        if (n++ >= total) { tile.textContent = ch; tile.classList.add('is-set'); return; }
        tile.textContent = FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
        timers.push(setTimeout(spin, 55));
      };
      timers.push(setTimeout(spin, delay + i * stagger));
    });
    return () => timers.forEach(clearTimeout);
  };

  /* ---------- page start: Opening Day sequence or short loader ---------- */
  const loader = document.getElementById('loader');
  const opening = document.getElementById('opening');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const start = () => {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    if (lenis) lenis.start();
    SIX.emit('ready');
  };

  const runLoader = () => {
    const pct = document.getElementById('loaderPct');
    const bar = document.getElementById('loaderBar');
    const LOAD_MS = reduced ? 150 : 1100;
    SIX.tween(0, 100, LOAD_MS, v => {
      pct.textContent = String(Math.round(v)).padStart(3, '0');
      bar.style.transform = `scaleX(${v / 100})`;
    }, easeInOut);
    setTimeout(() => {
      loader.classList.add('is-done');
      start();
      setTimeout(() => loader.remove(), 800);
    }, LOAD_MS + 150);
  };

  /* ---------- sound: synthesised with Web Audio, no files ---------- */
  // Browsers only allow sound after a click, so the intro starts with a
  // "Begin with sound" gate; a replay click counts as that gesture too.
  const sfx = (() => {
    let ac = null, master = null, enabled = false, drone = null, noiseBuf = null;
    const ensure = () => {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.9;
        master.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    };
    const ok = () => enabled && ensure();
    const envelope = (node, t, attack, peak, decay) => {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
      node.connect(g); g.connect(master);
      return g;
    };
    const tone = (type, freq, peak, decay, when = 0, attack = 0.003) => {
      const t = ac.currentTime + when;
      const o = ac.createOscillator();
      o.type = type; o.frequency.value = freq;
      envelope(o, t, attack, peak, decay);
      o.start(t); o.stop(t + attack + decay + 0.05);
    };
    const noise = () => {
      if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = ac.createBufferSource(); s.buffer = noiseBuf; return s;
    };
    return {
      get on() { return enabled; },
      enable(v) {
        enabled = v;
        try { localStorage.setItem('six-sound', v ? '1' : '0'); } catch (e) { /* ignore */ }
        if (v) ensure(); else this.droneStop(true);
      },
      // counter tick: a short mechanical click, rising slightly as the count climbs
      tick(p = 0) {
        if (!ok()) return;
        tone('square', 1500 + p * 700 + Math.random() * 90, 0.022, 0.016);
        tone('sine', 3200 + p * 900, 0.012, 0.01);
      },
      // brick tick: lower, woodier
      clack() {
        if (!ok()) return;
        tone('triangle', 520 + Math.random() * 80, 0.09, 0.06);
      },
      // the counter locking onto its final figure
      settle() {
        if (!ok()) return;
        tone('square', 220, 0.05, 0.08);
        [880, 1320, 1760].forEach((f, i) => tone('sine', f, 0.14 / (i + 1), 1.6 - i * 0.3, 0.02));
      },
      // two soft low beats (lub-dub)
      heartbeat() {
        if (!ok()) return;
        [0, 0.24].forEach((dt, i) => {
          const t = ac.currentTime + dt;
          const o = ac.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(95, t);
          o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
          envelope(o, t, 0.006, i ? 0.32 : 0.48, 0.3);
          o.start(t); o.stop(t + 0.45);
        });
      },
      // the opening bell: inharmonic partials with long decays
      bell() {
        if (!ok()) return;
        [[0.5, 0.35, 5], [1, 0.7, 4.2], [1.19, 0.3, 3.2], [1.5, 0.24, 2.8], [2, 0.34, 2.4], [2.52, 0.14, 1.8], [3.01, 0.1, 1.3]]
          .forEach(([r, a, d]) => tone('sine', 392 * r, a * 0.22, d, 0, 0.004));
      },
      // soft air sweep as the curtain opens
      whoosh() {
        if (!ok()) return;
        const t = ac.currentTime;
        const s = noise();
        const f = ac.createBiquadFilter();
        f.type = 'bandpass'; f.Q.value = 0.9;
        f.frequency.setValueAtTime(300, t);
        f.frequency.exponentialRampToValueAtTime(2600, t + 0.7);
        s.connect(f);
        envelope(f, t, 0.25, 0.12, 0.6);
        s.start(t); s.stop(t + 1);
      },
      // low ambient bed under the whole intro
      droneStart() {
        if (!ok() || drone) return;
        const t = ac.currentTime;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 2.5);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        lp.connect(g); g.connect(master);
        const oscs = [55, 82.4, 110.2].map((f, i) => {
          const o = ac.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f;
          o.detune.value = (i - 1) * 4; o.connect(lp); o.start(t); return o;
        });
        drone = { g, oscs };
      },
      droneStop(fast = false) {
        if (!drone || !ac) return;
        const t = ac.currentTime, d = drone; drone = null;
        d.g.gain.cancelScheduledValues(t);
        d.g.gain.setValueAtTime(d.g.gain.value, t);
        d.g.gain.linearRampToValueAtTime(0.0001, t + (fast ? 0.2 : 1.4));
        d.oscs.forEach(o => o.stop(t + (fast ? 0.25 : 1.5)));
      },
    };
  })();
  SIX.sfx = sfx;

  // replay = true when a visitor asks to watch it again (page already running)
  let openingRunning = false;
  const runOpening = (replay = false) => {
    if (openingRunning) return;
    openingRunning = true;
    const root = document.documentElement;
    const returnFocus = document.activeElement;
    const CFG = window.SIX_CONFIG;
    const L = CFG.launch;
    const nf = new Intl.NumberFormat('en-NG');
    const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const [yy, mm, dd] = L.date.split('-').map(Number);
    document.getElementById('opDate').textContent = `${dd} ${MONTHS[mm - 1]} ${yy}`;
    document.getElementById('opCity').textContent = L.city.toUpperCase();
    const amount = document.getElementById('opAmount');
    const bricksEl = document.getElementById('opBricks');
    const totalBricks = Math.round(CFG.target / CFG.unitPrice);
    amount.textContent = '₦0';
    bricksEl.textContent = '0';
    const clock = document.getElementById('opClock');
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const tickClock = () => { clock.textContent = fmt.format(new Date()); };
    tickClock();
    const clockT = setInterval(tickClock, 1000);

    const scenes = {};
    opening.querySelectorAll('[data-scene]').forEach(s => { scenes[s.dataset.scene] = s; });
    const soundBtn = document.getElementById('opSound');
    const syncSoundBtn = () => {
      soundBtn.textContent = sfx.on ? 'Sound on' : 'Sound off';
      soundBtn.setAttribute('aria-pressed', String(sfx.on));
    };

    if (replay) {
      // reset to the first frame without animating the reset itself
      opening.style.transition = 'none';
      opening.classList.remove('is-done', 'is-closing');
      Object.values(scenes).forEach(s => s.classList.remove('is-on', 'is-out', 'is-beat'));
      amount.classList.remove('is-beat');
      root.classList.add('is-opening');
      void opening.offsetWidth;
      opening.style.transition = '';
      document.body.classList.add('is-loading');
      if (lenis) lenis.stop();
    }
    const on = k => { scenes[k].classList.remove('is-out'); scenes[k].classList.add('is-on'); };
    const out = k => { scenes[k].classList.remove('is-on'); scenes[k].classList.add('is-out'); };

    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const rafs = [];
    let finished = false;

    // count from 0 to `to`, decelerating like a counter settling; `onStep` fires per visible change
    const count = (to, dur, render, onStep, stepSize) => {
      const t0 = performance.now();
      let lastStep = -1, lastSound = 0;
      const frame = now => {
        if (finished) return;
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4);
        const v = Math.round(to * e);
        render(v);
        const step = Math.floor(v / stepSize);
        if (step !== lastStep && now - lastSound > 34) { lastStep = step; lastSound = now; onStep(e); }
        if (p < 1) rafs.push(requestAnimationFrame(frame));
      };
      rafs.push(requestAnimationFrame(frame));
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      rafs.forEach(cancelAnimationFrame);
      clearInterval(clockT);
      window.removeEventListener('keydown', onKey);
      try { localStorage.setItem(CFG.openingKey(), '1'); } catch (e) { /* storage unavailable */ }
      sfx.whoosh();
      sfx.droneStop();
      opening.classList.add('is-closing');
      setTimeout(() => {
        opening.classList.add('is-done');
        if (replay) {
          document.body.classList.remove('is-loading');
          if (lenis) lenis.start();
          if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
        } else {
          start();
          SIX.emit('opened');
        }
        setTimeout(() => {
          root.classList.remove('is-opening');
          if (loader && loader.isConnected) loader.remove();
          openingRunning = false;
        }, 1600);
      }, 380);
    };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); finish(); } };
    window.addEventListener('keydown', onKey);
    document.getElementById('opSkip').onclick = finish;
    soundBtn.onclick = () => { sfx.enable(!sfx.on); if (sfx.on) sfx.droneStart(); syncSoundBtn(); };

    // the sequence itself
    const play = () => {
      soundBtn.hidden = false;
      syncSoundBtn();
      sfx.droneStart();
      at(300, () => on('date'));
      at(2200, () => out('date'));
      at(2600, () => on('name'));
      at(4400, () => out('name'));
      at(4800, () => on('target'));
      at(5100, () => count(CFG.target, 2800, v => { amount.textContent = '₦' + nf.format(v); }, e => sfx.tick(e), 1e6));
      at(8000, () => { scenes.target.classList.add('is-beat'); amount.classList.add('is-beat'); sfx.settle(); });
      at(8300, () => sfx.heartbeat());
      at(9700, () => out('target'));
      at(10100, () => on('bricks'));
      at(10300, () => count(totalBricks, 1300, v => { bricksEl.textContent = nf.format(v); }, () => sfx.clack(), 250));
      at(12000, () => out('bricks'));
      at(12400, () => { on('begin'); sfx.bell(); });
      at(14200, finish);
    };

    let soundPref = null;
    try { soundPref = localStorage.getItem('six-sound'); } catch (e) { /* ignore */ }
    if (replay) {
      // the replay click already unlocked audio
      sfx.enable(soundPref !== '0');
      scenes.gate.classList.remove('is-on');
      document.getElementById('opSkip').focus({ preventScroll: true });
      play();
    } else {
      on('gate');
      const begin = withSound => {
        sfx.enable(withSound);
        out('gate');
        timers.push(setTimeout(play, 500));
      };
      document.getElementById('opSoundOn').onclick = () => begin(true);
      document.getElementById('opSoundOff').onclick = () => begin(false);
      document.getElementById(soundPref === '0' ? 'opSoundOff' : 'opSoundOn').focus({ preventScroll: true });
    }
  };

  SIX.replayOpening = () => { if (opening && window.SIX_CONFIG) runOpening(true); };

  /* ---------- ATM CARD 3D TILT & GLARE EFFECT ---------- */
  if (finePointer && !reduced) {
    document.addEventListener('mousemove', e => {
      const card = e.target.closest('.atm-card, .token, .bcard');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.025, 1.025, 1.025)`;
      card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
      card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
    });

    document.addEventListener('mouseout', e => {
      const card = e.target.closest('.atm-card, .token, .bcard');
      if (!card) return;
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      card.style.setProperty('--mouse-x', '50%');
      card.style.setProperty('--mouse-y', '50%');
    });
  }

  if (document.documentElement.classList.contains('is-opening') && opening && window.SIX_CONFIG) runOpening();
  else runLoader();
})();
