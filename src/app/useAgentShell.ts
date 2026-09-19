/**
 * The app as the agent sees it (ADR-0019): where it is, moving it, and the
 * driving session with its Stop.
 *
 * One hook, because it is one page's worth of wiring: the shell binds the
 * gateway here, whatever is on screen, and hands the handler the session the
 * workspace registered (`onAgentSession`) if there is one. The driving
 * session lives here too — it has to outlive a scope switch, and a scope
 * switch is what an agent's `app.open` does — and so does the one button a
 * person has over the agent, which the banner draws from what this returns.
 *
 * A session ends by itself when the client goes: the desktop's main process
 * forgets a client that said goodbye or went quiet for ten minutes, the
 * status leaves *connected*, and a banner naming a client that is no longer
 * there would be a lie.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ShellView } from '../agent/shell'
import { Driving } from '../agent/driving'
import type { DrivingState } from '../agent/driving'
import type { SessionView } from '../agent/handle'
import type { Destination, Screen, ScreenPage } from '../agent/screen'
import type { TreeView } from '../agent/tree'
import type { AgentServerStatus } from '../platform/agentServer'
import type { AgentGateway } from '../ports/AgentGateway'
import { useAgentGateway } from './useAgentGateway'

/**
 * What the workspace registers while a scope is open: the handler's session
 * view, plus the two things only the workspace knows about its own screen —
 * which page is up over the canvas, and how to show another.
 */
export type WorkspaceAgentView = SessionView & {
  page(): ScreenPage | undefined
  /** Show a view or a page of the open scope. The destination has been checked against the model. */
  show(to: Destination & { scope: string }): void
}

export type UseAgentShellOptions = {
  gateway: AgentGateway | undefined
  status: AgentServerStatus
  /** The tree, as the shell holds it whatever is on screen. */
  tree: TreeView
  /** Where the app is, read at call time. */
  screen: () => Screen
  /** Move the app somewhere a scope's home or a workspace can show. */
  open: (to: Destination & { scope: string }) => void
  /** Said once when the person presses Stop, so the toast can name the client. */
  onStopped?: (client: string | undefined) => void
}

export type AgentShell = {
  driving: DrivingState
  /** The person's Stop: ends the session and leaves the mark the agent reads. */
  stop: () => void
  /** The workspace registers its view here while a scope is open, and clears it on unmount. */
  register: (view: WorkspaceAgentView | undefined) => void
  /** The session the workspace registered, if any — for the screen the shell describes. */
  session: () => WorkspaceAgentView | undefined
}

export function useAgentShell({ gateway, status, tree, screen, open, onStopped }: UseAgentShellOptions): AgentShell {
  const driving = useMemo(() => new Driving(), [])
  const [state, setState] = useState<DrivingState>(() => driving.current())
  useEffect(() => driving.onChange(() => setState(driving.current())), [driving])

  const held = useRef<WorkspaceAgentView | undefined>(undefined)
  const register = useCallback((view: WorkspaceAgentView | undefined) => { held.current = view }, [])
  const session = useCallback(() => held.current, [])

  // Read through refs so the handler, which keeps the shell object across
  // renders, always reaches the current screen and the current tree.
  const latest = useRef({ tree, screen, open, status })
  latest.current = { tree, screen, open, status }

  const shell = useMemo<ShellView>(() => ({
    get tree() { return latest.current.tree },
    screen: () => latest.current.screen(),
    open: (to) => latest.current.open(to),
    client: () => {
      const now = latest.current.status
      return now.kind === 'connected' ? now.client.name : undefined
    },
    driving,
  }), [driving])

  // The client went: goodbye, or quiet long enough for main to forget it.
  useEffect(() => { if (status.kind !== 'connected') driving.end('client') }, [status.kind, driving])

  const stop = useCallback(() => {
    const client = driving.current().session?.client
    driving.end('person')
    onStopped?.(client)
  }, [driving, onStopped])

  useAgentGateway(gateway, session, gateway ? shell : undefined)

  return { driving: state, stop, register, session }
}
