/**
 * The two refusals a person can act on, and the one rule that keeps a folder
 * readable: the extension says what the bytes are, not what the file claimed.
 */
import { describe, expect, it } from 'vitest'
import {
  ImageError, MAX_IMAGE_BYTES, imageFileName, imageMediaType, isImageFile, readImageFile,
  takenImageFiles,
} from './documentImage'

const png = 'data:image/png;base64,AAAA'
const read = () => Promise.resolve(png)

describe('imageMediaType', () => {
  it('knows the formats a document may hold', () => {
    expect(imageMediaType('a.png')).toBe('image/png')
    expect(imageMediaType('a.jpg')).toBe('image/jpeg')
    expect(imageMediaType('a.jpeg')).toBe('image/jpeg')
    expect(imageMediaType('a.svg')).toBe('image/svg+xml')
    expect(imageMediaType('a.webp')).toBe('image/webp')
    expect(imageMediaType('A.PNG')).toBe('image/png')
  })

  it('does not claim one it cannot write', () => {
    expect(imageMediaType('a.gif')).toBeUndefined()
    expect(imageMediaType('notes.md')).toBeUndefined()
    expect(imageMediaType('README')).toBeUndefined()
    expect(isImageFile('a.gif')).toBe(false)
    expect(isImageFile('a.png')).toBe(true)
  })
})

describe('imageFileName', () => {
  it('slugs the name it arrived with', () => {
    expect(imageFileName('Cutover Routing.png', 'image/png', new Set())).toBe('cutover-routing.png')
  })

  it('takes the extension from the type, not from the name', () => {
    // A JPEG called `.png` written as `.png` is a file nothing can read back:
    // the extension is all the folder reader has to go on.
    expect(imageFileName('diagram.png', 'image/jpeg', new Set())).toBe('diagram.jpg')
  })

  it('does not collide with a name already taken', () => {
    const taken = new Set(['plan.png'])
    const next = imageFileName('plan.png', 'image/png', taken)
    expect(next).not.toBe('plan.png')
    expect(next.endsWith('.png')).toBe(true)
  })

  it('keeps two formats of one name apart', () => {
    // Claimed on the stem, so `plan.png` does not let `plan.jpg` through.
    expect(imageFileName('plan.jpg', 'image/jpeg', new Set(['plan.png']))).not.toBe('plan.jpg')
  })

  it('has something to call a file with no usable name', () => {
    expect(imageFileName('.png', 'image/png', new Set())).toBe('image.png')
  })
})

describe('readImageFile', () => {
  it('reads a file into an entry addressed by its name', async () => {
    const image = await readImageFile({ name: 'Cutover.png', type: 'image/png', size: 100 }, new Set(), read)
    expect(image).toEqual({ file: 'cutover.png', url: png })
  })

  it('refuses a format it cannot write, as a key', async () => {
    await expect(readImageFile({ name: 'a.gif', type: 'image/gif', size: 1 }, new Set(), read))
      .rejects.toMatchObject({ key: 'shell.imageBadType' })
  })

  it('refuses one that is too big, and says by how much', async () => {
    const error = await readImageFile(
      { name: 'a.png', type: 'image/png', size: MAX_IMAGE_BYTES + 1 }, new Set(), read,
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ImageError)
    expect((error as ImageError).key).toBe('shell.imageTooBig')
    expect((error as ImageError).params).toMatchObject({ max: 2048 })
  })

  it('treats a reader that returns something else as a read failure', async () => {
    await expect(readImageFile({ name: 'a.png', type: 'image/png', size: 1 }, new Set(), async () => 'blob:x'))
      .rejects.toMatchObject({ key: 'shell.imageUnreadable' })
    await expect(readImageFile({ name: 'a.png', type: 'image/png', size: 1 }, new Set(), () => Promise.reject(new Error('no'))))
      .rejects.toMatchObject({ key: 'shell.imageUnreadable' })
  })

  it('reads the names in use off a library', () => {
    expect(takenImageFiles([{ file: 'a.png', url: png }, { file: 'b.jpg', url: png }]))
      .toEqual(new Set(['a.png', 'b.jpg']))
  })
})
