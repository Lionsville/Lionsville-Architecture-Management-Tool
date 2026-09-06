/**
 * History, using the git that is already on the machine.
 *
 * Layer two of ADR-0003. Layer one is the folder itself, which diffs well and
 * costs nothing; this is the part that lets a person take a snapshot, look at
 * what changed between two of them, and go back — without leaving the app and
 * without the app pretending to be a git client.
 *
 * **The system binary, through `execFile`.** No library: the six commands below
 * are the whole of what this needs, `execFile` runs them without a shell (so
 * nothing here can be confused by a folder name with a space or a semicolon in
 * it), and a git library would be a dependency that has to be trusted with the
 * user's repository. The cost is that a machine without git has no history —
 * which is why the first thing this file exports is a question, and why every
 * caller degrades rather than fails.
 *
 * Three deliberate hardenings, all of them about not hanging or surprising:
 *
 * - `--no-verify`, because a pre-commit hook belongs to the repository's owner
 *   and their linter must not decide whether this app can save a snapshot.
 * - `GIT_TERMINAL_PROMPT=0` and a timeout, because a git that wants a password
 *   waits forever and there is nobody at this terminal to answer it.
 * - An identity only when the machine has none configured, so a snapshot works
 *   on a fresh laptop and uses the person's real name everywhere else.
 *
 * No Electron in here, so it can be tested against a real repository.
 */
import { execFile } from 'node:child_process'
import { access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** One entry in the history, as a person reads it. */
export type GitCommit = {
  sha: string
  subject: string
  /** Epoch milliseconds, as `Date.now()` gives them. */
  at: number
  author: string
}

/** A file as it was at a commit. Text only — see `filesAt`. */
export type GitFile = { path: string; text: string }

/** Long enough for a large repository, short enough not to look like a hang. */
const TIMEOUT_MS = 20_000

/** A landscape is text; a megabyte of it is a very large one. */
const MAX_OUTPUT = 64 * 1024 * 1024

/** Who a snapshot is by, when the machine has nobody configured. */
const FALLBACK_NAME = 'Architecture Management Tool'
const FALLBACK_EMAIL = 'noreply@lionsville.nl'

/** The separator: a byte that cannot occur in a commit subject. */
const UNIT = '\x1f'

async function git(root: string, args: readonly string[]): Promise<string> {
  const { stdout } = await run('git', args, {
    cwd: root,
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
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
 * history would be the wrong kind of clever.
 */
export async function initRepository(root: string): Promise<void> {
  await git(root, ['init'])
  const ignore = join(root, '.gitignore')
  try {
    await access(ignore)
  } catch {
    await writeFile(ignore, '.DS_Store\nThumbs.db\ndesktop.ini\n', 'utf8')
  }
}

async function hasIdentity(root: string): Promise<boolean> {
  try {
    const email = await git(root, ['config', '--get', 'user.email'])
    return email.trim().length > 0
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
  await git(root, ['add', '-A'])
  try {
    await git(root, ['diff', '--cached', '--quiet'])
    return undefined // exit 0 from --quiet means no staged changes
  } catch {
    // Exit 1 is "there are changes", which is what we are here for.
  }
  const identity = await hasIdentity(root)
    ? []
    : ['-c', `user.name=${FALLBACK_NAME}`, '-c', `user.email=${FALLBACK_EMAIL}`]
  await git(root, [...identity, 'commit', '--no-verify', '-m', message])
  return (await git(root, ['rev-parse', 'HEAD'])).trim()
}

/** The last `limit` snapshots, newest first. Empty for a repository with none. */
export async function history(root: string, limit = 50): Promise<GitCommit[]> {
  let out: string
  try {
    out = await git(root, ['log', `-n${Math.max(1, Math.trunc(limit))}`, `--format=%H${UNIT}%s${UNIT}%at${UNIT}%an`])
  } catch {
    // A repository with no commits yet: `git log` fails rather than saying
    // nothing, which is a fact about git and not about this folder.
    return []
  }
  return out.split('\n').flatMap((line) => {
    const [sha, subject, at, author] = line.split(UNIT)
    if (!sha) return []
    return [{ sha, subject: subject ?? '', at: Number(at) * 1000, author: author ?? '' }]
  })
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
