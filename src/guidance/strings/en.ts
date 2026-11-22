// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * English, for a reference in a document, as it is drawn.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` and `de.ts`
 * beside it cannot be missing one and cannot invent one. The registry composes
 * every module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {
  'refs.asItStood': 'as it stood when it was referred to',
  'refs.elsewhere': '{what}, in the scope this document is about',
  'refs.changedSince': 'changed since it was referred to',
  'refs.evaluationIn': '{block} in {scope}',
  'refs.open': 'Open',
  'refs.openBlock': 'Open {name}',
  'refs.openEvaluation': 'Open the evaluation',
  'refs.requirementsIn': 'Requirements, kept in {scope}',
} as const
