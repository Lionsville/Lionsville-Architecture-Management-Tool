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
}

/**
 * The plan behind the dates on Rating (legacy) and the Tariff Engine.
 *
 * Written out here rather than in the JSON because it is not interchange, and
 * kept deliberately complete: it is the only worked business case anybody sees
 * before writing their own, so it has a window, milestones, the decision it
 * rests on, and a cash flow that actually computes.
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
  decisions: [],
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

export const EXAMPLES: readonly ExampleProject[] = [
  {
    key: 'acme-logistics',
    ref: { group: 'acme-logistics', project: 'application-landscape' },
    groupName: 'Acme Logistics',
    label: 'Acme Logistics · application landscape',
    description: 'A parcel and pallet operator: order to delivery, the warehouse under it, and what it bills.',
    document: acmeLogistics as InterchangeDoc,
    transitions: [ACME_RATING_PLAN],
  },
]

export function exampleByKey(key: string): ExampleProject | undefined {
  return EXAMPLES.find((example) => example.key === key)
}
