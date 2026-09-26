// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A view itself: made, named, set up, patched, taken away — and its board's own numbers. */
import { NOTHING } from '../commands'
import type { Diagram } from '../normalised'
import type { DiagramSettings } from '../types'
import { gone, ok, taken } from './handler'
import type { CommandTable, PatchKeys } from './handler'
import { drop, patched, put, setDiagram, withDiagrams } from './rows'
import { patchWrites } from './writes'

/** A view's machine-facing fields, and a sheet's own four (`DiagramPatch`). */
const DIAGRAM_FIELDS: PatchKeys<'diagram.update'> = {
  autoRoute: true, applicationElementId: true, asOf: true, showDeployment: true, colourBy: true,
  journeyId: true, lanes: true, areas: true, showActors: true, areaSpans: true, columns: true, paper: true,
}

/** The board's own numbers (`BoardPatch`). */
const BOARD_FIELDS: PatchKeys<'board.set'> = { canvas: true, zones: true, needsLayout: true }

export const DIAGRAM_COMMANDS = {
  'diagram.create': {
    carries: { diagram: true },
    writes: (command) => [`diagram/${command.diagram.id}`],
    apply(model, command, { meta }) {
      const { diagram, at } = command
      if (diagram.id in model.diagrams) return taken
      const rows = put(model.diagrams, model.order.diagrams, diagram.id, diagram, at)
      return ok(withDiagrams(model, rows), { type: 'diagram.delete', id: diagram.id }, meta)
    },
  },

  'diagram.rename': {
    carries: { id: true, name: true },
    writes: (command) => [`diagram/${command.id}/name`],
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      const name = command.name.trim()
      // A nameless tab is not something the caller meant to ask for.
      if (!name || name === diagram.name) return ok(model, NOTHING, meta)
      return ok(
        setDiagram(model, command.id, { ...diagram, name }),
        { type: 'diagram.rename', id: command.id, name: diagram.name },
        meta,
      )
    },
  },

  'diagram.settings': {
    carries: { id: true, settings: true },
    // The whole answer, not a patch: an absent field clears the diagram's own.
    writes: (command) => [`diagram/${command.id}/settings`],
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      if (!command.settings.name.trim()) return ok(model, NOTHING, meta)
      return ok(
        setDiagram(model, command.id, applySettings(diagram, command.settings)),
        { type: 'diagram.settings', id: command.id, settings: settingsOf(diagram) },
        meta,
      )
    },
  },

  'diagram.update': {
    carries: { id: true, patch: true },
    patch: { keys: DIAGRAM_FIELDS, row: (model, command) => model.diagrams[command.id] },
    writes: (command) => patchWrites(`diagram/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      const { row, inverse } = patched(diagram, command.patch)
      return ok(setDiagram(model, command.id, row), { type: 'diagram.update', id: command.id, patch: inverse }, meta)
    },
  },

  'diagram.delete': {
    carries: { id: true },
    writes: (command) => [`diagram/${command.id}`],
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      // The last landscape always stays; the editor disables the menu item and
      // this is the safety net underneath it.
      if (diagram.kind === 'layer7'
        && model.order.diagrams.filter((id) => model.diagrams[id].kind === 'layer7').length <= 1) {
        return { ok: false, reason: 'command.lastLandscape' }
      }
      const at = model.order.diagrams.indexOf(command.id)
      return ok(
        withDiagrams(model, drop(model.diagrams, model.order.diagrams, command.id)),
        { type: 'diagram.create', diagram, at },
        meta,
      )
    },
  },

  'board.set': {
    carries: { diagramId: true, patch: true },
    patch: { keys: BOARD_FIELDS, row: (model, command) => model.diagrams[command.diagramId] },
    writes: (command) => patchWrites(`diagram/${command.diagramId}/board`, command.patch),
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const { row, inverse } = patched(diagram, command.patch)
      return ok(
        setDiagram(model, command.diagramId, row),
        { type: 'board.set', diagramId: command.diagramId, patch: inverse },
        meta,
      )
    },
  },
} satisfies Partial<CommandTable>

/** The fields the settings dialog owns; see {@link DiagramSettings}. */
const SETTING_FIELDS = [
  'author', 'client', 'documentDate', 'showTitleBlock', 'aspectConfig', 'showAspects',
] as const

function applySettings(diagram: Diagram, settings: DiagramSettings): Diagram {
  const next = { ...diagram, name: settings.name.trim() }
  // Written out one by one, and deleted rather than set to undefined, so what
  // lands in a saved file is what a hand-written one would look like.
  const writable = next as unknown as Record<string, unknown>
  for (const field of SETTING_FIELDS) {
    if (settings[field] === undefined) delete writable[field]
    else writable[field] = settings[field]
  }
  return next
}

function settingsOf(diagram: Diagram): DiagramSettings {
  const settings: DiagramSettings = { name: diagram.name }
  const writable = settings as unknown as Record<string, unknown>
  for (const field of SETTING_FIELDS) {
    if (diagram[field] !== undefined) writable[field] = diagram[field]
  }
  return settings
}
