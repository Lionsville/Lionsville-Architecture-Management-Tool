// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent server, as facts two processes share (ADR-0007).
 *
 * Main runs it and the renderer shows it: which of three states it is in,
 * on which port, and — because a person configures their agent from the
 * app's own dialog — with which token. Down here because both ends read the
 * shape, the way `updateSettings.ts` is read by main's file and the
 * preferences dialog.
 *
 * The token is shown to the person who owns the machine and to nobody else:
 * it is loopback-only, regenerable from the same dialog, and never written
 * to a folder, a project or a log.
 */

/** Where the endpoint is, under `http://127.0.0.1:<port>`. */
export const AGENT_ENDPOINT_PATH = '/mcp'

/** Loopback only. A listening desktop app is new surface, and this is the whole of it. */
export const AGENT_HOST = '127.0.0.1'

export function agentEndpoint(port: number): string {
  return `http://${AGENT_HOST}:${port}${AGENT_ENDPOINT_PATH}`
}

/** What an MCP client says about itself in its `initialize` handshake. */
export type AgentClient = {
  readonly name: string
  readonly version: string
}

/**
 * What a client is offered of the agent's vocabulary (ADR-0051): every tool
 * by its own definition, `tools`; the few tools of code mode in their place,
 * through which the same vocabulary is reached from a script, `code`; or
 * `both` beside each other. Down here because the server's settings keep it,
 * the dialog shows it and the protocol reads it.
 */
export const AGENT_MODES = ['tools', 'code', 'both'] as const
export type AgentMode = (typeof AGENT_MODES)[number]

/** What a client is offered where nobody chose: both, so nothing a client had is taken away. */
export const DEFAULT_AGENT_MODE: AgentMode = 'both'

/** The mode a stored value or an address names, or nothing where it names none. */
export function agentModeFrom(value: unknown): AgentMode | undefined {
  return (AGENT_MODES as readonly unknown[]).includes(value) ? value as AgentMode : undefined
}

/** The name an address says the mode under: `…/mcp?mode=code`. */
export const AGENT_MODE_PARAMETER = 'mode'

/**
 * The three things main reports about the server, and the only three. Off is
 * the default; listening carries what the dialog needs to show; connected
 * names the client, so the app can say *Claude Code* rather than *an agent*.
 */
export type AgentServerStatus =
  | { readonly kind: 'off' }
  | { readonly kind: 'listening'; readonly port: number; readonly token: string; readonly movedFrom?: number; readonly mode?: AgentMode }
  | {
    readonly kind: 'connected'
    readonly port: number
    readonly token: string
    /** What a client is offered; {@link DEFAULT_AGENT_MODE} where unsaid. */
    readonly mode?: AgentMode
    /** The port the settings named, when it was busy and this one was taken instead. */
    readonly movedFrom?: number
    readonly client: AgentClient
  }

export const AGENT_OFF: AgentServerStatus = { kind: 'off' }

/**
 * What main keeps in `mcp.json`: whether the feature is on, and the port and
 * token it settled on the last time it was, kept so a person configures their
 * agent once. Read like every settings file in this app — anything that is
 * not the shape reads as the safe answer, which here is off.
 */
export type AgentServerSettings = {
  readonly enabled: boolean
  readonly port?: number
  readonly token?: string
  /** What a client is offered, where the person chose; kept while the server is off, too. */
  readonly mode?: AgentMode
}

export const DEFAULT_AGENT_SETTINGS: AgentServerSettings = { enabled: false }

export function readAgentSettings(stored: unknown): AgentServerSettings {
  if (!stored || typeof stored !== 'object') return DEFAULT_AGENT_SETTINGS
  const raw = stored as Record<string, unknown>
  const port = raw['port']
  const token = raw['token']
  const mode = agentModeFrom(raw['mode'])
  return {
    enabled: raw['enabled'] === true,
    ...(mode !== undefined ? { mode } : {}),
    ...(typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536 ? { port } : {}),
    ...(typeof token === 'string' && token.length >= 16 ? { token } : {}),
  }
}

/** What the dialog may change: the switch, or what a client is offered. The port and the token are main's to mint. */
export type AgentServerPatch = { readonly enabled?: boolean; readonly mode?: AgentMode }
