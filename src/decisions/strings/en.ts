/**
 * English, for architecture decision records: the page, the statuses, the template.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {

  // --- architecture decision records -----------------------------------------
  'adr.title': 'Architecture decisions',
  'adr.close': 'Close decisions',
  'adr.scopeGroup': 'Group',
  'adr.scopeLandscape': 'Landscapes',
  'adr.scopeApplications': 'Applications',
  'adr.scopeRemoved': 'Removed applications',
  'adr.scopeGroupNote': 'Decisions that hold for every project in this group',
  'adr.scopeLandscapeNote': 'Decisions about the landscape as a whole',
  'adr.new': 'New decision',
  'adr.newTitleField': 'Title',
  'adr.newTitleHelp': 'State the decision as a short sentence: \u201cUse PostgreSQL for the order store\u201d.',
  'adr.create': 'Create',
  'adr.searchPlaceholder': 'Search all decisions',
  'adr.searchField': 'Search decisions',
  'adr.listEmpty': 'No decisions recorded here yet.',
  'adr.searchEmpty': 'No decision matches \u201c{query}\u201d.',
  'adr.noneSelected': 'Pick a decision from the list, or create one.',
  'adr.status': 'Status',
  'adr.date': 'Date',
  'adr.deciders': 'Decision-makers',
  'adr.statusProposed': 'Proposed',
  'adr.statusReviewing': 'Under review',
  'adr.statusAccepted': 'Accepted',
  'adr.statusRejected': 'Rejected',
  'adr.statusSuperseded': 'Superseded',
  'adr.moveTo': 'Move to {status}',
  'adr.supersededBy': 'Superseded by {name}',
  'adr.supersedes': 'Supersedes {name}',
  'adr.supersedeTitle': 'Mark as superseded',
  'adr.supersedeBody': 'Which decision replaces this one? The record stays as it is, with a link to its successor.',
  'adr.successor': 'Successor',
  'adr.noSuccessor': 'There is no other decision in this list to point at yet \u2014 create the successor first.',
  'adr.locked': 'This decision is {status} and can no longer be changed.',
  'adr.read': 'Read',
  'adr.edit': 'Edit',
  'adr.source': 'Decision source (markdown)',
  'adr.titleField': 'Title',
  'adr.delete': 'Delete',
  'adr.deleteTitle': 'Delete {name}?',
  'adr.deleteBody': 'Only a decision that is still being written can be deleted. Its number is not reused.',
  'adr.signers': 'Reviewers and signatures',
  'adr.signersHelp': 'Who this decision was put to. A verdict is dated the day it is given.',
  'adr.signerName': 'Name',
  'adr.signerRole': 'Role',
  'adr.signerVerdict': 'Verdict',
  'adr.signedAt': 'Signed',
  'adr.verdictPending': 'Pending',
  'adr.verdictApproved': 'Approved',
  'adr.verdictRejected': 'Rejected',
  'adr.addSigner': 'Add a reviewer',
  'adr.removeSigner': 'Remove {name}',
  'adr.noSigners': 'Nobody has been asked yet.',
  'adr.formattingHelp': 'Formatting help',
  'adr.contents': 'On this page',
  // The MADR template, section by section.
  'adr.tplContext': 'Context and Problem Statement',
  'adr.tplDrivers': 'Decision Drivers',
  'adr.tplDriver': 'A force, a concern, a constraint \u2026',
  'adr.tplOptions': 'Considered Options',
  'adr.tplOption': 'Option {n}',
  'adr.tplOutcome': 'Decision Outcome',
  'adr.tplChosen': 'Chosen option: \u201cOption 1\u201d, because \u2026',
  'adr.tplConsequences': 'Consequences',
  'adr.tplGood': 'Good, because \u2026',
  'adr.tplBad': 'Bad, because \u2026',
  'adr.tplConfirmation': 'Confirmation',
  'adr.tplProsCons': 'Pros and Cons of the Options',
  'adr.tplMore': 'More Information',
  /**
   * The formatting help shown beside the source while writing. Markdown itself,
   * rendered by the same renderer, so every example is also a demonstration.
   */
  'adr.markdownHelp': `### Formatting

| Write | Get |
|---|---|
| \`## Section\`, \`### Subsection\` | headings \u2014 the table of contents follows them |
| \`**bold**\`, \`_italic_\`, \`~~struck~~\` | **bold**, _italic_, ~~struck~~ |
| \`* item\` or \`1. item\` | a bulleted or numbered list |
| \`- [x] done\`, \`- [ ] open\` | a task list |
| \`> quote\` | a quotation |
| \`[text](https://\u2026)\` | a link, opened outside the app |
| \`[[Element name]]\` | a link to that element's documentation |
| \`\` \`code\` \`\` | \`inline code\` |
| \`\\| a \\| b \\|\` with a \`\\|---\\|---\\|\` row under it | a table |
| \`---\` | a horizontal rule |

### Diagrams

A fenced block marked \`mermaid\` is drawn as a diagram:

\`\`\`
\`\`\`mermaid
flowchart LR
  Order --> Billing
  Order --> Warehouse
\`\`\`
\`\`\`

Flowcharts, sequence diagrams, state diagrams and class diagrams all work; mermaid.js.org has the syntax.
`,
} as const
