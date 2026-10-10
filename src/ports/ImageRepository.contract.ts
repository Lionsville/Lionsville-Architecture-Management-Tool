// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every image repository must do — written once, run by all of them.
 *
 * The bytes and the library are two acts, and these clauses hold them apart:
 * bytes put are named by what they are and belong to no library, the step
 * that adds an entry is what makes a name answer, and an image folder is
 * listed and a name found without the library being handed over whole.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import { imageMediaType } from '../model/documentImage'
import { contentAddressOf } from '../model/imageName'
import type { ImageEntry, ImageName } from '../model/imageName'
import type { ScopeId } from '../projects/scopeState'
import { ok, over, refusal, step } from './Repositories.contract'
import type { MakeRepositories, Over } from './Repositories.contract'

/** A few bytes that stand for a picture: what is kept is the bytes, not whether they draw. */
function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values)
}

/** Put a picture's bytes and add it to the library under its name, as a page adding one does. */
async function add(repositories: Over, scope: ScopeId, name: ImageName, held: Uint8Array): Promise<ImageEntry> {
  const put = await repositories.images.put(scope, name, held)
  if ('refused' in put) throw new Error(`refused: ${put.refused}`)
  const entry: ImageEntry = {
    name, mediaType: imageMediaType(name) ?? '', size: held.length, width: 640, height: 480, contentAddress: put.contentAddress,
  }
  await repositories.steps(scope, { type: 'image.add', image: entry })
  return entry
}

export function describeImageRepository(name: string, make: MakeRepositories): void {
  describe(`ImageRepository contract — ${name}`, () => {
    const fresh = async () => {
      const repositories = over(await make())
      return { repositories, acme: await repositories.scope('acme', 'Acme Logistics') }
    }

    it('names itself', async () => {
      const { repositories } = await fresh()
      expect(repositories.images.id).toMatch(/\S/)
    })

    it('keeps bytes under their content address: the same bytes one address, other bytes another', async () => {
      const { repositories, acme } = await fresh()
      const one = ok(await repositories.images.put(acme, 'context.png', bytes(1, 2, 3)))
      expect(one.contentAddress).toBe(await contentAddressOf(bytes(1, 2, 3)))
      expect(ok(await repositories.images.put(acme, 'again.png', bytes(1, 2, 3)))).toEqual(one)
      expect(ok(await repositories.images.put(acme, 'other.png', bytes(1, 2, 4))).contentAddress).not.toBe(one.contentAddress)
    })

    it('refuses bytes under a name no picture may have', async () => {
      const { repositories, acme } = await fresh()
      expect(refusal(await repositories.images.put(acme, '../escape.png', bytes(1)))).toBe('shell.imageBadName')
      expect(refusal(await repositories.images.put(acme, 'animation.gif', bytes(1)))).toBe('shell.imageBadType')
    })

    it('refuses bytes for a scope that is not there, or was removed', async () => {
      const { repositories, acme } = await fresh()
      expect(refusal(await repositories.images.put('no such scope', 'context.png', bytes(1)))).toBe('shell.scopeGone')
      ok(await repositories.remove(acme))
      expect(refusal(await repositories.images.put(acme, 'context.png', bytes(1)))).toBe('shell.scopeGone')
    })

    it('answers bytes by content address, named or not', async () => {
      const { repositories, acme } = await fresh()
      const put = ok(await repositories.images.put(acme, 'context.png', bytes(1, 2, 3)))
      const held = await repositories.images.bytesAt(acme, put.contentAddress)
      expect(held?.bytes).toEqual(bytes(1, 2, 3))
      expect(held?.mediaType).toMatch(/\S/)
      expect(await repositories.images.bytes(acme, 'context.png')).toBeUndefined()
      expect(await repositories.images.bytesAt(acme, await contentAddressOf(bytes(9, 9)))).toBeUndefined()
      const answered = held!
      answered.bytes[0] = 9
      expect((await repositories.images.bytesAt(acme, put.contentAddress))?.bytes).toEqual(bytes(1, 2, 3))
    })

    it('answers nothing by name for bytes put and never added to the library', async () => {
      const { repositories, acme } = await fresh()
      ok(await repositories.images.put(acme, 'context.png', bytes(1, 2, 3)))
      expect(await repositories.images.bytes(acme, 'context.png')).toBeUndefined()
      expect(await repositories.images.find(acme, 'context.png')).toBeUndefined()
    })

    it('answers a picture added to the library: its entry, its bytes and its media type, by name', async () => {
      const { repositories, acme } = await fresh()
      const entry = await add(repositories, acme, 'diagrams/context.png', bytes(1, 2, 3))
      expect(await repositories.images.find(acme, 'diagrams/context.png')).toEqual(entry)
      expect(await repositories.images.bytes(acme, 'diagrams/context.png')).toEqual({ mediaType: 'image/png', bytes: bytes(1, 2, 3) })
      expect((await repositories.state(acme)).images).toEqual([entry])
    })

    it('answers each name the media type of its own entry, where two names hold the same bytes', async () => {
      const { repositories, acme } = await fresh()
      await add(repositories, acme, 'a.png', bytes(1, 2, 3))
      await add(repositories, acme, 'b.jpg', bytes(1, 2, 3))
      expect(await repositories.images.bytes(acme, 'a.png')).toEqual({ mediaType: 'image/png', bytes: bytes(1, 2, 3) })
      expect(await repositories.images.bytes(acme, 'b.jpg')).toEqual({ mediaType: 'image/jpeg', bytes: bytes(1, 2, 3) })
    })

    it('refuses an entry that does not describe its picture, and one named like another in another case', async () => {
      const { repositories, acme } = await fresh()
      const entry = await add(repositories, acme, 'Context.png', bytes(1, 2, 3))
      for (const [image, key] of [
        [{ ...entry, name: 'other.png', mediaType: 'image/webp' }, 'shell.imageBadEntry'],
        [{ ...entry, name: 'other.png', contentAddress: 'sha256:nothex' }, 'shell.imageBadEntry'],
        [{ ...entry, name: 'other.png', width: -1 }, 'shell.imageBadEntry'],
        [{ ...entry, name: 'context.PNG' }, 'command.taken'],
      ] as const) {
        expect(refusal(await repositories.apply([{ scope: acme, steps: [step({ type: 'image.add', image })] }])), image.name)
          .toBe(key)
      }
      expect((await repositories.images.list(acme, '')).images).toEqual([entry])
    })

    it('refuses an entry whose bytes it does not keep for the scope, and a second name for bytes it does is added', async () => {
      const { repositories, acme } = await fresh()
      const kept = await add(repositories, acme, 'kept.png', bytes(1, 2, 3))
      const elsewhere = await repositories.scope('globex', 'Globex')
      const put = ok(await repositories.images.put(elsewhere, 'other.png', bytes(9, 9)))
      const unput = await contentAddressOf(bytes(7, 7))
      for (const contentAddress of [put.contentAddress, unput]) {
        const never: ImageEntry = { name: 'never.png', mediaType: 'image/png', size: 2, width: 1, height: 1, contentAddress }
        const naming = step({ type: 'image.add', image: never })
        const answer = await repositories.apply([{ scope: acme, steps: [step({ type: 'image.remove', name: 'kept.png' }), naming] }])
        expect(answer).toEqual({ refused: 'shell.imageBytesGone', scope: acme, stepId: naming.stepId })
      }
      expect((await repositories.images.list(acme, '')).images).toEqual([kept])
      const again = { ...kept, name: 'again.png' }
      await repositories.steps(acme, { type: 'image.add', image: again })
      expect(await repositories.images.bytes(acme, 'again.png')).toEqual({ mediaType: 'image/png', bytes: bytes(1, 2, 3) })
    })

    it('hands out bytes nobody else holds: changing them changes nothing it keeps', async () => {
      const { repositories, acme } = await fresh()
      await add(repositories, acme, 'context.png', bytes(1, 2, 3))
      const answered = await repositories.images.bytes(acme, 'context.png')
      answered!.bytes[0] = 9
      expect((await repositories.images.bytes(acme, 'context.png'))?.bytes).toEqual(bytes(1, 2, 3))
    })

    it('lists one image folder: the pictures directly in it and the image folders directly under it, by name', async () => {
      const { repositories, acme } = await fresh()
      const top = await add(repositories, acme, 'top.png', bytes(1))
      const b = await add(repositories, acme, 'diagrams/b.png', bytes(2))
      const a = await add(repositories, acme, 'diagrams/a.jpg', bytes(3))
      await add(repositories, acme, 'diagrams/2025/old.png', bytes(4))
      await add(repositories, acme, 'photos/2026/whiteboard.webp', bytes(5))
      expect(await repositories.images.list(acme, '')).toEqual({ images: [top], imageFolders: ['diagrams', 'photos'] })
      expect(await repositories.images.list(acme, 'diagrams')).toEqual({ images: [a, b], imageFolders: ['diagrams/2025'] })
      expect(await repositories.images.list(acme, 'photos')).toEqual({ images: [], imageFolders: ['photos/2026'] })
      expect(await repositories.images.list(acme, 'nowhere')).toEqual({ images: [], imageFolders: [] })
    })

    it('takes a picture out of the library by a step, after which its name answers nothing', async () => {
      const { repositories, acme } = await fresh()
      await add(repositories, acme, 'context.png', bytes(1, 2, 3))
      await repositories.steps(acme, { type: 'image.remove', name: 'context.png' })
      expect(await repositories.images.find(acme, 'context.png')).toBeUndefined()
      expect(await repositories.images.bytes(acme, 'context.png')).toBeUndefined()
      expect(await repositories.images.list(acme, '')).toEqual({ images: [], imageFolders: [] })
    })

    it('keeps a name to one picture: a second under it is refused and the first stays', async () => {
      const { repositories, acme } = await fresh()
      const first = await add(repositories, acme, 'context.png', bytes(1, 2, 3))
      const put = ok(await repositories.images.put(acme, 'context.png', bytes(7, 7)))
      const second: ImageEntry = { ...first, size: 2, contentAddress: put.contentAddress }
      expect(refusal(await repositories.apply([{ scope: acme, steps: [step({ type: 'image.add', image: second })] }]))).toBe('command.taken')
      expect(await repositories.images.bytes(acme, 'context.png')).toEqual({ mediaType: 'image/png', bytes: bytes(1, 2, 3) })
    })

    it('keeps two scopes’ libraries apart, one name in each', async () => {
      const { repositories, acme } = await fresh()
      const globex = await repositories.scope('globex', 'Globex')
      await add(repositories, acme, 'context.png', bytes(1))
      await add(repositories, globex, 'context.png', bytes(2))
      expect((await repositories.images.bytes(acme, 'context.png'))?.bytes).toEqual(bytes(1))
      expect((await repositories.images.bytes(globex, 'context.png'))?.bytes).toEqual(bytes(2))
    })

    it('keeps the libraries of the scopes under a moved one', async () => {
      const { repositories } = await fresh()
      const rail = await repositories.scope('acme/rail', 'Rail')
      const stock = await repositories.scope('acme/rail/rolling-stock', 'Rolling stock')
      const entry = await add(repositories, stock, 'wagons.png', bytes(4, 5, 6))
      ok(await repositories.move(rail, 'globex/rail'))
      expect(await repositories.images.find(stock, 'wagons.png')).toEqual(entry)
      expect((await repositories.images.bytes(stock, 'wagons.png'))?.bytes).toEqual(bytes(4, 5, 6))
      expect((await repositories.state(stock)).images).toEqual([entry])
    })

    it('starts a scope created where a removed one was with an empty library, its own and its children’s', async () => {
      const { repositories, acme } = await fresh()
      const rail = await repositories.scope('acme/rail', 'Rail')
      await add(repositories, acme, 'context.png', bytes(1, 2, 3))
      await add(repositories, rail, 'wagons.png', bytes(4, 5, 6))
      ok(await repositories.remove(acme))
      const again = await repositories.scope('acme/rail', 'Rail again')
      const above = await repositories.scopeAt('acme')
      for (const scope of [again, above]) {
        expect(await repositories.images.list(scope, '')).toEqual({ images: [], imageFolders: [] })
        expect((await repositories.state(scope)).images).toEqual([])
      }
      expect(await repositories.images.bytes(again, 'wagons.png')).toBeUndefined()
      expect(await repositories.images.bytes(above, 'context.png')).toBeUndefined()
    })

    it('keeps a scope’s library through a move, because it follows the identity', async () => {
      const { repositories, acme } = await fresh()
      const entry = await add(repositories, acme, 'diagrams/context.png', bytes(1, 2, 3))
      ok(await repositories.move(acme, 'globex/acme'))
      expect(await repositories.images.find(acme, 'diagrams/context.png')).toEqual(entry)
      expect((await repositories.images.bytes(acme, 'diagrams/context.png'))?.bytes).toEqual(bytes(1, 2, 3))
    })
  })
}
