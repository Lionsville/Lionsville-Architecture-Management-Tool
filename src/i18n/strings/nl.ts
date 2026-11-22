// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Dutch, for the words more than one module says.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {

  'common.cancel': 'Annuleren',
  'common.close': 'Sluiten',
  'common.delete': 'Verwijderen',
  'common.save': 'Bewaren',
  'common.none': 'Geen',
  'common.name': 'Naam',
  'common.language': 'Taal',
  'common.languageNl': 'Nederlands',
  'common.languageDe': 'Deutsch',
  'common.languageEn': 'English',
  'common.empty': 'Nog niets geschreven.',
  'common.history': 'Geschiedenis…',
  'common.arriving': 'Laden…',
  'common.copyLink': 'Link kopiëren',
  'common.organisation': 'de organisatie',
  'common.partNotLoaded': 'Dit kon niet worden geladen.',
  'common.tryAgain': 'Opnieuw proberen',
  'common.resizeColumn': 'Sleep om deze kolom meer of minder ruimte te geven; dubbelklik om hem terug te zetten',
  'common.backToReading': 'Terug naar lezen',

  // --- said by the shell and by the pages composed below it (ADR-0049) ------
  'common.deleted': '“{name}” verwijderd.',
  'common.newDiagram': 'Nieuw landschap',
  'common.newChart': 'Organogram',
  'common.newConway': 'Conway-kaart',
  'common.deleteDiagramTitle': 'Weergave “{name}” verwijderen?',
  'common.deleteBody.layer7':
    'De plaatsingen, groepen en routes van dit landschap gaan verloren. De elementen zelf blijven in het model, en containerdiagrammen blijven staan.',
  'common.deleteBody.container':
    'De containers op deze weergave gaan mee, en de koppelvlakken die zij droegen verhuizen naar de applicatie. De applicatie zelf blijft op het landschap.',
  'common.deleteBody.sheet':
    'Het blad gaat weg, met waar de blokken op de poster stonden. De functies, stappen en belanghebbenden erop blijven in het model.',
  'common.deleteBody.map':
    'De kaart gaat weg. Ze wordt ingedeeld uit de functies en de relaties, die allemaal in het model blijven.',
  'common.deleteBody.technology':
    'Het technologielandschap gaat weg. Het wordt uit de vastleggingen gelezen, dus elke applicatie, dienst en elk platform erop blijft in het model.',
  'common.deleteBody.drawing':
    'De tekening gaat weg, met alles wat erop getekend is. Waar ze naar verwijst, blijft in het model.',
  'common.deleteBody.chart':
    'Het organogram gaat weg. Het wordt ingedeeld uit de eenheden, dus elke eenheid, rol en toewijzing erop blijft bestaan.',
  'common.deleteBody.conway':
    'De Conway-kaart gaat weg. Ze wordt gelezen uit de eenheden en de applicaties die zij bezitten, die allemaal in het model blijven.',
  'common.scopeCreated': '\u201c{name}\u201d aangemaakt.',
  'common.documentation': 'Documentatie',
  'common.decisions': 'Besluiten',
  'common.observations': 'Waarnemingen',
  'common.roadmap': 'Roadmap',
  'common.pick.filedIn': 'ingedeeld in {scope}',
  'common.pick.in': 'in {name}',
  'common.pick.otherUnits': 'Van een type dat het model niet kent',
  'common.pick.otherActors': 'Anderen in deze scope',
  'common.pick.servesOne': 'een {type} bedient één domein',
  'common.pick.readOnly': 'bijgehouden waar je alleen mag lezen',
  'common.pick.notWritten': 'Er is niets weggeschreven.',
  'common.pick.findUnit': 'Zoek een eenheid',
  'common.pick.noUnit': 'Geen eenheid met die naam',
  'common.pick.findScope': 'Zoek een scope',
  'common.pick.noScope': 'Geen scope met die naam',
  'common.pick.findFunction': 'Zoek een gebied, groep of capability',
  'common.pick.noFunction': 'Niets met die naam',
}
