// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The vocabulary's rules, read on demand: every pointer a description or the
 * instructions carry leads somewhere, every tool's rules are pointed at, and
 * a description says what the tool does and takes in a few lines.
 */
import { describe, expect, it } from 'vitest'
import { INSTRUCTIONS } from './mcpProtocol'
import { RULES, RULE_TOPICS, hasRules, readRules } from './rules'
import { TOOLS, TOOL_NAMES, toolSpec } from './tools'
import type { AgentAnswer } from './tools'

const said = (answer: AgentAnswer) => {
  if (!answer.ok || answer.content[0].type !== 'text') throw new Error(JSON.stringify(answer))
  return JSON.parse(answer.content[0].text) as Record<string, unknown>
}

/** Every `(rules.read <about>)` a text names, `(rules.read)` naming the tool whose description it ends. */
function pointers(text: string, tool?: string): string[] {
  return [...text.matchAll(/\(rules\.read(?: ([^)]+))?\)/g)].flatMap(([, about]) => (about ? [about] : tool ? [tool] : []))
}

describe('the rules, read on demand', () => {
  it('keys every rule by a topic or a tool, and points at every tool\'s from its description', () => {
    for (const key of Object.keys(RULES)) expect([...RULE_TOPICS, ...TOOL_NAMES], key).toContain(key)
    for (const tool of TOOLS) {
      expect(tool.description.endsWith('(rules.read)'), tool.name).toBe(hasRules(tool.name))
    }
  })

  it('leads every pointer in a description, an argument or the instructions to a rule', () => {
    const texts: [string, string | undefined][] = [[INSTRUCTIONS, undefined]]
    for (const tool of TOOLS) {
      texts.push([tool.description, tool.name])
      for (const spec of Object.values(tool.inputSchema.properties)) texts.push([spec.description, undefined])
    }
    for (const [text, tool] of texts) for (const about of pointers(text, tool)) expect(RULES[about], `${tool ?? ''}: rules.read ${about}`).toBeDefined()
  })

  it('answers a topic, a tool, and with nothing asked, what there is to ask', () => {
    expect(said(readRules({ about: 'paging' })).text).toContain('cursor')
    expect(said(readRules({ about: 'checks.list' })).text).toContain('check.conflict')
    const listed = said(readRules({}))
    expect((listed.topics as { about: string }[]).map((one) => one.about)).toEqual([...RULE_TOPICS])
    expect(listed.tools).toContain('app.open')
    expect(readRules({ about: 'nothing.here' })).toMatchObject({ ok: false, refusal: 'agent.unknownId' })
    expect(readRules({ about: 1 })).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })

  it('is offered with no scope and nothing to guard, and names its topics in its description', () => {
    const spec = toolSpec('rules.read')
    expect(spec.tier).toBe('read')
    expect(Object.keys(spec.inputSchema.properties)).toEqual(['about'])
    for (const topic of RULE_TOPICS) expect(spec.description).toContain(topic)
  })
})

describe('a description says what the tool does and what it takes', () => {
  it('in at most 400 characters, and an argument in at most 300: the rules are read on demand', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length, tool.name).toBeLessThanOrEqual(400)
      for (const [key, spec] of Object.entries(tool.inputSchema.properties)) {
        expect(spec.description.length, `${tool.name}.${key}`).toBeLessThanOrEqual(300)
      }
    }
  })
})
