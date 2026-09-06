/**
 * What a step is called, for a list a person reads (ADR-0002, step 9).
 *
 * The log exists either way — every step is a pair of commands, and has been
 * since the reducer landed. This is the part that turns it into something worth
 * showing: one line per step, in words, so "what have I done to this project
 * since I opened it" is a question the app can answer.
 *
 * Derived rather than declared. A `label` on every dispatch would be a second
 * thing to keep true, forgotten at exactly the sites that matter — a command
 * already says what it did, and the only thing it does not carry is what the
 * row was called before the step changed it. So this is handed the model **as
 * it was before**, and resolves the name from there: a delete can still say
 * whose delete it was.
 *
 * It reads the FIRST command of a step deliberately. Every transaction the app
 * builds leads with its subject — the element before its placement, the
 * connection before its route, the group box before its members — so the lead
 * is what the step is about and the rest is what that entailed.
 */
import type { StringKey } from '../i18n/strings'
import type { Command, CommandBody } from './commands'
import { decisionsOf } from './normalised'
import type { Model } from './normalised'

export type StepSummary = {
  /** What it says. */
  key: StringKey
  /** What it was done to, where naming it helps. */
  name?: string
  /** How many, where a step touched several. */
  count?: number
}

/** A step nobody can name — the empty transaction, and nothing else. */
const NOTHING: StepSummary = { key: 'activity.nothing' }

export function summarise(commands: readonly Command[], before: Model): StepSummary {
  const flat = flatten(commands)
  const lead = flat[0]
  if (!lead) return NOTHING

  const many = (type: CommandBody['type']) => flat.filter((c) => c.type === type).length

  switch (lead.type) {
    case 'element.create':
      return { key: 'activity.elementAdded', name: lead.element.name, count: many('element.create') }
    case 'element.update':
      return {
        key: 'activity.elementChanged',
        name: before.elements[lead.id]?.name,
        count: many('element.update'),
      }
    case 'element.delete':
      return {
        key: 'activity.elementDeleted',
        name: before.elements[lead.id]?.name,
        count: many('element.delete'),
      }

    case 'connection.create':
      return { key: 'activity.connectionAdded' }
    case 'connection.update':
      return { key: 'activity.connectionChanged' }
    case 'connection.delete':
      return { key: 'activity.connectionDeleted' }

    case 'placement.set': {
      const count = flat.reduce(
        (n, c) => n + (c.type === 'placement.set' ? c.placements.length : 0), 0)
      return { key: count === 1 ? 'activity.movedOne' : 'activity.movedMany', count }
    }
    case 'placement.remove': {
      const count = flat.reduce(
        (n, c) => n + (c.type === 'placement.remove' ? c.elementIds.length : 0), 0)
      return { key: count === 1 ? 'activity.removedOne' : 'activity.removedMany', count }
    }
    case 'route.set':
    case 'route.clear':
      return { key: 'activity.routeChanged' }
    case 'layout.set':
      return { key: 'activity.layoutChanged' }

    case 'diagram.create':
      return { key: 'activity.diagramAdded', name: lead.diagram.name }
    case 'diagram.rename':
      return { key: 'activity.diagramRenamed', name: lead.name }
    case 'diagram.settings':
      return { key: 'activity.diagramSettings', name: lead.settings.name }
    case 'diagram.update':
      return { key: 'activity.diagramChanged', name: before.diagrams[lead.id]?.name }
    case 'diagram.delete':
      return { key: 'activity.diagramDeleted', name: before.diagrams[lead.id]?.name }

    case 'decision.add':
      return { key: 'activity.decisionAdded', name: lead.decision.title }
    case 'decision.update':
      return { key: 'activity.decisionChanged', name: decisionsOf(before)[lead.id]?.title }
    case 'decision.remove':
      return { key: 'activity.decisionRemoved', name: decisionsOf(before)[lead.id]?.title }

    case 'project.settings':
      return { key: 'activity.projectSettings' }

    case 'transaction':
      // Unreachable: `flatten` has none left. Named so the switch is total.
      return NOTHING
  }
}

/** Every command of a step, transactions opened out, in the order they ran. */
function flatten(commands: readonly Command[]): CommandBody[] {
  const out: CommandBody[] = []
  for (const command of commands) {
    if (command.type === 'transaction') out.push(...flatten(command.commands))
    else out.push(command)
  }
  return out
}
