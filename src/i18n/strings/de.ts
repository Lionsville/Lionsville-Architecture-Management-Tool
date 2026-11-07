// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * German, for the words more than one module says.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {

  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.delete': 'Löschen',
  'common.save': 'Speichern',
  'common.none': 'Keine',
  'common.name': 'Name',
  'common.language': 'Sprache',
  'common.languageNl': 'Nederlands',
  'common.languageDe': 'Deutsch',
  'common.languageEn': 'English',
  'common.empty': 'Noch nichts geschrieben.',
  'common.history': 'Verlauf…',
  'common.arriving': 'Wird geladen…',
  'common.copyLink': 'Link kopieren',
  'common.organisation': 'die Organisation',
  'common.partNotLoaded': 'Das konnte nicht geladen werden.',
  'common.tryAgain': 'Erneut versuchen',
  'common.resizeColumn': 'Ziehen, um dieser Spalte mehr oder weniger Platz zu geben; Doppelklick setzt sie zurück',
  'common.backToReading': 'Zurück zum Lesen',

  // --- the kit's canvas parts: what they always say ---------------------------
  'kit.dock.label': 'Zoom und Ansicht',
  'kit.dock.zoomIn': 'Vergrößern',
  'kit.dock.zoomOut': 'Verkleinern',
  'kit.dock.value': 'Gezoomt auf {percent} %',
  'kit.dock.fit': 'Einpassen',
  'kit.dock.fitHint': 'Ins Fenster einpassen, bis 60 %',
  'kit.dock.home': '100%',
  'kit.dock.homeHint': 'Zurück auf 100 %',
  'kit.dock.atFloor': 'Der Zoom endet bei 60 %. Eine größere Fläche wird gescrollt.',
  'kit.dock.atCeiling': 'Der Zoom endet bei 200 %.',
  'kit.dock.grid': 'Raster',
  'kit.dock.map': 'Karte',
  'kit.dock.mapHint': 'Eine kleine Karte der ganzen Fläche',
  'kit.colour': 'Farbe',
  'kit.colour.on': 'Farbe: {question}',
  'kit.colour.none': 'Keine',
  'kit.key.label': 'Legende',
  'kit.key.other': 'Sonstige',
  'kit.key.keep': 'Mit der Ansicht speichern',
  'kit.day': 'Tag',
  'kit.day.on': 'Tag: {day}',
  'kit.day.today': 'Heute',
  'kit.day.choose': 'Tag wählen…',
  'kit.day.field': 'Der Tag, der angezeigt wird',
  'kit.day.show': 'Diesen Tag zeigen',
  'kit.day.outside': 'Hier hat nichts ein Datum an diesem Tag',
  'kit.viewbar.label': 'Ansicht',
  'kit.card.agent': 'Von einem Agenten geändert, noch nicht geprüft',
  'kit.zone.fold': '{name} einklappen',
  'kit.zone.unfold': '{name} ausklappen',
  'kit.line.number': 'Linie {number}',
  'kit.axis.today': 'Heute',
  'kit.axis.todayHint': 'Zurück auf drei Monate vor heute',
  'kit.axis.fit': 'Einpassen',
  'kit.axis.fitHint': 'Alles mit einem Datum zeigen',
  'kit.axis.scale': 'Zeitmaßstab',
  'kit.axis.weeks': 'Wochen',
  'kit.axis.months': 'Monate',
  'kit.axis.quarters': 'Quartale',
  'kit.axis.years': 'Jahre',
  'kit.axis.range': '{from} bis {to}',
  'kit.axis.from': 'Von',
  'kit.axis.to': 'Bis',
  'kit.axis.rangeRefused': 'Der letzte Tag liegt vor dem ersten.',
  'kit.axis.rangeLabel': 'Die gezeigten Tage',
  'kit.axis.ruler': 'Zeitlineal. Die Pfeiltasten verschieben es.',
  'kit.axis.boardShows': 'Board zeigt {day}',
  'kit.axis.boardPinned': 'Board {day}',
  'kit.axis.dayHandle': 'Der Tag, den das Board zeigt',
  'kit.axis.dayBack': 'Zurück zu {day}',
  'kit.axis.runsBefore': '{name}, beginnt vor diesem Fenster',
  'kit.axis.runsAfter': '{name}, läuft über dieses Fenster hinaus',
  'kit.axis.runsBoth': '{name}, läuft über beide Ränder hinaus',
  'kit.axis.together': '{count} Meilensteine',
}
