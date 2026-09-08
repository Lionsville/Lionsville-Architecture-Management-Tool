/**
 * History, using the git that is already on the machine.
 *
 * Layer two of ADR-0003. Layer one is the folder itself, which diffs well and
 * costs nothing; this is the part that lets a person take a snapshot, look at
 * what changed between two of them, and go back — without leaving the app and
 * without the app pretending to be a git client. ADR-0005 extends it to the
 * remote: push, pull, and the one question a person has to answer when the
 * two sides disagree.
 *
 * **The system binary, through `execFile`.** No library: the commands below
 * are the whole of what this needs, `execFile` runs them without a shell (so
 * nothing here can be confused by a folder name with a space or a semicolon in
 * it), and a git library would be a dependency that has to be trusted with the
 * user's repository. The cost is that a machine without git has no history —
 * which is why the first thing this file exports is a question, and why every
 * caller degrades rather than fails.
 *
 * Deliberate hardenings, all of them about not hanging or surprising:
 *
 * - `--no-verify`, because a pre-commit hook belongs to the repository's owner
 *   and their linter must not decide whether this app can save a snapshot.
 * - `GIT_TERMINAL_PROMPT=0`, `ssh -o BatchMode=yes` and a timeout, because a
 *   git that wants a password waits forever and there is nobody at this
 *   terminal to answer it. **The app never handles a credential**: push and
 *   pull use the user's credential helper or fail, and the failure is a
 *   refusal the app can name.
 * - An identity only when the machine has none configured, so a snapshot works
 *   on a fresh laptop and uses the person's real name everywhere else.
 * - `.lionsville-architecture/local.json` is never committed: the snapshot's
 *   `add` excludes it, and `.git/info/exclude` keeps a `git add -A` typed in a
 *   terminal from picking it up either — without touching the user's own
 *   `.gitignore`, which is theirs.
 *
 * And one rule the whole file keeps: **this folder, never an ancestor.** Git
 * walks up until it finds a repository, so every command here first asks
 * `isRepository` — otherwise a working directory nested inside somebody's
 * project reads that project's commits as its own snapshots, and commits into
 * it when one is taken.
 *
 * No Electron in here, so it can be tested against a real repository.
 */
import { execFile } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { LOCAL_SETTINGS_PATH } from '../../src/projects/folderSettings'
import { labelSlug } from '../../src/platform/history'
import type { LabelOutcome } from '../../src/platform/history'
import { BEFORE_SYNC_BRANCH_PREFIX } from '../../src/platform/sync'
import type {
  PullOutcome, PushOutcome, ResolveOutcome, SyncRefusal, SyncRemote, SyncSide,
} from '../../src/platform/sync'

const run = promisify(execFile)

/** One entry in the history, as a person reads it. */
export type GitCommit = {
  sha: string
  subject: string
  /** Epoch milliseconds, as `Date.now()` gives them. */
  at: number
  author: string
  /** What people have called this version: the message of each tag on it (ADR-0008). */
  labels: string[]
}

/** A file as it was at a commit. Text only — see `filesAt`. */
export type GitFile = { path: string; text: string }

/** Long enough for a large repository, short enough not to look like a hang. */
const TIMEOUT_MS = 20_000

/** A network round trip on a slow link, with a large fetch behind it. */
const SYNC_TIMEOUT_MS = 90_000

/** A landscape is text; a megabyte of it is a very large one. */
const MAX_OUTPUT = 64 * 1024 * 1024

/** Who a snapshot is by, when the machine has nobody configured. */
const FALLBACK_NAME = 'Architecture Management Tool'
const FALLBACK_EMAIL = 'noreply@lionsville.nl'

/** What the merge commit of *keep ours* says. English: it is a git message, not UI. */
const KEEP_OURS_MESSAGE = 'Keep this folder\'s version over the remote\'s'

/** The separator: a byte that cannot occur in a commit subject. */
const UNIT = '\x1f'

/**
 * Nothing here may ask a question. Without these a remote that wants a
 * password makes git wait on a pipe for an answer that never comes, and
 * `execFile` waits with it — on the desktop, before the first window has
 * drawn. With them, git fails, and the failure is a refusal the app can name.
 */
const QUIET_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
}

type GitError = Error & { stderr?: string; killed?: boolean; signal?: string; code?: number | string }

async function git(root: string, args: readonly string[], timeout = TIMEOUT_MS): Promise<string> {
  const { stdout } = await run('git', args, {
    cwd: root,
    timeout,
    maxBuffer: MAX_OUTPUT,
    windowsHide: true,
    env: { ...process.env, ...QUIET_ENV },
  })
  return stdout
}

/** Is there a git on this machine at all? */
export async function gitAvailable(): Promise<boolean> {
  try {
    await run('git', ['--version'], { timeout: TIMEOUT_MS, windowsHide: true })
    return true
  } catch {
    return false
  }
}

/**
 * Is this folder a repository *itself*?
 *
 * Deliberately not `rev-parse --is-inside-work-tree`, which says yes for a
 * folder that merely sits inside somebody else's repository — a working
 * directory under `~/projects` often does. Committing everything in THAT repo
 * because a landscape changed is not something to do by accident.
 */
export async function isRepository(root: string): Promise<boolean> {
  try {
    await access(join(root, '.git'))
    return true
  } catch {
    return false
  }
}

/**
 * Start keeping history here.
 *
 * The `.gitignore` covers what an operating system leaves in a folder and
 * nothing of the user's: a file this app wrote is a file worth committing, and
 * a tool that quietly excluded part of somebody's project from their own
 * history would be the wrong kind of clever. The one file of ours that must
 * not travel goes in git's own local exclude list instead.
 */
export async function initRepository(root: string): Promise<void> {
  await git(root, ['init'])
  const ignore = join(root, '.gitignore')
  try {
    await access(ignore)
  } catch {
    await writeFile(ignore, '.DS_Store\nThumbs.db\ndesktop.ini\n', 'utf8')
  }
  await excludeLocalSettings(root)
}

/**
 * Keep this machine's settings file out of history without touching the
 * user's `.gitignore`: `.git/info/exclude` is git's own local, uncommitted
 * ignore list. Idempotent, and nothing when the folder keeps no history.
 */
export async function excludeLocalSettings(root: string): Promise<void> {
  if (!await isRepository(root)) return
  const info = join(root, '.git', 'info')
  const exclude = join(info, 'exclude')
  const held = await readFile(exclude, 'utf8').catch(() => '')
  if (held.split(/\r?\n/).includes(LOCAL_SETTINGS_PATH)) return
  await mkdir(info, { recursive: true })
  const separator = held.length === 0 || held.endsWith('\n') ? '' : '\n'
  await writeFile(exclude, `${held}${separator}${LOCAL_SETTINGS_PATH}\n`, 'utf8')
}

async function hasIdentity(root: string): Promise<boolean> {
  try {
    const email = await git(root, ['config', '--get', 'user.email'])
    return email.trim().length > 0
  } catch {
    return false
  }
}

async function identityArgs(root: string): Promise<string[]> {
  return await hasIdentity(root)
    ? []
    : ['-c', `user.name=${FALLBACK_NAME}`, '-c', `user.email=${FALLBACK_EMAIL}`]
}

/** Is there a commit at all? A fresh repository has a branch and no commits. */
async function hasCommits(root: string): Promise<boolean> {
  try {
    await git(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])
    return true
  } catch {
    return false
  }
}

/**
 * Everything in the folder, committed under one message.
 *
 * `undefined` when there was nothing to commit, which is an ordinary answer:
 * the app writes only what changed, so two snapshots in a row with no editing
 * between them genuinely have nothing to record.
 */
export async function snapshot(root: string, message: string): Promise<string | undefined> {
  // A snapshot of this folder is a snapshot of THIS folder. Without the guard,
  // a working directory inside somebody's repository would have its `add -A`
  // answered by that repository — which is the accident `isRepository` exists
  // to prevent, and which nothing below this line would notice.
  if (!await isRepository(root)) await initRepository(root)
  // Taken back out explicitly, so our commits never contain it whether or not
  // anything else is configured. Not an exclude pathspec: git answers one
  // that names an ignored path with an error about adding ignored files, and
  // `.git/info/exclude` makes the path ignored on every folder we started.
  await git(root, ['add', '-A'])
  await git(root, ['reset', '-q', '--', LOCAL_SETTINGS_PATH])
  try {
    await git(root, ['diff', '--cached', '--quiet'])
    return undefined // exit 0 from --quiet means no staged changes
  } catch {
    // Exit 1 is "there are changes", which is what we are here for.
  }
  await git(root, [...await identityArgs(root), 'commit', '--no-verify', '-m', message])
  return (await git(root, ['rev-parse', 'HEAD'])).trim()
}

/**
 * The last `limit` snapshots, newest first. Empty for a repository with none.
 *
 * With `paths`, only the snapshots that touched one of them (ADR-0008): a
 * pathspec each, relative to the root, and a `*` in one matches within a
 * name — which is how a decision's history follows its number through every
 * title it has had. Renames are not followed on purpose: the format keys a
 * diagram and a description by id, so a moved file IS a different thing.
 */
export async function history(root: string, limit = 50, paths: readonly string[] = []): Promise<GitCommit[]> {
  // Not this folder's history if it is somebody else's: git walks up until it
  // finds a repository, so a folder that keeps none would otherwise be handed
  // the enclosing project's commits and show them as its own snapshots.
  if (!await isRepository(root)) return []
  let out: string
  try {
    out = await git(root, [
      'log', `-n${Math.max(1, Math.trunc(limit))}`, `--format=%H${UNIT}%s${UNIT}%at${UNIT}%an`,
      ...(paths.length ? ['--', ...paths] : []),
    ])
  } catch {
    // A repository with no commits yet: `git log` fails rather than saying
    // nothing, which is a fact about git and not about this folder.
    return []
  }
  const labels = await labelsByCommit(root)
  return out.split('\n').flatMap((line) => {
    const [sha, subject, at, author] = line.split(UNIT)
    if (!sha) return []
    return [{ sha, subject: subject ?? '', at: Number(at) * 1000, author: author ?? '', labels: labels.get(sha) ?? [] }]
  })
}

/**
 * Every tag in the folder, by the commit it marks, as the words it carries.
 *
 * One command for the whole list rather than `%D` per commit: `%D` gives tag
 * NAMES, and the name is a slug — what the person typed is the annotated
 * tag's message. A lightweight tag somebody made in a terminal has no message
 * and is shown by its name, so a mark made anywhere is a mark shown here.
 */
async function labelsByCommit(root: string): Promise<Map<string, string[]>> {
  const held = new Map<string, string[]>()
  let out: string
  try {
    out = await git(root, [
      'for-each-ref', 'refs/tags', '--sort=creatordate',
      `--format=%(objectname)${UNIT}%(*objectname)${UNIT}%(refname:short)${UNIT}%(contents:subject)`,
    ])
  } catch {
    return held
  }
  for (const line of out.split('\n')) {
    const [object, target, name, subject] = line.split(UNIT)
    if (!name) continue
    // An annotated tag is its own object and points at the commit, and its
    // subject is the label; a lightweight one IS the commit, and its
    // "subject" would be the commit's, so it goes by its name.
    const sha = target || object
    const list = held.get(sha) ?? []
    list.push((target && subject?.trim()) || name)
    held.set(sha, list)
  }
  return held
}

/**
 * Mark a snapshot with a label: an annotated tag named from the label's slug,
 * with the label as its message, on that commit (ADR-0008). Never rewrites
 * anything — a label is beside the subject, not instead of it — and never
 * replaces a tag: the second "Board review" in a folder is refused, and the
 * person picks another word.
 */
export async function label(root: string, sha: string, name: string): Promise<LabelOutcome> {
  const tag = labelSlug(name)
  if (!tag) return 'unnamed'
  if (!await isRepository(root)) return 'unnamed'
  try {
    await git(root, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])
    return 'exists'
  } catch {
    // No such tag, which is the ordinary case.
  }
  await git(root, [...await identityArgs(root), 'tag', '-a', tag, '-m', name.trim(), sha])
  return 'done'
}

/**
 * One project folder as it was at a commit.
 *
 * Text only, and that is not a limitation here: the reader that turns these
 * back into a project needs `project.json`, `model.json`, the diagrams, the
 * descriptions and the decisions, and none of those are bitmaps. A mark is
 * skipped, and a project read at a commit therefore has the marks the working
 * copy has — which is right for a diff of the architecture and wrong for
 * nothing anybody asks this for.
 */
export async function filesAt(root: string, sha: string, prefix: string): Promise<GitFile[]> {
  if (!await isRepository(root)) return []
  const listing = await git(root, ['ls-tree', '-r', '--name-only', sha, '--', prefix])
  const paths = listing.split('\n').filter((path) => path && !path.endsWith('.png'))
  const files: GitFile[] = []
  for (const path of paths) {
    try {
      files.push({ path: path.slice(prefix.length).replace(/^\//, ''), text: await git(root, ['show', `${sha}:${path}`]) })
    } catch {
      // A path git can list but not show is one being rewritten under us.
    }
  }
  return files
}

// --- the remote (ADR-0005) ---------------------------------------------------

async function configured(root: string, key: string): Promise<string | undefined> {
  try {
    const value = (await git(root, ['config', '--get', key])).trim()
    return value.length > 0 ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * The remote and branch git would push to, or nothing.
 *
 * Git declares what is true about the folder; this only reads it. The
 * branch's own upstream when it has one; otherwise `origin`, or the only
 * remote there is — a folder that `start()` initialised and that has since
 * been given a remote in a terminal should push without a second ceremony.
 */
export async function remote(root: string): Promise<SyncRemote | undefined> {
  if (!await isRepository(root)) return undefined
  let branch: string
  try {
    branch = (await git(root, ['symbolic-ref', '--short', 'HEAD'])).trim()
  } catch {
    // Detached: there is no branch to push, and nothing to say about it.
    return undefined
  }
  const remotes = (await git(root, ['remote']).catch(() => '')).split('\n').filter(Boolean)
  if (remotes.length === 0) return undefined
  const name = await configured(root, `branch.${branch}.remote`)
    ?? (remotes.includes('origin') ? 'origin' : remotes.length === 1 ? remotes[0] : undefined)
  if (!name) return undefined
  const merge = await configured(root, `branch.${branch}.merge`)
  const url = await configured(root, `remote.${name}.url`)
  return { name, branch: merge?.replace(/^refs\/heads\//, '') ?? branch, url }
}

/**
 * Which refusal a failed network command is.
 *
 * Read off git's own words, because that is all there is: git does not
 * distinguish these by exit code. A password prompt that could not be shown
 * is a credential problem; a host that could not be resolved, a repository
 * that is not there, a connection refused are all "unreachable"; a kill by
 * the timeout is a timeout. Anything unrecognised is unreachable, which is
 * the least specific and therefore the least wrong.
 */
function classify(error: unknown): SyncRefusal {
  const held = error as GitError
  if (held?.killed || held?.signal === 'SIGTERM') return 'timeout'
  const text = `${held?.stderr ?? ''}\n${held?.message ?? ''}`
  if (/terminal prompts disabled|could not read (Username|Password)|Authentication failed|Permission denied \(publickey|Host key verification failed|Invalid username or (password|token)|authentication|HTTP 401|HTTP 403/i.test(text)) {
    return 'credentials'
  }
  return 'unreachable'
}

type Fetched = 'fetched' | 'absent' | SyncRefusal

/** Bring the remote's branch to `FETCH_HEAD`, or say why not. */
async function fetch(root: string, target: SyncRemote): Promise<Fetched> {
  try {
    await git(root, ['fetch', '--no-write-fetch-head', target.name, target.branch], SYNC_TIMEOUT_MS)
    // A second, explicit ref: FETCH_HEAD is per-fetch and easy to confuse.
    await git(root, ['fetch', target.name, `+refs/heads/${target.branch}:refs/remotes/${target.name}/${target.branch}`], SYNC_TIMEOUT_MS)
    return 'fetched'
  } catch (error) {
    const text = String((error as GitError)?.stderr ?? '')
    // The remote is there and has no such branch yet: nothing to pull, and
    // the first push will create it.
    if (/couldn't find remote ref|Couldn't find remote ref/.test(text)) return 'absent'
    return classify(error)
  }
}

const remoteRef = (target: SyncRemote): string => `refs/remotes/${target.name}/${target.branch}`

/**
 * Fast-forward to the remote's branch, and nothing cleverer.
 *
 * Begins with nothing: the caller has taken a snapshot, so the working tree
 * holds no unrecorded work and a fast-forward has a clean tree to move. A
 * merge that would not fast-forward — or one that would touch work the
 * caller did not record — answers *diverged*, and a person decides.
 */
export async function pull(root: string): Promise<PullOutcome> {
  const target = await remote(root)
  if (!target) return 'no-remote'
  const fetched = await fetch(root, target)
  if (fetched === 'absent') return 'done'
  if (fetched !== 'fetched') return fetched
  try {
    await git(root, ['merge', '--ff-only', '--no-verify', remoteRef(target)])
    return 'done'
  } catch {
    return 'diverged'
  }
}

/**
 * Push `HEAD` to the remote's branch, setting the upstream on the first
 * success. A rejection is *diverged* seen from this end: the remote is
 * fetched so the notice has both sides to offer, and the answer says so.
 */
export async function push(root: string): Promise<PushOutcome> {
  const target = await remote(root)
  if (!target) return 'no-remote'
  if (!await hasCommits(root)) return 'done'
  try {
    // `--follow-tags`: the annotated tags reachable from what is pushed — every
    // label this app makes — travel with the branch, so a mark made here is a
    // mark a colleague sees (ADR-0008). Lightweight tags stay behind, which is
    // git's own reading of "annotated means meant".
    await git(root, ['push', '--no-verify', '--follow-tags', '-u', target.name, `HEAD:refs/heads/${target.branch}`], SYNC_TIMEOUT_MS)
    return 'done'
  } catch (error) {
    const text = String((error as GitError)?.stderr ?? '')
    if (/rejected|non-fast-forward|fetch first|stale info/i.test(text)) {
      await fetch(root, target)
      return 'rejected'
    }
    return classify(error)
  }
}

/**
 * The two answers when the sides disagree, and both keep everything.
 *
 * *Theirs*: the local state is put on a branch named for the moment, so it is
 * reachable in any git client, and the working branch is reset to the
 * remote's. *Ours*: a merge commit whose tree is exactly ours and whose
 * parents are both sides, so the remote's history is kept, nothing is
 * force-pushed, and the result fast-forwards for everyone else. Not a merge
 * in the forbidden sense: no line of any file is combined.
 *
 * Both begin with a snapshot of anything unrecorded, so nothing in the folder
 * is lost by the reset in one or left out of the commit in the other. A
 * refusal leaves the folder as it was.
 */
export async function resolve(root: string, side: SyncSide): Promise<ResolveOutcome> {
  const target = await remote(root)
  if (!target) return 'no-remote'
  const fetched = await fetch(root, target)
  if (fetched === 'absent') return 'done'
  if (fetched !== 'fetched') return fetched
  await snapshot(root, 'Before syncing')
  const identity = await identityArgs(root)
  if (side === 'theirs') {
    if (await hasCommits(root)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
      await git(root, ['branch', `${BEFORE_SYNC_BRANCH_PREFIX}${stamp}`, 'HEAD'])
    }
    await git(root, ['reset', '--hard', remoteRef(target)])
    return 'done'
  }
  if (!await hasCommits(root)) {
    // Nothing of ours to keep: "ours" is an empty tree, and a merge would
    // need a first parent. Taking theirs is the same answer.
    await git(root, ['reset', '--hard', remoteRef(target)])
    return 'done'
  }
  await git(root, [
    ...identity, 'merge', '-s', 'ours', '--no-verify', '--allow-unrelated-histories', '--no-ff',
    '-m', KEEP_OURS_MESSAGE, remoteRef(target),
  ])
  return 'done'
}
