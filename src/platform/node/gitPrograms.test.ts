// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Only the person's own configuration names a program; a folder's never does
 * — against real git, in a real temporary repository, with the person's own
 * configuration a file of the test's (`GIT_CONFIG_GLOBAL`). Each program is a
 * stand-in that leaves a mark where it ran, and a folder's must never leave one.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commandOf, git, gitAvailable, initRepository, label, quietConfig, snapshot } from './git'
import { commitPaths } from './gitEntries'

const run = promisify(execFile)
const available = await gitAvailable()

let place = ''
let root = ''
const kept: Record<string, string | undefined> = {}

beforeEach(async () => {
  place = await realpath(await mkdtemp(join(tmpdir(), 'lvarch-programs-')))
  root = join(place, 'folder')
  await run('mkdir', [root])
  // The person's own configuration, and nothing of the machine's that could ask anything.
  for (const name of ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_ASKPASS', 'SSH_ASKPASS']) kept[name] = process.env[name]
  process.env.GIT_CONFIG_GLOBAL = join(place, 'own.gitconfig')
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  delete process.env.GIT_ASKPASS
  delete process.env.SSH_ASKPASS
  await writeFile(process.env.GIT_CONFIG_GLOBAL, '')
})

afterEach(async () => {
  for (const [name, value] of Object.entries(kept)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  await rm(place, { recursive: true, force: true })
})

/** A stand-in program: it leaves `<name>.ran` beside the folder, and does what `body` says. */
async function program(name: string, body = 'exit 1'): Promise<string> {
  const path = join(place, `${name}.sh`)
  await writeFile(path, `#!/bin/sh\ntouch "${join(place, `${name}.ran`)}"\n${body}\n`, { mode: 0o755 })
  return path
}
const ran = (name: string) => readFile(join(place, `${name}.ran`)).then(() => true, () => false)
const folderSets = (key: string, value: string) => run('git', ['config', '--local', '--add', key, value], { cwd: root })
const personSets = (key: string, value: string) => run('git', ['config', '--global', '--add', key, value], { cwd: root })
const put = (path: string, text: string) => writeFile(join(root, path), text)

/** A server that asks for a password and takes none: what makes git ask for a credential. */
async function askingServer(): Promise<{ url: string; server: Server }> {
  const server = createServer((_request, response) => {
    response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="landscape"' })
    response.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/landscape.git`, server }
}

describe.skipIf(!available)('what a configuration names', () => {
  it('is run with no hook, no monitor and no ext:: transport, whatever the command', async () => {
    await initRepository(root)
    await folderSets('protocol.ext.allow', 'always')
    expect((await git(root, ['config', '--get', 'protocol.ext.allow'])).trim()).toBe('never')
    for (const command of ['log', 'status', 'fetch']) {
      const flags = await quietConfig(root, [command])
      for (const flag of ['core.fsmonitor=false', 'protocol.ext.allow=never']) expect(flags, command).toContain(flag)
      expect(flags.some((flag) => flag.startsWith('core.hooksPath='))).toBe(true)
    }
  })

  it('runs no command an ext:: remote names', async () => {
    await initRepository(root)
    await folderSets('protocol.ext.allow', 'always')
    await run('git', ['remote', 'add', 'origin', `ext::sh -c touch% ${join(place, 'ext.ran')}`], { cwd: root })
    await expect(git(root, ['fetch', 'origin'])).rejects.toBeDefined()
    expect(await ran('ext')).toBe(false)
  })

  describe('signing', () => {
    /** A signer git takes for gpg: it says it made a signature, and gives one. */
    const signer = (name: string) => program(name, [
      'echo "[GNUPG:] SIG_CREATED D 1 8 00 1 X" >&2',
      'printf -- "-----BEGIN PGP SIGNATURE-----\\nstand-in\\n-----END PGP SIGNATURE-----\\n"',
    ].join('\n'))

    it('never runs a signer the folder names, nor signs because the folder says to', async () => {
      await initRepository(root)
      await folderSets('commit.gpgsign', 'true')
      await folderSets('tag.gpgsign', 'true')
      await folderSets('gpg.program', await signer('folder-signer'))
      await folderSets('gpg.ssh.program', await signer('folder-ssh-signer'))
      await put('model.json', '{}')
      const sha = await snapshot(root, 'unsigned')
      expect(sha).toMatch(/^[0-9a-f]+$/)
      expect(await label(root, sha!, 'Monday')).toBe('done')
      await put('model.json', '{"again":true}')
      expect(await commitPaths(root, ['model.json'], 'unsigned too')).toMatch(/^[0-9a-f]+$/)
      expect(await ran('folder-signer')).toBe(false)
      expect(await ran('folder-ssh-signer')).toBe(false)
      expect((await run('git', ['cat-file', 'commit', sha!], { cwd: root })).stdout).not.toContain('gpgsig')
    })

    it('signs as the person signs, with their own signer, whatever the folder names', async () => {
      await personSets('commit.gpgsign', 'true')
      await personSets('gpg.program', await signer('own-signer'))
      await initRepository(root)
      await folderSets('gpg.program', await signer('folder-signer'))
      await folderSets('commit.gpgsign', 'false')
      await put('model.json', '{}')
      const sha = await snapshot(root, 'signed')
      expect(await ran('own-signer')).toBe(true)
      expect(await ran('folder-signer')).toBe(false)
      expect((await run('git', ['cat-file', 'commit', sha!], { cwd: root })).stdout).toContain('gpgsig')
    })
  })

  describe('a credential, and a way to ask for one', () => {
    let asking: { url: string; server: Server }
    beforeEach(async () => { asking = await askingServer() })
    afterEach(async () => { await new Promise((resolve) => asking.server.close(resolve)) })

    it('asks the person’s own helpers, in their order, and never one the folder names', async () => {
      await personSets('credential.helper', await program('own-helper', 'echo username=acme; echo password=wrong'))
      await initRepository(root)
      await folderSets('credential.helper', await program('folder-helper'))
      await folderSets('credential.http://127.0.0.1.helper', await program('folder-url-helper'))
      await expect(git(root, ['ls-remote', asking.url])).rejects.toBeDefined()
      expect(await ran('own-helper')).toBe(true)
      expect(await ran('folder-helper')).toBe(false)
      expect(await ran('folder-url-helper')).toBe(false)
    })

    it('runs no askpass the folder names', async () => {
      await initRepository(root)
      await folderSets('core.askPass', await program('folder-askpass', 'echo secret'))
      await expect(git(root, ['ls-remote', asking.url])).rejects.toBeDefined()
      expect(await ran('folder-askpass')).toBe(false)
    })
  })

  it('runs no proxy the folder names for the git:// transport', async () => {
    await initRepository(root)
    await folderSets('core.gitProxy', await program('folder-proxy'))
    await run('git', ['remote', 'add', 'origin', 'git://127.0.0.1:1/landscape.git'], { cwd: root })
    await expect(git(root, ['fetch', 'origin'])).rejects.toBeDefined()
    expect(await ran('folder-proxy')).toBe(false)
  })

  it('runs no program the folder names for the other end of a remote, and still fetches and pushes', async () => {
    const bare = join(place, 'remote.git')
    await run('git', ['init', '-q', '--bare', bare])
    await initRepository(root)
    await run('git', ['remote', 'add', 'origin', bare], { cwd: root })
    await folderSets('remote.origin.uploadpack', await program('folder-upload'))
    await folderSets('remote.origin.receivepack', await program('folder-receive'))
    await put('model.json', '{}')
    await snapshot(root, 'first')
    await git(root, ['push', 'origin', 'HEAD:refs/heads/main'])
    await git(root, ['fetch', 'origin', 'main'])
    expect(await ran('folder-upload')).toBe(false)
    expect(await ran('folder-receive')).toBe(false)
  })

  it('runs no ssh the folder names: the one git runs with wins', async () => {
    await initRepository(root)
    await folderSets('core.sshCommand', await program('folder-ssh'))
    await run('git', ['remote', 'add', 'origin', 'ssh://127.0.0.1:1/nowhere.git'], { cwd: root })
    await expect(git(root, ['fetch', 'origin'])).rejects.toBeDefined()
    expect(await ran('folder-ssh')).toBe(false)
  })

  it('runs no external diff, pager or editor the folder names', async () => {
    await initRepository(root)
    await folderSets('diff.external', await program('folder-diff'))
    await folderSets('core.pager', await program('folder-pager'))
    await folderSets('core.editor', await program('folder-editor'))
    const flags = await quietConfig(root, ['commit'])
    expect(flags).toContain('core.pager=cat')
    expect(flags).toContain('core.editor=:')
    expect(flags).toContain('diff.external=')
    await put('model.json', '{}')
    await snapshot(root, 'first')
    await put('model.json', '{"changed":true}')
    await git(root, ['diff']).catch(() => undefined)
    expect(await ran('folder-diff')).toBe(false)
  })

  describe('a filter', () => {
    it('runs none only the folder defines, and takes the file as it is', async () => {
      await initRepository(root)
      await folderSets('filter.evil.clean', await program('folder-clean'))
      await folderSets('filter.evil.smudge', await program('folder-smudge'))
      await folderSets('filter.evil.process', await program('folder-process'))
      await folderSets('filter.evil.required', 'true')
      await put('.gitattributes', '*.md filter=evil\n')
      await put('notes.md', 'plain words')
      const sha = await snapshot(root, 'unfiltered')
      for (const name of ['folder-clean', 'folder-smudge', 'folder-process']) expect(await ran(name), name).toBe(false)
      expect((await run('git', ['show', `${sha}:notes.md`], { cwd: root })).stdout).toBe('plain words')
    })

    it('runs one the person defines, as they define it', async () => {
      await personSets('filter.shout.clean', 'tr a-z A-Z')
      await initRepository(root)
      await folderSets('filter.shout.clean', await program('folder-clean', 'cat'))
      await put('.gitattributes', '*.md filter=shout\n')
      await put('notes.md', 'plain words')
      const sha = await snapshot(root, 'filtered as the person says')
      expect(await ran('folder-clean')).toBe(false)
      expect((await run('git', ['show', `${sha}:notes.md`], { cwd: root })).stdout).toBe('PLAIN WORDS')
    })

    it('runs nothing at all where the folder names a program under a key no override can reach', async () => {
      await initRepository(root)
      await folderSets('filter.a=b.clean', await program('folder-clean', 'cat'))
      await put('.gitattributes', '*.md filter=a=b\n')
      await put('notes.md', 'plain words')
      await expect(snapshot(root, 'refused')).rejects.toThrow('cannot be overridden')
      expect(await ran('folder-clean')).toBe(false)
    })
  })

  it('reads a folder’s configuration only for a command that could start a program', async () => {
    expect(commandOf(['-c', 'user.name=Acme', 'commit', '-m', 'x'])).toBe('commit')
    expect(commandOf(['status', '--porcelain'])).toBe('status')
    expect(commandOf(['-C', 'somewhere', 'log'])).toBe('log')
    await initRepository(root)
    await folderSets('core.pager', 'cat')
    expect(await quietConfig(root, ['log'])).not.toContain('core.pager=cat')
    expect(await quietConfig(root, ['commit'])).toContain('core.pager=cat')
  })
})
