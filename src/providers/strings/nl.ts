// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Dutch, for what the providers that ship say for themselves.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'sync.diverged':
    'Deze map en de remote zijn allebei verdergegaan. Er wordt niets samengevoegd: kies welke versie blijft. '
    + 'De onze blijft hoe dan ook op een branch bewaard.',
  'sync.takeTheirs': 'Die van de remote',
  'sync.keepOurs': 'Die van ons',
  'sync.pulled': 'Gelijk met de remote.',
  'sync.pushed': 'Naar de remote gepusht.',
  'sync.tookTheirs': 'De versie van de remote blijft; de onze staat op een branch.',
  'sync.keptOurs': 'Onze versie blijft, vastgelegd als merge.',
  'sync.noRemote': 'Deze map heeft geen remote om mee te synchroniseren.',
  'sync.unreachable': 'De remote is niet bereikbaar.',
  'sync.credentials':
    'De remote weigert de inloggegevens van deze machine. De app vraagt er niet om; meld je aan met je git-client.',
  'sync.timeout': 'De remote antwoordde niet op tijd.',
  'sync.pullRefused': 'De map is niet opgehaald: {reason}',
  'sync.pushRefused': 'De momentopname is niet gepusht: {reason}',
  'sync.resolveRefused': 'Er is niets veranderd: {reason}',
  'prefs.thisMachine': 'DEZE MAP, OP DEZE MACHINE',
  'prefs.thisMachineNote':
    'Bewaard door deze installatie en niet gedeeld \u2014 er wordt niets in de map geschreven, en een andere machine die deze map opent beslist zelf.',
  'prefs.pullOnOpen': 'Van de remote ophalen als deze map wordt geopend',
  'prefs.pushAfterSnapshot': 'Na elke momentopname pushen',
  'history.beforeSync': 'Voor het synchroniseren',
  'history.beforeUpgrade': 'Voor het bijwerken van het bestandsformaat',
  'folder.body':
    'Kies een map; deze app bewaart je projecten daarin als bestanden die je kunt lezen, '
    + 'back-uppen, synchroniseren en committen. In de app zelf blijft niets staan.',
  'folder.choose': 'Map kiezen…',
  'folder.adoptTitle': 'Je werk meenemen naar deze map?',
  'folder.adoptBody':
    'Je projecten worden nu in de app zelf bewaard. “{name}” kan er een kopie van '
    + 'krijgen, of openen zoals hij is. Er wordt in geen van beide gevallen iets verwijderd — '
    + 'de app houdt zijn eigen kopie tot je die zelf verplaatst.',
  'folder.adoptCopy': 'Mijn werk erin kopiëren',
  'folder.adoptSkip': 'De map openen zoals hij is',
  'picker.chooseFolder': 'Map kiezen…',
  'picker.changeFolder': 'Vanuit een andere map werken…',
  'shell.folderNotOpened': 'De map kon niet worden geopend: {message}',
}
