// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Which host is this machine, as ssh and the name service reach it, and what a path on it is. */
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, networkInterfaces, tmpdir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { fromHome, isThisMachine, localPathOf } from './thisMachine'

const before = process.env.GIT_SSH_COMMAND
afterEach(() => {
  if (before === undefined) delete process.env.GIT_SSH_COMMAND
  else process.env.GIT_SSH_COMMAND = before
})

describe('this machine', () => {
  it('is localhost however it is written, the loopback range, and the any-address', async () => {
    for (const host of ['localhost', 'LOCALHOST', 'localhost.', '127.0.0.1', '127.1.2.3', '::1', '[::1]', '0.0.0.0', '::']) {
      expect(await isThisMachine(host), host).toBe(true)
    }
  })

  it('is every address its interfaces answer on', async () => {
    const own = Object.values(networkInterfaces()).flatMap((all) => all ?? []).map((one) => one.address)
    for (const address of own) expect(await isThisMachine(address), address).toBe(true)
  })

  it('is a host the ssh git runs resolves to this machine', async () => {
    const place = await mkdtemp(join(tmpdir(), 'lv-ssh-'))
    try {
      await writeFile(join(place, 'config'), 'Host acme-alias\n  HostName 127.0.0.1\nHost acme-away\n  HostName 192.0.2.10\n')
      process.env.GIT_SSH_COMMAND = `ssh -F ${join(place, 'config')}`
      expect(await isThisMachine('acme-alias')).toBe(true)
      expect(await isThisMachine('acme-away')).toBe(false)
    } finally {
      await rm(place, { recursive: true, force: true })
    }
  })

  it('is not a host on another machine, nor one no name service knows', async () => {
    expect(await isThisMachine('192.0.2.10')).toBe(false)
    expect(await isThisMachine('nowhere.invalid')).toBe(false)
  })
})

describe('a path on this machine', () => {
  it('is read from the home folder of whoever it names', () => {
    expect(fromHome('/~/repo.git')).toBe(join(homedir(), 'repo.git'))
    expect(fromHome(`/~${userInfo().username}/repo.git`)).toBe(join(homedir(), 'repo.git'))
    expect(fromHome('/~acme/repo.git')).toBe(join(dirname(homedir()), 'acme', 'repo.git'))
    expect(fromHome('/srv/repo.git')).toBe('/srv/repo.git')
  })

  it('is what a local address names, and nothing for another machine’s', async () => {
    expect(await localPathOf('/work', 'ssh://acme@localhost:22/srv/repo.git')).toBe('/srv/repo.git')
    expect(await localPathOf('/work', 'localhost:~acme/repo.git')).toBe(join(dirname(homedir()), 'acme', 'repo.git'))
    expect(await localPathOf('/work', 'file:///srv/repo.git')).toBe('/srv/repo.git')
    expect(await localPathOf('/work', 'inner.git')).toBe('/work/inner.git')
    expect(await localPathOf('/work', 'https://localhost/repo.git')).toBeUndefined()
    expect(await localPathOf('/work', '192.0.2.10:repo.git')).toBeUndefined()
  })
})
