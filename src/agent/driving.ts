/**
 * A driving session: the stretch during which an agent is moving the app or
 * changing the model, said to the person on screen and ended by either of
 * them (ADR-0019).
 *
 * An agent that opens scopes, switches views and lands changes is doing what
 * a second person at the keyboard would do, and a person who does not know
 * that will click into the middle of it — close the page it just opened, or
 * select something while it is reading the selection. So the app says so:
 * the first call that drives starts a session, a banner names the client and
 * what it said it was doing, and the banner has a Stop button. Stop ends the
 * session; the agent learns of it on its next call, which is refused with
 * `agent.stopped`, and any call in flight is answered the same way at once.
 *
 * Reads never start a session and are never refused by one: looking is not
 * driving. Pure, so the machine is tested in node; the shell wraps it in a
 * hook and draws the banner from {@link Driving.current}.
 */
import { toolSpec } from './tools'
import type { AgentRefusal, ToolName } from './tools'

export type DrivingSession = {
  /** The client's name from its handshake, or nothing when the app has not been told one. */
  readonly client?: string
  /** What the agent said it was doing, when it said. */
  readonly purpose?: string
  /** When it started, ISO. */
  readonly since: string
  /** How many driving calls it has made. */
  readonly calls: number
}

export type DrivingState = {
  readonly session?: DrivingSession
  /** The person pressed Stop, and no session has been started since. */
  readonly stopped?: { readonly at: string; readonly client?: string }
}

/** The see-tier tools that only look: a report is arithmetic, and starts nothing. */
const LOOKS: readonly string[] = ['diagram.inspect']

/** The drive-tier tools that only tell: where the app is, and that a session is over. */
const TELLS: readonly string[] = ['app.current', 'views.list', 'session.end']

/**
 * Does this call move the screen or change the model? Every write does, every
 * see-tool but the report does — a picture switches the view to take it — and
 * so does opening a scope or a page.
 */
export function drives(tool: ToolName): boolean {
  const spec = toolSpec(tool)
  if (spec.tier === 'read') return false
  if (spec.tier === 'see') return !LOOKS.includes(tool)
  if (spec.tier === 'drive') return !TELLS.includes(tool)
  return true
}

export class Driving {
  private state: DrivingState = {}
  private readonly stopListeners = new Set<() => void>()
  private readonly changeListeners = new Set<() => void>()

  constructor(private readonly clock: () => string = () => new Date().toISOString()) {}

  current(): DrivingState {
    return this.state
  }

  /**
   * A call that drives has arrived. The refusal it meets — the person stopped
   * the last session and nobody has asked to start another — or nothing, in
   * which case the session it starts or extends is counted.
   */
  admit(tool: ToolName, client: string | undefined): AgentRefusal | undefined {
    if (this.state.stopped && tool !== 'session.start') return 'agent.stopped'
    if (!this.state.session || tool === 'session.start') this.start(client)
    const held = this.state.session!
    this.set({ session: { ...held, calls: held.calls + 1 } })
    return undefined
  }

  /** A session, from now. `session.start` says why; the first driving call says nothing. */
  start(client: string | undefined, purpose?: string): void {
    const held = this.state.session
    this.set({
      session: {
        ...(client !== undefined ? { client } : {}),
        ...(purpose !== undefined ? { purpose } : held?.purpose !== undefined ? { purpose: held.purpose } : {}),
        since: held?.since ?? this.clock(),
        calls: held?.calls ?? 0,
      },
    })
  }

  /**
   * Over. By the agent when it says so, by the client when it goes away, and
   * by the person when they press Stop — which is the one that leaves a mark,
   * because it is the one the agent has to be told about.
   */
  end(by: 'agent' | 'person' | 'client'): void {
    const held = this.state.session
    if (!held && by !== 'person') return
    this.set(by === 'person'
      ? { stopped: { at: this.clock(), ...(held?.client !== undefined ? { client: held.client } : {}) } }
      : {})
    if (by === 'person') for (const listener of this.stopListeners) listener()
  }

  /** Called when the person presses Stop, until the returned function is called. */
  onStop(listener: () => void): () => void {
    this.stopListeners.add(listener)
    return () => { this.stopListeners.delete(listener) }
  }

  /** Called whenever the state changes, so a screen can draw it. */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener)
    return () => { this.changeListeners.delete(listener) }
  }

  private set(next: DrivingState): void {
    this.state = next
    for (const listener of this.changeListeners) listener()
  }
}
