// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The example organisations that ship with the app.
 *
 * **Fictional, and that is a rule rather than a preference.** A real customer's
 * landscape used to ship here — it was once "the shipped document", loaded at
 * boot. In a tool handed to other organisations that means every installer
 * carries one client's architecture to everybody else, and the first screen a
 * new user sees is somebody else's business. Whatever ships here is invented.
 *
 * An example is one entry in a catalogue. Opening one copies it into scopes of
 * the person's own, under the path the entry names; from that moment they are
 * theirs and nothing here is involved again. Adding one is a JSON file, an
 * entry in `offers.ts` and a line below.
 *
 * It has to be *good*, too. It is the first thing anyone opens, and a thin
 * example makes the tool look thin — so the shipped one is a landscape with
 * enough shape to show what the editor is for: every zone populated, domain
 * groups, aspects that are not all green, a system that is visibly on its way
 * out, and a container view under one of the applications.
 *
 * Examples are data, not configuration: the path is where a copy lands by
 * default, not a statement about who runs this app.

 * **An example is a tree.** Since format 5 the shipped one is two scopes — the
 * organisation, which carries its name and what it is, and the landscape under
 * it, which carries the model. The model is NOT split between them: every
 * `supports` and `assigned` row joining a capability to an application would
 * then dangle at one end, and the stand-ins that make a cross-scope id resolve
 * are ADR-0012 §2's, which is beta 3. So the split here is the one that costs
 * nothing: a name above a document.
 *
 * **An example is a project folder.** It was an interchange document until
 * format 4, and that format knew nothing about the business layer, plans or
 * decisions — which is why the plans and the decisions had to ride beside the
 * document in this file, in TypeScript, as a second mechanism. The working form
 * has a place for all of it, so there is one mechanism and the example is the
 * thing the tool writes. The document itself went with ADR-0018.
 *
 * The file is the folder's files, by path: an object per `.json` and an array
 * of lines per `.md`. Not the text of each file as one string, because a JSON
 * blob with a landscape escaped inside it is a file nobody can read or review;
 * not a zipped `.lvarch` either, because that is bytes, and a shipped example
 * should be the most readable thing in this directory. One `import` of one JSON
 * file, no build-tool features, and the reader is the format's own.
 */
import acmeLogistics from './acme-logistics.json'
import type { ExampleFolder, ExampleProject } from './copy'
import { EXAMPLE_OFFERS } from './offers'

export * from './copy'
export * from './offers'

/** The folder of each example on offer, in hand: for the suites, and for anything that cannot wait for one. */
const FOLDERS: Readonly<Record<string, ExampleFolder>> = { 'acme-logistics': acmeLogistics }

export const EXAMPLES: readonly ExampleProject[] = EXAMPLE_OFFERS.map((offer) => ({
  key: offer.key, path: offer.path, label: offer.label, description: offer.description, folder: FOLDERS[offer.key],
}))

export function exampleByKey(key: string): ExampleProject | undefined {
  return EXAMPLES.find((example) => example.key === key)
}
