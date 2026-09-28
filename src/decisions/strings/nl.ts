// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Dutch, for architecture decision records: the page, the statuses, the template.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {

  'adr.title': 'Architectuurbesluiten',
  'adr.close': 'Besluiten sluiten',
  'adr.scopeGroup': 'Groep',
  'adr.scopeAbove': 'Van een onderdeel erboven',
  'adr.scopeLandscape': 'Landschappen',
  'adr.scopeApplications': 'Applicaties',
  'adr.scopeRemoved': 'Verwijderde applicaties',
  'adr.scopeLandscapeNote': 'Besluiten over het landschap als geheel',
  'adr.scopeFrom': 'Van {scope}',
  'adr.scopeFromNote': 'Hier te lezen, te wijzigen waar het thuishoort',
  'adr.openScope': '{scope} openen',
  'adr.fromAncestor': 'Dit besluit hoort bij {scope}. Open dat niveau om het te wijzigen.',
  'adr.new': 'Nieuw besluit',
  'adr.newTitleField': 'Titel',
  'adr.newTitleHelp': 'Formuleer het besluit als korte zin: \u201cGebruik PostgreSQL voor de orderopslag\u201d.',
  'adr.create': 'Aanmaken',
  'adr.searchPlaceholder': 'Zoek in alle besluiten',
  'adr.searchField': 'Besluiten zoeken',
  'adr.listEmpty': 'Hier zijn nog geen besluiten vastgelegd.',
  'adr.searchEmpty': 'Geen besluit komt overeen met \u201c{query}\u201d.',
  'adr.noneSelected': 'Kies een besluit uit de lijst, of maak er een aan.',
  'adr.status': 'Status',
  'adr.date': 'Datum',
  'adr.deciders': 'Besluitnemers',
  'adr.statusProposed': 'Voorgesteld',
  'adr.statusReviewing': 'In beoordeling',
  'adr.statusAccepted': 'Aanvaard',
  'adr.statusRejected': 'Afgewezen',
  'adr.statusSuperseded': 'Vervangen',
  'adr.moveTo': 'Naar {status}',
  'adr.supersededBy': 'Vervangen door {name}',
  'adr.supersedes': 'Vervangt {name}',
  'adr.plans': 'Plannen die hierop steunen',
  'adr.supersedeTitle': 'Markeren als vervangen',
  'adr.supersedeBody': 'Welk besluit vervangt dit? De tekst blijft zoals hij is, met een verwijzing naar de opvolger.',
  'adr.successor': 'Opvolger',
  'adr.noSuccessor': 'Er is in deze lijst nog geen aanvaard besluit om naar te verwijzen. Schrijf de opvolger, noem dit besluit onder Vervangt, en aanvaarden vervangt dit besluit.',
  'adr.locked': 'Dit besluit is {status} en kan niet meer worden gewijzigd.',
  'adr.read': 'Lezen',
  'adr.edit': 'Bewerken',
  'adr.source': 'Besluitbron (markdown)',
  'adr.titleField': 'Titel',
  'adr.delete': 'Verwijderen',
  'adr.deleteTitle': '{name} verwijderen?',
  'adr.deleteBody': 'Alleen een besluit dat nog geschreven wordt kan worden verwijderd. Het nummer wordt niet hergebruikt.',
  'adr.signers': 'Beoordelaars en ondertekening',
  'adr.signersHelp': 'Aan wie dit besluit is voorgelegd. Een oordeel krijgt de datum waarop het wordt gegeven.',
  'adr.signerName': 'Naam',
  'adr.signerRole': 'Rol',
  'adr.signerVerdict': 'Oordeel',
  'adr.signedAt': 'Getekend',
  'adr.verdictPending': 'In afwachting',
  'adr.verdictApproved': 'Akkoord',
  'adr.verdictRejected': 'Afgewezen',
  'adr.addSigner': 'Beoordelaar toevoegen',
  'adr.removeSigner': '{name} verwijderen',
  'adr.noSigners': 'Nog niemand gevraagd.',
  'adr.formattingHelp': 'Hulp bij opmaak',
  'adr.contents': 'Op deze pagina',
  'adr.gateTitle': 'Voordat het naar {status} kan',
  'adr.gate.context': 'De context is beschreven',
  'adr.gate.options': 'Er zijn minstens twee opties overwogen',
  'adr.gate.outcome': 'De uitkomst noemt een van de opties',
  'adr.gate.consequence': 'Er is minstens \u00e9\u00e9n gevolg beschreven',
  'adr.gate.approved': 'Iemand is akkoord, en niemand heeft afgewezen',
  'adr.gate.predecessors': 'Elk besluit dat het vervangt is aanvaard',
  'adr.gate.reason': 'Er is een reden gegeven',
  'adr.gate.rejection': 'Iemand heeft afgewezen, of er is een reden gegeven',
  'adr.gate.successor': 'De opvolger is aanvaard',
  'adr.gateHint.context': 'Minstens \u00e9\u00e9n eigen regel onder \u201cContext en probleemstelling\u201d. De tekst van het sjabloon telt niet mee.',
  'adr.gateHint.options': 'Minstens twee opsommingstekens onder \u201cOverwogen opties\u201d die niet de \u201cOptie 1\u201d, \u201cOptie 2\u201d van het sjabloon zijn.',
  'adr.gateHint.outcome': 'Schrijf onder \u201cUitkomst\u201d de naam van een optie zoals die onder \u201cOverwogen opties\u201d staat: de tekst tot de eerste dubbele punt, het eerste vrijstaande streepje of de eerste haak. Hoofdletters en aanhalingstekens maken niet uit; de woorden wel.',
  'adr.gateHint.outcomeNames': 'De namen waar het naar zoekt: {names}.',
  'adr.gateHint.outcomeNone': 'Er zijn nog geen opties om te noemen.',
  'adr.gateHint.quoted': '\u201c{name}\u201d',
  'adr.gateHint.consequence': 'Minstens \u00e9\u00e9n opsommingsteken onder \u201cGevolgen\u201d dat niet het \u201cGoed, omdat \u2026\u201d of \u201cSlecht, omdat \u2026\u201d van het sjabloon is.',
  'adr.gateHint.approved': 'Een beoordelaar met het oordeel Akkoord. E\u00e9n oordeel Afgewezen houdt het besluit tegen tot het is veranderd.',
  'adr.gateHint.predecessors': 'Elk besluit onder Vervangt moet zelf aanvaard zijn voordat dit het kan vervangen.',
  'adr.gateHint.reason': 'Waarom, geschreven in het venster dat om een reden vraagt.',
  'adr.gateHint.rejection': 'Een beoordelaar met het oordeel Afgewezen, of een reden in het venster.',
  'adr.gateHint.successor': 'Het besluit dat dit vervangt moet aanvaard zijn.',
  'adr.acceptTitle': '{name} aanvaarden?',
  'adr.acceptBody': 'Het is daarna vergrendeld; wie het later wil wijzigen, schrijft een besluit dat het vervangt.',
  'adr.acceptSupersedes': 'Aanvaarden markeert ook {names} als vervangen.',
  'adr.accept': 'Aanvaarden',
  'adr.withdraw': 'Intrekken',
  'adr.withdrawTitle': '{name} intrekken?',
  'adr.withdrawBody': 'Het besluit houdt zijn nummer en eindigt als afgewezen, met uw reden. Het kan daarna niet meer worden gewijzigd.',
  'adr.rejectTitle': '{name} afwijzen?',
  'adr.rejectBody': 'Het besluit houdt zijn nummer en wordt vergrendeld. Geef een reden, tenzij de afwijzing van een beoordelaar die al geeft.',
  'adr.reject': 'Afwijzen',
  'adr.reasonField': 'Reden',
  'adr.reason': 'Reden',
  'adr.proposedBy': 'Voorgesteld door',
  'adr.selfAccepted': 'Het enige akkoord komt van {name}, die het ook voorstelde.',
  'adr.supersedesField': 'Vervangt',
  'adr.supersedesHelp': 'Aanvaarde besluiten die dit besluit vervangt. Aanvaarden markeert ze in dezelfde stap als vervangen.',
  'adr.willSupersede': 'Gaat {name} vervangen',
  'adr.brokenSuccessor': 'Vervangen door een besluit dat niet is aanvaard. Er vervangt dus geen aanvaard besluit dit besluit.',
  'adr.decidedFor': 'Besloten voor',
  'adr.tplContext': 'Context en probleemstelling',
  'adr.tplDrivers': 'Beslisfactoren',
  'adr.tplDriver': 'Een kracht, een zorg, een randvoorwaarde \u2026',
  'adr.tplOptions': 'Overwogen opties',
  'adr.tplOption': 'Optie {n}',
  'adr.tplOutcome': 'Uitkomst',
  'adr.tplChosen': 'Gekozen optie: \u201cOptie 1\u201d, omdat \u2026',
  'adr.tplConsequences': 'Gevolgen',
  'adr.tplGood': 'Goed, omdat \u2026',
  'adr.tplBad': 'Slecht, omdat \u2026',
  'adr.tplConfirmation': 'Bevestiging',
  'adr.tplProsCons': 'Voor- en nadelen van de opties',
  'adr.tplMore': 'Meer informatie',
  'adr.markdownHelp': `### Opmaak

| Schrijf | Krijg |
|---|---|
| \`## Sectie\`, \`### Subsectie\` | koppen \u2014 de inhoudsopgave volgt ze |
| \`**vet**\`, \`_cursief_\`, \`~~doorgehaald~~\` | **vet**, _cursief_, ~~doorgehaald~~ |
| \`* punt\` of \`1. punt\` | een opsomming, met of zonder nummers |
| \`- [x] klaar\`, \`- [ ] open\` | een takenlijst |
| \`> citaat\` | een citaat |
| \`[tekst](https://\u2026)\` | een link, geopend buiten de app |
| \`[[Elementnaam]]\` | een link naar de documentatie van dat element |
| \`\` \`code\` \`\` | \`code in de regel\` |
| \`\\| a \\| b \\|\` met een rij \`\\|---\\|---\\|\` eronder | een tabel |
| \`---\` | een scheidingslijn |

### Diagrammen

Een codeblok gemarkeerd als \`mermaid\` wordt als diagram getekend:

\`\`\`
\`\`\`mermaid
flowchart LR
  Order --> Facturatie
  Order --> Magazijn
\`\`\`
\`\`\`

Stroomschema's, sequentiediagrammen, toestandsdiagrammen en klassendiagrammen werken allemaal; de syntaxis staat op mermaid.js.org.
`,
}
