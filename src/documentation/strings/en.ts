/**
 * English, for the documentation page and the markdown around it.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {
  'field.description': 'Description',
  'field.descriptionMarkdown': 'Description (markdown)',
  'field.descriptionPlaceholder': 'What does this element do? Markdown supported.',
  'field.edit': 'Edit',
  'field.preview': 'Preview',
  'field.editDescription': 'Edit description',
  'field.previewDescription': 'Preview description',

  // The documentation template: a header table, then the sections. Only what
  // the element does not already know — vendor, technology and lifecycle are
  // fields beside the document, not rows in it. `doc.shortDescription` is also
  // the label `model/documentation.ts` recognises; keep them in step.
  'doc.shortDescription': 'Short description',
  'doc.owner': 'Owner',
  'doc.criticality': 'Business criticality',
  'doc.users': 'Users',
  'doc.dataClassification': 'Data classification',
  'doc.lastReviewed': 'Last reviewed',
  'doc.purpose': 'Purpose',
  'doc.keyFunctions': 'Key functions',
  'doc.interfaces': 'Interfaces',
  'doc.data': 'Data',
  'doc.operations': 'Operations',
  'doc.decisions': 'Decisions and open issues',
  'field.openDocumentation': 'Open as a page',
  'doc.title': 'Documentation',
  'doc.read': 'Read',
  'doc.edit': 'Edit',
  'doc.close': 'Close documentation',
  'doc.previous': 'Previous element',
  'doc.next': 'Next element',
  'doc.contents': 'On this page',
  'doc.source': 'Documentation source (markdown)',
  'doc.insertTemplate': 'Start from the template',
  'doc.emptyHint': 'Switch to Edit to write, or start from the template.',
  'doc.markdownHint': 'Markdown. [[Name]] links to another element.',
  'adr.mermaidFailed': 'This diagram could not be drawn.',
} as const
