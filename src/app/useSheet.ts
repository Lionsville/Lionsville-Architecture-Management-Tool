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
import type { PosterActions } from '../business/ui/PosterDesign'
import { toDiagram, transaction } from '../model'
import type { Command, DesignDiagram, DesignElement, DesignModel, ElementId, Relation } from '../model'
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
  /** What placing and mapping on a poster writes. */
  poster: PosterActions
}

/** The commands that take a tile's places on every sheet: a place in the old block means nothing in the new one. */
function tileLeaves(model: DesignModel, id: ElementId): Command[] {
  return model.diagrams.flatMap((diagram) => (diagram.geometry?.cells?.some((cell) => cell.id === id)
    ? [{ type: 'cell.remove' as const, diagramId: diagram.id, elementIds: [id] }]
    : []))
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
        updateAndLeave(session, id, patch, coalesce)
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

      removeElement(id, via) {
        const model = session.current()
        // The refusal is the page's to say; this is the net under it. A unit's
        // delete (`via`) decides where its units inside go, so it is not held back.
        if (!via && !mayRemove(model.elements, id).ok) return
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
        if (via) via(commands)
        else session.dispatch(commands.length === 1 ? commands[0] : transaction(commands))
      },

      setCoverage(change) {
        const { type, sourceId, functionId, on } = change
        if (on) { addRowOnce(session, change); return }
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

  const poster = useMemo(() => posterActions(session, sheetId, makeId, s), [session, sheetId, makeId, s])
  return {
    sheetId,
    sheet: sheetId === undefined ? undefined : session.model.diagrams.find((diagram) => diagram.id === sheetId),
    open: session.setActiveDiagramId,
    create,
    actions,
    poster,
  }
}

/** A coverage row, said once: a second press, or a pick racing a refresh, draws no second row. */
function addRowOnce(session: ModelSession, { type, sourceId, functionId }: { type: Relation['type']; sourceId: ElementId; functionId: ElementId }) {
  if (session.current().relations.some((relation) => relation.type === type && relation.sourceId === sourceId && relation.targetId === functionId)) return
  const relation = { id: session.ids.connection(), type, sourceId, targetId: functionId } as Relation
  session.dispatch({ type: 'relation.create', relation })
}

/** A field changed; moved somewhere else it is last among its new neighbours, and its hand-placed cell left behind, as one step. */
function updateAndLeave(session: ModelSession, id: ElementId, patch: Partial<DesignElement>, coalesce?: string) {
  const update = { type: 'element.update' as const, id, patch, ...(coalesce ? { coalesce } : {}) }
  if (!('parentId' in patch)) { session.dispatch(update); return }
  const model = session.current()
  const element = model.elements.find((held) => held.id === id)
  const order = element && patch.order === undefined && element.kind !== 'application'
    ? nextOrder(model.elements, element.kind as NewElement['kind'], patch.parentId)
    : undefined
  const moved = { ...update, patch: { ...patch, ...(order !== undefined ? { order } : {}) } }
  const leaves = tileLeaves(model, id)
  session.dispatch(leaves.length > 0 ? transaction([moved, ...leaves]) : moved)
}

/** What placing and mapping on a poster writes: each through the one dispatch, each one step. */
function posterActions(session: ModelSession, sheetId: string | undefined, makeId: MakeId, s: Translate): PosterActions {
  const sheetNow = () => (sheetId === undefined ? undefined : session.current().diagrams.find((diagram) => diagram.id === sheetId))
  const labelled = (sheet: DesignDiagram, ids: readonly ElementId[]) => [...new Set([...(sheet.labels ?? []), ...ids])]
  const rowsMissing = (type: 'assigned' | 'supports', sourceId: ElementId, ids: readonly ElementId[]): Command[] => {
    const rows = session.current().relations
    return ids.filter((id) => !rows.some((row) => row.type === type && row.sourceId === sourceId && row.targetId === id))
      .map((id) => ({ type: 'relation.create' as const, relation: { id: session.ids.connection(), type, sourceId, targetId: id } }))
  }
  const one = (commands: Command[]) => { if (commands.length > 0) session.dispatch(commands.length === 1 ? commands[0] : transaction(commands)) }
  return {
    place(blocks, boxes) {
      if (sheetId === undefined) return
      one([
        ...(blocks.length > 0 ? [{ type: 'node.set' as const, diagramId: sheetId, nodes: [...blocks] }] : []),
        ...(boxes.length > 0 ? [{ type: 'box.set' as const, diagramId: sheetId, boxes: [...boxes] }] : []),
      ])
    },
    firstLayout() {
      const sheet = sheetNow()
      if (!sheet) return
      const geometry = sheet.geometry
      one([
        ...(geometry?.nodes.length ? [{ type: 'node.remove' as const, diagramId: sheet.id, elementIds: geometry.nodes.map((node) => node.id) }] : []),
        ...(geometry?.groups?.length ? [{ type: 'box.remove' as const, diagramId: sheet.id, groupIds: geometry.groups.map((box) => box.id) }] : []),
        ...(geometry?.cells?.length ? [{ type: 'cell.remove' as const, diagramId: sheet.id, elementIds: geometry.cells.map((cell) => cell.id) }] : []),
      ])
    },
    resetTiles() {
      const sheet = sheetNow()
      const cells = sheet?.geometry?.cells
      if (sheet && cells?.length) session.dispatch({ type: 'cell.remove', diagramId: sheet.id, elementIds: cells.map((cell) => cell.id) })
    },
    cell(id, cell, freeing) {
      if (sheetId === undefined) return
      one([
        ...(freeing !== undefined ? [{ type: 'cell.remove' as const, diagramId: sheetId, elementIds: [freeing] }] : []),
        cell
          ? { type: 'cell.set' as const, diagramId: sheetId, cells: [{ id, ...cell }] }
          : { type: 'cell.remove' as const, diagramId: sheetId, elementIds: [id] },
      ])
    },
    team(ids, team) {
      const sheet = sheetNow()
      if (!sheet) return undefined
      const commands: Command[] = []
      let sourceId = 'id' in team ? team.id : undefined
      if (sourceId === undefined && 'name' in team) {
        const name = team.name.trim()
        const held = session.current().elements.find((element) => element.kind === 'actor' && element.name === name)
        sourceId = held?.id
        if (!held) {
          const actor = newElement(session.ids, session.current().elements, { kind: 'actor', name }, s('sheet.untitled'))
          commands.push({ type: 'element.create', element: actor })
          sourceId = actor.id
        }
      }
      if (sourceId === undefined) return undefined
      commands.push(...rowsMissing('assigned', sourceId, ids), { type: 'diagram.update', id: sheet.id, patch: { labels: labelled(sheet, ids) } })
      one(commands)
      return sourceId
    },
    showLabel(id, on) {
      const sheet = sheetNow()
      if (!sheet) return
      const labels = on ? labelled(sheet, [id]) : (sheet.labels ?? []).filter((held) => held !== id)
      session.dispatch({ type: 'diagram.update', id: sheet.id, patch: { labels: labels.length > 0 ? labels : undefined } })
    },
    cover(ids, applicationId) {
      one(rowsMissing('supports', applicationId, ids))
    },
    hand(ids, scope) {
      const elements = session.current().elements
      one(ids.flatMap((id) => {
        const handed = elements.find((element) => element.id === id)?.scopes ?? []
        return handed.includes(scope) ? [] : [{ type: 'element.update' as const, id, patch: { scopes: [...handed, scope] } }]
      }))
    },
    addItem(item, at) {
      if (sheetId === undefined) return undefined
      const id = makeId('item')
      session.dispatch({ type: 'poster.item.add', diagramId: sheetId, item: { ...item, id }, place: { ...at, id } })
      return id
    },
    updateItem(id, patch) {
      if (sheetId !== undefined) session.dispatch({ type: 'poster.item.update', diagramId: sheetId, id, patch })
    },
    placeItem(place) {
      if (sheetId !== undefined) session.dispatch({ type: 'poster.item.place', diagramId: sheetId, place })
    },
    removeItem(id) {
      if (sheetId !== undefined) session.dispatch({ type: 'poster.item.remove', diagramId: sheetId, id })
    },
    undo: session.undo,
    redo: session.redo,
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
