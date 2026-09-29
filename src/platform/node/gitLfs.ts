// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Large files kept with git-lfs, and where they go.
 *
 * Git-lfs uploads them from the hook git runs before a push, and no hook of a
 * folder's runs here, so the person's own git-lfs — the filter their own
 * configuration defines, from `git lfs install` — is asked to push them
 * before the commits that point at them go up; where they have none, the push
 * is refused rather than sending pointers to files the remote will never have.
 *
 * Where they go is git-lfs's to say, and git-lfs also reads `.lfsconfig`, a
 * file in the work tree that a page can write and that git's own
 * configuration never shows. So a push is refused where `.lfsconfig` — in the
 * work tree, the index or the last commit — names an address or an access
 * mode, and the endpoint git-lfs says it will push to is held to the rule a
 * remote's address is: none inside the folder.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { SyncRemote } from '../sync'
import { GitRefused, personDefinesFilter, refuseAddressInside } from './gitGuard'

/** A git in a folder, as `git.ts` runs one: guarded, and answering what it wrote. */
export type GitIn = (root: string, args: readonly string[], timeout?: number) => Promise<string>

/**
 * What in `.lfsconfig` would say where large files go, how git-lfs asks to
 * be let in, or which protocol an address it works out is reached by.
 */
const LFSCONFIG_ADDRESS = /^(lfs\.(.+\.)?(url|pushurl|access)|lfs\.gitprotocol|remote\..+\.(lfsurl|lfspushurl))$/i

/** Push the folder's large files with the person's own git-lfs, where it keeps any; refused where that cannot be done safely. */
export async function largeFilesFirst(root: string, target: SyncRemote, git: GitIn, timeout?: number): Promise<void> {
  if (!await keepsLargeFiles(root, git)) return
  if (!await personDefinesFilter(root, 'lfs')) {
    throw new GitRefused('its files are kept with git-lfs, which your own configuration does not set up, so large files would not be uploaded; run git lfs install, then push again')
  }
  const named = await lfsconfigAddresses(root, git)
  if (named.length > 0) {
    throw new GitRefused(`its .lfsconfig says where large files go or how to be let in (${named.join(', ')}); remove that from .lfsconfig, or push with git yourself`)
  }
  const endpoint = endpointOf(await git(root, ['lfs', 'env']), target.name)
  if (endpoint === undefined) throw new GitRefused('git-lfs did not say where it would push large files, so they were not pushed')
  await refuseAddressInside(root, endpoint, 'the address git-lfs pushes large files to')
  // The address checked is the address pushed to: git's own configuration
  // comes before `.lfsconfig`, which a page could rewrite in between.
  const pinned = ['lfspushurl', 'lfsurl'].flatMap((key) => ['-c', `remote.${target.name}.${key}=${endpoint}`])
  await git(root, [...pinned, 'lfs', 'push', target.name, 'HEAD'], timeout)
}

/**
 * Does the folder hand any file to git-lfs: a `.gitattributes` it keeps, its
 * repository's own attributes, or the person's own attributes file?
 */
export async function keepsLargeFiles(root: string, git: GitIn): Promise<boolean> {
  const listed = (await git(root, ['ls-files', '-z', '--', ':(glob)**/.gitattributes'])).split('\0').filter(Boolean)
  const own = await git(root, ['config', '--get', 'core.attributesFile']).then((said) => said.trim(), () => '')
  const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  const files = [
    ...listed.map((path) => join(root, path)), join(root, '.git', 'info', 'attributes'),
    own ? own.replace(/^~(?=\/)/, homedir()) : join(xdg, 'git', 'attributes'),
  ]
  const texts = await Promise.all(files.map((path) => readFile(path, 'utf8').catch(() => '')))
  return texts.some((text) => /(^|\s)filter=lfs(\s|$)/m.test(text))
}

/** The keys a `.lfsconfig` sets that say where large files go: in the work tree, the index, or the last commit. */
async function lfsconfigAddresses(root: string, git: GitIn): Promise<string[]> {
  const sources = [['--file', join(root, '.lfsconfig')], ['--blob', ':.lfsconfig'], ['--blob', 'HEAD:.lfsconfig']]
  const keys: string[] = []
  for (const source of sources) {
    const said = await git(root, ['config', '-z', ...source, '--list']).catch(() => '')
    for (const entry of said.split('\0').filter(Boolean)) {
      const key = entry.split('\n')[0]
      if (LFSCONFIG_ADDRESS.test(key)) keys.push(key)
    }
  }
  return [...new Set(keys)]
}

/** The endpoint `git lfs env` says it uses for this remote, or its default one. */
export function endpointOf(env: string, remote: string): string | undefined {
  const endpoints = new Map<string, string>()
  for (const line of env.split('\n')) {
    const match = /^Endpoint(?: \((.+)\))?=(\S+)/.exec(line.trim())
    if (match) endpoints.set(match[1] ?? '', match[2])
  }
  return endpoints.get(remote) ?? endpoints.get('')
}
