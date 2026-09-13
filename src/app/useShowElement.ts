/**
 * "Show me this one": where a link to an element lands (ADR-0012 §2, §5).
 *
 * A coverage link on the sheet, a row of the register, an element named from
 * another scope's page — each ends in a board with the thing selected, and
 * which board is a question with four answers. The board a person is on,
 * when it draws the thing. The one board that does, otherwise, with a word
 * about the switch. A choice, when more than one does and none is up: the
 * first beta tester was landed on the first of several and could not tell
 * why. And, for a thing this scope does not hold at all — an organisation's
 * capability supported by a landscape's application — the scope that answers
 * for it, opened on the same request there.
 *
 * A thing drawn nowhere in a scope that holds it has a page, and that is
 * where the link goes; nothing is left behind first, because a page stacks
 * over whatever asked for it.
 *
 * `leave` is what the caller does on the way out — a sheet closes itself
 * before the board shows — and it is called only when a board here is about
 * to show, or another scope is: a choice still pending or a page leaves the
 * caller where it was.
 */
import { useCallback, useState } from 'react'
import { boardsDrawing } from '../model'
import type { DesignDiagram, ElementId } from '../model'
import type { ScopePath } from '../projects/scopePath'
import type { Translate } from '../i18n'
import type { InitialPage } from './App'
import type { ModelSession } from './useModelSession'
import type { Notify } from './useToasts'

export type BoardChoice = {
  id: ElementId
  name: string
  boards: readonly DesignDiagram[]
}

export type ShowElement = {
  show(id: ElementId, leave?: () => void): void
  /** More than one board draws it and none is up: the boards, for a dialog to offer. */
  choice: BoardChoice | undefined
  choose(boardId: string): void
  dismiss(): void
}

export function useShowElement(deps: {
  session: ModelSession
  scope: ScopePath
  notify: Notify
  s: Translate
  /** Select it on the active board and bring it into view. */
  focus(id: ElementId): void
  /** Its page, for a thing drawn nowhere here. */
  toDocumentation(id: ElementId): void
  /** The scope that answers for an id this scope does not hold, where the tree knows one. */
  masterOf?(id: ElementId): ScopePath | undefined
  onOpenScope?(path: ScopePath, page?: InitialPage): void
}): ShowElement {
  const { session, scope, notify, s, focus, toDocumentation, masterOf, onOpenScope } = deps
  const [pending, setPending] = useState<(BoardChoice & { leave?: () => void }) | undefined>(undefined)

  const land = useCallback((id: ElementId, board: DesignDiagram, leave?: () => void) => {
    leave?.()
    if (board.id !== session.currentActiveId()) {
      session.setActiveDiagramId(board.id)
      notify(s('sheet.switchedBoard', { name: board.name }), 'info')
    }
    focus(id)
  }, [session, notify, s, focus])

  const show = useCallback((id: ElementId, leave?: () => void) => {
    const model = session.current()
    const held = model.elements.find((element) => element.id === id)
    const boards = boardsDrawing(model, id)
    if (boards.length === 0) {
      const master = held ? undefined : masterOf?.(id)
      if (master !== undefined && master !== scope && onOpenScope) {
        leave?.()
        onOpenScope(master, { page: 'element', id })
        return
      }
      toDocumentation(id)
      return
    }
    const active = boards.find((board) => board.id === session.currentActiveId())
    if (active) { land(id, active, leave); return }
    if (boards.length === 1) { land(id, boards[0], leave); return }
    setPending({ id, name: held?.name ?? id, boards, ...(leave ? { leave } : {}) })
  }, [session, scope, masterOf, onOpenScope, toDocumentation, land])

  const choose = useCallback((boardId: string) => {
    if (!pending) return
    const board = pending.boards.find((held) => held.id === boardId)
    setPending(undefined)
    if (board) land(pending.id, board, pending.leave)
  }, [pending, land])

  return {
    show,
    choice: pending && { id: pending.id, name: pending.name, boards: pending.boards },
    choose,
    dismiss: useCallback(() => setPending(undefined), []),
  }
}
