/**
 * Dutch, for the documentation page and the markdown around it.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'field.description': 'Omschrijving',
  'field.descriptionMarkdown': 'Omschrijving (markdown)',
  'field.descriptionPlaceholder': 'Wat doet dit element? Markdown mag.',
  'field.edit': 'Bewerken',
  'field.preview': 'Voorbeeld',
  'field.editDescription': 'Omschrijving bewerken',
  'field.previewDescription': 'Voorbeeld van de omschrijving',

  'doc.shortDescription': 'Korte omschrijving',
  'doc.owner': 'Eigenaar',
  'doc.criticality': 'Bedrijfskritikaliteit',
  'doc.users': 'Gebruikers',
  'doc.dataClassification': 'Dataclassificatie',
  'doc.lastReviewed': 'Laatst beoordeeld',
  'doc.purpose': 'Doel',
  'doc.keyFunctions': 'Kernfuncties',
  'doc.interfaces': 'Koppelingen',
  'doc.data': 'Gegevens',
  'doc.operations': 'Beheer',
  'doc.decisions': 'Besluiten en open punten',
  'field.openDocumentation': 'Als pagina openen',
  'doc.title': 'Documentatie',
  'doc.read': 'Lezen',
  'doc.edit': 'Bewerken',
  'doc.close': 'Documentatie sluiten',
  'doc.previous': 'Vorig element',
  'doc.next': 'Volgend element',
  'doc.contents': 'Op deze pagina',
  'doc.source': 'Documentatiebron (markdown)',
  'doc.insertTemplate': 'Begin met het sjabloon',
  'doc.emptyHint': 'Schakel naar Bewerken om te schrijven, of begin met het sjabloon.',
  'doc.markdownHint': 'Markdown. [[Naam]] verwijst naar een ander element.',
  'adr.mermaidFailed': 'Dit diagram kon niet worden getekend.',
}
