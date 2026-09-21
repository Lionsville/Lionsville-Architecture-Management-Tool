/**
 * The small-secrets store, against a real temporary folder.
 *
 * The mode is the point of the file. A store that round-trips a string and
 * leaves it world-readable has kept nothing, so the cases below assert 0600 on
 * a file this process created and on one it found — the second being the one a
 * write-then-chmod would get wrong.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileSecrets } from './secrets'

let directory = ''
let path = ''

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'lvarch-secrets-'))
  path = join(directory, 'secrets.json')
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

/** The permission bits, without the file-type bits above them. */
async function mode(of: string): Promise<number> {
  return (await stat(of)).mode & 0o777
}

describe('the small-secrets store', () => {
  it('answers undefined for a name it has never been given', async () => {
    expect(await fileSecrets(path).read('nothing')).toBeUndefined()
  })

  it('keeps a value and reads it back, through a second store over the same file', async () => {
    await fileSecrets(path).write('ticket', 'a-value')
    expect(await fileSecrets(path).read('ticket')).toBe('a-value')
  })

  it('keeps several names apart, and replaces one without touching the other', async () => {
    const secrets = fileSecrets(path)
    await secrets.write('one', 'first')
    await secrets.write('two', 'second')
    await secrets.write('one', 'again')
    expect(await secrets.read('one')).toBe('again')
    expect(await secrets.read('two')).toBe('second')
  })

  it('writes the file only its owner can read', async () => {
    await fileSecrets(path).write('ticket', 'a-value')
    expect(await mode(path)).toBe(0o600)
  })

  it('tightens a file it did not create before the value goes into it', async () => {
    await writeFile(path, '{}\n', 'utf8')
    await chmod(path, 0o644)
    await fileSecrets(path).write('ticket', 'a-value')
    expect(await mode(path)).toBe(0o600)
  })

  it('forgets a name, and takes the file away with the last one', async () => {
    const secrets = fileSecrets(path)
    await secrets.write('one', 'first')
    await secrets.write('two', 'second')
    await secrets.remove('one')
    expect(await secrets.read('one')).toBeUndefined()
    expect(await secrets.read('two')).toBe('second')
    await secrets.remove('two')
    await expect(readFile(path, 'utf8')).rejects.toThrow()
  })

  it('says nothing about a name it was asked to forget and never had', async () => {
    await expect(fileSecrets(path).remove('nothing')).resolves.toBeUndefined()
  })

  it('reads a file that is not the shape as no secrets rather than throwing', async () => {
    await writeFile(path, 'not json at all', 'utf8')
    expect(await fileSecrets(path).read('ticket')).toBeUndefined()
    await writeFile(path, '[1, 2, 3]', 'utf8')
    expect(await fileSecrets(path).read('ticket')).toBeUndefined()
    await writeFile(path, '{ "ticket": 7 }', 'utf8')
    expect(await fileSecrets(path).read('ticket')).toBeUndefined()
  })

  it('reports a write it could not make rather than losing it in silence', async () => {
    await expect(fileSecrets(join(directory, 'no-such-folder', 'secrets.json')).write('ticket', 'a-value'))
      .rejects.toThrow()
  })
})
