// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Command } from '../../model/commands'
import { stableText } from '../../model/recordKey'
import { syntheticModel } from '../../model/testing/synthetic'
import type { DesignElement } from '../../model/types'
import { fingerprint } from '../../projects/revision'
import type { ScopeCommand, ScopeId, ScopeState } from '../../projects/scopeState'
import type { Repositories } from '../../ports/Repositories'
import { MemoryStore } from '../memory/MemoryStore'
import { CHECKPOINT_EVERY, entryKey, keepEntryState, stateAtEntry } from './entryStates'
import type { KeptEntryState } from './entryStates'
import { repositoriesOn } from './repositoriesOver'
import { Source } from './source'

/** A seeded run of numbers, so a failure is the same failure every time. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
}

/** A medium scope: 120 elements with descriptions, 200 relations, four views, and eight marks of 8 kB each. */
const MEDIUM = { elements: 120, connections: 200, diagrams: 4, descriptionBytes: 512, decisions: 8, seed: 7 }

function marks(): { key: string; label: string; url: string }[] {
  return Array.from({ length: 8 }, (_, at) => ({
    key: `mark-${at}`, label: `Mark ${at}`, url: `data:image/png;base64,${String.fromCharCode(65 + at).repeat(8 * 1024)}`,
  }))
}

type Made = { store: MemoryStore; repositories: Repositories; scope: ScopeId }

/** The repositories over a store of the test's own, with one medium scope brought in whole. */
async function medium(): Promise<Made> {
  const store = new MemoryStore()
  const source = new Source(store, { id: 'memory', by: 'this session' })
  const repositories = repositoriesOn(source)
  await source.bring(() => Promise.resolve({
    scopes: [{ address: 'acme', content: { model: structuredClone(syntheticModel(MEDIUM)), images: [], logoLibrary: marks() }, bytes: [] }],
    subject: 'arrived', safeguard: 'before', note: null,
  }))
  const tree = await repositories.scopes.tree()
  return { store, repositories, scope: tree.root.children[0].id }
}

let clock = 0

async function steps(repositories: Repositories, scope: ScopeId, ...commands: ScopeCommand[]): Promise<void> {
  const answer = await repositories.scopes.apply([{
    scope, steps: commands.map((command) => ({ stepId: crypto.randomUUID(), command, at: (clock += 1) })),
  }])
  if ('refused' in answer) throw new Error(`refused: ${String(answer.refused)}`)
}

/** One small edit, of the kinds a person makes most: a name, a description, a node moved, an element added or removed, a word about the scope. */
function smallEdit(state: ScopeState, next: () => number, at: number): ScopeCommand {
  const elements = state.model.elements
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]
  const roll = next()
  if (roll < 0.4) return { type: 'element.update', id: pick(elements).id, patch: { name: `Renamed ${at}` } }
  if (roll < 0.55) return { type: 'element.update', id: pick(elements).id, patch: { description: `Described again at ${at}.` } }
  if (roll < 0.75) {
    const diagram = pick(state.model.diagrams)
    const placed = diagram.geometry.nodes.map((node) => node.id)
    if (placed.length > 0) return { type: 'node.set', diagramId: diagram.id, nodes: [{ id: pick(placed), x: at, y: at * 2 }] }
  }
  if (roll < 0.85) {
    const element: DesignElement = { id: `added-${at}`, kind: 'application', name: `Added ${at}`, lifecycle: 'live', isManaged: true, aspects: {} }
    return { type: 'element.create', element } satisfies Command
  }
  if (roll < 0.93 && elements.length > 60) return { type: 'element.delete', id: pick(elements).id }
  return { type: 'scope.describe', patch: { client: `Client ${at}` } }
}

async function entryStateBytes(store: MemoryStore): Promise<number> {
  const held = await store.transaction(['entryStates'], 'read', (tx) => tx.range<KeptEntryState>('entryStates', {}))
  return held.reduce((sum, { value }) => sum + JSON.stringify(value).length, 0)
}

describe('the state at an entry, kept as checkpoints and changes', () => {
  it('answers every one of 1,000 entries of small edits exactly, in a bounded size', { timeout: 60_000 }, async () => {
    const { store, repositories, scope } = await medium()
    const next = seeded(42)
    const expected: { id: string; print: string; state?: ScopeState }[] = []
    let state = (await repositories.scopes.state(scope))!
    const whole = JSON.stringify(state).length
    for (let at = 1; at <= 1000; at += 1) {
      await steps(repositories, scope, smallEdit(state, next, at))
      state = (await repositories.scopes.state(scope))!
      const [entry] = await repositories.history.record({ scopes: [scope] })
      expected.push({ id: entry.id, print: fingerprint([stableText(state)]), ...(at % 97 === 0 ? { state } : {}) })
    }
    for (const { id, print, state: whole } of expected) {
      const answered = await repositories.history.stateAt(scope, id)
      expect(fingerprint([stableText(answered)]), `entry ${id}`).toBe(print)
      if (whole) expect(answered).toEqual(whole)
    }
    // The medium scope is about 230 kB written down, so 1,000 entries of it
    // kept whole are about 230 MB. As checkpoints and changes they measured
    // 4.0 MB; the bound is twice that.
    expect(whole).toBeGreaterThan(150_000)
    expect(await entryStateBytes(store)).toBeLessThan(8_000_000)
  })

  it('keeps the marks once, however many checkpoints there are', { timeout: 30_000 }, async () => {
    const { store, repositories, scope } = await medium()
    for (let at = 1; at <= CHECKPOINT_EVERY * 3; at += 1) {
      await steps(repositories, scope, { type: 'scope.describe', patch: { client: `Client ${at}` } })
      await repositories.history.record({ scopes: [scope] })
    }
    const held = await store.transaction(['entryStates'], 'read', (tx) => tx.range<KeptEntryState>('entryStates', {}))
    const checkpoints = held.filter(({ value }) => value.form === 'checkpoint')
    expect(checkpoints.length).toBeGreaterThanOrEqual(3)
    const inline = checkpoints.filter(({ value }) => value.form === 'checkpoint' && 'value' in value.parts['s:logoLibrary'])
    expect(inline).toHaveLength(1)
  })
})

describe('keepEntryState', () => {
  const scope = 'scope-1'

  function state(elements: unknown[], more: Partial<ScopeState> = {}): ScopeState {
    return {
      id: scope, address: 'acme', revision: 'r', images: [],
      model: { name: 'Acme', elements: elements as DesignElement[], relations: [], diagrams: [] },
      ...more,
    }
  }

  /** Keep each state as the next entry, then read every one back. */
  async function keptAndRead(...states: ScopeState[]): Promise<{ forms: KeptEntryState[]; read: (ScopeState | undefined)[] }> {
    const store = new MemoryStore()
    const forms: KeptEntryState[] = []
    for (const [at, one] of states.entries()) {
      forms.push(await store.transaction(['entryStates'], 'write', async (tx) => (await keepEntryState(tx, scope, at + 1, one)).kept))
    }
    const read = await store.transaction(['entryStates'], 'read', async (tx) => {
      const found: (ScopeState | undefined)[] = []
      for (let at = 1; at <= states.length; at += 1) found.push(await stateAtEntry(tx, scope, at))
      return found
    })
    return { forms, read }
  }

  const a = { id: 'a', name: 'A' }
  const b = { id: 'b', name: 'B' }
  const c = { id: 'c', name: 'C' }

  it('keeps an entry after the first as the records that changed, and answers each state exactly', async () => {
    const states = [state([a, b, c]), state([a, { ...b, name: 'B2' }, c]), state([c, a]), state([c, a, b], { client: 'Them' }), state([c, a, b])]
    const { forms, read } = await keptAndRead(...states)
    expect(forms.map((form) => form.form)).toEqual(['checkpoint', 'changes', 'changes', 'changes', 'changes'])
    expect(forms[1]).toMatchObject({ changes: { 'm:elements': { list: { by: 'id', set: [{ id: 'b', name: 'B2' }], gone: [] } } } })
    expect(forms[4]).toMatchObject({ changes: { 's:client': { gone: true } } })
    expect(read).toEqual(states)
  })

  it('keeps a list whose ids repeat as a whole, and still answers it exactly', async () => {
    const states = [state([a, a]), state([a, { ...a, name: 'A2' }]), state([b, a])]
    const { forms, read } = await keptAndRead(...states)
    expect(forms[1]).toMatchObject({ form: 'changes', changes: { 'm:elements': { value: [a, { ...a, name: 'A2' }] } } })
    expect(read).toEqual(states)
  })

  it('keeps a state that was not read whole as a checkpoint', async () => {
    const { forms, read } = await keptAndRead(state([a]), state([a], { unreadable: ['its model could not be read'] }))
    expect(forms.map((form) => form.form)).toEqual(['checkpoint', 'checkpoint'])
    expect(read[1]!.unreadable).toEqual(['its model could not be read'])
  })

  it('reads a state kept whole by an earlier build, and keeps the entries after it as changes from it', async () => {
    const store = new MemoryStore()
    const earlier = state([a, b])
    await store.transaction(['entryStates'], 'write', async (tx) => {
      tx.put('entryStates', entryKey(scope, 1), earlier)
      await keepEntryState(tx, scope, 2, state([a, c]))
    })
    const read = await store.transaction(['entryStates'], 'read', async (tx) => [
      await stateAtEntry(tx, scope, 1), await stateAtEntry(tx, scope, 2), await stateAtEntry(tx, scope, 3),
    ])
    expect(read).toEqual([earlier, state([a, c]), undefined])
  })

  it('keeps a checkpoint again after a run of changes, pointing at the parts it already holds', async () => {
    const states = Array.from({ length: CHECKPOINT_EVERY + 1 }, (_, at) => state([{ id: 'a', name: `A${at}` }], { client: 'Same' }))
    const { forms, read } = await keptAndRead(...states)
    const last = forms[CHECKPOINT_EVERY]
    expect(last.form).toBe('checkpoint')
    expect(last.form === 'checkpoint' && last.parts['s:client']).toEqual({ at: 1 })
    expect(last.form === 'checkpoint' && last.parts['m:elements']).toEqual({ value: [{ id: 'a', name: `A${CHECKPOINT_EVERY}` }] })
    expect(read).toEqual(states)
  })
})
