// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An organisation to carry out and bring in: the shipped example — every
 * kind of record there is, in two scopes — with a picture a description
 * shows, and a domain of its own with a picture in it too, and one filed in
 * an image folder. Put into
 * repositories through the domain's own landing, so a test of the working
 * file does not start from the working file.
 */
import acmeLogistics from '../examples/acme-logistics.json' with { type: 'json' }
import { exampleScopes } from '../exampleFolder'
import type { ExampleFolder } from '../exampleFolder'
import { dataUrl } from '../../../../projects/dataUrl'
import type { ScopeSnapshot } from '../../../../projects/scope'
import { contentOf, picturesOf, placeTogether } from '../../../../projects/scopeAccess'
import type { Repositories } from '../../../../ports/Repositories'

/** A PNG header that says 2 × 1, and a tail that makes each picture its own bytes. */
export function png(tail: number): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2, 0, 0, 0, 1,
    8, 6, 0, 0, 0, tail,
  ])
}

/** The organisation, its landscape with a picture its first described element shows, and a domain with one of its own. */
export function organisation(): ScopeSnapshot[] {
  const [root, landscape] = exampleScopes(acmeLogistics as ExampleFolder, '')
  const [first, ...others] = landscape.model.elements
  const shown = { ...first, description: `${first.description ?? ''}\n\n![The depot](image:depot.png)\n` }
  return [
    root,
    {
      ...landscape,
      model: { ...landscape.model, elements: [shown, ...others] },
      imageLibrary: [{ file: 'depot.png', url: dataUrl('image/png', png(1)) }],
    },
    {
      path: 'depots',
      kind: 'domain',
      model: { name: 'Depots', description: 'Where the trucks sleep.', elements: [], relations: [], diagrams: [] },
      activeDiagramId: '',
      logoLibrary: [],
      imageLibrary: [
        { file: 'yard.png', url: dataUrl('image/png', png(2)) },
        { file: 'diagrams/ctx.png', url: dataUrl('image/png', png(3)) },
      ],
    },
  ]
}

/** The organisation, landed in these repositories as a content that arrives whole. */
export async function seed(repositories: Pick<Repositories, 'scopes' | 'images'>, scopes = organisation()): Promise<void> {
  await placeTogether(repositories, scopes.map((scope) => ({
    address: scope.path, content: contentOf(scope, []), pictures: picturesOf(scope.imageLibrary),
  })))
}
