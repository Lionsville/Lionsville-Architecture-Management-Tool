/**
 * The business architecture sheet, wired to the session (ADR-0012 §4, §6).
 *
 * A hook rather than three `useState`s in the workspace, for the rule the
 * workspace's own header gives: what a page may do, which one is up and where
 * a person lands on leaving it belong in one place with a test of its own.
 *
 * **A sheet is a diagram, and it is not the active diagram.** It is in
 * `model.diagrams` and it has a tab in the same strip, because a view is a
 * view and the strip is where you reach one. But it is laid out rather than
 * drawn (§6), so the canvas has nothing to draw for it and
 * `session.activeDiagramId` is left pointing at a board: choosing its tab
 * opens a page over the editor, exactly as the roadmap and a plan open one.
 * That is what keeps `needsRemount`, the editor's own key and the agent's
 * renderer handle out of this entirely — the editor is never unmounted for a
 * sheet, so an agent can still be told to render a landscape while one is up.
 *
 * Every change it makes is a `Command` through the same dispatch a keystroke
 * on the canvas takes, so a capability renamed on the sheet is one undo step
 * and one Activity line like anything else.
 */
import { useCallback, useMemo, useState } from 'react'
import { moveAmongSiblings, seedSheet } from '../business'
import type { SheetActions } from '../business'
import { toDiagram, transaction } from '../model'
import type { Command, DesignDiagram, DesignElement, ElementId } from '../model'
import type { MakeId } from '../model/keys'
import type { Translate } from '../i18n'
import type { ModelSession } from './useModelSession'

export type Sheets = {
  /** The sheet being read, or nothing. */
  sheetId: string | undefined
  sheet: DesignDiagram | undefined
  open: (id: string) => void
  close: () => void
  /** Make one over what the scope already holds, and open it. */
  create: () => void
  actions: SheetActions
}

export function useSheet(deps: {
  session: ModelSession
  makeId: MakeId
  s: Translate
  /** Show an element on the canvas — where a coverage link goes. */
  toElement: (id: ElementId) => void
}): Sheets {
  const { session, makeId, s, toElement } = deps
  const [sheetId, setSheetId] = useState<string | undefined>(undefined)

  const close = useCallback(() => setSheetId(undefined), [])

  const create = useCallback(() => {
    const sheet = seedSheet(session.current().elements, { id: makeId('sh'), name: s('shell.newSheet') })
    // No `activeDiagramId`: a sheet is opened as a page, and making it active
    // would hand the canvas a view it cannot draw.
    if (!session.dispatch({ type: 'diagram.create', diagram: toDiagram(sheet) })) return
    setSheetId(sheet.id)
  }, [session, makeId, s])

  const actions = useMemo<SheetActions>(() => ({
    updateElement(id, patch, coalesce) {
      session.dispatch({ type: 'element.update', id, patch, ...(coalesce ? { coalesce } : {}) })
    },
    moveElement(id, by) {
      // The whole row is renumbered, and the whole row is one step: a thing
      // moved past its neighbour is one thing that happened.
      const rows = moveAmongSiblings(session.current().elements, id, by)
      if (rows.length === 0) return
      const commands: Command[] = rows.map(({ id: at, order }) => ({
        type: 'element.update', id: at, patch: { order } as Partial<DesignElement>,
      }))
      session.dispatch(transaction(commands))
    },
    updateSheet(patch) {
      if (sheetId === undefined) return
      session.dispatch({ type: 'diagram.update', id: sheetId, patch })
    },
    onOpenElement(id) {
      // Leaving the page for the board, the way a plan's page leaves it.
      setSheetId(undefined)
      toElement(id)
    },
  }), [session, sheetId, toElement])

  return {
    sheetId,
    sheet: sheetId === undefined
      ? undefined
      : session.model.diagrams.find((diagram) => diagram.id === sheetId),
    open: setSheetId,
    close,
    create,
    actions,
  }
}
