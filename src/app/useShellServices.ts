// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the shell lends every screen, and outlives every scope: the toasts,
 * this person's preferences and the words they chose, the storage notice, and
 * one way to say that something failed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { translator } from '../i18n'
import type { StringKey, Translate } from '../i18n'
import { reasonOf } from '../platform/errors'
import { SAVED_FILTERS_KEY, readSavedFilters } from '../observations/filter'
import type { SavedFilter, SavedFilters } from '../observations/filter'
import { isProjectOrder } from '../projects/scope'
import type { ProjectOrder } from '../projects/scope'
import type { SourceFailure } from '../platform/sourceProvider'
import type { Screen } from '../agent/screen'
import type { ShellDiagnostics } from './App'
import { offerFor, problemOffer } from './problem'
import type { ProblemAction, ProblemOffer } from './problem'
import { useGlobalErrors } from './useGlobalErrors'
import { useShellPreferences } from './useShellPreferences'
import type { PreferencesWriter, ShellPreferences } from './useShellPreferences'
import { useKeepNotice } from './useKeepNotice'
import type { KeepNotice } from './useKeepNotice'
import { useToasts } from './useToasts'
import type { Notify, Toasts } from './useToasts'

/** Report a failure to the trail, and — with a key — to the person as well. */
export type Failed = (where: string, cause: unknown, key?: StringKey) => void

export type ShellServices = {
  toasts: Toasts
  prefs: ShellPreferences
  s: Translate
  /** Whether a write was taken, for the notice the source words. */
  reportKept: KeepNotice
  failed: Failed
  /**
   * The action on a notice about a problem, where the open source's provider
   * offers one (`problem.ts`); nothing otherwise. What the workspace's session
   * puts on its refusals, and what every boundary draws on its crash screen.
   */
  problem: ProblemOffer | undefined
  /**
   * `failed` by reference, so an effect can report without depending on its
   * identity: a dependency that changes on render is not a needless read but an
   * endless one.
   */
  failedRef: RefObject<Failed>
}

export function useShellServices(deps: {
  preferences: PreferencesWriter
  initialPreferences: unknown
  browserLanguages: readonly string[] | string | undefined
  keepFailure: SourceFailure | undefined
  diagnostics: ShellDiagnostics
  /** The open source's provider's action on a problem, where it offers one. */
  problemAction?: ProblemAction
  /** Where the app is now, for a problem to say where it happened; read when it happens. */
  screen?: () => Screen | undefined
}): ShellServices {
  const { preferences, initialPreferences, browserLanguages, keepFailure, diagnostics, problemAction } = deps
  const toasts = useToasts()
  /**
   * Preferences and the storage notice need each other: writing a preference can
   * fail, and saying so needs the language, which is a preference. One late-bound
   * hop breaks the knot — the notice is looked up when it fires, not when the
   * writer is built.
   */
  const noticeRef = useRef<KeepNotice>(() => {})
  const reportKept = useCallback<KeepNotice>(
    (ok, cause) => noticeRef.current(ok, cause), [])

  const prefs = useShellPreferences({
    store: preferences,
    initial: initialPreferences,
    onWriteFailed: reportKept,
    browserLanguages,
  })
  const s = useMemo(() => translator(prefs.language), [prefs.language])
  noticeRef.current = useKeepNotice(toasts.notify, s, keepFailure)
  // Through a ref: where the app is is known only once the shell below has
  // been composed, and a problem reads it at the moment it happens.
  const screenRef = useRef(deps.screen)
  screenRef.current = deps.screen
  const problem = useMemo(
    () => problemOffer(problemAction, (key) => s(key as StringKey), () => screenRef.current?.()),
    [problemAction, s],
  )

  // The half a boundary cannot see: a throw in a listener, a timer or a promise.
  useGlobalErrors({ diagnostics, notify: toasts.notify, s, problem })

  /**
   * What happens when one of the shell's promises rejects.
   *
   * Two things, in this order: the trail takes the cause, and — when there is
   * something worth saying — the user takes a sentence. Most of these calls used
   * to have neither, so a store that refused mid-session left the screen looking
   * exactly as it does when everything is fine.
   *
   * The key is optional because not every failure is worth interrupting for: a
   * group record that would not load costs a description, and saying so would
   * be noise in front of a list of projects that is perfectly readable.
   */
  const failed = useCallback<Failed>((where, cause, key) => {
    diagnostics.report({ level: 'error', where, message: key ?? 'rejected', cause })
    if (key) toasts.notify(s(key), 'error', ...offerFor(problem, { where, key, cause }))
  }, [diagnostics, toasts, s, problem])
  const failedRef = useRef(failed)
  failedRef.current = failed
  return { toasts, prefs, s, reportKept, failed, problem, failedRef }
}

/**
 * A folder, or a way in a provider offered, that was picked and did not open,
 * from the shell's attempt just before this render — said once on the toast
 * bar, because the shell has no bar of its own and a pick that ends in nothing
 * looks like a button that does nothing. Keyed on the failure alone: the toast
 * helpers are fresh each render, and a notice that re-fires on its own
 * consequences never stops.
 */
export function useOpeningFailures(deps: {
  failure: unknown
  /** The way in's own sentence for it (`SourceConnect.failedKey`), where it has one. */
  failureKey: StringKey | (string & {}) | undefined
  notify: Notify
  s: Translate
}): void {
  const { failure, failureKey, notify, s } = deps
  const say = useRef({ notify, s, failureKey })
  say.current = { notify, s, failureKey }
  useEffect(() => {
    if (failure === undefined) return
    const { notify: tell, s: words, failureKey: key } = say.current
    tell(words((key ?? 'shell.sourceNotOpened') as StringKey, { message: reasonOf(failure) }), 'error')
  }, [failure])
}

/** How the organisation's lists are ordered: a preference, remembered with the rest. */
export function useProjectOrder(prefs: ShellPreferences) {
  const [order, setOrder] = useState<ProjectOrder>(() => {
    const stored = (prefs.preferences as Record<string, unknown> | undefined)?.projectOrder
    return isProjectOrder(stored) ? stored : 'name'
  })
  const chooseOrder = useCallback((next: ProjectOrder) => {
    setOrder(next)
    prefs.writePreference({ projectOrder: next })
  }, [prefs])
  return { order, chooseOrder }
}

/**
 * The observation filters this person saved (ADR-0032 §8): a preference that
 * follows the person, offered in every scope, and held here rather than in the
 * page so a page opened again reads what was saved since the boot.
 */
export function useSavedFilters(prefs: ShellPreferences): SavedFilters {
  const [list, setList] = useState<SavedFilter[]>(() => readSavedFilters(prefs.preferences))
  const onChange = useCallback((next: SavedFilter[]) => {
    setList(next)
    prefs.writePreference({ [SAVED_FILTERS_KEY]: next })
  }, [prefs])
  return useMemo(() => ({ list, onChange }), [list, onChange])
}
