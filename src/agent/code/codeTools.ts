// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tools of code mode (ADR-0050): the few a client carries instead of the
 * whole vocabulary, which it then reaches through a script.
 *
 * Beside the vocabulary and not in it. `TOOLS` is the table every method of
 * `lv` is generated from, and a tool that runs a script is not a method a
 * script calls; so these are specs of their own, in the shape a host's own
 * tools are described (`ToolSpec<string>`), listed by the protocol according
 * to the mode a client asked for (`mcpProtocol.ts`), and answered by
 * `answerCode` (`query.ts`) wherever the vocabulary's handler is bound.
 *
 * A name here is published surface, as a tool's is.
 */
import type { AgentMode } from '../../platform/agentServer'
import type { ToolSpec } from '../tools'

export const CODE_TOOL_NAMES = ['api.describe', 'query', 'simulate', 'run', 'discard', 'call'] as const
export type CodeToolName = (typeof CODE_TOOL_NAMES)[number]

const SCRIPT = {
  type: 'string',
  description: 'The body of an async function with lv in scope: await its calls and return what you want back, as JSON.',
} as const

const DEFAULT_SCOPE = {
  type: 'string',
  description: 'The scope lv is bound to, as a path ("" the organisation); lv.in(path) binds another.',
} as const

export const CODE_TOOLS: readonly ToolSpec<CodeToolName>[] = [
  {
    name: 'api.describe',
    tier: 'read',
    description:
      'The API a script sees, on demand. With nothing asked: how a script is written, its limits, and every area of lv '
      + 'with its methods. With area: each method\'s signature and what it does. With method, or area and detail '
      + '"full": the arguments said one by one and the method\'s rules. With topic: one of the rules every method shares.',
    inputSchema: {
      type: 'object',
      properties: {
        area: { type: 'string', description: 'An area of lv, such as elements; "lv" for the methods on lv itself.' },
        method: { type: 'string', description: 'One method, such as elements.list.' },
        detail: { type: 'string', description: 'full: with an area, every argument said and each method\'s rules.', enum: ['full'] },
        topic: { type: 'string', description: 'A rule every method shares, by its name in the answer with nothing asked.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'query',
    tier: 'read',
    description:
      'Run a script that reads: any number of lv calls joined, filtered and counted in one call, answered with what the '
      + 'script returns. It changes nothing; a call that would is refused inside it. api.describe says what lv holds.',
    inputSchema: {
      type: 'object',
      properties: { script: SCRIPT, scope: DEFAULT_SCOPE },
      required: ['script'],
      additionalProperties: false,
    },
  },
  {
    name: 'simulate',
    tier: 'read',
    description:
      'Try a script that changes things, and land nothing: every call is answered as it would be, on a copy of each scope '
      + 'it writes. Answers what would change in each scope, each call\'s answer, every refusal, what the script returned, '
      + 'and a token. Show the person the changes; run lands exactly them, discard forgets them.',
    inputSchema: {
      type: 'object',
      properties: { script: SCRIPT, scope: DEFAULT_SCOPE },
      required: ['script'],
      additionalProperties: false,
    },
  },
  {
    name: 'run',
    tier: 'write',
    description:
      'Land what a simulation tried: the same changes, as one step for each scope it wrote, all of them or none. The '
      + 'script is not run again. Refused agent.stale where a scope has changed since it was tried, and '
      + 'agent.unknownSimulation for a token used, discarded, older than 15 minutes or not yours: simulate again.',
    inputSchema: {
      type: 'object',
      properties: { token: { type: 'string', description: 'The token simulate answered.' } },
      required: ['token'],
      additionalProperties: false,
    },
  },
  {
    name: 'discard',
    tier: 'write',
    description: 'Forget a simulation without landing it. Nothing was changed by it, and nothing is by this.',
    inputSchema: {
      type: 'object',
      properties: { token: { type: 'string', description: 'The token simulate answered.' } },
      required: ['token'],
      additionalProperties: false,
    },
  },
  {
    name: 'call',
    tier: 'write',
    description:
      'Run one tool by its plain name with its plain arguments, as a tool call outside a script is run: for what a '
      + 'script may not do, which api.describe lists under notInScripts — a picture of a view, moving the app, the '
      + 'tree of scopes, the people register, moving an observation. What it changes lands at once.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'The tool, by its own name: diagram.render, scope.create, app.open.' },
        args: { type: 'object', description: 'Its arguments, as that tool takes them, scope and ifRevision included.', additionalProperties: true },
      },
      required: ['tool'],
      additionalProperties: false,
    },
  },
]

export function isCodeTool(name: string): name is CodeToolName {
  return (CODE_TOOL_NAMES as readonly string[]).includes(name)
}

export function codeToolSpec(name: CodeToolName): ToolSpec<CodeToolName> {
  return CODE_TOOLS.find((tool) => tool.name === name)!
}

/**
 * What a client is told on connect about code mode, after what the host says
 * of itself: one sentence where the tools are offered too, and where they
 * are not, how what that paragraph names as a tool is reached instead.
 */
export function codeInstructions(mode: AgentMode): string {
  if (mode === 'tools') return ''
  const scripts = 'api.describe says what a script sees and query runs one that reads: where an answer takes several reads '
    + 'joined, filtered or counted, write one script rather than make the calls one by one. simulate tries a script that '
    + 'changes things and lands nothing; show the person what it would change, and run lands exactly that once they agree.'
  if (mode === 'both') return `This server also takes scripts. ${scripts}`
  return 'This server is in code mode: the tools named here are not offered one by one, they are methods of lv in a script, '
    + `under the same names but for a few api.describe lists (elements.list is lv.elements.list). ${scripts} `
    + 'What a script may not do — a picture, moving the app, the tree, the register — call runs by the tool\'s own name.'
}
