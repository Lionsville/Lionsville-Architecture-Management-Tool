// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Dutch, for a reference in a document, as it is drawn.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'refs.asItStood': 'zoals ze was toen ernaar verwezen werd',
  'refs.elsewhere': '{what}, in de scope waar dit document over gaat',
  'refs.changedSince': 'gewijzigd sinds ernaar verwezen werd',
  'refs.evaluationIn': '{block} in {scope}',
  'refs.open': 'Openen',
  'refs.openBlock': '{name} openen',
  'refs.openEvaluation': 'De beoordeling openen',
  'refs.requirementsIn': 'Eisen, bewaard in {scope}',
}
