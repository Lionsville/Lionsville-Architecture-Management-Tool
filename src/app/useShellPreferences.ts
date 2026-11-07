// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Language, theme and the editor's settings — one blob, one writer.
 *
 * Before this, three places each wrote their own version of the blob, each with
 * its own fallback for "the editor has not said anything yet". Now there is one
 * blob that gets patched: what you do not mention stays put, including fields
 * this shell does not recognise — so an older shell does not prune a newer one's
 * settings.
 */
import { useEffect, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'
import { shellTheme } from './theme'
import { detectBrowserLanguage } from '../i18n'
import type { EditorPreferences } from '../editor'
import type { Language } from '../i18n'
import { readLanguage, readThemeMode } from '../projects/preferences'
import type { ThemeMode } from '../platform/theme'
import { applyTextSize, movedTextSize, readTextSize } from '../platform/textSize'
import type { TextSize, TextSizeMove } from '../platform/textSize'
import type { KeepNotice } from './useKeepNotice'
import type { AccentShades } from '../widgets/kit/tokens'

/**
 * What this hook needs from a store: writing. Nothing else.
 *
 * Deliberately not the whole `PreferencesStore`. A reader alongside it would mean
 * this hook *could* start reading too, and then "who loads the preferences?" is
 * no longer answerable at a glance. Reading happens before the first render, in
 * `main.tsx`; what arrives here is the outcome of that.
 */
export type PreferencesWriter = {
  write(preferences: Record<string, unknown>): Promise<void>
}

/** How much a screen holds: the one switch every row measure follows (`widgets/kit/density.css`). */
export type Density = 'comfortable' | 'compact'

function readDensity(stored: unknown): Density {
  return stored && typeof stored === 'object' && (stored as { density?: unknown }).density === 'compact' ? 'compact' : 'comfortable'
}

export type ShellPreferences = {
  /**
   * The editor's settings. In state rather than a one-off `useMemo`: the editor
   * reads the prop only when it mounts, and it mounts again on "shipped
   * document" or another document — at which point it must get the LATEST state,
   * not the one from when the tab was opened.
   */
  preferences: unknown
  language: Language
  themeMode: ThemeMode
  /** The MUI theme for `themeMode`, with "system" already resolved. */
  theme: Theme
  savePreferences: (next: EditorPreferences) => void
  chooseLanguage: (next: Language) => void
  density: Density
  chooseDensity: (next: Density) => void
  /** How large this person reads: the bars, panels and pages, not what is on a canvas. */
  textSize: TextSize
  chooseTextSize: (next: TextSize) => void
  moveTextSize: (how: TextSizeMove) => void
  /**
   * One of the three, said outright. The toolbar used to cycle them from a
   * glyph; the View menu, the overflow and the preferences dialog all name
   * the one they mean (ADR-0005), so the hook takes a mode rather than a step.
   */
  chooseTheme: (next: ThemeMode) => void
  /**
   * Patch anything else the shell wants remembered — which project was open,
   * how the picker is ordered.
   *
   * Deliberately untyped beyond "some fields": this blob is shared with the
   * editor and carries whatever either side puts in it, and a strict type here
   * would only be a second place to add a field to.
   */
  writePreference: (patch: Record<string, unknown>) => void
  /** The blob as it stands now, everything anybody has written into it included. */
  readPreferences: () => Record<string, unknown>
}

export function useShellPreferences(deps: {
  store: PreferencesWriter
  initial: unknown
  onWriteFailed: KeepNotice
  /** The languages the browser reports; passed in so a test can pin it. */
  browserLanguages?: readonly string[] | string
  /** The accent's shades, where the source's environment has one and it was accepted. */
  accent?: AccentShades
}): ShellPreferences {
  const { store, initial, onWriteFailed, browserLanguages, accent } = deps

  const [preferences, setPreferences] = useState(initial)
  // The language starts from what the browser says and then stays wherever the
  // user puts it. The theme starts at "system", so a screen set to dark is dark
  // straight away.
  const [language, setLanguage] = useState<Language>(
    () => readLanguage(initial) ?? detectBrowserLanguage(browserLanguages ?? 'en'))
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeMode(initial) ?? 'system')

  const [density, setDensity] = useState<Density>(() => readDensity(initial))
  // On the root and not on a component: every screen's rows read it, the portals' too.
  useEffect(() => {
    const root = globalThis.document?.documentElement
    if (root) root.dataset.density = density
  }, [density])
  const [textSize, setTextSize] = useState<TextSize>(() => readTextSize(initial))
  // Before the paint: `main.tsx` has set it for the first one, and this is every one after.
  useLayoutEffect(() => { applyTextSize(textSize) }, [textSize])
  const blob = useRef<Record<string, unknown>>(
    initial && typeof initial === 'object' ? { ...(initial as Record<string, unknown>) } : {})
  const writePrefs = useCallback((patch: Record<string, unknown>) => {
    blob.current = { ...blob.current, ...patch }
    store.write(blob.current).catch(() => onWriteFailed(false))
  }, [store, onWriteFailed])

  // The editor supplies only ITS settings; language and theme are already in the
  // blob and stay there, whatever prompted the write.
  const savePreferences = useCallback((next: EditorPreferences) => {
    setPreferences(next)
    writePrefs({ ...next })
  }, [writePrefs])

  const chooseLanguage = useCallback((next: Language) => {
    setLanguage(next)
    writePrefs({ language: next })
  }, [writePrefs])

  const chooseDensity = useCallback((next: Density) => {
    setDensity(next)
    writePrefs({ density: next })
  }, [writePrefs])

  const chooseTextSize = useCallback((next: TextSize) => {
    setTextSize(next)
    writePrefs({ textSize: next })
  }, [writePrefs])
  const moveTextSize = useCallback((how: TextSizeMove) => chooseTextSize(movedTextSize(textSize, how)), [chooseTextSize, textSize])

  // Not the updater form of `setThemeMode`: React is allowed to call such an
  // updater twice (StrictMode), and then the write to storage would go out
  // twice. A mode that is already on is not written again either.
  const chooseTheme = useCallback((next: ThemeMode) => {
    if (next === themeMode) return
    setThemeMode(next)
    writePrefs({ themeMode: next })
  }, [themeMode, writePrefs])

  // "System" is not a colour but a question to the operating system; this hook
  // asks it again whenever the answer changes (sunset, a switch in settings),
  // without a refresh.
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const mode: 'light' | 'dark' = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode
  // The language rides on the theme as well as in context: MUI's own labels
  // (an autocomplete's buttons, a toast's close) are read off the theme.
  const theme = useMemo(() => shellTheme(mode, language, accent ? { accent } : {}), [mode, language, accent])

  return {
    preferences, language, themeMode, theme, density, textSize,
    savePreferences, chooseLanguage, chooseDensity, chooseTextSize, moveTextSize, chooseTheme, writePreference: writePrefs,
    readPreferences: useCallback(() => blob.current, []),
  }
}
