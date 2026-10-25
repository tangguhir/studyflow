/* StudyFlow - inti aplikasi: state, panggilan API, rute, dan render. */
(function () {
  'use strict';
  var SF = window.SF = window.SF || {};
  var BASE = (window.STUDYFLOW && window.STUDYFLOW.base) || '';
  var API = BASE + '/api';

  SF.BASE = BASE;
  SF.API = API;

  var RETRYABLE = { 408: 1, 425: 1, 429: 1, 500: 1, 502: 1, 503: 1, 504: 1 };

  /** Panggilan API dengan percobaan ulang dan batas waktu, sama seperti versi Node. */
  SF.call = async function (path, options) {
    options = options || {};
    var idempotent = !options.method || options.method === 'GET';
    var tries = idempotent ? 5 : 3;
    var lastErr = null;

    for (var attempt = 0; attempt < tries; attempt++) {
      var ctl = new AbortController();
      var limit = attempt === tries - 1 ? 30000 : 15000;
      var timer = setTimeout(function () { ctl.abort(); }, limit);
      try {
        var headers = { 'Content-Type': 'application/json' };
        if (options.headers) {
          Object.keys(options.headers).forEach(function (k) { headers[k] = options.headers[k]; });
        }
        var res = await fetch(API + path, {
          method: options.method || 'GET',
          body: options.body,
          credentials: 'include',
          signal: ctl.signal,
          headers: headers
        });
        if (RETRYABLE[res.status] && attempt < tries - 1) {
          lastErr = new Error('server sibuk');
        } else if (!res.ok) {
          var body = await res.json().catch(function () { return {}; });
          var message = Array.isArray(body.message) ? body.message.join(' ') : (body.message || 'Terjadi kesalahan. Silakan coba lagi.');
          var err = new Error(message);
          err.status = res.status;
          throw err;
        } else {
          return res.status === 204 ? null : res.json();
        }
      } catch (e) {
        if (e && typeof e.status === 'number') throw e;
        lastErr = e;
      } finally {
        clearTimeout(timer);
      }
      if (attempt < tries - 1) {
        await new Promise(function (r) { setTimeout(r, Math.min(8000, 600 * Math.pow(2, attempt))); });
      }
    }
    var offline = new Error('Tidak dapat terhubung ke layanan StudyFlow. Periksa koneksi lalu coba lagi.');
    offline.offline = true;
    offline.cause = lastErr;
    throw offline;
  };

  // ------------------------------------------------------------------- state
  var PAGE_FOR_PATH = { '/dashboard': 'Dashboard', '/tugas': 'Semua tugas', '/kalender': 'Kalender', '/produktivitas': 'Produktivitas' };

  function blankForm() {
    return { name: '', course: '', weight: '20', difficulty: '2', hours: '3', deadline: '', startAt: '', emailReminder: true };
  }

  var S = SF.S = {
    path: '/login',
    mode: 'login',
    page: 'Dashboard',
    user: null,
    tasks: [],
    authResolved: false,
    connErr: false,
    auth: { name: '', email: '', password: '', confirmPassword: '' },
    showPassword: false,
    showConfirmPassword: false,
    subFor: null,
    subName: '',
    err: '',
    filter: 'Semua',
    search: '',
    modal: false,
    edit: null,
    formSubs: [],
    form: blankForm(),
    editingSubId: null,
    editingSubName: '',
    deleteTarget: null,
    mailMsg: null,
    mailBusy: null,
    mailStatus: null,
    mailSched: {},
    draggedSub: null,
    month: new Date()
  };

  SF.setPath = function (path) {
    S.path = path;
    S.page = PAGE_FOR_PATH[path] || 'Dashboard';
    S.mode = path === '/daftar' ? 'register' : 'login';
  };

  SF.currentPath = function () {
    var p = window.location.pathname;
    if (BASE && p.indexOf(BASE) === 0) p = p.slice(BASE.length);
    p = '/' + p.replace(/^\/+|\/+$/g, '');
    return p === '/' ? '/' : p;
  };

  SF.go = function (path, replace) {
    var target = BASE + path;
    if (window.location.pathname === target) return;
    if (replace) window.history.replaceState({}, '', target);
    else window.history.pushState({}, '', target);
    SF.setPath(path);
    render();
  };

  // ------------------------------------------------------------------ render
  /** Ingat fokus & posisi kursor agar input tidak kehilangan fokus saat render ulang. */
  function focusKey(el) {
    if (!el || !el.getAttribute) return null;
    var k = el.getAttribute('data-k');
    if (k) return 'k:' + k;
    var act = el.getAttribute('data-act');
    if (act) return 'a:' + act + '|' + (el.getAttribute('data-id') || '') + '|' + (el.getAttribute('data-sub') || '') + '|' + (el.getAttribute('data-index') || '');
    return null;
  }

  function rememberFocus() {
    var el = document.activeElement;
    var key = focusKey(el);
    if (!key) return null;
    var caret = null;
    try { caret = el.selectionStart; } catch (e) { caret = null; }
    return { key: key, caret: caret };
  }

  function restoreFocus(memo) {
    if (!memo) return;
    var nodes = document.querySelectorAll('[data-k],[data-act]');
    for (var i = 0; i < nodes.length; i++) {
      if (focusKey(nodes[i]) === memo.key) {
        nodes[i].focus();
        if (memo.caret != null && nodes[i].setSelectionRange) {
          try { nodes[i].setSelectionRange(memo.caret, memo.caret); } catch (e) { /* abaikan */ }
        }
        return;
      }
    }
  }

  function render() {
    var memo = rememberFocus();
    var root = document.getElementById('root');
    if (!root) return;

    var html;
    if (S.connErr && !S.user) {
      html = SF.viewConnErr(S);
    } else if (!S.authResolved) {
      html = SF.viewLoading();
    } else if (!S.user) {
      html = SF.viewAuth(S);
    } else if (S.path === '/login' || S.path === '/daftar') {
      html = SF.viewLoading();
    } else {
      html = SF.viewApp(S);
    }

    root.innerHTML = html;
    restoreFocus(memo);
  }
  SF.render = render;

  // -------------------------------------------------------------- muat data
  SF.load = async function () {
    for (var attempt = 0; attempt < 4; attempt++) {
      try {
        var profile = await SF.call('/auth/me');
        S.user = profile;
        S.connErr = false;
        S.authResolved = true;
        try {
          S.tasks = await SF.call('/tasks');
        } catch (e) {
          if (e && e.status === 401) { S.user = null; render(); return; }
          S.err = 'Gagal memuat daftar tugas. Coba lagi.';
        }
        try { S.mailStatus = await SF.call('/notifications/status'); } catch (e2) { /* opsional */ }
        SF.refreshSchedule();
        render();
        return;
      } catch (e) {
        if (e && e.status === 401) { S.user = null; S.authResolved = true; render(); return; }
        if (attempt === 3) {
          var hasSession = document.cookie.split('; ').some(function (c) { return c.indexOf('sf_token=') === 0; });
          if (hasSession) { S.connErr = true; S.authResolved = true; render(); return; }
          S.authResolved = true;
          S.err = 'Tidak dapat terhubung ke layanan StudyFlow. Periksa koneksi lalu coba lagi.';
          render();
          return;
        }
        await new Promise(function (res) { setTimeout(res, 700 * (attempt + 1)); });
      }
    }
  };

  SF.refreshSchedule = async function () {
    try {
      var sc = await SF.call('/notifications/schedule');
      var map = {};
      (sc.tasks || []).forEach(function (t) { map[t.id] = t.reminders || []; });
      S.mailSched = map;
    } catch (e) { /* biarkan jadwal lama */ }
  };

  // ------------------------------------------------------- sambung ulang
  SF.startReconnect = function () {
    if (SF._reconnectTimer) return;
    SF._reconnectTimer = setInterval(async function () {
      if (!S.connErr) {
        clearInterval(SF._reconnectTimer);
        SF._reconnectTimer = null;
        return;
      }
      try {
        var res = await fetch(API + '/health', { credentials: 'include' });
        if (res.ok) {
          S.connErr = false;
          S.authResolved = false;
          clearInterval(SF._reconnectTimer);
          SF._reconnectTimer = null;
          render();
          SF.load();
        }
      } catch (e) { /* coba lagi pada tick berikutnya */ }
    }, 4000);
  };

  // ---------------------------------------------------------------- start
  SF.start = function () {
    SF.setPath(SF.currentPath());
    window.addEventListener('popstate', function () {
      SF.setPath(SF.currentPath());
      render();
    });
    render();
    SF.load();

    // Jaga-jaga: bila sesi dimuat tetapi rute publik, pindahkan ke dashboard.
    var guard = setInterval(function () {
      if (!S.authResolved) return;
      var publicRoute = S.path === '/login' || S.path === '/daftar';
      if (S.user && publicRoute) { clearInterval(guard); SF.go('/dashboard', true); }
      else if (!S.user && !publicRoute) { clearInterval(guard); SF.go('/login', true); }
      else clearInterval(guard);
    }, 120);

    if (S.connErr) SF.startReconnect();
  };
})();
