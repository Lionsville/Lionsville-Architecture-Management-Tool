/**
 * The two refusals a person can act on, and the one rule that keeps a folder
 * readable: the extension says what the bytes are, not what the file claimed.
 */
import { describe, expect, it } from 'vitest'
import {
  ImageError, MAX_IMAGE_BYTES, imageFileName, imageId, imageMediaType, isImageFile, readImageFile,
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
  const id = 'k1'

  it('slugs the name it arrived with, and stamps it with the id', () => {
    expect(imageFileName('Cutover Routing.png', 'image/png', new Set(), id)).toBe('cutover-routing-k1.png')
  })

  it('takes the extension from the type, not from the name', () => {
    // A JPEG called `.png` written as `.png` is a file nothing can read back:
    // the extension is all the folder reader has to go on.
    expect(imageFileName('diagram.png', 'image/jpeg', new Set(), id)).toBe('diagram-k1.jpg')
  })

  it('mints a different id for a different moment, so two machines do not collide', () => {
    // Two people adding `slide1.png` each on their own machine share no
    // library to claim against; the moment in the name is what keeps a sync
    // from keeping one picture under the other's name.
    const a = imageFileName('slide1.png', 'image/png', new Set(), imageId(1_000_000))
    const b = imageFileName('slide1.png', 'image/png', new Set(), imageId(1_000_001))
    expect(a).not.toBe(b)
    expect(a).toMatch(/^slide1-[0-9a-z]+\.png$/)
  })

  it('still does not collide with a name already taken', () => {
    const taken = new Set(['plan-k1.png'])
    const next = imageFileName('plan.png', 'image/png', taken, id)
    expect(next).not.toBe('plan-k1.png')
    expect(next.endsWith('.png')).toBe(true)
  })

  it('keeps two formats of one name apart', () => {
    // Claimed on the stem, so `plan.png` does not let `plan.jpg` through.
    expect(imageFileName('plan.jpg', 'image/jpeg', new Set(['plan-k1.png']), id)).not.toBe('plan-k1.jpg')
  })

  it('cuts a slide title down to something a folder listing can show', () => {
    const long = 'Target state architecture after the warehouse consolidation programme, phase two.png'
    const file = imageFileName(long, 'image/png', new Set(), id)
    expect(file.length).toBeLessThanOrEqual(40 + 1 + id.length + 4)
    expect(file).toMatch(/^target-state-architecture-after-the-ware-k1\.png$/)
  })

  it('has something to call a file with no usable name', () => {
    expect(imageFileName('.png', 'image/png', new Set(), id)).toBe('image-k1.png')
  })

  it('mints the id from the moment, in base 36', () => {
    expect(imageId(0)).toBe('0')
    expect(imageId(36)).toBe('10')
    expect(imageId()).toMatch(/^[0-9a-z]+$/)
  })
})

describe('readImageFile', () => {
  it('reads a file into an entry addressed by its name', async () => {
    const image = await readImageFile({ name: 'Cutover.png', type: 'image/png', size: 100 }, new Set(), read)
    expect(image.url).toBe(png)
    expect(image.file).toMatch(/^cutover-[0-9a-z]+\.png$/)
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
