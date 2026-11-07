// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help page's boot: the language and the theme from the address, the
 * person's system or their browser, the design system's tokens on the root,
 * and the document drawn. A build composed from this one registers its
 * chapters first and then calls this, as `main.tsx` does with none.
 */
import { createRoot } from 'react-dom/client'
import { detectBrowserLanguage } from '../i18n/languages'
import { tokenVariables } from '../widgets/kit/tokens'
import type { Mode } from '../widgets/kit/tokens'
import { readHelpAddress } from '../platform/helpAddress'
import { HelpApp } from './ui/HelpApp'
import '../widgets/kit/fonts/fonts.css'

export function bootHelp(at: HTMLElement | null = document.getElementById('help')): void {
  if (!at) return
  const place = readHelpAddress(location.search, location.hash)
  const dark = matchMedia('(prefers-color-scheme: dark)')
  // The app's own theme where it said one; the system's otherwise, followed while the page is open.
  const paint = () => paintTokens(place.theme ?? (dark.matches ? 'dark' : 'light'))
  paint()
  if (!place.theme) dark.addEventListener('change', paint)
  createRoot(at).render(<HelpApp initial={place.language ?? detectBrowserLanguage(navigator.languages)} />)
}

function paintTokens(mode: Mode): void {
  const root = document.documentElement
  for (const [name, value] of Object.entries(tokenVariables(mode))) root.style.setProperty(name, value)
  root.style.colorScheme = mode
  root.dataset.mode = mode
}
