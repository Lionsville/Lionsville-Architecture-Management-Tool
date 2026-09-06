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
  'adr.scopeLandscape': 'Landschappen',
  'adr.scopeApplications': 'Applicaties',
  'adr.scopeRemoved': 'Verwijderde applicaties',
  'adr.scopeGroupNote': 'Besluiten die voor elk project in deze groep gelden',
  'adr.scopeLandscapeNote': 'Besluiten over het landschap als geheel',
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
  'adr.supersedeTitle': 'Markeren als vervangen',
  'adr.supersedeBody': 'Welk besluit vervangt dit? De tekst blijft zoals hij is, met een verwijzing naar de opvolger.',
  'adr.successor': 'Opvolger',
  'adr.noSuccessor': 'Er is nog geen ander besluit in deze lijst om naar te verwijzen \u2014 maak eerst de opvolger aan.',
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
