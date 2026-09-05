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
import type { InterchangeDoc } from '../core/model/fromInterchange'
import type { ProjectRef } from '../core/projectRef'
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
}

export const EXAMPLES: readonly ExampleProject[] = [
  {
    key: 'acme-logistics',
    ref: { group: 'acme-logistics', project: 'application-landscape' },
    groupName: 'Acme Logistics',
    label: 'Acme Logistics · application landscape',
    description: 'A parcel and pallet operator: order to delivery, the warehouse under it, and what it bills.',
    document: acmeLogistics as InterchangeDoc,
  },
]

export function exampleByKey(key: string): ExampleProject | undefined {
  return EXAMPLES.find((example) => example.key === key)
}
