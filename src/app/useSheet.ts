// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The business architecture sheet, wired to the session (ADR-0012 §4, §6).
 *
 * A hook rather than three `useState`s in the workspace, for the rule the
 * workspace's own header gives: what a page may do, which one is up and where
 * a person lands on leaving it belong in one place with a test of its own.
 *
 * **A sheet is a diagram, and since ADR-0016 it is the active one while it
 * is up.** It is in `model.diagrams` and it has a tab in the same strip,
 * because a view is a view and the strip is where you reach one; laid out
 * rather than drawn (§6), it is drawn in the tab in place of the canvas,
 * through the slot the workspace hands the editor. So which sheet is up is
 * `session.activeDiagramId`, read here, and nothing else.
 *
 * Every change it makes is a `Command` through the same dispatch a keystroke
 * on the canvas takes, so a capability renamed on the sheet is one undo step
 * and one Activity line like anything else. The gestures that *make* things
 * follow the same rule and answer with the id they minted, because the page
 * selects what it just made and puts the cursor in its name.
 */
import { useCallback, useMemo } from 'react'
import { mayRemove, moveAmongSiblings, nextOrder, rootsOfKind, seedSheet } from '../business'
import type { NewElement, SheetActions } from '../business'
import { toDiagram, transaction } from '../model'
import type { Command, DesignDiagram, DesignElement, ElementId, Relation } from '../model'
import type { IdPolicy, MakeId } from '../model/keys'
import type { Translate } from '../i18n'
import type { ModelSession } from './useModelSession'

export type Sheets = {
  /** The sheet that is the active view, or nothing. */
  sheetId: string | undefined
  sheet: DesignDiagram | undefined
  open: (id: string) => void
  /** Make one over what the scope already holds, and make it the active view. */
  create: () => void
  actions: SheetActions
}

export function useSheet(deps: {
  session: ModelSession
  makeId: MakeId
  s: Translate
  /**
   * Where a coverage link goes (`useShowElement`): a board here, a choice
   * between boards, the element's page, or the scope that answers for it.
   * `leave` is this page closing, called only when a board here is about to
   * show — a page or another scope stacks over the sheet or replaces it.
   */
  showElement: (id: ElementId, leave: () => void) => void
}): Sheets {
  const { session, makeId, s, showElement } = deps
  const active = session.model.diagrams.find((diagram) => diagram.id === session.activeDiagramId)
  const sheetId = active?.kind === 'sheet' ? active.id : undefined

  const create = useCallback(() => {
    const sheet = seedSheet(session.current().elements, { id: makeId('sh'), name: s('shell.newSheet') })
    // Made and shown: the tab strip lists it and the editor draws it in the tab.
    session.dispatch({ type: 'diagram.create', diagram: toDiagram(sheet) }, { activeDiagramId: sheet.id })
  }, [session, makeId, s])

  const actions = useMemo<SheetActions>(() => {
    /** The sheet as it stands now, which is what a transaction is built against. */
    const openSheet = (): DesignDiagram | undefined => (sheetId === undefined
      ? undefined
      : session.current().diagrams.find((diagram) => diagram.id === sheetId))

    const make = (seed: NewElement, named: string): DesignElement =>
      newElement(session.ids, session.current().elements, seed, named)

    return {
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
        // To a board that actually draws it, which is the shell's question to
        // answer; the board it chooses becomes the active view, which is what
        // leaves the sheet.
        showElement(id, () => {})
      },

      addElement(seed) {
        const element = make(seed, s('sheet.untitled'))
        if (!session.dispatch({ type: 'element.create', element })) return undefined
        return element.id
      },

      addJourney(names) {
        const journey = make({ kind: 'step', name: names.journey }, s('sheet.untitled'))
        // With a phase from the start, because a band that is a header with
        // nothing under it is not what somebody who pressed the button asked
        // for — and the first thing a journey does is a phase, always.
        const phase = make(
          { kind: 'step', name: names.phase, parentId: journey.id }, s('sheet.untitled'),
        )
        const commands: Command[] = [
          { type: 'element.create', element: journey },
          { type: 'element.create', element: phase },
        ]
        const sheet = openSheet()
        // A sheet that already draws one is not repointed: a second journey is
        // a thing a scope may hold, and which one this page is of is a
        // decision made in its settings.
        if (sheet && sheet.journeyId === undefined) {
          commands.push({ type: 'diagram.update', id: sheet.id, patch: { journeyId: journey.id } })
        }
        if (!session.dispatch(transaction(commands))) return undefined
        return journey.id
      },

      addArea(name) {
        const element = make({ kind: 'function', name }, s('sheet.untitled'))
        const commands: Command[] = [{ type: 'element.create', element }]
        const sheet = openSheet()
        if (sheet) {
          // An absent list draws every root; naming them all plus this one
          // keeps exactly what was drawn drawn, and makes the order this
          // sheet's own from here.
          const drawn = sheet.areas
            ?? rootsOfKind(session.current().elements, 'function').map((held) => held.id)
          commands.push({
            type: 'diagram.update', id: sheet.id, patch: { areas: [...drawn, element.id] },
          })
        }
        if (!session.dispatch(transaction(commands))) return undefined
        return element.id
      },

      addLane(lane) {
        const commands: Command[] = []
        let actorId = lane.actorId
        if (actorId === undefined) {
          const actor = make(
            { kind: 'actor', name: lane.name ?? '', ...(lane.outside ? { outside: true } : {}) },
            s('sheet.untitled'),
          )
          commands.push({ type: 'element.create', element: actor })
          actorId = actor.id
        }
        // The sheet is told nothing: `lanes` is the ORDER of the rows, and a
        // row exists because a step names the actor (`business/lanes.ts`). A
        // lane whose last step goes stops being drawn, with nothing to tidy.
        const step = make(
          { kind: 'step', name: lane.stepName, parentId: lane.phaseId, lane: actorId },
          s('sheet.untitled'),
        )
        commands.push({ type: 'element.create', element: step })
        if (!session.dispatch(transaction(commands))) return undefined
        return step.id
      },

      removeElement(id) {
        const model = session.current()
        // The refusal is the page's to say; this is the net under it.
        if (!mayRemove(model.elements, id).ok) return
        const commands: Command[] = [{ type: 'element.delete', id }]
        const sheet = openSheet()
        if (sheet) {
          // Whatever the sheet said about it goes in the same step, so undo
          // gives back a page rather than a page with a hole in it.
          if (sheet.journeyId === id) {
            commands.push({ type: 'diagram.update', id: sheet.id, patch: { journeyId: undefined } })
          }
          if (sheet.areas?.includes(id)) {
            commands.push({
              type: 'diagram.update',
              id: sheet.id,
              patch: { areas: sheet.areas.filter((held) => held !== id) },
            })
          }
          if (sheet.lanes?.includes(id)) {
            commands.push({
              type: 'diagram.update',
              id: sheet.id,
              patch: { lanes: sheet.lanes.filter((held) => held !== id) },
            })
          }
        }
        session.dispatch(commands.length === 1 ? commands[0] : transaction(commands))
      },

      setCoverage(change) {
        const { type, sourceId, functionId, on } = change
        if (on) {
          const relation: Relation = {
            id: session.ids.connection(), type, sourceId, targetId: functionId,
          }
          session.dispatch({ type: 'relation.create', relation })
          return
        }
        // Every row that says the same thing, because two of them say it once.
        const rows = session.current().relations.filter((relation) => (
          relation.type === type
          && relation.sourceId === sourceId
          && relation.targetId === functionId
        ))
        if (rows.length === 0) return
        session.dispatch(rows.length === 1
          ? { type: 'relation.delete', id: rows[0].id }
          : transaction(rows.map((row) => ({ type: 'relation.delete' as const, id: row.id }))))
      },
    }
  }, [session, sheetId, s, showElement])

  return {
    sheetId,
    sheet: sheetId === undefined
      ? undefined
      : session.model.diagrams.find((diagram) => diagram.id === sheetId),
    open: session.setActiveDiagramId,
    create,
    actions,
  }
}

/**
 * A new element, with the key the file would have given it.
 *
 * The name comes first because the id is derived from it (ADR-0002), and an
 * empty one still gets a name rather than a blank card: the page selects what
 * it just made and the person types over it, so the placeholder is what shows
 * for the half-second in between.
 *
 * `isManaged` starts false for the same reason the canvas starts an actor
 * false: nobody runs a backup of a responsibility or a journey, and a managed
 * flag nobody meant becomes a coverage warning nobody asked for.
 */
function newElement(
  ids: IdPolicy,
  elements: readonly DesignElement[],
  seed: NewElement,
  fallback: string,
): DesignElement {
  const name = seed.name.trim() || fallback
  const order = nextOrder(elements, seed.kind, seed.parentId)
  return {
    id: ids.element(name),
    kind: seed.kind,
    name,
    lifecycle: 'live',
    isManaged: false,
    aspects: {},
    ...(seed.parentId !== undefined ? { parentId: seed.parentId } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(seed.lane !== undefined ? { lane: seed.lane } : {}),
    ...(seed.outside ? { outside: true as const } : {}),
  }
}
