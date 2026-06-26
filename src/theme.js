/*
 * Theme bootstrap — loaded as a *blocking* classic script in <head> so the
 * correct theme is on <html> before first paint (no flash of the wrong theme).
 * Kept dependency-free and outside the module graph for that reason.
 *
 * Resolution order: explicit user choice (localStorage) > OS preference > light.
 * CSP note: this is a same-origin 'self' script, so it satisfies the strict
 * script-src policy without needing 'unsafe-inline'.
 */
(function () {
  'use strict';
  var STORAGE_KEY = 'spellcast-theme';
  var root = document.documentElement;

  function readStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function prefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
  }

  // Set initial theme immediately (runs during head parse, before <body> paints).
  apply(readStored() || (prefersDark() ? 'dark' : 'light'));

  // Wire up the toggle button once the DOM is ready.
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    function refresh() {
      var dark = root.getAttribute('data-theme') === 'dark';
      btn.textContent = dark ? '☀️' : '🌙'; // ☀️ / 🌙
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }

    refresh();
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* private mode */ }
      refresh();
    });
  });

  // Follow OS changes, but only while the user hasn't made an explicit choice.
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!readStored()) apply(e.matches ? 'dark' : 'light');
      });
    } catch (e) { /* older browsers: ignore */ }
  }
})();
