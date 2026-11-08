// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// The ground before the app paints, in the theme this person chose or else the
// system's: read before the body is drawn, so a light theme does not open on a
// dark page. A file rather than inline, because the page's policy runs no inline
// script (`script-src 'self'`). Anything unreadable leaves the system's answer.
;(function () {
  var mode
  try { mode = JSON.parse(localStorage.getItem('lvarch.preferences') || '{}').themeMode } catch (e) { mode = undefined }
  var dark = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-ground', dark ? 'dark' : 'light')
})()
