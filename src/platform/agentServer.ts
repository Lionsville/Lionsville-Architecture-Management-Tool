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
 * The three things main reports about the server, and the only three. Off is
 * the default; listening carries what the dialog needs to show; connected
 * names the client, so the app can say *Claude Code* rather than *an agent*.
 */
export type AgentServerStatus =
  | { readonly kind: 'off' }
  | { readonly kind: 'listening'; readonly port: number; readonly token: string; readonly movedFrom?: number }
  | {
    readonly kind: 'connected'
    readonly port: number
    readonly token: string
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
}

export const DEFAULT_AGENT_SETTINGS: AgentServerSettings = { enabled: false }

export function readAgentSettings(stored: unknown): AgentServerSettings {
  if (!stored || typeof stored !== 'object') return DEFAULT_AGENT_SETTINGS
  const raw = stored as Record<string, unknown>
  const port = raw['port']
  const token = raw['token']
  return {
    enabled: raw['enabled'] === true,
    ...(typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536 ? { port } : {}),
    ...(typeof token === 'string' && token.length >= 16 ? { token } : {}),
  }
}

/** What the dialog may change. The port and the token are main's to mint. */
export type AgentServerPatch = { readonly enabled: boolean }
