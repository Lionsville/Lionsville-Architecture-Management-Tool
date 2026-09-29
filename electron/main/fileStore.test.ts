// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { chmod, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  fingerprint, listDirectory, makeDirectory, moveEntry, readFile as readInside, removeEntry, resolveInside, stampAt,
  safeRelativePath, writeFile as writeInside, writeTogether,
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
    expect(safeRelativePath('acme/landscape/scope.json')).toBeTruthy()
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
  it('resolves a path under the folder the user chose, and refuses one that leads out or is not there', async () => {
    await expect(resolveInside(root, 'acme/landscape')).resolves.toBe(join(root, 'acme/landscape'))
    // The folder belongs to the user and may contain a link to anywhere.
    // Without this, "write a file in the project" can write over anything.
    await symlink(outside, join(root, 'sideways'))
    await expect(resolveInside(root, 'sideways/secret.txt')).resolves.toBeUndefined()
    await expect(resolveInside(join(root, 'gone'), 'x')).resolves.toBeUndefined()
  })

})

describe('what the channel does with a folder', () => {
  it('writes, reads and lists', async () => {
    await writeInside(root, 'acme/landscape/scope.json', bytes('{}\n'))

    expect(text((await readInside(root, 'acme/landscape/scope.json'))?.bytes)).toBe('{}\n')
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

  /**
   * A file that is there and will not read was answered as one that is not
   * there, and a save removed it as no longer wanted (ADR-0028, amended). It
   * is a refusal now, by its code, with no path in it.
   */
  // A mode of 0 refuses a read only where modes are kept and nobody is root.
  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('refuses to read a file that is there and will not read, rather than calling it gone', async () => {
    await writeInside(root, 'acme/docs/crews.md', bytes('All about Crews.'))
    await chmod(join(root, 'acme/docs/crews.md'), 0o000)
    try {
      await expect(readInside(root, 'acme/docs/crews.md')).rejects.toThrow(/^NotReadableError: E[A-Z]+$/)
    } finally {
      await chmod(join(root, 'acme/docs/crews.md'), 0o644)
    }
    await expect(readInside(root, 'acme/docs')).resolves.toBeUndefined()
  })

  it('refuses to write outside, however the path is spelled', async () => {
    await expect(writeInside(root, '../private/theirs.json', bytes('x'))).rejects.toThrow()
    await expect(readFile(join(outside, 'theirs.json'), 'utf8')).rejects.toThrow()
  })

  it('leaves the previous file in place when a write is interrupted', async () => {
    // The temporary file is in the same directory and is renamed over the
    // target, so there is no moment at which the project is half-written.
    await writeInside(root, 'scope.json', bytes('the first one\n'))
    const half = writeInside(root, 'scope.json', bytes('the second one\n'))
    expect(text((await readInside(root, 'scope.json'))?.bytes)).toBe('the first one\n')
    await half
    expect(text((await readInside(root, 'scope.json'))?.bytes)).toBe('the second one\n')
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
    await writeInside(root, 'acme/landscape/scope.json', bytes('{}'))
    await removeEntry(root, 'acme/landscape/scope.json')
    expect(await listDirectory(root, 'acme/landscape')).toEqual([])

    await removeEntry(root, 'acme', { recursive: true })
    expect(await listDirectory(root, 'acme')).toBeUndefined()
  })

  it('never removes the folder the user chose', async () => {
    await writeInside(root, 'scope.json', bytes('{}'))
    await removeEntry(root, '', { recursive: true })
    expect(await listDirectory(root, '')).toEqual([{ name: 'scope.json', kind: 'file' }])
  })

  it('does not mind removing what is not there', async () => {
    await expect(removeEntry(root, 'nothing/here.json')).resolves.toBeUndefined()
  })
})

/**
 * A working file lands on the desktop as one call (ADR-0023, amendment 2):
 * staged beside every target first, then moved into place, so the renderer
 * going away part way cannot leave half an organisation.
 */
describe('a file looked at without reading it', () => {
  it('says its size, when it was written and its number on the disk, and nothing for a folder or what is not there', async () => {
    await writeFile(join(root, 'map.png'), 'abc')
    const stamp = await stampAt(root, 'map.png')
    expect(stamp?.size).toBe(3)
    expect(stamp?.inode).toBeGreaterThan(0)
    expect(stamp?.lastModified).toBeGreaterThan(0)
    await mkdir(join(root, 'acme'))
    expect(await stampAt(root, 'acme')).toBeUndefined()
    expect(await stampAt(root, 'none.png')).toBeUndefined()
    expect(await stampAt(root, '../escape')).toBeUndefined()
  })
})

describe('a folder moved as one rename', () => {
  it('moves everything in it, links and empty folders included, the folders on the way made', async () => {
    await mkdir(join(root, 'acme', 'empty'), { recursive: true })
    await writeFile(join(root, 'acme', 'model.json'), '{}')
    await symlink('model.json', join(root, 'acme', 'link.json'))
    await moveEntry(root, 'acme', 'globex/acme')
    expect((await readdir(join(root, 'globex', 'acme'))).sort()).toEqual(['empty', 'link.json', 'model.json'])
    expect(await readFile(join(root, 'globex', 'acme', 'link.json'), 'utf8')).toBe('{}')
    expect(await readdir(root)).toEqual(['globex'])
  })

  it('refuses to move a link, and moves neither it nor what it leads to', async () => {
    await mkdir(join(root, 'acme'), { recursive: true })
    await symlink(join(root, 'acme'), join(root, 'alias'))
    await expect(moveEntry(root, 'alias', 'moved')).rejects.toThrow('shell.pathRefused')
    expect((await readdir(root)).sort()).toEqual(['acme', 'alias'])
  })

  it('changes only the case of a name, where the disk does not tell case apart', async () => {
    await mkdir(join(root, 'acme'), { recursive: true })
    const blind = await readdir(join(root, 'ACME')).then(() => true, () => false)
    if (!blind) return
    await moveEntry(root, 'acme', 'Acme')
    expect(await readdir(root)).toEqual(['Acme'])
  })

  it('refuses a place that is taken, the root, a place inside itself, a way out and the history, and moves nothing', async () => {
    await mkdir(join(root, 'acme'), { recursive: true })
    await mkdir(join(root, 'globex'), { recursive: true })
    await mkdir(join(root, '.git'), { recursive: true })
    for (const [from, to] of [['acme', 'globex'], ['', 'elsewhere'], ['acme', 'acme/inside'], ['acme', '../out'], ['acme', '.git/acme'], ['.git', 'history']]) {
      await expect(moveEntry(root, from, to), `${from} → ${to}`).rejects.toThrow('shell.pathRefused')
    }
    expect((await readdir(root)).sort()).toEqual(['.git', 'acme', 'globex'])
  })
})

describe('the folder’s history', () => {
  const spellings = ['.git', '.GIT', '.Git', '.git.', '.git ', 'GIT~1']

  beforeEach(async () => {
    await mkdir(join(root, '.git', 'hooks'), { recursive: true })
    await writeFile(join(root, '.git', 'config'), '[core]\n')
  })

  it('is no path the channel takes, however it is spelled', () => {
    for (const name of spellings) {
      expect(safeRelativePath(name), name).toBeUndefined()
      expect(safeRelativePath(`${name}/hooks/pre-commit`), name).toBeUndefined()
    }
    expect(safeRelativePath('acme/.git-notes.md')).toBeTruthy()
    expect(safeRelativePath('.gitignore')).toBeTruthy()
  })

  it('is neither read, listed, written, made, fingerprinted nor removed', async () => {
    for (const name of spellings) {
      expect(await readInside(root, `${name}/config`), name).toBeUndefined()
      expect(await listDirectory(root, name), name).toBeUndefined()
      expect(await fingerprint(root, `${name}/config`), name).toBeUndefined()
      await expect(writeInside(root, `${name}/hooks/pre-commit`, bytes('#!/bin/sh')), name).rejects.toThrow('shell.pathRefused')
      await expect(makeDirectory(root, `${name}/objects`), name).rejects.toThrow('shell.pathRefused')
      await expect(writeTogether(root, [{ path: `${name}/config`, bytes: bytes('x') }], []), name).rejects.toThrow('shell.pathRefused')
      await expect(writeTogether(root, [], [`${name}/config`]), name).rejects.toThrow('shell.pathRefused')
      await removeEntry(root, `${name}/config`)
      await removeEntry(root, name, { recursive: true })
    }
    expect(await readFile(join(root, '.git', 'config'), 'utf8')).toBe('[core]\n')
    expect(await readdir(join(root, '.git', 'hooks'))).toEqual([])
  })

  it('is refused through a link that leads into it', async () => {
    await symlink(join(root, '.git'), join(root, 'history'))
    expect(await readInside(root, 'history/config')).toBeUndefined()
    await expect(writeInside(root, 'history/hooks/pre-commit', bytes('#!/bin/sh'))).rejects.toThrow('shell.pathRefused')
    expect(await readdir(join(root, '.git', 'hooks'))).toEqual([])
  })
})

describe('several files written as one', () => {
  /** Every file under the root, relative, sorted: what a person would find. */
  async function everything(at = root, within = ''): Promise<string[]> {
    const found: string[] = []
    for (const entry of await readdir(at, { withFileTypes: true })) {
      const path = within ? `${within}/${entry.name}` : entry.name
      if (entry.isDirectory()) found.push(...await everything(join(at, entry.name), path))
      else found.push(path)
    }
    return found.sort()
  }

  it('writes every file and makes every removal, and answers each write its stamp', async () => {
    await writeInside(root, 'acme/old.json', bytes('old'))
    await writeInside(root, 'model.json', bytes('before'))
    const stamps = await writeTogether(root, [
      { path: 'model.json', bytes: bytes('after') },
      { path: 'acme/north/team/model.json', bytes: bytes('team') },
    ], ['acme/old.json'])

    expect(await everything()).toEqual(['acme/north/team/model.json', 'model.json'])
    expect(await readFile(join(root, 'model.json'), 'utf8')).toBe('after')
    expect(stamps.map((stamp) => stamp.size)).toEqual([5, 4])
  })

  it('leaves the folder as it was when one file cannot be staged', async () => {
    await writeInside(root, 'model.json', bytes('before'))
    await writeInside(root, 'acme', bytes('a file where a folder would have to be'))
    await expect(writeTogether(root, [
      { path: 'model.json', bytes: bytes('after') },
      { path: 'acme/team/model.json', bytes: bytes('team') },
    ], [])).rejects.toThrow()

    expect(await everything()).toEqual(['acme', 'model.json'])
    expect(await readFile(join(root, 'model.json'), 'utf8')).toBe('before')
  })

  it('writes nothing at all when one path leads out', async () => {
    await expect(writeTogether(root, [
      { path: 'model.json', bytes: bytes('after') },
      { path: '../private/stolen', bytes: bytes('x') },
    ], [])).rejects.toThrow('shell.pathRefused')
    await expect(writeTogether(root, [{ path: 'model.json', bytes: bytes('after') }], ['..'])).rejects.toThrow('shell.pathRefused')

    expect(await everything()).toEqual([])
    expect(await readdir(outside)).toEqual([])
  })
})
