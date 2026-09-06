/**
 * The main process's hands, against a real temporary folder.
 *
 * This is the security of the file channel and therefore the security of the
 * desktop app: the renderer is where somebody else's document is opened, and
 * every path it sends is a string an attacker may have chosen. The escape tests
 * below are the point of the file; the atomic write is the other half, because
 * a save interrupted by a crash must leave the previous project rather than
 * half of the new one.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  fingerprint, listDirectory, makeDirectory, readFile as readInside, removeEntry, resolveInside,
  safeRelativePath, writeFile as writeInside,
} from './fileStore'

let root = ''
let outside = ''

beforeEach(async () => {
  // Resolved, because macOS puts the temporary directory behind a symlink and
  // everything below answers in real paths — as it must, that being the check.
  const base = await realpath(await mkdtemp(join(tmpdir(), 'lvarch-')))
  root = join(base, 'working')
  outside = join(base, 'private')
  await mkdir(root)
  await mkdir(outside)
})

afterEach(async () => {
  await rm(join(root, '..'), { recursive: true, force: true })
})

const bytes = (text: string) => new TextEncoder().encode(text)
const text = (held: Uint8Array | undefined) => held && new TextDecoder().decode(held)

describe('safeRelativePath', () => {
  it('takes a path that is only ever a path inside something', () => {
    expect(safeRelativePath('acme/landscape/project.json')).toBeTruthy()
    expect(safeRelativePath('')).toBe('')
  })

  it('refuses everything that could leave', () => {
    // Refused rather than sanitised: a path with `..` in it is not one somebody
    // typed slightly wrong, and rewriting it is how a check becomes a bypass.
    for (const path of [
      '../escape', 'acme/../../escape', '/etc/passwd', 'C:\\Windows', 'acme//landscape',
      'acme/./landscape', 'acme/\0/landscape', '..',
    ]) {
      expect(safeRelativePath(path), path).toBeUndefined()
    }
  })
})

describe('resolveInside', () => {
  it('resolves a path under the folder the user chose', async () => {
    await expect(resolveInside(root, 'acme/landscape')).resolves.toBe(join(root, 'acme/landscape'))
  })

  it('refuses a symlink that leads out of it', async () => {
    // The folder belongs to the user and may contain a link to anywhere.
    // Without this, "write a file in the project" can write over anything.
    await symlink(outside, join(root, 'sideways'))
    await expect(resolveInside(root, 'sideways/secret.txt')).resolves.toBeUndefined()
  })

  it('refuses a folder that is not there at all', async () => {
    await expect(resolveInside(join(root, 'gone'), 'x')).resolves.toBeUndefined()
  })
})

describe('what the channel does with a folder', () => {
  it('writes, reads and lists', async () => {
    await writeInside(root, 'acme/landscape/project.json', bytes('{}\n'))

    expect(text((await readInside(root, 'acme/landscape/project.json'))?.bytes)).toBe('{}\n')
    expect(await listDirectory(root, 'acme')).toEqual([{ name: 'landscape', kind: 'directory' }])
  })

  it('makes the folders on the way to a file', async () => {
    await writeInside(root, 'a/b/c/one.md', bytes('hello'))
    expect(await listDirectory(root, 'a/b/c')).toEqual([{ name: 'one.md', kind: 'file' }])
  })

  it('answers nothing for what is not there, rather than throwing', async () => {
    await expect(readInside(root, 'nowhere.json')).resolves.toBeUndefined()
    await expect(listDirectory(root, 'nowhere')).resolves.toBeUndefined()
    await expect(fingerprint(root, 'nowhere.json')).resolves.toBeUndefined()
  })

  it('refuses to write outside, however the path is spelled', async () => {
    await expect(writeInside(root, '../private/theirs.json', bytes('x'))).rejects.toThrow()
    await expect(readFile(join(outside, 'theirs.json'), 'utf8')).rejects.toThrow()
  })

  it('leaves the previous file in place when a write is interrupted', async () => {
    // The temporary file is in the same directory and is renamed over the
    // target, so there is no moment at which the project is half-written.
    await writeInside(root, 'project.json', bytes('the first one\n'))
    const half = writeInside(root, 'project.json', bytes('the second one\n'))
    expect(text((await readInside(root, 'project.json'))?.bytes)).toBe('the first one\n')
    await half
    expect(text((await readInside(root, 'project.json'))?.bytes)).toBe('the second one\n')
  })

  it('leaves nothing behind when a write fails', async () => {
    // A directory where the file should be: the write cannot land, and the
    // temporary file must not stay.
    await makeDirectory(root, 'blocked.json')
    await expect(writeInside(root, 'blocked.json', bytes('x'))).rejects.toThrow()
    expect((await listDirectory(root, ''))?.map((e) => e.name)).toEqual(['blocked.json'])
  })

  it('fingerprints what is on disk, and notices a change of one byte', async () => {
    const first = await writeInside(root, 'model.json', bytes('{"a":1}'))
    expect(await fingerprint(root, 'model.json')).toEqual(first)

    await writeFile(join(root, 'model.json'), '{"a":2}')
    expect((await fingerprint(root, 'model.json'))?.sha256).not.toBe(first.sha256)
  })

  it('removes a file, and a folder only when asked recursively', async () => {
    await writeInside(root, 'group/landscape/project.json', bytes('{}'))
    await removeEntry(root, 'group/landscape/project.json')
    expect(await listDirectory(root, 'group/landscape')).toEqual([])

    await removeEntry(root, 'group', { recursive: true })
    expect(await listDirectory(root, 'group')).toBeUndefined()
  })

  it('never removes the folder the user chose', async () => {
    await writeInside(root, 'project.json', bytes('{}'))
    await removeEntry(root, '', { recursive: true })
    expect(await listDirectory(root, '')).toEqual([{ name: 'project.json', kind: 'file' }])
  })

  it('does not mind removing what is not there', async () => {
    await expect(removeEntry(root, 'nothing/here.json')).resolves.toBeUndefined()
  })
})
