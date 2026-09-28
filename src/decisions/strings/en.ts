// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
  'adr.scopeAbove': 'From a scope above',
  'adr.scopeLandscape': 'Landscapes',
  'adr.scopeApplications': 'Applications',
  'adr.scopeRemoved': 'Removed applications',
  'adr.scopeLandscapeNote': 'Decisions about the landscape as a whole',
  /** A section per scope above this one (ADR-0012 §7), read-only here. */
  'adr.scopeFrom': 'From {scope}',
  'adr.scopeFromNote': 'Read here, edited where it lives',
  'adr.openScope': 'Open {scope}',
  'adr.fromAncestor': 'This record belongs to {scope}. Open that scope to change it.',
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
  'adr.plans': 'Plans resting on this',
  'adr.supersedeTitle': 'Mark as superseded',
  'adr.supersedeBody': 'Which decision replaces this one? The record stays as it is, with a link to its successor.',
  'adr.successor': 'Successor',
  'adr.noSuccessor': 'There is no accepted decision in this list to point at yet. Write the successor, name this record under Supersedes, and accepting it supersedes this one.',
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
  // The gate on a move (ADR-0008, amended 28 September 2026): one line each.
  'adr.gateTitle': 'Before it can move to {status}',
  'adr.gate.context': 'The context is written',
  'adr.gate.options': 'At least two options were considered',
  'adr.gate.outcome': 'The outcome names one of the options',
  'adr.gate.consequence': 'At least one consequence is written',
  'adr.gate.approved': 'Somebody approved it, and nobody rejected it',
  'adr.gate.predecessors': 'Every record it supersedes is accepted',
  'adr.gate.reason': 'A reason is given',
  'adr.gate.rejection': 'Somebody rejected it, or a reason is given',
  'adr.gate.successor': 'The successor is accepted',
  // What each line of the gate looks for, on hover: the rule, said plainly.
  'adr.gateHint.context': 'At least one line of your own under \u201cContext and Problem Statement\u201d. The template\u2019s text does not count.',
  'adr.gateHint.options': 'At least two bullets under \u201cConsidered Options\u201d that are not the template\u2019s \u201cOption 1\u201d, \u201cOption 2\u201d.',
  'adr.gateHint.outcome': 'Under \u201cDecision Outcome\u201d, write the name of one option as it stands under \u201cConsidered Options\u201d: its text up to the first colon, spaced dash or bracket. Capitals and quotes do not matter; the words do.',
  'adr.gateHint.outcomeNames': 'The names it looks for: {names}.',
  'adr.gateHint.outcomeNone': 'There are no options to name yet.',
  'adr.gateHint.quoted': '\u201c{name}\u201d',
  'adr.gateHint.consequence': 'At least one bullet under \u201cConsequences\u201d that is not the template\u2019s \u201cGood, because \u2026\u201d or \u201cBad, because \u2026\u201d.',
  'adr.gateHint.approved': 'A reviewer with the verdict Approved. One Rejected verdict holds the record back until it is changed.',
  'adr.gateHint.predecessors': 'Each record under Supersedes has to be accepted itself before this one can replace it.',
  'adr.gateHint.reason': 'Why, written in the dialog that asks for a reason.',
  'adr.gateHint.rejection': 'A reviewer with the verdict Rejected, or a reason written in the dialog.',
  'adr.gateHint.successor': 'The record chosen to replace this one has to be accepted.',
  'adr.acceptTitle': 'Accept {name}?',
  'adr.acceptBody': 'It is then locked; to change it later, write a record that supersedes it.',
  'adr.acceptSupersedes': 'Accepting it also marks {names} as superseded.',
  'adr.accept': 'Accept',
  'adr.withdraw': 'Withdraw',
  'adr.withdrawTitle': 'Withdraw {name}?',
  'adr.withdrawBody': 'The record keeps its number and ends as rejected, with your reason. It can no longer be changed.',
  'adr.rejectTitle': 'Reject {name}?',
  'adr.rejectBody': 'The record keeps its number and is locked. Say why, unless a reviewer\u2019s rejection already does.',
  'adr.reject': 'Reject',
  'adr.reasonField': 'Reason',
  'adr.reason': 'Reason',
  'adr.proposedBy': 'Proposed by',
  'adr.selfAccepted': 'The only approval is from {name}, who proposed it.',
  'adr.supersedesField': 'Supersedes',
  'adr.supersedesHelp': 'Accepted records this one replaces. Accepting it marks them superseded in the same step.',
  'adr.willSupersede': 'Will supersede {name}',
  'adr.brokenSuccessor': 'Superseded by a record that is not accepted. Nothing accepted replaces this decision.',
  'adr.decidedFor': 'Decided for',
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
