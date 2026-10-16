/*
 * WebSec WSTG Checklist — single-page, offline, localStorage-backed.
 * No network calls, no tracking. All user content is HTML-escaped before rendering.
 */
(function () {
  'use strict';

  // ============================================================
  // Constants
  // ============================================================
  var STORAGE_KEY = 'wstg-checklist-v1';
  var APP_ID = 'wstg-checklist';
  var DATA_VERSION = 1;
  var NOTE_DEBOUNCE_MS = 1000;

  var STATUSES = [
    { id: 'not_tested', label: 'Not Tested', emoji: '⚪' },
    { id: 'in_progress', label: 'In Progress', emoji: '🔵' },
    { id: 'pass', label: 'Pass', emoji: '🟢' },
    { id: 'fail', label: 'Fail', emoji: '🔴' },
    { id: 'warning', label: 'Warning', emoji: '🟡' },
    { id: 'na', label: 'N/A', emoji: '⚫' },
    { id: 'blocked', label: 'Blocked', emoji: '🟣' }
  ];
  var STATUS_MAP = {};
  STATUSES.forEach(function (s) { STATUS_MAP[s.id] = s; });

  var SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
  var SEV_WEIGHT = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  var ENVS = [['', 'Not set'], ['dev', 'Dev'], ['staging', 'Staging'], ['prod', 'Prod']];
  var TABS = ['checklist', 'notes', 'summary'];

  var CATS = window.WSTG_DATA || [];
  var CAT_MAP = {};
  var CAT_ORDER = {};
  CATS.forEach(function (c, i) { CAT_MAP[c.id] = c; CAT_ORDER[c.id] = i; });
  var TOTAL_TESTS = CATS.reduce(function (n, c) { return n + c.items.length; }, 0);

  var app = document.getElementById('app');
  var modalRoot = document.getElementById('modalRoot');
  var toastRoot = document.getElementById('toastRoot');

  // ============================================================
  // Utilities
  // ============================================================
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid() {
    var c = window.crypto;
    if (c && typeof c.randomUUID === 'function') {
      try { return c.randomUUID(); } catch (e) { /* insecure context */ }
    }
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function nowIso() { return new Date().toISOString(); }
  function today() { return nowIso().slice(0, 10); }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function fmtRel(iso) {
    if (!iso) return 'never';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    var s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    if (h < 24) return h + ' h ago';
    var days = Math.round(h / 24);
    if (days < 7) return days + ' d ago';
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  }

  function safeHref(u) {
    if (!u) return null;
    try {
      var x = new URL(String(u));
      return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : null;
    } catch (e) { return null; }
  }

  function slug(s) {
    return String(s || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project';
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function download(filename, content, mime) {
    // Hosted previews (e.g. a sandboxed iframe) block downloads: show the content to copy instead.
    if (window.WSTG_EXPORT_INLINE) { showExport(filename, content); return; }
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function svg(name, cls) {
    var paths = {
      back: '<path d="M15 18l-6-6 6-6"/>',
      chev: '<path d="M9 18l6-6-6-6"/>',
      dots: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
      ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
      doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      expand: '<path d="M7 15l5 5 5-5M7 9l5-5 5 5"/>',
      collapse: '<path d="M7 20l5-5 5 5M7 4l5 5 5-5"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
    };
    return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  // ============================================================
  // Data model
  // ============================================================
  function catIdOf(it) {
    if (it.categoryId) return it.categoryId;
    var m = /^(WSTG-[A-Z]+)-/.exec(it.wstgId || '');
    return m ? m[1] : 'OTHER';
  }

  function catMeta(id, fallbackName) {
    return CAT_MAP[id] || { id: id, name: fallbackName || id, emoji: '📁', reference: null };
  }

  function freshItems() {
    var out = [];
    CATS.forEach(function (c) {
      c.items.forEach(function (it) {
        out.push({
          wstgId: it.wstgId,
          category: c.name,
          categoryId: c.id,
          title: it.title,
          description: it.description,
          severity: it.severity,
          reference: it.reference || c.reference,
          status: 'not_tested',
          note: '',
          evidence: false,
          evidenceAt: null,
          tags: it.tags.slice(),
          updatedAt: null
        });
      });
    });
    return out;
  }

  function createProject(fields) {
    var t = nowIso();
    return {
      id: uid(),
      name: fields.name,
      description: fields.description || '',
      targetUrl: fields.targetUrl || '',
      environment: fields.environment || '',
      createdAt: t,
      updatedAt: t,
      items: freshItems()
    };
  }

  function str(v, max) {
    var s = typeof v === 'string' ? v : (v == null ? '' : String(v));
    return max ? s.slice(0, max) : s;
  }

  function isoOrNull(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d) ? null : d.toISOString();
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var wstgId = str(raw.wstgId || raw.id, 64).trim();
    if (!wstgId) return null;
    var it = {
      wstgId: wstgId,
      category: str(raw.category, 200),
      categoryId: str(raw.categoryId, 64),
      title: str(raw.title, 500) || wstgId,
      description: str(raw.description, 5000),
      severity: SEV_WEIGHT[raw.severity] ? raw.severity : 'info',
      reference: safeHref(raw.reference) || '',
      status: STATUS_MAP[raw.status] ? raw.status : 'not_tested',
      note: str(raw.note, 100000),
      evidence: !!raw.evidence,
      evidenceAt: isoOrNull(raw.evidenceAt),
      tags: Array.isArray(raw.tags) ? raw.tags.map(function (t) { return str(t, 40).trim().toLowerCase(); }).filter(Boolean).slice(0, 20) : [],
      updatedAt: isoOrNull(raw.updatedAt)
    };
    if (!it.categoryId) it.categoryId = catIdOf(it);
    if (!it.category) it.category = catMeta(it.categoryId).name;
    return it;
  }

  function normalizeProject(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var name = str(raw.name, 120).trim();
    if (!name) return null;
    var items = Array.isArray(raw.items) ? raw.items.map(normalizeItem).filter(Boolean) : [];
    if (!items.length) items = freshItems();
    var created = isoOrNull(raw.createdAt) || nowIso();
    return {
      id: str(raw.id, 64) || uid(),
      name: name,
      description: str(raw.description, 2000),
      targetUrl: str(raw.targetUrl, 2000),
      environment: ['dev', 'staging', 'prod'].indexOf(raw.environment) >= 0 ? raw.environment : '',
      createdAt: created,
      updatedAt: isoOrNull(raw.updatedAt) || created,
      items: items
    };
  }

  function normalizeDb(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var projects = Array.isArray(src.projects) ? src.projects.map(normalizeProject).filter(Boolean) : [];
    var seen = {};
    projects.forEach(function (p) { if (seen[p.id]) p.id = uid(); seen[p.id] = true; });
    var settings = src.settings && typeof src.settings === 'object' ? src.settings : {};
    var collapsed = settings.collapsed && typeof settings.collapsed === 'object' ? settings.collapsed : {};
    return {
      app: APP_ID,
      version: DATA_VERSION,
      projects: projects,
      settings: {
        theme: settings.theme === 'dark' ? 'dark' : (settings.theme === 'light' ? 'light' : currentTheme()),
        collapsed: collapsed
      }
    };
  }

  function makeDemoProject() {
    var p = createProject({
      name: 'Demo — Acme Web Shop',
      description: 'Sample assessment showing statuses, notes and findings. Explore it, then delete it whenever you like.',
      targetUrl: 'https://shop.example.com',
      environment: 'staging'
    });
    var t = nowIso();
    var byId = {};
    p.items.forEach(function (it) { byId[it.wstgId] = it; });
    function set(id, status, note, evidence) {
      var it = byId[id];
      if (!it) return;
      it.status = status;
      it.note = note || '';
      it.updatedAt = t;
      if (evidence) { it.evidence = true; it.evidenceAt = t; }
    }
    set('WSTG-INFO-01', 'pass', 'No sensitive results from search engine dorks.\nWayback Machine shows an old /admin path (now 404).');
    set('WSTG-INFO-02', 'pass', 'Server: nginx (version hidden).');
    set('WSTG-INFO-03', 'warning', 'robots.txt discloses /internal-reports/ and /beta/.');
    set('WSTG-INFO-06', 'in_progress', 'Mapped 42 endpoints via proxy crawl. /api/v2 still to enumerate.');
    set('WSTG-CONF-07', 'fail', 'No Strict-Transport-Security header on any response.\nRecommend: max-age=31536000; includeSubDomains', true);
    set('WSTG-CONF-11', 'na', 'No cloud storage in scope.');
    set('WSTG-ATHN-01', 'pass', 'Verified TLS 1.3 on login.');
    set('WSTG-ATHN-02', 'pass');
    set('WSTG-ATHN-03', 'fail', 'No lockout after 50 attempts.\nPOST /api/login returns 401 with no delay or CAPTCHA.', true);
    set('WSTG-ATHN-07', 'warning', 'Min 8 chars, need 12. No breached-password check.');
    set('WSTG-ATHN-11', 'blocked', 'Waiting for a test account with MFA enabled.');
    set('WSTG-SESS-02', 'warning', 'Session cookie is missing the SameSite attribute.');
    set('WSTG-INJT-01', 'pass');
    set('WSTG-INJT-05', 'fail', 'Boolean-based blind SQL injection in GET /products?sort=\n\n  sort=name,(SELECT 1)--   -> 200, normal order\n  sort=name,(SELECT 1/0)-- -> 500', true);
    set('WSTG-INJT-19', 'in_progress');
    set('WSTG-CLNT-09', 'pass', "CSP contains frame-ancestors 'none'.");
    set('WSTG-WASM-01', 'na', 'No WebAssembly modules in use.');
    return p;
  }

  // ============================================================
  // Persistence
  // ============================================================
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  var storageOk = true;

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { storageOk = false; }
    if (raw) {
      try { return { db: normalizeDb(JSON.parse(raw)), fresh: false }; }
      catch (e) {
        // Keep the unreadable data aside instead of overwriting it.
        try { localStorage.setItem(STORAGE_KEY + '-corrupt-' + Date.now(), raw); } catch (e2) { /* ignore */ }
      }
    }
    var d = normalizeDb({});
    d.projects.push(makeDemoProject());
    return { db: d, fresh: true };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      toast('Could not save: browser storage is full or blocked.', 'fail', 'save-err');
      return false;
    }
  }

  function touch(p) { p.updatedAt = nowIso(); }

  var loaded = load();
  var db = loaded.db;
  if (loaded.fresh) save();

  // ============================================================
  // UI state (not persisted except collapsed categories)
  // ============================================================
  var ui = {
    route: { view: 'home' },
    filters: {},          // per project id
    open: {},             // "pid:idx" -> true for expanded items
    menu: null,
    homeQuery: ''
  };

  function filtersFor(pid) {
    if (!ui.filters[pid]) ui.filters[pid] = { q: '', status: 'all', severity: 'all', category: 'all', onlyFails: false };
    return ui.filters[pid];
  }

  function isFiltering(f) {
    return !!(f.q.trim() || f.status !== 'all' || f.severity !== 'all' || f.category !== 'all' || f.onlyFails);
  }

  function collapsedSet(pid) {
    var arr = db.settings.collapsed[pid];
    return Array.isArray(arr) ? arr : [];
  }

  function setCollapsed(pid, catId, collapsed) {
    var arr = collapsedSet(pid).filter(function (c) { return c !== catId; });
    if (collapsed) arr.push(catId);
    db.settings.collapsed[pid] = arr;
    save();
  }

  function getProject(id) {
    for (var i = 0; i < db.projects.length; i++) if (db.projects[i].id === id) return db.projects[i];
    return null;
  }

  function currentProject() {
    return ui.route.view === 'project' ? getProject(ui.route.id) : null;
  }

  // ============================================================
  // Stats
  // ============================================================
  function computeStats(items) {
    var counts = {};
    STATUSES.forEach(function (s) { counts[s.id] = 0; });
    var failBySev = {};
    SEVERITIES.forEach(function (s) { failBySev[s] = 0; });
    var notes = 0, risk = 0, evidence = 0;
    items.forEach(function (it) {
      counts[it.status]++;
      if (it.note.trim()) notes++;
      if (it.evidence) evidence++;
      if (it.status === 'fail') {
        risk += SEV_WEIGHT[it.severity] || 1;
        failBySev[it.severity]++;
      }
    });
    var total = items.length;
    var applicable = total - counts.na;
    var done = counts.pass + counts.fail + counts.warning;
    var resolved = done + counts.na;
    var pct = applicable > 0 ? Math.round(done / applicable * 100) : (total ? 100 : 0);
    return { counts: counts, total: total, applicable: applicable, done: done, resolved: resolved, pct: pct, notes: notes, evidence: evidence, risk: risk, failBySev: failBySev };
  }

  function groupItems(p) {
    var groups = [], byId = {};
    p.items.forEach(function (it, idx) {
      var cid = catIdOf(it);
      if (!byId[cid]) {
        var meta = catMeta(cid, it.category);
        byId[cid] = { id: cid, name: meta.name, emoji: meta.emoji, reference: meta.reference, entries: [] };
        groups.push(byId[cid]);
      }
      byId[cid].entries.push({ it: it, idx: idx });
    });
    groups.sort(function (a, b) {
      var oa = a.id in CAT_ORDER ? CAT_ORDER[a.id] : 999;
      var ob = b.id in CAT_ORDER ? CAT_ORDER[b.id] : 999;
      return oa - ob;
    });
    return groups;
  }

  function matches(it, f) {
    if (f.onlyFails && it.status !== 'fail') return false;
    if (f.status === 'notes') { if (!it.note.trim()) return false; }
    else if (f.status !== 'all' && it.status !== f.status) return false;
    if (f.severity !== 'all' && it.severity !== f.severity) return false;
    if (f.category !== 'all' && catIdOf(it) !== f.category) return false;
    var q = f.q.trim().toLowerCase();
    if (q) {
      var hay = [it.wstgId, it.title, it.description, it.note, it.category, it.tags.join(' ')].join(' \n ').toLowerCase();
      var terms = q.split(/\s+/);
      for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) < 0) return false;
    }
    return true;
  }

  // ============================================================
  // Shared HTML fragments
  // ============================================================
  function stColor(status) { return 'var(--st-' + status + ')'; }

  function progressSegs(s) {
    if (!s.applicable) return '';
    return ['pass', 'warning', 'fail'].map(function (k) {
      if (!s.counts[k]) return '';
      return '<span style="width:' + (s.counts[k] / s.applicable * 100).toFixed(2) + '%;background:' + stColor(k) + '" title="' + STATUS_MAP[k].label + ': ' + s.counts[k] + '"></span>';
    }).join('');
  }

  function progressHtml(s, lg) {
    return '<div class="progress' + (lg ? ' progress-lg' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + s.pct + '" aria-label="Completion">' +
      '<div class="progress-track">' + progressSegs(s) + '</div>' +
      '<span class="progress-val">' + s.pct + '%</span></div>';
  }

  function statusPills(s, all) {
    return '<div class="pills">' + STATUSES.filter(function (st) { return all || s.counts[st.id]; }).map(function (st) {
      return '<span class="pill" title="' + st.label + '"><span class="dot" style="--c:' + stColor(st.id) + '"></span>' + st.label + ' <b>' + s.counts[st.id] + '</b></span>';
    }).join('') + '</div>';
  }

  function sevBadge(sev) { return '<span class="sev sev-' + esc(sev) + '">' + esc(sev) + '</span>'; }

  function statusTag(status) {
    var st = STATUS_MAP[status];
    return '<span class="status-tag" style="--c:' + stColor(status) + '"><span class="dot"></span>' + st.label + '</span>';
  }

  function envBadge(env) {
    if (!env) return '';
    var label = ENVS.filter(function (e) { return e[0] === env; })[0];
    return '<span class="env env-' + esc(env) + '">' + esc(label ? label[1] : env) + '</span>';
  }

  function menuButton(id, label) {
    return '<div class="menu-wrap"><button class="btn btn-ghost btn-sm btn-icon" type="button" data-action="project-menu" data-id="' + esc(id) + '" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(label) + '">' + svg('dots') + '</button></div>';
  }

  // ============================================================
  // Home view
  // ============================================================
  function renderHome() {
    document.title = 'WSTG Checklist';
    var n = db.projects.length;
    app.innerHTML =
      '<div class="container">' +
        '<div class="page-head">' +
          '<div><h1>Projects</h1><p>' + plural(n, 'project') + ' · OWASP WSTG checklist with ' + TOTAL_TESTS + ' tests' + (storageOk ? '' : ' · <b style="color:var(--danger)">browser storage unavailable, changes will not persist</b>') + '</p></div>' +
          '<div class="home-tools">' +
            (n ? '<label class="search">' + svg('search') + '<input class="input" id="homeSearch" type="search" placeholder="Filter projects…" aria-label="Filter projects" value="' + esc(ui.homeQuery) + '"></label>' : '') +
            '<button class="btn btn-primary" type="button" data-action="new-project">' + svg('plus') + 'New Project</button>' +
          '</div>' +
        '</div>' +
        '<div id="projectGrid"></div>' +
      '</div>';
    renderProjectGrid();
  }

  function renderProjectGrid() {
    var grid = document.getElementById('projectGrid');
    if (!grid) return;
    if (!db.projects.length) {
      grid.innerHTML =
        '<div class="card empty">' +
          '<div class="empty-icon">🛡️</div>' +
          '<h2>No projects yet</h2>' +
          '<p>Create a project to get a fresh OWASP WSTG checklist. Track each test\'s status, write notes and export a report when you\'re done.</p>' +
          '<button class="btn btn-primary" type="button" data-action="new-project">' + svg('plus') + 'Create your first project</button>' +
        '</div>';
      return;
    }
    var q = ui.homeQuery.trim().toLowerCase();
    var list = db.projects.filter(function (p) {
      return !q || (p.name + ' ' + p.description + ' ' + p.targetUrl).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0; });

    if (!list.length) {
      grid.innerHTML = '<div class="card empty"><div class="empty-icon">🔍</div><h2>No matching projects</h2><p>Nothing matches “' + esc(ui.homeQuery) + '”.</p></div>';
      return;
    }

    grid.innerHTML = '<div class="grid">' + list.map(function (p, i) {
      var s = computeStats(p.items);
      return '<article class="card pcard" data-action="open-project" data-id="' + esc(p.id) + '" tabindex="0" role="link" aria-label="Open project ' + esc(p.name) + '" style="animation-delay:' + Math.min(i * 30, 300) + 'ms">' +
        '<div class="pcard-head">' +
          '<div class="pcard-title"><h3 title="' + esc(p.name) + '">' + esc(p.name) + '</h3>' +
            '<span class="pcard-url mono">' + (p.targetUrl ? esc(p.targetUrl) : 'No target URL') + '</span></div>' +
          envBadge(p.environment) +
          menuButton(p.id, 'Actions for ' + p.name) +
        '</div>' +
        (p.description ? '<p class="pcard-desc">' + esc(p.description) + '</p>' : '') +
        progressHtml(s) +
        statusPills(s, false) +
        '<div class="pcard-foot">' +
          '<span>📝 ' + plural(s.notes, 'note') + '</span>' +
          '<span class="risk" title="Severity-weighted risk score of failed tests" style="color:' + (s.risk ? 'var(--st-fail)' : 'inherit') + '">Risk ' + s.risk + '</span>' +
          '<span title="' + esc(fmtDate(p.updatedAt)) + '">Updated ' + esc(fmtRel(p.updatedAt)) + '</span>' +
        '</div>' +
      '</article>';
    }).join('') + '</div>';
  }

  // ============================================================
  // Project view
  // ============================================================
  function renderProject(p, tab) {
    document.title = p.name + ' · WSTG Checklist';
    var s = computeStats(p.items);
    var href = safeHref(p.targetUrl);
    var f = filtersFor(p.id);

    app.innerHTML =
      '<div class="proj-sticky"><div class="container">' +
        '<div class="proj-title-row">' +
          '<a class="btn btn-ghost btn-icon" href="#/" aria-label="Back to projects" title="Back to projects">' + svg('back') + '</a>' +
          '<h1 title="' + esc(p.name) + '">' + esc(p.name) + '</h1>' + envBadge(p.environment) +
          '<span class="spacer"></span>' +
          '<button class="btn btn-sm" type="button" data-action="export-md" data-id="' + esc(p.id) + '">' + svg('doc', 'i-sm') + '<span class="hide-sm">Export Report</span></button>' +
          menuButton(p.id, 'Project actions') +
        '</div>' +
        '<div class="proj-meta">' +
          (p.targetUrl ? (href ? '<a class="mono" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(p.targetUrl) + '</a>' : '<span class="mono">' + esc(p.targetUrl) + '</span>') : '') +
          (p.description ? '<span>' + esc(p.description) + '</span>' : '') +
          '<span title="' + esc(fmtDate(p.updatedAt)) + '" id="projUpdated">Updated ' + esc(fmtRel(p.updatedAt)) + '</span>' +
        '</div>' +
        '<div class="proj-stats" id="projStats">' + projStatsHtml(s) + '</div>' +
        '<div class="tabs" role="tablist">' +
          tabBtn(p, 'checklist', '✅ Checklist', '') +
          tabBtn(p, 'notes', '📝 Notes', '<span class="count" id="notesCount">' + s.notes + '</span>') +
          tabBtn(p, 'summary', '📊 Summary', '') +
        '</div>' +
        (tab === 'checklist' ? filtersHtml(p, f, s) : '') +
      '</div></div>' +
      '<div class="container" id="tabBody" role="tabpanel"></div>';

    renderTabBody();
  }

  function tabBtn(p, id, label, extra) {
    return '<button class="tab" type="button" role="tab" data-action="set-tab" data-tab="' + id + '" aria-selected="' + (ui.route.tab === id) + '">' + label + extra + '</button>';
  }

  function projStatsHtml(s) {
    return '<div>' + progressHtml(s, true) + '<div style="margin-top:8px">' + statusPills(s, true) + '</div></div>' +
      '<div class="risk-badge' + (s.risk ? ' hot' : '') + '" title="Sum of severity weights (Critical 5, High 4, Medium 3, Low 2, Info 1) for failed tests">Risk score <b>' + s.risk + '</b></div>';
  }

  function filtersHtml(p, f, s) {
    var groups = groupItems(p);
    return '<div class="filters">' +
      '<div class="filter-row">' +
        '<label class="search">' + svg('search') + '<input class="input" id="q" type="search" autocomplete="off" placeholder="Search ID, title, description, notes, tags…" aria-label="Search checklist" value="' + esc(f.q) + '"><kbd>/</kbd></label>' +
        '<select class="select" id="fSev" aria-label="Filter by severity"><option value="all">All severities</option>' +
          SEVERITIES.map(function (v) { return '<option value="' + v + '"' + (f.severity === v ? ' selected' : '') + '>' + cap(v) + '</option>'; }).join('') +
        '</select>' +
        '<select class="select" id="fCat" aria-label="Filter by category"><option value="all">All categories</option>' +
          groups.map(function (g) { return '<option value="' + esc(g.id) + '"' + (f.category === g.id ? ' selected' : '') + '>' + esc(g.emoji + ' ' + g.name) + '</option>'; }).join('') +
        '</select>' +
        '<button class="chip chip-toggle" type="button" data-action="toggle-fails" aria-pressed="' + f.onlyFails + '" title="Show only failed tests">🔴 Only fails</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="expand-all" title="Expand all categories">' + svg('expand', 'i-sm') + '<span class="hide-sm">Expand</span></button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="collapse-all" title="Collapse all categories">' + svg('collapse', 'i-sm') + '<span class="hide-sm">Collapse</span></button>' +
      '</div>' +
      '<div class="chips" id="statusChips" role="group" aria-label="Filter by status">' + chipsHtml(f, s) + '</div>' +
    '</div>';
  }

  function chipsHtml(f, s) {
    var chips = [['all', 'All', s.total, null]].concat(STATUSES.map(function (st) {
      return [st.id, st.label, s.counts[st.id], st.id];
    }), [['notes', '📝 Has Notes', s.notes, null]]);
    return chips.map(function (c) {
      return '<button class="chip" type="button" data-action="status-filter" data-v="' + c[0] + '" aria-pressed="' + (f.status === c[0]) + '">' +
        (c[3] ? '<span class="dot" style="--c:' + stColor(c[3]) + '"></span>' : '') +
        esc(c[1]) + ' <span class="n">' + c[2] + '</span></button>';
    }).join('');
  }

  function renderTabBody() {
    var p = currentProject();
    if (!p) return;
    if (ui.route.tab === 'notes') renderNotes(p);
    else if (ui.route.tab === 'summary') renderSummary(p);
    else renderChecklist(p);
  }

  // ---------- Checklist ----------
  function renderChecklist(p) {
    var body = document.getElementById('tabBody');
    var f = filtersFor(p.id);
    var filtering = isFiltering(f);
    var collapsed = collapsedSet(p.id);
    var html = '', shown = 0, ci = 0;

    groupItems(p).forEach(function (g) {
      var vis = g.entries.filter(function (e) { return matches(e.it, f); });
      if (!vis.length) return;
      shown += vis.length;
      var open = filtering || collapsed.indexOf(g.id) < 0;
      var cs = computeStats(g.entries.map(function (e) { return e.it; }));
      html +=
        '<section class="card cat" data-cat="' + esc(g.id) + '" data-open="' + open + '" style="animation-delay:' + Math.min(ci++ * 25, 250) + 'ms">' +
          '<button class="cat-head" type="button" data-action="toggle-cat" aria-expanded="' + open + '">' +
            svg('chev', 'chev') +
            '<span class="cat-emoji" aria-hidden="true">' + esc(g.emoji) + '</span>' +
            '<span class="cat-name"><b>' + esc(g.name) + '</b><small>' + esc(g.id) + ' · ' + plural(g.entries.length, 'test') + (filtering ? ' · ' + vis.length + ' shown' : '') + '</small></span>' +
            '<span class="cat-progress">' + catProgressHtml(cs) + '</span>' +
          '</button>' +
          '<div class="cat-body"' + (open ? '' : ' inert') + '><div class="cat-inner">' +
            vis.map(function (e) { return itemHtml(p, e.it, e.idx); }).join('') +
          '</div></div>' +
        '</section>';
    });

    if (!shown) {
      body.innerHTML = '<div class="card empty"><div class="empty-icon">🧐</div><h2>No tests match these filters</h2><p>Try a different search term or status.</p>' +
        '<button class="btn" type="button" data-action="clear-filters">' + svg('x', 'i-sm') + 'Clear filters</button></div>';
      return;
    }
    body.innerHTML = '<div class="cats">' + html + '</div>';
    focusPendingItem();
  }

  function catProgressHtml(cs) {
    return '<span class="progress-track">' + progressSegs(cs) + '</span><span>' + cs.done + '/' + cs.applicable + ' done</span>';
  }

  function itemHtml(p, it, idx) {
    var key = p.id + ':' + idx;
    var open = !!ui.open[key];
    var ref = safeHref(it.reference);
    var nid = 'note-' + idx;
    return '<div class="item" data-idx="' + idx + '" data-open="' + open + '" style="--c:' + stColor(it.status) + '">' +
      '<div class="item-row" data-action="toggle-item" role="button" tabindex="0" aria-expanded="' + open + '" aria-controls="detail-' + idx + '">' +
        '<span class="item-id">' + esc(it.wstgId) + '</span>' +
        '<span class="item-title"><span class="t">' + esc(it.title) + '</span>' + itemFlagsHtml(it) + '</span>' +
        '<span class="item-ctrls">' + sevBadge(it.severity) +
          '<select class="select status-select" data-role="status" aria-label="Status for ' + esc(it.wstgId) + '" style="--c:' + stColor(it.status) + '">' +
            STATUSES.map(function (st) { return '<option value="' + st.id + '"' + (st.id === it.status ? ' selected' : '') + '>' + st.emoji + ' ' + st.label + '</option>'; }).join('') +
          '</select>' +
        '</span>' +
      '</div>' +
      '<div class="item-detail" id="detail-' + idx + '"' + (open ? '' : ' inert') + '><div><div class="item-detail-inner">' +
        (it.description ? '<p class="item-desc">' + esc(it.description) + '</p>' : '') +
        '<div class="item-links">' +
          (ref ? '<a href="' + esc(ref) + '" target="_blank" rel="noopener noreferrer">📖 WSTG reference ' + svg('ext', 'i-sm') + '</a>' : '') +
          '<span class="muted item-updated" title="' + esc(fmtDate(it.updatedAt)) + '">' + (it.updatedAt ? 'Updated ' + esc(fmtRel(it.updatedAt)) : 'Not updated yet') + '</span>' +
        '</div>' +
        '<div>' +
          '<div class="field-label"><label for="' + nid + '">📝 Note</label><span class="save-state" aria-live="polite"></span></div>' +
          '<textarea class="textarea" id="' + nid + '" data-role="note" spellcheck="true" placeholder="Findings, evidence, payloads, request/response snippets…">' + esc(it.note) + '</textarea>' +
          '<div class="note-tools">' +
            '<label class="check"><input type="checkbox" data-role="evidence"' + (it.evidence ? ' checked' : '') + '> Mark note as evidence</label>' +
            '<span class="ev-time">' + (it.evidence && it.evidenceAt ? 'Evidence recorded ' + esc(fmtDate(it.evidenceAt)) : '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="tag-row"><label class="field-label" for="tags-' + idx + '" style="margin:0">🏷️ Tags</label>' +
          '<input class="input" id="tags-' + idx + '" data-role="tags" placeholder="comma, separated, tags" value="' + esc(it.tags.join(', ')) + '"></div>' +
      '</div></div></div>' +
    '</div>';
  }

  function itemFlagsHtml(it) {
    return (it.note.trim() ? '<span class="note-flag" title="Has note">📝</span>' : '') +
      (it.evidence ? '<span class="ev-flag" title="Note marked as evidence">Evidence</span>' : '');
  }

  // ---------- Notes ----------
  function renderNotes(p) {
    var body = document.getElementById('tabBody');
    var entries = [];
    groupItems(p).forEach(function (g) {
      g.entries.forEach(function (e) { if (e.it.note.trim()) entries.push(e); });
    });
    if (!entries.length) {
      body.innerHTML = '<div class="card empty"><div class="empty-icon">📝</div><h2>No notes yet</h2><p>Open any test in the checklist and write a note. Every note you write shows up here.</p>' +
        '<button class="btn" type="button" data-action="set-tab" data-tab="checklist">Go to checklist</button></div>';
      return;
    }
    body.innerHTML = '<p class="muted" style="margin:0 0 12px">' + plural(entries.length, 'test') + ' with notes' +
      (entries.filter(function (e) { return e.it.evidence; }).length ? ' · ' + entries.filter(function (e) { return e.it.evidence; }).length + ' marked as evidence' : '') + '</p>' +
      '<div class="list-gap">' + entries.map(function (e, i) {
        var it = e.it;
        return '<article class="card note-card" style="animation-delay:' + Math.min(i * 20, 240) + 'ms;border-left:3px solid ' + stColor(it.status) + '">' +
          '<div class="note-card-head"><span class="mono muted">' + esc(it.wstgId) + '</span><span class="t">' + esc(it.title) + '</span>' +
            sevBadge(it.severity) + statusTag(it.status) + (it.evidence ? '<span class="ev-flag">Evidence</span>' : '') + '</div>' +
          '<pre class="note-text">' + esc(it.note) + '</pre>' +
          '<div class="note-card-foot"><span>' + esc(it.category) + ' · updated ' + esc(fmtRel(it.updatedAt)) +
            (it.evidence && it.evidenceAt ? ' · evidence ' + esc(fmtDate(it.evidenceAt)) : '') + '</span>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="goto-item" data-idx="' + e.idx + '">Open in checklist ' + svg('arrow', 'i-sm') + '</button></div>' +
        '</article>';
      }).join('') + '</div>';
  }

  // ---------- Summary ----------
  function sortedByRisk(entries) {
    return entries.slice().sort(function (a, b) {
      return (SEV_WEIGHT[b.it.severity] || 0) - (SEV_WEIGHT[a.it.severity] || 0) || a.idx - b.idx;
    });
  }

  function entriesWithStatus(p, status) {
    var out = [];
    p.items.forEach(function (it, idx) { if (it.status === status) out.push({ it: it, idx: idx }); });
    return sortedByRisk(out);
  }

  function renderSummary(p) {
    var body = document.getElementById('tabBody');
    var s = computeStats(p.items);
    var maxCount = Math.max.apply(null, STATUSES.map(function (st) { return s.counts[st.id]; }).concat([1]));
    var maxFail = Math.max.apply(null, SEVERITIES.map(function (v) { return s.failBySev[v]; }).concat([1]));
    var fails = entriesWithStatus(p, 'fail');
    var warns = entriesWithStatus(p, 'warning');

    var kpi = function (v, l, color) {
      return '<div class="card kpi"><div class="v"' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div><div class="l">' + l + '</div></div>';
    };

    var catRows = groupItems(p).map(function (g) {
      var cs = computeStats(g.entries.map(function (e) { return e.it; }));
      return '<tr><td>' + esc(g.emoji) + ' ' + esc(g.name) + ' <span class="mono muted" style="font-size:11px">' + esc(g.id) + '</span></td>' +
        '<td class="num">' + cs.total + '</td><td class="num">' + cs.counts.pass + '</td><td class="num">' + cs.counts.fail + '</td>' +
        '<td class="num">' + cs.counts.warning + '</td><td class="num">' + cs.counts.na + '</td><td class="num">' + cs.risk + '</td>' +
        '<td style="min-width:120px">' + progressHtml(cs) + '</td></tr>';
    }).join('');

    var findingHtml = function (e) {
      var it = e.it;
      return '<div class="finding"><div class="finding-head">' + sevBadge(it.severity) + '<span class="mono muted">' + esc(it.wstgId) + '</span><b>' + esc(it.title) + '</b>' +
        (it.evidence ? '<span class="ev-flag">Evidence</span>' : '') +
        '<span style="flex:1"></span><button class="btn btn-ghost btn-sm" type="button" data-action="goto-item" data-idx="' + e.idx + '">Open ' + svg('arrow', 'i-sm') + '</button></div>' +
        (it.note.trim() ? '<pre class="note-text">' + esc(it.note) + '</pre>' : '<span class="muted" style="font-size:13px">No note recorded.</span>') + '</div>';
    };

    body.innerHTML =
      '<div class="kpis" style="margin-bottom:16px">' +
        kpi(s.pct + '%', 'Completion (' + s.done + ' of ' + s.applicable + ' applicable)') +
        kpi(s.risk, 'Risk score (failed tests, severity-weighted)', s.risk ? 'var(--st-fail)' : '') +
        kpi(s.counts.fail, 'Failed tests', s.counts.fail ? 'var(--st-fail)' : '') +
        kpi(s.notes, 'Tests with notes (' + s.evidence + ' evidence)') +
      '</div>' +
      '<div class="dash">' +
        '<div class="card span-6"><h3>Status breakdown</h3><div class="bars">' +
          STATUSES.map(function (st) {
            return '<div class="bar"><span>' + st.emoji + ' ' + st.label + '</span><div class="track"><div class="fill" style="--c:' + stColor(st.id) + ';width:' + (s.counts[st.id] / maxCount * 100).toFixed(1) + '%"></div></div><span class="n">' + s.counts[st.id] + '</span></div>';
          }).join('') +
        '</div></div>' +
        '<div class="card span-6"><h3>Failed tests by severity</h3><div class="bars">' +
          SEVERITIES.map(function (v) {
            return '<div class="bar"><span>' + sevBadge(v) + ' <span class="muted" style="font-size:11px">×' + SEV_WEIGHT[v] + '</span></span><div class="track"><div class="fill" style="--c:var(--sev-' + v + ');width:' + (s.failBySev[v] / maxFail * 100).toFixed(1) + '%"></div></div><span class="n">' + s.failBySev[v] + '</span></div>';
          }).join('') +
        '</div><p class="muted" style="font-size:12px;margin:12px 0 0">Risk score = Σ severity weight of each failed test.</p></div>' +
        '<div class="card span-12"><h3>Progress by category</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Category</th><th class="num">Tests</th><th class="num">Pass</th><th class="num">Fail</th><th class="num">Warn</th><th class="num">N/A</th><th class="num">Risk</th><th>Completion</th></tr></thead><tbody>' + catRows + '</tbody></table></div></div>' +
        '<div class="card span-12"><h3>🔴 Findings — failed tests (' + fails.length + ')</h3>' +
          (fails.length ? fails.map(findingHtml).join('') : '<p class="muted" style="margin:0">No failed tests. 🎉</p>') + '</div>' +
        (warns.length ? '<div class="card span-12"><h3>🟡 Warnings — needs review (' + warns.length + ')</h3>' + warns.map(findingHtml).join('') + '</div>' : '') +
      '</div>';
  }

  // ---------- Live refresh after edits ----------
  function refreshStats(p) {
    var s = computeStats(p.items);
    var el = document.getElementById('projStats');
    if (el) el.innerHTML = projStatsHtml(s);
    var chips = document.getElementById('statusChips');
    if (chips) chips.innerHTML = chipsHtml(filtersFor(p.id), s);
    var nc = document.getElementById('notesCount');
    if (nc) nc.textContent = s.notes;
    var up = document.getElementById('projUpdated');
    if (up) { up.textContent = 'Updated ' + fmtRel(p.updatedAt); up.title = fmtDate(p.updatedAt); }
    var groups = null;
    document.querySelectorAll('.cat[data-cat]').forEach(function (catEl) {
      groups = groups || groupItems(p);
      var g = groups.filter(function (x) { return x.id === catEl.dataset.cat; })[0];
      if (!g) return;
      var target = catEl.querySelector('.cat-progress');
      if (target) target.innerHTML = catProgressHtml(computeStats(g.entries.map(function (e) { return e.it; })));
    });
  }

  function refreshItemRow(itemEl, it) {
    itemEl.style.setProperty('--c', stColor(it.status));
    var sel = itemEl.querySelector('[data-role="status"]');
    if (sel) { sel.style.setProperty('--c', stColor(it.status)); if (sel.value !== it.status) sel.value = it.status; }
    var t = itemEl.querySelector('.item-title');
    if (t) t.innerHTML = '<span class="t">' + esc(it.title) + '</span>' + itemFlagsHtml(it);
    var up = itemEl.querySelector('.item-updated');
    if (up) { up.textContent = it.updatedAt ? 'Updated ' + fmtRel(it.updatedAt) : 'Not updated yet'; up.title = fmtDate(it.updatedAt); }
    var ev = itemEl.querySelector('.ev-time');
    if (ev) ev.textContent = it.evidence && it.evidenceAt ? 'Evidence recorded ' + fmtDate(it.evidenceAt) : '';
  }

  // ============================================================
  // Item editing
  // ============================================================
  var noteTimers = {};   // "pid:idx" -> timeout id

  function itemContext(el) {
    var p = currentProject();
    var itemEl = el.closest('.item');
    if (!p || !itemEl) return null;
    var idx = +itemEl.dataset.idx;
    var it = p.items[idx];
    return it ? { p: p, it: it, idx: idx, el: itemEl } : null;
  }

  function setStatus(ctx, status) {
    if (!STATUS_MAP[status] || ctx.it.status === status) return;
    ctx.it.status = status;
    ctx.it.updatedAt = nowIso();
    touch(ctx.p);
    if (save()) toast(ctx.it.wstgId + ' → ' + STATUS_MAP[status].label, status, 'status');
    refreshItemRow(ctx.el, ctx.it);
    refreshStats(ctx.p);
  }

  function noteInput(ctx, value) {
    ctx.it.note = value;
    var key = ctx.p.id + ':' + ctx.idx;
    var st = ctx.el.querySelector('.save-state');
    if (st) { st.textContent = 'Saving…'; st.className = 'save-state'; }
    clearTimeout(noteTimers[key]);
    noteTimers[key] = setTimeout(function () { commitNote(ctx.p, ctx.idx); }, NOTE_DEBOUNCE_MS);
  }

  function commitNote(p, idx) {
    var key = p.id + ':' + idx;
    if (!(key in noteTimers)) return;
    clearTimeout(noteTimers[key]);
    delete noteTimers[key];
    var it = p.items[idx];
    if (!it) return;
    it.updatedAt = nowIso();
    touch(p);
    var ok = save();
    // Only touch the DOM if this project is still on screen.
    var cur = currentProject();
    if (cur !== p) return;
    var itemEl = app.querySelector('.item[data-idx="' + idx + '"]');
    if (itemEl) {
      var st = itemEl.querySelector('.save-state');
      if (st) { st.textContent = ok ? 'Saved ✓' : 'Not saved'; st.className = 'save-state' + (ok ? ' ok' : ''); }
      refreshItemRow(itemEl, it);
    }
    refreshStats(p);
  }

  function flushNotes() {
    Object.keys(noteTimers).forEach(function (key) {
      var cut = key.lastIndexOf(':');
      var p = getProject(key.slice(0, cut));
      if (p) commitNote(p, +key.slice(cut + 1));
      else { clearTimeout(noteTimers[key]); delete noteTimers[key]; }
    });
  }

  function setEvidence(ctx, on) {
    ctx.it.evidence = on;
    ctx.it.evidenceAt = on ? nowIso() : null;
    ctx.it.updatedAt = nowIso();
    touch(ctx.p);
    if (save()) toast(on ? 'Marked as evidence' : 'Evidence mark removed', on ? 'in_progress' : 'not_tested', 'evidence');
    refreshItemRow(ctx.el, ctx.it);
    refreshStats(ctx.p);
  }

  function setTags(ctx, value) {
    var tags = [];
    value.split(',').forEach(function (t) {
      t = t.trim().toLowerCase().slice(0, 40);
      if (t && tags.indexOf(t) < 0) tags.push(t);
    });
    tags = tags.slice(0, 20);
    if (tags.join(',') === ctx.it.tags.join(',')) return;
    ctx.it.tags = tags;
    ctx.it.updatedAt = nowIso();
    touch(ctx.p);
    if (save()) toast('Tags saved', 'pass', 'tags');
    var input = ctx.el.querySelector('[data-role="tags"]');
    if (input) input.value = tags.join(', ');
    refreshItemRow(ctx.el, ctx.it);
  }

  function toggleItem(itemEl, force) {
    var p = currentProject();
    if (!p) return;
    var open = typeof force === 'boolean' ? force : itemEl.dataset.open !== 'true';
    itemEl.dataset.open = String(open);
    itemEl.querySelector('.item-row').setAttribute('aria-expanded', String(open));
    itemEl.querySelector('.item-detail').inert = !open;
    var key = p.id + ':' + itemEl.dataset.idx;
    if (open) ui.open[key] = true; else delete ui.open[key];
  }

  function toggleCat(catEl, force) {
    var p = currentProject();
    if (!p) return;
    var open = typeof force === 'boolean' ? force : catEl.dataset.open !== 'true';
    catEl.dataset.open = String(open);
    catEl.querySelector('.cat-head').setAttribute('aria-expanded', String(open));
    catEl.querySelector('.cat-body').inert = !open;
    return open;
  }

  function gotoItem(p, idx) {
    var it = p.items[idx];
    if (!it) return;
    ui.filters[p.id] = null;
    filtersFor(p.id);
    setCollapsed(p.id, catIdOf(it), false);
    ui.open[p.id + ':' + idx] = true;
    ui.pendingFocus = idx; // consumed by renderChecklist once the list is on screen
    var target = '#/p/' + encodeURIComponent(p.id) + '/checklist';
    if (location.hash !== target) location.hash = target;
    else route();
  }

  function focusPendingItem() {
    if (ui.pendingFocus == null) return;
    var idx = ui.pendingFocus;
    ui.pendingFocus = null;
    requestAnimationFrame(function () {
      var el = app.querySelector('.item[data-idx="' + idx + '"]');
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash');
      setTimeout(function () { el.classList.remove('flash'); }, 1500);
      var ta = el.querySelector('textarea');
      if (ta) setTimeout(function () { ta.focus({ preventScroll: true }); }, 400);
    });
  }

  // ============================================================
  // Project actions
  // ============================================================
  function projectForm(existing) {
    var p = existing || {};
    var body =
      '<div class="form-field"><label for="pf-name">Project name *</label><input class="input" id="pf-name" maxlength="120" required value="' + esc(p.name || '') + '" placeholder="e.g. Customer Portal Q3 assessment"><div class="err" id="pf-err" hidden></div></div>' +
      '<div class="form-field"><label for="pf-desc">Description</label><textarea class="textarea" id="pf-desc" maxlength="2000" style="min-height:72px" placeholder="Scope, dates, testers…">' + esc(p.description || '') + '</textarea></div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label for="pf-url">Target URL</label><input class="input mono" id="pf-url" type="url" maxlength="2000" value="' + esc(p.targetUrl || '') + '" placeholder="https://example.com"><div class="err" id="pf-url-err" hidden></div></div>' +
        '<div class="form-field"><label for="pf-env">Environment</label><select class="select" id="pf-env">' +
          ENVS.map(function (e) { return '<option value="' + e[0] + '"' + ((p.environment || '') === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join('') +
        '</select></div>' +
      '</div>' +
      (existing ? '' : '<p class="muted" style="font-size:12px">The project starts with the full OWASP WSTG checklist (' + TOTAL_TESTS + ' tests), all set to Not Tested.</p>');

    openModal({
      title: existing ? 'Edit project' : 'New project',
      body: body,
      actions: [
        { label: 'Cancel' },
        {
          label: existing ? 'Save changes' : 'Create project', cls: 'btn-primary', submit: true,
          run: function (m) {
            var name = m.querySelector('#pf-name').value.trim();
            var url = m.querySelector('#pf-url').value.trim();
            var err = m.querySelector('#pf-err'), uerr = m.querySelector('#pf-url-err');
            err.hidden = !!name; err.textContent = 'Please enter a project name.';
            var urlBad = url && !safeHref(url);
            uerr.hidden = !urlBad; uerr.textContent = 'Use a full http(s):// URL.';
            if (!name) { m.querySelector('#pf-name').focus(); return false; }
            if (urlBad) { m.querySelector('#pf-url').focus(); return false; }
            var fields = {
              name: name,
              description: m.querySelector('#pf-desc').value.trim(),
              targetUrl: url,
              environment: m.querySelector('#pf-env').value
            };
            if (existing) {
              Object.keys(fields).forEach(function (k) { existing[k] = fields[k]; });
              touch(existing);
              if (save()) toast('Project updated', 'pass');
            } else {
              db.projects.push(createProject(fields));
              if (save()) toast('Project “' + name + '” created', 'pass');
              ui.homeQuery = '';
            }
            route();
            return true;
          }
        }
      ],
      focus: '#pf-name'
    });
  }

  function duplicateProject(p) {
    var copy = JSON.parse(JSON.stringify(p));
    copy.id = uid();
    copy.name = (p.name + ' (copy)').slice(0, 120);
    copy.createdAt = copy.updatedAt = nowIso();
    db.projects.push(copy);
    var c = collapsedSet(p.id);
    if (c.length) db.settings.collapsed[copy.id] = c.slice();
    if (save()) toast('Duplicated as “' + copy.name + '”', 'pass');
    if (ui.route.view === 'home') renderProjectGrid();
    else location.hash = '#/p/' + encodeURIComponent(copy.id);
  }

  function deleteProject(p) {
    openModal({
      title: 'Delete project?',
      body: '<p>This permanently deletes <b>' + esc(p.name) + '</b> including all statuses and notes. This cannot be undone.</p>' +
        '<p class="muted" style="font-size:13px">Tip: export a JSON backup first if you might need it later.</p>',
      actions: [
        { label: 'Cancel', autofocus: true },
        {
          label: 'Delete project', cls: 'btn-danger',
          run: function () {
            flushNotes();
            db.projects = db.projects.filter(function (x) { return x.id !== p.id; });
            delete db.settings.collapsed[p.id];
            delete ui.filters[p.id];
            Object.keys(ui.open).forEach(function (k) { if (k.indexOf(p.id + ':') === 0) delete ui.open[k]; });
            if (save()) toast('Project deleted', 'fail');
            if (ui.route.view === 'home') renderHome();
            else location.hash = '#/';
            return true;
          }
        }
      ]
    });
  }

  function resetProject(p) {
    openModal({
      title: 'Reset checklist?',
      body: '<p>Set every test in <b>' + esc(p.name) + '</b> back to <b>Not Tested</b>.</p>' +
        '<label class="check"><input type="checkbox" id="rs-notes"> Also clear all notes, evidence marks and custom tags</label>',
      actions: [
        { label: 'Cancel', autofocus: true },
        {
          label: 'Reset', cls: 'btn-danger',
          run: function (m) {
            flushNotes();
            var clearNotes = m.querySelector('#rs-notes').checked;
            var defaults = {};
            freshItems().forEach(function (it) { defaults[it.wstgId] = it.tags; });
            var t = nowIso();
            p.items.forEach(function (it) {
              it.status = 'not_tested';
              if (clearNotes) {
                it.note = ''; it.evidence = false; it.evidenceAt = null;
                it.tags = (defaults[it.wstgId] || []).slice();
              }
              it.updatedAt = t;
            });
            touch(p);
            if (save()) toast('Checklist reset', 'not_tested');
            route();
            return true;
          }
        }
      ]
    });
  }

  // ============================================================
  // Export / Import
  // ============================================================
  function exportPayload(projects) {
    return JSON.stringify({
      app: APP_ID,
      version: DATA_VERSION,
      exportedAt: nowIso(),
      projects: projects,
      settings: { theme: db.settings.theme }
    }, null, 2);
  }

  function showExport(filename, content) {
    openModal({
      title: 'Export ' + filename,
      body: '<p>Copy this and save it as <b class="mono">' + esc(filename) + '</b>.</p>' +
        '<textarea class="textarea mono" id="exportText" readonly spellcheck="false" style="min-height:280px;font-size:12px;font-family:var(--mono)">' + esc(content) + '</textarea>',
      actions: [
        { label: 'Close' },
        {
          label: 'Copy to clipboard', cls: 'btn-primary',
          run: function (m) {
            var ta = m.querySelector('#exportText');
            function fallback() { ta.focus(); ta.select(); toast('Text selected. Press Ctrl+C (⌘C) to copy.', 'in_progress', 'copy'); }
            try {
              navigator.clipboard.writeText(content).then(function () { toast('Copied to clipboard', 'pass', 'copy'); }, fallback);
            } catch (e) { fallback(); }
            return false;
          }
        }
      ]
    });
  }

  function exportAll() {
    flushNotes();
    download('wstg-checklist-backup-' + today() + '.json', exportPayload(db.projects), 'application/json');
    toast('Exported ' + plural(db.projects.length, 'project') + ' as JSON', 'pass');
  }

  function exportProjectJson(p) {
    flushNotes();
    download(slug(p.name) + '-wstg-' + today() + '.json', exportPayload([p]), 'application/json');
    toast('Project exported as JSON', 'pass');
  }

  function mdCell(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim() || '—';
  }

  function mdInline(s) {
    // Neutralise markdown/HTML control characters in inline text.
    return String(s == null ? '' : s).replace(/([\\`*_{}\[\]<>#|])/g, '\\$1');
  }

  function mdFence(text) {
    var runs = String(text).match(/`+/g) || [];
    var longest = runs.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var fence = new Array(Math.max(3, longest + 1) + 1).join('`');
    return fence + 'text\n' + text.replace(/\s+$/, '') + '\n' + fence;
  }

  function buildMarkdown(p) {
    var s = computeStats(p.items);
    var fails = entriesWithStatus(p, 'fail');
    var warns = entriesWithStatus(p, 'warning');
    var blocked = entriesWithStatus(p, 'blocked');
    var inprog = entriesWithStatus(p, 'in_progress');
    var envLabel = (ENVS.filter(function (e) { return e[0] === p.environment; })[0] || ['', 'Not set'])[1];
    var L = [];

    L.push('# Security Assessment Report — ' + mdInline(p.name), '');
    L.push('_Generated ' + fmtDate(nowIso()) + ' from the OWASP WSTG checklist._', '');
    L.push('## Project', '');
    L.push('| Field | Value |', '|---|---|');
    L.push('| Project | ' + mdCell(p.name) + ' |');
    L.push('| Target URL | ' + mdCell(p.targetUrl) + ' |');
    L.push('| Environment | ' + mdCell(envLabel) + ' |');
    L.push('| Description | ' + mdCell(p.description) + ' |');
    L.push('| Created | ' + mdCell(fmtDate(p.createdAt)) + ' |');
    L.push('| Last updated | ' + mdCell(fmtDate(p.updatedAt)) + ' |');
    L.push('');

    L.push('## Summary', '');
    L.push('| Metric | Value |', '|---|---:|');
    L.push('| Total tests | ' + s.total + ' |');
    L.push('| Applicable (excl. N/A) | ' + s.applicable + ' |');
    L.push('| Completed (Pass + Fail + Warning) | ' + s.done + ' |');
    L.push('| **Completion** | **' + s.pct + '%** |');
    L.push('| **Risk score** | **' + s.risk + '** |');
    L.push('| Tests with notes | ' + s.notes + ' |');
    L.push('');
    L.push('### Status breakdown', '');
    L.push('| Status | Count |', '|---|---:|');
    STATUSES.forEach(function (st) { L.push('| ' + st.emoji + ' ' + st.label + ' | ' + s.counts[st.id] + ' |'); });
    L.push('');
    L.push('### Failed tests by severity', '');
    L.push('| Severity | Weight | Failed |', '|---|---:|---:|');
    SEVERITIES.forEach(function (v) { L.push('| ' + cap(v) + ' | ' + SEV_WEIGHT[v] + ' | ' + s.failBySev[v] + ' |'); });
    L.push('');
    L.push('_Risk score = sum of severity weights of failed tests (Critical 5, High 4, Medium 3, Low 2, Info 1)._', '');

    function block(e, n) {
      var it = e.it;
      var ref = safeHref(it.reference);
      L.push('### ' + n + '. [' + it.severity.toUpperCase() + '] ' + mdInline(it.wstgId) + ' — ' + mdInline(it.title), '');
      L.push('- **Category:** ' + mdInline(it.category));
      L.push('- **Severity:** ' + cap(it.severity));
      L.push('- **Status:** ' + STATUS_MAP[it.status].label);
      if (ref) L.push('- **Reference:** <' + ref + '>');
      if (it.tags.length) L.push('- **Tags:** ' + it.tags.map(function (t) { return '`' + t.replace(/`/g, '') + '`'; }).join(', '));
      L.push('- **Last updated:** ' + fmtDate(it.updatedAt));
      if (it.evidence) L.push('- **Evidence:** yes' + (it.evidenceAt ? ' (recorded ' + fmtDate(it.evidenceAt) + ')' : ''));
      L.push('');
      if (it.description) L.push('**Description:** ' + mdInline(it.description), '');
      L.push('**Notes:**', '');
      L.push(it.note.trim() ? mdFence(it.note) : '_No note recorded._');
      L.push('');
    }

    L.push('## Findings — Failed tests (' + fails.length + ')', '');
    if (fails.length) fails.forEach(function (e, i) { block(e, i + 1); });
    else L.push('_No failed tests._', '');

    L.push('## Warnings — Needs review (' + warns.length + ')', '');
    if (warns.length) warns.forEach(function (e, i) { block(e, i + 1); });
    else L.push('_No warnings._', '');

    if (blocked.length || inprog.length) {
      L.push('## Open items', '');
      L.push('| ID | Title | Severity | Status | Note |', '|---|---|---|---|---|');
      blocked.concat(inprog).forEach(function (e) {
        L.push('| ' + mdCell(e.it.wstgId) + ' | ' + mdCell(e.it.title) + ' | ' + cap(e.it.severity) + ' | ' + STATUS_MAP[e.it.status].label + ' | ' + mdCell(e.it.note) + ' |');
      });
      L.push('');
    }

    L.push('## Progress by category', '');
    L.push('| Category | Tests | Pass | Fail | Warning | N/A | Not tested | Completion |', '|---|---:|---:|---:|---:|---:|---:|---:|');
    groupItems(p).forEach(function (g) {
      var cs = computeStats(g.entries.map(function (e) { return e.it; }));
      L.push('| ' + mdCell(g.id + ' ' + g.name) + ' | ' + cs.total + ' | ' + cs.counts.pass + ' | ' + cs.counts.fail + ' | ' + cs.counts.warning + ' | ' + cs.counts.na + ' | ' + cs.counts.not_tested + ' | ' + cs.pct + '% |');
    });
    L.push('');

    L.push('## Appendix — All tests', '');
    L.push('| ID | Title | Severity | Status | Note |', '|---|---|---|---|---|');
    p.items.forEach(function (it) {
      L.push('| ' + mdCell(it.wstgId) + ' | ' + mdCell(it.title) + ' | ' + cap(it.severity) + ' | ' + STATUS_MAP[it.status].label + ' | ' + (it.note.trim() ? 'Yes' : '') + ' |');
    });
    L.push('', '---', 'Reference: OWASP Web Security Testing Guide — <https://owasp.org/www-project-web-security-testing-guide/>', '');
    return L.join('\n');
  }

  function exportMarkdown(p) {
    flushNotes();
    download(slug(p.name) + '-wstg-report-' + today() + '.md', buildMarkdown(p), 'text/markdown');
    toast('Markdown report exported', 'pass');
  }

  function extractProjects(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.projects)) return data.projects;
    if (data && Array.isArray(data.items) && data.name) return [data];
    return null;
  }

  function importFile(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('That file is too large to be a checklist backup (max 20 MB).', 'fail'); return; }
    var reader = new FileReader();
    reader.onerror = function () { toast('Could not read the file.', 'fail'); };
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); }
      catch (e) { toast('Import failed: the file is not valid JSON.', 'fail'); return; }
      var raw = extractProjects(data);
      if (!raw) { toast('Import failed: no projects found in this file.', 'fail'); return; }
      var incoming = raw.map(normalizeProject).filter(Boolean);
      if (!incoming.length) { toast('Import failed: no valid projects found.', 'fail'); return; }
      confirmImport(incoming, raw.length - incoming.length, data && data.settings);
    };
    reader.readAsText(file);
  }

  function confirmImport(incoming, skipped, settings) {
    var existingIds = {};
    db.projects.forEach(function (p) { existingIds[p.id] = true; });
    var overlap = incoming.filter(function (p) { return existingIds[p.id]; }).length;
    var names = incoming.slice(0, 6).map(function (p) { return '<li>' + esc(p.name) + ' <span class="muted">(' + plural(p.items.length, 'test') + ')</span></li>'; }).join('') +
      (incoming.length > 6 ? '<li class="muted">…and ' + (incoming.length - 6) + ' more</li>' : '');

    openModal({
      title: 'Import ' + plural(incoming.length, 'project') + '?',
      body: '<ul style="margin:0;padding-left:20px">' + names + '</ul>' +
        (skipped ? '<p class="muted" style="font-size:13px">' + plural(skipped, 'entry', 'entries') + ' skipped because they were invalid.</p>' : '') +
        '<p><b>Merge</b> adds these projects to your ' + plural(db.projects.length, 'existing project') + (overlap ? ' and <b>replaces ' + overlap + '</b> with the same ID' : '') + '.</p>' +
        '<p><b>Replace all</b> deletes all ' + plural(db.projects.length, 'current project') + ' first. This cannot be undone.</p>',
      actions: [
        { label: 'Cancel', autofocus: true },
        {
          label: 'Replace all', cls: 'btn-danger',
          run: function () { applyImport(incoming, true, settings); return true; }
        },
        {
          label: 'Merge', cls: 'btn-primary',
          run: function () { applyImport(incoming, false, settings); return true; }
        }
      ]
    });
  }

  function applyImport(incoming, replace, settings) {
    flushNotes();
    if (replace) {
      db.projects = incoming;
      db.settings.collapsed = {};
      ui.filters = {};
      ui.open = {};
    } else {
      var byId = {};
      incoming.forEach(function (p) { byId[p.id] = p; });
      db.projects = db.projects.filter(function (p) { return !byId[p.id]; }).concat(incoming);
    }
    if (settings && settings.collapsed && typeof settings.collapsed === 'object' && replace) {
      db.settings.collapsed = settings.collapsed;
    }
    if (save()) toast('Imported ' + plural(incoming.length, 'project'), 'pass');
    if (ui.route.view === 'project' && !currentProject()) location.hash = '#/';
    else route();
  }

  // ============================================================
  // Menu
  // ============================================================
  function openMenu(btn, id) {
    var wasOpen = ui.menu && ui.menu.btn === btn;
    closeMenu();
    if (wasOpen) return;
    var inProject = ui.route.view === 'project';
    var items = [
      !inProject && ['open-project', '📂', 'Open'],
      ['edit-project', '✏️', 'Edit / Rename'],
      ['duplicate-project', '📄', 'Duplicate'],
      'hr',
      ['export-md', '📝', 'Export Markdown report'],
      ['export-project-json', '💾', 'Export project JSON'],
      'hr',
      ['reset-project', '↺', 'Reset checklist…'],
      ['delete-project', '🗑️', 'Delete project…', 'danger']
    ].filter(Boolean);
    var m = document.createElement('div');
    m.className = 'menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = items.map(function (x) {
      if (x === 'hr') return '<hr>';
      return '<button type="button" role="menuitem" data-action="' + x[0] + '" data-id="' + esc(id) + '"' + (x[3] ? ' class="' + x[3] + '"' : '') + '><span aria-hidden="true">' + x[1] + '</span>' + x[2] + '</button>';
    }).join('');
    btn.parentNode.appendChild(m);
    btn.setAttribute('aria-expanded', 'true');
    ui.menu = { el: m, btn: btn };
    var first = m.querySelector('button');
    if (first) first.focus();
  }

  function closeMenu(restoreFocus) {
    if (!ui.menu) return;
    ui.menu.el.remove();
    ui.menu.btn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) ui.menu.btn.focus();
    ui.menu = null;
  }

  // ============================================================
  // Modal
  // ============================================================
  var modalStack = [];

  function openModal(opts) {
    var prevFocus = document.activeElement;
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    var titleId = 'modal-title-' + Date.now();
    backdrop.innerHTML =
      '<form class="modal" role="dialog" aria-modal="true" aria-labelledby="' + titleId + '" novalidate>' +
        '<div class="modal-head"><h2 id="' + titleId + '">' + esc(opts.title) + '</h2>' +
          '<button class="btn btn-ghost btn-sm btn-icon" type="button" data-close aria-label="Close">' + svg('x', 'i-sm') + '</button></div>' +
        '<div class="modal-body">' + opts.body + '</div>' +
        '<div class="modal-foot"></div>' +
      '</form>';
    var form = backdrop.querySelector('.modal');
    var foot = backdrop.querySelector('.modal-foot');
    var autofocusEl = null;
    var submitAction = null;

    function close() {
      backdrop.remove();
      modalStack = modalStack.filter(function (x) { return x !== api; });
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus();
    }

    function runAction(a) {
      if (!a.run) { close(); return; }
      if (a.run(form) !== false) close();
    }

    (opts.actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.type = a.submit ? 'submit' : 'button';
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.label;
      if (a.submit) submitAction = a;
      else b.addEventListener('click', function () { runAction(a); });
      if (a.autofocus) autofocusEl = b;
      foot.appendChild(b);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitAction) runAction(submitAction);
    });
    backdrop.querySelector('[data-close]').addEventListener('click', close);
    backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) close(); });
    backdrop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(form.querySelectorAll('button, input, select, textarea, a[href]'), function (el) { return !el.disabled && el.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    modalRoot.appendChild(backdrop);
    var api = { close: close };
    modalStack.push(api);
    var focusTarget = (opts.focus && form.querySelector(opts.focus)) || autofocusEl || form.querySelector('input, select, textarea, .modal-foot button');
    if (focusTarget) setTimeout(function () { focusTarget.focus(); if (focusTarget.select && focusTarget.tagName === 'INPUT') focusTarget.select(); }, 20);
    return api;
  }

  // ============================================================
  // Toasts
  // ============================================================
  var toastsByKey = {};

  function toast(msg, kind, key) {
    var color = kind && STATUS_MAP[kind] ? stColor(kind) : 'var(--st-pass)';
    if (key && toastsByKey[key] && document.contains(toastsByKey[key].el)) {
      var t = toastsByKey[key];
      t.el.querySelector('.msg').textContent = msg;
      t.el.style.setProperty('--c', color);
      clearTimeout(t.timer);
      t.timer = setTimeout(function () { dismiss(t.el, key); }, 2600);
      return;
    }
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.style.setProperty('--c', color);
    el.innerHTML = '<span class="dot"></span><span class="msg"></span>';
    el.querySelector('.msg').textContent = msg;
    toastRoot.appendChild(el);
    while (toastRoot.children.length > 4) toastRoot.firstChild.remove();
    var timer = setTimeout(function () { dismiss(el, key); }, 2600);
    if (key) toastsByKey[key] = { el: el, timer: timer };
  }

  function dismiss(el, key) {
    el.classList.add('out');
    setTimeout(function () { el.remove(); }, 220);
    if (key && toastsByKey[key] && toastsByKey[key].el === el) delete toastsByKey[key];
  }

  // ============================================================
  // Theme
  // ============================================================
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
  }

  function toggleTheme() {
    db.settings.theme = db.settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(db.settings.theme);
    save();
  }

  // ============================================================
  // Router
  // ============================================================
  function route() {
    flushNotes();
    closeMenu();
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var prev = ui.route;
    if (parts[0] === 'p' && parts[1]) {
      var p = getProject(decodeURIComponent(parts[1]));
      if (!p) { toast('That project no longer exists.', 'fail'); location.replace('#/'); return; }
      var tab = TABS.indexOf(parts[2]) >= 0 ? parts[2] : 'checklist';
      ui.route = { view: 'project', id: p.id, tab: tab };
      renderProject(p, tab);
    } else {
      ui.route = { view: 'home' };
      renderHome();
    }
    var moved = prev.view !== ui.route.view || prev.id !== ui.route.id || prev.tab !== ui.route.tab;
    if (moved && ui.pendingFocus == null) window.scrollTo(0, 0);
  }

  // ============================================================
  // Events
  // ============================================================
  function handleAction(action, el) {
    var id = el.dataset.id;
    var p = id ? getProject(id) : currentProject();
    switch (action) {
      case 'toggle-theme': toggleTheme(); break;
      case 'export-all': exportAll(); break;
      case 'import': document.getElementById('importFile').click(); break;
      case 'new-project': projectForm(null); break;
      case 'open-project': closeMenu(); location.hash = '#/p/' + encodeURIComponent(id); break;
      case 'project-menu': openMenu(el, id); break;
      case 'edit-project': closeMenu(); if (p) projectForm(p); break;
      case 'duplicate-project': closeMenu(); if (p) duplicateProject(p); break;
      case 'export-md': closeMenu(); if (p) exportMarkdown(p); break;
      case 'export-project-json': closeMenu(); if (p) exportProjectJson(p); break;
      case 'reset-project': closeMenu(); if (p) resetProject(p); break;
      case 'delete-project': closeMenu(); if (p) deleteProject(p); break;
      case 'set-tab':
        if (p) location.hash = '#/p/' + encodeURIComponent(p.id) + '/' + el.dataset.tab;
        break;
      case 'toggle-cat': {
        var catEl = el.closest('.cat');
        var open = toggleCat(catEl);
        if (p) setCollapsed(p.id, catEl.dataset.cat, !open);
        break;
      }
      case 'toggle-item': toggleItem(el.closest('.item')); break;
      case 'expand-all':
      case 'collapse-all': {
        if (!p) break;
        var expand = action === 'expand-all';
        db.settings.collapsed[p.id] = expand ? [] : groupItems(p).map(function (g) { return g.id; });
        save();
        app.querySelectorAll('.cat').forEach(function (c) { toggleCat(c, expand); });
        break;
      }
      case 'status-filter': {
        if (!p) break;
        var f = filtersFor(p.id);
        f.status = el.dataset.v;
        app.querySelectorAll('#statusChips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.v === f.status)); });
        renderChecklist(p);
        break;
      }
      case 'toggle-fails': {
        if (!p) break;
        var ff = filtersFor(p.id);
        ff.onlyFails = !ff.onlyFails;
        el.setAttribute('aria-pressed', String(ff.onlyFails));
        renderChecklist(p);
        break;
      }
      case 'clear-filters':
        if (p) { ui.filters[p.id] = null; renderProject(p, ui.route.tab); }
        break;
      case 'goto-item':
        if (p) gotoItem(p, +el.dataset.idx);
        break;
    }
  }

  document.addEventListener('click', function (e) {
    if (ui.menu && !ui.menu.el.contains(e.target) && !ui.menu.btn.contains(e.target)) closeMenu();
    var el = e.target.closest('[data-action]');
    if (!el || el.closest('.modal-backdrop')) return;
    // Clicks on a nested control (status select, link, input) must not trigger the row action.
    var inner = e.target.closest('select, input, textarea, a, button, label');
    if (inner && inner !== el && el.contains(inner)) return;
    if (el.tagName === 'A') return;
    handleAction(el.dataset.action, el);
  });

  document.addEventListener('keydown', function (e) {
    if (modalStack.length) return; // modal handles its own keys
    var tgt = e.target;
    var typing = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable);

    if (e.key === 'Escape') {
      if (ui.menu) { closeMenu(true); return; }
      if (tgt && tgt.id === 'q' && tgt.value) { tgt.value = ''; tgt.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if (typing) { tgt.blur(); return; }
      var openItem = tgt && tgt.closest && tgt.closest('.item[data-open="true"]');
      if (openItem) { toggleItem(openItem, false); openItem.querySelector('.item-row').focus(); }
      return;
    }

    if (ui.menu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      var btns = Array.prototype.slice.call(ui.menu.el.querySelectorAll('button'));
      var i = btns.indexOf(document.activeElement);
      i = e.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length;
      btns[i].focus();
      return;
    }

    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var q = document.getElementById('q') || document.getElementById('homeSearch');
      if (q) { e.preventDefault(); q.focus(); q.select(); }
      return;
    }

    if ((e.key === 'Enter' || e.key === ' ') && tgt && tgt.dataset && tgt.dataset.action &&
        (tgt.getAttribute('role') === 'button' || tgt.getAttribute('role') === 'link')) {
      e.preventDefault();
      handleAction(tgt.dataset.action, tgt);
    }
  });

  var rerenderChecklist = debounce(function () {
    var p = currentProject();
    if (p && ui.route.tab === 'checklist') renderChecklist(p);
  }, 120);

  app.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'homeSearch') { ui.homeQuery = t.value; renderProjectGrid(); return; }
    if (t.id === 'q') {
      var p = currentProject();
      if (p) { filtersFor(p.id).q = t.value; rerenderChecklist(); }
      return;
    }
    if (t.dataset.role === 'note') {
      var ctx = itemContext(t);
      if (ctx) noteInput(ctx, t.value);
    }
  });

  app.addEventListener('change', function (e) {
    var t = e.target;
    var p = currentProject();
    if (!p) return;
    if (t.id === 'fSev') { filtersFor(p.id).severity = t.value; renderChecklist(p); return; }
    if (t.id === 'fCat') { filtersFor(p.id).category = t.value; renderChecklist(p); return; }
    var ctx = itemContext(t);
    if (!ctx) return;
    if (t.dataset.role === 'status') setStatus(ctx, t.value);
    else if (t.dataset.role === 'evidence') setEvidence(ctx, t.checked);
    else if (t.dataset.role === 'tags') setTags(ctx, t.value);
  });

  app.addEventListener('focusout', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.role === 'note') {
      var ctx = itemContext(t);
      if (ctx) commitNote(ctx.p, ctx.idx);
    }
  });

  app.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key === 'Enter' && t.dataset && t.dataset.role === 'tags') { e.preventDefault(); t.blur(); }
    // Ctrl/Cmd+Enter in a note saves immediately.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && t.dataset && t.dataset.role === 'note') {
      var ctx = itemContext(t);
      if (ctx) commitNote(ctx.p, ctx.idx);
    }
  });

  document.querySelector('.topbar').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'themeToggle') handleAction('toggle-theme', b);
    else if (b.id === 'exportAllBtn') handleAction('export-all', b);
    else if (b.id === 'importBtn') handleAction('import', b);
  });

  document.getElementById('importFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    importFile(file);
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', flushNotes);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushNotes(); });

  // Keep multiple open tabs in sync.
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    if (Object.keys(noteTimers).length || modalStack.length) return; // don't clobber in-progress edits
    var active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return;
    try {
      db = normalizeDb(JSON.parse(e.newValue));
      applyTheme(db.settings.theme);
      route();
    } catch (err) { /* ignore malformed */ }
  });

  // Refresh relative timestamps once a minute on the home page.
  setInterval(function () {
    var grid = document.getElementById('projectGrid');
    if (ui.route.view === 'home' && !ui.menu && !document.hidden && !modalStack.length &&
        !(grid && grid.contains(document.activeElement))) renderProjectGrid();
  }, 60000);

  // ============================================================
  // Boot
  // ============================================================
  applyTheme(db.settings.theme);
  if (!CATS.length) toast('wstg-data.js did not load. New projects will have an empty checklist.', 'fail');
  route();
  if (loaded.fresh) toast('Welcome! A demo project was added so you can explore.', 'in_progress');
})();
