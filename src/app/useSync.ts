/**
 * Git sync, as the shell drives it (ADR-0005).
 *
 * Three moments, all of them decided by `local.json` and by what git answers:
 * the pull the boot did before the project was read (`initial`), the push
 * after a snapshot when this machine says so, and the one question a person
 * answers when the folder and its remote have both moved on.
 *
 * Everything may say no and every refusal is a notice — never a modal, never
 * a blocked save. A disagreement is a standing strip with two answers that
 * both keep everything, and it goes away only when one of them has been
 * carried out; a refusal there leaves the folder as it was and says so.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { StringKey, Translate } from '../i18n'
import type { Diagnostic } from '../platform/diagnostics'
import type { PullOutcome, SyncRefusal, SyncSide } from '../platform/sync'
import { isSyncRefusal } from '../platform/sync'
import type { FolderSettingsStore } from '../ports/FolderSettings'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { Notify } from './useToasts'

export const SYNC_REFUSAL_LABEL: Record<SyncRefusal, StringKey> = {
  'no-remote': 'sync.noRemote',
  unreachable: 'sync.unreachable',
  credentials: 'sync.credentials',
  timeout: 'sync.timeout',
}

export type SyncState = {
  /** The folder and its remote have both moved on, and nobody has chosen yet. */
  diverged: boolean
  resolve: (side: SyncSide) => void
  /** A snapshot succeeded: push, if this machine says so. */
  afterSnapshot: () => void
}

export function useSync(deps: {
  history?: ProjectHistory
  folderSettings?: FolderSettingsStore
  /** What the boot's pull answered, if it made one. */
  initial?: PullOutcome
  /** Their version stands: re-read what is open from disk. */
  onTheirs: () => void
  notify: Notify
  s: Translate
  diagnostics: { report(entry: Diagnostic): void }
}): SyncState {
  const { history, folderSettings, initial, onTheirs, notify, s, diagnostics } = deps
  const [diverged, setDiverged] = useState(initial === 'diverged')

  /**
   * Said once, on mount. A refusal at boot is a notice rather than a failure
   * to open: the folder opened, and this says why it is not up to date.
   */
  const said = useRef(false)
  useEffect(() => {
    // Once: the translator changes with the language, and a change of
    // language is not a second boot.
    if (said.current || !initial || !isSyncRefusal(initial)) return
    said.current = true
    notify(s('sync.pullRefused', { reason: s(SYNC_REFUSAL_LABEL[initial]) }), 'warning')
  }, [initial, notify, s])

  const afterSnapshot = useCallback(() => {
    const sync = history?.sync
    if (!sync || !folderSettings) return
    void (async () => {
      if (!(await folderSettings.readLocal()).git.pushAfterSnapshot) return
      const outcome = await sync.push()
      if (outcome === 'done') { notify(s('sync.pushed'), 'success'); return }
      if (outcome === 'rejected') { setDiverged(true); return }
      notify(s('sync.pushRefused', { reason: s(SYNC_REFUSAL_LABEL[outcome]) }), 'warning')
    })().catch((cause: unknown) => {
      // Its failure never unmakes the snapshot, and never reaches the save.
      diagnostics.report({ level: 'warn', where: 'sync.push', message: 'rejected', cause })
    })
  }, [history, folderSettings, notify, s, diagnostics])

  const resolve = useCallback((side: SyncSide) => {
    const sync = history?.sync
    if (!sync) return
    void sync.resolve(side).then((outcome) => {
      if (outcome !== 'done') {
        notify(s('sync.resolveRefused', { reason: s(SYNC_REFUSAL_LABEL[outcome]) }), 'warning')
        return
      }
      setDiverged(false)
      if (side === 'theirs') {
        notify(s('sync.tookTheirs'), 'info')
        onTheirs()
        return
      }
      notify(s('sync.keptOurs'), 'info')
      // The merge commit is made to be pushed, and it is a snapshot in every
      // sense: whether it goes now is the same setting that decides for any
      // other snapshot.
      afterSnapshot()
    }, (cause: unknown) => {
      diagnostics.report({ level: 'error', where: 'sync.resolve', message: 'rejected', cause })
      notify(s('sync.resolveRefused', { reason: String(cause) }), 'error')
    })
  }, [history, onTheirs, afterSnapshot, notify, s, diagnostics])

  return { diverged, resolve, afterSnapshot }
}
