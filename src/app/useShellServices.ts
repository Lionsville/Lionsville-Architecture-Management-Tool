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
import { isProjectOrder } from '../projects/scope'
import type { ProjectOrder } from '../projects/scope'
import type { SourceFailure } from '../platform/sourceProvider'
import type { ShellDiagnostics } from './App'
import { useGlobalErrors } from './useGlobalErrors'
import { useShellPreferences } from './useShellPreferences'
import type { PreferencesWriter, ShellPreferences } from './useShellPreferences'
import { useStorageNotice } from './useStorageNotice'
import type { StorageNotice } from './useStorageNotice'
import { useToasts } from './useToasts'
import type { Notify, Toasts } from './useToasts'

/** Report a failure to the trail, and — with a key — to the person as well. */
export type Failed = (where: string, cause: unknown, key?: StringKey) => void

export type ShellServices = {
  toasts: Toasts
  prefs: ShellPreferences
  s: Translate
  /** Whether a write was taken, for the notice the source words. */
  reportStorage: StorageNotice
  failed: Failed
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
  storageFailure: SourceFailure | undefined
  diagnostics: ShellDiagnostics
}): ShellServices {
  const { preferences, initialPreferences, browserLanguages, storageFailure, diagnostics } = deps
  const toasts = useToasts()
  /**
   * Preferences and the storage notice need each other: writing a preference can
   * fail, and saying so needs the language, which is a preference. One late-bound
   * hop breaks the knot — the notice is looked up when it fires, not when the
   * writer is built.
   */
  const noticeRef = useRef<StorageNotice>(() => {})
  const reportStorage = useCallback<StorageNotice>(
    (ok, cause) => noticeRef.current(ok, cause), [])

  const prefs = useShellPreferences({
    store: preferences,
    initial: initialPreferences,
    onWriteFailed: reportStorage,
    browserLanguages,
  })
  const s = useMemo(() => translator(prefs.language), [prefs.language])
  noticeRef.current = useStorageNotice(toasts.notify, s, storageFailure)

  // The half a boundary cannot see: a throw in a listener, a timer or a promise.
  useGlobalErrors({ diagnostics, notify: toasts.notify, s })

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
    if (key) toasts.notify(s(key), 'error')
  }, [diagnostics, toasts, s])
  const failedRef = useRef(failed)
  failedRef.current = failed
  return { toasts, prefs, s, reportStorage, failed, failedRef }
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
  folderFailure: unknown
  sourceFailure: unknown
  notify: Notify
  s: Translate
}): void {
  const { folderFailure, sourceFailure, notify, s } = deps
  const say = useRef({ notify, s })
  say.current = { notify, s }
  useEffect(() => {
    if (folderFailure === undefined) return
    say.current.notify(say.current.s('shell.folderNotOpened', { message: reasonOf(folderFailure) }), 'error')
  }, [folderFailure])
  useEffect(() => {
    if (sourceFailure === undefined) return
    say.current.notify(say.current.s('shell.sourceNotOpened', { message: reasonOf(sourceFailure) }), 'error')
  }, [sourceFailure])
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
