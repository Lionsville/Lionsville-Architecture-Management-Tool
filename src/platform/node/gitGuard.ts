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
 * The folder's configuration is read in one read that says of each key which
 * configuration it came from (`--show-scope`, git 2.26 and newer), and read
 * again whenever anything git reads it by could have changed
 * ({@link configurationsOf}); a read that fails refuses the command rather
 * than letting it run unread.
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import type { BigIntStats } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, realpath, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** How long a read of the configuration may take. */
const READ_TIMEOUT_MS = 20_000

/** As much of a configuration as is read: what `git.ts` takes of any git's answer. */
const READ_MAX = 64 * 1024 * 1024

/**
 * Nothing here may ask a question. Without these a remote that wants a
 * password makes git wait on a pipe for an answer that never comes, and
 * `execFile` waits with it — on the desktop, before the first window has
 * drawn. With them, git fails, and the failure is a refusal the app can name.
 */
const QUIET_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
  // A partial clone fetches what it lacks from any command that reads it;
  // here only a fetch or a pull talks to a remote.
  GIT_NO_LAZY_FETCH: '1',
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
  // `git config` reads this file instead of every other: a read of nothing.
  'GIT_CONFIG',
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

/**
 * Said where a git is not run; the message names the key, for a person to find.
 * `reason` is the refusal without the sentence around it, which the desktop
 * hands the page for a sentence of the page's own (`electron/main/sayable.ts`).
 */
export class GitRefused extends Error {
  readonly reason: string

  constructor(reason: string) {
    super(`git was not run in this folder: ${reason}`)
    this.name = 'GitRefused'
    this.reason = reason
  }

  /**
   * A refusal the app already has a sentence for, said as its key and nothing
   * else: a git too old to read a folder's configuration apart from the
   * person's is the history's own `shell.gitTooOld`, so there is one minimum
   * and one message.
   */
  static keyed(key: 'shell.gitTooOld'): GitRefused {
    const refused = new GitRefused(key)
    refused.message = key
    return refused
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
 * anywhere, and read no file outside the repository. Matched as git matches
 * a key — without regard to case, a name the folder chooses included, so
 * that no spelling of one slips past a rule for another.
 *
 * - `core.*` listed: the repository's format, how it sees the disk (modes,
 *   case, Unicode, links, line endings), and how it keeps its own files.
 * - `user.*`, `author.*`, `committer.*` names and emails: who commits. A
 *   signing key is the person's to name ({@link NEUTRAL}).
 * - `remote.*` addresses, refspecs and what fetching prunes, and
 *   `remote.pushDefault`; `branch.*`: which remote branch a branch follows,
 *   and `branch.sort`. A remote that is a path inside the folder is refused
 *   apart, at the command.
 * - `submodule.*` addresses and state: nothing enters a submodule.
 * - `extensions.*` git knows ({@link EXTENSIONS}); any other is refused.
 * - `init.defaultBranch`; `include.path` and `includeIf.*.path`, whose files
 *   are read and held to the same rules, and which may not lie in the work
 *   tree, where a page can write; `lfs.*` (git-lfs's own settings; its
 *   filter is the person's); `commit.*` but what signs or names a file;
 *   `http.postBuffer`; `credential.useHttpPath`.
 * - What only a command this app never runs reads: `difftool.*`,
 *   `mergetool.*`, `diff.tool`, `merge.tool`, `sendemail.*`, `svn-remote.*`
 *   and `svn.*`.
 * - Settings of display, of housekeeping and of what a pull or push does by
 *   default, and a diff driver's `xfuncname`.
 */
const ALLOWED: readonly RegExp[] = [
  /^core\.(repositoryformatversion|bare|filemode|ignorecase|precomposeunicode|symlinks|logallrefupdates|autocrlf|eol|safecrlf|quotepath|whitespace|untrackedcache|checkstat|trustctime|preloadindex|fscache|longpaths|commitgraph|multipackindex|splitindex|compression|loosecompression|abbrev|warnambiguousrefs|sparsecheckout|sparsecheckoutcone|hidedotfiles|commentchar|commentstring|bigfilethreshold|deltabasecachelimit|packedrefstimeout|filesreflocktimeout|sharedrepository)$/i,
  /^(user|author|committer)\.(name|email|usedconfigonly)$/i,
  /^remote\.[^=]+\.(url|pushurl|fetch|push|tagopt|prune|prunetags|skipdefaultupdate|skipfetchall|mirror|gh-resolved|promisor|partialclonefilter)$/i,
  /^remote\.pushdefault$/i,
  /^branch\.[^=]+\.(remote|pushremote|merge|rebase|description)$/i,
  /^branch\.sort$/i,
  /^submodule\.[^=]+\.(url|active|branch|shallow|ignore)$/i,
  /^extensions\.[a-z0-9-]+$/i,
  /^init\.defaultbranch$/i,
  /^(include\.path|includeif\..+\.path)$/i,
  /^lfs\..+$/i,
  /^commit\.[a-z0-9]+$/i,
  /^http\.postbuffer$/i,
  /^credential\.(.+\.)?usehttppath$/i,
  /^(difftool|mergetool|sendemail|svn-remote|svn)\..+$/i,
  /^diff\.[^=]+\.xfuncname$/i,
  /^(color|column|i18n|advice|status|rerere|gc|pack|index|feature|commitgraph|gui|maintenance|notes|transfer|receive)\..+$/i,
  /^(fetch|pull|push|tag|log|blame|grep|merge|diff|rebase|am|apply)\.[a-z0-9]+$/i,
]

/**
 * What the patterns above take in that does name a program, sign, or read a
 * file after all, and so is held to {@link NEUTRAL} instead.
 */
const NOT_ALLOWED: readonly RegExp[] = [
  /^diff\.(external|guitool|orderfile)$/i,
  /^merge\.guitool$/i,
  /^log\.showsignature$/i,
  /^(commit|tag)\.gpgsign$/i,
  /^tag\.forcesignannotated$/i,
  /^push\.gpgsign$/i,
  /^commit\.template$/i,
  /^gc\.recentobjectshook$/i,
  /^fetch\.bundleuri$/i,
  /^blame\.ignorerevsfile$/i,
  /^lfs\.(customtransfer\..+|extension\..+|standalonetransferagent)$/i,
]

/** The repository extensions git knows and a folder may carry. */
const EXTENSIONS = new Set(['objectformat', 'worktreeconfig', 'preciousobjects', 'refstorage', 'noop', 'noop-v1', 'partialclone'])

/**
 * What a neutral value is worked out from: the folder's and the person's
 * configuration, and the scheme of the address the command talks to, where
 * it talks to one.
 */
type Context = { theirs: (key: string) => string[]; folder: (key: string) => string[]; scheme?: string }

/**
 * What a key is set to where the person's own configuration says nothing:
 * git's default, or no program. A key here is not allowed, and is set again
 * rather than refused.
 */
const NEUTRAL: readonly [RegExp, string | ((context: Context, key: string) => string)][] = [
  [/^(commit|tag)\.gpgsign$/i, 'false'],
  [/^tag\.forcesignannotated$/i, 'false'],
  [/^push\.gpgsign$/i, 'false'],
  // The person's key, or git's own default where they name none.
  [/^user\.signingkey$/i, signingKey],
  [/^gpg\.format$/i, 'openpgp'],
  [/^gpg\.program$/i, 'gpg'],
  [/^gpg\.openpgp\.program$/i, 'gpg'],
  [/^gpg\.x509\.program$/i, 'gpgsm'],
  [/^gpg\.ssh\.program$/i, 'ssh-keygen'],
  [/^gpg\.ssh\.(defaultkeycommand|allowedsignersfile|revocationfile)$/i, ''],
  [/^core\.(askpass|sshcommand|editor|pager)$/i, ''],
  [/^sequence\.editor$/i, ''],
  [/^commit\.template$/i, ''],
  [/^diff\.(external|orderfile)$/i, ''],
  [/^diff\.[^=]+\.(command|textconv)$/i, ''],
  [/^merge\.[^=]+\.driver$/i, ''],
  [/^filter\.[^=]+\.(clean|smudge|process)$/i, ''],
  [/^filter\.[^=]+\.required$/i, requiredFilter],
  // No proxy from the folder, and none of the person's turned off either:
  // theirs, or the one the process's environment names.
  [/^(http|remote\.[^=]+)\.proxy$/i, (context) => context.theirs('http.proxy').at(-1) ?? environmentProxy(context.scheme)],
  [/^branch\.[^=]+\.mergeoptions$/i, ''],
  [/^submodule\.[^=]+\.update$/i, 'none'],
  [/^core\.attributesfile$/i, ''],
  [/^core\.excludesfile$/i, ''],
]

/**
 * The key git signs with where the folder names one and the person does not.
 * For a key of gpg's or x509's, git's own default: who commits. For an ssh
 * key there is no default that a setting can bring back — git's is the
 * person's `gpg.ssh.defaultKeyCommand`, which a named key, even an empty
 * one, stands in front of — so where the person signs, the command is
 * refused rather than signed with a key guessed at; where they do not, no
 * key is named.
 */
function signingKey(context: Context): string {
  const format = (context.theirs('gpg.format').at(-1) ?? 'openpgp').toLowerCase()
  if (format === 'ssh') {
    const signs = ['commit.gpgsign', 'tag.gpgsign'].some((key) => /^(true|yes|on|1)$/i.test(context.theirs(key).at(-1) ?? ''))
    if (signs) throw new GitRefused('its configuration names a signing key, and you sign with ssh and name none of your own; set user.signingKey in your own configuration')
    return ''
  }
  const last = (key: string) => context.folder(key).at(-1) ?? context.theirs(key).at(-1)
  const name = last('user.name')
  const email = last('user.email')
  return name && email ? `${name} <${email}>` : ''
}

/**
 * Whether a filter the folder requires is required: as the person has it,
 * where they define that filter; where they do not, the folder requires a
 * filter only it could run — an LFS installed in the folder alone — and
 * the command is refused, naming the filter, rather than committing its
 * files whole.
 */
function requiredFilter(context: Context, key: string): string {
  const name = /^filter\.(.+)\.required$/i.exec(key)![1]
  const defined = ['clean', 'smudge', 'process'].some((variable) => context.theirs(`filter.${name}.${variable}`).length > 0)
  const folderRequires = /^(true|yes|on|1)$/i.test(context.folder(key).at(-1) ?? '')
  if (!defined && folderRequires) {
    throw new GitRefused(`it requires the filter ${name}, which only its own configuration defines; install it in your own configuration (for git-lfs: git lfs install)`)
  }
  return context.theirs(key).at(-1) ?? 'false'
}

/**
 * The proxy the process's environment names for the address the command
 * talks to, as curl would take it: `https_proxy` for a secure one,
 * `http_proxy` for a plain one, `all_proxy` for either.
 */
function environmentProxy(scheme?: string): string {
  const env = process.env
  const secure = env.https_proxy ?? env.HTTPS_PROXY
  const plain = env.http_proxy ?? env.HTTP_PROXY
  const either = env.all_proxy ?? env.ALL_PROXY
  return (scheme === 'http' ? plain : secure) ?? either ?? ''
}

/** A key git takes from its first value, so a later one cannot set it again. */
const FIRST_VALUE: readonly RegExp[] = [
  /^core\.gitproxy$/i, /^remote\.[^=]+\.(uploadpack|receivepack)$/i,
]

/**
 * A key whose every value counts, and that no value set after it can take
 * back: a rewrite of a remote's address — which an empty value would make a
 * rewrite of every address.
 */
const NO_TAKING_BACK: readonly RegExp[] = [/^url\..+\.(insteadof|pushinsteadof)$/i]

/**
 * A list that an empty value empties: emptied, and filled with the person's
 * own again, in their order. A credential helper, and a header sent with
 * every request.
 */
const LISTS: readonly RegExp[] = [/^credential\.(.+\.)?helper$/i, /^http\.(.+\.)?extraheader$/i]

type Entry = { scope: string; origin: string; key: string; value: string }

/** A folder's configuration, apart from the person's. */
type Configurations = { folder: Entry[]; own: Entry[] }

/** The scopes of a folder's own configuration; any other — the machine's, the person's, the command line — is the person's. */
const FOLDER_SCOPES = new Set(['local', 'worktree'])

/**
 * A folder's configuration, apart from the person's, in one read: each key
 * with the scope of the file it came from — a file one includes carries the
 * includer's — so that a folder's key counts as the folder's however it was
 * brought in. A read that fails refuses the command.
 */
async function readConfigurations(root: string): Promise<Configurations> {
  let stdout: string
  try {
    stdout = (await run('git', ['config', '-z', '--show-scope', '--show-origin', '--includes', '--list'], {
      cwd: root, timeout: READ_TIMEOUT_MS, maxBuffer: READ_MAX, windowsHide: true, env: gitEnvironment(),
    })).stdout
  } catch (cause) {
    // No git to run is said as that, by whoever runs git (`gitFailure`).
    if ((cause as { code?: unknown }).code === 'ENOENT') throw cause
    const said = String((cause as { stderr?: unknown }).stderr ?? '')
    if (/unknown option|show-scope/.test(said)) throw GitRefused.keyed('shell.gitTooOld')
    throw new GitRefused('its configuration could not be read')
  }
  // A scope, an origin, then a key and its value apart by the first line
  // break — a value is a command, with dots and spaces of its own — each
  // ended by NUL.
  const fields = stdout.split('\0')
  const folder: Entry[] = []
  const own: Entry[] = []
  for (let at = 0; at + 2 < fields.length; at += 3) {
    const pair = fields[at + 2]
    const brk = pair.indexOf('\n')
    const entry = {
      scope: fields[at], origin: fields[at + 1],
      key: brk < 0 ? pair : pair.slice(0, brk), value: brk < 0 ? '' : pair.slice(brk + 1),
    }
    ;(FOLDER_SCOPES.has(entry.scope) ? folder : own).push(entry)
  }
  return { folder, own }
}

/**
 * A read is kept for the next git with the folder, and read again the moment
 * anything git reads its configuration by could have changed: every file it
 * came from and every file it names to include, whether there yet or not; the
 * configuration files of the repository, found as git finds them — a `.git`
 * that is a pointer followed to the real one, and a worktree's common one —
 * with what a conditional include looks at, the branch (`HEAD` and a
 * reftable's `tables.list`, by their contents, since a switch in a reftable
 * repository changes nothing else); the person's own files; and the
 * environment git reads them by. Everything is looked at before the read, so
 * that a change during it is a change the next git sees; a read that names a
 * file the last did not is kept under the files it knew, and read once more.
 */
const kept = new Map<string, { fingerprint: string; configurations: Configurations; files: string[] }>()

async function configurationsOf(root: string): Promise<Configurations> {
  const held = kept.get(root)
  const files = [...new Set([...await repositoryFiles(root), ...personalFiles(), ...held?.files ?? []])]
  const fingerprint = await fingerprintOf(files)
  if (held && held.fingerprint === fingerprint) return held.configurations
  const configurations = await readConfigurations(root)
  const named = [...configurations.folder, ...configurations.own].flatMap((entry) => {
    const from = fileOf(root, entry.origin)
    return [...from ? [from] : [], ...includedFile(root, entry) ?? []]
  })
  kept.set(root, { fingerprint, configurations, files: [...new Set([...files, ...named])] })
  return configurations
}

/** The repository's own files that git reads its configuration by, found as git finds them. */
async function repositoryFiles(root: string): Promise<string[]> {
  const { dotGit, gitDir, common } = await repositoryDirs(root)
  return [
    dotGit, join(gitDir, 'commondir'), join(common, 'config'), join(gitDir, 'config.worktree'),
    join(gitDir, 'HEAD'), join(gitDir, 'reftable', 'tables.list'), join(common, 'reftable', 'tables.list'),
  ]
}

/** Where the repository is, found as git finds it: a `.git` that points elsewhere followed, and a worktree's common directory. */
async function repositoryDirs(root: string): Promise<{ dotGit: string; gitDir: string; common: string }> {
  const dotGit = join(root, '.git')
  const pointer = await readFile(dotGit, 'utf8').catch(() => undefined)
  const gitDir = pointer?.startsWith('gitdir:') ? resolve(root, pointer.slice('gitdir:'.length).trim()) : dotGit
  const common = await readFile(join(gitDir, 'commondir'), 'utf8').then((named) => resolve(gitDir, named.trim()), () => gitDir)
  return { dotGit, gitDir, common }
}

/** The person's own configuration files, where git would look for them. */
function personalFiles(): string[] {
  const home = homedir()
  const xdg = process.env.XDG_CONFIG_HOME || join(home, '.config')
  return [
    process.env.GIT_CONFIG_GLOBAL || join(home, '.gitconfig'), join(xdg, 'git', 'config'),
    ...process.env.GIT_CONFIG_SYSTEM ? [process.env.GIT_CONFIG_SYSTEM] : [],
  ]
}

/** What changes what git reads: each file, by its contents where it is small, and the environment git reads them by. */
export async function fingerprintOf(
  files: readonly string[], look: (path: string) => Promise<BigIntStats> = (path) => stat(path, { bigint: true }),
): Promise<string> {
  const each = await Promise.all([...files].sort().map(async (path) => {
    const held = await look(path).catch(() => undefined)
    if (!held) return `${path}\u0000-`
    // Its contents too, and not only when it was written: a disk that keeps
    // times coarsely — FAT, exFAT — or a change time Windows does not keep can
    // let a rewrite of the same size look like no change.
    const contents = held.isFile() && held.size <= BigInt(READ_MAX)
      ? await readFile(path).then((bytes) => createHash('sha256').update(bytes).digest('hex'), () => '')
      : ''
    return `${path}\u0000${held.ino}:${held.size}:${held.mtimeNs}:${held.ctimeNs}\u0000${contents}`
  }))
  const env = process.env
  const said = ['GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM',
    'XDG_CONFIG_HOME', 'HOME', ...Object.keys(env).filter((name) => /^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(name)).sort()]
  return [...each, ...said.map((name) => `${name}=${env[name] ?? ''}`)].join('\u0001')
}

/** The file an include names, where the entry is one. A relative one is relative to the file that includes it. */
function includedFile(root: string, entry: Entry): string[] | undefined {
  if (!/^(include\.path|includeif\..+\.path)$/i.test(entry.key)) return undefined
  const from = fileOf(root, entry.origin)
  const named = entry.value.startsWith('~/') ? join(homedir(), entry.value.slice(2)) : entry.value
  return [isAbsolute(named) ? named : resolve(from ? join(from, '..') : root, named)]
}

/** The path of the file an entry came from, or nothing for one that is no file (the command line). */
function fileOf(root: string, origin: string): string | undefined {
  if (!origin.startsWith('file:')) return undefined
  const path = origin.slice('file:'.length)
  return isAbsolute(path) ? path : resolve(root, path)
}

/**
 * Does the person's own configuration define this filter — a program for it,
 * the machine's or their global one? `git lfs install` defines `lfs` there.
 */
export async function personDefinesFilter(root: string, name: string): Promise<boolean> {
  const { own } = await configurationsOf(root)
  return ['clean', 'smudge', 'process'].some((variable) => own.some((entry) => sameKey(entry.key, `filter.${name}.${variable}`)))
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
  flags.push(...await folderFlags(root, folder, own, args))
  // TLS is checked as the person checks it, and never less because the folder says so.
  const verify = own.filter((entry) => sameKey(entry.key, 'http.sslverify')).at(-1)?.value ?? 'true'
  return [...flags, '-c', `http.sslVerify=${verify}`, `--work-tree=${root}`]
}

/**
 * The scheme of the address a command talks to: one given among its
 * arguments, or the address of a remote named there. Nothing where it names
 * neither.
 */
function schemeOf(args: readonly string[], folder: (key: string) => string[]): string | undefined {
  for (const arg of args.slice(commandAt(args) + 1)) {
    const address = /^[a-z][a-z0-9+.-]*:\/\//i.test(arg) ? arg : folder(`remote.${arg}.url`).at(-1)
    const scheme = address && /^([a-z][a-z0-9+.-]*):\/\//i.exec(address)?.[1]
    if (scheme) return scheme.toLowerCase()
  }
  return undefined
}

/** Two keys as git compares them: section and variable without regard to case. */
function sameKey(one: string, other: string): boolean {
  return one.toLowerCase() === other.toLowerCase()
}

/**
 * A key that is refused outright, or that needs nothing set after it: one
 * {@link always} sets, or a work tree that is this folder. Answers whether
 * the key is settled; throws where it is refused.
 */
async function settledApart(root: string, key: string, context: Context): Promise<boolean> {
  const lower = key.toLowerCase()
  if (key.includes('=')) throw new GitRefused(`its configuration names a key no setting can reach (${key})`)
  if (ALWAYS_SET.has(lower)) return true
  if (lower === 'core.worktree') {
    const named = context.folder(key).at(-1) ?? ''
    if (!await sameFolder(root, resolve(root, '.git', named))) throw new GitRefused(`its configuration works in another folder (core.worktree = ${named})`)
    return true
  }
  const extension = /^extensions\.(.+)$/i.exec(key)
  if (extension && !EXTENSIONS.has(extension[1].toLowerCase())) throw new GitRefused(`its configuration names a repository extension this app does not know (${key})`)
  if (FIRST_VALUE.some((pattern) => pattern.test(key))) throw new GitRefused(`its configuration names a program no setting can override (${key})`)
  if (NO_TAKING_BACK.some((pattern) => pattern.test(key))) throw new GitRefused(`its configuration rewrites remote addresses in a way no setting can take back (${key})`)
  return false
}

async function folderFlags(root: string, folder: Entry[], own: Entry[], args: readonly string[]): Promise<string[]> {
  const flags: string[] = []
  const command = commandOf(args)
  const valuesIn = (entries: Entry[]) => (key: string) => entries.filter((entry) => sameKey(entry.key, key)).map((entry) => entry.value)
  const context: Context = { theirs: valuesIn(own), folder: valuesIn(folder), scheme: schemeOf(args, valuesIn(folder)) }
  const keys = [...new Map(folder.map((entry) => [entry.key.toLowerCase(), entry.key])).values()]
  const lists = new Set<RegExp>()
  const emptied: string[] = []
  for (const key of keys) {
    if (await settledApart(root, key, context)) continue
    const list = LISTS.find((pattern) => pattern.test(key))
    if (list) {
      lists.add(list)
      emptied.push(key)
      continue
    }
    if (ALLOWED.some((pattern) => pattern.test(key)) && !NOT_ALLOWED.some((pattern) => pattern.test(key))) continue
    const person = context.theirs(key).at(-1)
    const neutral = NEUTRAL.find(([pattern]) => pattern.test(key))?.[1]
    if (person === undefined && neutral === undefined) {
      throw new GitRefused(`its configuration sets ${key}, which this app does not run git with; remove it, or use git yourself in this folder`)
    }
    // A required filter is decided even where the person has a value, since
    // theirs may be for a filter they do not define.
    const value = /^filter\..+\.required$/i.test(key) ? requiredFilter(context, key) : person ?? (typeof neutral === 'function' ? neutral(context, key) : neutral)
    flags.push('-c', `${key}=${value}`)
  }
  for (const list of lists) {
    // Emptied — the list as a whole, and each key of the folder's for one
    // address — then the person's own again, in their order.
    const whole = list === LISTS[0] ? 'credential.helper' : 'http.extraHeader'
    const forOne = [...new Set(emptied.filter((one) => list.test(one) && !sameKey(one, whole)))]
    for (const key of [whole, ...forOne]) flags.push('-c', `${key}=`)
    for (const entry of own) if (list.test(entry.key)) flags.push('-c', `${entry.key}=${entry.value}`)
    // A header for one address outranks every one for all of them, so that
    // one is kept by the person's own named again for that address.
    if (list === LISTS[1]) {
      for (const key of forOne) {
        for (const entry of own) if (sameKey(entry.key, whole) || sameKey(entry.key, key)) flags.push('-c', `${key}=${entry.value}`)
      }
    }
  }
  await refuseIncludesInWorkTree(root, folder)
  if (REMOTE_COMMANDS.has(command)) {
    await refuseRemotesInside(root, folder)
    refuseRemotesNotConfigured([...folder, ...own])
    await refuseRemotesOfOld(root)
    await refuseAddressGiven(root, args, [...folder, ...own])
  }
  return flags
}

/** The remotes a configuration names: those with an address of their own. */
function configuredRemotes(entries: readonly Entry[]): Set<string> {
  return new Set(entries.flatMap((entry) => /^remote\.(.+)\.url$/i.exec(entry.key)?.[1] ?? []))
}

/**
 * The app talks only to a remote the configuration names, never to what a
 * branch says its remote is where that is no remote: git reads such a name as
 * an address — `./inner` a repository inside the folder, `.` the folder's
 * own — and runs the hooks of one it pushes to on this machine.
 */
function refuseRemotesNotConfigured(entries: readonly Entry[]): void {
  const remotes = configuredRemotes(entries)
  for (const entry of entries) {
    if (!/^(branch\..+\.(remote|pushremote)|remote\.pushdefault)$/i.test(entry.key)) continue
    if (!remotes.has(entry.value)) throw new GitRefused(`its configuration names as a remote something that is none (${entry.key} = ${entry.value})`)
  }
}

/**
 * A remote named the way git did before it kept remotes in its
 * configuration — a file in `.git/remotes` or `.git/branches` — is out of
 * sight of every check here, and refused.
 */
async function refuseRemotesOfOld(root: string): Promise<void> {
  const { common } = await repositoryDirs(root)
  for (const folder of ['remotes', 'branches']) {
    const named = await readdir(join(common, folder)).catch(() => [] as string[])
    if (named.length > 0) throw new GitRefused(`its repository names a remote the old way, in .git/${folder}; remove it, or name the remote in its configuration`)
  }
}

/**
 * The repository a fetch, a pull, a push or a listing is given, where it is
 * given one that is no configured remote: an address, held to the same rule
 * as a remote's.
 */
async function refuseAddressGiven(root: string, args: readonly string[], entries: readonly Entry[]): Promise<void> {
  const at = commandAt(args)
  if (!['fetch', 'pull', 'push', 'ls-remote'].includes(args[at])) return
  const given = args.slice(at + 1).find((arg) => !arg.startsWith('-'))
  if (given === undefined || configuredRemotes(entries).has(given)) return
  await refuseAddressInside(root, given, 'the repository it was given')
}

/** An address that is a path inside this folder is refused, as a remote's is. */
export async function refuseAddressInside(root: string, address: string, what: string): Promise<void> {
  const path = localPathOf(root, address)
  if (path !== undefined && await inside(root, path)) {
    throw new GitRefused(`its remote is a repository inside the folder itself (${what})`)
  }
}

/**
 * A file the folder's configuration includes may not lie in the work tree,
 * where a page can write it: only inside `.git`, or outside the folder.
 */
async function refuseIncludesInWorkTree(root: string, folder: Entry[]): Promise<void> {
  for (const entry of folder) {
    if (!/^(include\.path|includeif\..+\.path)$/i.test(entry.key)) continue
    const [path] = includedFile(root, entry)!
    if (await inside(root, path) && !await inside(join(root, '.git'), path)) {
      throw new GitRefused(`its configuration includes a file in the folder itself, where anything can write it (${entry.key})`)
    }
  }
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
    if (/^remote\..+\.(url|pushurl)$/i.test(entry.key)) await refuseAddressInside(root, entry.value, entry.key)
  }
}
