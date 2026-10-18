// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The method an agent is handed on connect says what the records are for
 * (ADR-0032 §10): a root cause is said by a person, and local and global are
 * places, not a permission.
 */
import { describe, expect, it } from 'vitest'
import { INSTRUCTIONS } from './mcpProtocol'
import { OBSERVATIONS_METHOD, STRUCTURE_DEFAULTS, TREE_TOOLS_PARAGRAPH } from './method'

describe('the method sent on connect', () => {
  it('says a root cause is said by a person, and that the agent never says one on its own judgement', () => {
    expect(OBSERVATIONS_METHOD).toContain('A root cause is said by a person, never inferred')
    expect(OBSERVATIONS_METHOD).toContain('a cause nothing explains yet is an open end, not a root')
    expect(OBSERVATIONS_METHOD).toContain('Never make a cause a root cause, or a root cause a cause again, on your own judgement')
  })

  it('says local and global are places, not a permission, and that nothing is shared', () => {
    expect(OBSERVATIONS_METHOD).toContain('Local and global are places, not a permission')
    expect(OBSERVATIONS_METHOD).toContain('A comment (comment.add) is about a record and never changes it')
    expect(OBSERVATIONS_METHOD).toContain('Nothing is shared')
    expect(OBSERVATIONS_METHOD).toContain('the scope below explains its own observations')
    expect(OBSERVATIONS_METHOD).not.toMatch(/\bshared observation\b|share it/)
  })

  it('says observations and causes are merged, what merge.plan is for, and that a merge may cross scopes', () => {
    expect(OBSERVATIONS_METHOD).toContain('is merged (observation.merge)')
    expect(OBSERVATIONS_METHOD).toContain('two causes that say the same thing are merged too (cause.merge)')
    expect(OBSERVATIONS_METHOD).toContain('merge.plan says what a merge would do')
    expect(OBSERVATIONS_METHOD).toContain('A merge may take records of any scope')
  })

  it('says what a bright spot is, that a solution on its root spreads it, and that it is never merged with a problem', () => {
    expect(OBSERVATIONS_METHOD).toContain('bright true is a bright spot, analysed the same way')
    expect(OBSERVATIONS_METHOD).toContain('a solution on its root cause spreads it')
    expect(OBSERVATIONS_METHOD).toContain('a bright spot and a problem are never merged')
  })

  it('asks for where and by whom rather than guessing them', () => {
    expect(OBSERVATIONS_METHOD).toContain('Where and by whom are required: ask rather than guess')
  })
})

describe('the structure\'s defaults sent on connect (ADR-0039, amended 17 October 2026)', () => {
  it('says to keep to the model and write an exception only when explicitly asked, saying so', () => {
    expect(STRUCTURE_DEFAULTS).toContain('Keep to the model\'s defaults: place people in the roles their unit\'s slots give')
    expect(STRUCTURE_DEFAULTS).toContain('let reporting lines follow the role\'s and the unit type\'s lines and nesting')
    expect(STRUCTURE_DEFAULTS).toContain('only when the person you act for explicitly asks for that exception')
    expect(STRUCTURE_DEFAULTS).toContain('say in your answer that it is one')
  })

  it('names a tool that reads and one that writes each structure relationship, every one of them a tool', async () => {
    const { TOOL_NAMES } = await import('./tools')
    const named = STRUCTURE_DEFAULTS.match(/\b[a-z]+(?:\.[a-zA-Z]+)+\b/g) ?? []
    expect(named.length).toBeGreaterThan(10)
    for (const tool of named) expect(TOOL_NAMES, tool).toContain(tool)
  })

  it('is part of what the desktop hands over, before the method', () => {
    expect(INSTRUCTIONS).toContain(STRUCTURE_DEFAULTS)
    expect(INSTRUCTIONS.indexOf(STRUCTURE_DEFAULTS)).toBeLessThan(INSTRUCTIONS.indexOf(OBSERVATIONS_METHOD))
  })
})

describe('the tree\'s tools sent on connect (ADR-0040)', () => {
  it('names the four, one scope per removal, and a scope with work in it only at the person\'s own words', () => {
    for (const tool of ['scope.create', 'scope.update', 'scope.move', 'scope.remove']) expect(TREE_TOOLS_PARAGRAPH).toContain(tool)
    expect(TREE_TOOLS_PARAGRAPH).toContain('A removal is one scope per call and never one with scopes under it')
    expect(TREE_TOOLS_PARAGRAPH).toContain('in their own words, that it is to go with all of it')
    expect(TREE_TOOLS_PARAGRAPH).toContain('never your own, never on your own judgement')
    expect(TREE_TOOLS_PARAGRAPH).not.toMatch(/screen|banner/)
    expect(INSTRUCTIONS).toContain(TREE_TOOLS_PARAGRAPH)
  })
})
