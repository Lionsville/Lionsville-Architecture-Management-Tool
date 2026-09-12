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
  /** The rail pack's picker heading. The pack is registered in composition.ts. */
  'logo.category.rail': 'Spoor',

  'shell.saved': 'Bewaard · {time}',
  'shell.notSaved': 'Nog niet bewaard',
  'shell.saveRefused': 'Niet bewaard — opslag weigert',
  'shell.unsaved': 'Nog niet bewaarde wijzigingen',
  'shell.saving': 'Bezig met bewaren…',
  'shell.changedOnDisk': 'Gewijzigd op schijf',
  'shell.conflict': 'Hier én op schijf gewijzigd',
  'shell.diskChanged': 'Dit project is op schijf gewijzigd. Hier staat niets open.',
  'shell.diskConflict': 'Dit project is op schijf gewijzigd, en hier staan wijzigingen open.',
  'shell.takeTheirs': 'Die van schijf',
  'shell.keepMine': 'Die van mij',
  'shell.saveACopy': 'Kopie bewaren…',
  'shell.storageFailed':
    'Deze browser kon het ontwerp niet bewaren (opslag vol of geblokkeerd). Bewaar een werkbestand, anders is het bij het sluiten van het tabblad weg.',
  'shell.storageRecovered': 'Bewaren in deze browser lukt weer.',
  'shell.storageNearlyFull':
    'Deze browser zit voor ongeveer {percent}% vol voor deze app. Bewaar je werk in een map '
    + 'of een bestand voordat de ruimte op is — een browser stopt zonder te vragen met bewaren.',
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
  'shell.savedInterchangeLeftOut':
    'Uitwisselingsdocument opgeslagen — het draagt applicaties en de koppelingen ertussen, dus dit bleef achter: {left}.',
  'shell.leftOutPart': '{count} × {label}',
  'shell.savedWorkingFile':
    'WorkingFile bewaard — alles, inclusief geometrie, opmaak en eigen logo’s.',
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
  'shell.sourceFolder': 'Map · {name}',
  'shell.sourceBrowser': 'In deze browser',
  'shell.sourceMemory': 'Nergens bewaard',
  'shell.sourceTip': 'Waar dit project wordt bewaard',
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
  'history.title': 'Geschiedenis',
  'history.snapshot': 'Momentopname…',
  'history.snapshotNote': 'Leg het project vast zoals het nu is, in de geschiedenis van de map',
  'history.open': 'Geschiedenis…',
  'history.openNote': 'Elke momentopname van deze map, en wat er veranderde',
  'history.start': 'Geschiedenis bijhouden',
  'history.startBody':
    'Deze map houdt nog geen geschiedenis bij. Vanaf nu wordt elke momentopname in de map zelf '
    + 'vastgelegd, met git — er gaat niets van deze machine af.',
  'history.message': 'Wat er veranderde',
  'history.defaultMessage': 'Momentopname',
  'history.take': 'Vastleggen',
  'history.taken': 'Momentopname vastgelegd.',
  'history.nothingToRecord': 'Er is niets veranderd sinds de vorige momentopname.',
  'history.failed': 'De momentopname is niet gelukt: {message}',
  'history.readFailed': 'De geschiedenis kon niet worden gelezen: {message}',
  'history.none': 'Nog geen momentopnames.',
  'history.unavailable':
    'Op deze machine staat geen git, dus de app kan geen geschiedenis bijhouden. De rest werkt gewoon.',
  'history.compare': 'Vergeleken met het project zoals het nu is',
  'history.unchanged': 'Er is niets veranderd sinds deze momentopname.',
  'history.gone': 'Dit project stond bij die momentopname niet in de map.',
  'history.by': '{author}',
  'history.subject': 'Toon de geschiedenis van',
  'history.everything': 'Het hele project',
  'history.diagrams': 'Aanzichten',
  'history.descriptions': 'Beschrijvingen',
  'history.decisions': 'Besluiten',
  'history.noneFor': 'Nog geen momentopname heeft dit geraakt.',
  'history.unchangedFor': 'Dit is niet veranderd sinds deze momentopname.',
  'history.restore': 'Deze versie terugzetten…',
  'history.restoreProject': 'Het hele project terugzetten…',
  'history.restoreTitle': '{name} terugzetten naar {date}?',
  'history.restoreProjectTitle': 'Het hele project terugzetten naar {date}?',
  'history.restoreBody':
    'Dit maakt {name} weer wat het bij die momentopname was, als een nieuwe wijziging — de geschiedenis houdt alles wat sindsdien gebeurde, en deze stap komt daar bovenop. Tot de volgende momentopname het vastlegt is het met ⌘Z ongedaan te maken.',
  'history.restoreProjectBody':
    'Elk element, elke verbinding, elk aanzicht en elk besluit wordt weer wat het bij die momentopname was, als één nieuwe wijziging bovenop alles wat sindsdien gebeurde. Besluiten die aanvaard, afgewezen of vervangen zijn blijven zoals ze zijn. Tot de volgende momentopname het vastlegt is het met ⌘Z ongedaan te maken.',
  'history.restoreConfirm': 'Terugzetten',
  'history.restored': '{name} teruggezet naar {date}.',
  'history.restoredProject': 'Het hele project teruggezet naar {date}.',
  'history.restoredDropped': ' {count} geplaatste elementen bestaan niet meer en zijn weggelaten.',
  'history.restoredKept': ' {count} afgesloten besluiten zijn gelaten zoals ze zijn.',
  'history.snapshotNow': 'Momentopname',
  'history.label': 'Label…',
  'history.labelTitle': 'Deze momentopname een label geven',
  'history.labelBody':
    'Een woord voor deze versie — “Aan de directie getoond” — naast de boodschap, nooit in plaats ervan. Het reist mee met de geschiedenis, zodat een collega hetzelfde merkteken op dezelfde plek ziet.',
  'history.labelField': 'Label',
  'history.labelConfirm': 'Label',
  'history.labelled': 'Label gegeven.',
  'history.labelExists': 'Deze map heeft al een label met die naam. Kies een ander woord.',
  'history.labelUnnamed': 'Een label heeft een woord nodig.',

  'change.elementAdded': '{name} toegevoegd',
  'change.elementRemoved': '{name} verwijderd',
  'change.elementChanged': '{name} gewijzigd ({fields})',
  'change.connectionAdded': '{name} getekend',
  'change.connectionRemoved': '{name} doorgeknipt',
  'change.connectionChanged': '{name} gewijzigd ({fields})',
  'change.rowAdded': 'Rij getekend ({type}): {name}',
  'change.rowRemoved': 'Rij weggehaald ({type}): {name}',
  'change.rowChanged': 'Rij gewijzigd ({type}): {name} ({fields})',
  'change.diagramAdded': 'Aanzicht {name} toegevoegd',
  'change.diagramRemoved': 'Aanzicht {name} verwijderd',
  'change.diagramChanged': 'Aanzicht {name} gewijzigd ({fields})',
  'change.decisionAdded': 'Besluit {name} toegevoegd',
  'change.decisionRemoved': 'Besluit {name} verwijderd',
  'change.decisionChanged': 'Besluit {name} gewijzigd ({fields})',
  'change.transitionAdded': 'Plan {name} toegevoegd',
  'change.transitionRemoved': 'Plan {name} verwijderd',
  'change.transitionChanged': 'Plan {name} gewijzigd ({fields})',
  'change.membershipAdded': '{name} op {on} gezet',
  'change.membershipRemoved': '{name} van {on} gehaald',
  'change.membershipMoved': '{name} op {on} verplaatst naar een andere band of groep',
  'change.geometry': '{count} verplaatst op {name}',

  'folder.title': 'Waar horen je projecten te staan?',
  'folder.body':
    'Kies een map; deze app bewaart je projecten daarin als bestanden die je kunt lezen, '
    + 'back-uppen, synchroniseren en committen. In de app zelf blijft niets staan.',
  'folder.choose': 'Map kiezen…',
  'folder.recent': 'Onlangs gebruikt',
  'picker.folder': 'Projectenmap: {name}',
  'picker.noFolder': 'Projecten staan in de app zelf. Kies een map om ze als bestanden te bewaren.',
  'picker.chooseFolder': 'Map kiezen…',
  'picker.changeFolder': 'Wijzigen…',
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

  'prefs.title': 'Voorkeuren',
  'prefs.general': 'ALGEMEEN',
  'prefs.language': 'Taal',
  'prefs.theme': 'Thema',
  'prefs.projectOrder': 'Volgorde van de projectenlijst',
  'prefs.updates': 'UPDATES',
  'prefs.checkAutomatically': 'Automatisch op updates controleren',
  'prefs.updatesNote':
    'Kijkt bij het starten en elke zes uur op de releasepagina. Er wordt niets gedownload zonder te vragen.',
  'prefs.channel': 'Releasekanaal',
  'prefs.channelStable': 'Stabiel',
  'prefs.channelBeta': 'Bèta',
  'prefs.channelNote':
    'Bèta’s zijn builds die vooruitlopen op een release, op dezelfde manier ondertekend en gepubliceerd. Wie het bètakanaal verlaat, houdt wat er geïnstalleerd is.',
  'prefs.thisMachine': 'DEZE MAP, OP DEZE MACHINE',
  'prefs.thisMachineNote':
    'Staat in {path} en wordt niet gedeeld \u2014 een andere machine die deze map opent beslist zelf.',
  'prefs.pullOnOpen': 'Van de remote ophalen als deze map wordt geopend',
  'prefs.pushAfterSnapshot': 'Na elke momentopname pushen',
  'prefs.writeFailed': 'Die instelling kon niet worden bewaard: {message}',
  'history.beforeSync': 'Voor het synchroniseren',
  'history.beforeUpgrade': 'Voor het bijwerken van het bestandsformaat',
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

  'group.title': 'Groepsinstellingen',
  'group.open': 'Instellingen…',
  'group.openFor': 'Instellingen voor {name}',
  'group.name': 'Groepsnaam',
  'group.nameHelp': 'Hernoemen herlabelt elk project hieronder. Het adres ({path}) verandert niet.',
  'group.client': 'Klant',
  'group.clientHelp': 'Staat op elk geëxporteerd aanzicht. Leeg betekent de groepsnaam.',
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
  'agent.title': 'Een agent koppelen',
  'agent.tipOff': 'Een agent koppelen…',
  'agent.tipListening': 'Wacht op een agent op poort {port}',
  'agent.tipConnected': '{name} gekoppeld',
  'agent.what':
    'Je codeer-agent — Claude Code, Codex, Cursor of een andere MCP-client — kan dit landschap lezen, '
    + 'wijzigingen voorstellen en naar diagrammen kijken terwijl jij werkt. Alles wat hij doet staat onder zijn '
    + 'naam in Activiteit en is met ⌘Z ongedaan te maken. Hij koppelt via het standaard Model Context Protocol, '
    + 'alleen op deze machine. Er verlaat niets de computer.',
  'agent.enable': 'Agentverbindingen toestaan',
  'agent.listening': 'Luistert op poort {port}.',
  'agent.connected': '{name} is gekoppeld.',
  'agent.moved':
    'Poort {from} was bezet toen de app startte, dus hij luistert nu op {port}. Een agent die met de oude poort is ingesteld heeft het nieuwe adres nodig.',
  'agent.desktopOnly':
    'Een agent koppelen vraagt de desktop-app — alleen die kan op deze machine luisteren. Open dit project daar en de schakelaar staat hier.',
  'agent.recipes': 'JE CLIENT KOPPELEN',
  'agent.recipesNote': 'De poort en het token hieronder zijn van deze machine. Kies je client en plak.',
  'agent.tabClaude': 'Claude Code',
  'agent.tabClaudeDesktop': 'Claude Desktop',
  'agent.tabCodex': 'Codex',
  'agent.tabCursor': 'Cursor',
  'agent.tabOther': 'Anders',
  'agent.recipeClaude': 'claude mcp add --transport http lvarch {endpoint} --header "Authorization: Bearer {token}"',
  'agent.recipeClaudeDesktop':
    '# Niet het scherm "Add custom connector": dat is voor servers op internet en kan deze machine niet bereiken.\n'
    + '# Claude Desktop start lokale servers via stdio, dus het heeft de mcp-remote-brug in zijn developer-instellingen nodig.\n'
    + '#\n'
    + '# Het makkelijkst: plak dit in Claude Code, dat de instellingen al kent, en herstart daarna Claude Desktop:\n'
    + 'Add the MCP server "lvarch" to my Claude Desktop developer settings (claude_desktop_config.json): '
    + 'command "npx", args ["-y", "mcp-remote", "{endpoint}", "--transport", "http-only", "--header", '
    + '"Authorization: Bearer {token}"].\n'
    + '#\n'
    + '# Of voeg het zelf toe, in Claude Desktop onder Settings → Developer → Edit Config:\n'
    + '{\n  "mcpServers": {\n    "lvarch": {\n      "command": "npx",\n'
    + '      "args": ["-y", "mcp-remote", "{endpoint}", "--transport", "http-only", "--header", "Authorization: Bearer {token}"]\n'
    + '    }\n  }\n}',
  'agent.recipeCodex':
    '# ~/.codex/config.toml\n[mcp_servers.lvarch]\nurl = "{endpoint}"\nhttp_headers = { Authorization = "Bearer {token}" }',
  'agent.recipeCursor':
    '// .cursor/mcp.json\n{\n  "mcpServers": {\n    "lvarch": {\n      "url": "{endpoint}",\n'
    + '      "headers": { "Authorization": "Bearer {token}" }\n    }\n  }\n}',
  'agent.recipeOther': 'Transport: Streamable HTTP\nEindpunt: {endpoint}\nHeader: Authorization: Bearer {token}',
  'agent.copy': 'Kopiëren',
  'agent.copied': 'Gekopieerd',
  'agent.newToken': 'Nieuw token',
  'agent.newTokenNote': 'Elke agent die vóór nu is ingesteld heeft het nieuwe token nodig.',
  'agent.changeFailed': 'Dat kon niet worden gewijzigd: {message}',
  'shell.documentation': 'Documentatie',
  'shell.documentationTip': 'Open de documentatiepagina van het geselecteerde element',
  'shell.noElements': 'Er is nog niets om te documenteren \u2014 voeg eerst een element toe.',
  'shell.decisions': 'Besluiten',
  'shell.decisionsTip': 'Architectuurbesluiten \u2014 voor de groep, het landschap en elke applicatie',
  'shell.roadmap': 'Roadmap',
  'shell.roadmapTip': 'Het landschap op een tijdas, de plannen daarover, en waarover de datums het oneens zijn',
  'shell.activity': 'Activiteit',
  'shell.activityTip': 'Wat er sinds het openen aan dit project is veranderd',
  'shell.activityEmpty': 'Nog niets',
  'shell.activityAgent': 'AGENT',
  'shell.search': 'Zoeken',
  'shell.searchTip': 'Zoek elementen, documentatie en besluiten (\u2318K)',
}
