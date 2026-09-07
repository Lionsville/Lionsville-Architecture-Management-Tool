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
