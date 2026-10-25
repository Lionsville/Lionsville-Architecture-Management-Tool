// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's building-block writes (ADR-0043 §2–§7): a block's requirements
 * and catalogue given whole, an evaluation started from another scope's, and
 * the decision it becomes — drafted as the block's page drafts it, citing
 * what the block cites.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../../i18n/strings'
import type { Command } from '../../model/commands'
import type { Evaluation } from '../../model/evaluation'
import type { HostModel } from '../../model/hostModel'
import { idPolicy } from '../../model/keys'
import { fromArrays, toArrays } from '../../model/normalised'
import type { DesignElement } from '../../model/types'
import type { TreeRecords } from '../../model/treeRecords'
import type { AgentAnswer } from '../tools'
import { updateBlock } from './buildingBlocks'
import { proposeChoice, startEvaluation } from './evaluations'
import type { Prepared, WriteView } from './shared'

const BLOCK: DesignElement = {
  id: 'blk-id', kind: 'buildingBlock', name: 'Identity service', lifecycle: 'live', isManaged: false, aspects: {},
  capabilities: [{ id: 'cap-sso', text: 'Signs a person in once', must: true }, { id: 'cap-mfa', text: 'Asks for a second factor' }],
  contexts: [{ id: 'cx-staff', name: 'Staff', needs: { 'cap-sso': 3, 'cap-mfa': 2 } }, { id: 'cx-public', name: 'Public', needs: { 'cap-sso': 4 } }],
  sbbs: [{ id: 'sb-gate', name: 'Gatekeeper', sort: 'product', status: 'evaluated' }, { id: 'sb-own', name: 'Our own', sort: 'inHouse', status: 'candidate' }],
}

const THERE: Evaluation = {
  id: 'security~blk-id', block: { scope: 'security', id: 'blk-id' }, contexts: ['cx-staff'], options: ['sb-gate'],
  coverage: { 'sb-gate': { 'cap-sso': { level: 4 }, 'cap-mfa': { level: 2 } } },
}

const records = (evaluations: { scope: string; evaluation: Evaluation }[] = []): TreeRecords => ({
  principleScopes: () => [], principlesAt: () => ({ principles: [], groups: [] }), inForce: () => [], topics: () => [],
  blocks: () => [{ scope: 'security', block: BLOCK }],
  evaluations: () => evaluations,
  citations: () => [{ scope: 'security', citation: { id: 'ci-1', about: { kind: 'element', id: 'blk-id' }, principle: { scope: '', id: 'pr-buy' }, stance: 'holds', on: '2026-10-01' } }],
})

function view(host: Partial<HostModel>, tree: TreeRecords = records()): WriteView {
  let counter = 0
  const model = fromArrays({ name: 'Passenger', elements: [], relations: [], diagrams: [], ...host })
  return {
    model, current: () => toArrays(model), activeDiagramId: '', scopePath: 'passenger', ancestorDecisions: [],
    ids: idPolicy(() => []), makeId: (prefix) => `${prefix}-new-${++counter}`, today: () => '2026-10-25',
    translate: DEFAULT_TRANSLATE, containerName: (name) => name,
    tree: { lookup: () => undefined, initiativesBelow: () => [], analysisBelow: () => [], rowsTo: () => [], records: () => tree } as unknown as WriteView['tree'],
  }
}

const built = (out: Prepared | AgentAnswer): Prepared => {
  if ('ok' in out) throw new Error(JSON.stringify(out))
  return out
}
const refusal = (out: Prepared | AgentAnswer) => ('ok' in out && !out.ok ? out.refusal : undefined)

describe('a building block\'s requirements and catalogue, from an agent', () => {
  it('takes each list whole, keeps the ids given, gives new items ids, and reads a need by the capability\'s words', () => {
    const out = built(updateBlock({
      id: 'blk-id',
      capabilities: [{ id: 'cap-sso', text: 'Signs a person in once', must: true }, { text: 'Holds millions of accounts' }],
      contexts: [{ id: 'cx-staff', name: 'Staff', needs: { 'cap-sso': 3, 'holds millions of accounts': 1 } }],
      sbbs: [{ name: 'Cloud identity', supplier: 'An invented cloud', sort: 'service' }],
    }, view({ elements: [BLOCK] })))
    expect(out.command).toMatchObject({
      type: 'element.update', id: 'blk-id', patch: {
        capabilities: [{ id: 'cap-sso', must: true }, { id: 'cap-new-1', text: 'Holds millions of accounts' }],
        contexts: [{ id: 'cx-staff', needs: { 'cap-sso': 3, 'cap-new-1': 1 } }],
        sbbs: [{ id: 'sb-new-2', name: 'Cloud identity', sort: 'service', status: 'candidate' }],
      },
    })
  })

  it('refuses a need of a capability the block does not have, and a block kept elsewhere', () => {
    expect(refusal(updateBlock({ id: 'blk-id', contexts: [{ name: 'Staff', needs: { 'Flies to the moon': 2 } }] }, view({ elements: [BLOCK] })))).toBe('agent.badArguments')
    expect(refusal(updateBlock({ id: 'blk-id', sbbs: [] }, view({})))).toBe('agent.unknownId')
  })
})

describe('an evaluation, from an agent', () => {
  it('is started for the contexts named, from another scope\'s options and ratings', () => {
    const out = built(startEvaluation({ block: 'blk-id', contexts: ['Public'], copyFrom: 'security' }, view({}, records([{ scope: 'security', evaluation: THERE }]))))
    expect(out.command).toMatchObject({
      type: 'evaluation.add',
      evaluation: { id: 'security~blk-id', block: { scope: 'security', id: 'blk-id' }, contexts: ['cx-public'], options: ['sb-gate'], coverage: THERE.coverage },
    })
  })

  it('becomes a proposed decision choosing an option weighed here, citing what the block cites', () => {
    const here = { ...THERE, contexts: ['cx-staff'] }
    const out = built(proposeChoice({ block: 'blk-id', option: 'Gatekeeper' }, view({ evaluations: [here] })))
    const [add, cite] = (out.command as Extract<Command, { type: 'transaction' }>).commands
    expect(add).toMatchObject({ type: 'decision.add', decision: { status: 'proposed', chooses: { evaluation: 'security~blk-id', option: 'sb-gate' } } })
    expect((add as { decision: { body: string } }).decision.body).toContain('evaluation: blk-id')
    expect(cite).toMatchObject({ type: 'citation.add', citation: { about: { kind: 'decision' }, principle: { id: 'pr-buy' }, stance: 'supports' } })
    expect(refusal(proposeChoice({ block: 'blk-id', option: 'Our own' }, view({ evaluations: [here] })))).toBe('agent.badArguments')
  })
})
