// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The table `commandFor` looks a request up in, held against the vocabulary.
 *
 * The type already refuses a write or a see tool without a handler; this is
 * the same claim said at run time, both ways round, so a handler for a name
 * nobody publishes cannot sit in the table either — and so a tool the session
 * answers itself is one somebody named on purpose.
 */
import { describe, expect, it } from 'vitest'
import { commandFor } from '../commandFor'
import type { WriteView } from '../commandFor'
import { TOOL_NAMES, toolSpec } from '../tools'
import { ANSWERED_BY_SESSION, HANDLERS, isCommandTool } from './handlers'

const answeredBySession: readonly string[] = ANSWERED_BY_SESSION

describe('the handler table', () => {
  it('has a handler for every tool that builds a command, and for nothing else', () => {
    const builds = TOOL_NAMES.filter((name) => {
      const { tier } = toolSpec(name)
      return (tier === 'write' || tier === 'see') && !answeredBySession.includes(name)
    })
    expect(Object.keys(HANDLERS).sort()).toEqual([...builds].sort())
  })

  it('names only published tools, and none the session answers itself', () => {
    for (const name of Object.keys(HANDLERS)) {
      expect(TOOL_NAMES, name).toContain(name)
      expect(answeredBySession, name).not.toContain(name)
    }
    for (const name of ANSWERED_BY_SESSION) expect(TOOL_NAMES, name).toContain(name)
  })

  it('leaves every read and every drive tool to the session', () => {
    for (const name of TOOL_NAMES) {
      const { tier } = toolSpec(name)
      if (tier === 'read' || tier === 'drive') expect(isCommandTool(name), name).toBe(false)
    }
  })

  it('refuses a tool with no handler as an unknown tool, after checking its arguments', () => {
    const nothing = {} as WriteView
    expect(commandFor('elements.list', {}, nothing)).toMatchObject({ ok: false, refusal: 'agent.unknownTool', detail: 'elements.list' })
    expect(commandFor('undo', { steps: 'two' }, nothing)).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })
})
