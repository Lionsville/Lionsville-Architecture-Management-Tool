// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A citation of a principle by a record of the scope (ADR-0041 §7): added,
 * changed and removed. The reducer asks what the scope can answer — a kind
 * and a stance of the table (`model/citable.ts`), a record it holds, a reason
 * to depart — and leaves what the principle says (fixed, retired) to where the
 * principle is read, since it may be kept in another scope.
 */
import { citationShapeRefusal } from '../citable'
import type { CitationShapeRefusal } from '../citable'
import { citationsOf } from '../normalised'
import { gone, ok, taken } from './handler'
import type { CommandTable, PatchKeys, Refused } from './handler'
import { drop, patched, put, withCitations } from './rows'
import { patchWrites } from './writes'

const CITATION_FIELDS: PatchKeys<'citation.update'> = {
  about: true, principle: true, aspect: true, stance: true, reason: true, on: true,
}

const REFUSAL: Record<CitationShapeRefusal, Refused> = {
  notCitable: { ok: false, reason: 'command.notCitable' },
  unknownRecord: { ok: false, reason: 'command.unknownRecord' },
  reasonMissing: { ok: false, reason: 'command.reasonMissing' },
}

export const CITATION_COMMANDS = {
  'citation.add': {
    carries: { citation: true },
    writes: (command) => [`citation/${command.citation.id}`],
    apply(model, command, { meta }) {
      const { citation, at } = command
      if (citation.id in citationsOf(model)) return taken
      // Put back as it was, it was there: a record the scope no longer holds is no reason to refuse an undo.
      const refused = command.put ? undefined : citationShapeRefusal(model, citation)
      if (refused) return REFUSAL[refused]
      const rows = put(citationsOf(model), model.order.citations, citation.id, citation, at)
      return ok(withCitations(model, rows), { type: 'citation.remove', id: citation.id }, meta)
    },
  },

  'citation.update': {
    carries: { id: true, patch: true },
    patch: { keys: CITATION_FIELDS, row: (model, command) => citationsOf(model)[command.id] },
    writes: (command) => patchWrites(`citation/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = citationsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const refused = citationShapeRefusal(model, row)
      if (refused) return REFUSAL[refused]
      const rows = put(citationsOf(model), model.order.citations, command.id, row)
      return ok(withCitations(model, rows), { type: 'citation.update', id: command.id, patch: inverse }, meta)
    },
  },

  'citation.remove': {
    carries: { id: true },
    writes: (command) => [`citation/${command.id}`],
    apply(model, command, { meta }) {
      const held = citationsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.citations.indexOf(command.id)
      const rows = drop(citationsOf(model), model.order.citations, command.id)
      return ok(withCitations(model, rows), { type: 'citation.add', citation: held, at, put: true }, meta)
    },
  },
} satisfies Partial<CommandTable>
