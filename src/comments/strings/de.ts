// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Deutsch, für einen Verlauf von Kommentaren (ADR-0037). */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'comments.title': 'Kommentare',
  'comments.count': 'Kommentare ({count})',
  'comments.empty': 'Noch keine Kommentare. Ein Kommentar handelt von diesem Eintrag und ändert ihn nie.',
  'comments.write': 'Kommentar schreiben',
  'comments.writeReply': 'Antwort schreiben',
  'comments.send': 'Kommentieren',
  'comments.reply': 'Antworten',
  'comments.edit': 'Bearbeiten',
  'comments.save': 'Speichern',
  'comments.cancel': 'Abbrechen',
  'comments.remove': 'Entfernen',
  'comments.removeTip': 'Nimmt diesen Kommentar aus dem Verlauf und lässt eine Markierung an seiner Stelle, damit die Antworten ihren Platz behalten',
  'comments.removed': 'Kommentar entfernt',
  'comments.edited': 'bearbeitet',
  'comments.you': 'Sie',
  'comments.via': 'über {agent}',
  'comments.cameWith': 'Mitgekommen mit',
  'comments.who': 'Wer schreibt? Wählen Sie sich einmal aus dem Register; die App merkt es sich als Das bin ich.',
  'comments.noRegister': 'Ein Kommentar wird von einer Person aus dem Register gezeichnet, und das Register wird hier nicht gelesen.',
  'comments.elsewhere': 'Dieser Eintrag liegt in einem anderen Bereich: Seine Kommentare werden dort gelesen und geschrieben.',
  'comments.openScope': '{scope} öffnen',
  'comments.readOnly': 'Dieser Bereich wird hier gelesen und nicht geändert, daher kann nicht kommentiert werden.',
  'comments.refused': 'Der Kommentar wurde nicht geschrieben.',
  'comments.notLoaded': 'Die Kommentare konnten nicht geladen werden.',
  'changes.heading': 'Änderungen',
  'changes.recordedBy': 'Erfasst von {name} am {when}',
  'changes.proposedBy': 'Vorgeschlagen von {name} am {when}',
  'changes.addedBy': 'Hinzugefügt von {name} am {when}',
  'changes.lastChangedBy': 'zuletzt geändert von {name} am {when}',
  'changes.countOne': '1 Änderung',
  'changes.countOther': '{count} Änderungen',
  'changes.countMore': '{count}+ Änderungen',
  'changes.began': 'Angelegt',
  'changes.show': 'Änderungen',
  'changes.hide': 'Änderungen ausblenden',
}
