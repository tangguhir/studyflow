/* StudyFlow - titik masuk: tema, event, dan mulai aplikasi. */
(function () {
  'use strict';
  var SF = window.SF;
  if (!SF || !SF.start) return;

  // ------------------------------------------------------------- tombol tema
  var STORAGE_KEY = 'studyflow-theme';
  var btn = document.getElementById('theme-toggle');

  function syncTheme() {
    if (!btn) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.setAttribute('aria-label', dark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap');
    btn.setAttribute('title', dark ? 'Mode terang' : 'Mode gelap');
  }

  if (btn) {
    syncTheme();
    btn.addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        root.setAttribute('data-theme', 'dark');
        root.style.colorScheme = 'dark';
      } else {
        root.removeAttribute('data-theme');
        root.style.colorScheme = 'light';
      }
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* mode privat */ }
      syncTheme();
    });
    new MutationObserver(syncTheme).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme']
    });
  }

  // -------------------------------------------------------------- mulai app
  var root = document.getElementById('root');
  if (root) SF.bindEvents(root);
  SF.start();
})();
