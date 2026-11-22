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

  // --- said by the shell and by the pages composed below it (ADR-0049) ------
  'common.deleted': '„{name}“ gelöscht.',
  'common.newDiagram': 'Neue Landschaft',
  'common.newChart': 'Organigramm',
  'common.newConway': 'Conway-Karte',
  'common.deleteDiagramTitle': 'Ansicht „{name}“ löschen?',
  'common.deleteBody.layer7':
    'Die Platzierungen, Gruppen und Routen dieser Landschaft gehen verloren. Die Elemente selbst bleiben im Modell, und Containerdiagramme bleiben bestehen.',
  'common.deleteBody.container':
    'Die Container dieser Ansicht gehen mit, und die Schnittstellen, die sie trugen, wandern auf die Anwendung. Die Anwendung selbst bleibt auf der Landschaft.',
  'common.deleteBody.sheet':
    'Das Blatt geht, mit der Stelle, an der seine Blöcke auf dem Poster standen. Die Funktionen, Schritte und Beteiligten darauf bleiben im Modell.',
  'common.deleteBody.map':
    'Die Karte geht. Sie wird aus den Funktionen und den Beziehungen angeordnet, die alle im Modell bleiben.',
  'common.deleteBody.technology':
    'Die Technologielandschaft geht. Sie wird aus den Einträgen gelesen, also bleibt jede Anwendung, jeder Dienst und jede Plattform darauf im Modell.',
  'common.deleteBody.drawing':
    'Die Zeichnung geht, mit allem, was darauf gezeichnet ist. Worauf sie verweist, bleibt im Modell.',
  'common.deleteBody.chart':
    'Das Organigramm geht. Es wird aus den Einheiten angeordnet, also bleibt jede Einheit, Rolle und Zuordnung darauf bestehen.',
  'common.deleteBody.conway':
    'Die Conway-Karte geht. Sie wird aus den Einheiten und den Anwendungen gelesen, die ihnen gehören, und die bleiben alle im Modell.',
  'common.scopeCreated': '\u201e{name}\u201c angelegt.',
  'common.documentation': 'Dokumentation',
  'common.decisions': 'Entscheidungen',
  'common.observations': 'Beobachtungen',
  'common.roadmap': 'Roadmap',
  'common.pick.filedIn': 'eingeordnet in {scope}',
  'common.pick.in': 'in {name}',
  'common.pick.otherUnits': 'Von einem Typ, den das Modell nicht kennt',
  'common.pick.otherActors': 'Andere in diesem Bereich',
  'common.pick.servesOne': 'ein {type} bedient eine Domäne',
  'common.pick.readOnly': 'geführt, wo Sie nur lesen dürfen',
  'common.pick.notWritten': 'Es wurde nichts geschrieben.',
  'common.pick.findUnit': 'Eine Einheit suchen',
  'common.pick.noUnit': 'Keine Einheit mit diesem Namen',
  'common.pick.findScope': 'Einen Bereich suchen',
  'common.pick.noScope': 'Kein Bereich mit diesem Namen',
  'common.pick.findFunction': 'Ein Gebiet, eine Gruppe oder eine Fähigkeit suchen',
  'common.pick.noFunction': 'Nichts mit diesem Namen',
}
