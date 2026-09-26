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
  'shell.badScopePath': 'Dat onderdeel heeft geen bruikbaar adres ({path}) en kan dus niet bewaard worden.',
  'shell.folderUnavailable': 'Die map is niet beschikbaar. Kies hem opnieuw, of koppel de schijf weer aan.',
  'shell.unreadableNotSaved': 'Deze scope is niet opgeslagen: zijn model.json kon niet worden gelezen, en opslaan zou er een leeg model overheen hebben geschreven. Herstel het bestand, of haal het terug uit de geschiedenis, en open de scope opnieuw.',
  'shell.scopeMoved': 'Iemand heeft dit onderdeel gewijzigd terwijl dit bezig was, dus er is niets weggeschreven. Open het opnieuw en voer de wijziging nog eens uit.',
}
