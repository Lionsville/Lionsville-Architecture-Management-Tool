// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `function.claim` (ADR-0040 §5): the scope a call names takes up a function
 * of a scope above it — an area, a grouping or a capability — as a stand-in
 * on its own sheet, one step in its own session.
 *
 * The rule is the sheet's (`business/claim.claimCommand`), so *From above…*
 * and the agent cannot disagree about where the stand-in lands. What this
 * adds is the agent's half: the entry and the stand-in from the tree, which
 * sheet it is drawn on where the scope has several, and the reducer's keys
 * turned into the agent's.
 */
import { claimCommand } from '../../business/claim'
import type { DesignDiagram } from '../../model/types'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, WriteView } from './shared'

/** The sheet the claim is drawn on: the one named, the only one, none — or a question where there are several. */
function sheetOf(args: Args, view: WriteView): { sheet?: DesignDiagram } | AgentAnswer {
  const sheets = view.current().diagrams.filter((diagram) => diagram.kind === 'sheet')
  if (typeof args.diagramId === 'string') {
    const named = view.current().diagrams.find((diagram) => diagram.id === args.diagramId)
    if (!named) return refused('agent.unknownId', `diagram ${args.diagramId}`)
    if (named.kind !== 'sheet') return refused('agent.badArguments', `${args.diagramId} is a ${named.kind}, not a business sheet`)
    return { sheet: named }
  }
  if (sheets.length > 1) {
    return refused('agent.badArguments', `this scope has ${sheets.length} sheets: pass diagramId, one of ${sheets.map((one) => `${one.id} (${one.name})`).join(', ')}`)
  }
  return sheets.length === 1 ? { sheet: sheets[0] } : {}
}

export const claimFunction: Handler = (args, view) => {
  const id = args.id as string
  const on = sheetOf(args, view)
  if ('ok' in on) return on
  const entry = view.tree?.lookup(id)
  const standIn = view.standInFor?.(id)
  if (!entry || !standIn) {
    // Held here already is an answer whatever the tree says; anything else is an id nobody defines.
    if (view.model.elements[id]) return claimed(view, id, entry?.master)
    return refused('agent.unknownId', `function ${id}`)
  }
  const plan = claimCommand({
    entry, scope: view.scopePath, model: view.current(), standIn, origin: 'agent',
    ...(on.sheet ? { sheet: on.sheet } : {}),
  })
  if ('already' in plan) return json({ id, name: entry.name, claimedFrom: entry.master, already: true })
  if ('refused' in plan) {
    if (plan.refused === 'claim.unknown') return refused('agent.unknownId', `function ${id}`)
    if (plan.refused === 'claim.notAFunction') return refused('agent.badArguments', `${plan.detail}: only an area, a grouping or a capability is taken up`)
    return refused(plan.refused, plan.detail)
  }
  return {
    command: plan.command,
    answer: json({
      id, name: entry.name, claimedFrom: entry.master,
      ...(plan.parentId !== undefined ? { parentId: plan.parentId } : {}),
      ...(plan.drawnOn !== undefined ? { drawnOn: plan.drawnOn } : {}),
    }),
  }
}

/** A record this scope holds already: a definition here is refused, a stand-in is the claim. */
function claimed(view: WriteView, id: string, master: string | undefined): AgentAnswer {
  const held = view.model.elements[id]
  if (held.ref === undefined) return refused('claim.definedHere', id)
  return json({ id, name: held.name, claimedFrom: master ?? held.ref, already: true })
}
