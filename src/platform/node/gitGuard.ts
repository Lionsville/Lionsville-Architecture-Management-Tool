// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every git the app runs in a folder is run with, and what it refuses to
 * run at all: **a folder's own configuration is taken for what a folder needs,
 * and for nothing else.**
 *
 * A folder arrives from anywhere — a zip, a shared drive, a clone — and its
 * `.git/config` is a file anybody could have written. Git reads it on every
 * command, and much of what it can say is a program to start, a place to send
 * a credential, or a folder to work in other than this one. So the folder's
 * configuration is read, apart from everybody else's, before every git with a
 * folder, and each key it sets is one of three things:
 *
 * - **Allowed** ({@link ALLOWED}): what a repository needs to be one — its
 *   format, its line endings, who commits, its remotes' addresses and
 *   branches — and settings that start nothing and send nothing anywhere.
 * - **Set again, after it**: to the person's own value — the machine's
 *   configuration, their global one, what the process was started with — or,
 *   where they have none, to git's default or to no program at all
 *   ({@link NEUTRAL}). A credential helper is a list, which is emptied and
 *   filled with the person's own again.
 * - **Refused**: a key git takes from its first value, so that nothing set
 *   after it wins; a key named with an `=`, which `-c` cannot reach; a
 *   repository extension git may not know; a work tree other than this
 *   folder; and any other key the folder sets that is not allowed and has no
 *   value to set in its place. The command is not run, and the refusal says
 *   which key, so a person can remove it or use git themselves.
 *
 * And always, whatever the folder says: no hook, no file-system monitor, no
 * `ext::` transport, no command for alternate references, no signature shown
 * in a log, no submodule entered, TLS checked, and this folder the work tree.
 * A remote that is a path inside this folder is refused: a page can write a
 * repository there as plain files, and git runs the hooks of a repository it
 * pushes to on this machine as that repository's own.
 *
 * The folder's configuration is read at most once per change of the files it
 * is read from: each read keeps the fingerprints of every file it came from,
 * and the next git with the folder only compares them.
 */
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** How long a read of the configuration may take. */
const READ_TIMEOUT_MS = 20_000

/**
 * Nothing here may ask a question. Without these a remote that wants a
 * password makes git wait on a pipe for an answer that never comes, and
 * `execFile` waits with it — on the desktop, before the first window has
 * drawn. With them, git fails, and the failure is a refusal the app can name.
 */
const QUIET_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
}

/** The `ssh` git runs when the process names none: one that never asks. */
const QUIET_SSH = 'ssh -o BatchMode=yes'

/**
 * What would point git somewhere other than the folder it is run in: a
 * repository, a work tree, an index or an object store the process was
 * started with — a git hook that started this process hands it its own.
 */
const ELSEWHERE_ENV = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR', 'GIT_NAMESPACE', 'GIT_CEILING_DIRECTORIES',
]

/**
 * The environment every git here runs in. An `ssh` command the process was
 * already given is kept: whoever set it chose the key and the host file, and
 * took on keeping it from asking — a process that runs unattended with a key
 * of its own names it this way, and overwriting it would push with no key at
 * all. Where none is set, the quiet one above.
 */
export function gitEnvironment(from: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const ssh = from.GIT_SSH_COMMAND?.trim() ? from.GIT_SSH_COMMAND : QUIET_SSH
  const kept = { ...from }
  for (const name of ELSEWHERE_ENV) delete kept[name]
  return { ...kept, ...QUIET_ENV, GIT_SSH_COMMAND: ssh }
}

/** Where the empty hooks folder is: the app's own, where main says; a temporary one of this process's where nobody does. */
let hooksFolder: Promise<string> | undefined

/**
 * The empty folder every git here is told its hooks are in. Main names one
 * in its own data folder at start; made where it is not there, and emptied of
 * nothing — it is the app's, which no page reaches.
 */
export function useHooksFolder(path: string): void {
  hooksFolder = mkdir(path, { recursive: true }).then(() => path)
}

function noHooks(): Promise<string> {
  hooksFolder ??= mkdtemp(join(tmpdir(), 'lvarch-no-hooks-'))
  return hooksFolder
}

/** Said where a git is not run; the message names the key, for a person to find. */
export class GitRefused extends Error {
  constructor(reason: string) {
    super(`git was not run in this folder: ${reason}`)
    this.name = 'GitRefused'
  }
}

/** What every git is run with, whatever the folder says. */
async function always(): Promise<string[]> {
  return [
    '-c', `core.hooksPath=${await noHooks()}`,
    '-c', 'core.fsmonitor=false',
    '-c', 'protocol.ext.allow=never',
    '-c', 'core.alternateRefsCommand=',
    '-c', 'log.showSignature=false',
    '-c', 'submodule.recurse=false',
    '-c', 'fetch.recurseSubmodules=false',
    '-c', 'push.recurseSubmodules=no',
  ]
}

/** The keys {@link always} sets, which the folder's own value cannot then change. */
const ALWAYS_SET = new Set([
  'core.hookspath', 'core.fsmonitor', 'protocol.ext.allow', 'core.alternaterefscommand', 'log.showsignature',
  'submodule.recurse', 'fetch.recursesubmodules', 'push.recursesubmodules', 'http.sslverify',
])

/**
 * What a folder's configuration may say, as it says it: what a repository
 * needs to be one, and settings that start no program, send nothing
 * anywhere, and read no file outside the repository. Each is a key as git
 * spells it — section and variable in lower case — with `*` for a name the
 * folder chooses (a remote's, a branch's, a submodule's).
 *
 * - `core.*` listed: the repository's format, how it sees the disk (modes,
 *   case, Unicode, links, line endings), and how it keeps its own files.
 * - `user.*`, `author.*`, `committer.*`: who commits. A signing key names a
 *   key, never a program: the signer is the person's own.
 * - `remote.*` addresses, refspecs and what fetching prunes; `branch.*`:
 *   which remote branch a branch follows. A remote that is a path inside the
 *   folder is refused apart, at the command.
 * - `submodule.*` addresses and state: nothing enters a submodule.
 * - `extensions.*` git knows ({@link EXTENSIONS}); any other is refused.
 * - `init.defaultbranch`, `include.path` and `includeif.*.path` (what they
 *   include is read, and held to the same rules), `lfs.*` (git-lfs's own
 *   settings; its filter is the person's), and settings of display, of
 *   housekeeping and of what a pull or push does by default.
 */
const ALLOWED: readonly RegExp[] = [
  /^core\.(repositoryformatversion|bare|filemode|ignorecase|precomposeunicode|symlinks|logallrefupdates|autocrlf|eol|safecrlf|quotepath|whitespace|untrackedcache|checkstat|trustctime|preloadindex|fscache|longpaths|commitgraph|multipackindex|splitindex|compression|loosecompression|abbrev|warnambiguousrefs|sparsecheckout|sparsecheckoutcone|hidedotfiles|commentchar|commentstring|bigfilethreshold|deltabasecachelimit|packedrefstimeout|filesreflocktimeout)$/,
  /^(user|author|committer)\.(name|email|signingkey|usedconfigonly)$/,
  /^remote\.[^=]+\.(url|pushurl|fetch|push|tagopt|prune|prunetags|skipdefaultupdate|skipfetchall|mirror|gh-resolved|promisor|partialclonefilter)$/,
  /^branch\.[^=]+\.(remote|pushremote|merge|rebase|description)$/,
  /^submodule\.[^=]+\.(url|active|branch|shallow|ignore)$/,
  /^extensions\.[a-z0-9-]+$/,
  /^init\.defaultbranch$/,
  /^(include\.path|includeif\..+\.path)$/,
  /^lfs\..+$/,
  /^(color|column|i18n|advice|status|rerere|gc|pack|index|feature|commitgraph|gui|maintenance|notes|transfer|receive)\..+$/,
  /^(fetch|pull|push|tag|log|blame|grep|merge|diff|rebase|am|apply)\.[a-z0-9]+$/,
]

/**
 * The display, housekeeping and default settings above that do name a
 * program or a place after all, and so are held to {@link NEUTRAL} instead.
 */
const NOT_ALLOWED: readonly RegExp[] = [
  /^diff\.(external|tool|guitool|orderfile)$/,
  /^merge\.(tool|guitool)$/,
  /^log\.showsignature$/,
  /^tag\.gpgsign$/,
  /^gc\.recentobjectshook$/,
  /^fetch\.bundleuri$/,
  /^blame\.ignorerevsfile$/,
  /^lfs\.(customtransfer\..+|extension\..+|standalonetransferagent)$/,
]

/** The repository extensions git knows and a folder may carry. */
const EXTENSIONS = new Set(['objectformat', 'worktreeconfig', 'preciousobjects', 'refstorage', 'noop', 'noop-v1', 'partialclone'])

/**
 * What a key is set to where the person's own configuration says nothing:
 * git's default, or no program. A key here is not allowed, and is set again
 * rather than refused.
 */
const NEUTRAL: readonly [RegExp, string][] = [
  [/^(commit|tag)\.gpgsign$/, 'false'],
  [/^gpg\.format$/, 'openpgp'],
  [/^gpg\.program$/, 'gpg'],
  [/^gpg\.openpgp\.program$/, 'gpg'],
  [/^gpg\.x509\.program$/, 'gpgsm'],
  [/^gpg\.ssh\.program$/, 'ssh-keygen'],
  [/^gpg\.ssh\.(defaultkeycommand|allowedsignersfile|revocationfile)$/, ''],
  [/^core\.(askpass|sshcommand|editor|pager)$/, ''],
  [/^sequence\.editor$/, ''],
  [/^diff\.(external|orderfile)$/, ''],
  [/^diff\.[^=]+\.(command|textconv)$/, ''],
  [/^merge\.[^=]+\.driver$/, ''],
  [/^filter\.[^=]+\.(clean|smudge|process)$/, ''],
  [/^filter\.[^=]+\.required$/, 'false'],
  [/^(http|remote\.[^=]+)\.proxy$/, ''],
  [/^http\.extraheader$/, ''],
  [/^branch\.[^=]+\.mergeoptions$/, ''],
  [/^submodule\.[^=]+\.update$/, 'none'],
  [/^core\.attributesfile$/, ''],
  [/^core\.excludesfile$/, ''],
]

/** A key git takes from its first value, so a later one cannot set it again. */
const FIRST_VALUE: readonly RegExp[] = [
  /^core\.gitproxy$/, /^remote\.[^=]+\.(uploadpack|receivepack)$/,
]

/** A credential helper, which is a list: emptied, and filled with the person's own again. */
const CREDENTIAL_HELPER = /^credential\.(.+\.)?helper$/

type Entry = { origin: string; key: string; value: string }

/** A folder's configuration, apart from the person's, and what the read of it came from. */
type Configurations = { folder: Entry[]; own: Entry[]; worktree: boolean; files: string[] }

/** One read of the configuration, as origin, key and value. */
async function entriesIn(root: string, scope: readonly string[]): Promise<Entry[]> {
  try {
    const { stdout } = await run('git', ['config', '-z', '--show-origin', ...scope, '--includes', '--list'], {
      cwd: root, timeout: READ_TIMEOUT_MS, windowsHide: true, env: gitEnvironment(),
    })
    // An origin, then its key and value apart by the first line break — a
    // value is a command, with dots and spaces of its own — each ended by NUL.
    const fields = stdout.split('\0')
    const entries: Entry[] = []
    for (let at = 0; at + 1 < fields.length; at += 2) {
      const pair = fields[at + 1]
      const brk = pair.indexOf('\n')
      entries.push({ origin: fields[at], key: brk < 0 ? pair : pair.slice(0, brk), value: brk < 0 ? '' : pair.slice(brk + 1) })
    }
    return entries
  } catch {
    return []
  }
}

/** The path of the file an entry came from, or nothing for one that is no file (the command line). */
function fileOf(root: string, origin: string): string | undefined {
  if (!origin.startsWith('file:')) return undefined
  const path = origin.slice('file:'.length)
  return isAbsolute(path) ? path : resolve(root, path)
}

/**
 * What the folder keeps — `.git/config`, what it includes, a worktree's own —
 * read apart from all of it, so that what is left is the machine's, the
 * person's global one and what the process was started with.
 */
async function readConfigurations(root: string): Promise<Configurations> {
  const [all, local] = await Promise.all([entriesIn(root, []), entriesIn(root, ['--local'])])
  const worktree = local.some((entry) => entry.key === 'extensions.worktreeconfig' && /^(true|yes|on|1)$/i.test(entry.value))
  const folder = worktree ? [...local, ...await entriesIn(root, ['--worktree'])] : local
  const counted = new Map<string, number>()
  const id = (entry: Entry) => `${entry.origin}\u0001${entry.key}\u0001${entry.value}`
  for (const entry of folder) counted.set(id(entry), (counted.get(id(entry)) ?? 0) + 1)
  const own = all.filter((entry) => {
    const left = counted.get(id(entry)) ?? 0
    if (left === 0) return true
    counted.set(id(entry), left - 1)
    return false
  })
  const files = [...new Set([
    ...all.map((entry) => fileOf(root, entry.origin)).filter((path): path is string => path !== undefined),
    ...includedFiles(root, all),
    ...configFiles(root),
  ])]
  return { folder, own, worktree, files }
}

/**
 * The files an `include.path` names, whether they are there yet or not: one
 * written after the read is one the next read must see. A relative one is
 * relative to the file that includes it.
 */
function includedFiles(root: string, entries: readonly Entry[]): string[] {
  return entries.flatMap((entry) => {
    if (!/^(include\.path|includeif\..+\.path)$/.test(entry.key)) return []
    const from = fileOf(root, entry.origin)
    const named = entry.value.startsWith('~/') ? join(homedir(), entry.value.slice(2)) : entry.value
    return [isAbsolute(named) ? named : resolve(from ? join(from, '..') : root, named)]
  })
}

/** The files a configuration is read from even where none of them is there yet, and what a conditional include looks at. */
function configFiles(root: string): string[] {
  const home = homedir()
  const xdg = process.env.XDG_CONFIG_HOME || join(home, '.config')
  return [
    join(root, '.git', 'config'), join(root, '.git', 'config.worktree'), join(root, '.git', 'HEAD'),
    process.env.GIT_CONFIG_GLOBAL || join(home, '.gitconfig'), join(xdg, 'git', 'config'),
  ]
}

/** Each file as it is now: nothing that differs, nothing read again. */
async function fingerprintOf(files: readonly string[]): Promise<string> {
  const each = await Promise.all(files.map((path) => stat(path).then(
    (held) => `${path}:${held.ino}:${held.size}:${held.mtimeMs}`, () => `${path}:-`,
  )))
  const env = process.env
  return [...each, env.GIT_CONFIG_PARAMETERS ?? '', env.GIT_CONFIG_COUNT ?? '', env.GIT_CONFIG_GLOBAL ?? '',
    env.GIT_CONFIG_NOSYSTEM ?? '', env.GIT_CONFIG_SYSTEM ?? '', env.XDG_CONFIG_HOME ?? '', env.HOME ?? ''].join('\n')
}

/** The last read of each folder's configuration, and the fingerprint of what it was read from. */
const read = new Map<string, { fingerprint: string; configurations: Configurations }>()

/** A folder's configuration, read again only where a file it came from — or might now come from — has changed. */
async function configurationsOf(root: string): Promise<Configurations> {
  const held = read.get(root)
  if (held && await fingerprintOf(held.configurations.files) === held.fingerprint) return held.configurations
  const configurations = await readConfigurations(root)
  read.set(root, { fingerprint: await fingerprintOf(configurations.files), configurations })
  return configurations
}

/** Forget every folder's configuration: for a test that changes one the way no fingerprint sees. */
export function forgetConfigurations(): void {
  read.clear()
}

/** Where the command is among a git's arguments: the first word that is not an option, or the value of one. */
function commandAt(args: readonly string[]): number {
  for (let at = 0; at < args.length; at += 1) {
    if (args[at] === '-c' || args[at] === '-C') { at += 1; continue }
    if (!args[at].startsWith('-')) return at
  }
  return -1
}

/** The command a git is run with. */
export function commandOf(args: readonly string[]): string {
  const at = commandAt(args)
  return at < 0 ? '' : args[at]
}

/** The commands that talk to a remote. */
const REMOTE_COMMANDS = new Set(['fetch', 'pull', 'push', 'ls-remote', 'clone', 'remote'])

/**
 * The path a remote's address names on this machine, or nothing for one that
 * is a host: a `file://` address, or one that is neither a URL nor
 * `host:path`, as git reads them.
 */
function localPathOf(root: string, address: string): string | undefined {
  const url = /^([a-z][a-z0-9+.-]*):\/\//i.exec(address)
  if (url) return url[1].toLowerCase() === 'file' ? decodeURIComponent(address.slice(url[0].length).replace(/^localhost\//, '/')) : undefined
  if (/^[a-z]:[\\/]/i.test(address)) return address
  if (/^[^/\\]+:/.test(address)) return undefined
  return resolve(root, address)
}

/** The real path of something that may not be there, as far as it is. */
async function realOf(path: string): Promise<string> {
  let tail = ''
  let at = path
  for (;;) {
    try {
      return join(await realpath(at), tail)
    } catch {
      const parent = resolve(at, '..')
      if (parent === at) return path
      tail = join(at.slice(parent.length + 1), tail)
      at = parent
    }
  }
}

async function inside(root: string, path: string): Promise<boolean> {
  const [base, real] = await Promise.all([realOf(root), realOf(path)])
  const within = relative(base, real)
  return within === '' || (!within.startsWith('..') && !isAbsolute(within))
}

/**
 * What a git in this folder is run with, before its own arguments: the
 * {@link always} settings, this folder as the work tree, and every key of
 * the folder's configuration set again or allowed — or a {@link GitRefused},
 * where one cannot be.
 */
export async function guardedFlags(root: string, args: readonly string[]): Promise<string[]> {
  const flags = await always()
  const command = commandOf(args)
  // `init` makes the configuration: there is none to read, and a work tree
  // given to it would be written into what it makes.
  if (command === 'init') return flags
  const { folder, own } = await configurationsOf(root)
  flags.push(...await folderFlags(root, folder, own, command))
  // TLS is checked as the person checks it, and never less because the folder says so.
  const verify = own.filter((entry) => entry.key === 'http.sslverify').at(-1)?.value ?? 'true'
  return [...flags, '-c', `http.sslVerify=${verify}`, `--work-tree=${root}`]
}

async function folderFlags(root: string, folder: Entry[], own: Entry[], command: string): Promise<string[]> {
  const flags: string[] = []
  const theirs = (key: string) => own.filter((entry) => entry.key === key).map((entry) => entry.value)
  const keys = [...new Set(folder.map((entry) => entry.key))]
  let credentials = false
  for (const key of keys) {
    if (key.includes('=')) throw new GitRefused(`its configuration names a key no setting can reach (${key})`)
    if (ALWAYS_SET.has(key)) continue
    if (key === 'core.worktree') {
      const named = folder.find((entry) => entry.key === key)!.value
      if (!await sameFolder(root, resolve(root, '.git', named))) throw new GitRefused(`its configuration works in another folder (core.worktree = ${named})`)
      continue
    }
    const extension = /^extensions\.(.+)$/.exec(key)
    if (extension && !EXTENSIONS.has(extension[1])) throw new GitRefused(`its configuration names a repository extension this app does not know (${key})`)
    if (FIRST_VALUE.some((pattern) => pattern.test(key))) throw new GitRefused(`its configuration names a program no setting can override (${key})`)
    if (CREDENTIAL_HELPER.test(key)) { credentials = true; continue }
    if (ALLOWED.some((pattern) => pattern.test(key)) && !NOT_ALLOWED.some((pattern) => pattern.test(key))) continue
    const person = theirs(key).at(-1)
    const neutral = NEUTRAL.find(([pattern]) => pattern.test(key))?.[1]
    if (person === undefined && neutral === undefined) {
      throw new GitRefused(`its configuration sets ${key}, which this app does not run git with; remove it, or use git yourself in this folder`)
    }
    flags.push('-c', `${key}=${person ?? neutral}`)
  }
  if (credentials) {
    flags.push('-c', 'credential.helper=')
    for (const entry of own) if (CREDENTIAL_HELPER.test(entry.key)) flags.push('-c', `${entry.key}=${entry.value}`)
  }
  if (REMOTE_COMMANDS.has(command)) await refuseRemotesInside(root, folder)
  return flags
}

async function sameFolder(one: string, other: string): Promise<boolean> {
  const [a, b] = await Promise.all([realOf(one), realOf(other)])
  return a === b
}

/**
 * A remote whose address is a path inside this folder is refused: a page can
 * write a repository there as plain files, and git runs the hooks of a
 * repository it pushes to on this machine as that repository's own. One
 * outside it — a shared drive, a disk — is the person's, and runs as git runs it.
 */
async function refuseRemotesInside(root: string, folder: Entry[]): Promise<void> {
  for (const entry of folder) {
    if (!/^remote\..+\.(url|pushurl)$/.test(entry.key)) continue
    const path = localPathOf(root, entry.value)
    if (path !== undefined && await inside(root, path)) {
      throw new GitRefused(`its remote is a repository inside the folder itself (${entry.key})`)
    }
  }
}
