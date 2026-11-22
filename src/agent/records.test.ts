// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The 3.8.0 records an agent reads over the whole tree (ADR-0041, ADR-0042,
 * ADR-0043): principles in force at a scope with how each holds there, the
 * topics, and the building blocks with every scope's evaluation and its fit.
 */
import { describe, expect, it } from 'vitest'
import type { Evaluation } from '../model/evaluation'
import type { Principle } from '../model/principle'
import type { TreeRecords } from '../model/treeRecords'
import type { DesignElement } from '../model/types'
import { listBlocks, listPrinciples, listTopics, readEvaluation } from './records'
import { listReferences } from './references'
import type { AgentAnswer } from './tools'
import type { TreeView } from './tree'

const principle: Principle = {
  id: 'pr-1', number: 1, title: 'Least privilege', statement: 'Every role has what its task needs.', groups: ['gr-1'],
  aspects: [{ id: 'as-1', number: 1, text: 'One role per task', nature: 'design' }], lastAspect: 1, regime: 'fixed', status: 'accepted',
}

const gateway: DesignElement = {
  id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', lifecycle: 'live', isManaged: false, aspects: {},
  capabilities: [{ id: 'cap-route', text: 'Routes by content' }, { id: 'cap-audit', text: 'Keeps an audit trail', must: true }],
  contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-route': 4, 'cap-audit': 2 } }],
  sbbs: [{ id: 'sb-a', name: 'Broker A', sort: 'product', status: 'candidate' }, { id: 'sb-b', name: 'Managed bus', sort: 'service', status: 'evaluated' }],
}

const sales: Evaluation = {
  id: 'topics.integration~blk-gw', block: { scope: 'topics/integration', id: 'blk-gw' }, contexts: ['cx-partners'], options: ['sb-a', 'sb-b'],
  coverage: { 'sb-a': { 'cap-route': { level: 4 }, 'cap-audit': { level: 2 } }, 'sb-b': { 'cap-route': { level: 2 }, 'cap-audit': { level: 4 } } },
  chosen: 'sb-b', decidedBy: 'adr-2',
}

const records: TreeRecords = {
  principleScopes: () => [''],
  principlesAt: (path) => (path === '' ? { principles: [principle], groups: [{ id: 'gr-1', name: 'Security' }] } : { principles: [], groups: [] }),
  inForce: (path) => (path === 'sales' ? [{ scope: '', via: 'above', principle }] : []),
  topics: () => [{ path: 'topics/integration', name: 'Integration', links: [{ path: 'sales', from: '2026-01-01' }], relevantTo: ['sales'] }],
  blocks: () => [{ scope: 'topics/integration', block: gateway }],
  evaluations: () => [{ scope: 'sales', evaluation: sales }],
  citations: () => [],
}

const tree = { records: () => records } as unknown as TreeView

const body = (answer: AgentAnswer) => {
  if (!answer.ok || answer.content[0].type !== 'text') throw new Error(JSON.stringify(answer))
  return JSON.parse(answer.content[0].text) as Record<string, unknown>
}

describe('the tree’s principles, topics and building blocks, for an agent', () => {
  it('lists the principles in force at a scope, each with where it is kept and how it holds', () => {
    expect(body(listPrinciples(tree, { scope: 'sales' }))).toEqual({
      scope: 'sales',
      principles: [{
        scope: '', via: 'above', id: 'pr-1', number: 1, title: 'Least privilege', statement: 'Every role has what its task needs.',
        status: 'accepted', regime: 'fixed', aspects: [{ number: 1, text: 'One role per task' }], groups: ['Security'],
      }],
    })
    // Every scope's own, without one.
    expect((body(listPrinciples(tree, {})).scopes as { scope: string; groups: unknown[] }[])[0]).toMatchObject({ scope: '', groups: [{ id: 'gr-1', name: 'Security' }] })
  })

  it('lists the topics, or those relevant at a scope', () => {
    expect((body(listTopics(tree, {})).topics as unknown[]).length).toBe(1)
    expect(body(listTopics(tree, { scope: 'stock' })).topics).toEqual([])
  })

  it('lists a block with each scope’s evaluation, its options best first with their fit and the musts they fail', () => {
    const [block] = body(listBlocks(tree, { id: 'blk-gw' })).blocks as Record<string, unknown>[]
    expect(block).toMatchObject({ scope: 'topics/integration', name: 'Message gateway' })
    expect(block!.evaluations).toEqual([{
      scope: 'sales', contexts: ['cx-partners'], chosen: 'sb-b', decidedBy: 'adr-2',
      options: [{ solution: 'sb-b', name: 'Managed bus', fit: 67 }, { solution: 'sb-a', name: 'Broker A', fit: 100, failsMust: ['cap-audit'] }],
    }])
    expect(listBlocks(tree, { id: 'blk-none' }).ok).toBe(false)
    // A scope that evaluates a block lists it; one that neither keeps nor evaluates one lists none.
    expect((body(listBlocks(tree, { scope: 'sales' })).blocks as unknown[]).length).toBe(1)
    expect(body(listBlocks(tree, { scope: 'stock' })).blocks).toEqual([])
  })

  it('answers empty, not refused, where the shell lends no records', () => {
    expect(body(listTopics({} as TreeView, {})).topics).toEqual([])
  })
})

describe('a comparison\'s grid, for an agent (evaluation.read)', () => {
  it('answers the needs, every cell, each option\'s fit with its terms and failed musts, the ranking and the choice', () => {
    expect(body(readEvaluation(tree, { block: 'blk-gw', scope: 'sales' }))).toEqual({
      scope: 'sales',
      block: { scope: 'topics/integration', id: 'blk-gw', name: 'Message gateway' },
      contexts: [{ id: 'cx-partners', name: 'Many partners' }],
      needs: [
        { capability: 'cap-route', text: 'Routes by content', need: 4, drivenBy: ['Many partners'] },
        { capability: 'cap-audit', text: 'Keeps an audit trail', must: true, need: 2, drivenBy: ['Many partners'] },
      ],
      cells: [
        { option: 'sb-a', capability: 'cap-route', level: 4 }, { option: 'sb-a', capability: 'cap-audit', level: 2 },
        { option: 'sb-b', capability: 'cap-route', level: 2 }, { option: 'sb-b', capability: 'cap-audit', level: 4 },
      ],
      options: [
        {
          solution: 'sb-a', name: 'Broker A', rank: 2, fit: 100, covered: 6, needed: 6, failsMust: ['cap-audit'],
          terms: [{ capability: 'cap-route', need: 4, coverage: 4, counted: 4 }, { capability: 'cap-audit', need: 2, coverage: 2, counted: 2 }],
        },
        {
          solution: 'sb-b', name: 'Managed bus', rank: 1, fit: 67, covered: 4, needed: 6, failsMust: [],
          terms: [{ capability: 'cap-route', need: 4, coverage: 2, counted: 2 }, { capability: 'cap-audit', need: 2, coverage: 4, counted: 2 }],
        },
      ],
      ranking: ['sb-b', 'sb-a'],
      chosen: 'sb-b', decidedBy: 'adr-2',
    })
  })

  it('reads the open scope\'s evaluation as its session holds it, and leaves a cell nobody rated without a level', () => {
    const open = { path: 'sales', current: { elements: [], evaluations: [{ ...sales, coverage: { 'sb-a': { 'cap-route': { level: 1 as const, how: 'By topic only' } } } }] } }
    const cells = body(readEvaluation(tree, { block: 'blk-gw' }, open)).cells
    expect(cells).toEqual([
      { option: 'sb-a', capability: 'cap-route', level: 1, how: 'By topic only' }, { option: 'sb-a', capability: 'cap-audit' },
      { option: 'sb-b', capability: 'cap-route' }, { option: 'sb-b', capability: 'cap-audit' },
    ])
  })

  it('refuses a block nobody keeps, a scope that does not evaluate it, and no scope at all with nothing open', () => {
    expect(readEvaluation(tree, { block: 'blk-none', scope: 'sales' })).toMatchObject({ refusal: 'agent.unknownId' })
    expect(readEvaluation(tree, { block: 'blk-gw', scope: 'stock' })).toMatchObject({ refusal: 'agent.unknownId' })
    expect(readEvaluation(tree, { block: 'blk-gw' })).toMatchObject({ refusal: 'agent.badArguments' })
  })
})

describe('what a document may refer to, for an agent (ADR-0043 §9)', () => {
  const host = {
    name: 'Sales', elements: [{ id: 'crm', kind: 'application' as const, name: 'CRM', lifecycle: 'live' as const, isManaged: true, aspects: {} }],
    relations: [], diagrams: [], decisions: [{ id: 'adr-1', number: 1, title: 'Keep the ledger', status: 'proposed' as const, date: '2026-09-01', body: '', signers: [] }],
  }
  const read = { ...tree, scopes: () => [{ path: '', name: 'Acme' }, { path: 'topics/integration', name: 'Integration' }] } as unknown as TreeView

  it('lists the open scope\'s catalogue with the markdown that refers to each, narrowed by a query', async () => {
    const all = body(await listReferences({}, read, { path: 'sales', current: host }, (key) => key))
    expect(all.scope).toBe('sales')
    const references = all.references as { kind: string; label: string; markdown: string }[]
    expect(references.map((one) => one.kind)).toEqual(['element', 'principle', 'principle', 'evaluation', 'evaluation', 'decision'])
    expect(references.find((one) => one.kind === 'element')?.markdown).toBe('[[CRM]]')
    expect(references.find((one) => one.kind === 'decision')?.markdown).toBe('```ref\ndecision: adr-1\n```')
    const found = body(await listReferences({ query: 'privilege' }, read, { path: 'sales', current: host })).references as { markdown: string }[]
    expect(found.map((one) => one.markdown)).toEqual(['```ref\nprinciple: pr-1\n```'])
    const aspect = body(await listReferences({ query: 'one role' }, read, { path: 'sales', current: host })).references as { markdown: string }[]
    expect(aspect.map((one) => one.markdown)).toEqual(['```ref\nprinciple: pr-1\naspect: 1\n```'])
  })

  it('reads another scope as it is kept, and says nothing is open where none is named', async () => {
    const elsewhere = { ...read, read: async (path: string) => (path === 'sales' ? { model: host } : undefined) } as unknown as TreeView
    expect(body(await listReferences({ scope: 'sales' }, elsewhere, undefined)).scope).toBe('sales')
    expect((await listReferences({}, elsewhere, undefined)).ok).toBe(false)
  })
})
