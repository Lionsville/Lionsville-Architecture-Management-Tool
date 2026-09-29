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
  'shell.sourceFolder': 'Map · {name}',
  'shell.sourceBrowser': 'In deze browser',
  'shell.sourceMemory': 'Nergens bewaard',
  'shell.sourceTipFolder': 'Je projecten zijn bestanden in deze map. Momentopnamen gaan in haar geschiedenis.',
  'shell.sourceTipBrowser': 'Je projecten staan in de opslag van deze browser. Bewaar een werkbestand om ze ergens anders te houden.',
  'shell.sourceTipMemory': 'Er wordt niets bewaard: de opslag weigerde. Bewaar een werkbestand voor je dit tabblad sluit.',
  'picker.deleteBodyFolder': 'Dit verwijdert {name}, alles wat eronder is ondergebracht, en haar map op schijf. Een werkbestand dat je elders bewaarde blijft staan.',
  'picker.deleteBodyBrowser': 'Dit verwijdert {name} en alles wat eronder is ondergebracht uit deze browser. Een werkbestand dat je elders bewaarde blijft staan.',
  'folder.where': 'Alles hier wordt als bestanden in de map hierboven bewaard.',
  'folder.unreadableScope': '{files} in deze scope kon niet worden gelezen, dus hij staat open om te bekijken en niet om te wijzigen: een wijziging zou verliezen wat erin staat. Herstel het bestand en open de scope opnieuw, zet hem terug uit de geschiedenis, of haal een werkbestand binnen.',
  'browser.where': 'Alles hier wordt in deze browser bewaard.',
  'memory.where': 'Alles hier wordt nog nergens bewaard \u2014 bewaar een werkbestand om het te houden.',
  'shell.storageNearlyFull':
    'Deze browser zit voor ongeveer {percent}% vol voor deze app. Bewaar je werk in een map '
    + 'of een bestand voordat de ruimte op is — een browser stopt zonder te vragen met bewaren.',
  'folder.historyNote': 'Elke momentopname wordt in de map zelf vastgelegd, met git \u2014 er gaat niets van deze machine af.',
  'folder.historyNoteBrowser': 'Elke momentopname wordt in deze browser vastgelegd, naast de map \u2014 er wordt daarvoor niets in de map geschreven.',
  'browser.historyNote': 'Elke momentopname wordt in deze browser vastgelegd \u2014 er gaat niets van deze machine af.',
  'memory.historyNote': 'Momentopnamen blijven bewaard zolang dit tabblad open is, en gaan ermee weg.',
  'browser.earlierAsking': 'Deze browser is het werk kwijtgeraakt dat hij bewaarde, en er staat nog een oudere kopie. De oudere kopie terugzetten, of verdergaan met wat hier nu staat?',
  'browser.earlierDiverged': '\u201c{path}\u201d is zowel hier als in de oudere kopie van deze browser veranderd. Welke blijft?',
  'browser.earlierBring': 'De oudere kopie overnemen',
  'browser.earlierLeave': 'Houden wat hier staat',
  'browser.earlierBrought': 'De oudere kopie is overgenomen; wat hier stond, staat in de geschiedenis.',
  'browser.earlierLeft': 'Wat hier staat blijft. De oudere kopie wordt pas overgenomen als die weer verandert.',
  'browser.earlierLeftBehind': 'Een deel van wat deze browser eerder bewaarde kon niet worden gelezen en blijft waar het was: {paths}.',
  'browser.earlierRefused': '{paths} is niet overschreven met de oudere kopie: wat hier staat kon niet in zijn geheel worden gelezen.',
  'browser.historyAuthor': 'deze browser',
  'memory.historyAuthor': 'dit tabblad',
  'browser.broughtOver': 'Overgenomen uit de eerdere opslag van deze browser',
  'browser.broughtOverAgain': 'Opnieuw overgenomen uit de eerdere opslag van deze browser',
  'browser.beforeBringingAgain': 'Voor het opnieuw overnemen uit de eerdere opslag van deze browser',
  'browser.stillAnswering': 'De opslag van deze browser heeft nog niet geantwoord. Je werk verschijnt hier zodra dat gebeurt.',
  'browser.shownFromOlder': 'Je werk wordt getoond uit de oudere opslag van deze browser; wijzigingen hier worden niet bewaard. Bewaar een werkbestand om ze te houden.',
  'browser.earlierBringAt': 'De oudere kopie van \u201c{path}\u201d overnemen',
  'browser.earlierLeaveAt': '\u201c{path}\u201d houden zoals het hier staat',
  'folder.adoptCopying': 'Je werk wordt gekopieerd naar \u201c{name}\u201d\u2026',
  'folder.adoptDone': '{copied} gekopieerd naar \u201c{name}\u201d.',
  'folder.adoptPartly': '{copied} gekopieerd; niet gekopieerd ({failed}): {paths}.',
  'folder.adoptFailed': 'Er is niets gekopieerd: {message}',
  'folder.adoptMeanwhile': 'Gelaten zoals ze waren, want ze zijn intussen gewijzigd: {paths}.',
  'folder.adoptNoneMeanwhile': 'Niets gekopieerd naar \u201c{name}\u201d: gelaten zoals ze waren, want ze zijn intussen gewijzigd: {paths}.',
  'folder.adoptAgain': 'Opnieuw proberen',
  'folder.adoptClose': 'Sluiten',
}
