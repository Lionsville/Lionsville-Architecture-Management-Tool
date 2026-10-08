// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * *Share with a Link…* through the whole shell (ADR-0033, amended).
 *
 * The command arrives on the host's bus — the menu bar's, or the web's
 * overflow, which sends into the same stream — and is answered by the shell,
 * so it works on the organisation's home with nothing open as well as over a
 * scope. What is pinned: the link is the open source's address with the place
 * as its fragment, the record a person chose on a record page included; it is
 * copied through the host's seam and *Link copied* is said only once that
 * copy has resolved; a source with no address says why in the dialog and
 * copies nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { readPlace } from '../agent/place'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import { translator } from '../i18n'
import type { HostCommand } from '../platform/hostCommands'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="canvas" /> }
})

afterEach(() => cleanup())
beforeEach(() => { window.history.replaceState(null, '', '/') })

const s = translator('en')
const ADDRESS = 'https://work.example/'

const root: ScopeSnapshot = {
  path: '',
  model: {
    name: 'Acme Logistics',
    elements: [],
    relations: [],
    diagrams: [],
    decisions: [
      { id: 'adr-1', number: 1, title: 'One warehouse', status: 'proposed', date: '2026-09-01', body: 'One.', signers: [] },
      { id: 'adr-2', number: 2, title: 'Two depots', status: 'proposed', date: '2026-09-02', body: 'Two.', signers: [] },
    ],
  },
  activeDiagramId: '',
  logoLibrary: [],
}

/** A gateway that keeps whoever subscribed, so the test can move the app as an agent does. */
function fakeGateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = { kind: 'connected' as const, port: 51733, token: 't'.repeat(24), client: { name: 'Claude Code', version: '2.0' } }
  const gateway: AgentGateway = {
    id: 'fake',
    on(next) { handler = next; return () => { if (handler === next) handler = undefined } },
    status: () => Promise.resolve(connected),
    onStatus: () => () => {},
    configure: () => Promise.resolve(connected),
    newToken: () => Promise.resolve(connected),
  }
  let n = 0
  const ask = (tool: string, args: unknown = {}): Promise<AgentAnswer> => {
    if (!handler) throw new Error('nobody is listening')
    return handler({ id: `r${++n}`, tool, args })
  }
  return { gateway, ask, bound: () => handler !== undefined }
}

function show(provider: { shareAddress?: () => string | undefined } = { shareAddress: () => ADDRESS }) {
  const listeners: ((command: HostCommand) => void)[] = []
  const wire = fakeGateway()
  const harness = renderApp({
    agent: wire.gateway,
    repositories: heldRepositories([root]),
    boot: { initialProject: undefined },
    provider,
    host: {
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  const share = () => act(() => { for (const held of [...listeners]) held({ type: 'share' }) })
  return { ...harness, ...wire, share }
}

/** The organisation's home up, and the place it is written: a screen to share. */
const homeUp = () => waitFor(() => expect(readPlace(window.location.hash)).toEqual({ scope: '', page: 'home' }))

const linkShown = () => (screen.getByRole('textbox', { name: s('share.linkLabel') }) as HTMLInputElement).value

describe('Share with a Link…', () => {
  it('works from the organisation’s home with nothing open: copies the link, then says so, and shows it', async () => {
    const app = show()
    await homeUp()
    let resolve: () => void = () => {}
    app.hostControls.copyText.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done }))
    app.share()
    const link = `${ADDRESS}#place?scope=&page=home`
    await waitFor(() => expect(linkShown()).toBe(link))
    expect(app.hostControls.copyText).toHaveBeenCalledWith(link)
    // Not a success that was not waited for.
    expect(screen.queryByText(s('share.copied'))).toBeNull()
    await act(async () => { resolve() })
    await waitFor(() => expect(screen.getByText(s('share.copied'))).toBeDefined())
  })

  it('carries the record a person chose on a record page, which is not a step of the history', async () => {
    const app = show()
    await waitFor(() => expect(app.bound()).toBe(true))
    await app.ask('app.open', { scope: '', page: 'decisions', id: 'adr-1' })
    await waitFor(() => expect(screen.getByText('Two depots')).toBeDefined())
    const before = window.history.length
    fireEvent.click(screen.getByText('Two depots'))
    await waitFor(() => expect(readPlace(window.location.hash)).toEqual({ scope: '', page: 'decisions', id: 'adr-2' }))
    expect(window.history.length).toBe(before)
    app.share()
    await waitFor(() => expect(readPlace(new URL(linkShown()).hash)).toEqual({ scope: '', page: 'decisions', id: 'adr-2' }))
    expect(app.hostControls.copyText).toHaveBeenLastCalledWith(linkShown())
  })

  it('copies again from the dialog', async () => {
    const app = show()
    await homeUp()
    app.share()
    await waitFor(() => expect(app.hostControls.copyText).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: s('share.copy') }))
    await waitFor(() => expect(app.hostControls.copyText).toHaveBeenCalledTimes(2))
  })

  it('says why where the source has no address a link may carry, and copies nothing', async () => {
    const app = show({})
    await homeUp()
    app.share()
    await waitFor(() => expect(screen.getByTestId('share-refused').textContent).toBe(s('share.noAddress')))
    expect(app.hostControls.copyText).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: s('share.linkLabel') })).toBeNull()
  })

  it('says a refused copy, puts it on the trail, and leaves the link in the dialog to select', async () => {
    const app = show()
    await homeUp()
    app.hostControls.copyText.mockImplementationOnce(() => Promise.reject(new Error('not allowed')))
    app.share()
    await waitFor(() => expect(screen.getByText(s('share.copyFailed'))).toBeDefined())
    expect(screen.queryByText(s('share.copied'))).toBeNull()
    expect(linkShown()).toBe(`${ADDRESS}#place?scope=&page=home`)
    expect(app.diagnostics.recent().some((entry) => entry.where === 'share')).toBe(true)
  })
})
