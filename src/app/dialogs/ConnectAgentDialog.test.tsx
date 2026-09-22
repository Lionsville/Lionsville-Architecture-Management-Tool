// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The dialog's three parts, and what each shows per host and per state: the
 * explanation always; the switch on the desktop and never under `readOnly`;
 * the recipes only while the server is on, with the port and the token main
 * reported filled in, and Copy going through the seam.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { translator } from '../../i18n'
import type { AgentServerStatus } from '../../platform/agentServer'
import { ConnectAgentDialog } from './ConnectAgentDialog'
import { renderShell } from '../testing/renderShell'

afterEach(() => cleanup())

const TOKEN = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
const listening: AgentServerStatus = { kind: 'listening', port: 51733, token: TOKEN }

const base = {
  open: true,
  onClose: () => {},
  onEnabledChange: vi.fn(),
  onNewToken: vi.fn(),
  copyText: vi.fn((_text: string) => Promise.resolve()),
  s: translator('en'),
}

describe('ConnectAgentDialog', () => {
  it('explains first, on every host', () => {
    renderShell(<ConnectAgentDialog {...base} />)
    expect(screen.getByText(/Model Context Protocol/)).toBeDefined()
  })

  it('replaces the switch with the desktop sentence in a browser tab', () => {
    renderShell(<ConnectAgentDialog {...base} status={undefined} />)
    expect(screen.getByTestId('agent-desktop-only')).toBeDefined()
    expect(screen.queryByLabelText('Accept agent connections')).toBeNull()
    expect(screen.queryByTestId('agent-recipe')).toBeNull()
  })

  it('offers the switch on the desktop, off, with no recipe yet', () => {
    renderShell(<ConnectAgentDialog {...base} status={{ kind: 'off' }} />)
    const toggle = screen.getByLabelText('Accept agent connections') as HTMLInputElement
    expect(toggle.checked).toBe(false)
    expect(screen.queryByTestId('agent-recipe')).toBeNull()
    fireEvent.click(toggle)
    expect(base.onEnabledChange).toHaveBeenCalledWith(true)
  })

  it('fills the recipe with the port and the token it was given', () => {
    renderShell(<ConnectAgentDialog {...base} status={listening} />)
    expect((screen.getByLabelText('Accept agent connections') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByTestId('agent-state').textContent).toBe('Listening on port 51733.')
    const recipe = screen.getByTestId('agent-recipe').textContent ?? ''
    expect(recipe).toContain('claude mcp add --transport http lvarch http://127.0.0.1:51733/mcp')
    expect(recipe).toContain(`Bearer ${TOKEN}`)
  })

  it('switches recipe with the tabs, and the last one is the bare endpoint', () => {
    renderShell(<ConnectAgentDialog {...base} status={listening} />)
    // The desktop app needs a bridge, and its connector screen is a trap.
    fireEvent.click(screen.getByText('Claude Desktop'))
    const desktop = screen.getByTestId('agent-recipe').textContent ?? ''
    expect(desktop).toContain('mcp-remote')
    expect(desktop).toContain('Add custom connector')
    expect(desktop).toContain(`Authorization: Bearer ${TOKEN}`)
    fireEvent.click(screen.getByText('Cursor'))
    expect(screen.getByTestId('agent-recipe').textContent).toContain('"mcpServers"')
    fireEvent.click(screen.getByText('Other'))
    expect(screen.getByTestId('agent-recipe').textContent).toContain('Endpoint: http://127.0.0.1:51733/mcp')
  })

  it('copies the recipe through the seam and says so', async () => {
    const copyText = vi.fn((_text: string) => Promise.resolve())
    renderShell(<ConnectAgentDialog {...base} status={listening} copyText={copyText} />)
    fireEvent.click(screen.getByText('Copy'))
    expect(copyText).toHaveBeenCalledTimes(1)
    expect(copyText.mock.calls[0][0]).toContain(TOKEN)
    await waitFor(() => expect(screen.getByText('Copied')).toBeDefined())
  })

  it('asks for a new token, and says every agent needs it again', () => {
    const onNewToken = vi.fn()
    renderShell(<ConnectAgentDialog {...base} status={listening} onNewToken={onNewToken} />)
    fireEvent.click(screen.getByText('New token'))
    expect(onNewToken).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/needs the new token/)).toBeDefined()
  })

  it('names the client once one is connected, and says when the port moved', () => {
    renderShell(<ConnectAgentDialog
      {...base}
      status={{ ...listening, kind: 'connected', movedFrom: 51700, client: { name: 'Claude Code', version: '2' } }}
    />)
    expect(screen.getByTestId('agent-state').textContent).toContain('Claude Code is connected.')
    expect(screen.getByTestId('agent-state').textContent).toContain('Port 51700 was taken')
  })

  it('hides the switch and the token under readOnly, and keeps the explanation', () => {
    renderShell(<ConnectAgentDialog {...base} status={listening} readOnly />)
    expect(screen.getByText(/Model Context Protocol/)).toBeDefined()
    expect(screen.queryByLabelText('Accept agent connections')).toBeNull()
    expect(screen.queryByTestId('agent-recipe')).toBeNull()
  })
})

/**
 * And what the source the work is kept in has to say about reaching it.
 *
 * The sentence about the desktop is true about the loopback — only a host can
 * listen on this machine — and beside the point once an agent can reach the work
 * some other way: it tells a person to go and open this somewhere else to do a
 * thing that can be done here. So the provider answering for the open source
 * fills that space in (`App`'s `SourceAgentPanel`), and this dialog places what
 * it is handed.
 */
describe('ConnectAgentDialog, with a source that answers for agents itself', () => {
  const panel = <p data-testid="from-elsewhere">Reach this landscape from elsewhere</p>

  it('takes the place of the sentence about the desktop in a browser tab', () => {
    renderShell(<ConnectAgentDialog {...base} status={undefined} sourcePanel={panel} />)
    expect(screen.getByTestId('from-elsewhere')).toBeDefined()
    expect(screen.queryByTestId('agent-desktop-only')).toBeNull()
    // The dialog is still this dialog: the title and the way out are ours.
    expect(screen.getByText('Connect an agent')).toBeDefined()
    expect(screen.getByText('Close')).toBeDefined()
  })

  /**
   * And stands beside the loopback section on a host that has one, because both
   * ways in exist there: the switch is still this machine's, and hiding one of
   * two true answers to pick a favourite is not this dialog's call.
   */
  it('is drawn under this shell\u2019s own section on the desktop, not instead of it', () => {
    renderShell(<ConnectAgentDialog {...base} status={listening} sourcePanel={panel} />)
    expect(screen.getByLabelText('Accept agent connections')).toBeDefined()
    expect(screen.getByTestId('agent-recipe')).toBeDefined()
    expect(screen.getByTestId('from-elsewhere')).toBeDefined()
  })

  /** And every build in this repository: no panel, and the dialog as it was. */
  it('is what it always was where the source brought none', () => {
    renderShell(<ConnectAgentDialog {...base} status={undefined} />)
    expect(screen.getByTestId('agent-desktop-only')).toBeDefined()
    expect(screen.queryByTestId('agent-source-panel')).toBeNull()
    cleanup()
    renderShell(<ConnectAgentDialog {...base} status={listening} />)
    expect(screen.getByTestId('agent-recipe')).toBeDefined()
    expect(screen.queryByTestId('agent-source-panel')).toBeNull()
  })
})
