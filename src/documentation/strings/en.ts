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
  'doc.plans': 'Plans',
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
  /** The same, where the host can take a picture in (ADR-0009). */
  'doc.markdownImageHint': 'Markdown. [[Name]] links to another element; paste or drop a picture to add one.',
  /** The rendered page beside the source, and the way to get it out of a wide table's way. */
  'doc.showPreview': 'Show preview',
  'doc.hidePreview': 'Hide preview',
  'adr.mermaidFailed': 'This diagram could not be drawn.',
  'doc.bpmnFailed': 'This process could not be drawn.',
  'doc.bpmnMalformed': 'The text is not well-formed XML.',
  'doc.bpmnNotBpmn': 'This is not a BPMN document: there is no definitions element at the root.',
  'doc.bpmnNoDiagram': 'This BPMN has no diagram section, so nothing says where anything goes.',

  // The pictures a project holds, listed beside the source so one can be put
  // in again or taken out (ADR-0009). Deleting is not undoable, so it asks.
  'doc.pictures': 'Pictures',
  'doc.picturesNone': 'No pictures in this project yet. Paste or drop one into the text.',
  'doc.pictureUsedHere': 'Used on this page',
  'doc.insertPicture': 'Insert',
  'doc.deletePicture': 'Delete picture',
  'doc.deletePictureTitle': 'Delete {file}?',
  'doc.deletePictureUsedBy': 'It is shown in: {labels}. Those places will show its caption instead. The file is removed from the project on the next save, and this cannot be undone.',
  'doc.deletePictureUnused': 'No document shows it. The file is removed from the project on the next save, and this cannot be undone.',

  // Markdown help: what the renderer draws, one row per thing. The syntax in
  // each row is markdown and stays as it is; only the words beside it are
  // translated.
  'docHelp.markdown': 'Markdown help',
  'docHelp.title': 'Writing in markdown',
  'docHelp.intro': 'Plain text with a few marks. This is what the page draws:',
  'docHelp.heading': 'Headings; the first three levels appear in the contents',
  'docHelp.emphasis': 'Bold and italic, also ⌘B and ⌘I on a selection',
  'docHelp.lists': 'Bulleted and numbered lists; Tab indents',
  'docHelp.tasks': 'A task list',
  'docHelp.elementLink': 'A link to another element, by its name',
  'docHelp.link': 'A link to the web, opened outside the app',
  'docHelp.image': 'A picture from this project; paste or drop one to add it',
  'docHelp.table': 'A table',
  'docHelp.quote': 'A quotation',
  'docHelp.code': 'Code, inline or as a block',
  'docHelp.mermaid': 'A diagram, drawn with Mermaid',
  'docHelp.businessCase': 'A business case, with the figures worked out beneath it',
  'docHelp.rule': 'A horizontal rule',
  'docHelp.imagesNote': 'Only pictures kept in the project are drawn. A web address shows as its caption, and the app never fetches anything.',
  'docHelp.htmlNote': 'HTML is shown as text, not rendered.',

  // The business-case block (ADR-0009). The words around it are translated;
  // what is typed inside the fence is a format and stays English.
  'doc.businessCaseLine': 'Line',
  'doc.businessCaseNet': 'Net',
  'doc.businessCaseCumulative': 'Cumulative',
  'doc.businessCaseNpv': 'Net present value at {rate}',
  'doc.businessCaseIrr': 'Internal rate of return',
  'doc.businessCasePayback': 'Payback, in periods',
  'doc.businessCaseRoi': 'Return on investment',
  'doc.businessCaseRatio': 'Benefit-cost ratio',
  'doc.businessCaseScore': 'Weighted score {total} out of {max}, scored 1 to {scale}.',
  'doc.businessCaseUnreadable': 'This business case has no figures in it yet.',
  'doc.insertBusinessCase': 'Add a business case',
} as const
