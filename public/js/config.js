/* ==========================================================================
   SIX — campaign config
   The single source of truth for everything the page shows.
   Loaded first (blocking, in <head>) so the page can decide before first
   paint whether to play the Opening Day sequence.

   RULE: only put VERIFIED figures in `campaign` and `facility`. Anything not
   yet confirmed stays empty — the page shows an honest "awaiting verified
   data" state instead of inventing numbers.
   ========================================================================== */
window.SIX_CONFIG = {
  campaignId: 'SH-2026-001',
  target: 300000000,          // ₦
  unitPrice: 10000,           // ₦ per Impact Unit — 1 unit = 1 brick, also the minimum contribution
  siteUrl: 'https://smartanhouse.org',   // used in share links and the Builder card

  // When served by the Next.js app, the server sets checkoutApi (Paystack) and
  // liveApi, and replaces `campaign` below with live data from the database.
  checkoutApi: '',
  liveApi: '',


  /* ------------------------------------------------------------------------
     LIVE, VERIFIED CAMPAIGN DATA (filled in by the server from the database;
     these empty defaults only show if the database cannot be reached)
     ------------------------------------------------------------------------ */
  campaign: {
    raised: 0,                // ₦ verified
    builders: 0,              // number of Builders
    updatedAt: null,          // ISO timestamp of the last verified update

    allocated: null,          // ₦ allocated to budget lines (null = not yet published)
    spent: null,              // ₦ spent (null = not yet published)

    // From Smartan's APPROVED project budget. Leave amounts null until approved.
    allocation: [
      { key: 'facility',   label: 'Facility',                 note: 'Acquisition, renovation and build-out of the new Smartan House facility.', amount: null },
      { key: 'acorn',      label: 'Acorn Incubator',          note: 'Fit-out of the Acorn Incubator Hub.',                                      amount: null },
      { key: 'technology', label: 'Technology',               note: 'Connectivity, power and devices.',                                         amount: null },
      { key: 'learning',   label: 'Learning infrastructure',  note: 'Classrooms, studios and study spaces.',                                    amount: null },
      { key: 'equipment',  label: 'Equipment',                note: 'Furniture and equipment for every space.',                                 amount: null },
      { key: 'operations', label: 'Operational setup',        note: 'The systems needed to open the doors.',                                    amount: null },
    ],

    // Verified build milestones. status: 'complete' | 'in-progress' | 'upcoming'
    milestones: [
      { label: 'Foundation',     status: 'upcoming', verifiedOn: null },
      { label: 'Structure',      status: 'upcoming', verifiedOn: null },
      { label: 'Infrastructure', status: 'upcoming', verifiedOn: null },
      { label: 'Acorn Hub',      status: 'upcoming', verifiedOn: null },
      { label: 'Equipment',      status: 'upcoming', verifiedOn: null },
      { label: 'Launch',         status: 'upcoming', verifiedOn: null },
    ],

    // Impact Index — PROJECT MILESTONE PROGRESS (%), never a price or return.
    // value: null until verified.
    index: [
      { label: 'Facility development', value: null, verifiedOn: null },
      { label: 'Acorn development',    value: null, verifiedOn: null },
      { label: 'Infrastructure',       value: null, verifiedOn: null },
      { label: 'Campaign readiness',   value: null, verifiedOn: null },
    ],

    // [{ date: '2026-09-23', ref: 'SIX-L-0001', category: 'facility', label: 'Facility', detail: '...', amount: 50000 }]
    ledger: [],
    // [{ date: '2026-09-23', title: '...', body: '...' }]
    updates: [],
    // Bricks (Impact Units) laid per day, oldest first (last 30 days): [120, 340, ...]
    daily: [],
    // Most recent Builders, newest first: [{ id: 4821, name: 'Richard O.' | null, city: 'Lagos, Nigeria', units: 50, ts: 1790000000000 }]
    recentBuilders: [],
  },

  /* ------------------------------------------------------------------------
     THE FACILITY — confirmed specifications and imagery only
     ------------------------------------------------------------------------ */
  facility: {
    // e.g. { value: '22', label: 'Rooms' }. Hidden until at least one is added.
    specs: [],
    // The facility picture shown in the hero (The Build and The Facility use the illustration).
    // Remove `image` to show the illustration in the hero too.
    model: {
      image: 'assets/photos/facility.webp',
      width: 1415, height: 1112,
      alt: 'Render of the new Smartan House facility: a three-storey building with arched balconies, a red roof and a paved forecourt',
      // Outline of each part of the building in the picture, in image pixels [x, y].
      // In The Build each part drops in and turns to full colour as funding reaches it.
      parts: {
        foundation: [[0,660],[155,660],[155,800],[950,1000],[1100,1062],[1305,890],[1305,650],[1415,650],[1415,1112],[0,1112]],
        l0:   [[95,605],[950,740],[1305,745],[1305,890],[1100,1062],[950,1000],[155,800],[155,610]],
        l1:   [[115,400],[950,478],[1305,500],[1305,745],[950,740],[95,605],[95,570],[115,565]],
        l2:   [[115,222],[950,252],[1305,240],[1305,500],[950,478],[115,400]],
        roof: [[50,205],[180,130],[1250,120],[1310,240],[950,252],[115,222],[55,215]],
        // 'grounds' (sky, trees, palm) is everything else: it has no outline and comes in last
      },
      labels: { roof: 'ROOF', l2: 'LEVEL 02', l1: 'LEVEL 01', l0: 'GROUND FLOOR', grounds: 'GROUNDS', foundation: 'FORECOURT' },
    },
    // Which part of the facility model lights up for each component in the Facility list.
    // Model parts: 'l0' ground floor, 'l1' level 01, 'l2' level 02, 'roof', 'grounds', 'foundation'.
    // PLACEHOLDER GUESSES — confirm with Smartan which floor holds what.
    zones: {
      house:     ['l1', 'l2'],          // Smartan House (residential)
      acorn:     ['l0'],                // Acorn Incubator Hub
      learning:  ['l0'],                // Learning spaces
      collab:    ['l0'],                // Collaboration spaces
      tech:      ['roof'],              // Technology
      community: ['grounds', 'foundation'], // Facility infrastructure / shared spaces
    },
  },

  /* ------------------------------------------------------------------------
     PHOTOS — real images only. Put files in assets/photos/ (WebP, compressed).
     Each slot shows a labelled placeholder until a src is set (hide: true removes it). alt describes the image for screen readers.
     ------------------------------------------------------------------------ */
  photos: {
    caseWork:    { src: 'assets/photos/case-work.webp', alt: 'A packed room at The Smartan House: young people in Smartan T-shirts standing and clapping while guests fill every seat and the floor', caption: 'The current Smartan House, full to the walls' },   // 01 young people at work in the current space
    caseSpace:   { src: 'assets/photos/case-space.webp', alt: 'A large group of young people in matching Smartan T-shirts posing and cheering with guests outside the current Smartan House', caption: 'The Smartan House community' },   // 02 the current (outgrown) space
    caseMentor:  { src: 'assets/photos/case-mentor.webp', alt: 'Young people seated around a meeting table listening to a mentor presenting in front of wall screens', caption: 'A mentoring session' },   // 03 a mentoring moment
    facExterior: { src: 'assets/photos/facility.webp', alt: 'Render of the new Smartan House facility: a three-storey building with arched balconies, a red roof and a paved forecourt', caption: 'The new Smartan House facility, render' },   // 04 architect's render, exterior
    facSite:     { src: 'assets/photos/facility-site.webp', alt: 'The existing three-storey building on the site: weathered concrete walls, arched balconies with white railings and a palm tree in front', caption: 'The site today' },   // 05 the site today
    facAcorn:    { src: 'assets/photos/facility-acorn.webp', alt: 'Render of the Acorn Incubator Hub: a large U-shaped meeting table with leather chairs facing a wall of screens', caption: 'Render: Acorn Incubator Hub' },   // 06 render, Acorn Incubator Hub
    facPlan:     { src: 'assets/photos/facility-residence.webp', alt: 'Render of a Smartan House room: four bunk beds with navy bedding, a shared study desk between two windows and a patterned rug', caption: 'Render: Smartan House residence' },   // 07 render, Smartan House residence
    siteLatest:  { src: 'assets/photos/facility-site.webp', alt: '', caption: '' },   // 08 latest from the site (dated caption)
  },

  /* ------------------------------------------------------------------------
     LAUNCH / OPENING BELL
     ------------------------------------------------------------------------ */
  launch: {
    date: '2026-09-23',       // YYYY-MM-DD, in WAT
    openTime: '09:00',        // HH:MM, in WAT — the opening bell
    city: 'Lagos, Nigeria',
    livestreamUrl: '',        // e.g. a YouTube Live link; shows "Watch the opening bell" when set

    // When to play the cinematic Opening Day sequence:
    //   'launch-day'  – once per visitor, only on the launch date (WAT)
    //   'first-visit' – once per visitor, any day
    //   'always'      – every page load
    //   'never'       – never (short loader only)
    // Preview any time with ?opening=1, suppress with ?opening=0.
    // Visitors can always watch it again with "Replay the opening" in the Opening Bell section.
    openingSequence: 'first-visit',
  },
};

// The opening bell as an absolute instant (WAT = UTC+1, no DST).
window.SIX_CONFIG.launchAt = function () {
  return new Date(this.launch.date + 'T' + this.launch.openTime + ':00+01:00');
};

window.SIX_CONFIG.openingKey = function () {
  return 'six-opening-' + this.launch.date;
};

// Decides whether this visit gets the Opening Day sequence.
window.SIX_CONFIG.playOpening = function () {
  var q = window.location.search;
  if (/[?&]opening=1\b/.test(q)) return true;
  if (/[?&]opening=0\b/.test(q) || /[?&]receipt=1\b/.test(q)) return false;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  var mode = this.launch.openingSequence;
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  var seen = null;
  try { seen = window.localStorage.getItem(this.openingKey()); } catch (e) { /* storage unavailable */ }
  if (seen) return false;
  if (mode === 'first-visit') return true;
  var today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
  return today === this.launch.date;
};
