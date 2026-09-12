/**
 * The four gestures that cross scopes, wired (ADR-0012 §10).
 *
 * What a page may offer, which dialog is up, and where a person lands
 * afterwards — the shape `CLAUDE.md` asks a page's wiring to have, and the one
 * place in the app that writes a scope other than the one that is open.
 *
 * The arithmetic is `projects/gestures.ts`: what a gesture would do comes back
 * as an ordered list of writes and one command, so the order that matters —
 * **the other scope first** — is pinned by a test over a pure function rather
 * than by the sequence of `await`s below. What is here is the part that cannot
 * be pure:
 *
 * - **Three of the four are confirmed.** They write two scopes, and the
 *   session's stack can only take back one of the two writes, so the step
 *   carries a barrier and ⌘Z stops at it. Asking first is the honest way to
 *   tell somebody that.
 * - **A failure after the other scope was written leaves a duplicate, never a
 *   hole.** The target is saved, then this scope's record becomes a stand-in
 *   and is written; a store that refuses the second write leaves the
 *   definition in both places, which is a conflict finding somebody can see
 *   and repair. The alternative order loses work.
 * - **The index is read again afterwards**, because the gesture changed the
 *   tree — and the tree is what decides who owns what.
 */
import { useCallback, useMemo, useState } from 'react'
import type { StringKey, Translate } from '../i18n'
import type { Command, DesignElement, ElementId } from '../model'
import { reasonOf } from '../platform/errors'
import {
  GESTURE_BARRIER, GESTURE_REFUSAL, isGestureRefusal, planGesture, withDefinition,
} from '../projects/gestures'
import type { GestureKind, GesturePlan, GestureRequest } from '../projects/gestures'
import type { ScopeModel, ScopeSnapshot } from '../projects/scope'
import type { ScopeIndex } from '../projects/scopeIndex'
import { ancestorScopes, isWithinScope, ROOT_SCOPE } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { Notify } from './useToasts'

/** Which dialog is up. One at a time, because both are about one record. */
export type GestureChoice =
  /** The chooser: which gesture, where to, and whether a stand-in stays. */
  | { kind: 'choosing'; id: ElementId; name: string }
  /** The confirmation, over a plan that has already been worked out. */
  | { kind: 'confirming'; request: GestureRequest; plan: GesturePlan }

export type Gestures = {
  /**
   * Which gestures this scope could be offered for this record, from the index
   * alone — no load, because this is asked while a panel renders.
   */
  offers: (id: ElementId) => GestureKind[]
  /** Where one of them could send it, in path order. */
  targets: (gesture: GestureKind) => ScopePath[]
  choice: GestureChoice | undefined
  /** Open the chooser on a record. */
  choose: (id: ElementId) => void
  /** Ask for one. *Link* runs; the three that write two scopes ask first. */
  ask: (request: Omit<GestureRequest, 'scope'>) => void
  close: () => void
  /** Run what is being confirmed. */
  confirm: () => void
  /** A gesture is in flight: the dialogs' buttons wait for it. */
  busy: boolean
}

export function useGestures(deps: {
  /** The scope the session has open. */
  scope: ScopePath
  /** Reading and writing another scope: the narrowest shape that will do. */
  scopes: {
    save(scope: ScopeSnapshot): Promise<void>
    load?(path: ScopePath): Promise<ScopeSnapshot | undefined>
  }
  /**
   * Every scope's records, read when a gesture is asked for.
   *
   * Not the index: deciding whether the scope a definition would move into
   * already answers for the id needs the record, and the index keeps a summary
   * of it. Absent where there is no tree to read — a test, a browser tab with
   * one scope — and nothing is then offered.
   */
  models?: () => Promise<ScopeModel[]>
  index: ScopeIndex
  /** The open scope's records as the session has them, and the one way in. */
  session: {
    current: () => { elements: readonly DesignElement[] }
    snapshot: () => ScopeSnapshot
    dispatch: (command: Command) => unknown
  }
  /** The tree changed: read the index again. */
  onTreeChanged: () => void
  /** Open the scope that answers for it now. Absent where there is nowhere to go. */
  onOpenScope?: (path: ScopePath) => void
  /** What to call a scope on screen — the root has a word rather than a path. */
  scopeLabel: (path: ScopePath) => string
  notify: Notify
  onFailure: (where: string, cause: unknown, key?: StringKey) => void
  s: Translate
}): Gestures {
  const {
    scope, scopes, models, index, session, onTreeChanged, onOpenScope, scopeLabel,
    notify, onFailure, s,
  } = deps
  const [choice, setChoice] = useState<GestureChoice | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const close = useCallback(() => setChoice(undefined), [])

  /**
   * What is on offer, from the index and the record in front of us.
   *
   * The same three rules `planGesture` refuses by, asked the other way round:
   * a page should not draw a button whose only answer is no. It stays cheap —
   * one lookup — because an inspector asks it on every render.
   */
  const offers = useCallback((id: ElementId): GestureKind[] => {
    if (!models) return []
    const held = session.current().elements.find((element) => element.id === id)
    if (!held || held.ref !== undefined) return []
    const entry = index.lookup(id)
    const known = index.scopes()
    const elsewhere = [
      ...(entry?.conflict ?? (entry?.master !== undefined ? [entry.master] : [])),
      ...(entry?.declarations ?? []),
    ].some((path) => path !== scope)
    // Somebody deeper answers for it: this record is a copy, and the only
    // gesture about a copy is giving up on it.
    if (entry?.master !== undefined && entry.master !== scope) {
      return elsewhere ? ['link'] : []
    }
    const found: GestureKind[] = []
    if (elsewhere) found.push('link')
    if (known.some((path) => ancestorScopes(scope).includes(path))) found.push('promote')
    if (known.some((path) => path !== scope && isWithinScope(path, scope))) found.push('demote')
    if (known.some((path) => path !== scope)) found.push('transfer')
    return found
  }, [models, session, index, scope])

  const targets = useCallback((gesture: GestureKind): ScopePath[] => {
    const known = index.scopes().filter((path) => path !== scope)
    switch (gesture) {
      case 'promote': return known.filter((path) => ancestorScopes(scope).includes(path))
      case 'demote': return known.filter((path) => isWithinScope(path, scope))
      default: return known
    }
  }, [index, scope])

  /**
   * Do it: every other scope first, then this one.
   *
   * A refusal from a store is reported and stops the run; a refusal from the
   * reducer has already said so itself. The save of THIS scope is the second
   * write, and the one whose failure leaves the record in two places — which
   * is the state ADR-0012 §10 asks for, and the reason the toast says so.
   */
  const run = useCallback(async (plan: GesturePlan) => {
    setBusy(true)
    try {
      for (const write of plan.writes) {
        const held = await scopes.load?.(write.path)
        if (!held) {
          notify(s(GESTURE_REFUSAL['gesture.noSuchScope']), 'warning')
          return
        }
        await scopes.save(withDefinition(held, write.element))
      }
    } catch (cause) {
      onFailure('gesture.write', cause)
      notify(s('gesture.writeFailed', { message: reasonOf(cause) }), 'error')
      return
    } finally {
      setBusy(false)
    }

    const command: Command = {
      ...plan.command,
      ...(plan.barrier ? { barrier: GESTURE_BARRIER } : {}),
    }
    if (session.dispatch(command) === undefined) return
    const scopeName = scopeLabel(plan.owner)
    try {
      // Through the store rather than through the document session's own save,
      // because this one has to be able to fail out loud: everything above it
      // has already landed in another scope.
      await scopes.save(session.snapshot())
    } catch (cause) {
      onFailure('gesture.save', cause)
      notify(s('gesture.leftCopy', { scope: scopeName, message: reasonOf(cause) }), 'warning')
    }
    onTreeChanged()
    notify(
      s(plan.gesture === 'link' ? 'gesture.linked' : 'gesture.moved', {
        name: plan.name, scope: scopeName,
      }),
      'success',
      onOpenScope ? { label: s('standIn.open', { scope: scopeName }), onClick: () => onOpenScope(plan.owner) } : undefined,
    )
  }, [scopes, session, notify, onFailure, s, scopeLabel, onTreeChanged, onOpenScope])

  const ask = useCallback((request: Omit<GestureRequest, 'scope'>) => {
    if (!models) return
    setBusy(true)
    void models().then(
      (tree) => {
        setBusy(false)
        const full: GestureRequest = { ...request, scope }
        const answer = planGesture({
          request: full, model: session.current(), index, models: tree,
        })
        if (isGestureRefusal(answer)) {
          setChoice(undefined)
          notify(s(GESTURE_REFUSAL[answer.refused], {
            scope: answer.scope !== undefined ? scopeLabel(answer.scope) : '',
          }), 'warning')
          return
        }
        // A link writes one scope and undoes like anything else, so there is
        // nothing to warn about and nothing to confirm.
        if (!answer.barrier) { setChoice(undefined); void run(answer) } else {
          setChoice({ kind: 'confirming', request: full, plan: answer })
        }
      },
      (cause: unknown) => {
        setBusy(false)
        setChoice(undefined)
        onFailure('gesture.plan', cause, 'gesture.writeFailed')
      },
    )
  }, [models, scope, session, index, notify, s, scopeLabel, run, onFailure])

  const choose = useCallback((id: ElementId) => {
    const held = session.current().elements.find((element) => element.id === id)
    if (!held) return
    setChoice({ kind: 'choosing', id, name: held.name })
  }, [session])

  const confirm = useCallback(() => {
    if (choice?.kind !== 'confirming') return
    const plan = choice.plan
    setChoice(undefined)
    void run(plan)
  }, [choice, run])

  return useMemo(
    () => ({ offers, targets, choice, choose, ask, close, confirm, busy }),
    [offers, targets, choice, choose, ask, close, confirm, busy],
  )
}

/** The root has a word rather than a path, everywhere a scope is named. */
export function scopeName(path: ScopePath, organisation: string): string {
  return path === ROOT_SCOPE ? organisation : path
}
