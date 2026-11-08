// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A view renamed or deleted from its row on a scope's home, and taken back.
 *
 * The home is outside any session, so there is no stack for ⌘Z to walk: each
 * change is read-patch-write on the scope that keeps the view
 * (`changeScope`), and what puts it back is worked out from what the change
 * met — the reducer's own inverse — and kept here as a step. The newest step
 * is the frame's undo while the home is up (row one's ↶, ⌘Z, Edit › Undo),
 * and the toast after a delete offers the same step. Taking one back is a step
 * of its own in that scope, as every fix made from a home is
 * (`checkFixes`).
 */
import { useCallback, useMemo, useState } from 'react'
import type { StringKey, Translate } from '../../i18n'
import { apply, fromArrays, removeContainerDiagram } from '../../model'
import type { Command, DesignDiagram } from '../../model'
import { claimKey, idsIn } from '../../model/keys'
import { ShellError } from '../../platform/errors'
import type { ScopeSnapshot } from '../../projects/scope'
import { refusalOf } from '../../projects/refusalTag'
import { changeScope, landed, stepOf } from '../../projects/scopeAccess'
import { holdWrite, whenLanded } from '../writeRefusals'
import type { ScopeCommand, ScopeId } from '../../projects/scopeState'
import type { ScopePath } from '../../projects/scopePath'
import type { Repositories } from '../../ports/Repositories'
import type { FrameStep } from '../frame/frameStore'
import type { ToastUndo } from '../useToasts'

/** A view as its row names it. */
export type HomeView = { readonly id: string; readonly name: string; readonly kind: DesignDiagram['kind'] }

export type HomeViewDialog =
  | { readonly kind: 'none' }
  | { readonly kind: 'delete'; readonly path: ScopePath; readonly view: HomeView }
  | { readonly kind: 'rename'; readonly path: ScopePath; readonly view: HomeView }

/** A change made from a home, and what puts it back. */
type HomeStep = { readonly id: number; readonly name: string; readonly path: ScopePath; readonly back: readonly ScopeCommand[] }

export type HomeViews = {
  viewDialog: HomeViewDialog
  askDeleteView: (path: ScopePath, view: HomeView) => void
  askRenameView: (path: ScopePath, view: HomeView) => void
  closeViewDialog: () => void
  confirmDeleteView: () => void
  renameView: (name: string) => void
  /** The newest change a home can take back, for the frame's undo. */
  viewUndo: FrameStep | undefined
}

/**
 * The commands that delete a view from the scope as it is held, and the ones
 * that put it back. A container view takes its containers with it and writes
 * the interfaces they carried on the landscape (`model/containerDiagram.ts`);
 * the active view moves on to the first that remains, and comes back with it.
 */
export function deleteViewCommands(held: ScopeSnapshot, id: string): { forward: ScopeCommand[]; back: ScopeCommand[] } | undefined {
  const taken = new Set(idsIn(held.model))
  const command: Command = removeContainerDiagram(held.model, id, () => claimKey('interface', taken)) ?? { type: 'diagram.delete', id }
  const done = apply(fromArrays(held.model), command)
  if (!done.ok) throw new ShellError(done.reason)
  const moving = held.activeDiagramId === id ? held.model.diagrams.find((diagram) => diagram.id !== id)?.id ?? '' : undefined
  return {
    forward: [command, ...(moving !== undefined ? [{ type: 'scope.describe', patch: { activeDiagramId: moving } } as const] : [])],
    back: [done.inverse, ...(moving !== undefined ? [{ type: 'scope.describe', patch: { activeDiagramId: id } } as const] : [])],
  }
}

export function useHomeViews({ repositories, refresh, notify, onFailure, onKeptResult, onViewRenamed, idAt, s }: {
  repositories: Pick<Repositories, 'scopes'>
  refresh: () => void
  notify: (message: string, severity: 'success' | 'error', undo?: ToastUndo) => void
  onFailure: (where: string, cause: unknown, key?: StringKey) => void
  onKeptResult: (kept: boolean, cause?: unknown) => void
  /** A view's new name landed: what the screen remembers it as elsewhere (*Continue*) follows. */
  onViewRenamed?: (path: ScopePath, id: string, name: string) => void
  /** The identity a scope was last known by at an address, for a change whose scope no longer reads there. */
  idAt?: (path: ScopePath) => ScopeId | undefined
  s: Translate
}): HomeViews {
  const { scopes } = repositories
  const [viewDialog, setDialog] = useState<HomeViewDialog>({ kind: 'none' })
  const [steps, setSteps] = useState<readonly HomeStep[]>([])

  const failed = useCallback((where: string, cause: unknown) => {
    // The reducer's own refusal is said in its words; a write the place work is
    // kept would not take is that place's to say, with its reason (`notKept`).
    if (cause instanceof ShellError && refusalOf(cause) === undefined) { notify(s(cause.key), 'error'); return }
    onFailure(where, cause)
    onKeptResult(false, cause)
  }, [notify, onFailure, onKeptResult, s])

  /** Put one step back, wherever it is on the list: the toast's Undo may come after another change. */
  const takeBack = useCallback((step: HomeStep) => {
    setSteps((held) => held.filter((one) => one.id !== step.id))
    holdWrite(scopes, changeScope(scopes, step.path, () => step.back))
      .then(() => { refresh(); return undefined })
      .catch((cause: unknown) => failed('organisation.undoView', cause))
  }, [scopes, refresh, failed])

  /**
   * Change a scope, keep what puts it back, and answer the step it became.
   * `unread` is the change as it can be made without reading the scope: where
   * the scope does not read at its address any more — its folder moved away —
   * it is sent by the identity the scope was last known by, so the place says
   * why it would not take it, and the change stands in *Your work* to be made
   * again, rather than the dialog closing on nothing.
   */
  const change = useCallback(async (
    path: ScopePath, name: string, work: (held: ScopeSnapshot) => { forward: ScopeCommand[]; back: ScopeCommand[] } | undefined,
    unread?: readonly ScopeCommand[],
  ) => {
    let back: readonly ScopeCommand[] = []
    // Expecting what was read, and worked out again over a scope that moved in between.
    // Under way from its read: a quit in between waits for it (`holdWrite`).
    let read = false
    const next = await holdWrite(scopes, changeScope(scopes, path, (held) => {
      read = true
      const made = work(held)
      back = made?.back ?? []
      return made?.forward
    }))
    if (!read && unread) {
      const id = idAt?.(path)
      if (id === undefined) throw new ShellError('shell.scopeGone')
      landed(await holdWrite(scopes, scopes.apply([{ scope: id, steps: unread.map((command) => stepOf(command)) }])))
      refresh()
      return undefined
    }
    if (!next || back.length === 0) return undefined
    const step: HomeStep = { id: Date.now() + Math.random(), name, path, back }
    setSteps((held) => [...held, step])
    refresh()
    return step
  }, [scopes, refresh, idAt])

  const confirmDeleteView = useCallback(() => {
    if (viewDialog.kind !== 'delete') return
    const { path, view } = viewDialog
    setDialog({ kind: 'none' })
    change(path, s('org.undoDeleteView', { name: view.name }), (held) => deleteViewCommands(held, view.id))
      .then((step) => {
        if (step) notify(s('shell.deleted', { name: view.name }), 'success', { undo: { onPress: () => takeBack(step) } })
        return undefined
      })
      .catch((cause: unknown) => failed('organisation.deleteBoard', cause))
  }, [viewDialog, change, notify, takeBack, failed, s])

  const renameView = useCallback((name: string) => {
    if (viewDialog.kind !== 'rename') return
    const { path, view } = viewDialog
    setDialog({ kind: 'none' })
    change(path, s('org.undoRenameView', { name: view.name }), (held) => {
      const was = held.model.diagrams.find((diagram) => diagram.id === view.id)
      if (!was || was.name === name) return undefined
      return { forward: [{ type: 'diagram.rename', id: view.id, name }], back: [{ type: 'diagram.rename', id: view.id, name: was.name }] }
    }, [{ type: 'diagram.rename', id: view.id, name }]).then((step) => {
      if (step) onViewRenamed?.(path, view.id, name)
      return undefined
    }).catch((cause: unknown) => {
      // Refused, it may land later from *Your work*: *Continue* follows then.
      whenLanded(scopes, refusalOf(cause), () => onViewRenamed?.(path, view.id, name))
      failed('organisation.renameView', cause)
    })
  }, [viewDialog, change, failed, onViewRenamed, scopes, s])

  const newest = steps.at(-1)
  const viewUndo = useMemo<FrameStep | undefined>(
    () => (newest ? { can: true, name: newest.name, run: () => takeBack(newest) } : undefined),
    [newest, takeBack],
  )
  return {
    viewDialog, viewUndo, confirmDeleteView, renameView,
    askDeleteView: useCallback((path: ScopePath, view: HomeView) => setDialog({ kind: 'delete', path, view }), []),
    askRenameView: useCallback((path: ScopePath, view: HomeView) => setDialog({ kind: 'rename', path, view }), []),
    closeViewDialog: useCallback(() => setDialog({ kind: 'none' }), []),
  }
}
