/**
 * Language, theme and the editor's settings — one blob, one writer.
 *
 * Before this, three places each wrote their own version of the blob, each with
 * its own fallback for "the editor has not said anything yet". Now there is one
 * blob that gets patched: what you do not mention stays put, including fields
 * this shell does not recognise — so an older shell does not prune a newer one's
 * settings.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import useMediaQuery from '@mui/material/useMediaQuery'
import { createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { detectBrowserLanguage } from '@lionsville/solution-design'
import type { EditorPreferences, Language } from '@lionsville/solution-design'
import { readLanguage, readThemeMode } from '../core/preferences'
import type { ThemeMode } from '../core/preferences'
import type { StorageNotice } from './useStorageNotice'

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

/** The order the theme button cycles through, and the glyph for each. */
export const THEME_ORDER: ThemeMode[] = ['light', 'dark', 'system']
export const THEME_GLYPH: Record<ThemeMode, string> = { light: '☀', dark: '☾', system: '◑' }
export const THEME_LABEL = {
  light: 'shell.themeLight', dark: 'shell.themeDark', system: 'shell.themeSystem',
} as const

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
  cycleTheme: () => void
  /**
   * Patch anything else the shell wants remembered — which project was open,
   * how the picker is ordered.
   *
   * Deliberately untyped beyond "some fields": this blob is shared with the
   * editor and carries whatever either side puts in it, and a strict type here
   * would only be a second place to add a field to.
   */
  writePreference: (patch: Record<string, unknown>) => void
}

export function useShellPreferences(deps: {
  store: PreferencesWriter
  initial: unknown
  onWriteFailed: StorageNotice
  /** The languages the browser reports; passed in so a test can pin it. */
  browserLanguages?: readonly string[] | string
}): ShellPreferences {
  const { store, initial, onWriteFailed, browserLanguages } = deps

  const [preferences, setPreferences] = useState(initial)
  // The language starts from what the browser says and then stays wherever the
  // user puts it. The theme starts at "system", so a screen set to dark is dark
  // straight away.
  const [language, setLanguage] = useState<Language>(
    () => readLanguage(initial) ?? detectBrowserLanguage(browserLanguages ?? 'en'))
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeMode(initial) ?? 'system')

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

  // Reads `themeMode` directly rather than using the updater form of
  // `setThemeMode`: React is allowed to call such an updater twice (StrictMode),
  // and then the write to storage would go out twice.
  const cycleTheme = useCallback(() => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(themeMode) + 1) % THEME_ORDER.length]
    setThemeMode(next)
    writePrefs({ themeMode: next })
  }, [themeMode, writePrefs])

  // "System" is not a colour but a question to the operating system; this hook
  // asks it again whenever the answer changes (sunset, a switch in settings),
  // without a refresh.
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const mode: 'light' | 'dark' = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode
  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode])

  return {
    preferences, language, themeMode, theme,
    savePreferences, chooseLanguage, cycleTheme, writePreference: writePrefs,
  }
}
