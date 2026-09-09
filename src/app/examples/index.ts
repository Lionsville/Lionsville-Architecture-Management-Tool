/**
 * The example projects that ship with the app.
 *
 * **Fictional, and that is a rule rather than a preference.** A real customer's
 * landscape used to ship here — it was once "the shipped document", loaded at
 * boot. In a tool handed to other organisations that means every installer
 * carries one client's architecture to everybody else, and the first screen a
 * new user sees is somebody else's business. Whatever ships here is invented.
 *
 * An example is one entry in a catalogue. Opening one copies it into a real
 * project under its own group; from that moment it is theirs and nothing here is
 * involved again. Adding one is a JSON file and one entry below.
 *
 * It has to be *good*, too. It is the first thing anyone opens, and a thin
 * example makes the tool look thin — so the shipped one is a landscape with
 * enough shape to show what the editor is for: every zone populated, domain
 * groups, aspects that are not all green, a system that is visibly on its way
 * out, and a container view under one of the applications.
 *
 * Examples are data, not configuration: the group and project keys are where a
 * copy lands by default, not a statement about who runs this app.
 */
import type { Adr } from '../../model/adr'
import type { InterchangeDoc } from '../../model/fromInterchange'
import type { Transition } from '../../model/transition'
import type { ProjectRef } from '../../projects/projectRef'
import acmeLogistics from './acme-logistics.json'

export type ExampleProject = {
  /** Stable key, for the picker and for tests. */
  key: string
  /** Where a copy lands. The user may be offered a different group later. */
  ref: ProjectRef
  /** The group's display name — becomes `model.customerName`. */
  groupName: string
  /** What the picker calls it. */
  label: string
  /** One line on what it shows. */
  description: string
  document: InterchangeDoc
  /**
   * The plans that come with it (ADR-0009).
   *
   * Beside the document rather than inside it, because the interchange format
   * is a contract with other tools and knows nothing about plans — the same
   * reason a project's decisions are not in there either.
   */
  transitions?: readonly Transition[]
  /** The decision records the plans rest on; beside the document for the same reason. */
  decisions?: readonly Adr[]
}

/**
 * The decisions the plans rest on.
 *
 * Two accepted records, because an accepted record is the one thing on the
 * decisions page a new user cannot make in a minute: it is locked, it has
 * signers with verdicts, and a plan can point at it. One is the landscape's
 * and one is filed under an application, so both lists have something in
 * them.
 */
const ACME_DECISIONS: readonly Adr[] = [
  {
    id: 'adr-one-price',
    number: 1,
    title: 'One place where a price is decided',
    status: 'accepted',
    date: '2026-01-20',
    signers: [
      { name: 'M. Okafor', role: 'Head of revenue systems', verdict: 'approved', signedAt: '2026-01-20' },
      { name: 'J. Lindqvist', role: 'Enterprise architect', verdict: 'approved', signedAt: '2026-01-22' },
    ],
    body: [
      '## Context',
      '',
      'Two contracts are still priced by [[Rating (legacy)]] while everything else',
      'goes through the [[Tariff Engine]]. Every tariff change is made twice, and',
      'the two disagree about rounding often enough that finance reconciles them',
      'by hand each month.',
      '',
      '## Decision',
      '',
      'The tariff engine becomes the only place a price is decided. The two',
      'remaining contracts are moved one at a time, and the legacy rater is',
      'switched off when the last one has moved — not before, and not later.',
      '',
      '## Consequences',
      '',
      '- The tariff engine falls back to the legacy rater for whatever it cannot yet price; that line is dated and disappears at the switch-off.',
      '- The legacy licence is not renewed. The saving is in the plan that carries this decision out.',
      '- Rounding follows the tariff engine from the first moved contract, and the affected customers are told.',
    ].join('\n'),
  },
  {
    id: 'adr-buy-yard',
    number: 2,
    title: 'Buy a yard system rather than extend the warehouse system',
    status: 'accepted',
    date: '2026-02-10',
    signers: [
      { name: 'R. Baptiste', role: 'Warehouse operations', verdict: 'approved', signedAt: '2026-02-10' },
      { name: 'J. Lindqvist', role: 'Enterprise architect', verdict: 'approved', signedAt: '2026-02-11' },
    ],
    body: [
      '## Context',
      '',
      'Dock doors are booked in a spreadsheet and announced by phone. Trucks wait,',
      'detention fees follow, and [[Warehouse Management]] knows nothing about a',
      'trailer until it is at the door.',
      '',
      '## Options considered',
      '',
      '| Option | Time to live | Cost over five years | Fit |',
      '| ------ | ------------ | -------------------- | --- |',
      '| Extend the warehouse system with a dock module | 14 months | 410 000 | Poor: the WMS vendor has no yard roadmap |',
      '| Buy a yard management system | 6 months | 480 000 | Good: gate, yard and dock in one product |',
      '| Keep the spreadsheet, add a booking page | 2 months | 60 000 | None: the yard itself stays invisible |',
      '',
      '## Decision',
      '',
      'Buy. A yard system is introduced beside the warehouse system, takes dock',
      'booking off it, and [[Dispatch]] announces arrivals to it rather than by phone.',
      '',
      '## Consequences',
      '',
      '- One more application to run, and one more vendor.',
      '- The warehouse system stops booking dock doors once the yard system does; until then both do, which is the plan\'s shadow run.',
    ].join('\n'),
  },
]

/**
 * The plan behind the dates on Rating (legacy) and the Tariff Engine.
 *
 * Written out here rather than in the JSON because it is not interchange, and
 * kept deliberately complete: it is the first worked business case anybody
 * sees before writing their own, so it has a window, milestones, the decision
 * it rests on, and a cash flow that actually computes.
 */
const ACME_RATING_PLAN: Transition = {
  id: 'tr-rating',
  number: 1,
  title: 'Retire the legacy rater',
  status: 'running',
  from: '2026-04-01',
  to: '2027-06-30',
  owner: 'Revenue systems',
  elements: [
    { elementId: 'legacy-rating', role: 'retires' },
    { elementId: 'tariff-engine', role: 'changes' },
    { elementId: 'billing', role: 'changes' },
  ],
  decisions: ['adr-one-price'],
  milestones: [
    { date: '2026-04-01', name: 'Tariff engine takes the first contract' },
    { date: '2026-10-01', name: 'All but two contracts moved' },
    { date: '2027-06-30', name: 'Legacy rater switched off' },
  ],
  body: [
    '## Goal',
    '',
    'One place where a price is decided. Two contracts still price in the legacy',
    'rater, and every change to them is made twice.',
    '',
    '## Approach',
    '',
    'Move contracts a few at a time. While both run, the tariff engine falls back',
    'to the legacy rater for whatever it cannot yet price — the line between them',
    'is dated and disappears when the last contract moves.',
    '',
    '## Business case',
    '',
    '```business-case',
    'currency: EUR',
    'discount rate: 10%',
    '',
    '| Line                  | Year 0  | Year 1 | Year 2 | Year 3 |',
    '| --------------------- | ------- | ------ | ------ | ------ |',
    '| Migration effort      | -95 000 | -40 000 |       |        |',
    '| Legacy licence saved  |         | 38 000 | 76 000 | 76 000 |',
    '| Pricing errors avoided |        | 15 000 | 30 000 | 30 000 |',
    '',
    '| Criterion               | Weight | Score |',
    '| ----------------------- | ------ | ----- |',
    '| Alignment with strategy | 3      | 4     |',
    '| Risk reduction          | 2      | 4     |',
    '```',
    '',
    '## Risks and rollback',
    '',
    'The two remaining contracts are the hardest and are deliberately last. Until',
    'the legacy rater is switched off, rolling a contract back is a configuration',
    'change rather than a release.',
  ].join('\n'),
}

/**
 * The plan behind Yard Management's go-live date: an introduction rather than
 * a retirement, so the roadmap shows both shapes. Its business case runs six
 * years wide on purpose — a table that only fits a wide window is what the
 * document sheet is for.
 */
const ACME_YARD_PLAN: Transition = {
  id: 'tr-yard',
  number: 2,
  title: 'Bring in yard management',
  status: 'agreed',
  from: '2026-06-01',
  to: '2027-03-31',
  owner: 'Warehouse operations',
  elements: [
    { elementId: 'yard', role: 'introduces' },
    { elementId: 'wms', role: 'changes' },
    { elementId: 'dispatch', role: 'changes' },
  ],
  decisions: ['adr-buy-yard'],
  milestones: [
    { date: '2026-06-01', name: 'Vendor contract signed' },
    { date: '2026-09-01', name: 'Pilot on two dock doors' },
    { date: '2026-11-02', name: 'Yard Management live for every dock' },
    { date: '2027-03-31', name: 'Dock booking removed from the warehouse system' },
  ],
  body: [
    '## Goal',
    '',
    'A truck that arrives is expected. [[Yard Management]] takes the gate, the',
    'yard and the dock doors, [[Dispatch]] announces arrivals to it, and',
    '[[Warehouse Management]] books a door through it instead of in a spreadsheet.',
    '',
    '## Approach',
    '',
    'Two dock doors first, for one carrier that arrives on a schedule. When the',
    'pilot holds for a month, every door follows on one day — a dock either is',
    'booked in the yard system or it is not. The warehouse system keeps its own',
    'booking screen for one more quarter as the fallback, then loses it.',
    '',
    '| Site      | Dock doors | Trucks per day | Detention fees, 2025 |',
    '| --------- | ---------- | -------------- | -------------------- |',
    '| Rotterdam | 24         | 310            | 168 000              |',
    '| Venlo     | 12         | 140            | 61 000               |',
    '| Antwerp   | 8          | 90             | 44 000               |',
    '',
    '## Business case',
    '',
    'Against the do-nothing reference: the spreadsheet, the phone and the fees.',
    '',
    '```business-case',
    'currency: EUR',
    'discount rate: 8%',
    '',
    '| Line                          | 2026     | 2027    | 2028    | 2029    | 2030    | 2031    |',
    '| ----------------------------- | -------- | ------- | ------- | ------- | ------- | ------- |',
    '| Licence and implementation    | -180 000 | -60 000 | -60 000 | -60 000 | -60 000 | -60 000 |',
    '| Integration with WMS and Dispatch | -70 000 | -15 000 |        |         |         |         |',
    '| Detention fees avoided        |          | 90 000  | 120 000 | 120 000 | 120 000 | 120 000 |',
    '| Extra loads per door per day  |          | 45 000  | 70 000  | 70 000  | 70 000  | 70 000  |',
    '| Yard staff overtime saved     |          | 20 000  | 25 000  | 25 000  | 25 000  | 25 000  |',
    '',
    '| Criterion               | Weight | Score |',
    '| ----------------------- | ------ | ----- |',
    '| Alignment with strategy | 3      | 3     |',
    '| Risk reduction          | 2      | 4     |',
    '| Customer impact         | 2      | 5     |',
    '```',
    '',
    '## Risks and rollback',
    '',
    'The pilot is the rollback: two doors go back to the spreadsheet in an hour.',
    'After the cut-over the spreadsheet is the rollback for a quarter, which is',
    'why the warehouse system keeps its screen until March.',
  ].join('\n'),
}

export const EXAMPLES: readonly ExampleProject[] = [
  {
    key: 'acme-logistics',
    ref: { group: 'acme-logistics', project: 'application-landscape' },
    groupName: 'Acme Logistics',
    label: 'Acme Logistics · application landscape',
    description: 'A parcel and pallet operator: order to delivery, the warehouse under it, and what it bills.',
    document: acmeLogistics as InterchangeDoc,
    transitions: [ACME_RATING_PLAN, ACME_YARD_PLAN],
    decisions: ACME_DECISIONS,
  },
]

export function exampleByKey(key: string): ExampleProject | undefined {
  return EXAMPLES.find((example) => example.key === key)
}
