/* ==========================================================================
   SIX — data + interface
   Every figure comes from SIX_CONFIG.campaign, which the server fills with
   verified data from the database. Nothing here invents numbers.
   ========================================================================== */

(() => {
  'use strict';

  const SIX = window.SIX;
  const CFG = window.SIX_CONFIG;
  const { clamp } = SIX.util;

  /* ---------- helpers ---------- */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const rng = seed => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('en-NG');
  const naira = n => '₦' + nf.format(Math.round(n));
  const bid = n => '#' + String(n).padStart(6, '0');
  const pct = (part, whole, dp = 1) => `${whole ? +((part / whole) * 100).toFixed(dp) : 0}%`;
  const share = units => `${+((units * CFG.unitPrice) / CFG.target * 100).toFixed(4)}%`;
  const WAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const dayLabel = d => `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]}`;
  const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${String(d).padStart(2, '0')} ${MON[m - 1]} ${y}`; };
  const ago = ts => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  };
  const onResizeWidth = fn => {
    let w = window.innerWidth, t = 0;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => { if (window.innerWidth !== w) { w = window.innerWidth; fn(); } }, 150);
    }, { passive: true });
  };
  const toastEl = $('#toast');
  let toastT = 0;
  const toast = msg => {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  };

  // theme colours for canvas drawing (CSS custom properties, refreshed on theme change)
  const COLOR = { accent: '0, 118, 198', fg: '245, 247, 250' };
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    COLOR.accent = cs.getPropertyValue('--accent-rgb').trim() || COLOR.accent;
    COLOR.fg = cs.getPropertyValue('--fg-rgb').trim() || COLOR.fg;
  };
  readColors();
  document.addEventListener('six:theme', readColors);

  /* ======================================================================
     DATA
     ====================================================================== */
  const D = CFG.campaign;
  const labelFor = key => (D.allocation.find(a => a.key === key) || {}).label || key;

  /* ---------- campaign state + bindings ---------- */
  const S = { raised: D.raised || 0, builders: D.builders || 0, updated: D.updatedAt ? new Date(D.updatedAt) : null };
  const recent = [...(D.recentBuilders || [])];
  const vals = () => {
    const units = S.raised / CFG.unitPrice;
    const progress = (S.raised / CFG.target) * 100;
    const nextLevel = Math.min(CFG.target, (Math.floor(progress / 25) + 1) * 0.25 * CFG.target);
    return {
      raised: S.raised, raisedM: S.raised, units, builders: S.builders, progress,
      avg: S.builders ? units / S.builders : 0,
      toNext: Math.max(0, nextLevel - S.raised),
      remaining: Math.max(0, CFG.target - S.raised),
      remainingM: Math.max(0, CFG.target - S.raised),
      bricksLeft: Math.max(0, Math.round((CFG.target - S.raised) / CFG.unitPrice)),
      nextLevel,
    };
  };
  const FMT = {
    raised: naira,
    raisedM: v => `₦${(v / 1e6).toFixed(2)}M`,
    units: v => nf.format(Math.round(v)),
    builders: v => nf.format(Math.round(v)),
    progress: v => `${v.toFixed(2)}%`,
    avg: v => v.toFixed(1),
    toNext: naira,
    remaining: naira,
    remainingM: v => `₦${(v / 1e6).toFixed(2)}M`,
    bricksLeft: v => nf.format(Math.round(v)),
  };

  // duplicate ticker content for a seamless loop (before collecting bindings)
  const track = $('#tickerTrack');
  track.innerHTML += track.innerHTML;

  const bound = $$('[data-bind]');
  const widths = $$('[data-bind-width]');

  const setBound = (el, first) => {
    const key = el.dataset.bind;
    const f = FMT[key];
    if (!f) return;
    const to = vals()[key];
    const from = el._v ?? (first ? 0 : to);
    if (el._cancel) el._cancel();
    el._cancel = SIX.tween(from, to, first ? 1800 : 900, v => { el._v = v; el.textContent = f(v); });
  };
  const setTexts = () => {
    const v = vals();
    const t = {
      updated: S.updated ? WAT.format(S.updated) : '—',
      latest: recent[0] ? `BUILDER ${bid(recent[0].id)} +${nf.format(recent[0].units)} BRICK${recent[0].units === 1 ? '' : 'S'}` : `BE BUILDER ${bid(1)}`,
      nextLevel: v.progress >= 100 ? 'TARGET REACHED' : `₦${v.nextLevel / 1e6}M (${Math.round((v.nextLevel / CFG.target) * 100)}%)`,
    };
    $$('[data-bind-text]').forEach(el => { el.textContent = t[el.dataset.bindText]; });
  };
  const setWidth = el => {
    const p = Math.min(1, vals().progress / 100);
    el.style.setProperty('--p', p.toFixed(4));
    const bar = el.closest('[role=progressbar]');
    if (bar) bar.setAttribute('aria-valuenow', (p * 100).toFixed(2));
  };

  // initial values (before count-up) so nothing flashes as ₦0 in live mode
  bound.forEach(el => { const f = FMT[el.dataset.bind]; if (f) el.textContent = f(vals()[el.dataset.bind]); });
  SIX.on('ready', () => {
    bound.forEach(el => SIX.once(el, () => { el._seen = true; setBound(el, true); }, { threshold: 0 }));
    widths.forEach(el => SIX.once(el, () => { el._seen = true; setWidth(el); }, { threshold: 0 }));
  });
  setTexts();

  const nextId = () => S.builders + 1;
  function refresh() {
    const v = vals();
    bound.forEach(el => {
      if (!el._seen) { el.textContent = FMT[el.dataset.bind](v[el.dataset.bind]); return; }
      setBound(el, false);
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    });
    widths.forEach(el => el._seen && setWidth(el));
    setTexts();
    if (heroReady) heroB.setProgress(v.progress / 100);
    seqNow.style.left = `${Math.min(100, v.progress)}%`;
    $('#calcId').textContent = bid(nextId());
    $('#acqId').textContent = bid(nextId());
  }

  /* ---------- clock ---------- */
  const clocks = $$('[data-clock]');
  const tick = () => { const s = WAT.format(new Date()); clocks.forEach(c => { c.textContent = s; }); };
  tick();
  setInterval(tick, 1000);

  /* ======================================================================
     ISOMETRIC FACILITY MODEL (illustrative)
     Parts move through: planned (dashed outline) → built (solid) → lit.
     ====================================================================== */
  // Drawn from the facility render (assets/photos/facility.png): a long
  // three-storey block, hipped roof, four arched balcony bays per upper floor.
  const PARTS = [
    // [part, built at, lit at] — as fraction of the campaign target
    ['foundation', 0.02, 0.08],
    ['l0', 0.05, 0.28],
    ['l1', 0.25, 0.50],
    ['l2', 0.45, 0.72],
    ['roof', 0.65, 0.90],
    ['grounds', 0.80, 0.97],
  ];
  const BW = 14, BD = 6, FH = 1.75, Z0 = 0.25;      // building width, depth, floor height, plinth
  const ZE = Z0 + 3 * FH;                            // eaves
  const LABELS = {
    l0: { a: [0, BD, Z0 + 0.75], dx: -46, dy: 0, t: 'GROUND FLOOR' },
    l1: { a: [0, BD, Z0 + FH + 0.75], dx: -46, dy: 0, t: 'LEVEL 01' },
    l2: { a: [0, BD, Z0 + 2 * FH + 0.75], dx: -46, dy: 0, t: 'LEVEL 02' },
    roof: { a: [BW, BD / 2, ZE + 0.45], dx: 36, dy: -10, t: 'ROOF' },
    grounds: { a: [BW + 0.4, BD + 2.2, 0.35], dx: 36, dy: 14, t: 'GROUNDS' },
  };
  // which model parts each facility component lights up (config can override)
  const ZONES = Object.assign({
    house: ['l1', 'l2'], acorn: ['l0'], learning: ['l0'], collab: ['l0'], tech: ['roof'], community: ['grounds', 'foundation'],
  }, (CFG.facility && CFG.facility.zones) || {});

  function createBuilding(host, opts = {}) {
    const U = 20, C = Math.cos(Math.PI / 6);
    const r = rng(opts.seed || 7);
    let trk = true, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    const grow = (x, y) => { if (!trk) return; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    const P = (x, y, z) => { const sx = (x - y) * C * U, sy = (x + y) * 0.5 * U - z * U; grow(sx, sy); return [sx, sy]; };
    const f1 = n => n.toFixed(1);
    const pts = a => a.map(p => P(...p).map(f1).join(',')).join(' ');
    const buf = {};
    const add = (part, s) => (buf[part] ||= []).push(s);
    const poly = (part, cls, a, attr = '') => add(part, `<polygon class="${cls}" points="${pts(a)}"${attr}/>`);
    const line = (part, cls, a, b) => {
      const [x1, y1] = P(...a), [x2, y2] = P(...b);
      add(part, `<line class="${cls}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`);
    };
    const win = (part, a) => {
      const off = r() < 0.14;
      poly(part, off ? 'w off' : 'w', a, ` style="--wd:${Math.round(r() * 900)}ms;--wo:${(0.55 + r() * 0.45).toFixed(2)}"`);
    };
    function box(part, x, y, z, w, d, h, o, top = 'f-t') {
      poly(part, 'f f-l', [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]);
      poly(part, 'f f-r', [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]);
      poly(part, `f ${top}`, [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]);
      if (!o) return;
      const { cl, cr, rows = 1, px = 0.14, pt = 0.22, pb = 0.12 } = o;
      const rh = h / rows;
      for (let k = 0; k < rows; k++) {
        const z0 = z + k * rh + pb, z1 = z + (k + 1) * rh - pt;
        const cw = w / cl;
        for (let i = 0; i < cl; i++) { const a = x + i * cw + px, b = x + (i + 1) * cw - px; win(part, [[a, y + d, z0], [b, y + d, z0], [b, y + d, z1], [a, y + d, z1]]); }
        const cd = d / cr;
        for (let i = 0; i < cr; i++) { const a = y + i * cd + px, b = y + (i + 1) * cd - px; win(part, [[x + w, a, z0], [x + w, b, z0], [x + w, b, z1], [x + w, a, z1]]); }
      }
    }

    trk = false;
    for (let i = -4; i <= 18; i += 2) line('site', 'site', [i, -4, 0], [i, 13, 0]);
    for (let j = -4; j <= 13; j += 2) line('site', 'site', [-4, j, 0], [18, j, 0]);
    trk = true;

    const onFront = (x0, x1, z0, z1) => [[x0, BD, z0], [x1, BD, z0], [x1, BD, z1], [x0, BD, z1]];
    // arched opening on the front face (straight jambs, semicircular-ish head)
    const arch = (part, x0, x1, z0, z1, cls = 'w') => {
      const rw = (x1 - x0) / 2, cx = (x0 + x1) / 2, spring = z1 - Math.min(rw, (z1 - z0) * 0.45);
      const a = [[x0, BD, z0], [x1, BD, z0], [x1, BD, spring]];
      for (let k = 1; k < 8; k++) { const t = (k / 8) * Math.PI; a.push([cx + Math.cos(t) * rw, BD, spring + Math.sin(t) * (z1 - spring)]); }
      a.push([x0, BD, spring]);
      if (cls === 'w') win(part, a); else poly(part, cls, a);
    };
    // balcony railing standing just in front of the facade
    const railing = (part, x0, x1, z) => {
      const y = BD + 0.28, h = 0.55;
      poly(part, 'f f-t', [[x0, BD, z], [x1, BD, z], [x1, y, z], [x0, y, z]]);   // balcony slab
      line(part, 'ln', [x0, y, z + h], [x1, y, z + h]);
      line(part, 'ln', [x0, y, z + h * 0.5], [x1, y, z + h * 0.5]);
      for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 4) line(part, 'ln', [x, y, z], [x, y, z + h]);
    };

    // plinth + front forecourt
    box('foundation', -0.8, -0.6, 0, BW + 1.8, BD + 3.4, Z0, null, 'f-g');
    for (let x = 0.6; x < BW; x += 1.4) line('foundation', 'pv', [x, BD + 0.1, Z0], [x, BD + 2.7, Z0]);

    // ground floor: doors and windows, ledge (string course) above
    box('l0', 0, 0, Z0, BW, BD, FH);
    [[0.9, 1.7, 'd'], [2.3, 3.3, 'w'], [4.0, 4.8, 'd'], [5.1, 5.9, 'd'], [6.6, 7.8, 'w'], [8.6, 9.4, 'd'], [9.8, 10.6, 'd'], [11.2, 12.4, 'w']]
      .forEach(([a, b, t]) => win('l0', onFront(a, b, Z0 + 0.12, Z0 + (t === 'd' ? 1.2 : 1.1)).map((p, i) => (t === 'w' && i < 2 ? [p[0], p[1], Z0 + 0.45] : p))));
    // side wall: two small windows
    [[3.0, 3.7], [4.4, 5.1]].forEach(([a, b]) => win('l0', [[BW, a, Z0 + 0.35], [BW, b, Z0 + 0.35], [BW, b, Z0 + 1.1], [BW, a, Z0 + 1.1]]));
    box('l0', -0.12, -0.12, Z0 + FH - 0.08, BW + 0.24, BD + 0.24, 0.16);          // ledge

    // upper floors: four arched balcony bays each
    ['l1', 'l2'].forEach((part, k) => {
      const z = Z0 + (k + 1) * FH;
      box(part, 0, 0, z, BW, BD, FH);
      const bays = 4, m = 0.55, bw = (BW - 2 * m) / bays;
      for (let i = 0; i < bays; i++) {
        const x0 = m + i * bw + 0.14, x1 = m + (i + 1) * bw - 0.14;
        arch(part, x0, x1, z + 0.05, z + FH - 0.12, 'f f-g arch');            // recess
        win(part, onFront(x0 + 0.25, x0 + 0.95, z + 0.12, z + 1.08));            // door
        win(part, onFront(x0 + 1.25, x1 - 0.25, z + 0.4, z + 1.08));             // window
        railing(part, x0, x1, z + 0.02);
      }
    });

    // hipped roof with overhanging eaves
    {
      const o = 0.5, rh = 0.62, x0 = -o, x1 = BW + o, y0 = -o, y1 = BD + o, ym = BD / 2, hr = BD / 2 + o;
      const rl = [x0 + hr, ym, ZE + rh], rr = [x1 - hr, ym, ZE + rh];
      poly('roof', 'f f-t rf', [[x0, y0, ZE], [x1, y0, ZE], rr, rl]);                 // back slope
      poly('roof', 'f f-t rf', [[x0, y0, ZE], rl, [x0, y1, ZE]]);                      // left hip
      poly('roof', 'f f-l rf', [[x0, y1, ZE], [x1, y1, ZE], rr, rl]);                 // front slope
      poly('roof', 'f f-r rf', [[x1, y0, ZE], [x1, y1, ZE], rr]);                      // right hip
      line('roof', 'ln', rl, rr);
      poly('roof', 'f f-l', [[x0, y1, ZE - 0.12], [x1, y1, ZE - 0.12], [x1, y1, ZE], [x0, y1, ZE]]);   // fascia
      poly('roof', 'f f-r', [[x1, y0, ZE - 0.12], [x1, y1, ZE - 0.12], [x1, y1, ZE], [x1, y0, ZE]]);
    }

    // grounds: entrance steps, shrubs along the front, palm at the corner
    [[0.8, 2.0], [3.9, 6.0], [8.5, 10.7]].forEach(([a, b]) => {
      box('grounds', a, BD, Z0, b - a, 0.35, 0.12, null);
      box('grounds', a + 0.1, BD + 0.35, Z0, b - a - 0.2, 0.3, 0.06, null);
    });
    const shrubs = [];
    for (let x = 0.3; x < BW; x += 0.75) if (!((x > 0.7 && x < 2.1) || (x > 3.8 && x < 6.1) || (x > 8.4 && x < 10.8))) shrubs.push([x, BD + 0.85]);
    [[BW + 0.5, BD - 0.5], [BW + 0.6, BD + 0.9]].forEach(s => shrubs.push(s));
    shrubs.sort((a, b) => a[0] + a[1] - (b[0] + b[1])).forEach(([x, y]) => {
      const [cx, cy] = P(x, y, Z0 + 0.3);
      add('grounds', `<circle class="tree" cx="${f1(cx)}" cy="${f1(cy)}" r="${(5 + r() * 2.5).toFixed(1)}" style="--wd:${Math.round(r() * 700)}ms"/>`);
    });
    {
      const px = BW - 1.4, py = BD + 1.9, top = ZE + 0.9;
      line('grounds', 'ln', [px, py, Z0], [px + 0.25, py, top]);
      for (let k = 0; k < 11; k++) {
        const t = (k / 11) * Math.PI * 2, len = 1.6 + r() * 0.7;
        const tip = [px + 0.25 + Math.cos(t) * len, py + Math.sin(t) * len, top - 0.4 - r() * 0.6];
        const mid = [px + 0.25 + Math.cos(t) * len * 0.5, py + Math.sin(t) * len * 0.5, top + 0.15];
        line('grounds', 'ln', [px + 0.25, py, top], mid);
        line('grounds', 'ln', mid, tip);
      }
    }

    let labels = '';
    if (opts.labels) {
      Object.entries(LABELS).forEach(([k, L]) => {
        const [ax, ay] = P(...L.a);
        const lx = ax + L.dx, ly = ay + L.dy;
        const left = L.dx < 0;
        const tw = L.t.length * 6.4;
        grow(left ? lx - 4 - tw : lx + 4 + tw, ly);
        labels += `<g class="lbl" data-for="${k}"><line x1="${f1(ax)}" y1="${f1(ay)}" x2="${f1(lx)}" y2="${f1(ly)}"/><circle cx="${f1(ax)}" cy="${f1(ay)}" r="2"/><text x="${f1(left ? lx - 4 : lx + 4)}" y="${f1(ly + 3)}" text-anchor="${left ? 'end' : 'start'}">${L.t}</text></g>`;
      });
    }

    const pad = 18;
    const vb = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2].map(f1).join(' ');
    let html = `<svg class="bld" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Illustrative model of the planned Smartan House facility">`;
    html += `<g>${buf.site.join('')}</g>`;
    PARTS.forEach(([k]) => { html += `<g class="bp bp--${k}" data-part="${k}">${(buf[k] || []).join('')}</g>`; });
    html += labels + '</svg>';
    host.innerHTML = html;

    const svg = host.firstElementChild;
    const groups = {};
    $$('.bp', svg).forEach(g => { groups[g.dataset.part] = g; });
    const api = {
      setProgress(p) {
        PARTS.forEach(([k, b, l]) => {
          const g = groups[k];
          const st = p >= l ? 2 : p >= b ? 1 : 0;
          if (g._st === st) return;
          g._st = st;
          g.classList.toggle('is-built', st >= 1);
          g.classList.toggle('is-lit', st === 2);
        });
      },
      // parts: a model part name, or an array of them
      highlight(parts) {
        const on = [].concat(parts || []);
        svg.classList.toggle('has-hl', on.length > 0);
        Object.entries(groups).forEach(([n, g]) => g.classList.toggle('is-hl', on.includes(n)));
        $$('.lbl', svg).forEach(l => l.classList.toggle('is-on', on.includes(l.dataset.for)));
      },
    };
    api.setProgress(0);
    return api;
  }

  /* ----------------------------------------------------------------------
     THE FACILITY PICTURE as the model
     mode 'full'  — always in full colour (hero)
     mode 'build' — grey "planned" picture; colour rises from the ground up
                    with funding (The Build)
     mode 'hl'    — full colour; highlight() shows one floor in colour and
                    greys the rest (The Facility)
     Same API as createBuilding: setProgress(p), highlight(parts).
     ---------------------------------------------------------------------- */
  const MODEL = (CFG.facility && CFG.facility.model) || {};
  function createImageBuilding(host, opts = {}) {
    const mode = opts.mode || 'build';
    const W = MODEL.width || 100, H = MODEL.height || 100;
    const parts = MODEL.parts || {};
    const order = ['grounds', 'foundation', 'l0', 'l1', 'l2', 'roof'];      // bottom of the stack first
    const pct = pts => pts.map(([x, y]) => `${(x / W * 100).toFixed(2)}% ${(y / H * 100).toFixed(2)}%`).join(', ');
    host.classList.add('is-img');
    host.style.aspectRatio = `${W} / ${H}`;
    const layers = order.map(k => {
      const clip = parts[k] ? `clip-path: polygon(${pct(parts[k])});` : '';
      return `<img class="bimg__part" data-part="${k}" src="${esc(MODEL.image)}" alt="" aria-hidden="true" decoding="async" style="${clip}">`;
    }).join('');
    const outlines = order.filter(k => parts[k]).map(k => `<polygon data-for="${k}" points="${parts[k].map(p => p.join(',')).join(' ')}"/>`).join('');
    host.innerHTML = `
      <div class="bimg bimg--${mode}" role="img" aria-label="${esc(MODEL.alt || '')}">
        <img class="bimg__ghost" src="${esc(MODEL.image)}" alt="" aria-hidden="true" decoding="async">
        ${layers}
        <svg class="bimg__lines" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${outlines}</svg>
        <span class="bimg__tag mono" hidden></span>
      </div>`;
    const root = $('.bimg', host), tag = $('.bimg__tag', root);
    const layer = {}; $$('.bimg__part', root).forEach(el => { layer[el.dataset.part] = el; });
    const line = {}; $$('.bimg__lines polygon', root).forEach(el => { line[el.dataset.for] = el; });
    const set = (k, st) => {
      const el = layer[k]; if (!el || el._st === st) return;
      el._st = st;
      el.classList.toggle('is-built', st >= 1);
      el.classList.toggle('is-lit', st === 2);
      if (line[k]) line[k].classList.toggle('is-planned', st === 0);
    };
    let highlighted = false, last = 0;
    const api = {
      setProgress(p) {
        last = p;
        if (mode !== 'build' || highlighted) return;
        PARTS.forEach(([k, b, l]) => set(k, p >= l ? 2 : p >= b ? 1 : 0));
      },
      highlight(ps) {
        const on = [].concat(ps || []).filter(k => layer[k]);
        highlighted = on.length > 0;
        root.classList.toggle('is-hl', highlighted);
        order.forEach(k => {
          const el = layer[k];
          el.classList.toggle('is-on', !highlighted || on.includes(k));
          if (line[k]) line[k].classList.toggle('is-planned', highlighted && !on.includes(k));
        });
        if (!highlighted) { tag.hidden = true; return; }
        const top = Math.min(...on.map(k => Math.min(...(parts[k] || [[0, 0]]).map(p => p[1]))));
        tag.hidden = false;
        tag.style.top = `${(top / H * 100).toFixed(2)}%`;
        tag.textContent = on.map(k => (MODEL.labels && MODEL.labels[k]) || k).join(' + ');
      },
    };
    if (mode === 'build') { order.forEach(k => set(k, 0)); api.setProgress(0); }
    return api;
  }
  // the real picture when configured; the line drawing as a fallback
  const makeModel = (host, opts) => (MODEL.image ? createImageBuilding(host, opts) : createBuilding(host, opts));

  /* ---------- hero model ---------- */
  const heroB = makeModel($('#heroBuilding'), { seed: 3, mode: 'full' });
  let heroReady = false;
  SIX.on('ready', () => {
    setTimeout(() => {
      SIX.tween(0, Math.min(1, vals().progress / 100), 2600, p => heroB.setProgress(p), t => t);
      setTimeout(() => { heroReady = true; heroB.setProgress(vals().progress / 100); }, 2700);
    }, 500);
  });

  /* ---------- the build: scroll-driven funding levels ---------- */
  const seqSec = $('#build');
  const seqB = createBuilding($('#seqBuilding'), { seed: 11 });
  const seqPct = $('#seqPct'), seqAmt = $('#seqAmt'), seqFill = $('#seqFill'), seqNow = $('#seqNow');
  const seqStages = $$('.seq__stages li');
  seqNow.style.left = `${Math.min(100, vals().progress)}%`;
  let seqLast = -1;
  SIX.onScroll((y, h) => {
    const r = seqSec.getBoundingClientRect();
    if (r.bottom < -h || r.top > h * 2) return;
    const q = clamp((SIX.sceneProgress(seqSec, h) - 0.04) / 0.88);
    if (Math.abs(q - seqLast) < 0.0005) return;
    seqLast = q;
    seqB.setProgress(q);
    seqPct.textContent = `${(q * 100).toFixed(2)}%`;
    seqAmt.textContent = q >= 0.999 ? 'FACILITY READY' : naira(q * CFG.target);
    seqFill.style.transform = `scaleX(${q.toFixed(4)})`;
    const st = Math.min(3, Math.floor(q * 4));
    seqStages.forEach((li, i) => {
      li.classList.toggle('is-done', i < st);
      li.classList.toggle('is-active', i === st);
    });
  });

  /* ---------- facility: model + components ---------- */
  const facB = createBuilding($('#facBuilding'), { seed: 5, labels: true });
  const facLabel = $('#facLabel');
  const facItems = $$('.fac-item');
  const setFac = btn => {
    facItems.forEach(b => b.classList.toggle('is-active', b === btn));
    facB.highlight(ZONES[btn.dataset.part] || []);
    const n = btn.querySelector('.mono').textContent;
    facLabel.textContent = `${n} — ${btn.querySelector('.fac-item__name').textContent.toUpperCase()}`;
  };
  facItems.forEach(b => {
    b.addEventListener('mouseenter', () => setFac(b));
    b.addEventListener('focus', () => setFac(b));
    b.addEventListener('click', () => setFac(b));
  });
  SIX.once($('#facBuilding'), () => {
    SIX.tween(0, 1, 1800, p => facB.setProgress(p), t => t);
    setTimeout(() => setFac(facItems[0]), 1900);
  }, { threshold: 0.3 });

  // confirmed specifications (hidden until provided)
  (() => {
    const specs = (CFG.facility && CFG.facility.specs) || [];
    if (!specs.length) return;
    const el = $('#facSpecs');
    el.innerHTML = specs.map(s => `<div><dd>${esc(s.value)}</dd><dt>${esc(s.label)}</dt></div>`).join('');
    el.hidden = false;
  })();

  // photo slots: real image when provided, otherwise the labelled placeholder stays
  // (set a photo's `hide: true` in config.js to remove a slot entirely)
  (() => {
    const photos = CFG.photos || {};
    $$('[data-photo]').forEach(fig => {
      const p = photos[fig.dataset.photo];
      if (p && p.src) {
        const frame = $('.ph__frame', fig);
        frame.innerHTML = `<img src="${esc(p.src)}" alt="${esc(p.alt || '')}" loading="lazy" decoding="async">`;
        fig.classList.add('has-img');
        // fit: 'contain' shows the whole image (e.g. a render) instead of cropping to the frame
        if (p.fit === 'contain') { fig.classList.add('ph--contain'); frame.style.aspectRatio = '16 / 11'; }
        if (p.bg) frame.style.background = p.bg;
        const cap = $('[data-cap]', fig);
        if (p.caption) cap.textContent = p.caption; else $('.ph__cap', fig).hidden = true;
      } else if (p && p.hide) {
        fig.hidden = true;
      }
    });
    // hide a whole group when none of its photos are shown
    $$('[data-photo-group]').forEach(g => {
      if ($$('[data-photo]', g).every(f => f.hidden)) g.hidden = true;
    });
  })();

  /* ---------- verified milestones ---------- */
  (() => {
    const ms = D.milestones || [];
    const done = ms.filter(m => m.status === 'complete').length;
    const cur = ms.findIndex(m => m.status !== 'complete');
    const status = m => (m.status === 'complete'
      ? `✓ VERIFIED${m.verifiedOn ? ` ${fmtDate(m.verifiedOn)}` : ''}`
      : m.status === 'in-progress' ? 'IN PROGRESS' : 'UPCOMING');
    $('#mtrack').innerHTML = ms.map((m, i) => `
      <li class="ms ms--${esc(m.status)}">
        <i class="ms__dot"></i>
        <span class="ms__n mono">${String(i + 1).padStart(2, '0')}</span>
        <b class="ms__label">${esc(m.label)}</b>
        <span class="ms__st mono">${status(m)}</span>
      </li>`).join('');
    $('#mtrackNote').textContent = `${String(done).padStart(2, '0')} OF ${String(ms.length).padStart(2, '0')} MILESTONES VERIFIED`;
    const active = ms.some(m => m.status !== 'upcoming');
    if ($('#heroMilestone')) $('#heroMilestone').textContent = active && cur >= 0 ? `MILESTONE ${String(cur + 1).padStart(2, '0')} / ${String(ms.length).padStart(2, '0')}` : 'ILLUSTRATIVE MODEL';
  })();

  /* ---------- what ₦200M builds ---------- */
  (() => {
    const alloc = D.allocation || [];
    const known = alloc.filter(a => a.amount != null);
    const shades = ['var(--accent)', 'rgba(var(--accent-rgb),.72)', 'rgba(var(--accent-rgb),.5)', 'rgba(var(--accent-rgb),.32)', 'rgba(var(--fg-rgb),.45)', 'rgba(var(--fg-rgb),.22)'];
    const bar = $('#allocBar');
    if (known.length) {
      bar.innerHTML = alloc.map((a, i) => (a.amount ? `<i style="flex:${a.amount};background:${shades[i % shades.length]};--d:${i * 110}ms" title="${esc(a.label)}: ${pct(a.amount, CFG.target)}"></i>` : '')).join('');
    } else {
      bar.classList.add('alloc__bar--empty');
      bar.innerHTML = '<span class="mono">AWAITING APPROVED BUDGET</span>';
    }
    $('#allocRows').innerHTML = alloc.map((a, i) => `
      <li class="arow">
        <i class="arow__sw" style="background:${a.amount != null ? shades[i % shades.length] : 'transparent'}"></i>
        <div class="arow__what"><b>${esc(a.label)}</b><span>${esc(a.note || '')}</span></div>
        <span class="arow__pct mono">${a.amount != null ? pct(a.amount, CFG.target) : '—'}</span>
        <span class="arow__amt mono">${a.amount != null ? naira(a.amount) : 'TBC'}</span>
      </li>`).join('');
    $('#allocNote').textContent = known.length === alloc.length && alloc.length
      ? 'PER SMARTAN’S APPROVED PROJECT BUDGET.'
      : 'FIGURES WILL BE PUBLISHED WITH SMARTAN’S APPROVED PROJECT BUDGET.';
    SIX.once(bar, () => bar.classList.add('is-in'), { threshold: 0.4 });
  })();

  /* ======================================================================
     LIVE CAMPAIGN PROGRESS — terminal
     ====================================================================== */
  const feedEl = $('#feed');
  const feedRow = (b, isNew) => `
    <li class="feed__row${isNew ? ' is-new' : ''}" data-ts="${b.ts}">
      <span class="feed__id">BUILDER ${bid(b.id)}</span>
      <span class="feed__amt">${naira(b.units * CFG.unitPrice)}</span>
      <span class="feed__act">Laid <b>${nf.format(b.units)}</b> brick${b.units === 1 ? '' : 's'}</span>
      <span class="feed__time">${ago(b.ts)}</span>
    </li>`;
  const feedEmpty = () => `<li class="empty"><b>The first Builder will appear here.</b><span>Every contribution shows up the moment it's verified.</span><button class="btn btn--primary btn--sm" data-acquire>Be Builder ${bid(1)}</button></li>`;
  feedEl.innerHTML = recent.length ? recent.slice(0, 7).map(b => feedRow(b)).join('') : feedEmpty();
  const pushFeed = b => {
    const empty = $('.empty', feedEl);
    if (empty) empty.remove();
    feedEl.insertAdjacentHTML('afterbegin', feedRow(b, true));
    const row = feedEl.firstElementChild;
    setTimeout(() => row.classList.remove('is-new'), 5000);
    while (feedEl.children.length > 7) feedEl.lastElementChild.remove();
  };

  // daily units
  const barsEl = $('#flowBars');
  const flow = [...(D.daily || [])];
  let flowMax = Math.max(1, ...flow) * 1.12;
  if (flow.length) {
    barsEl.innerHTML = flow.map((v, i) => `<i style="--h:${(v / flowMax).toFixed(3)};--d:${i * 22}ms" title="${nf.format(v)} bricks"></i>`).join('');
    const today = new Date();
    const d0 = new Date(today); d0.setDate(today.getDate() - (flow.length - 1));
    const d1 = new Date(today); d1.setDate(today.getDate() - Math.floor((flow.length - 1) / 2));
    const spans = $$('#flowAxis span');
    spans[0].textContent = dayLabel(d0);
    spans[1].textContent = dayLabel(d1);
  } else {
    barsEl.classList.add('bars--empty');
    barsEl.innerHTML = '<p class="mono">DAILY ACTIVITY APPEARS AFTER THE CAMPAIGN’S FIRST FULL DAY.</p>';
    $('#flowAxis').hidden = true;
  }
  SIX.once(barsEl, () => barsEl.classList.add('is-in'), { threshold: 0.3 });
  const bumpFlow = units => {
    if (!flow.length) return;
    flow[flow.length - 1] += units;
    const bar = barsEl.lastElementChild;
    bar.style.setProperty('--h', Math.min(1, flow[flow.length - 1] / flowMax).toFixed(3));
    bar.title = `${nf.format(flow[flow.length - 1])} bricks`;
  };

  // mobile tabs / swipe
  (() => {
    const panels = $('#termPanels');
    const tabs = $$('#termTabs button');
    const dots = $$('#termDots i');
    const setActive = i => {
      tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i)));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
    };
    tabs.forEach(t => t.addEventListener('click', () => {
      const i = Number(t.dataset.panel);
      panels.scrollTo({ left: i * panels.clientWidth, behavior: SIX.reduced ? 'auto' : 'smooth' });
      setActive(i);
    }));
    panels.addEventListener('scroll', () => {
      if (!panels.clientWidth) return;
      setActive(Math.round(panels.scrollLeft / panels.clientWidth));
    }, { passive: true });
  })();

  /* ---------- Impact Index — project milestone progress ---------- */
  (() => {
    const rows = D.index || [];
    const withValue = rows.filter(x => x.value != null);
    $('#ixRows').innerHTML = rows.map(x => `
      <div class="ix__row" role="row">
        <span class="ix__name" role="cell">${esc(x.label)}</span>
        <span class="ix__comp" role="cell">${x.value != null
          ? `<span class="pbar"><i style="--p:${x.value / 100}"></i></span><b class="mono">${(+x.value).toFixed(0)}%</b>`
          : '<span class="pbar pbar--empty"></span><b class="mono dim">—</b>'}</span>
        <span class="ix__when mono r" role="cell">${x.verifiedOn ? fmtDate(x.verifiedOn) : 'AWAITING'}</span>
      </div>`).join('');
    $('#ixComposite').textContent = withValue.length
      ? `${(withValue.reduce((s, x) => s + +x.value, 0) / withValue.length).toFixed(0)}%`
      : '—';
  })();

  /* ======================================================================
     PARTICIPATE — Impact Units calculator
     ====================================================================== */
  const range = $('#calcRange');
  const setCalc = u => {
    u = clamp(Math.round(u) || 1, 1, Number(range.max));
    range.value = u;
    range.style.setProperty('--fill', `${((u - 1) / (Number(range.max) - 1)) * 100}%`);
    $('#calcUnits').textContent = nf.format(u);
    $('#calcNaira').textContent = naira(u * CFG.unitPrice);
    $('#calcShare').textContent = share(u);
    $('#calcCta').dataset.units = u;
  };
  range.addEventListener('input', () => setCalc(Number(range.value)));
  setCalc(25);
  $$('.tier').forEach(t => { const s = $('.tier__s', t); if (s) s.textContent = `${share(Number(t.dataset.units))} OF TARGET`; });
  $$('[data-total-bricks]').forEach(el => { el.textContent = nf.format(CFG.target / CFG.unitPrice); });
  $('#calcId').textContent = bid(nextId());

  /* ======================================================================
     THE BUILDERS — wall + dot field
     ====================================================================== */
  const wallEl = $('#wall');
  const cellHTML = (b, isNew) => `
    <div class="wcell__in">
      <div class="wcell__top mono"><span>${bid(b.id)}</span><span class="wcell__tag">${isNew ? 'NEW' : 'BUILDER'}</span></div>
      <div class="wcell__name">${b.name ? esc(b.name).toUpperCase() : `BUILDER ${bid(b.id)}`}</div>
      <div class="wcell__loc">${b.name ? esc(b.city || '') : 'Anonymous'}</div>
      <div class="wcell__units mono"><b>${nf.format(b.units)}</b>BRICK${b.units === 1 ? '' : 'S'} LAID</div>
      <span class="wcell__when" data-ts="${b.ts}">${ago(b.ts).toUpperCase()}</span>
    </div>`;
  const wallEmpty = () => `
    <div class="wall__empty">
      <span class="mono">${bid(1)}</span>
      <b>The first place on the wall is waiting.</b>
      <p>Every Builder appears here — by name, or anonymously if you prefer.</p>
      <button class="btn btn--primary btn--lg" data-acquire>Become Builder ${bid(1)} <span class="arr">→</span></button>
    </div>`;
  if (recent.length) {
    wallEl.innerHTML = recent.slice(0, 24).map(b => `<div class="wcell${b.name ? '' : ' is-anon'}">${cellHTML(b)}</div>`).join('');
  } else {
    wallEl.classList.add('is-empty');
    wallEl.innerHTML = wallEmpty();
  }
  SIX.on('ready', () => {
    $$('.wcell', wallEl).forEach((c, i) => {
      c.setAttribute('data-reveal', '');
      c.style.setProperty('--d', `${(i % 6) * 60 + Math.floor(i / 6) * 60}ms`);
      SIX.once(c, () => c.classList.add('is-in'), { threshold: 0 });
    });
  });
  const pushWall = b => {
    if (wallEl.classList.contains('is-empty')) { wallEl.classList.remove('is-empty'); wallEl.innerHTML = ''; }
    const cells = $$('.wcell', wallEl);
    if (cells.length < 24) {
      wallEl.insertAdjacentHTML('afterbegin', `<div class="wcell is-in${b.name ? '' : ' is-anon'} is-new">${cellHTML(b, true)}</div>`);
      const cell = wallEl.firstElementChild;
      setTimeout(() => { cell.classList.remove('is-new'); const tag = $('.wcell__tag', cell); if (tag) tag.textContent = 'BUILDER'; }, 6000);
      return;
    }
    // replace the oldest visible entry so the wall always shows the most recent Builders
    const visible = cells.filter(c => c.offsetParent !== null);
    if (!visible.length) return;
    const idOf = c => Number(c.querySelector('.wcell__top span').textContent.slice(1));
    const cell = visible.reduce((a, c) => (idOf(c) < idOf(a) ? c : a));
    cell.className = `wcell is-in${b.name ? '' : ' is-anon'} is-new`;
    cell.innerHTML = cellHTML(b, true);
    setTimeout(() => {
      cell.classList.remove('is-new');
      const tag = $('.wcell__tag', cell);
      if (tag) tag.textContent = 'BUILDER';
    }, 6000);
  };

  // dot field — each lit dot is one Builder
  const dots = (() => {
    const cv = $('#dotsCanvas');
    const ctx = cv.getContext('2d');
    let order = [], cols = 0, rows = 0, gap = 9, pulses = [], raf = 0;
    function layout() {
      const W = cv.clientWidth || cv.parentElement.clientWidth;
      gap = W < 640 ? 7 : 9;
      cols = Math.max(10, Math.floor(W / gap));
      const total = Math.max(2000, Math.round(S.builders * 1.6));
      rows = Math.ceil(total / cols);
      const H = rows * gap;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.style.height = `${H}px`;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = rng(1284);
      order = [];
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) order.push({ x: c * gap + gap / 2, y: rr * gap + gap / 2, k: c + r() * 7 });
      order.sort((a, b) => a.k - b.k);
      draw();
    }
    function draw(now = performance.now()) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const n = S.builders;
      order.forEach((d, i) => {
        const lit = i < n;
        const fresh = lit && i >= n - 14;
        ctx.fillStyle = fresh ? `rgb(${COLOR.fg})` : lit ? `rgba(${COLOR.accent},.9)` : `rgba(${COLOR.fg},${SIX.theme() === 'light' ? 0.2 : 0.09})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, lit ? 1.5 : 1, 0, Math.PI * 2);
        ctx.fill();
      });
      pulses = pulses.filter(p => now - p.t < 1400);
      pulses.forEach(p => {
        const t = (now - p.t) / 1400;
        ctx.strokeStyle = `rgba(${COLOR.accent},${(1 - t).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + t * 18, 0, Math.PI * 2);
        ctx.stroke();
      });
      if (pulses.length) raf = requestAnimationFrame(draw);
    }
    layout();
    onResizeWidth(layout);
    document.addEventListener('six:theme', () => draw());
    return {
      add() {
        const d = order[S.builders - 1];
        if (!d) { layout(); return; }
        pulses.push({ x: d.x, y: d.y, t: performance.now() });
        cancelAnimationFrame(raf);
        draw();
      },
    };
  })();

  // brick wall — the facility rising, brick by brick
  const bricks = (() => {
    const cv = $('#brickCanvas');
    if (!cv) return { add() {} };
    const ctx = cv.getContext('2d');
    const TOTAL = Math.round(CFG.target / CFG.unitPrice);
    let cols = 0, rows = 0, bw = 16, bh = 8, gap = 2, scale = 1, cells = 0, W = 0, H = 0;
    let drops = [], raf = 0, seenOnce = false, shownLaid = 0;
    const laidReal = () => Math.round(S.raised / CFG.unitPrice);
    function layout() {
      W = cv.clientWidth || cv.parentElement.clientWidth;
      const small = W < 640;
      bw = small ? 12 : 18; bh = small ? 6 : 8; gap = 2;
      cols = Math.max(8, Math.floor((W + gap) / (bw + gap)));
      bw = (W + gap) / cols - gap;                    // fill the width exactly
      const maxRows = small ? 44 : 34;
      scale = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => Math.ceil(TOTAL / s / cols) <= maxRows) || 1000;
      cells = Math.ceil(TOTAL / scale);
      rows = Math.ceil(cells / cols);
      H = rows * (bh + gap) - gap;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.style.height = `${H}px`;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      $('#brickScale').textContent = scale === 1 ? 'EACH BRICK = ₦10,000' : `EACH BRICK SHOWN = ${scale} BRICKS`;
      draw();
    }
    // running bond, laid from the bottom row up
    const pos = i => {
      const r = Math.floor(i / cols), k = i % cols;
      const off = r % 2 ? (bw + gap) / 2 : 0;
      return { x: k * (bw + gap) - off, y: H - (r + 1) * (bh + gap) + gap };
    };
    function draw(now = performance.now()) {
      ctx.clearRect(0, 0, W, H);
      const light = SIX.theme() === 'light';
      const filled = shownLaid / scale;
      const full = Math.floor(filled), part = filled - full;
      drops = drops.filter(d => now - d.t < 700);
      const dropping = new Map(drops.map(d => [d.i, d]));
      for (let i = 0; i < cells; i++) {
        let { x, y } = pos(i);
        // the half-offset rows spill a half-brick at the left edge: draw it clipped
        const w = x < 0 ? bw + x : Math.min(bw, W - x);
        if (x < 0) x = 0;
        if (w <= 0) continue;
        if (i < full) {
          const d = dropping.get(i);
          let dy = 0, a = 1;
          if (d) { const t = Math.min(1, (now - d.t) / 700); dy = -(1 - t) * (1 - t) * 26; a = 0.3 + t * 0.7; }
          ctx.fillStyle = d ? `rgba(${COLOR.fg},${a.toFixed(2)})` : `rgba(${COLOR.accent},${(0.72 + ((i * 7919) % 29) / 100).toFixed(2)})`;
          ctx.fillRect(x, y + dy, w, bh);
        } else {
          ctx.strokeStyle = `rgba(${COLOR.fg},${light ? 0.2 : 0.1})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, bh - 1);
          if (i === full && part > 0) {
            ctx.fillStyle = `rgba(${COLOR.accent},.55)`;
            ctx.fillRect(x, y, w * part, bh);
          }
        }
      }
      if (drops.length) raf = requestAnimationFrame(draw);
    }
    const animateTo = target => {
      const from = shownLaid;
      const fromCell = Math.floor(from / scale), toCell = Math.floor(target / scale);
      const n = toCell - fromCell;
      if (n <= 0) { shownLaid = target; draw(); return; }
      // lay bricks one at a time (capped so a big contribution still finishes quickly)
      const step = Math.max(1, Math.ceil(n / 60));
      let cell = fromCell;
      const tick = () => {
        cell = Math.min(toCell, cell + step);
        for (let i = cell - step; i < cell; i++) if (i >= 0) drops.push({ i, t: performance.now() });
        shownLaid = cell >= toCell ? target : cell * scale;
        cancelAnimationFrame(raf); draw();
        if (cell < toCell) setTimeout(tick, 28);
      };
      tick();
    };
    layout();
    onResizeWidth(layout);
    document.addEventListener('six:theme', () => draw());
    // build the wall up to today's total the first time it's seen
    SIX.on('ready', () => SIX.once(cv, () => {
      seenOnce = true;
      if (SIX.reduced) { shownLaid = laidReal(); draw(); return; }
      const target = laidReal();
      const t0 = performance.now(), dur = 1800;
      const grow = now => {
        const p = Math.min(1, (now - t0) / dur);
        shownLaid = Math.round(target * (1 - Math.pow(1 - p, 3)));
        draw(now);
        if (p < 1) requestAnimationFrame(grow);
      };
      requestAnimationFrame(grow);
    }, { threshold: 0.25 }));
    return {
      add() { if (seenOnce) animateTo(laidReal()); },
    };
  })();

  // keep relative times fresh
  setInterval(() => {
    $$('.feed__row', feedEl).forEach(r => { $('.feed__time', r).textContent = ago(Number(r.dataset.ts)); });
    $$('.wcell__when', wallEl).forEach(s => { s.textContent = ago(Number(s.dataset.ts)).toUpperCase(); });
  }, 20000);

  /* ======================================================================
     TRANSPARENCY
     ====================================================================== */
  (() => {
    const list = $('#ledgerRows');
    const ledger = D.ledger || [];
    const more = $('#ledgerMore');
    if (ledger.length) {
      list.innerHTML = ledger.map(x => `
        <li class="lrow" data-cat="${esc(x.category)}">
          <span class="lrow__date">${fmtDate(x.date)}</span>
          <span class="lrow__ref">${esc(x.ref)}</span>
          <span class="lrow__what"><b>${esc(x.label || labelFor(x.category))}</b><span>${esc(x.detail)}</span>${x.source ? `<span class="lrow__src">SOURCE ${esc(x.source)}</span>` : ''}</span>
          <span class="lrow__amt r">${naira(x.amount)}</span>
          <span class="lrow__status r"><span class="vbadge">VERIFIED</span></span>
        </li>`).join('');
      const cats = [...new Set(ledger.map(x => x.category))];
      $('#lFilters').innerHTML = ['all', ...cats].map((c, i) => `<button class="${i ? '' : 'is-on'}" data-cat="${esc(c)}">${c === 'all' ? 'All' : esc(labelFor(c))}</button>`).join('');
      $$('#lFilters button').forEach(btn => btn.addEventListener('click', () => {
        $$('#lFilters button').forEach(b => b.classList.toggle('is-on', b === btn));
        if (btn.dataset.cat !== 'all' && list.classList.contains('is-collapsed')) more.click();
        let k = 0;
        $$('.lrow', list).forEach(row => {
          const show = btn.dataset.cat === 'all' || row.dataset.cat === btn.dataset.cat;
          row.classList.toggle('is-hidden', !show);
          row.classList.remove('is-enter');
          if (show) { void row.offsetWidth; row.style.setProperty('--d', `${k++ * 50}ms`); row.classList.add('is-enter'); }
        });
      }));
      if (ledger.length <= 5) more.hidden = true;
      more.addEventListener('click', () => {
        const open = list.classList.toggle('is-collapsed') === false;
        more.setAttribute('aria-expanded', String(open));
        $('.ltable__cta-t', more).textContent = open ? 'Collapse ledger' : 'View transparency ledger';
        $('.arr', more).textContent = open ? '↑' : '→';
      });
    } else {
      list.innerHTML = '<li class="lrow lrow--empty"><b>No entries yet.</b><span>The first verified allocation will be published here, with its date, reference and amount.</span></li>';
      more.hidden = true;
      $('.lrow--h').hidden = true;
    }

    const money = (id, v) => {
      if (v == null) { $(`#${id}`).textContent = '—'; $(`#${id}Note`).textContent = 'PUBLISHED ONCE VERIFIED'; return; }
      $(`#${id}`).textContent = naira(v);
      $(`#${id}Note`).textContent = `${pct(v, S.raised)} OF RAISED`;
    };
    money('lsAllocated', D.allocated);
    money('lsSpent', D.spent);

    const ups = D.updates || [];
    $('#updates').innerHTML = ups.length
      ? ups.map((u, i) => `<li><span>${fmtDate(u.date)}</span><p><b>${esc(u.title)}.</b> ${esc(u.body || '')}</p></li>`).join('')
      : '<li class="empty-line"><p>Verified campaign updates will be published here.</p></li>';
  })();

  /* ======================================================================
     CONTRIBUTION FLOW — amount → details → payment → Builder
     No account, ever.
     ====================================================================== */
  const dlg = $('#acquire');
  const order = { units: 10, name: '', email: '', phone: '', city: '', display: 'name' };
  let step = 1;
  let receipt = null;

  const stepEls = $$('.acq__step', dlg);
  const stepDots = $$('#acqSteps li');
  const noticeOf = n => $('[data-notice]', stepEls[n - 1]);
  const goto = n => {
    step = n;
    stepEls.forEach(el => { el.hidden = Number(el.dataset.step) !== n; });
    stepDots.forEach((li, i) => { li.classList.toggle('is-on', i + 1 === n); li.classList.toggle('is-done', i + 1 < n); });
    stepEls.forEach(el => { const nt = $('[data-notice]', el); if (nt) nt.textContent = ''; });
    const first = $('input:not([type=hidden]), button[type=submit]', stepEls[n - 1]);
    if (first && n !== 4) first.focus({ preventScroll: true });
    $('.acq__panel', dlg).scrollTop = 0;
  };

  // step 1
  const unitsIn = $('#acqUnits');
  const chips = $$('#acqChips button');
  const setUnits = u => {
    u = Math.max(0, Math.floor(Number(u) || 0));
    order.units = u;
    if (String(unitsIn.value) !== String(u) && document.activeElement !== unitsIn) unitsIn.value = u;
    chips.forEach(c => c.classList.toggle('is-on', Number(c.dataset.units) === u));
    $('#acqUnitsOut').textContent = nf.format(u);
    $('#acqTotal').textContent = naira(u * CFG.unitPrice);
    $('#acqShare').textContent = share(u);
    $('#acqId').textContent = bid(nextId());
    $('#acqPayAmt').textContent = naira(u * CFG.unitPrice);
    const shown = Math.min(u, 40);
    $('#acqBricks').innerHTML = u
      ? `<div class="acq__bricks-row">${Array.from({ length: shown }, (_, i) => `<i style="--d:${i * 18}ms"></i>`).join('')}${u > shown ? `<span class="mono">+${nf.format(u - shown)}</span>` : ''}</div><span class="mono">YOU'LL LAY ${nf.format(u)} BRICK${u === 1 ? '' : 'S'}</span>`
      : '';
  };
  chips.forEach(c => c.addEventListener('click', () => { unitsIn.value = c.dataset.units; setUnits(c.dataset.units); }));
  unitsIn.addEventListener('input', () => setUnits(unitsIn.value));
  $('#acqStep1').addEventListener('submit', e => {
    e.preventDefault();
    if (!order.units || order.units < 1) { noticeOf(1).textContent = 'The minimum is one brick — ₦10,000.'; unitsIn.focus(); return; }
    goto(2);
  });

  // step 2
  const displayName = full => {
    const parts = String(full).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
  };
  $('#acqStep2').addEventListener('submit', e => {
    e.preventDefault();
    order.name = $('#acqName').value.trim();
    order.email = $('#acqEmail').value.trim();
    order.phone = $('#acqPhone').value.trim();
    order.city = $('#acqCity').value.trim();
    order.display = ($('input[name=display]:checked', dlg) || {}).value || 'name';
    if (!order.name) { noticeOf(2).textContent = 'Add your name for the receipt.'; $('#acqName').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(order.email)) { noticeOf(2).textContent = 'Add a valid email so we can send your receipt.'; $('#acqEmail').focus(); return; }
    $('#acqReview').innerHTML = [
      ['BRICKS', nf.format(order.units)],
      ['CONTRIBUTION', naira(order.units * CFG.unitPrice)],
      ['RECEIPT TO', esc(order.email)],
      ['BUILDER WALL', order.display === 'anonymous' ? 'Anonymous' : esc(displayName(order.name))],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    goto(3);
  });
  $$('[data-back]', dlg).forEach(b => b.addEventListener('click', () => goto(step - 1)));
  dlg.addEventListener('input', e => { const nt = e.target.form && $('[data-notice]', e.target.form); if (nt) nt.textContent = ''; });

  // step 3
  $('#acqStep3').addEventListener('submit', e => {
    e.preventDefault();
    if (!$('#acqAgree').checked) { noticeOf(3).textContent = 'Please confirm you understand Impact Units are a contribution, not an investment.'; return; }
    const payload = { campaign: CFG.campaignId, units: order.units, amount: order.units * CFG.unitPrice, name: order.name, email: order.email, phone: order.phone, city: order.city, display: order.display };
    document.dispatchEvent(new CustomEvent('six:order', { detail: payload }));
    const verify = $('#acqVerify');
    const pay = $('#acqPay');
    if (CFG.checkoutApi) {
      // Real payment: the server creates the Paystack transaction and returns its checkout page.
      verify.hidden = false;
      verify.lastChild.textContent = 'Opening secure payment…';
      pay.disabled = true;
      fetch(CFG.checkoutApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, consent: true }),
      })
        .then(r => r.json().then(body => ({ ok: r.ok, body })))
        .then(({ ok, body }) => {
          if (!ok || !body.url) throw new Error(body.error || 'Payment could not be started. Please try again.');
          window.location.assign(body.url);
        })
        .catch(err => {
          verify.hidden = true; pay.disabled = false;
          noticeOf(3).textContent = err.message || 'Payment could not be started. Please try again.';
        });
      return;
    }
    noticeOf(3).textContent = 'Online payment opens soon. Please check back shortly.';
  });

  // step 4 — Builder card, receipt, sharing
  const shareText = r => `I'm a Builder.\nBUILDER ${bid(r.id)}\n${nf.format(r.units)} BRICK${r.units === 1 ? '' : 'S'} LAID\nI'm helping build the new Smartan House facility, brick by brick.`;
  const siteHost = () => CFG.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  // every Builder gets their own shareable page (with a WhatsApp preview image)
  const cardUrl = r => `${CFG.siteUrl.replace(/\/$/, '')}/builder/${r.id}`;
  // the brick wall engraved on the Builder card; keep in step with lib/brick-wall.ts
  const WALL = { w: 20, h: 9, gap: 2, cols: 6, rows: 5 };
  const wallBricks = laid => {
    const { w, h, gap, cols, rows } = WALL;
    const out = [];
    for (let r = 0, i = 0; r < rows; r++) {
      const y = (rows - 1 - r) * (h + gap);
      const offset = r % 2 ? -(w + gap) / 2 : 0;
      for (let c = 0; c < (r % 2 ? cols + 1 : cols); c++, i++) out.push({ x: offset + c * (w + gap), y, i, laid: i < laid });
    }
    const last = Math.min(laid, out.length) - 1;
    out.forEach(b => { b.last = b.i === last; });
    return out;
  };
  const wallSvg = laid => wallBricks(laid).map(b =>
    `<rect x="${b.x}" y="${b.y}" width="${WALL.w}" height="${WALL.h}" rx="1"${b.laid ? ` class="is-laid${b.last ? ' is-last' : ''}" style="--i:${b.i}"` : ''}/>`).join('');

  const showReceipt = r => {
    receipt = r;
    const now = new Date();
    const month = `${MONTHS[now.getMonth()].slice(0, 3)} ${now.getFullYear()}`;
    $('#bcId').textContent = bid(r.id);
    $('#bcUnits').textContent = nf.format(r.units);
    $('#bcDate').textContent = month;
    $('#bcSite').textContent = siteHost();
    $('#bcName').textContent = r.name || '';
    $('#bcWall').innerHTML = wallSvg(r.units);
    $('#acqWelcome').textContent = r.name ? `Thank you, ${String(r.name).split(/\s+/)[0]}. You're now part of building the new Smartan House facility.` : "You're now part of building the new Smartan House facility.";
    $('#acqReceipt').innerHTML = [
      ...(r.rn ? [['RECEIPT NO.', esc(r.rn)]] : []),
      ['BUILDER ID', bid(r.id)],
      ['BRICKS LAID', nf.format(r.units)],
      ['IMPACT UNITS', nf.format(r.units)],
      ['CONTRIBUTION', naira(r.units * CFG.unitPrice)],
      ['DATE', `${fmtDate(now.toISOString())} · ${WAT.format(now)} WAT`],
      ['PAYSTACK REF', esc(r.ref || '—')],
      ['CAMPAIGN', CFG.campaignId],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#acqReceiptNote').textContent = 'Your official receipt is sent to your email. Impact Units are campaign contribution units, not securities.';
    const text = shareText(r);
    const link = cardUrl(r);
    $('#shareWa').href = `https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`;
    $('#shareX').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    if (!dlg.open) openDialog();
    goto(4);
  };
  $('#shareCopy').addEventListener('click', async () => {
    const text = `${shareText(receipt)}\n${cardUrl(receipt)}`;
    try { await navigator.clipboard.writeText(text); toast('Copied — paste it anywhere.'); }
    catch (e) { toast(CFG.siteUrl); }
  });

  // downloadable Builder card (1080×1350, the shape Instagram and WhatsApp status like)
  $('#shareDl').addEventListener('click', async () => {
    if (!receipt) return;
    const W = 1080, H = 1350;
    const draw = logo => {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const x = cv.getContext('2d');
      const P = 96, inner = W - P * 2;
      const mono = (weight, size, spacing) => { x.font = `${weight} ${size}px "JetBrains Mono", monospace`; x.letterSpacing = spacing; };
      x.fillStyle = '#0A0D12'; x.fillRect(0, 0, W, H);
      // fine brushed texture, as on the card
      x.fillStyle = 'rgba(255,255,255,.014)';
      for (let i = 0; i < W; i += 3) x.fillRect(i, 0, 1, H);

      x.fillStyle = 'rgba(245,247,250,.62)'; mono(500, 24, '7px');
      x.fillText('SMARTAN IMPACT EXCHANGE', P, 140);
      if (logo) x.drawImage(logo, W - P - 72, 96, 72, 72);

      x.fillStyle = '#F5F7FA'; x.letterSpacing = '-6px'; x.font = '600 150px Inter, sans-serif';
      x.fillText("I'm a", P - 6, 380); x.fillText('Builder.', P - 6, 520);
      if (receipt.name) { x.fillStyle = 'rgba(245,247,250,.7)'; x.letterSpacing = '0px'; x.font = '400 42px Inter, sans-serif'; x.fillText(receipt.name, P, 600); }

      // the brick wall, with this Builder's bricks laid
      const s = inner / 130, top = 660;
      x.save(); x.beginPath(); x.rect(P, top, inner, 53 * s); x.clip();
      wallBricks(receipt.units).forEach(b => {
        const bx = P + b.x * s, by = top + b.y * s, bw = WALL.w * s, bh = WALL.h * s;
        x.beginPath(); x.roundRect ? x.roundRect(bx, by, bw, bh, s) : x.rect(bx, by, bw, bh);
        x.fillStyle = b.last ? '#3FA2E8' : b.laid ? '#0076C6' : 'rgba(245,247,250,.035)'; x.fill();
        x.strokeStyle = b.last ? '#7CC4F4' : b.laid ? '#0A86DC' : 'rgba(245,247,250,.14)'; x.lineWidth = 2; x.stroke();
      });
      x.restore();

      x.fillStyle = '#0076C6'; x.fillRect(P, 1080, inner, 3);
      [['BUILDER', bid(receipt.id), '#3FA2E8'], ['BRICKS LAID', nf.format(receipt.units), '#F5F7FA'], ['SINCE', $('#bcDate').textContent, '#F5F7FA']]
        .forEach(([label, value, colour], i) => {
          const cx = P + i * 300;
          x.fillStyle = 'rgba(245,247,250,.5)'; mono(500, 20, '5px'); x.fillText(label, cx, 1140);
          x.fillStyle = colour; mono(500, 44, '0px'); x.fillText(value, cx, 1196);
        });
      x.fillStyle = 'rgba(245,247,250,.5)'; mono(500, 20, '5px');
      x.fillText('THE NEW SMARTAN HOUSE', P, H - 88);
      x.textAlign = 'right'; x.fillStyle = 'rgba(245,247,250,.85)'; mono(500, 20, '3px');
      x.fillText(siteHost(), W - P, H - 88);
      return cv;
    };
    const save = cv => new Promise((res, rej) => {
      try {
        cv.toBlob(blob => {
          if (!blob) { rej(new Error('blob')); return; }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `smartan-builder-${String(receipt.id).padStart(6, '0')}.png`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          res();
        }, 'image/png');
      } catch (e) { rej(e); }
    });
    try { await document.fonts.ready; } catch (e) { /* ignore */ }
    const logo = new Image();
    logo.src = 'assets/logo-mark.png';
    try { await logo.decode(); } catch (e) { /* draw without logo */ }
    try { await save(draw(logo.naturalWidth ? logo : null)); }
    catch (e) { await save(draw(null)); }   // canvas tainted (e.g. opened from file://) — retry without the logo
    toast('Builder card saved.');
  });

  // open / close
  const openDialog = () => {
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (SIX.lenis) SIX.lenis.stop();
    SIX.setMenu(false);
  };
  const openAcquire = units => {
    unitsIn.value = units;
    setUnits(units);
    $('#acqAgree').checked = false;
    openDialog();
    goto(1);
  };
  SIX.openAcquire = openAcquire;
  const closeAcquire = () => { if (dlg.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); } };
  dlg.addEventListener('close', () => { if (SIX.lenis) SIX.lenis.start(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) closeAcquire(); });
  $$('[data-close]', dlg).forEach(b => b.addEventListener('click', closeAcquire));
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-acquire], .tier');
    if (!t) return;
    e.preventDefault();
    openAcquire(Number(t.dataset.units) || 10);
  });

  // returning from the payment provider: ?receipt=1&builder=…&units=…&name=…&ref=…
  // also: ?payment=failed|cancelled|pending|unknown, and ?give=1 (open the form, e.g. from a Builder page)
  (() => {
    const q = new URLSearchParams(window.location.search);
    const clean = () => history.replaceState(null, '', window.location.pathname + window.location.hash);
    if (q.get('receipt') === '1' && q.get('builder')) {
      const r = { id: Number(q.get('builder')), units: Number(q.get('units')) || 0, name: q.get('name') || '', ref: q.get('ref') || '', rn: q.get('rn') || '' };
      SIX.on('ready', () => setTimeout(() => { showReceipt(r); clean(); }, 400));
      return;
    }
    const messages = {
      failed: 'Your payment was not completed. No money was taken, so you can try again.',
      cancelled: 'Payment cancelled. You can become a Builder whenever you are ready.',
      pending: 'Your payment is still being confirmed. Your receipt will arrive by email as soon as it is.',
      unknown: 'We could not find that payment. If money was taken, your receipt will arrive by email.',
    };
    const p = q.get('payment');
    if (p && messages[p]) {
      SIX.on('ready', () => setTimeout(() => { toast(messages[p]); clean(); }, 600));
      return;
    }
    if (q.get('give') === '1') SIX.on('ready', () => setTimeout(() => { openAcquire(Number(q.get('units')) || 1); clean(); }, 500));
  })();

  /* ======================================================================
     MOBILE — the CTA stays within reach
     ====================================================================== */
  (() => {
    const bar = $('#mbar');
    const hero = $('.hero');
    const finalSec = $('#final');
    const btn = $('button', bar);
    let on = false;
    SIX.onScroll((y, h) => {
      const heroEnd = hero.getBoundingClientRect().bottom;
      const f = finalSec.getBoundingClientRect();
      const show = window.innerWidth <= 960 && heroEnd < 0 && !(f.top < h && f.bottom > 0);
      if (show === on) return;
      on = show;
      bar.classList.toggle('is-on', show);
      bar.setAttribute('aria-hidden', String(!show));
      btn.tabIndex = show ? 0 : -1;
    });
  })();

  /* ======================================================================
     OPENING BELL
     ====================================================================== */
  (() => {
    const sec = $('#bell');
    if (!sec) return;
    const L = CFG.launch;
    const launchAt = CFG.launchAt().getTime();
    const dateLabel = fmtDate(L.date);
    const cells = $$('[data-flap]', sec);
    const keys = $$('.board__k', sec);
    const statusEls = $$('[data-market-status]');
    const two = n => String(n).padStart(2, '0');
    const isOpen = () => Date.now() >= launchAt;

    const live = $('#bellLive');
    if (L.livestreamUrl) { live.href = L.livestreamUrl; live.hidden = false; }

    const countdown = () => {
      let s = Math.max(0, Math.floor((launchAt - Date.now()) / 1000));
      const d = Math.floor(s / 86400); s %= 86400;
      const h = Math.floor(s / 3600); s %= 3600;
      const m = Math.floor(s / 60); s %= 60;
      return d ? `${d}D ${two(h)}:${two(m)}:${two(s)}` : `${two(h)}:${two(m)}:${two(s)}`;
    };
    const setFlap = (el, text) => {
      const tiles = $$('.flap__t', el);
      if (tiles.length !== text.length) { SIX.flap(el, text, { spins: 2, stagger: 10 }); return; }
      [...text].forEach((ch, i) => {
        if (tiles[i].textContent === ch) return;
        tiles[i].textContent = ch;
        tiles[i].classList.remove('is-tick'); void tiles[i].offsetWidth; tiles[i].classList.add('is-tick');
      });
      el.setAttribute('aria-label', text);
    };

    let mode = null;
    let seen = false;
    const values = () => (mode === 'open'
      ? [`${L.openTime} WAT`, 'MARKET OPEN', 'BUILDING BEGINS']
      : [`${L.openTime} WAT`, 'PRE-MARKET', countdown()]);
    const flipBoard = () => values().forEach((v, i) => SIX.flap(cells[i], v, { delay: i * 420 }));

    const render = () => {
      mode = isOpen() ? 'open' : 'pre';
      const day = Math.floor((Date.now() - launchAt) / 86400000) + 1;
      $('#bellState').textContent = mode === 'open' ? 'is open.' : 'opens soon.';
      keys[2].textContent = mode === 'open' ? CFG.campaignId : 'OPENS IN';
      $('#bellMeta').textContent = mode === 'open'
        ? `OPENED ${dateLabel} AT ${L.openTime} WAT. DAY ${String(day).padStart(3, '0')} OF THE BUILD.`
        : `THE BELL RINGS AT ${L.openTime} WAT ON ${dateLabel}, ${L.city.toUpperCase()}`;
      statusEls.forEach(s => { s.textContent = mode === 'open' ? 'CAMPAIGN LIVE' : 'PRE-LAUNCH'; });
      if (seen) flipBoard();
      else values().forEach((v, i) => { cells[i].textContent = v; });
    };

    let ac = null;
    const bellSound = () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ac = ac || new AC();
        if (ac.state === 'suspended') ac.resume();
        const t = ac.currentTime;
        const master = ac.createGain();
        master.gain.value = 0.2;
        master.connect(ac.destination);
        [[0.5, 0.5, 4.5], [1, 1, 3.6], [1.19, 0.45, 2.8], [1.5, 0.35, 2.4], [2, 0.5, 2.2], [2.52, 0.2, 1.6], [3.01, 0.15, 1.2]].forEach(([ratio, amp, decay]) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.frequency.value = 440 * ratio;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(amp, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          o.connect(g).connect(master);
          o.start(t);
          o.stop(t + decay + 0.05);
        });
      } catch (e) { /* audio unavailable */ }
    };
    const strike = withSound => {
      sec.classList.remove('is-struck'); void sec.offsetWidth; sec.classList.add('is-struck');
      if (withSound) bellSound();
    };

    render();
    SIX.on('ready', () => SIX.once($('#bellStage'), () => {
      seen = true;
      if (mode === 'open') strike(false);
      flipBoard();
    }, { threshold: 0.5 }));

    $('#ringBell').addEventListener('click', () => {
      strike(true);
      if (seen) flipBoard();
      setTimeout(() => SIX.openAcquire(1), SIX.reduced ? 0 : 1100);
    });
    $('#replayOpening').addEventListener('click', () => SIX.replayOpening());

    setInterval(() => {
      if (mode === 'pre' && isOpen()) { render(); strike(true); return; }
      if (mode === 'pre' && seen) setFlap(cells[2], countdown());
      else if (mode === 'pre') cells[2].textContent = countdown();
    }, 1000);
  })();

  /* ======================================================================
     LIVE ACTIVITY
     SIX.recordBuilder() is the single entry point for a new, VERIFIED
     contribution. Wire your real-time source (webhook → SSE/WebSocket) to it.
     ====================================================================== */
  SIX.recordBuilder = ({ units, name = null, city = '', ts = Date.now(), id }) => {
    const b = { id: id || S.builders + 1, name, city, units, ts };
    S.builders = Math.max(S.builders + 1, b.id);
    S.raised += units * CFG.unitPrice;
    S.updated = new Date(ts);
    recent.unshift(b);
    if (recent.length > 60) recent.length = 60;
    pushFeed(b);
    pushWall(b);
    bumpFlow(units);
    dots.add();
    bricks.add();
    refresh();
    return b;
  };

  // LIVE: apply the server's figures (the database is the source of truth).
  // New contributions since the last poll animate into the feed, wall and bricks.
  const seenKeys = new Set(recent.map(b => b.key).filter(Boolean));
  SIX.applyLive = data => {
    if (!data || typeof data.raised !== 'number') return;
    const fresh = (data.recentBuilders || []).filter(b => b.key && !seenKeys.has(b.key)).reverse();
    fresh.forEach(b => {
      seenKeys.add(b.key);
      recent.unshift(b);
      pushFeed(b);
      pushWall(b);
      bumpFlow(b.units);
    });
    if (recent.length > 60) recent.length = 60;
    const changed = data.raised !== S.raised || data.builders !== S.builders;
    S.raised = data.raised;
    S.builders = data.builders;
    if (data.updatedAt) S.updated = new Date(data.updatedAt);
    if (changed) { dots.add(); bricks.add(); refresh(); }
  };
  if (CFG.liveApi) {
    const poll = () => {
      if (document.hidden) return;
      fetch(CFG.liveApi, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => d && SIX.applyLive(d))
        .catch(() => {});
    };
    SIX.on('ready', () => setInterval(poll, 20000));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }

})();
