// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The path an address names on this machine, or nothing for one on another.
 *
 * A remote on this machine is one whose hooks git runs here, so an address
 * is read the way git and ssh will reach it: a `file://` address and a plain
 * path are paths; an address over ssh is a path where its host is this
 * machine — the host as ssh will resolve it (an alias in the person's ssh
 * configuration included, `ssh -G`), and then as the name service does,
 * compared against every address this machine answers on: its interfaces,
 * the loopback range, and the any-address. A host that cannot be resolved in
 * a moment is taken for another machine, which is what git would then fail
 * to reach.
 */
import { exec, execFile } from 'node:child_process'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { homedir, hostname, networkInterfaces, userInfo } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

const runFile = promisify(execFile)
const runShell = promisify(exec)

/** How long a host may take to be resolved before it is taken for another machine's. */
const RESOLVE_MS = 3_000

/** The schemes git reaches a repository over ssh by. */
const SSH_SCHEMES = new Set(['ssh', 'git+ssh', 'ssh+git'])

export async function localPathOf(root: string, address: string): Promise<string | undefined> {
  const url = /^([a-z][a-z0-9+.-]*):\/\/([^/]*)(\/.*)?$/i.exec(address)
  if (url) {
    const scheme = url[1].toLowerCase()
    if (scheme === 'file') return decodeURIComponent(address.slice('file://'.length).replace(/^localhost\.?\//i, '/'))
    if (!SSH_SCHEMES.has(scheme)) return undefined
    const host = url[2].replace(/^[^@]*@/, '').replace(/:\d+$/, '')
    return await isThisMachine(host) ? fromHome(decodeURIComponent(url[3] ?? '/')) : undefined
  }
  if (/^[a-z]:[\\/]/i.test(address)) return address
  // `host:path`, as ssh reads it: a path on this machine where the host is this machine.
  const scp = /^(?:[^@/]*@)?(\[[^\]]+\]|[^:/\\]+):(.*)$/.exec(address)
  if (!scp) return resolve(root, address)
  if (!await isThisMachine(scp[1])) return undefined
  // Relative to the home folder, as ssh reads it, or to the one it names with `~user`.
  const path = scp[2]
  return fromHome(path.startsWith('/') ? path : path.startsWith('~') ? `/${path}` : `/~/${path}`)
}


/** Is this host this machine: as ssh resolves it, then as the name service does? */
export async function isThisMachine(host: string): Promise<boolean> {
  const name = plain(host)
  if (isLocalName(name)) return true
  const resolved = plain(await sshHostname(name) ?? name)
  if (isLocalName(resolved)) return true
  const addresses = isIP(resolved) ? [resolved] : await addressesOf(resolved)
  const own = ownAddresses()
  return addresses.some((address) => isLocalAddress(address, own))
}

/** A host as it is compared: lower case, without brackets or a trailing dot. */
function plain(host: string): string {
  return host.toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '')
}

function isLocalName(name: string): boolean {
  const own = hostname().toLowerCase().replace(/\.$/, '')
  return ['localhost', own, own.split('.')[0]].includes(name) || (isIP(name) !== 0 && isLocalAddress(name, ownAddresses()))
}

/** The addresses this machine answers on. */
function ownAddresses(): Set<string> {
  return new Set(Object.values(networkInterfaces()).flatMap((all) => (all ?? []).map((one) => one.address.toLowerCase().replace(/%.*$/, ''))))
}

function isLocalAddress(address: string, own: Set<string>): boolean {
  const held = address.toLowerCase().replace(/%.*$/, '').replace(/^::ffff:(?=\d+\.)/, '')
  return own.has(held) || /^127\./.test(held) || ['0.0.0.0', '::', '::1'].includes(held)
}

/** What the name service answers for a host, within a moment; nothing where it does not. */
async function addressesOf(host: string): Promise<string[]> {
  const answered = lookup(host, { all: true }).then((found) => found.map((one) => one.address), () => [] as string[])
  const late = new Promise<string[]>((done) => { setTimeout(() => done([]), RESOLVE_MS).unref() })
  return Promise.race([answered, late])
}

/**
 * The host ssh would connect to for this name — an alias in the person's ssh
 * configuration resolved — with the ssh git runs (`GIT_SSH_COMMAND`, where
 * the process names one). Nothing where ssh cannot say.
 */
async function sshHostname(host: string): Promise<string | undefined> {
  if (!/^[a-z0-9._:-]+$/i.test(host)) return undefined
  const command = process.env.GIT_SSH_COMMAND?.trim()
  try {
    const { stdout } = command && process.platform !== 'win32'
      ? await runShell(`${command} -G ${host}`, { timeout: RESOLVE_MS })
      : await runFile('ssh', ['-G', host], { timeout: RESOLVE_MS, windowsHide: true })
    return /^hostname (\S+)$/m.exec(stdout)?.[1]
  } catch {
    return undefined
  }
}

/** A path as ssh reads it on this machine: `/~/…` from the home folder, `/~user/…` from that user's. */
export function fromHome(path: string): string {
  const home = /^\/~([^/]*)(\/.*)?$/.exec(path)
  if (!home) return path
  const [, user, rest = '/'] = home
  return join(homeOf(user), rest)
}

/** A user's home folder: the person's own, or a folder beside it named for the user, as every desktop lays them out. */
function homeOf(user: string): string {
  if (user === '' || user === userInfo().username) return homedir()
  return join(dirname(homedir()), user)
}
