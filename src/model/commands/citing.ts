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
import type { PatchKeys, Refused } from './handler'
import { plainFamily } from './plain'

const CITATION_FIELDS: PatchKeys<'citation.update'> = {
  about: true, principle: true, aspect: true, stance: true, reason: true, on: true,
}

const REFUSAL: Record<CitationShapeRefusal, Refused> = {
  notCitable: { ok: false, reason: 'command.notCitable' },
  unknownRecord: { ok: false, reason: 'command.unknownRecord' },
  reasonMissing: { ok: false, reason: 'command.reasonMissing' },
}

export const CITATION_COMMANDS = plainFamily('citations', {
  fields: CITATION_FIELDS,
  refuses(model, citation, command) {
    // Put back as it was, it was there: a record the scope no longer holds is no reason to refuse an undo.
    if (command.type === 'citation.add' && command.put) return undefined
    const refused = citationShapeRefusal(model, citation)
    return refused ? REFUSAL[refused] : undefined
  },
  putBack: { put: true },
})
