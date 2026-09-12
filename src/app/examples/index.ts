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
 *
 * **An example is a project folder, not an interchange document.** It was the
 * latter until format 4, and the interchange is a contract with other tools
 * that knows nothing about the business layer, plans or decisions — which is
 * why the plans and the decisions had to ride beside the document in this file,
 * in TypeScript, as a second mechanism. The working form has a place for all of
 * it, so there is one mechanism and the example is the thing the tool writes.
 *
 * The file is the folder's files, by path: an object per `.json` and an array
 * of lines per `.md`. Not the text of each file as one string, because a JSON
 * blob with a landscape escaped inside it is a file nobody can read or review;
 * not a zipped `.lvarch` either, because that is bytes, and a shipped example
 * should be the most readable thing in this directory. One `import` of one JSON
 * file, no build-tool features, and the reader is the format's own.
 */
import { stableJson } from '../../projects/fileText'
import { projectFromFolder } from '../../projects/folderFormat'
import type { FolderFile } from '../../projects/folderFormat'
import type { ProjectSnapshot } from '../../projects/project'
import type { ProjectRef } from '../../projects/projectRef'
import acmeLogistics from './acme-logistics.json'

/**
 * A project folder, as JSON: an object for each `.json` file it holds, and the
 * lines of each `.md` file.
 */
export type ExampleFolder = Record<string, unknown>

export type ExampleProject = {
  /** Stable key, for the picker and for tests. */
  key: string
  /** Where a copy lands. The user may be offered a different group later. */
  ref: ProjectRef
  /** What the picker calls it. */
  label: string
  /** One line on what it shows. */
  description: string
  /** The project, as the files the format writes. */
  folder: ExampleFolder
}

/**
 * The example's folder, as the files a reader of the format expects.
 *
 * Through {@link stableJson}, which is what the format writes with, so an
 * example edited by hand is read exactly as one saved by the app — the key
 * order in the shipped file is nobody's business but the reviewer's.
 */
export function exampleFiles(example: ExampleProject): FolderFile[] {
  return Object.entries(example.folder).map(([path, held]) => ({
    path,
    text: Array.isArray(held) ? (held as string[]).join('\n') : stableJson(held),
  }))
}

/**
 * The example as a project of one's own, filed where the entry says.
 *
 * `undefined` would mean a shipped example this build cannot read, which
 * `examples.test.ts` is there to make impossible.
 */
export function exampleProject(example: ExampleProject): ProjectSnapshot | undefined {
  return projectFromFolder(exampleFiles(example), example.ref)
}

export const EXAMPLES: readonly ExampleProject[] = [
  {
    key: 'acme-logistics',
    ref: { group: 'acme-logistics', project: 'application-landscape' },
    label: 'Acme Logistics · application landscape',
    description: 'A parcel and pallet operator: order to delivery, the warehouse under it, and what it bills.',
    folder: acmeLogistics,
  },
]

export function exampleByKey(key: string): ExampleProject | undefined {
  return EXAMPLES.find((example) => example.key === key)
}
