/**
 * Dutch, for the shell around the editor: the picker, the toolbar, the dialogs, the toasts.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {

  'shell.saved': 'Bewaard · {time}',
  'shell.notSaved': 'Nog niet bewaard',
  'shell.saveRefused': 'Niet bewaard — opslag weigert',
  'shell.save': 'Bewaren…',
  'shell.saveMenu': 'Bewaren',
  'shell.workingFile': 'WorkingFile',
  'shell.workingFileNote':
    'Alles: topologie, geometrie, opmaak en eigen logo’s — om verder te werken',
  'shell.interchange': 'Interchange-document',
  'shell.interchangeNote':
    'Topologie en semantiek — zonder geometrie en opmaak; voor review en versiebeheer',
  'shell.open': 'Openen…',
  'shell.theme': 'Thema',
  'shell.themeLight': 'Licht',
  'shell.themeDark': 'Donker',
  'shell.themeSystem': 'Systeem',
  'shell.themeTip': 'Thema — {name}',
  'shell.storageFailed':
    'Deze browser kon het ontwerp niet bewaren (opslag vol of geblokkeerd). Bewaar een werkbestand, anders is het bij het sluiten van het tabblad weg.',
  'shell.storageRecovered': 'Bewaren in deze browser lukt weer.',
  'shell.crashed': 'Er ging iets mis op dit scherm.',
  'shell.crashedNote':
    'Je werk tot het laatste bewaarmoment staat er nog. Herlaad om verder te gaan; de diagnostiek zegt wat er gebeurde.',
  'shell.reload': 'Herladen',
  'shell.copyDiagnostics': 'Diagnostiek kopiëren',
  'shell.diagnosticsCopied': 'Gekopieerd',
  'shell.copyFailed': 'Kopiëren lukte niet',
  'shell.bootFailed': 'De app kon niet starten.',
  'shell.bootFailedNote':
    'Je instellingen of het project dat openstond konden niet gelezen worden. Starten zonder dat project helpt meestal; er wordt niets verwijderd.',
  'shell.startFresh': 'Starten zonder het laatste project',
  'shell.unexpectedError': 'Er ging iets onverwachts mis. Herlaad de pagina als het scherm niet meer reageert.',
  'shell.orphanOne':
    'Containeraanzicht “{name}” is verwijderd: de applicatie ging uit het model. Dat aanzicht komt met Ongedaan maken niet terug.',
  'shell.orphanOther':
    '{count} containeraanzichten zijn verwijderd: hun applicaties gingen uit het model. Die aanzichten komen met Ongedaan maken niet terug.',
  'shell.duplicated': '“{name}” gedupliceerd.',
  'shell.deleted': '“{name}” verwijderd.',
  'shell.savedInterchange':
    'Interchange-document bewaard — topologie en semantiek; geometrie en opmaak reizen mee in het werkbestand.',
  'shell.savedWorkingFile':
    'WorkingFile bewaard — alles, inclusief geometrie, opmaak en eigen logo’s.',
  'shell.invalidJson': 'Geen geldige JSON: {message}',
  'shell.workingFileLoaded': 'WorkingFile “{name}” geladen.',
  'shell.interchangeLoaded':
    'Interchange-document “{name}” geladen; de platen worden opnieuw gelegd.',
  'shell.processFailed': 'Het document kon niet worden verwerkt: {message}',
  'shell.saveFileFailed': 'Het bestand kon niet worden bewaard: {message}',
  'shell.moveLeftCopy': 'Verplaatst — maar de kopie in de oude groep kon niet worden verwijderd: {message}',
  'shell.groupRenameIncomplete': 'De groep is hernoemd, maar deze projecten dragen nog de oude naam: {names}.',
  'shell.newDiagram': 'Nieuw landschap',
  'shell.add': 'Toevoegen',
  'shell.imagesMissing': 'PNG geëxporteerd, maar deze logo’s ontbreken: {labels}.',
  'shell.logoAdded': 'Logo “{name}” toegevoegd aan de eigen bibliotheek.',
  'shell.copyOf': '{name} (kopie)',
  'shell.containerDiagram': '{name} · containers',
  'shell.deleteDiagramTitle': 'Aanzicht “{name}” verwijderen?',
  'shell.lastLandscape': 'Dit is het laatste landschap; het kan niet worden verwijderd.',
  'shell.deleteLandscapeBody':
    'De plaatsingen, groepen en routes van dit landschap gaan verloren. De elementen zelf blijven in het model, en containeraanzichten blijven staan.',
  'shell.deleteContainerBody':
    'De plaatsingen en routes van dit containeraanzicht gaan verloren. De elementen zelf blijven in het model.',
  'shell.projects': 'Projecten\u2026',
  'shell.projectsTip': 'Terug naar de projectenlijst',
  'shell.projectCreated': 'Project \u201c{name}\u201d aangemaakt.',
  'shell.exampleCopied': 'Voorbeeld \u201c{name}\u201d gekopieerd naar een eigen project.',

  // --- projecten en de kiezer ----------------------------------------------
  'picker.title': 'Projecten',
  'picker.subtitle': 'Ga verder waar je gebleven was, of begin iets nieuws.',
  'picker.empty': 'Hier staat nog niets. Begin bij een voorbeeld, of maak een project.',
  'picker.yours': 'Jouw projecten',
  'picker.examples': 'Voorbeelden',
  'picker.newProject': 'Nieuw project',
  'picker.open': 'Openen',
  'picker.copy': 'Kopi\u00ebren naar een project',
  'picker.order': 'Volgorde',
  'picker.orderName': 'Naam',
  'picker.orderUpdated': 'Onlangs gewijzigd',
  'picker.never': 'Nog niet bewaard',
  'picker.changed': 'Gewijzigd {when}',
  'picker.delete': 'Verwijderen',
  'picker.deleteTitle': '\u201c{name}\u201d verwijderen?',
  'picker.deleteBody': 'Dit haalt het project uit deze browser. Een werkbestand dat je elders bewaarde blijft staan.',
  'picker.group': 'Groep',
  'picker.groupHelp': 'Een klant, een afdeling, een programma \u2014 hoe de naamruimte hier ook heet.',
  'picker.projectName': 'Projectnaam',
  'picker.create': 'Aanmaken',
  'picker.loadFailed': 'Dat project kon niet geopend worden.',
  'picker.listFailed': 'Je projecten konden niet gelezen worden.',
  'picker.deleteFailed': 'Dat project kon niet verwijderd worden.',
  'picker.newGroup': 'Nieuwe groep',
  'picker.addProject': 'Project toevoegen aan {name}',
  'picker.groupNewOption': 'Nieuwe groep\u2026',
  'picker.inGroup': 'In groep',
  'picker.firstProject': 'Eerste project',
  'picker.groupExists': 'Die groep bestaat al \u2014 het project komt erbij.',
  'settings.title': 'Projectinstellingen',
  'settings.open': 'Instellingen\u2026',
  'settings.projectName': 'Projectnaam',
  'settings.group': 'Groep',
  'settings.groupHelp': 'Een project verhuizen zet het onder een andere groep. De inhoud blijft ongemoeid.',
  'settings.save': 'Bewaren',
  'settings.moved': 'Verhuisd naar {name}.',
  'settings.renamed': 'Hernoemd naar \u201c{name}\u201d.',
  'settings.defaults': 'STANDAARD VOOR DIT PROJECT',
  'settings.defaultsHelp':
    'Waar een aanzicht in dit project op terugvalt. Dit herschrijft nooit een aanzicht dat al is ingesteld.',
  'settings.defaultAuthor': 'Auteur',
  'settings.defaultAuthorHelp': 'Vermeld op een geëxporteerd aanzicht zonder eigen auteur.',
  'settings.defaultColumns': 'De volwassenheidskolommen waarmee een nieuw landschap begint.',

  'group.title': 'Groepsinstellingen',
  'group.open': 'Instellingen…',
  'group.openFor': 'Instellingen voor {name}',
  'group.name': 'Groepsnaam',
  'group.nameHelp': 'Hernoemen herlabelt elk project hieronder. Het adres ({path}) verandert niet.',
  'group.description': 'Omschrijving',
  'group.descriptionPlaceholder': 'Wie ze zijn, wat dit landschap beslaat, wie je erover spreekt.',
  'group.links': 'LINKS',
  'group.linksHelp': 'Een wikiruimte, een ticketlijst, een dashboard. Alleen http- en https-adressen.',
  'group.linkLabel': 'Label',
  'group.linkUrl': 'Adres',
  'group.addLink': 'Link toevoegen',
  'group.removeLink': '{name} verwijderen',
  'group.badUrl': 'Moet met http:// of https:// beginnen',
  'group.saved': '{name} opgeslagen.',
  'group.renamed': 'Groep hernoemd naar “{name}”.',
  'group.saveFailed': 'Deze groep kon niet worden opgeslagen.',
  'shell.documentation': 'Documentatie',
  'shell.documentationTip': 'Open de documentatiepagina van het geselecteerde element',
  'shell.noElements': 'Er is nog niets om te documenteren \u2014 voeg eerst een element toe.',
  'shell.decisions': 'Besluiten',
  'shell.decisionsTip': 'Architectuurbesluiten \u2014 voor de groep, het landschap en elke applicatie',
  'shell.search': 'Zoeken',
  'shell.searchTip': 'Zoek elementen, documentatie en besluiten (\u2318K)',
}
