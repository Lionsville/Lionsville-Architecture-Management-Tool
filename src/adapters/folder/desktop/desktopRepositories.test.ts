// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's repositories as the desktop composes them, held to every suite
 * in a real temporary folder with the machine's own git: the desktop's handle
 * over the file channel and its history over the git channel, each channel
 * minus the wire — the main process's own functions called directly, with
 * the argument checking that is main's left out, as `IpcDirectoryHandle.test`
 * does for the files. What is left untested is `ipcRenderer.invoke`.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { writeFile as writeOnDisk } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, join } from 'node:path'
import {
  fingerprint, listDirectory, makeDirectory, readFile, removeEntry, writeFile, writeTogether,
} from '../../../../electron/main/fileStore'
import { appliedStepsText, readAppliedSteps } from '../../../platform/node/appliedSteps'
import { gitAvailable, isRepository } from '../../../platform/node/git'
import {
  allTags, changes, commitLog, commitPaths, headOf, readAt, startHistory, tagCommit, treeAt,
} from '../../../platform/node/gitEntries'
import { describeHistoryRepository } from '../../../ports/HistoryRepository.contract'
import { describeImageRepository } from '../../../ports/ImageRepository.contract'
import { describeOrganisationIndex } from '../../../ports/OrganisationIndex.contract'
import { addCrews, ok, over, refusal, renameCrews, step } from '../../../ports/Repositories.contract'
import type { RepositoriesUnderTest } from '../../../ports/Repositories.contract'
import { describeScopeRepository } from '../../../ports/ScopeRepository.contract'
import { describeSettingsRepository } from '../../../ports/SettingsRepository.contract'
import type { DesktopFiles, DesktopHistory } from '../../desktop/channel'
import { folderRepositories } from '../folderRepositories'
import { DesktopFolderGit } from './DesktopFolderGit'
import { desktopStepStore } from './desktopStepStore'
import { IpcDirectoryHandle } from './IpcDirectoryHandle'

const run = promisify(execFile)

const available = await gitAvailable()

const folders: string[] = []
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true })
})

function freshFolder(): string {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), 'lvarch-repositories-')))
  folders.push(folder)
  return folder
}

function filesOver(root: string): DesktopFiles {
  return {
    chooseDirectory: () => Promise.resolve({ root, name: basename(root) }),
    recentDirectories: () => Promise.resolve([{ root, name: basename(root) }]),
    list: (held, path) => listDirectory(held, path),
    makeDirectory: (held, path) => makeDirectory(held, path),
    read: (held, path) => readFile(held, path),
    write: (held, path, bytes) => writeFile(held, path, bytes),
    writeTogether: (held, writes, removals) => writeTogether(held, writes, removals),
    remove: (held, path, options) => removeEntry(held, path, options),
    fingerprint: (held, path) => fingerprint(held, path),
    revealInFolder: () => Promise.resolve(),
    saveDocument: () => Promise.resolve(true),
    watch: () => Promise.resolve(),
    unwatch: () => Promise.resolve(),
    onChanged: () => () => {},
  }
}

/** The history the repositories read, minus the wire; the rest of the channel is not theirs to call. */
function historyOver(): DesktopHistory {
  const unused = () => Promise.reject(new Error('not the repositories’ to call'))
  return {
    available: () => gitAvailable(),
    isRepository: (root) => isRepository(root),
    init: unused, snapshot: unused, history: unused, filesAt: unused, label: unused,
    remote: unused, pull: unused, push: unused, resolve: unused, excludeLocal: unused,
    startHistory: (root) => startHistory(root),
    changes: (root) => changes(root),
    commitPaths: (root, paths, message) => commitPaths(root, paths, message),
    head: (root) => headOf(root),
    log: (root, wanted) => commitLog(root, wanted),
    treeAt: (root, sha, within) => treeAt(root, sha, within),
    readAt: (root, sha, paths) => readAt(root, sha, paths),
    tags: (root) => allTags(root),
    tag: (root, sha, name, message) => tagCommit(root, sha, name, message),
  }
}

function onTheDesktop(folder = freshFolder()): RepositoriesUnderTest {
  const root = new IpcDirectoryHandle(filesOver(folder), folder, basename(folder))
  const repositories = folderRepositories({ root, git: new DesktopFolderGit(historyOver(), folder) })
  return {
    repositories,
    // Half a write of a model, on the disk: the scope reads to be looked at, and takes no step.
    spoil: async (scope) => {
      const state = await repositories.scopes.state(scope)
      if (state) await writeOnDisk(join(folder, state.address, 'model.json'), '{ half a write')
    },
  }
}

describe.skipIf(!available)('the folder’s repositories on the desktop, with git', () => {
  describeScopeRepository('desktop folder with git', () => onTheDesktop())
  describeOrganisationIndex('desktop folder with git', () => onTheDesktop())
  describeHistoryRepository('desktop folder with git', () => onTheDesktop())
  describeImageRepository('desktop folder with git', () => onTheDesktop())
  describeSettingsRepository('desktop folder with git', () => onTheDesktop())

  it('records a scope as a commit git shows a person, and nothing of the scopes under it', async () => {
    const folder = freshFolder()
    const repositories = over(onTheDesktop(folder))
    const acme = await repositories.scope('acme', 'Acme Logistics')
    const rail = await repositories.scope('acme/rail', 'Rail')
    await repositories.steps(acme, addCrews)
    await repositories.steps(rail, addCrews)
    const [entry] = await repositories.history.record({ scopes: [acme], subject: 'Crews for Acme' })
    expect(entry.subject).toBe('Crews for Acme')
    const [commit] = await commitLog(folder, { limit: 1 })
    expect(commit.subject).toBe('Crews for Acme')
    expect(commit.changed).toContain('acme/model.json')
    expect(commit.changed.some((path) => path.startsWith('acme/rail/'))).toBe(false)
    expect((await changes(folder)).map((change) => change.path)).toContain('acme/rail/model.json')
  })

  it('keeps applied step ids in the app’s own data, keyed by the folder, through a restart and never in the folder', async () => {
    const folder = freshFolder()
    let kept: string | undefined
    const settings = {
      readFolderSteps: (root: string) => Promise.resolve(readAppliedSteps(kept, root)),
      writeFolderSteps: (root: string, steps: Record<string, [string, number]>) => {
        kept = appliedStepsText(kept, root, steps)
        return Promise.resolve()
      },
    }
    const open = () => {
      const root = new IpcDirectoryHandle(filesOver(folder), folder, basename(folder))
      return over({ repositories: folderRepositories({
        root, git: new DesktopFolderGit(historyOver(), folder), steps: desktopStepStore(settings, folder),
      }) })
    }
    const first = open()
    const acme = await first.scope('acme', 'Acme Logistics')
    const globex = await first.scope('globex', 'Globex')
    await first.record('start')
    const once = step(addCrews)
    const landed = ok(await first.apply([{ scope: acme, steps: [once] }])).revisions[0]
    const again = open()
    expect(ok(await again.apply([{ scope: acme, steps: [once] }])).revisions).toEqual([landed])
    expect(refusal(await again.apply([{ scope: globex, steps: [once] }]))).toBe('step.elsewhere')
    expect(Object.keys(readAppliedSteps(kept, folder) ?? {})).toEqual([once.stepId])
    expect((await changes(folder)).map((change) => change.path).sort()).toEqual(['acme/docs/crews.md', 'acme/model.json'])
    expect(existsSync(join(folder, '.git/lionsville-architect'))).toBe(false)
  })

  it('pages a history with a branch merged into it once each, and reads each entry against the commit before it', async () => {
    const folder = freshFolder()
    const repositories = over(onTheDesktop(folder))
    const sh = (...args: string[]) => run('git', ['-c', 'user.name=A', '-c', 'user.email=a@example.org', ...args], { cwd: folder })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    await repositories.steps(acme, addCrews)
    await repositories.record('base')
    const main = (await sh('symbolic-ref', '--short', 'HEAD')).stdout.trim()
    await sh('checkout', '-q', '-b', 'side')
    await repositories.steps(acme, {
      type: 'decision.add',
      decision: { id: 'adr-1', number: 1, title: 'Plan crews centrally', status: 'proposed', date: '2026-09-29', body: 'Why.', signers: [] },
    })
    await repositories.record('decided on the side')
    await sh('checkout', '-q', main)
    await repositories.steps(acme, renameCrews)
    await repositories.record('renamed on the main line')
    await sh('merge', '-q', '--no-ff', '-m', 'merged', 'side')

    const seen: string[] = []
    let after: string | undefined
    for (let pages = 0; pages < 10; pages += 1) {
      const page = await repositories.history.entries({ scopes: [acme], limit: 1, ...(after ? { after } : {}) })
      seen.push(...page.entries.map((entry) => entry.subject ?? ''))
      if (!page.next) break
      after = page.next
    }
    expect(seen.sort()).toEqual(['base', 'decided on the side', 'renamed on the main line'])
    const subjects = async (record: { kind: 'element' | 'decision'; id: string }) =>
      (await repositories.history.entries({ scopes: [acme], record })).entries.map((entry) => entry.subject)
    expect(await subjects({ kind: 'element', id: 'crews' })).toEqual(['renamed on the main line', 'base'])
    expect(await subjects({ kind: 'decision', id: 'adr-1' })).toEqual(['decided on the side'])
  })

})
