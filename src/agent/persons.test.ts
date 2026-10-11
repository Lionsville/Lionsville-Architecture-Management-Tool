// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The fields that name a person, at the agent (ADR-0036 §8, §13): the tools
 * that set them take a person from the register as `{ person: id }` or text;
 * an id the register does not hold is refused and a merged one is written as
 * the entry it went into; every answer says a picked person by name — or by
 * pseudonym where the policy gives agents pseudonyms — with the id beside it;
 * a signature keeps the name it was signed with; and `search` finds a person
 * through the register.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import type { Person } from '../people/person'
import { DEFAULT_POLICY } from '../people/policy'
import type { PeoplePolicy } from '../people/policy'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { PeopleView } from './people'
import { agentRegister, answerWithNames, mayNamePeople, withPersonNames } from './persons'
import type { ShellView } from './shell'
import { listChecks } from './tree'
import type { TreeView } from './tree'
import type { AgentAnswer } from './tools'
import { checkArguments, json, text, toolSpec } from './tools'

const TODAY = '2026-10-11'

const people: Person[] = [
  { id: 'pe-eva', name: 'Eva Lind', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
  { id: 'pe-kim', name: 'Kim Bakker', pseudonym: 'GHJK', kind: 'internal', state: 'active' },
  { id: 'pe-eva2', pseudonym: 'LMNP', kind: 'internal', state: 'active', mergedInto: 'pe-eva' },
]

const start: HostModel = {
  name: 'Orders', relations: [], diagrams: [],
  elements: [{ id: 'shop', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {} }],
  decisions: [{ id: 'ad-1', number: 1, title: 'One order store', status: 'reviewing', date: '2026-10-01', body: '', signers: [] }],
}

function session(register: readonly Person[] | null = people): SessionView & { model: () => Model; sent: Command[] } {
  let model: Model = fromArrays(start)
  let counter = 0
  const sent: Command[] = []
  return {
    sent,
    model: () => model,
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => '',
    scopePath: () => 'orders',
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      sent.push(command)
      model = result.model
      return toArrays(model)
    },
    ids: idPolicy(() => model.order.elements),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => TODAY,
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => name,
    revision: () => sent.length,
    history: () => [],
    undo: () => {},
    images: () => [],
    addImage: () => {},
    save: () => Promise.resolve(),
    ...(register ? { people: () => register } : {}),
  }
}

/** A shell that lends the register with a policy, and drives nothing: what a read is asked through. */
function shell(policy: PeoplePolicy, register: readonly Person[] = people): ShellView {
  const view: PeopleView = {
    read: () => Promise.resolve({ people: [...register], policy }),
    add: () => Promise.reject(new Error('not here')),
    leave: () => Promise.reject(new Error('not here')),
    today: () => TODAY,
    readOnly: () => false,
  }
  return { people: view } as unknown as ShellView
}

const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse((out.content[0] as { text: string }).text) as Record<string, unknown>
}
const refusal = (out: AgentAnswer) => (out.ok ? undefined : [out.refusal, out.detail])
const ask = (tool: string, args: unknown, on: SessionView | undefined, around?: ShellView) => handle({ id: '1', tool, args }, on, around)

describe('the arguments that name a person', () => {
  it('take text, or a person from the register by id, and nothing else', () => {
    const schema = toolSpec('element.update').inputSchema
    expect(checkArguments(schema, { id: 'shop', owner: 'Operations' })).toBeUndefined()
    expect(checkArguments(schema, { id: 'shop', owner: { person: 'pe-eva' } })).toBeUndefined()
    expect(checkArguments(schema, { id: 'shop', owner: { person: 'pe-eva', name: 'Eva' } })).toMatch(/"owner" must be text, or/)
    expect(checkArguments(schema, { id: 'shop', owner: 7 })).toMatch(/"owner" must be text, or/)
    const signers = toolSpec('decision.update').inputSchema
    expect(checkArguments(signers, { id: 'ad-1', signers: [{ name: { person: 'pe-kim' }, verdict: 'approved' }] })).toBeUndefined()
  })
})

describe('the tools that set them', () => {
  it('write a person from the register by id, a merged id as the entry kept, and text as text', async () => {
    const on = session()
    await ask('element.update', { id: 'shop', owner: { person: 'pe-eva2' } }, on)
    expect(on.model().elements.shop.owner).toEqual({ person: 'pe-eva' })
    await ask('element.update', { id: 'shop', owner: 'Operations' }, on)
    expect(on.model().elements.shop.owner).toBe('Operations')
    await ask('element.update', { id: 'shop', owner: null }, on)
    expect(on.model().elements.shop.owner).toBeUndefined()
  })

  it('refuse an id the register does not hold, so no field points at nobody', async () => {
    const out = await ask('element.update', { id: 'shop', owner: { person: 'pe-nobody' } }, session())
    expect(refusal(out)).toEqual(['agent.unknownId', 'owner: person pe-nobody'])
    // With no register to ask, an id is taken as given.
    const bare = session(null)
    await ask('element.update', { id: 'shop', owner: { person: 'pe-nobody' } }, bare)
    expect(bare.model().elements.shop.owner).toEqual({ person: 'pe-nobody' })
  })

  it('set a plan’s owner, who saw an observation and who runs an experiment', async () => {
    const on = session()
    const plan = parsed(await ask('plan.create', { title: 'Replace the store', owner: { person: 'pe-kim' } }, on))
    expect(plan.owner).toEqual({ person: 'pe-kim', name: 'Kim Bakker' })
    const seen = parsed(await ask('observation.record', { title: 'Orders arrive twice', where: 'Checkout', by: { person: 'pe-eva' } }, on))
    expect(Object.values(on.model().observations ?? {})[0].by).toEqual({ person: 'pe-eva' })
    expect(JSON.stringify(seen)).not.toContain('"by":{"person":"pe-eva"}')
    expect(refusal(await ask('observation.record', { title: 'x', where: 'y', by: '  ' }, on))?.[0]).toBe('agent.badArguments')
  })

  it('keep the name a signer signs with, and fix the proposer’s once anybody has', async () => {
    const on = session()
    await ask('decision.update', { id: 'ad-1', proposedBy: { person: 'pe-eva' }, signers: [{ name: { person: 'pe-kim' }, verdict: 'approved', signedAt: TODAY }] }, on)
    const decision = on.model().decisions?.['ad-1']
    expect(decision?.signers).toEqual([{ name: { person: 'pe-kim' }, verdict: 'approved', signedAt: TODAY, signedAs: 'Kim Bakker' }])
    expect(decision?.proposedAs).toBe('Eva Lind')
    // A proposal is signed the moment it is put with a verdict.
    const fresh = parsed(await ask('decision.propose', { title: 'Two stores', signers: [{ name: { person: 'pe-eva' }, verdict: 'rejected' }] }, on))
    expect(on.model().decisions?.[fresh.id as string]?.signers[0].signedAs).toBe('Eva Lind')
  })
})

describe('a decision accepted on its proposer\'s approval alone', () => {
  it('is said so where the proposer is held under an id merged into the signer\'s', async () => {
    const on = session()
    const body = [
      '## Context and Problem Statement', '', 'Orders are kept twice.', '', '## Considered Options', '', '* One store', '* Two', '',
      '## Decision Outcome', '', 'Chosen option: “One store”, because it is simpler.', '', '### Consequences', '', '* Good, because one copy.', '',
    ].join('\n')
    on.dispatch({ type: 'decision.update', id: 'ad-1', patch: { proposedBy: { person: 'pe-eva2' }, body } })
    await ask('decision.update', { id: 'ad-1', signers: [{ name: { person: 'pe-eva' }, verdict: 'approved', signedAt: TODAY }] }, on)
    const accepted = parsed(await ask('decision.transition', { id: 'ad-1', status: 'accepted' }, on))
    expect(accepted).toMatchObject({ status: 'accepted', warning: expect.any(String) })
  })
})

describe('the answers', () => {
  it('say a picked person by name, with the id beside it', async () => {
    const on = session()
    await ask('element.update', { id: 'shop', owner: { person: 'pe-eva2' } }, on)
    const described = parsed(await ask('element.describe', { id: 'shop' }, on))
    expect(JSON.stringify(described)).toContain('{"person":"pe-eva","name":"Eva Lind"}')
  })

  it('say a pseudonym where the policy gives agents pseudonyms, and the export’s tables the same', async () => {
    const on = session()
    await ask('element.update', { id: 'shop', owner: { person: 'pe-eva' } }, on)
    const around = shell({ ...DEFAULT_POLICY, agentsSee: 'pseudonyms' })
    const described = JSON.stringify(parsed(await ask('element.describe', { id: 'shop' }, on, around)))
    expect(described).toContain('Person BCDF')
    expect(described).not.toContain('Eva')
    const exported = await ask('project.export', {}, on, around)
    const doc = exported.ok && exported.content[0].type === 'text' ? exported.content[0].text : ''
    expect(doc).toContain('Person BCDF')
    expect(doc).not.toContain('Eva')
  })

  it('withhold the name a signature kept where the policy gives agents pseudonyms: a read, the export and a search alike', async () => {
    const on = session()
    await ask('decision.update', { id: 'ad-1', proposedBy: { person: 'pe-eva' }, signers: [{ name: { person: 'pe-kim' }, verdict: 'approved', signedAt: TODAY }] }, on)
    expect(on.model().decisions?.['ad-1']?.signers[0].signedAs).toBe('Kim Bakker')
    const around = shell({ ...DEFAULT_POLICY, agentsSee: 'pseudonyms' })
    const read = JSON.stringify(parsed(await ask('decision.read', { id: 'ad-1' }, on, around)))
    expect(read).not.toMatch(/Kim|Bakker|Eva|Lind/)
    expect(read).toContain('Person GHJK')
    expect(read).toContain('"signedAsWithheld":true')
    expect(read).toContain('"proposedAsWithheld":true')
    const exported = JSON.stringify(parsed(await ask('project.export', { format: 'json' }, on, around)))
    expect(exported).not.toMatch(/Kim|Bakker|Eva|Lind/)
    expect(JSON.stringify(parsed(await ask('search', { query: 'bakker' }, on, around)))).not.toContain('ad-1')
    // Where agents see names, the name as signed is said as written.
    expect(JSON.stringify(parsed(await ask('decision.read', { id: 'ad-1' }, on, shell(DEFAULT_POLICY))))).toContain('"signedAs":"Kim Bakker"')
  })

  /**
   * Once the signer is forgotten, a signature links to nobody (ADR-0036 §8):
   * the answer says the name as signed alone — no id, no pseudonym — and a
   * search by the pseudonym does not find the decision, while one by the
   * name as signed still does, as the record's own text.
   */
  it('say a forgotten signer and proposer by the name as signed alone, and never tie it to the pseudonym', async () => {
    const on = session()
    await ask('decision.update', { id: 'ad-1', proposedBy: { person: 'pe-eva' }, signers: [{ name: { person: 'pe-kim' }, verdict: 'approved', signedAt: TODAY }] }, on)
    const gone = people.map((one) => (one.mergedInto === undefined ? { id: one.id, pseudonym: one.pseudonym, kind: one.kind, state: 'forgotten' as const, forgottenOn: TODAY } : one))
    const read = JSON.stringify(parsed(await ask('decision.read', { id: 'ad-1' }, on, shell(DEFAULT_POLICY, gone))))
    expect(read).toContain('"name":"Kim Bakker"')
    expect(read).toContain('"proposedBy":"Eva Lind"')
    expect(read).not.toMatch(/GHJK|BCDF|pe-kim|pe-eva|Former colleague/)
    const exported = JSON.stringify(parsed(await ask('project.export', { format: 'json' }, on, shell(DEFAULT_POLICY, gone))))
    expect(exported).not.toMatch(/GHJK|BCDF|pe-kim|pe-eva/)
    expect(JSON.stringify(parsed(await ask('search', { query: 'GHJK' }, on, shell(DEFAULT_POLICY, gone))))).not.toContain('ad-1')
    expect(JSON.stringify(parsed(await ask('search', { query: 'bakker' }, on, shell(DEFAULT_POLICY, gone))))).toContain('ad-1')
    // Where names are withheld too, the signer is nobody in particular, and the name as signed is withheld.
    const withheld = JSON.stringify(parsed(await ask('decision.read', { id: 'ad-1' }, on, shell({ ...DEFAULT_POLICY, agentsSee: 'pseudonyms' }, gone))))
    expect(withheld).not.toMatch(/Kim|Bakker|Eva|Lind|GHJK|BCDF|pe-kim|pe-eva/)
    expect(withheld).toContain('"signedAsWithheld":true')
    // While the signer still has a name, the signature is theirs, by id, as before.
    expect(JSON.stringify(parsed(await ask('decision.read', { id: 'ad-1' }, on, shell(DEFAULT_POLICY))))).toContain('"person":"pe-kim"')
  })

  it('find a person through the register: a name finds the records that point at them', async () => {
    const on = session()
    await ask('element.update', { id: 'shop', owner: { person: 'pe-eva' } }, on)
    const found = parsed(await ask('search', { query: 'eva lind' }, on, shell(DEFAULT_POLICY)))
    expect(JSON.stringify(found)).toContain('"id":"shop"')
    const withheld = parsed(await ask('search', { query: 'eva lind' }, on, shell({ ...DEFAULT_POLICY, agentsSee: 'pseudonyms' })))
    expect(JSON.stringify(withheld)).not.toContain('"id":"shop"')
  })
})

describe('saying people in an answer', () => {
  const { words } = agentRegister(people, DEFAULT_POLICY)

  it('replaces every picked reference by shape and leaves the rest alone', () => {
    expect(withPersonNames({ owner: { person: 'pe-eva2' }, list: [{ name: 'The board' }, { person: 'pe-gone' }], n: 3 }, words)).toEqual({
      owner: { person: 'pe-eva2', name: 'Eva Lind' }, list: [{ name: 'The board' }, { person: 'pe-gone', name: 'A former colleague' }], n: 3,
    })
  })

  it('says the person a check is about, by name or pseudonym, where the finding carries only their id', () => {
    const tree = { findings: () => [{ key: 'check.personOverloaded', scope: 'orders', id: 'pe-eva', name: 'pe-eva', person: 'pe-eva' }] } as unknown as TreeView
    const listed = answerWithNames(listChecks(tree, {}), words)
    expect(JSON.stringify(parsed(listed))).toContain('"person":{"person":"pe-eva","name":"Eva Lind"}')
  })

  it('reads the register only for an answer that may name somebody, and leaves a document as it is', () => {
    expect(mayNamePeople(json({ id: 'shop' }))).toBe(false)
    expect(mayNamePeople(json({ owner: { person: 'pe-eva' } }))).toBe(true)
    const doc = text('# "person": not JSON')
    expect(answerWithNames(doc, words)).toEqual(doc)
    expect(answerWithNames({ ok: false, refusal: 'agent.off' }, words)).toEqual({ ok: false, refusal: 'agent.off' })
  })
})
