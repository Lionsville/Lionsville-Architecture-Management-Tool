// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What a document in a scope may refer to and how each `ref` is drawn
 * (ADR-0043 §9, §10): the catalogue in the order it is kept, a principle as
 * a quote, an evaluation as its grid — pinned, as it stood where the history
 * holds that revision — a decision as a line, and nothing for what is gone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderShell } from '../testing/renderShell'
import { translator } from '../../i18n'
import type { Adr } from '../../model/adr'
import type { Evaluation } from '../../model/evaluation'
import type { Principle } from '../../model/principle'
import type { DesignElement } from '../../model/types'
import { drawRef } from './RefDrawings'
import type { RefReads } from './RefDrawings'
import { referablesIn } from '../../search/referables'

afterEach(cleanup)

const s = translator('en')

const principle: Principle = {
  id: 'pr-1', number: 3, title: 'Reuse before buy', statement: 'Reuse what we have before buying.', aspects: [{ id: 'a1', number: 1, text: 'Look in the register first', nature: 'design' }],
  lastAspect: 1, groups: [], regime: 'flexible', status: 'accepted',
}
const block: DesignElement = {
  id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', lifecycle: 'live', isManaged: false, aspects: {},
  capabilities: [{ id: 'cap-route', text: 'Routes by content' }], contexts: [{ id: 'cx', name: 'Partners', needs: { 'cap-route': 4 } }],
  sbbs: [{ id: 'sb-a', name: 'Broker A', sort: 'product', status: 'candidate' }],
}
const evaluation: Evaluation = {
  id: 'topics.integration~blk-gw', block: { scope: 'topics/integration', id: 'blk-gw' }, contexts: ['cx'], options: ['sb-a'], coverage: { 'sb-a': { 'cap-route': { level: 2 } } },
}
const decision: Adr = { id: 'adr-1', number: 1, title: 'Buy a yard system', status: 'accepted', date: '2026-10-01', body: '', signers: [] }

const reads = (over: Partial<RefReads> = {}): RefReads => ({
  principle: (scope, id) => (scope === '' && id === 'pr-1' ? principle : undefined),
  openPrinciple: vi.fn(),
  block: (id) => (id === 'blk-gw' ? { scope: 'topics/integration', block } : undefined),
  evaluation: (id, scope) => (id === 'blk-gw' && scope === 'sales' ? evaluation : undefined),
  openBlock: vi.fn(),
  records: { decision: (id) => (id === 'adr-1' ? decision : undefined), openDecision: vi.fn(), observation: () => undefined, openObservation: vi.fn() },
  ...over,
})

const name = (path: string) => ({ sales: 'Sales', '': 'Acme' })[path] ?? path

describe('the catalogue a document refers to', () => {
  it('lists the views, the elements, the principles and their aspects, the evaluations, the decisions and the observations', () => {
    const all = referablesIn({
      model: { diagrams: [{ id: 'l7', kind: 'layer7', name: 'Landscape', members: [], geometry: { nodes: [] } }], elements: [block], decisions: [decision], observations: [] },
      principles: [{ scope: '', principle }], blocks: [{ scope: 'topics/integration', block }], evaluations: [{ scope: 'sales', evaluation }], scopeLabel: name, s,
    })
    expect(all.map((one) => `${one.kind}:${one.label}`)).toEqual([
      'view:Landscape', 'element:Message gateway', 'principle:PR-0003 Reuse before buy', 'principle:PR-0003.1 Look in the register first',
      'evaluation:Message gateway', 'evaluation:Message gateway in Sales', 'decision:ADR-0001 Buy a yard system',
    ])
    expect(all.find((one) => one.label === 'PR-0003.1 Look in the register first')?.markdown).toBe('```ref\nprinciple: pr-1\naspect: 1\n```')
    expect(all.find((one) => one.label === 'Message gateway in Sales')?.markdown).toBe('```ref\nevaluation: blk-gw\nscope: sales\n```')
    expect(all[0]?.markdown).toBe('![Landscape](view:l7)')
  })
})

describe('a ref, drawn', () => {
  it('draws a principle, or one of its aspects, as a quote whose number opens it', () => {
    const at = reads()
    renderShell(<>{drawRef({ principle: 'pr-1', aspect: '1' }, at, s, name)}</>)
    expect(document.body.textContent).toContain('PR-0003.1 Reuse before buyLook in the register first')
    fireEvent.click(screen.getByRole('button', { name: 'PR-0003.1' }))
    expect(at.openPrinciple).toHaveBeenCalledWith('', 'pr-1')
    expect(drawRef({ principle: 'pr-1', aspect: '9' }, at, s, name)).toBeUndefined()
    expect(drawRef({ principle: 'gone' }, at, s, name)).toBeUndefined()
  })

  it('draws a block\'s requirements, and a scope\'s evaluation with the way to it', () => {
    const at = reads()
    renderShell(<>{drawRef({ evaluation: 'blk-gw' }, at, s, name)}{drawRef({ evaluation: 'blk-gw', scope: 'sales' }, at, s, name)}</>)
    expect(screen.getByTestId('requirements-grid')).toBeTruthy()
    expect(screen.getByTestId('evaluation-grid').textContent).toContain('Broker A')
    fireEvent.click(screen.getByTestId('ref-open-evaluation'))
    expect(at.openBlock).toHaveBeenCalledWith('blk-gw', 'sales')
    expect(drawRef({ evaluation: 'blk-gw', scope: 'stock' }, at, s, name)).toBeUndefined()
  })

  it('draws a pinned evaluation as it stood where the history holds it, and says it changed where not', async () => {
    const then = { ...evaluation, coverage: { 'sb-a': { 'cap-route': { level: 4 as const } } } }
    const stood = reads({ stoodAt: async () => then })
    renderShell(<>{drawRef({ evaluation: 'blk-gw', scope: 'sales', at: 'r1' }, stood, s, name)}</>)
    await waitFor(() => expect(document.body.textContent).toContain('as it stood when it was referred to'))
    expect(screen.getByRole('img', { name: 'How far Broker A covers Routes by content: 4/4' })).toBeTruthy()
    cleanup()
    renderShell(<>{drawRef({ evaluation: 'blk-gw', scope: 'sales', at: 'r1' }, reads({ stoodAt: async () => 'changed' }), s, name)}</>)
    await waitFor(() => expect(document.body.textContent).toContain('changed since it was referred to'))
  })

  it('draws a decision as a line that opens it, and as written where no scope\'s records are read', () => {
    const at = reads()
    renderShell(<>{drawRef({ decision: 'adr-1' }, at, s, name)}</>)
    expect(document.body.textContent).toContain('ADR-0001 Buy a yard systemAccepted')
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(at.records!.openDecision).toHaveBeenCalledWith('adr-1')
    expect(drawRef({ decision: 'adr-9' }, at, s, name)).toBeUndefined()
    cleanup()
    renderShell(<>{drawRef({ decision: 'adr-9' }, reads({ records: undefined }), s, name)}</>)
    expect(document.body.textContent).toBe('decision: adr-9, in the scope this document is about')
  })
})
