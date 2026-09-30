// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Any working file opened onto a scope that could not be read whole puts it
 * back (`ScopeState.unreadable`) — the notice's button or File › Open alike —
 * and the question before it says so.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { translator } from '../i18n'
import { laidOut } from '../model/testFixtures'
import type { ScopeSnapshot } from '../projects/scope'
import { carryScopes, WORKING_FILE_INTERCHANGE } from '../adapters/folder/format/interchange'
import { OpenIntoDialog } from './dialogs/OpenIntoDialog'
import type { ModelSession } from './useModelSession'
import { useProjectFiles } from './useProjectFiles'
import type { ProjectFiles } from './useProjectFiles'
import type { AdoptScopes, LandingPrompts } from './workingFileFlows'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')
const scope = (): ScopeSnapshot => ({
  path: 'acme',
  model: { name: 'Acme', elements: [], relations: [], diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })] },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

describe('a working file opened onto a scope that could not be read whole', () => {
  it('asks the question as a put back, and lands the file as one', async () => {
    const asked: Parameters<LandingPrompts['askDestination']>[0][] = []
    const landing: LandingPrompts = {
      askDestination: (ask) => { asked.push(ask); return Promise.resolve('here') },
      confirmReplace: () => Promise.resolve(true),
    }
    const adopt = vi.fn<AdoptScopes>(() => Promise.resolve({ setAside: ['acme/model.json.unread'] }))
    const onPutBack = vi.fn()
    const notify = vi.fn()
    const session = { mayChange: () => false, snapshot: scope, adopt: vi.fn() } as unknown as ModelSession
    let files!: ProjectFiles
    function Host() {
      files = useProjectFiles({
        session, putPicture: () => Promise.reject(new Error('no pictures')),
        documents: { save: () => Promise.resolve(), readBytes: () => Promise.reject(new Error('unread')), readDataUrl: () => Promise.reject(new Error('unread')) },
        carryOut: () => Promise.reject(new Error('not asked')), interchange: WORKING_FILE_INTERCHANGE,
        adoptWorkingSet: adopt, onPutBack, askPassword: () => Promise.resolve(undefined), landing, notify, s,
      })
      return null
    }
    render(<Host />)
    files.openDocument('acme.lvarch', (await carryScopes([scope()])).bytes)
    await waitFor(() => expect(onPutBack).toHaveBeenCalled())
    expect(asked[0]?.puttingBack).toBe(true)
    expect(adopt.mock.calls[0][1]).toEqual({ putBack: { subject: s('history.beforeReplace') } })
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('acme/model.json.unread'), 'info')
  })

  it('shows a put-back scope that draws nothing on its home, where there is no canvas to show it on', async () => {
    const landing: LandingPrompts = {
      askDestination: () => Promise.resolve('here'),
      confirmReplace: () => Promise.resolve(true),
    }
    const adopt = vi.fn<AdoptScopes>(() => Promise.resolve({ setAside: [] }))
    const onPutBack = vi.fn()
    const onNothingToDraw = vi.fn()
    const session = { mayChange: () => false, snapshot: scope, adopt: vi.fn() } as unknown as ModelSession
    let files!: ProjectFiles
    function Host() {
      files = useProjectFiles({
        session, putPicture: () => Promise.reject(new Error('no pictures')),
        documents: { save: () => Promise.resolve(), readBytes: () => Promise.reject(new Error('unread')), readDataUrl: () => Promise.reject(new Error('unread')) },
        carryOut: () => Promise.reject(new Error('not asked')), interchange: WORKING_FILE_INTERCHANGE,
        adoptWorkingSet: adopt, onPutBack, onNothingToDraw, askPassword: () => Promise.resolve(undefined), landing, notify: vi.fn(), s,
      })
      return null
    }
    render(<Host />)
    const drawless = { ...scope(), model: { ...scope().model, diagrams: [] }, activeDiagramId: '' }
    files.openDocument('acme.lvarch', (await carryScopes([drawless])).bytes)
    await waitFor(() => expect(onNothingToDraw).toHaveBeenCalledWith('acme'))
    expect(adopt).toHaveBeenCalledTimes(1)
    expect(onPutBack).not.toHaveBeenCalled()
  })

  it('says, where the question is asked, that replacing puts the scope back and keeps what could not be read', () => {
    renderShell(
      <OpenIntoDialog open file="acme.lvarch" here="Acme" canGoElsewhere={false} puttingBack onCancel={() => {}} onElsewhere={() => {}} onHere={() => {}} s={s} />,
    )
    expect(screen.getByText('“Acme” could not be read whole; this puts it back from the file, and keeps what could not be read.')).toBeDefined()
  })
})
