// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Dutch, for what the outside world says when it cannot do as it is asked.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'shell.badScopePath': 'Die scope heeft geen bruikbaar adres ({path}) en kan dus niet bewaard worden.',
  'shell.folderUnavailable': 'Die map is niet beschikbaar. Kies hem opnieuw, of koppel de schijf weer aan.',
  'shell.folderNoAccess': 'Deze app mag niet in die map schrijven: hij is alleen-lezen, of afgeschermd voor deze app. Geef schrijfrechten, of werk vanuit een andere map.',
  'shell.diskFull': 'De schijf waar die map op staat is vol. Maak er ruimte op vrij.',
  'shell.laterNotReplaced': 'Deze scope is niet gewijzigd: een latere versie van de app heeft hem geschreven, en deze kan niet alles ervan lezen. Werk de app bij, en open de scope opnieuw.',
  'shell.unreadableNotSaved': 'Deze scope is niet opgeslagen: een deel ervan kon niet worden gelezen, en een wijziging zou verloren hebben wat erin staat. Zet hem terug uit de geschiedenis, of haal een bewaard bestand binnen.',
  'shell.scopeMoved': 'Iemand heeft deze scope gewijzigd terwijl dit bezig was, dus er is niets weggeschreven. Open hem opnieuw en voer de wijziging nog eens uit.',
  'shell.scopeReadOnly': 'Er is niets weggeschreven: je mag deze scope lezen, maar niet wijzigen. Vraag het iemand die het wel mag wijzigen.',
  'shell.historyMidway': 'Er is niets vastgelegd: de geschiedenis van deze map is halverwege een samenvoeging, een rebase of een andere eigen wijziging. Rond die eerst af of breek hem af, en leg daarna opnieuw vast.',
  'shell.historyDetached': 'Er is niets vastgelegd: de geschiedenis van deze map staat op geen enkele tak, dus een versie die nu wordt vastgelegd zou bij geen tak horen. Ga eerst naar een tak, en leg daarna opnieuw vast.',
  'shell.gitMissing': 'De geschiedenis heeft git op deze computer nodig. Installeer git en probeer het opnieuw.',
  'shell.gitTooOld': 'De geschiedenis heeft git 2.26 of nieuwer op deze computer nodig. Werk git bij en probeer het opnieuw.',
  'shell.gitRefused': 'git is in deze map niet uitgevoerd: {reason}',
  'shell.historyFailed': 'De geschiedenis van deze map kon niet worden gelezen of geschreven. De diagnose zegt waarom.',
  'shell.storageFull': 'Deze browser heeft geen ruimte meer voor deze app, dus er is niets bewaard. Bewaar een kopie en maak daarna ruimte vrij voor deze site in de instellingen van de browser.',
  'shell.storageReload': 'Deze pagina kan niet meer bewaren in deze browser: de app is in een ander tabblad bijgewerkt, of de browser is het bewaarde werk kwijtgeraakt. Herlaad de pagina om verder te gaan.',
  'shell.storageBlocked': 'Een ander tabblad heeft nog een oudere versie van deze app open. Sluit of herlaad dat tabblad, dan gaat dit verder.',
}
