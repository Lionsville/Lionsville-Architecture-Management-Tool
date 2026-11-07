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

  // --- the kit's canvas parts: what they always say ---------------------------
  'kit.dock.label': 'Zoom en weergave',
  'kit.dock.zoomIn': 'Inzoomen',
  'kit.dock.zoomOut': 'Uitzoomen',
  'kit.dock.value': 'Gezoomd op {percent}%',
  'kit.dock.fit': 'Passend',
  'kit.dock.fitHint': 'Maak het passend in het venster, tot 60%',
  'kit.dock.home': '100%',
  'kit.dock.homeHint': 'Terug naar 100%',
  'kit.dock.atFloor': 'Zoomen stopt bij 60%. Een groter canvas schuift.',
  'kit.dock.atCeiling': 'Zoomen stopt bij 200%.',
  'kit.dock.grid': 'Raster',
  'kit.dock.map': 'Kaart',
  'kit.dock.mapHint': 'Een kleine kaart van het hele canvas',
  'kit.colour': 'Kleur',
  'kit.colour.on': 'Kleur: {question}',
  'kit.colour.none': 'Geen',
  'kit.key.label': 'Legenda',
  'kit.key.other': 'Overig',
  'kit.key.keep': 'Bewaren bij de weergave',
  'kit.day': 'Dag',
  'kit.day.on': 'Dag: {day}',
  'kit.day.today': 'Vandaag',
  'kit.day.choose': 'Kies een dag…',
  'kit.day.field': 'De dag om naar te kijken',
  'kit.day.show': 'Deze dag tonen',
  'kit.day.outside': 'Niets hier heeft een datum op deze dag',
  'kit.viewbar.label': 'Weergave',
  'kit.card.agent': 'Gewijzigd door een agent, nog niet nagekeken',
  'kit.zone.fold': '{name} inklappen',
  'kit.zone.unfold': '{name} uitklappen',
  'kit.line.number': 'Lijn {number}',
  'kit.axis.today': 'Vandaag',
  'kit.axis.todayHint': 'Terug naar drie maanden voor vandaag',
  'kit.axis.fit': 'Passend',
  'kit.axis.fitHint': 'Alles met een datum tonen',
  'kit.axis.scale': 'Tijdschaal',
  'kit.axis.weeks': 'Weken',
  'kit.axis.months': 'Maanden',
  'kit.axis.quarters': 'Kwartalen',
  'kit.axis.years': 'Jaren',
  'kit.axis.range': '{from} t/m {to}',
  'kit.axis.from': 'Van',
  'kit.axis.to': 'Tot en met',
  'kit.axis.rangeRefused': 'De laatste dag ligt voor de eerste.',
  'kit.axis.rangeLabel': 'De getoonde dagen',
  'kit.axis.ruler': 'Tijdliniaal. De pijltjestoetsen schuiven hem op.',
  'kit.axis.boardShows': 'Bord toont {day}',
  'kit.axis.boardPinned': 'Bord {day}',
  'kit.axis.dayHandle': 'De dag die het bord toont',
  'kit.axis.dayBack': 'Terugschuiven naar {day}',
  'kit.axis.runsBefore': '{name}, begint voor dit venster',
  'kit.axis.runsAfter': '{name}, loopt door na dit venster',
  'kit.axis.runsBoth': '{name}, loopt door voorbij beide randen',
  'kit.axis.together': '{count} mijlpalen',
}
