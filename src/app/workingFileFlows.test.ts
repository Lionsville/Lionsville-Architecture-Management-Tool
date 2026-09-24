// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures'
import { translator } from '../i18n'
import type { ScopeSnapshot } from '../projects/scope'
import { workingFileBytes } from '../projects/workingFile'
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

function prompts(destination: 'here' | 'folder' | undefined, replace = true) {
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
    await landWorkingFile({ name: 'theirs.lvarch', bytes: set(), into, prompts: asked, chooseFolder: () => Promise.resolve(undefined), here, notify: vi.fn(), s })
    expect(asked.askDestination).toHaveBeenCalledWith({ file: 'theirs.lvarch', here: 'Mine', canChooseFolder: true })
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
    const asked = prompts('folder')
    const here = vi.fn()
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: asked, chooseFolder: () => Promise.resolve(chosen), here, notify: vi.fn(), s })
    expect(chosen.placed).toHaveLength(1)
    expect(chosen.placed[0].map((held) => held.path)).toEqual(['', 'retail'])
    expect(chosen.placed[0][0].model.name).toBe('Theirs')
    expect(asked.confirmReplace).not.toHaveBeenCalled()
    expect(here).not.toHaveBeenCalled()
  })

  it('a folder that holds something is written only after a second yes', async () => {
    const refused = folder(true)
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: prompts('folder', false), chooseFolder: () => Promise.resolve(refused), here: vi.fn(), notify: vi.fn(), s })
    expect(refused.placed).toEqual([])

    const allowed = folder(true)
    const asked = prompts('folder', true)
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: asked, chooseFolder: () => Promise.resolve(allowed), here: vi.fn(), notify: vi.fn(), s })
    expect(asked.confirmReplace).toHaveBeenCalledWith('Elsewhere')
    expect(allowed.placed).toHaveLength(1)
  })

  it('a cancelled folder picker lands nowhere, silently', async () => {
    const here = vi.fn()
    const notify = vi.fn()
    await landWorkingFile({ name: 'x', bytes: set(), into, prompts: prompts('folder'), chooseFolder: () => Promise.resolve(undefined), here, notify, s })
    expect(here).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('says "the working folder" for a home that has no name yet', async () => {
    const asked = prompts(undefined)
    await landWorkingFile({ name: 'x', bytes: set(), into: scope('   ', ''), prompts: asked, here: vi.fn(), notify: vi.fn(), s })
    expect(asked.askDestination).toHaveBeenCalledWith({ file: 'x', here: 'the working folder', canChooseFolder: false })
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
      name: 'x', bytes: set(), into, prompts: prompts('folder'), chooseFolder: () => Promise.resolve(chosen),
      here: vi.fn(), beforeReplace, notify: vi.fn(), s,
    })
    expect(beforeReplace).not.toHaveBeenCalled()
    expect(chosen.placed).toHaveLength(1)
  })
})

