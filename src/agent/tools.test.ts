/**
 * The vocabulary is published surface, so the properties worth pinning are
 * the ones a client depends on: every tool has a distinct name and a schema a
 * client can read, and the check a call meets is the schema it was shown.
 */
import { describe, expect, it } from 'vitest'
import {
  REFUSAL_SENTENCE, TOOLS, TOOL_NAMES, checkArguments, isToolName, json, refused, toolSpec,
} from './tools'
import type { AgentRefusal, InputSchema } from './tools'

describe('the tool list', () => {
  it('names every tool once, as a noun, a dot and a verb, or one camel-cased verb', () => {
    expect(new Set(TOOL_NAMES).size).toBe(TOOLS.length)
    for (const name of TOOL_NAMES) expect(name).toMatch(/^[a-z]+(?:[A-Z][a-z]+)*(?:\.[a-z]+(?:[A-Z][a-z]+)*)?$/)
  })

  it('describes every tool in a sentence a client can show', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(20)
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.inputSchema.additionalProperties).toBe(false)
    }
  })

  it('describes every argument, and requires only arguments that exist', () => {
    for (const tool of TOOLS) {
      const schema: InputSchema = tool.inputSchema
      for (const [key, spec] of Object.entries(schema.properties)) {
        expect(spec.description.length, `${tool.name}.${key}`).toBeGreaterThan(0)
      }
      for (const key of schema.required ?? []) {
        expect(schema.properties[key], `${tool.name} requires ${key}`).toBeDefined()
      }
    }
  })

  it('answers whether a string is a tool', () => {
    expect(isToolName('elements.list')).toBe(true)
    expect(isToolName('elements.destroy')).toBe(false)
    expect(isToolName(42)).toBe(false)
    expect(toolSpec('search').tier).toBe('read')
  })

  it('has a sentence for every refusal, and the reducer’s two among them', () => {
    const keys = Object.keys(REFUSAL_SENTENCE) as AgentRefusal[]
    expect(keys).toContain('command.gone')
    expect(keys).toContain('command.lastLandscape')
    for (const key of keys) expect(REFUSAL_SENTENCE[key]).toMatch(/\.$/)
  })
})

describe('checkArguments', () => {
  const schema: InputSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'x' },
      kind: { type: 'string', description: 'x', enum: ['a', 'b'] },
      limit: { type: 'integer', description: 'x', minimum: 1, maximum: 10 },
      dx: { type: 'number', description: 'x' },
      on: { type: 'boolean', description: 'x' },
      ids: { type: 'array', description: 'x', items: { type: 'string' } },
    },
    required: ['id'],
    additionalProperties: false,
  }

  it('accepts what the schema describes, and treats nothing as an empty object', () => {
    expect(checkArguments(schema, { id: 'a', kind: 'b', limit: 3, dx: 1.5, on: true, ids: ['x'] })).toBeUndefined()
    expect(checkArguments({ type: 'object', properties: {}, additionalProperties: false }, undefined)).toBeUndefined()
  })

  it('names the first thing that is wrong', () => {
    expect(checkArguments(schema, {})).toBe('"id" is required')
    expect(checkArguments(schema, { id: 1 })).toBe('"id" must be a string')
    expect(checkArguments(schema, { id: 'a', kind: 'c' })).toBe('"kind" must be one of a, b')
    expect(checkArguments(schema, { id: 'a', limit: 0 })).toBe('"limit" must be at least 1')
    expect(checkArguments(schema, { id: 'a', limit: 11 })).toBe('"limit" must be at most 10')
    expect(checkArguments(schema, { id: 'a', limit: 1.5 })).toBe('"limit" must be an integer')
    expect(checkArguments(schema, { id: 'a', dx: 'far' })).toBe('"dx" must be a number')
    expect(checkArguments(schema, { id: 'a', on: 'yes' })).toBe('"on" must be true or false')
    expect(checkArguments(schema, { id: 'a', ids: [1] })).toBe('"ids" must be a list of strings')
    expect(checkArguments(schema, { id: 'a', extra: 1 })).toBe('"extra" is not an argument of this tool')
    expect(checkArguments(schema, 'id')).toBe('arguments must be an object')
  })

  it('lets an explicit null stand for an absent optional argument', () => {
    expect(checkArguments(schema, { id: 'a', kind: null })).toBeUndefined()
  })
})

describe('answers', () => {
  it('carries a refusal as a key with an optional detail', () => {
    expect(refused('agent.unknownId')).toEqual({ ok: false, refusal: 'agent.unknownId' })
    expect(refused('agent.badArguments', 'why')).toEqual({ ok: false, refusal: 'agent.badArguments', detail: 'why' })
  })

  it('carries data as one indented JSON text block', () => {
    expect(json({ a: 1 })).toEqual({ ok: true, content: [{ type: 'text', text: '{\n  "a": 1\n}' }] })
  })
})
