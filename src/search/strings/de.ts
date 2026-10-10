// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * German, for the search over everything.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {

  'search.title': 'Element suchen',
  'search.placeholder': 'Name, Kategorie oder Anbieter',
  'search.field': 'Elemente suchen',
  'search.results': 'Suchergebnisse',
  'search.empty': 'Tippen, um in diesem Entwurf zu suchen.',
  'search.noMatches': 'Kein Element entspricht „{query}“.',
  'search.otherDiagram': 'auf {name}',
  'search.unplaced': 'auf keinem Diagramm',
  'search.hint': 'Enter öffnet den ersten Treffer; Esc schließt.',

  'gsearch.title': 'Überall suchen',
  'gsearch.placeholder': 'Elemente, Ansichten, Entscheidungen, Pläne, Beobachtungen…',
  'gsearch.field': 'Überall suchen',
  'gsearch.results': 'Ergebnisse',
  'gsearch.empty': 'Tippen, um alles zu durchsuchen, was dieser Bereich festhält — Elemente und ihre Seiten, Ansichten, Beziehungen, Entscheidungen, Pläne und Meilensteine, Beobachtungen, Ursachen, Lösungen und Experimente — und was der Rest der Organisation festhält.',
  'gsearch.noMatches': 'Nichts entspricht „{query}“.',
  'gsearch.hint': 'Enter öffnet das markierte Ergebnis dort, wo es liegt; Esc schließt.',
  'gsearch.kind.element': 'Elemente',
  'gsearch.kind.documentation': 'Dokumentation',
  'gsearch.kind.view': 'Ansichten',
  'gsearch.kind.relation': 'Beziehungen',
  'gsearch.kind.decision': 'Entscheidungen',
  'gsearch.kind.plan': 'Pläne',
  'gsearch.kind.milestone': 'Meilensteine',
  'gsearch.kind.observation': 'Beobachtungen',
  'gsearch.kind.cause': 'Ursachen',
  'gsearch.kind.solution': 'Lösungen',
  'gsearch.kind.experiment': 'Experimente',
  'gsearch.view.layer7': 'Landschaft',
  'gsearch.view.container': 'Containerdiagramm',
  'gsearch.view.sheet': 'Geschäftsarchitektur',
  'gsearch.view.map': 'Unternehmenskarte',
  'gsearch.view.technology': 'Technologielandschaft',
  'gsearch.view.drawing': 'Zeichnung',
}
