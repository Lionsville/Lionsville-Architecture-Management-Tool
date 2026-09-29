// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Command } from './commands'
import { isRecordKind, recordOfWrite, recordsOf, sameRecord, SCOPE_RECORD } from './recordKey'

const element = { id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: true, aspects: {} } as const

describe('a record key', () => {
  it('is the first two segments of a write key, and nothing under them', () => {
    expect(recordOfWrite('element/crews/aspects/cost')).toEqual({ kind: 'element', id: 'crews' })
    expect(recordOfWrite('diagram/l7/node/crews')).toEqual({ kind: 'diagram', id: 'l7' })
  })

  it('names the scope itself for what the model calls its project', () => {
    expect(recordOfWrite('project/name')).toEqual(SCOPE_RECORD)
  })

  it('names nothing for a key that is not about one record', () => {
    expect(recordOfWrite('*')).toBeUndefined()
    expect(recordOfWrite('somewhere/else')).toBeUndefined()
  })

  it('knows its kinds', () => {
    expect(isRecordKind('image')).toBe(true)
    expect(isRecordKind('row')).toBe(false)
    expect(isRecordKind(3)).toBe(false)
  })

  it('is the same record by kind and id', () => {
    expect(sameRecord({ kind: 'element', id: 'a' }, { kind: 'element', id: 'a' })).toBe(true)
    expect(sameRecord({ kind: 'element', id: 'a' }, { kind: 'diagram', id: 'a' })).toBe(false)
    expect(sameRecord({ kind: 'element', id: 'a' }, { kind: 'element', id: 'b' })).toBe(false)
  })
})

describe('the records a command writes', () => {
  it('names each record once, in the order first written', () => {
    const command: Command = {
      type: 'transaction',
      commands: [
        { type: 'element.update', id: 'crews', patch: { name: 'Crew planning', lifecycle: 'live' } },
        { type: 'node.set', diagramId: 'l7', nodes: [{ id: 'crews', x: 1, y: 2 }] },
        { type: 'element.delete', id: 'crews' },
      ],
    }
    expect(recordsOf(command)).toEqual([{ kind: 'element', id: 'crews' }, { kind: 'diagram', id: 'l7' }])
  })

  it('names the created record', () => {
    expect(recordsOf({ type: 'element.create', element })).toEqual([{ kind: 'element', id: 'crews' }])
  })

  it('names the scope for its settings', () => {
    expect(recordsOf({ type: 'project.settings', patch: { name: 'Landscape' } })).toEqual([SCOPE_RECORD])
  })

  it('may be about anything where the command has no descriptor', () => {
    expect(recordsOf({ type: 'nobody.knows' } as unknown as Command)).toBeUndefined()
    expect(recordsOf({ type: 'transaction', commands: [{ type: 'nobody.knows' } as unknown as Command] })).toBeUndefined()
  })

  it('names nothing for a command that writes nothing', () => {
    expect(recordsOf({ type: 'transaction', commands: [] })).toEqual([])
  })
})
