// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * German, for a reference in a document, as it is drawn.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'refs.asItStood': 'wie sie stand, als darauf verwiesen wurde',
  'refs.elsewhere': '{what}, im Bereich, um den es in diesem Dokument geht',
  'refs.changedSince': 'geändert, seit darauf verwiesen wurde',
  'refs.evaluationIn': '{block} in {scope}',
  'refs.open': 'Öffnen',
  'refs.openBlock': '{name} öffnen',
  'refs.openEvaluation': 'Die Bewertung öffnen',
  'refs.requirementsIn': 'Anforderungen, gehalten in {scope}',
}
