// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the help is, and how a place in it is written.
 *
 * The help is a page of its own beside the app's (`help/index.html`), so its
 * address is the app's with `help/` after it: the language in the query, a
 * theme where the app asks for one, and a chapter's or a section's id after the
 * `#` — `help/?lang=de#frame.back`. Anyone who can read the app can read the
 * help, with nothing signed in and nothing open, which is why the README and the
 * public site link to it at the open-source web version's address.
 *
 * Pure, so the desktop's main process reads the same rules when it is asked to
 * open a window on it.
 */
import { languageFrom } from '../i18n/languages'
import type { Language } from '../i18n/languages'

/** The help beside the app, relative to the app's own page. */
export const HELP_PATH = 'help/'

/** The open-source web version's help: what the README and the site link to. */
export const PUBLIC_HELP_URL = 'https://app.architecture.lionsville.nl/help/'

/** What a window opened on the help is called, so a second open goes to the same one. */
export const HELP_WINDOW_NAME = 'lvarch-help'

export type HelpTheme = 'light' | 'dark'

export type HelpPlace = {
  readonly language?: Language
  readonly theme?: HelpTheme
  /** A chapter's or a section's id. */
  readonly section?: string
}

/** What a section id may be: the help's own ids, and nothing that could leave the page. */
const SECTION = /^[A-Za-z0-9][\w.~-]{0,80}$/

export function isSectionId(value: unknown): value is string {
  return typeof value === 'string' && SECTION.test(value)
}

/** `help/?lang=nl&theme=dark#frame.back`, relative to the app's page. */
export function helpAddress(place: HelpPlace = {}): string {
  const query = new URLSearchParams()
  if (place.language) query.set('lang', place.language)
  if (place.theme) query.set('theme', place.theme)
  const search = query.toString()
  const hash = place.section && isSectionId(place.section) ? `#${place.section}` : ''
  return `${HELP_PATH}${search ? `?${search}` : ''}${hash}`
}

/** What an address says, from the page's own `search` and `hash`. Whatever is not one of ours is left out. */
export function readHelpAddress(search: string, hash: string): HelpPlace {
  const query = new URLSearchParams(search)
  const language = languageFrom(query.get('lang'))
  const theme = query.get('theme')
  const section = decodeURIComponent(hash.replace(/^#/, ''))
  return {
    ...(language ? { language } : {}),
    ...(theme === 'light' || theme === 'dark' ? { theme } : {}),
    ...(isSectionId(section) ? { section } : {}),
  }
}

/**
 * Is this the help, at this origin? What the desktop asks of a window the app
 * opens, so the help gets a window of its own and nothing else does.
 */
export function isHelpUrl(url: string, base: string): boolean {
  // By the text rather than `URL.origin`, which node reads as `null` for a
  // scheme it does not know, `app:` among them.
  const root = base.endsWith('/') ? base : `${base}/`
  if (!url.startsWith(root)) return false
  const rest = url.slice(root.length).split(/[?#]/)[0]
  return rest === HELP_PATH || rest === `${HELP_PATH}index.html`
}
