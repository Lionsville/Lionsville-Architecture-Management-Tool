// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures'
import { translator } from '../i18n'
import { ShellError } from '../platform/errors'
import type { ScopeSnapshot } from '../projects/scope'
import { workingFileBytes } from '../projects/workingFile'
import { manifestOf } from '../projects/workingFileManifest'
import { landWorkingFile } from './workingFileFlows'
import type { LandingPrompts, WorkingFileDestination } from './workingFileFlows'

const s = translator('en')

const scope = (name: string, path: string): ScopeSnapshot => ({
  path,
  model: { name, elements: [], relations: [], diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })] },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

const set = () => workingFileBytes([scope('Theirs', 'org'), scope('Under', 'org/retail')])
const into = scope('Mine', 'acme/landscape')

function prompts(destination: 'here' | 'elsewhere' | undefined, replace = true) {
  return {
    askDestination: vi.fn(() => Promise.resolve(destination)),
    confirmReplace: vi.fn(() => Promise.resolve(replace)),
  } satisfies LandingPrompts
}

function folder(occupied: boolean): WorkingFileDestination & { placed: ScopeSnapshot[][] } {
  const placed: ScopeSnapshot[][] = []
  return { name: 'Elsewhere', occupied, placed, place: (scopes) => { placed.push([...scopes]); return Promise.resolve() } }
}

describe('landWorkingFile', () => {
  it('refuses a file that is not a working file before asking anything', async () => {
    const asked = prompts('here')
    const notify = vi.fn()
    await landWorkingFile({ name: 'x', bytes: new TextEncoder().encode('nope'), into, prompts: asked, here: vi.fn(), notify, s })
    expect(notify).toHaveBeenCalledWith('This file is not a working file.', 'error')
    expect(asked.askDestination).not.toHaveBeenCalled()
  })

  it('asks where the file goes, naming the file and what "here" would replace', async () => {
    const asked = prompts(undefined)
    const here = vi.fn()
    await landWorkingFile({ name: 'theirs.lvarch', bytes: set(), into, prompts: asked, chooseDestination: () => Promise.resolve(undefined), here, notify: vi.fn(), s })
    expect(asked.askDestination).toHaveBeenCalledWith({ file: 'theirs.lvarch', here: 'Mine', canGoElsewhere: true })
    expect(here).not.toHaveBeenCalled()
  })

  it('"here" hands the file over addressed under the open scope, as opening always did', async () => {
    const here = vi.fn()
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: prompts('here'), here, notify: vi.fn(), s })
    expect(here).toHaveBeenCalledTimes(1)
    const opened = here.mock.calls[0][0]
    expect(opened.scope.path).toBe('acme/landscape')
    expect(opened.rest?.map((held: ScopeSnapshot) => held.path)).toEqual(['acme/landscape/retail'])
  })

  it('a folder is written with the file\'s top scope as its root, and "here" is left alone', async () => {
    const chosen = folder(false)
    const asked = prompts('elsewhere')
    const here = vi.fn()
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: asked, chooseDestination: () => Promise.resolve(chosen), here, notify: vi.fn(), s })
    expect(chosen.placed).toHaveLength(1)
    expect(chosen.placed[0].map((held) => held.path)).toEqual(['', 'retail'])
    expect(chosen.placed[0][0].model.name).toBe('Theirs')
    expect(asked.confirmReplace).not.toHaveBeenCalled()
    expect(here).not.toHaveBeenCalled()
  })

  it('a folder that holds something is written only after a second yes', async () => {
    const refused = folder(true)
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: prompts('elsewhere', false), chooseDestination: () => Promise.resolve(refused), here: vi.fn(), notify: vi.fn(), s })
    expect(refused.placed).toEqual([])

    const allowed = folder(true)
    const asked = prompts('elsewhere', true)
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: asked, chooseDestination: () => Promise.resolve(allowed), here: vi.fn(), notify: vi.fn(), s })
    expect(asked.confirmReplace).toHaveBeenCalledWith('Elsewhere')
    expect(allowed.placed).toHaveLength(1)
  })

  it('a cancelled folder picker lands nowhere, silently', async () => {
    const here = vi.fn()
    const notify = vi.fn()
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: prompts('elsewhere'), chooseDestination: () => Promise.resolve(undefined), here, notify, s })
    expect(here).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('says "the working folder" for a home that has no name yet', async () => {
    const asked = prompts(undefined)
    await landWorkingFile({ name: 'x', bytes: set(), into: scope('   ', ''), prompts: asked, here: vi.fn(), notify: vi.fn(), s })
    expect(asked.askDestination).toHaveBeenCalledWith({ file: 'x', here: 'the working folder', canGoElsewhere: false })
  })

  it('"here" asks for a snapshot first, and replaces only once it answers yes', async () => {
    const order: string[] = []
    const here = vi.fn(() => { order.push('here') })
    const beforeReplace = vi.fn(() => { order.push('snapshot'); return Promise.resolve(true) })
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: prompts('here'), here, beforeReplace, notify: vi.fn(), s })
    expect(order).toEqual(['snapshot', 'here'])
  })

  it('replaces nothing when the snapshot before it could not be taken', async () => {
    const here = vi.fn()
    await landWorkingFile({
      name: 'x', bytes: set(), into, prompts: prompts('here'), here,
      beforeReplace: () => Promise.resolve(false), notify: vi.fn(), s,
    })
    expect(here).not.toHaveBeenCalled()
  })

  it('takes no snapshot for a file that becomes a folder of its own: nothing here is written over', async () => {
    const beforeReplace = vi.fn(() => Promise.resolve(true))
    const chosen = folder(false)
    await landWorkingFile({
      name: 'x', bytes: set(), into, prompts: prompts('elsewhere'), chooseDestination: () => Promise.resolve(chosen),
      here: vi.fn(), beforeReplace, notify: vi.fn(), s,
    })
    expect(beforeReplace).not.toHaveBeenCalled()
    expect(chosen.placed).toHaveLength(1)
  })
})


describe('a landing, read back and held to the file (ADR-0023, amended)', () => {
  /** An organisation, a domain, and the team under it with the most views: the last scope written. */
  const organisation = () => [
    scope('Organisation', ''), scope('Depots', 'depots'),
    { ...scope('Fleet', 'depots/fleet'), model: { ...scope('Fleet', 'depots/fleet').model, name: 'Fleet' } },
  ]
  const sealedSet = async () => {
    const set = organisation()
    return workingFileBytes(set, await manifestOf(set))
  }
  /** A store that keeps what it is handed, except the paths it is told to lose without a word. */
  function store(losing: string[] = []) {
    const held = new Map<string, ScopeSnapshot>()
    return {
      held,
      write: (scopes: readonly ScopeSnapshot[]) => {
        for (const one of scopes) if (!losing.includes(one.path)) held.set(one.path, one)
        return Promise.resolve()
      },
      read: (path: string) => Promise.resolve(held.get(path)),
    }
  }

  it('says every scope, view and file arrived, once it has read them back', async () => {
    const kept = store()
    const notify = vi.fn()
    await landWorkingFile({
      name: 'org.lvarch', bytes: await sealedSet(), into: scope('Here', ''), prompts: prompts('here'),
      here: (opened) => kept.write([opened.scope, ...(opened.rest ?? [])]), read: kept.read, notify, s,
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0]).toEqual([
      'Working file “org.lvarch” loaded and checked against what it says it holds: 3 scopes, 3 views and 12 files, every one arrived.',
      'success',
    ])
  })

  it('names the scope that did not arrive, rather than saying "loaded"', async () => {
    const lossy = store(['depots/fleet'])
    const notify = vi.fn()
    await landWorkingFile({
      name: 'org.lvarch', bytes: await sealedSet(), into: scope('Here', ''), prompts: prompts('here'),
      here: (opened) => lossy.write([opened.scope, ...(opened.rest ?? [])]), read: lossy.read, notify, s,
    })
    expect(notify).toHaveBeenCalledWith(
      'Working file “org.lvarch” did not arrive whole. Not there after loading: the scope “Fleet” (depots/fleet).', 'error')
  })

  it('holds a file with no manifest to what it contains, and says it has none', async () => {
    const lossy = store(['depots/fleet'])
    const notify = vi.fn()
    await landWorkingFile({
      name: 'old.lvarch', bytes: workingFileBytes(organisation()), into: scope('Here', ''), prompts: prompts('here'),
      here: (opened) => lossy.write([opened.scope, ...(opened.rest ?? [])]), read: lossy.read, notify, s,
    })
    expect(notify.mock.calls[0][0]).toContain('It has no manifest, because an older version saved it')
    expect(notify.mock.calls[0][0]).toContain('the scope “Fleet” (depots/fleet)')
  })

  it('checks a new folder the same way, through the folder it wrote', async () => {
    const lossy = store(['depots'])
    const notify = vi.fn()
    await landWorkingFile({
      name: 'org.lvarch', bytes: await sealedSet(), into, prompts: prompts('elsewhere'),
      chooseDestination: () => Promise.resolve({ name: 'New', occupied: false, place: lossy.write, read: lossy.read }),
      here: vi.fn(), notify, s,
    })
    expect(notify).toHaveBeenCalledWith(
      'Working file “org.lvarch” did not arrive whole. Not there after loading: the scope “Depots” (depots).', 'error')
  })

  it('reads a new folder written in part back too, and names what did not arrive (amendment 3)', async () => {
    const kept = store()
    const notify = vi.fn()
    const place = async (scopes: readonly ScopeSnapshot[]) => {
      await kept.write(scopes.slice(0, 1))
      throw new ShellError('shell.workingFileLandedInPart', { reason: 'held open' })
    }
    await landWorkingFile({
      name: 'org.lvarch', bytes: await sealedSet(), into, prompts: prompts('elsewhere'),
      chooseDestination: () => Promise.resolve({ name: 'New', occupied: false, place, read: kept.read }),
      here: vi.fn(), notify, s,
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toMatch(/^Working file “org\.lvarch” did not arrive whole\. Not there after loading: the scope “Depots” \(depots\); the scope “Fleet”/)
  })

  it('throws a landing in part on where there is nothing to read it back through', async () => {
    const here = () => Promise.reject(new ShellError('shell.workingFileLandedInPart', { reason: 'held open' }))
    await expect(landWorkingFile({
      name: 'org.lvarch', bytes: await sealedSet(), into: scope('Here', ''), prompts: prompts('here'),
      here, notify: vi.fn(), s,
    })).rejects.toMatchObject({ key: 'shell.workingFileLandedInPart' })
  })

  it('says nothing more where "here" landed nothing and said why', async () => {
    const notify = vi.fn()
    await landWorkingFile({
      name: 'org.lvarch', bytes: await sealedSet(), into, prompts: prompts('here'),
      here: () => false, read: () => Promise.resolve(undefined), notify, s,
    })
    expect(notify).not.toHaveBeenCalled()
  })
})
