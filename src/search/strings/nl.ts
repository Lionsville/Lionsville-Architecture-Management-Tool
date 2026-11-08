// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Dutch, for the search over everything.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {

  'search.title': 'Element zoeken',
  'search.placeholder': 'Naam, categorie of leverancier',
  'search.field': 'Elementen zoeken',
  'search.results': 'Zoekresultaten',
  'search.empty': 'Typ om in dit ontwerp te zoeken.',
  'search.noMatches': 'Geen element komt overeen met “{query}”.',
  'search.otherDiagram': 'op {name}',
  'search.unplaced': 'op geen enkele weergave',
  'search.hint': '{key:Enter} toont het eerste resultaat; {key:Escape} sluit.',

  'gsearch.title': 'Zoek of voer een opdracht uit',
  'gsearch.placeholder': 'Scopes, weergaven, records, mensen en opdrachten…',
  'gsearch.field': 'Zoek of voer een opdracht uit',
  'gsearch.results': 'Resultaten',
  'gsearch.more': 'Meer',
  'gsearch.showAll': 'Alles tonen',
  'gsearch.empty': 'Typ om te zoeken in alles wat deze scope vastlegt — elementen en hun pagina’s, weergaven, relaties, besluiten, plannen en mijlpalen, waarnemingen, oorzaken, oplossingen en experimenten — en in wat de rest van de organisatie vastlegt.',
  'gsearch.noMatches': 'Niets komt overeen met \u201c{query}\u201d.',
  'gsearch.hint': '{key:Enter} opent het gemarkeerde resultaat waar het staat; {key:Escape} sluit.',
  'gsearch.kind.element': 'Elementen',
  'gsearch.kind.documentation': 'Documentatie',
  'gsearch.kind.view': 'Weergaven',
  'gsearch.kind.relation': 'Relaties',
  'gsearch.kind.decision': 'Besluiten',
  'gsearch.kind.plan': 'Plannen',
  'gsearch.kind.milestone': 'Mijlpalen',
  'gsearch.kind.observation': 'Waarnemingen',
  'gsearch.kind.cause': 'Oorzaken',
  'gsearch.kind.solution': 'Oplossingen',
  'gsearch.kind.unitType': 'Eenheidstypen',
  'gsearch.kind.role': 'Rollen',
  'gsearch.kind.responsibility': 'Verantwoordelijkheden',
  'gsearch.kind.principle': 'Principes',
  'gsearch.kind.person': 'Personen',
  'gsearch.person.active': 'Actief',
  'gsearch.person.left': 'Vertrokken',
  'gsearch.person.forgotten': 'Vergeten',
  // What a person holds, under their name: their first role and its unit, and how many more.
  'gsearch.person.holds': '{role} in {unit}',
  'gsearch.person.holdsMore': 'nog {count}',
  'gsearch.kind.comment': 'Reacties',
  'gsearch.kind.experiment': 'Experimenten',
  'gsearch.view.layer7': 'Landschap',
  'gsearch.view.container': 'Containerdiagram',
  'gsearch.view.sheet': 'Bedrijfsarchitectuur',
  'gsearch.view.map': 'Dekking',
  'gsearch.view.technology': 'Technologielandschap',
  'gsearch.view.drawing': 'Tekening',
  'gsearch.view.chart': 'Organogram',
  'gsearch.view.conway': 'Conway-kaart',
}
