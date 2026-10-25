/* StudyFlow - komponen tampilan (bagian 1: util, ikon, halaman masuk). */
(function () {
  'use strict';
  var SF = window.SF = window.SF || {};

  // ---------------------------------------------------------------- utilitas
  SF.esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  SF.df = function (v) {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(new Date(v));
  };

  SF.toLocalDT = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  SF.localDateTimeMin = function () {
    var d = new Date();
    d.setMinutes(d.getMinutes() + 1, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  SF.difficultyLabel = ['', 'Mudah', 'Sedang', 'Sulit'];

  // ------------------------------------------------- prioritas & pencarian
  function compareTasksByPriority(a, b) {
    var aDone = Boolean(a.completedAt), bDone = Boolean(b.completedAt);
    if (aDone !== bDone) return aDone ? 1 : -1;
    var ad = new Date(a.deadline).getTime(), bd = new Date(b.deadline).getTime();
    if (!isFinite(ad)) ad = Infinity;
    if (!isFinite(bd)) bd = Infinity;
    if (ad < bd) return -1;
    if (ad > bd) return 1;
    if (a.hours < b.hours) return -1;
    if (a.hours > b.hours) return 1;
    if (a.difficulty < b.difficulty) return -1;
    if (a.difficulty > b.difficulty) return 1;
    return String(a.id).localeCompare(String(b.id));
  }

  SF.sortTasksByPriority = function (tasks) {
    return tasks.slice().sort(compareTasksByPriority);
  };

  SF.filterTasksBySearch = function (tasks, query) {
    var q = String(query || '').trim().toLocaleLowerCase();
    if (!q) return tasks;
    return tasks.filter(function (t) {
      return (t.name + ' ' + t.course).toLocaleLowerCase().indexOf(q) !== -1;
    });
  };

  // ------------------------------------------------------------------- ikon
  var SVG = ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

  SF.navIcon = function (name) {
    if (name === 'Dashboard') {
      return '<svg' + SVG + '><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>';
    }
    if (name === 'Semua tugas') {
      return '<svg' + SVG + '><path d="M9 5h10"/><path d="M9 12h10"/><path d="M9 19h10"/><path d="M4 5l1.4 1.4L8 3.8"/><path d="M4 12l1.4 1.4L8 10.8"/><circle cx="5.4" cy="19" r="1.4"/></svg>';
    }
    if (name === 'Kalender') {
      return '<svg' + SVG + '><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 17.5h.01"/><path d="M12 17.5h.01"/></svg>';
    }
    if (name === 'Produktivitas') {
      return '<svg' + SVG + '><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>';
    }
    return '<svg' + SVG + '><circle cx="12" cy="12" r="9"/></svg>';
  };

  var EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.9 17.9 0 0 1-3.4 4.3"/><path d="M6.7 6.9A17.7 17.7 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 4.1-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  SF.eyeIcon = function (shown) { return shown ? EYE_OFF : EYE_OPEN; };

  SF.brand = function () {
    return '<div class="brand"><i class="mark"><img src="' + (SF.BASE || '') +
      '/assets/logo.svg" alt="" width="34" height="34" decoding="async"></i> StudyFlow</div>';
  };
})();
