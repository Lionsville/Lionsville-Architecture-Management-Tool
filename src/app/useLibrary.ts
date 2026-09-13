/**
 * An application the organisation already has, drawn on this board — the
 * register as a library, wired (ADR-0012 §2, §3).
 *
 * The arithmetic is `projects/library.ts`: what drawing one means for this
 * scope's records comes back as a plan, and this hook is the part that
 * cannot be pure — which dialog is up, the one question a person is asked,
 * and the command at the session. Every outcome is ONE command and one undo
 * step: the record, where it needs making, and its place on the board, as a
 * transaction.
 *
 * What is deliberately NOT here: any write to another scope. Drawing what
 * a domain defines never takes it over; the record this scope gets is a
 * stand-in, and taking ownership is a gesture of its own (`useGestures`).
 */
import { useCallback, useMemo, useState } from 'react'
import type { Translate } from '../i18n'
import type { Command, DesignElement, ElementId } from '../model'
import { placeOn, transaction } from '../model/commands'
import { seedPlacement } from '../model/placement'
import { isLibraryRefusal, LIBRARY_REFUSAL, libraryRows, planFromLibrary } from '../projects/library'
import type { LibraryPlan, LibraryRow } from '../projects/library'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'
import type { ModelSession } from './useModelSession'
import type { Notify } from './useToasts'

/** Which dialog is up: the picker, or the question about an unowned one. */
export type LibraryChoice =
  | { kind: 'picking'; rows: readonly LibraryRow[] }
  | { kind: 'asking'; id: ElementId; name: string; canDrawOnly: boolean }

export type Library = {
  /** Open the picker over the active board. Nothing happens on a view that draws no cards. */
  open(): void
  choice: LibraryChoice | undefined
  /** One row of the picker: draw it, or ask about it. */
  pick(id: ElementId): void
  /** The answer "yes": this scope defines it from now on. */
  own(): void
  /** The answer "no": one more stand-in, at the address the others carry. */
  drawOnly(): void
  close(): void
}

export function useLibrary(deps: {
  session: ModelSession
  scope: ScopePath
  index: ScopeIndex
  notify: Notify
  s: Translate
  /** Select it on the board and bring it into view, once it is there. */
  focus(id: ElementId): void
  scopeLabel(path: ScopePath): string
}): Library {
  const { session, scope, index, notify, s, focus, scopeLabel } = deps
  const [choice, setChoice] = useState<
    | { kind: 'picking'; rows: readonly LibraryRow[] }
    | { kind: 'asking'; plan: Extract<LibraryPlan, { kind: 'unowned' }> }
    | undefined
  >(undefined)

  const activeBoard = useCallback(() => {
    const model = session.current()
    return model.diagrams.find((diagram) => diagram.id === session.currentActiveId())
  }, [session])

  const open = useCallback(() => {
    const diagram = activeBoard()
    if (!diagram) return
    setChoice({ kind: 'picking', rows: libraryRows(index, session.current(), diagram) })
  }, [activeBoard, index, session])

  const close = useCallback(() => setChoice(undefined), [])

  /**
   * Land it: the record where one is needed, and its place on the board, as
   * one step. A stand-in seeds its own placement — `nodeFigure` draws a
   * record another scope answers for in the external band, which is where a
   * person would have put it.
   */
  const land = useCallback((element: DesignElement, create: boolean, said: string) => {
    const diagram = activeBoard()
    if (!diagram) return
    const placement = seedPlacement(element, diagram, element.id)
    const command: Command = create
      ? transaction([{ type: 'element.create', element }, placeOn(diagram.id, [placement])])
      : placeOn(diagram.id, [placement])
    setChoice(undefined)
    if (session.dispatch(command) === undefined) return
    focus(element.id)
    notify(said, 'success')
  }, [activeBoard, session, focus, notify])

  const pick = useCallback((id: ElementId) => {
    const diagram = activeBoard()
    if (!diagram) return
    const model = session.current()
    const plan = planFromLibrary({ id, scope, model, diagram, index })
    if (isLibraryRefusal(plan)) {
      setChoice(undefined)
      notify(s(LIBRARY_REFUSAL[plan.refused], { name: index.lookup(id)?.name ?? id }), 'warning')
      return
    }
    switch (plan.kind) {
      case 'draw': {
        const held = model.elements.find((element) => element.id === plan.id)
        if (held) land(held, false, s('library.drawn', { name: plan.name }))
        return
      }
      case 'standIn':
        land(plan.element, true, s('library.standsIn', {
          name: plan.element.name, scope: scopeLabel(plan.owner),
        }))
        return
      case 'unowned':
        setChoice({ kind: 'asking', plan })
    }
  }, [activeBoard, session, scope, index, notify, s, land, scopeLabel])

  const own = useCallback(() => {
    if (choice?.kind !== 'asking') return
    land(choice.plan.own, true, s('library.owned', { name: choice.plan.name }))
  }, [choice, land, s])

  const drawOnly = useCallback(() => {
    if (choice?.kind !== 'asking' || !choice.plan.drawOnly) return
    land(choice.plan.drawOnly, true, s('library.drawn', { name: choice.plan.name }))
  }, [choice, land, s])

  const shown = useMemo<LibraryChoice | undefined>(() => {
    if (!choice) return undefined
    if (choice.kind === 'picking') return choice
    return {
      kind: 'asking', id: choice.plan.id, name: choice.plan.name,
      canDrawOnly: choice.plan.drawOnly !== undefined,
    }
  }, [choice])

  return useMemo(
    () => ({ open, choice: shown, pick, own, drawOnly, close }),
    [open, shown, pick, own, drawOnly, close],
  )
}
