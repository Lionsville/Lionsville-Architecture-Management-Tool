// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'help.title': 'Hilfe',
  'help.product': 'Lionsville Architect',
  'help.skip': 'Zur Hilfe springen',
  'help.contents': 'Inhalt',
  'help.search': 'Hilfe durchsuchen',
  'help.searchHint': 'Ein Wort eingeben: ein Bedienelement, eine Seite, eine Aufgabe',
  'help.clear': 'Suche leeren',
  'help.results': '{count} Stellen nennen „{query}“',
  'help.resultsOne': 'Eine Stelle nennt „{query}“',
  'help.noResults': 'Nichts in der Hilfe nennt „{query}“. Versuchen Sie weniger Wörter oder ein anderes Wort für dasselbe.',
  'help.language': 'Sprache',
  'help.loading': 'Die Hilfe wird geöffnet…',
  'help.failed': 'Die Hilfe konnte nicht geöffnet werden. Laden Sie die Seite neu, um es noch einmal zu versuchen.',
  'help.where': 'Wo Sie es finden',
  'help.steps': 'So geht es',
  'help.keys': 'Tasten',
  'help.example': 'Zum Beispiel',
  'help.seeAlso': 'Siehe auch',
  'help.onDesktop': 'Nur in der Desktop-App',
  'help.onWeb': 'Nur im Browser',
  'help.onHosted': 'Wo der Ort, an dem Ihre Arbeit liegt, es anbietet',
  'help.writes': 'Nicht angeboten, wo Sie nur lesen dürfen',
  'help.worked': 'Durchgespieltes Beispiel',
  'help.background': 'Wie es funktioniert',
  'help.picture': 'Ein Bild des Bildschirms',
  'help.toTop': 'Zurück nach oben',
  'help.inChapter': 'in {chapter}',
}
