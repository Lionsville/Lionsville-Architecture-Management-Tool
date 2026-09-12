/**
 * Frisian, for the shell around the editor: the picker, the toolbar, the dialogs, the toasts.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Frisian screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {
  /** The rail pack's picker heading. The pack is registered in composition.ts. */
  'logo.category.rail': 'Spoar',

  'shell.saved': 'Bewarre · {time}',
  'shell.notSaved': 'Noch net bewarre',
  'shell.saveRefused': 'Net bewarre — opslach wegeret',
  'shell.unsaved': 'Noch net bewarre wizigings',
  'shell.saving': 'Dwaande mei bewarjen…',
  'shell.changedOnDisk': 'Wizige op skiif',
  'shell.conflict': 'Hjir én op skiif wizige',
  'shell.diskChanged': 'Dit projekt is op skiif wizige. Hjir stiet neat iepen.',
  'shell.diskConflict': 'Dit projekt is op skiif wizige, en hjir steane wizigings iepen.',
  'shell.takeTheirs': 'Dy fan skiif',
  'shell.keepMine': 'Dy fan my',
  'shell.saveACopy': 'Kopy bewarje…',
  'shell.storageFailed':
    'Dizze brouwer koe it ûntwerp net bewarje (opslach fol of blokkearre). Bewarje in wurkbestân, oars is it by it sluten fan it ljepblêd fuort.',
  'shell.storageRecovered': 'Bewarjen yn dizze brouwer slagget wer.',
  'shell.storageNearlyFull':
    'Dizze brouwer sit foar sa’n {percent}% fol foar dizze app. Bewarje dyn wurk yn in map '
    + 'of in bestân foardat de romte op is — in brouwer hâldt sûnder te freegjen op mei bewarjen.',
  'shell.crashed': 'Der gie wat mis op dit skerm.',
  'shell.crashedNote':
    'Dyn wurk oant it lêste bewarmomint stiet der noch. Laad opnij om fierder te gean; de diagnostyk seit wat der barde.',
  'shell.reload': 'Opnij lade',
  'shell.copyDiagnostics': 'Diagnostyk kopiearje',
  'shell.diagnosticsCopied': 'Kopiearre',
  'shell.copyFailed': 'Kopiearjen slagge net',
  'shell.bootFailed': 'De app koe net starte.',
  'shell.bootFailedNote':
    'Dyn ynstellings of it projekt dat iepen stie koene net lêzen wurde. Starte sûnder dat projekt helpt meastal; der wurdt neat fuortsmiten.',
  'shell.startFresh': 'Starte sûnder it lêste projekt',
  'shell.unexpectedError': 'Der gie wat ûnferwachts mis. Laad de side opnij as it skerm net mear reagearret.',
  'shell.orphanOne':
    'Containeroansicht “{name}” is fuortsmiten: de applikaasje gie út it model. Dat oansicht komt mei Ungedien meitsje net werom.',
  'shell.orphanOther':
    '{count} containeroansichten binne fuortsmiten: har applikaasjes giene út it model. Dy oansichten komme mei Ungedien meitsje net werom.',
  'shell.duplicated': '“{name}” duplisearre.',
  'shell.deleted': '“{name}” fuortsmiten.',
  'shell.savedInterchange':
    'Interchange-dokumint bewarre — topology en semantyk; geometry en opmak reizgje mei yn it wurkbestân.',
  'shell.savedInterchangeLeftOut':
    'Útwikselingsdokumint bewarre — it draacht applikaasjes en de keppelingen dertusken, dus dit bleau efter: {left}.',
  'shell.leftOutPart': '{count} × {label}',
  'shell.savedWorkingFile':
    'Wurkbestân bewarre — alles, ynklusyf geometry, opmak en eigen logo’s.',
  'shell.workingFileLoaded': 'Wurkbestân “{name}” laden.',
  'shell.interchangeLoaded':
    'Interchange-dokumint “{name}” laden; de boerden wurde opnij lein.',
  'shell.processFailed': 'It dokumint koe net ferwurke wurde: {message}',
  'shell.saveFileFailed': 'It bestân koe net bewarre wurde: {message}',
  'shell.moveLeftCopy': 'Ferpleatst — mar de kopy yn de âlde groep koe net fuortsmiten wurde: {message}',
  'shell.groupRenameIncomplete': 'De groep is omneamd, mar dizze projekten drage noch de âlde namme: {names}.',
  'shell.newDiagram': 'Nij lânskip',
  'shell.newSheet': 'Bedriuwsarsjitektuer',
  'shell.add': 'Tafoegje',
  'shell.imagesMissing': 'PNG eksportearre, mar dizze logo’s ûntbrekke: {labels}.',
  'shell.logoAdded': 'Logo “{name}” tafoege oan de eigen bibleteek.',
  'shell.copyOf': '{name} (kopy)',
  'shell.containerDiagram': '{name} · containers',
  'shell.deleteDiagramTitle': 'Oansicht “{name}” fuortsmite?',
  'shell.lastLandscape': 'Dit is it lêste lânskip; it kin net fuortsmiten wurde.',
  'shell.deleteLandscapeBody':
    'De pleatsings, groepen en rûtes fan dit lânskip geane ferlern. De eleminten sels bliuwe yn it model, en containeroansichten bliuwe stean.',
  'shell.deleteContainerBody':
    'De pleatsings en rûtes fan dit containeroansicht geane ferlern. De eleminten sels bliuwe yn it model.',
  'shell.sourceFolder': 'Map · {name}',
  'shell.sourceBrowser': 'Yn dizze brouwer',
  'shell.sourceMemory': 'Nearne bewarre',
  'shell.sourceTip': 'Wêr’t dit projekt bewarre wurdt',
  'shell.projects': 'Projekten…',
  'shell.projectsTip': 'Werom nei de projektelist',
  'shell.projectCreated': 'Projekt “{name}” oanmakke.',
  'shell.exampleCopied': 'Foarbyld “{name}” kopiearre nei in eigen projekt.',

  // --- projects and the picker ---------------------------------------------
  'picker.title': 'Projekten',
  'picker.subtitle': 'Gean fierder dêr’tsto bleaun wiest, of begjin wat nijs.',
  'picker.empty': 'Hjir stiet noch neat. Begjin by in foarbyld, of meitsje in projekt oan.',
  'picker.yours': 'Dyn projekten',
  'picker.examples': 'Foarbylden',
  'picker.newProject': 'Nij projekt',
  'picker.open': 'Iepenje',
  'picker.copy': 'Kopiearje nei in projekt',
  'picker.order': 'Folchoarder',
  'picker.orderName': 'Namme',
  'picker.orderUpdated': 'Koartlyn wizige',
  'history.title': 'Skiednis',
  'history.snapshot': 'Momintopname…',
  'history.snapshotNote': 'Lis it projekt fêst sa’t it no is, yn de skiednis fan de map sels',
  'history.open': 'Skiednis…',
  'history.openNote': 'Elke momintopname fan dizze map, en wat der feroare',
  'history.start': 'Skiednis byhâlde',
  'history.startBody':
    'Dizze map hâldt noch gjin skiednis by. Fan no ôf wurdt elke momintopname yn de map sels '
    + 'fêstlein, mei git — der giet neat fan dizze masine ôf.',
  'history.message': 'Wat der feroare',
  'history.defaultMessage': 'Momintopname',
  'history.take': 'Fêstlizze',
  'history.taken': 'Momintopname fêstlein.',
  'history.nothingToRecord': 'Der is neat feroare sûnt de foarige momintopname.',
  'history.failed': 'De momintopname is net slagge: {message}',
  'history.readFailed': 'De skiednis koe net lêzen wurde: {message}',
  'history.none': 'Noch gjin momintopnamen.',
  'history.unavailable':
    'Op dizze masine stiet gjin git, dus de app kin gjin skiednis byhâlde. De rest wurket gewoan.',
  'history.compare': 'Ferlike mei it projekt sa’t it no is',
  'history.unchanged': 'Der is neat feroare sûnt dizze momintopname.',
  'history.gone': 'Dit projekt stie by dy momintopname net yn de map.',
  'history.by': '{author}',
  'history.subject': 'Lit de skiednis sjen fan',
  'history.everything': 'It hiele projekt',
  'history.diagrams': 'Oansichten',
  'history.descriptions': 'Beskriuwings',
  'history.decisions': 'Besluten',
  'history.noneFor': 'Noch gjin momintopname hat dit rekke.',
  'history.unchangedFor': 'Dit is net feroare sûnt dizze momintopname.',
  'history.restore': 'Dizze ferzje weromsette…',
  'history.restoreProject': 'It hiele projekt weromsette…',
  'history.restoreTitle': '{name} weromsette nei {date}?',
  'history.restoreProjectTitle': 'It hiele projekt weromsette nei {date}?',
  'history.restoreBody':
    'Dit makket {name} wer wat it by dy momintopname wie, as in nije wiziging — de skiednis hâldt alles wat sûnt dy tiid barde, en dizze stap komt dêr boppe-op. Oant de folgjende momintopname it fêstleit is it mei ⌘Z ûngedien te meitsjen.',
  'history.restoreProjectBody':
    'Elk elemint, elke ferbining, elk oansicht en elk beslút wurdt wer wat it by dy momintopname wie, as ien nije wiziging boppe-op alles wat sûnt dy tiid barde. Besluten dy’t oannommen, ôfwiisd of ferfongen binne bliuwe sa’t se binne. Oant de folgjende momintopname it fêstleit is it mei ⌘Z ûngedien te meitsjen.',
  'history.restoreConfirm': 'Weromsette',
  'history.restored': '{name} weromset nei {date}.',
  'history.restoredProject': 'It hiele projekt weromset nei {date}.',
  'history.restoredDropped': ' {count} pleatste eleminten besteane net mear en binne fuortlitten.',
  'history.restoredKept': ' {count} ôfsletten besluten binne litten sa’t se binne.',
  'history.snapshotNow': 'Momintopname',
  'history.label': 'Label…',
  'history.labelTitle': 'Dizze momintopname in label jaan',
  'history.labelBody':
    'In wurd foar dizze ferzje — “Oan de direksje toand” — njonken it berjocht, nea yn plak dêrfan. It reizget mei mei de skiednis, sadat in kollega itselde merkteken op itselde plak sjocht.',
  'history.labelField': 'Label',
  'history.labelConfirm': 'Label jaan',
  'history.labelled': 'Label jûn.',
  'history.labelExists': 'Dizze map hat al in label mei dy namme. Kies in oar wurd.',
  'history.labelUnnamed': 'In label hat in wurd nedich.',

  'change.elementAdded': '{name} tafoege',
  'change.elementRemoved': '{name} fuortsmiten',
  'change.elementChanged': '{name} wizige ({fields})',
  'change.connectionAdded': '{name} tekene',
  'change.connectionRemoved': '{name} trochknipt',
  'change.connectionChanged': '{name} wizige ({fields})',
  'change.rowAdded': 'Rige tekene ({type}): {name}',
  'change.rowRemoved': 'Rige weihelle ({type}): {name}',
  'change.rowChanged': 'Rige feroare ({type}): {name} ({fields})',
  'change.diagramAdded': 'Oansicht {name} tafoege',
  'change.diagramRemoved': 'Oansicht {name} fuortsmiten',
  'change.diagramChanged': 'Oansicht {name} wizige ({fields})',
  'change.decisionAdded': 'Beslút {name} tafoege',
  'change.decisionRemoved': 'Beslút {name} fuortsmiten',
  'change.decisionChanged': 'Beslút {name} wizige ({fields})',
  'change.transitionAdded': 'Plan {name} tafoege',
  'change.transitionRemoved': 'Plan {name} fuortsmiten',
  'change.transitionChanged': 'Plan {name} wizige ({fields})',
  'change.membershipAdded': '{name} op {on} set',
  'change.membershipRemoved': '{name} fan {on} helle',
  'change.membershipMoved': '{name} op {on} nei in oare bân of groep ferpleatst',
  'change.geometry': '{count} ferpleatst op {name}',

  'folder.title': 'Wêr hearre dyn projekten te stean?',
  'folder.body':
    'Kies in map; dizze app bewarret dyn projekten dêryn as bestannen dy’tsto lêze, '
    + 'reservekopiearje, syngronisearje en committe kinne. Yn de app sels bliuwt neat stean.',
  'folder.choose': 'Map kieze…',
  'folder.recent': 'Koartlyn brûkt',
  'picker.folder': 'Projektemap: {name}',
  'picker.noFolder': 'Projekten steane yn de app sels. Kies in map om se as bestannen te bewarjen.',
  'picker.chooseFolder': 'Map kieze…',
  'picker.changeFolder': 'Wizigje…',
  'picker.never': 'Noch net bewarre',
  'picker.changed': 'Wizige {when}',
  'picker.delete': 'Fuortsmite',
  'picker.deleteTitle': '“{name}” fuortsmite?',
  'picker.deleteBody': 'Dit hellet it projekt út dizze brouwer. In wurkbestân datsto earne oars bewarre hast bliuwt stean.',
  'picker.group': 'Groep',
  'picker.groupHelp': 'In klant, in ôfdieling, in programma — hoe’t de nammeromte hjir ek hjit.',
  'picker.projectName': 'Projektnamme',
  'picker.create': 'Oanmeitsje',
  'picker.loadFailed': 'Dat projekt koe net iepene wurde.',
  'picker.listFailed': 'Dyn projekten koene net lêzen wurde.',
  'picker.deleteFailed': 'Dat projekt koe net fuortsmiten wurde.',
  'picker.newGroup': 'Nije groep',
  'picker.addProject': 'Projekt tafoegje oan {name}',
  'picker.groupNewOption': 'Nije groep…',
  'picker.inGroup': 'Yn groep',
  'picker.firstProject': 'Earste projekt',
  'picker.groupExists': 'Dy groep bestiet al — it projekt komt derby.',
  'settings.title': 'Projektynstellings',
  'settings.open': 'Ynstellings…',
  'settings.projectName': 'Projektnamme',
  'settings.group': 'Groep',
  'settings.groupHelp': 'In projekt ferhúzje set it ûnder in oare groep. De ynhâld bliuwt sa’t er is.',
  'settings.save': 'Bewarje',
  'settings.moved': 'Ferhuze nei {name}.',
  'settings.renamed': 'Omneamd nei “{name}”.',
  'settings.defaults': 'STANDERT FOAR DIT PROJEKT',
  'settings.defaultsHelp':
    'Wêr’t in oansicht yn dit projekt op weromfalt. Dit skriuwt nea in oansicht oer dat al ynsteld is.',
  'settings.defaultAuthor': 'Skriuwer',
  'settings.defaultAuthorHelp': 'Neamd op in eksportearre oansicht sûnder eigen skriuwer.',
  'settings.defaultColumns': 'De folwoeksenheidskolommen dêr’t in nij lânskip mei begjint.',

  'prefs.title': 'Foarkarren',
  'prefs.general': 'ALGEMIEN',
  'prefs.language': 'Taal',
  'prefs.theme': 'Tema',
  'prefs.projectOrder': 'Folchoarder fan de projektelist',
  'prefs.updates': 'UPDATES',
  'prefs.checkAutomatically': 'Automatysk op updates kontrolearje',
  'prefs.updatesNote':
    'Sjocht by it starten en elke seis oeren op de releaseside. Der wurdt neat download sûnder te freegjen.',
  'prefs.channel': 'Releasekanaal',
  'prefs.channelStable': 'Stabyl',
  'prefs.channelBeta': 'Beta',
  'prefs.channelNote':
    'Beta’s binne builds dy’t foarútrinne op in release, op deselde wize ûndertekene en publisearre. Wa’t it betakanaal ferlit, hâldt wat der ynstallearre is.',
  'prefs.thisMachine': 'DIZZE MAP, OP DIZZE MASINE',
  'prefs.thisMachineNote':
    'Stiet yn {path} en wurdt net dield — in oare masine dy’t dizze map iepenet beslút sels.',
  'prefs.pullOnOpen': 'Fan de remote ophelje as dizze map iepene wurdt',
  'prefs.pushAfterSnapshot': 'Nei elke momintopname pushe',
  'prefs.writeFailed': 'Dy ynstelling koe net bewarre wurde: {message}',
  'history.beforeSync': 'Foar it syngronisearjen',
  'history.beforeUpgrade': 'Foar it bywurkjen fan it bestânsformaat',
  'sync.diverged':
    'Dizze map en de remote binne beide fierdergien. Der wurdt neat gearfoege: kies hokker ferzje bliuwt. '
    + 'Dy fan ús bliuwt hoe dan ek op in branch bewarre.',
  'sync.takeTheirs': 'Dy fan de remote',
  'sync.keepOurs': 'Dy fan ús',
  'sync.pulled': 'Gelyk mei de remote.',
  'sync.pushed': 'Nei de remote pusht.',
  'sync.tookTheirs': 'De ferzje fan de remote bliuwt; dy fan ús stiet op in branch.',
  'sync.keptOurs': 'Ús ferzje bliuwt, fêstlein as merge.',
  'sync.noRemote': 'Dizze map hat gjin remote om mei te syngronisearjen.',
  'sync.unreachable': 'De remote is net te berikken.',
  'sync.credentials':
    'De remote wegeret de oanmeldgegevens fan dizze masine. De app freget der net om; meld dy oan mei dyn git-client.',
  'sync.timeout': 'De remote antwurde net op ’e tiid.',
  'sync.pullRefused': 'De map is net ophelle: {reason}',
  'sync.pushRefused': 'De momintopname is net pusht: {reason}',
  'sync.resolveRefused': 'Der is neat feroare: {reason}',

  'group.title': 'Groepsynstellings',
  'group.open': 'Ynstellings…',
  'group.openFor': 'Ynstellings foar {name}',
  'group.name': 'Groepsnamme',
  'group.nameHelp': 'Omneame jout elk projekt hjirûnder in nij label. It adres ({path}) feroaret net.',
  'group.client': 'Klant',
  'group.clientHelp': 'Stiet op elk eksportearre oansicht. Leech betsjut de groepsnamme.',
  'group.description': 'Omskriuwing',
  'group.descriptionPlaceholder': 'Wa’t se binne, wat dit lânskip beslacht, wa’tsto derfoar oansprekst.',
  'group.links': 'KEPPELINGS',
  'group.linksHelp': 'In wikiromte, in ticketlist, in dashboard. Allinnich http- en https-adressen.',
  'group.linkLabel': 'Label',
  'group.linkUrl': 'Adres',
  'group.addLink': 'Keppeling tafoegje',
  'group.removeLink': '{name} fuortsmite',
  'group.badUrl': 'Moat mei http:// of https:// begjinne',
  'group.saved': '{name} bewarre.',
  'group.renamed': 'Groep omneamd nei “{name}”.',
  'group.saveFailed': 'Dizze groep koe net bewarre wurde.',
  'agent.title': 'In agent keppelje',
  'agent.tipOff': 'In agent keppelje…',
  'agent.tipListening': 'Wachtet op in agent op poarte {port}',
  'agent.tipConnected': '{name} keppele',
  'agent.what':
    'Dyn kodearagent — Claude Code, Codex, Cursor of in oare MCP-client — kin dit lânskip lêze, '
    + 'wizigings foarstelle en nei diagrammen sjen wylst do wurkest. Alles wat er docht stiet ûnder syn '
    + 'namme yn Aktiviteit en is mei ⌘Z ûngedien te meitsjen. Hy keppelet fia it standert Model Context Protocol, '
    + 'allinnich op dizze masine. Der ferlit neat de kompjûter.',
  'agent.enable': 'Agentferbinings tastean',
  'agent.listening': 'Harket op poarte {port}.',
  'agent.connected': '{name} is keppele.',
  'agent.moved':
    'Poarte {from} wie beset doe’t de app starte, dus er harket no op {port}. In agent dy’t mei de âlde poarte ynsteld is hat it nije adres nedich.',
  'agent.desktopOnly':
    'In agent keppelje freget de desktop-app — allinnich dy kin op dizze masine harkje. Iepenje dit projekt dêr en de skeakel stiet hjir.',
  'agent.recipes': 'DYN CLIENT KEPPELJE',
  'agent.recipesNote': 'De poarte en it token hjirûnder binne fan dizze masine. Kies dyn client en plak.',
  'agent.tabClaude': 'Claude Code',
  'agent.tabClaudeDesktop': 'Claude Desktop',
  'agent.tabCodex': 'Codex',
  'agent.tabCursor': 'Cursor',
  'agent.tabOther': 'Oars',
  'agent.recipeClaude': 'claude mcp add --transport http lvarch {endpoint} --header "Authorization: Bearer {token}"',
  'agent.recipeClaudeDesktop':
    '# Net it skerm "Add custom connector": dat is foar servers op ynternet en kin dizze masine net berikke.\n'
    + '# Claude Desktop start lokale servers fia stdio, dus it hat de mcp-remote-brêge yn syn developer-ynstellings nedich.\n'
    + '#\n'
    + '# It maklikst: plak dit yn Claude Code, dat de ynstellings al ken, en start dêrnei Claude Desktop opnij:\n'
    + 'Add the MCP server "lvarch" to my Claude Desktop developer settings (claude_desktop_config.json): '
    + 'command "npx", args ["-y", "mcp-remote", "{endpoint}", "--transport", "http-only", "--header", '
    + '"Authorization: Bearer {token}"].\n'
    + '#\n'
    + '# Of foegje it sels ta, yn Claude Desktop ûnder Settings → Developer → Edit Config:\n'
    + '{\n  "mcpServers": {\n    "lvarch": {\n      "command": "npx",\n'
    + '      "args": ["-y", "mcp-remote", "{endpoint}", "--transport", "http-only", "--header", "Authorization: Bearer {token}"]\n'
    + '    }\n  }\n}',
  'agent.recipeCodex':
    '# ~/.codex/config.toml\n[mcp_servers.lvarch]\nurl = "{endpoint}"\nhttp_headers = { Authorization = "Bearer {token}" }',
  'agent.recipeCursor':
    '// .cursor/mcp.json\n{\n  "mcpServers": {\n    "lvarch": {\n      "url": "{endpoint}",\n'
    + '      "headers": { "Authorization": "Bearer {token}" }\n    }\n  }\n}',
  'agent.recipeOther': 'Transport: Streamable HTTP\nEinpunt: {endpoint}\nHeader: Authorization: Bearer {token}',
  'agent.copy': 'Kopiearje',
  'agent.copied': 'Kopiearre',
  'agent.newToken': 'Nij token',
  'agent.newTokenNote': 'Elke agent dy’t foar no ynsteld is hat it nije token nedich.',
  'agent.changeFailed': 'Dat koe net wizige wurde: {message}',
  'shell.documentation': 'Dokumintaasje',
  'shell.documentationTip': 'Iepenje de dokumintaasjeside fan it selektearre elemint',
  'shell.noElements': 'Der is noch neat om te dokumintearjen — foegje earst in elemint ta.',
  'shell.decisions': 'Besluten',
  'shell.decisionsTip': 'Arsjitektuerbesluten — foar de groep, it lânskip en elke applikaasje',
  'shell.roadmap': 'Roadmap',
  'shell.roadmapTip': 'It lânskip op in tiidas, de plannen dêroer, en wêr’t de datums it net oer iens binne',
  'shell.activity': 'Aktiviteit',
  'shell.activityTip': 'Wat der sûnt it iepenjen oan dit projekt feroare is',
  'shell.activityEmpty': 'Noch neat',
  'shell.activityAgent': 'AGENT',
  'shell.search': 'Sykje',
  'shell.searchTip': 'Sykje eleminten, dokumintaasje en besluten (⌘K)',
}
