// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Names become references (ADR-0036 §8), end to end over the pure parts: the
 * fields of default 6 take a person from the register by id; no step, no
 * history entry and no index row holds a register name — except a signature,
 * on purpose; search finds a person through the register and then the ids;
 * a forget reaches every reader of these fields at once; a merged id
 * resolves everywhere.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import { withSignedNames } from '../decisions/adr'
import { transaction } from '../model/commands'
import type { Command } from '../model/commands'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { personIdsIn } from '../model/person'
import { apply } from '../model/reducer'
import type { HostModel } from '../model/hostModel'
import { recordIndex } from '../search/recordIndex'
import { scopeSources, searchAll } from '../search/search'
import { indexScopes } from '../projects/scopeIndex'
import { pointersIn } from '../model/pointers'
import { peopleMatching } from './matching'
import type { Person } from './person'
import { registerOf, shownText, personText } from './shown'

const s = translator('en')

const eva: Person = { id: 'pe-eva', name: 'Eva Lind', pseudonym: 'BCDF', kind: 'internal', state: 'active' }
const kim: Person = { id: 'pe-kim', name: 'Kim Bakker', pseudonym: 'GHJK', kind: 'internal', state: 'active' }
/** Eva again, entered twice and merged into the first. */
const evaToo: Person = { id: 'pe-eva2', pseudonym: 'LMNP', kind: 'internal', state: 'active', mergedInto: 'pe-eva' }
const forgotten = (person: Person): Person => {
  const { name: _name, email: _email, ...rest } = person
  void _name
  void _email
  return { ...rest, state: 'forgotten', forgottenOn: '2026-10-11' }
}

const NAMES = /Eva|Lind|Kim|Bakker/

function scope(): Model {
  return fromArrays({ name: 'Orders', elements: [], relations: [], diagrams: [] })
}

function applied(model: Model, command: Command): Model {
  const result = apply(model, command)
  if (!result.ok) throw new Error(result.reason)
  return result.model
}

/** Every field of default 6, set to a person from the register by id — the second merged into the first. */
function commands(): Command[] {
  const decision = withSignedNames(undefined, {
    id: 'ad-1', number: 1, title: 'One order store', status: 'reviewing', date: '2026-10-01', body: '',
    proposedBy: { person: 'pe-eva2' },
    signers: [{ name: { person: 'pe-kim' }, verdict: 'approved', signedAt: '2026-10-02' }, { name: { person: 'pe-eva' } }],
  }, (id) => registerOf([eva, kim, evaToo]).get(id === 'pe-eva2' ? 'pe-eva' : id)?.name)
  return [
    { type: 'element.create', element: { id: 'shop', kind: 'application', name: 'Webshop', owner: { person: 'pe-eva' }, lifecycle: 'live', isManaged: true, aspects: {} } },
    { type: 'transition.add', transition: { id: 'tr-1', number: 1, title: 'Replace the store', status: 'draft', owner: { person: 'pe-kim' }, elements: [], decisions: [], milestones: [], body: '' } },
    { type: 'observation.add', observation: { id: 'ob-1', number: 1, title: 'Orders arrive twice', date: '2026-10-01', where: 'Checkout', by: { person: 'pe-eva2' }, impact: 'minor', seen: 1, body: '', history: [] } },
    { type: 'experiment.add', experiment: { id: 'ex-1', number: 1, title: 'Deduplicate', tests: [], hypothesis: 'Half the doubles go', by: { person: 'pe-kim' }, outcome: 'planned', body: '' } },
    { type: 'decision.add', decision },
  ]
}

describe('no step, history entry or index row holds a register name, except a signature', () => {
  const steps = transaction(commands())
  const model = applied(scope(), steps)
  const arrays = toArrays(model) as unknown as HostModel

  it('keeps ids in every field, and the one name the signature kept', () => {
    expect([...personIdsIn(arrays)].sort()).toEqual(['pe-eva', 'pe-eva2', 'pe-kim'])
    const withoutSignatures = JSON.stringify({ ...arrays, decisions: [] })
    expect(withoutSignatures).not.toMatch(NAMES)
    expect(JSON.stringify(steps)).toContain('"signedAs":"Kim Bakker"')
    expect(JSON.stringify(steps)).toContain('"proposedAs":"Eva Lind"')
    expect(JSON.stringify(steps).replace(/"(signedAs|proposedAs)":"[^"]*"/g, '')).not.toMatch(NAMES)
  })

  it('folds no register name into the search index, and carries ids beside it', () => {
    const index = recordIndex(arrays)
    const rows = [...index.byKind.values()].flat()
    const haystacks = rows.filter((row) => row.kind !== 'decision').map((row) => row.haystack).join(' ')
    expect(haystacks).not.toMatch(/eva|lind|kim|bakker/)
    expect(rows.find((row) => row.kind === 'element')?.record.people).toEqual(['pe-eva'])
    expect(rows.find((row) => row.kind === 'decision')?.record.people).toEqual(['pe-kim', 'pe-eva', 'pe-eva2'])
  })

  it('carries the master’s owner on the organisation’s index by id, as a stand-in shows it', () => {
    const index = indexScopes([{ path: 'orders', model: arrays }])
    expect(index.lookup('shop')?.owner).toEqual({ person: 'pe-eva' })
    expect(JSON.stringify(index.register())).not.toMatch(NAMES)
  })
})

describe('search matches the register first, and then the ids', () => {
  const model = toArrays(applied(scope(), transaction(commands()))) as unknown as HostModel
  const searching = (query: string, people: readonly Person[]) => searchAll({
    sources: scopeSources({ model }), query, people: peopleMatching(people, (shown) => shownText(shown, s)),
  })

  it('finds every record that points at a person by their name, a merged id included', () => {
    const found = searching('eva lind', [eva, kim, evaToo]).map((hit) => `${hit.kind}:${hit.id}`).sort()
    expect(found).toEqual(['decision:ad-1', 'element:shop', 'observation:ob-1'])
  })

  it('takes the words of a query from the record and from the register together', () => {
    expect(searching('webshop eva', [eva, kim]).map((hit) => hit.id)).toEqual(['shop'])
    expect(searching('webshop kim', [eva, kim])).toEqual([])
  })

  it('finds a forgotten person by their pseudonym and no longer by their name, but a signature by the name it kept', () => {
    const after = [forgotten(eva), kim, evaToo]
    expect(searching('lind', after).map((hit) => hit.id)).toEqual(['ad-1'])
    expect(searching('BCDF', after).map((hit) => `${hit.kind}:${hit.id}`).sort()).toEqual(['decision:ad-1', 'element:shop', 'observation:ob-1'])
  })

  it('finds people by text alone where no register is handed over', () => {
    expect(searchAll({ sources: scopeSources({ model }), query: 'eva' }).map((hit) => hit.id)).toEqual(['ad-1'])
  })
})

describe('a forget reaches every reader of these fields; a merged id resolves everywhere', () => {
  const model = toArrays(applied(scope(), transaction(commands()))) as unknown as HostModel
  const owner = model.elements[0].owner
  const by = model.observations?.[0].by

  it('reads every field by the register’s name, a merged id as the entry it went into', () => {
    const register = registerOf([eva, kim, evaToo])
    expect(personText(owner, register, s)).toBe('Eva Lind')
    expect(personText(by, register, s)).toBe('Eva Lind')
    expect(personText(model.transitions?.[0].owner, register, s)).toBe('Kim Bakker')
  })

  it('reads every field as the pseudonym once forgotten — and a signature keeps the name it was signed with', () => {
    const register = registerOf([forgotten(eva), forgotten(kim), evaToo])
    expect(personText(owner, register, s)).toBe('Former colleague BCDF')
    expect(personText(by, register, s)).toBe('Former colleague BCDF')
    expect(personText(model.experiments?.[0].by, register, s)).toBe('Former colleague GHJK')
    expect(model.decisions?.[0].signers[0].signedAs).toBe('Kim Bakker')
    expect(model.decisions?.[0].proposedAs).toBe('Eva Lind')
  })

  it('reads a removed entry as a former colleague, with nothing to connect it', () => {
    expect(personText(owner, registerOf([kim]), s)).toBe('A former colleague')
  })

  it('points at the person kept from every record that holds an id merged into theirs', () => {
    const pointers = pointersIn(model, new Set(['pe-eva', 'pe-eva2']))
    expect(pointers.map((one) => `${one.kind}:${one.field}:${one.person}`)).toEqual([
      'element:owner:pe-eva', 'observation:seenBy:pe-eva2', 'decision:proposed:pe-eva2', 'decision:signer:pe-eva',
    ])
  })
})
