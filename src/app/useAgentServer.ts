// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent server's three facts (ADR-0007), asked once and then told, and
 * the two things the dialog changes about it. Held by the shell rather than
 * the workspace because the glyph outlives a project switch and the dialog is
 * reachable from the organisation's home too.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import type { Translate } from '../i18n'
import { AGENT_OFF } from '../platform/agentServer'
import type { AgentServerStatus } from '../platform/agentServer'
import { reasonOf } from '../platform/errors'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ToolbarAgent } from './ShellToolbar'
import type { Failed } from './useShellServices'
import type { Notify } from './useToasts'

export type AgentServer = {
  status: AgentServerStatus
  /** The glyph on the bar: the server's state, and the way to the dialog. */
  bar: ToolbarAgent
  /** *Connect an agent*, open or not. */
  dialogOpen: boolean
  openDialog: () => void
  closeDialog: () => void
  changeEnabled: (enabled: boolean) => void
  newToken: () => void
}

export function useAgentServer(deps: {
  agent: AgentGateway | undefined
  failedRef: RefObject<Failed>
  notify: Notify
  s: Translate
}): AgentServer {
  const { agent, failedRef, notify, s } = deps
  const [dialogOpen, setDialogOpen] = useState(false)
  const openDialog = useCallback(() => setDialogOpen(true), [])
  const closeDialog = useCallback(() => setDialogOpen(false), [])
  const [status, setStatus] = useState<AgentServerStatus>(AGENT_OFF)
  useEffect(() => {
    if (!agent) return
    let live = true
    void agent.status().then(
      (held) => { if (live) setStatus(held) },
      (cause: unknown) => failedRef.current('agent.status', cause),
    )
    const off = agent.onStatus((held) => { if (live) setStatus(held) })
    return () => { live = false; off() }
  }, [agent, failedRef])

  const changeFailed = useCallback((where: string, cause: unknown) => {
    failedRef.current(where, cause)
    notify(s('agent.changeFailed', { message: reasonOf(cause) }), 'error')
  }, [failedRef, notify, s])
  const changeEnabled = useCallback((enabled: boolean) => {
    if (!agent) return
    void agent.configure({ enabled }).then(setStatus, (cause: unknown) => changeFailed('agent.configure', cause))
  }, [agent, changeFailed])
  const newToken = useCallback(() => {
    if (!agent) return
    void agent.newToken().then(setStatus, (cause: unknown) => changeFailed('agent.newToken', cause))
  }, [agent, changeFailed])
  const bar = useMemo(() => ({ status, onOpen: openDialog }), [status, openDialog])
  return { status, bar, dialogOpen, openDialog, closeDialog, changeEnabled, newToken }
}
