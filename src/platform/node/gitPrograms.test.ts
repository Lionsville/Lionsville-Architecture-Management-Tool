// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A folder's own configuration is taken for what a folder needs, and for
 * nothing else — against real git, in real temporary repositories, with the
 * person's own configuration a file of the test's (`GIT_CONFIG_GLOBAL`). Each
 * program a configuration could name is a stand-in that leaves a mark where it
 * ran; one the folder names must never leave one, and one the person names
 * runs as it always did.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { createServer as createTcpServer } from 'node:net'
import type { AddressInfo, Server as TcpServer } from 'node:net'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { git, gitAvailable, history, initRepository, label, pull, push, snapshot } from './git'
import { commitLog, commitPaths, readAt } from './gitEntries'
import { gitEnvironment } from './gitGuard'

const run = promisify(execFile)
const available = await gitAvailable()
const REFUSED = /git was not run in this folder/

let place = ''
let root = ''
const kept: Record<string, string | undefined> = {}

beforeEach(async () => {
  place = await realpath(await mkdtemp(join(tmpdir(), 'lvarch-programs-')))
  root = join(place, 'folder')
  await mkdir(root)
  // The person's own configuration, and nothing of the machine's that could ask anything.
  for (const name of [
    'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_ASKPASS', 'SSH_ASKPASS',
    'https_proxy', 'HTTPS_PROXY', 'http_proxy', 'HTTP_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY',
  ]) kept[name] = process.env[name]
  process.env.GIT_CONFIG_GLOBAL = join(place, 'own.gitconfig')
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  for (const name of ['GIT_ASKPASS', 'SSH_ASKPASS', 'https_proxy', 'HTTPS_PROXY', 'http_proxy', 'HTTP_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY']) {
    delete process.env[name]
  }
  await writeFile(process.env.GIT_CONFIG_GLOBAL, '[user]\n\tname = Acme\n\temail = acme@example.com\n')
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
/** Git as a person runs it in a terminal, for the setting up, with nothing of the app's in between. */
const raw = (args: readonly string[], cwd = root) => run('git', args, { cwd })
const folderSets = (key: string, value: string, cwd = root) => raw(['config', '--local', '--add', key, value], cwd)
const personSets = (key: string, value: string) => raw(['config', '--global', '--add', key, value])
const put = (path: string, text: string) => writeFile(join(root, path), text)

/** A signer git takes for gpg: it says it made a signature, and gives one. */
const signer = (name: string) => program(name, [
  'echo "[GNUPG:] SIG_CREATED D 1 8 00 1 X" >&2',
  'printf -- "-----BEGIN PGP SIGNATURE-----\\nstand-in\\n-----END PGP SIGNATURE-----\\n"',
].join('\n'))

/** A bare repository beside the folder, with one commit on `main`. */
async function remoteWithCommit(name: string): Promise<string> {
  const bare = join(place, `${name}.git`)
  const seed = join(place, `${name}-seed`)
  await raw(['init', '-q', '--bare', '-b', 'main', bare], place)
  await mkdir(seed)
  await raw(['init', '-q', '-b', 'main'], seed)
  await writeFile(join(seed, 'model.json'), '{}')
  await raw(['add', '-A'], seed)
  await raw(['commit', '-q', '-m', 'first'], seed)
  await raw(['push', '-q', bare, 'main'], seed)
  return bare
}

/** The folder as a person's clone of a remote, on `main`. */
async function cloneOf(bare: string): Promise<void> {
  await rm(root, { recursive: true, force: true })
  await raw(['clone', '-q', bare, root], place)
}

describe.skipIf(!available)('the ways a hostile folder configuration was found to start a program', () => {
  it('runs no smudge filter of the folder’s where a read of git’s objects asks for filters', async () => {
    await initRepository(root)
    await put('.gitattributes', '*.md filter=evil\n')
    await put('notes.md', 'plain words')
    await raw(['add', '-A'])
    await raw(['commit', '-q', '-m', 'first'])
    const sha = (await raw(['rev-parse', 'HEAD'])).stdout.trim()
    await folderSets('filter.evil.smudge', await program('folder-smudge', 'cat'))
    const files = await readAt(root, sha, ['notes.md'])
    expect(await ran('folder-smudge')).toBe(false)
    expect(files).toHaveLength(1)
  })

  it('runs no signature check of the folder’s where a log is read', async () => {
    await initRepository(root)
    await put('model.json', '{}')
    await raw(['add', '-A'])
    await raw(['-c', `gpg.program=${await signer('setup-signer')}`, 'commit', '-q', '-S', '-m', 'signed'])
    await folderSets('log.showSignature', 'true')
    await folderSets('gpg.program', await program('folder-verifier'))
    await history(root)
    await commitLog(root, { limit: 10 })
    expect(await ran('folder-verifier')).toBe(false)
  })

  it('runs no command for alternate references the folder names on a fetch', async () => {
    const bare = await remoteWithCommit('remote')
    const other = await remoteWithCommit('other')
    await cloneOf(bare)
    await writeFile(join(root, '.git', 'objects', 'info', 'alternates'), `${join(other, 'objects')}\n`)
    await folderSets('core.alternateRefsCommand', await program('folder-alternates', 'exit 0'))
    await raw(['commit', '-q', '--allow-empty', '-m', 'ahead'], join(place, 'remote-seed'))
    await raw(['push', '-q', bare, 'main'], join(place, 'remote-seed'))
    await git(root, ['fetch', 'origin']).catch(() => undefined)
    expect(await ran('folder-alternates')).toBe(false)
  })

  it('enters no submodule, so no configuration of one runs on a pull', async () => {
    const inner = await remoteWithCommit('inner')
    const bare = await remoteWithCommit('remote')
    const seed = join(place, 'remote-seed')
    await raw(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', inner, 'sub'], seed)
    await raw(['commit', '-q', '-m', 'with a submodule'], seed)
    await raw(['push', '-q', bare, 'main'], seed)
    await cloneOf(bare)
    await raw(['-c', 'protocol.file.allow=always', 'submodule', 'update', '-q', '--init'])
    await folderSets('remote.origin.uploadpack', await program('submodule-upload'), join(root, 'sub'))
    await folderSets('submodule.recurse', 'true')
    await folderSets('fetch.recurseSubmodules', 'true')
    await folderSets('protocol.file.allow', 'always')
    await raw(['commit', '-q', '--allow-empty', '-m', 'ahead'], seed)
    await raw(['push', '-q', bare, 'main'], seed)
    await pull(root)
    expect(await ran('submodule-upload')).toBe(false)
  })

  it('refuses a remote that is a repository inside the folder, whose hooks would run on a push', async () => {
    await initRepository(root)
    const inner = join(root, 'inner.git')
    await raw(['init', '-q', '--bare', inner])
    await writeFile(join(inner, 'hooks', 'pre-receive'), `#!/bin/sh\ntouch "${join(place, 'inner-hook.ran')}"\n`, { mode: 0o755 })
    await raw(['remote', 'add', 'origin', 'inner.git'])
    await put('model.json', '{}')
    await raw(['add', '-A'])
    await raw(['commit', '-q', '-m', 'first'])
    expect(await push(root)).not.toBe('done')
    await expect(git(root, ['push', 'origin', 'HEAD:refs/heads/main'])).rejects.toThrow(REFUSED)
    expect(await ran('inner-hook')).toBe(false)
  })

  it('works in this folder alone, whatever work tree its configuration names', async () => {
    const outside = join(place, 'outside')
    await mkdir(outside)
    await writeFile(join(outside, 'secret.txt'), 'not the folder’s')
    await initRepository(root)
    await folderSets('core.worktree', '../../outside')
    await put('model.json', '{}')
    await expect(snapshot(root, 'refused')).rejects.toThrow(REFUSED)
    const tree = await raw(['ls-tree', '-r', '--name-only', 'HEAD']).then((out) => out.stdout, () => '')
    expect(tree).not.toContain('secret.txt')
  })

  describe('a credential', () => {
    let proxy: TcpServer
    let asked = 0
    beforeEach(async () => {
      asked = 0
      proxy = createTcpServer((socket) => { asked += 1; socket.destroy() })
      await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    })
    afterEach(async () => { await new Promise((resolve) => proxy.close(resolve)) })

    it('is never sent through a proxy the folder names, however little it checks TLS', async () => {
      await personSets('credential.helper', await program('own-helper', 'echo username=acme; echo password=secret'))
      await initRepository(root)
      await folderSets('http.proxy', `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`)
      await folderSets('http.sslVerify', 'false')
      await raw(['remote', 'add', 'origin', 'https://127.0.0.1:1/landscape.git'])
      await git(root, ['fetch', 'origin']).catch(() => undefined)
      expect(asked).toBe(0)
    })
  })
})

describe.skipIf(!available)('what a folder’s configuration may say', () => {
  it('keeps what a repository needs, and commits with it', async () => {
    await initRepository(root)
    for (const [key, value] of [
      ['core.autocrlf', 'false'], ['core.precomposeunicode', 'true'], ['user.name', 'Acme Logistics'],
      ['remote.origin.url', 'https://example.com/landscape.git'], ['branch.main.remote', 'origin'],
      ['pull.rebase', 'true'], ['color.ui', 'auto'], ['gui.wmstate', 'normal'],
    ]) await folderSets(key, value)
    await put('model.json', '{}')
    const sha = await snapshot(root, 'with what a folder needs')
    expect(sha).toMatch(/^[0-9a-f]+$/)
    expect((await raw(['log', '-1', '--format=%an'])).stdout.trim()).toBe('Acme Logistics')
  })

  it('refuses a key it does not know, and names it', async () => {
    await initRepository(root)
    await folderSets('http.cookieFile', join(place, 'cookies.txt'))
    await put('model.json', '{}')
    await expect(snapshot(root, 'refused')).rejects.toThrow(/http\.cookiefile/)
  })

  it('refuses a repository extension git may not know', async () => {
    await initRepository(root)
    await folderSets('extensions.somethingNew', 'true')
    await expect(git(root, ['status'])).rejects.toThrow(/extensions\.somethingnew/)
  })

  it('refuses a key git takes from its first value, which nothing set after it can override', async () => {
    const bare = await remoteWithCommit('remote')
    await cloneOf(bare)
    await folderSets('remote.origin.uploadpack', await program('folder-upload'))
    await folderSets('core.gitProxy', await program('folder-proxy'))
    await expect(git(root, ['fetch', 'origin'])).rejects.toThrow(REFUSED)
    expect(await ran('folder-upload')).toBe(false)
    expect(await ran('folder-proxy')).toBe(false)
  })

  it('refuses to include a file in the folder itself, where a page can write it', async () => {
    await initRepository(root)
    await folderSets('include.path', '../more.gitconfig')
    await expect(git(root, ['status'])).rejects.toThrow(/includes a file in the folder itself/)
  })

  it('holds what the folder includes from elsewhere to the same rules, and sees a change to it at the next git', async () => {
    await initRepository(root)
    const more = join(place, 'more.gitconfig')
    await folderSets('include.path', more)
    await put('.gitattributes', '*.json filter=evil\n')
    await put('model.json', '{}')
    expect(await snapshot(root, 'nothing included yet')).toMatch(/^[0-9a-f]+$/)
    await writeFile(more, `[filter "evil"]\n\tclean = ${await program('included-clean', 'cat')}\n`)
    await put('model.json', '{"changed":true}')
    await snapshot(root, 'the include says more now')
    expect(await ran('included-clean')).toBe(false)
  })

  it('refuses a key named so that no setting can reach it', async () => {
    await initRepository(root)
    await folderSets('filter.a=b.clean', await program('folder-clean', 'cat'))
    await put('.gitattributes', '*.md filter=a=b\n')
    await put('notes.md', 'plain words')
    await expect(snapshot(root, 'refused')).rejects.toThrow(REFUSED)
    expect(await ran('folder-clean')).toBe(false)
  })

  it('pushes to and fetches from a remote on this machine outside the folder', async () => {
    const bare = await remoteWithCommit('remote')
    await cloneOf(bare)
    await put('model.json', '{"mine":true}')
    await snapshot(root, 'mine')
    expect(await push(root)).toBe('done')
    expect(await pull(root)).toBe('done')
  })
})

describe.skipIf(!available)('a program the folder names, and the person’s own', () => {
  it('runs no command an ext:: remote names', async () => {
    await initRepository(root)
    await folderSets('protocol.ext.allow', 'always')
    await raw(['remote', 'add', 'origin', `ext::sh -c touch% ${join(place, 'ext.ran')}`])
    await expect(git(root, ['fetch', 'origin'])).rejects.toBeDefined()
    expect(await ran('ext')).toBe(false)
  })

  it('never runs a signer the folder names, nor signs because the folder says to', async () => {
    await initRepository(root)
    await folderSets('commit.gpgsign', 'true')
    await folderSets('tag.gpgsign', 'true')
    await folderSets('gpg.program', await signer('folder-signer'))
    await folderSets('gpg.ssh.program', await signer('folder-ssh-signer'))
    await put('model.json', '{}')
    const sha = await snapshot(root, 'unsigned')
    expect(await label(root, sha!, 'Monday')).toBe('done')
    await put('model.json', '{"again":true}')
    expect(await commitPaths(root, ['model.json'], 'unsigned too')).toMatch(/^[0-9a-f]+$/)
    expect(await ran('folder-signer')).toBe(false)
    expect(await ran('folder-ssh-signer')).toBe(false)
    expect((await raw(['cat-file', 'commit', sha!])).stdout).not.toContain('gpgsig')
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
    expect((await raw(['cat-file', 'commit', sha!])).stdout).toContain('gpgsig')
  })

  describe('a credential, and a way to ask for one', () => {
    let asking: Server
    let url = ''
    beforeEach(async () => {
      asking = createServer((_request, response) => {
        response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="landscape"' })
        response.end()
      })
      await new Promise<void>((resolve) => asking.listen(0, '127.0.0.1', resolve))
      url = `http://127.0.0.1:${(asking.address() as AddressInfo).port}/landscape.git`
    })
    afterEach(async () => { await new Promise((resolve) => asking.close(resolve)) })

    it('asks the person’s own helpers, and never one the folder names', async () => {
      await personSets('credential.helper', await program('own-helper', 'echo username=acme; echo password=wrong'))
      await initRepository(root)
      await folderSets('credential.helper', await program('folder-helper'))
      await folderSets('credential.http://127.0.0.1.helper', await program('folder-url-helper'))
      await expect(git(root, ['ls-remote', url])).rejects.toBeDefined()
      expect(await ran('own-helper')).toBe(true)
      expect(await ran('folder-helper')).toBe(false)
      expect(await ran('folder-url-helper')).toBe(false)
    })

    it('runs no askpass the folder names', async () => {
      await initRepository(root)
      await folderSets('core.askPass', await program('folder-askpass', 'echo secret'))
      await expect(git(root, ['ls-remote', url])).rejects.toBeDefined()
      expect(await ran('folder-askpass')).toBe(false)
    })
  })

  it('runs no ssh, external diff, pager or editor the folder names', async () => {
    await initRepository(root)
    await folderSets('core.sshCommand', await program('folder-ssh'))
    await folderSets('diff.external', await program('folder-diff'))
    await folderSets('core.pager', await program('folder-pager'))
    await folderSets('core.editor', await program('folder-editor'))
    await raw(['remote', 'add', 'origin', 'ssh://127.0.0.1:1/nowhere.git'])
    await expect(git(root, ['fetch', 'origin'])).rejects.toBeDefined()
    await put('model.json', '{}')
    await snapshot(root, 'first')
    await put('model.json', '{"changed":true}')
    await git(root, ['diff']).catch(() => undefined)
    for (const name of ['folder-ssh', 'folder-diff', 'folder-pager', 'folder-editor']) expect(await ran(name), name).toBe(false)
  })

  it('runs no filter only the folder defines, and takes the file as it is', async () => {
    await initRepository(root)
    await folderSets('filter.evil.clean', await program('folder-clean'))
    await folderSets('filter.evil.smudge', await program('folder-smudge'))
    await folderSets('filter.evil.process', await program('folder-process'))
    await folderSets('filter.evil.required', 'true')
    await put('.gitattributes', '*.md filter=evil\n')
    await put('notes.md', 'plain words')
    const sha = await snapshot(root, 'unfiltered')
    for (const name of ['folder-clean', 'folder-smudge', 'folder-process']) expect(await ran(name), name).toBe(false)
    expect((await raw(['show', `${sha}:notes.md`])).stdout).toBe('plain words')
  })

  it('runs a filter the person defines, as they define it', async () => {
    await personSets('filter.shout.clean', 'tr a-z A-Z')
    await initRepository(root)
    await folderSets('filter.shout.clean', await program('folder-clean', 'cat'))
    await put('.gitattributes', '*.md filter=shout\n')
    await put('notes.md', 'plain words')
    const sha = await snapshot(root, 'filtered as the person says')
    expect(await ran('folder-clean')).toBe(false)
    expect((await raw(['show', `${sha}:notes.md`])).stdout).toBe('PLAIN WORDS')
  })
})

describe.skipIf(!available)('what the second review found', () => {
  it('reads a configuration of any size whole, and runs nothing it names', async () => {
    await initRepository(root)
    const padding = Array.from({ length: 40_000 }, (_, at) => `\tpad${at} = ${'x'.repeat(40)}`).join('\n')
    await writeFile(join(root, '.git', 'config'), `${await readFile(join(root, '.git', 'config'), 'utf8')}[color]\n${padding}\n`)
    await folderSets('filter.evil.clean', await program('folder-clean', 'cat'))
    await put('.gitattributes', '*.md filter=evil\n')
    await put('notes.md', 'plain words')
    await snapshot(root, 'a large configuration')
    expect(await ran('folder-clean')).toBe(false)
  }, 20_000)

  it('refuses where the configuration cannot be read at all', async () => {
    await initRepository(root)
    await writeFile(join(root, '.git', 'config'), '[core\n\tthis is not a configuration\n')
    await expect(git(root, ['status'])).rejects.toThrow(/could not be read/)
  })

  it('counts a worktree’s own configuration as the folder’s, however its extension is written', async () => {
    for (const written of ['\tworktreeConfig\n', '\tworktreeConfig = 2\n']) {
      await rm(root, { recursive: true, force: true })
      await mkdir(root)
      await initRepository(root)
      await writeFile(join(root, '.git', 'config'), `${await readFile(join(root, '.git', 'config'), 'utf8')}[extensions]\n${written}`)
      await raw(['config', 'core.repositoryFormatVersion', '1'])
      await writeFile(join(root, '.git', 'config.worktree'), `[filter "evil"]\n\tclean = ${await program('worktree-clean', 'cat')}\n`)
      await put('.gitattributes', '*.md filter=evil\n')
      await put('notes.md', 'plain words')
      await snapshot(root, 'the worktree’s own')
      expect(await ran('worktree-clean'), written).toBe(false)
    }
  })

  it('counts a file the folder includes on the person’s condition as the folder’s', async () => {
    await personSets('remote.origin.url', 'https://example.com/landscape.git')
    await initRepository(root)
    const evil = join(place, 'evil.gitconfig')
    await writeFile(evil, `[filter "evil"]\n\tclean = ${await program('conditional-clean', 'cat')}\n`)
    await folderSets('includeIf.hasconfig:remote.*.url:https://example.com/**.path', evil)
    await put('.gitattributes', '*.md filter=evil\n')
    await put('notes.md', 'plain words')
    await snapshot(root, 'on the person’s condition')
    expect(await ran('conditional-clean')).toBe(false)
  })

  it('sees an include that a branch switch makes active, in a repository whose HEAD file never changes', async () => {
    await raw(['init', '-q', '--ref-format=reftable', '-b', 'main'])
    const evil = join(place, 'branch.gitconfig')
    await writeFile(evil, `[filter "evil"]\n\tclean = ${await program('branch-clean', 'cat')}\n`)
    await folderSets('includeIf.onbranch:feature.path', evil)
    await put('.gitattributes', '*.md filter=evil\n')
    await put('notes.md', 'plain words')
    await snapshot(root, 'on main')
    await raw(['switch', '-q', '-c', 'feature'])
    await put('notes.md', 'more words')
    await snapshot(root, 'on the feature branch')
    expect(await ran('branch-clean')).toBe(false)
  })

  it('matches every rule without regard to case, as git and git-lfs read keys', async () => {
    await initRepository(root)
    await writeFile(join(root, '.git', 'config'),
      `${await readFile(join(root, '.git', 'config'), 'utf8')}[lfs "CustomTransfer.evil"]\n\tpath = ${await program('lfs-transfer')}\n`)
    await expect(git(root, ['status'])).rejects.toThrow(/lfs\.CustomTransfer\.evil\.path/)
  })

  it('signs no label and no push because the folder says to, and signs with the person’s key only', async () => {
    const args = join(place, 'signer-args')
    await personSets('gpg.program', await program('own-signer', [
      `echo "$@" >> "${args}"`,
      'echo "[GNUPG:] SIG_CREATED D 1 8 00 1 X" >&2',
      'printf -- "-----BEGIN PGP SIGNATURE-----\\nstand-in\\n-----END PGP SIGNATURE-----\\n"',
    ].join('\n')))
    await initRepository(root)
    await folderSets('tag.forceSignAnnotated', 'true')
    await folderSets('push.gpgSign', 'true')
    await put('model.json', '{}')
    const sha = await snapshot(root, 'first')
    expect(await label(root, sha!, 'Monday')).toBe('done')
    expect(await ran('own-signer')).toBe(false)
    await personSets('commit.gpgsign', 'true')
    await folderSets('user.signingKey', 'the-folders-key')
    await put('model.json', '{"signed":true}')
    await snapshot(root, 'signed by the person')
    expect(await ran('own-signer')).toBe(true)
    expect(await readFile(args, 'utf8')).not.toContain('the-folders-key')
  })

  it('refuses a rewrite of remote addresses, which no setting can take back', async () => {
    await initRepository(root)
    await folderSets('url.https://evil.example/.insteadOf', 'https://example.com/')
    await expect(git(root, ['status'])).rejects.toThrow(/url\.https:\/\/evil\.example\/\.insteadof/i)
  })

  describe('what is sent with a request', () => {
    let server: Server
    let heard: string[] = []
    let url = ''
    beforeEach(async () => {
      heard = []
      server = createServer((request, response) => {
        heard.push(JSON.stringify(request.headers))
        response.writeHead(404)
        response.end()
      })
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/landscape.git`
    })
    afterEach(async () => { await new Promise((resolve) => server.close(resolve)) })

    it('is never a header the folder adds, and is the person’s own', async () => {
      await personSets('http.extraHeader', 'X-Own: acme')
      await initRepository(root)
      await folderSets('http.extraHeader', 'X-Folder: evil')
      await git(root, ['ls-remote', url]).catch(() => undefined)
      expect(heard.join('\n')).not.toContain('x-folder')
      expect(heard.join('\n')).toContain('x-own')
    })
  })

  describe('a proxy', () => {
    let own: TcpServer
    let folders: TcpServer
    const reached = { own: 0, folders: 0 }
    const listening = async (which: 'own' | 'folders') => {
      const server = createTcpServer((socket) => { reached[which] += 1; socket.destroy() })
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      return server
    }
    beforeEach(async () => {
      reached.own = 0
      reached.folders = 0
      own = await listening('own')
      folders = await listening('folders')
    })
    afterEach(async () => {
      await new Promise((resolve) => own.close(resolve))
      await new Promise((resolve) => folders.close(resolve))
    })

    it('is the person’s own from their environment, never the folder’s, and not turned off', async () => {
      process.env.https_proxy = `http://127.0.0.1:${(own.address() as AddressInfo).port}`
      await initRepository(root)
      await folderSets('http.proxy', `http://127.0.0.1:${(folders.address() as AddressInfo).port}`)
      await raw(['remote', 'add', 'origin', 'https://example.invalid/landscape.git'])
      await git(root, ['fetch', 'origin']).catch(() => undefined)
      expect(reached.folders).toBe(0)
      expect(reached.own).toBeGreaterThan(0)
    })
  })

  it('asks no remote for what a partial clone lacks, but on a fetch', () => {
    expect(gitEnvironment({}).GIT_NO_LAZY_FETCH).toBe('1')
  })

  it('runs with what only commands it never runs read', async () => {
    await initRepository(root)
    for (const [key, value] of [
      ['difftool.mine.cmd', 'echo'], ['mergetool.mine.cmd', 'echo'], ['diff.tool', 'mine'], ['merge.tool', 'mine'],
      ['sendemail.smtpServer', '/usr/sbin/sendmail'], ['svn-remote.svn.url', 'https://example.com/svn'],
      ['remote.pushDefault', 'origin'], ['branch.sort', '-committerdate'], ['diff.md.xfuncname', '^#'],
      ['commit.verbose', 'false'], ['commit.template', join(place, 'template.txt')], ['http.postBuffer', '1048576'],
      ['core.sharedRepository', 'group'], ['credential.useHttpPath', 'true'],
    ]) await folderSets(key, value)
    await put('model.json', '{}')
    expect(await snapshot(root, 'with what a person keeps')).toMatch(/^[0-9a-f]+$/)
  })

  it('says a refused sync as the refusal it is, with its words', async () => {
    const bare = await remoteWithCommit('remote')
    await cloneOf(bare)
    await folderSets('http.sslCAInfo', join(place, 'ca.pem'))
    const outcome = await push(root)
    expect(outcome).toMatchObject({ refused: expect.stringMatching(/http\.sslcainfo/i) })
    expect(await pull(root)).toMatchObject({ refused: expect.stringMatching(/http\.sslcainfo/i) })
  })
})

