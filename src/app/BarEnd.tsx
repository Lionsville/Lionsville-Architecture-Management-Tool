// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The right end of a top bar, the same on the workspace's and on every home's:
 * the agent glyph, the open source's provider's own button where it drew one,
 * the chip where it sits at the end, and — on a host with no menu bar — the
 * menu.
 *
 * One component because both bars drew the same glyph and the same menu, each
 * a copy of the other, and the end of a bar is where a person looks for who
 * and where they are; two copies of it drift. It draws what it is handed, in
 * that order, as siblings in the bar (a fragment, no box of its own), so the
 * bar's wrapping and its drag rule — `button`, `a` and `input` are not drag
 * surface — reach every control in it exactly as before.
 */
import type { ReactNode } from 'react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import type { Translate } from '../i18n'
import type { AgentServerStatus } from '../platform/agentServer'
import type { HostCommand } from '../platform/hostCommands'
import type { MenuCapabilities } from '../platform/menu'
import type { SourceMenuEntry, SourceWorkChanged } from '../platform/sourceProvider'
import type { ThemeMode } from '../platform/theme'
import { AgentIcon } from '../widgets/icons'
import { OverflowMenu } from './OverflowMenu'

/**
 * The agent glyph (ADR-0007): the one place the server's state is visible,
 * and how a person finds out the feature exists. Three states, encoded in the
 * glyph and named in its tooltip.
 */
export type ToolbarAgent = {
  status: AgentServerStatus
  onOpen: () => void
}

/** What the glyph says, per state. */
export function agentTip(status: AgentServerStatus, s: Translate): string {
  switch (status.kind) {
    case 'off': return s('agent.tipOff')
    case 'listening': return s('agent.tipListening', { port: status.port })
    case 'connected': return s('agent.tipConnected', { name: status.client.name })
  }
}

/** The web's overflow. Absent on the desktop, which has a menu bar. */
export type ToolbarOverflow = {
  themeMode: ThemeMode
  can: MenuCapabilities
  onCommand: (command: HostCommand) => void
  /**
   * What the source providers want in the menu, asked for when it opens
   * (`App`'s `SourceMenu`). Absent where no provider registered a line, which
   * is every build in this repository.
   */
  sourceEntries?: () => readonly SourceMenuEntry[]
  /** A provider says its own answer has moved, so an open menu asks again. */
  onSourceWork?: SourceWorkChanged
}

export function BarEnd({ agent, button, chip, overflow, s }: {
  agent?: ToolbarAgent
  /**
   * The open source's provider's own button (`App`'s `SourceBarButton`),
   * already inside its boundary and the language. Before the chip, so the
   * chip stays the last word on who and where the person is.
   */
  button?: ReactNode
  /** The chip, where this bar draws it at the end; already drawn. */
  chip?: ReactNode
  overflow?: ToolbarOverflow
  s: Translate
}) {
  return (
    <>
      {agent && <AgentGlyph agent={agent} s={s} />}
      {button}
      {chip}
      {overflow && (
        <OverflowMenu
          themeMode={overflow.themeMode}
          can={overflow.can}
          onCommand={overflow.onCommand}
          sourceEntries={overflow.sourceEntries}
          onSourceWork={overflow.onSourceWork}
          s={s}
        />
      )}
    </>
  )
}

function AgentGlyph({ agent, s }: { agent: ToolbarAgent; s: Translate }) {
  return (
    <Tooltip title={agentTip(agent.status, s)}>
      <IconButton
        size="small"
        aria-label={agentTip(agent.status, s)}
        data-testid="agent-glyph"
        data-state={agent.status.kind}
        onClick={agent.onOpen}
        sx={{
          width: 30, height: 30,
          // Dimmed when off, ordinary when listening, the accent when
          // something is actually editing beside the person.
          color: agent.status.kind === 'connected'
            ? 'primary.main'
            : agent.status.kind === 'listening' ? 'text.primary' : 'text.secondary',
        }}
      >
        <AgentIcon filled={agent.status.kind === 'connected'} />
      </IconButton>
    </Tooltip>
  )
}
