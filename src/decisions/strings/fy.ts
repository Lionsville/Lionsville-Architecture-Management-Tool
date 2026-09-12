/**
 * Frisian, for architecture decision records: the page, the statuses, the template.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Frisian screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {

  'adr.title': 'Arsjitektuerbesluten',
  'adr.close': 'Besluten slute',
  'adr.scopeGroup': 'Groep',
  'adr.scopeAbove': 'Fan in nivo derboppe',
  'adr.scopeLandscape': 'Lânskippen',
  'adr.scopeApplications': 'Applikaasjes',
  'adr.scopeRemoved': 'Fuortsmiten applikaasjes',
  'adr.scopeGroupNote': 'Besluten dy\u2019t foar elk projekt yn dizze groep jilde',
  'adr.scopeLandscapeNote': 'Besluten oer it lânskip as gehiel',
  'adr.scopeFrom': 'Fan {scope}',
  'adr.scopeFromNote': 'Hjir te lêzen, te wizigjen dêr’t it heart',
  'adr.openScope': '{scope} iepenje',
  'adr.fromAncestor': 'Dit beslút heart by {scope}. Iepenje dat nivo om it te wizigjen.',
  'adr.new': 'Nij beslút',
  'adr.newTitleField': 'Titel',
  'adr.newTitleHelp': 'Formulearje it beslút as koarte sin: \u201cBrûk PostgreSQL foar de oarderopslach\u201d.',
  'adr.create': 'Oanmeitsje',
  'adr.searchPlaceholder': 'Sykje yn alle besluten',
  'adr.searchField': 'Besluten sykje',
  'adr.listEmpty': 'Hjir binne noch gjin besluten fêstlein.',
  'adr.searchEmpty': 'Gjin beslút komt oerien mei \u201c{query}\u201d.',
  'adr.noneSelected': 'Kies in beslút út de list, of meitsje der ien oan.',
  'adr.status': 'Status',
  'adr.date': 'Datum',
  'adr.deciders': 'Beslútnimmers',
  'adr.statusProposed': 'Foarsteld',
  'adr.statusReviewing': 'Yn behanneling',
  'adr.statusAccepted': 'Oannommen',
  'adr.statusRejected': 'Ofwiisd',
  'adr.statusSuperseded': 'Ferfongen',
  'adr.moveTo': 'Nei {status}',
  'adr.supersededBy': 'Ferfongen troch {name}',
  'adr.supersedes': 'Ferfangt {name}',
  'adr.plans': 'Plannen dy\u2019t hjirop stypje',
  'adr.supersedeTitle': 'Markearje as ferfongen',
  'adr.supersedeBody': 'Hokker beslút ferfangt dit? De tekst bliuwt sa\u2019t er is, mei in ferwizing nei de opfolger.',
  'adr.successor': 'Opfolger',
  'adr.noSuccessor': 'Der is noch gjin oar beslút yn dizze list om nei te ferwizen \u2014 meitsje earst de opfolger oan.',
  'adr.locked': 'Dit beslút is {status} en kin net mear wizige wurde.',
  'adr.read': 'Lêze',
  'adr.edit': 'Bewurkje',
  'adr.source': 'Beslútboarne (markdown)',
  'adr.titleField': 'Titel',
  'adr.delete': 'Fuortsmite',
  'adr.deleteTitle': '{name} fuortsmite?',
  'adr.deleteBody': 'Allinne in beslút dat noch skreaun wurdt kin fuortsmiten wurde. It nûmer wurdt net opnij brûkt.',
  'adr.signers': 'Beoardielers en ûndertekening',
  'adr.signersHelp': 'Oan wa\u2019t dit beslút foarlein is. In oardiel krijt de datum wêrop\u2019t it jûn wurdt.',
  'adr.signerName': 'Namme',
  'adr.signerRole': 'Rol',
  'adr.signerVerdict': 'Oardiel',
  'adr.signedAt': 'Tekene',
  'adr.verdictPending': 'Yn ôfwachting',
  'adr.verdictApproved': 'Akkoart',
  'adr.verdictRejected': 'Ofwiisd',
  'adr.addSigner': 'Beoardieler tafoegje',
  'adr.removeSigner': '{name} fuortsmite',
  'adr.noSigners': 'Noch nimmen frege.',
  'adr.formattingHelp': 'Help by opmaak',
  'adr.contents': 'Op dizze side',
  'adr.tplContext': 'Kontekst en probleemstelling',
  'adr.tplDrivers': 'Beslisfaktoaren',
  'adr.tplDriver': 'In krêft, in soarch, in betingst \u2026',
  'adr.tplOptions': 'Oerwoegen opsjes',
  'adr.tplOption': 'Opsje {n}',
  'adr.tplOutcome': 'Utkomst',
  'adr.tplChosen': 'Keazen opsje: \u201cOpsje 1\u201d, om\u2019t \u2026',
  'adr.tplConsequences': 'Gefolgen',
  'adr.tplGood': 'Goed, om\u2019t \u2026',
  'adr.tplBad': 'Min, om\u2019t \u2026',
  'adr.tplConfirmation': 'Befêstiging',
  'adr.tplProsCons': 'Foar- en neidielen fan de opsjes',
  'adr.tplMore': 'Mear ynformaasje',
  'adr.markdownHelp': `### Opmaak

| Skriuw | Krij |
|---|---|
| \`## Seksje\`, \`### Subseksje\` | koppen \u2014 de ynhâldsopjefte folget se |
| \`**fet**\`, \`_kursyf_\`, \`~~trochhelle~~\` | **fet**, _kursyf_, ~~trochhelle~~ |
| \`* punt\` of \`1. punt\` | in opsomming, mei of sûnder nûmers |
| \`- [x] klear\`, \`- [ ] iepen\` | in takenlist |
| \`> sitaat\` | in sitaat |
| \`[tekst](https://\u2026)\` | in keppeling, iepene bûten de app |
| \`[[Elemintnamme]]\` | in keppeling nei de dokumintaasje fan dat elemint |
| \`\` \`koade\` \`\` | \`koade yn de rigel\` |
| \`\\| a \\| b \\|\` mei in rige \`\\|---\\|---\\|\` derûnder | in tabel |
| \`---\` | in skiedingsline |

### Diagrammen

In koadeblok markearre as \`mermaid\` wurdt as diagram tekene:

\`\`\`
\`\`\`mermaid
flowchart LR
  Oarder --> Fakturaasje
  Oarder --> Pakhûs
\`\`\`
\`\`\`

Streamskema\u2019s, sekwinsjediagrammen, tastândiagrammen en klassediagrammen wurkje allegear; de syntaksis stiet op mermaid.js.org.
`,
}
