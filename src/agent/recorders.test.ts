// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who recorded an observation, as an agent is told it (ADR-0036 §10, §13;
 * ADR-0038, amended §10): through the entry, or what the source says of the
 * account; a name kept beside an entry is never said, a name with no entry is
 * left out under a pseudonym policy, and an account never leaves — on any
 * answer that carries a record, the whole model of an export above all.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { Command } from '../model/commands'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Observation, RecordedBy } from '../model/observation'
import { apply } from '../model/reducer'
import type { Person } from '../people/person'
import { DEFAULT_POLICY } from '../people/policy'
import type { PeoplePolicy } from '../people/policy'
import { handle } from './handle'
import type { SessionView } from './handle'
import { Driving } from './driving'
import type { ShellView } from './shell'
import type { AgentAnswer } from './tools'

const observation = (id: string, number: number, recordedBy: RecordedBy): Observation => ({
  id, number, title: `Observation ${number}`, date: '2026-09-01', impact: 'minor', seen: 1, body: '',
  history: [{ date: '2026-09-01', kind: 'recorded' }], recordedBy,
})

const STORED = 'Stored Words'
const ROWS: Record<string, RecordedBy> = {
  active: { name: STORED, account: 'sub-mira', person: 'pe-mira', via: 'An agent' },
  forgotten: { name: STORED, account: 'sub-gone', person: 'pe-gone' },
  removed: { name: STORED, person: 'pe-removed' },
  merged: { name: STORED, person: 'pe-old' },
  plain: { name: 'Bram Vos', account: 'sub-bram' },
  linkedAfter: { name: STORED, account: 'sub-linked' },
  renamed: { name: STORED, account: 'sub-erased' },
  written: { account: 'sub-mira', person: 'pe-mira' },
}
const IDS = Object.keys(ROWS)
const host = {
  name: 'Claims', elements: [], relations: [], diagrams: [],
  observations: IDS.map((key, index) => observation(`ob-${key}`, index + 1, ROWS[key])),
}
const people: Person[] = [
  { id: 'pe-mira', name: 'Mira Kuiper', pseudonym: 'M1RA', kind: 'internal', state: 'active' },
  { id: 'pe-gone', pseudonym: '4K7Q', kind: 'internal', state: 'forgotten', forgottenOn: '2026-10-01' },
  { id: 'pe-old', pseudonym: '9QX2', kind: 'internal', state: 'active', mergedInto: 'pe-mira' },
]
const recorder = (account: string) => ({ 'sub-linked': { person: 'pe-gone' }, 'sub-erased': { name: 'Erased person 12' } } as Record<string, { person?: string; name?: string }>)[account]

function session(over: Partial<SessionView> = {}): SessionView {
  const model = fromArrays(host)
  return {
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => '',
    scopePath: () => 'claims',
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: () => undefined,
    ids: idPolicy(() => []),
    makeId: (prefix: string) => `${prefix}-new`,
    today: () => '2026-11-07',
    translate: DEFAULT_TRANSLATE,
    containerName: (name: string) => name,
    revision: () => 0,
    history: () => [],
    undo: () => {},
    ...over,
  } as unknown as SessionView
}
const shellWith = (policy: PeoplePolicy, tree?: unknown): ShellView => ({
  screen: () => ({}), open: () => {}, client: () => 'An agent', driving: new Driving(),
  ...(tree ? { tree } : {}),
  people: { read: async () => ({ people, policy }) },
} as unknown as ShellView)
const NAMES = DEFAULT_POLICY
const PSEUDONYMS: PeoplePolicy = { ...DEFAULT_POLICY, agentsSee: 'pseudonyms' }

const textOf = (out: AgentAnswer): string => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return (out.content[0] as { text: string }).text
}
type Asked = { observations?: { id: string; recordedBy?: unknown }[]; recordedBy?: unknown }
const parsed = (out: AgentAnswer): Asked => JSON.parse(textOf(out)) as Asked
const ask = (tool: string, args: unknown, policy: PeoplePolicy, over: Partial<SessionView> = { recorder }) => handle({ id: '1', tool, args }, session(over), shellWith(policy))
const recordersOf = (rows: { id: string; recordedBy?: unknown }[]) => Object.fromEntries(rows.map((one) => [one.id.replace('ob-', ''), one.recordedBy]))

const UNDER_NAMES = {
  active: { person: 'pe-mira', name: 'Mira Kuiper', via: 'An agent' },
  forgotten: { person: 'pe-gone', name: 'Former colleague 4K7Q' },
  removed: { person: 'pe-removed', name: 'A former colleague' },
  merged: { person: 'pe-mira', name: 'Mira Kuiper' },
  plain: { name: 'Bram Vos' },
  linkedAfter: { person: 'pe-gone', name: 'Former colleague 4K7Q' },
  renamed: { name: 'Erased person 12' },
  written: { person: 'pe-mira', name: 'Mira Kuiper' },
}
const UNDER_PSEUDONYMS = {
  active: { person: 'pe-mira', name: 'Person M1RA', via: 'An agent' },
  forgotten: { person: 'pe-gone', name: 'Former colleague 4K7Q' },
  removed: { person: 'pe-removed', name: 'A former colleague' },
  merged: { person: 'pe-mira', name: 'Person M1RA' },
  plain: { nameWithheld: true },
  linkedAfter: { person: 'pe-gone', name: 'Former colleague 4K7Q' },
  renamed: { nameWithheld: true },
  written: { person: 'pe-mira', name: 'Person M1RA' },
}

describe('who recorded it, to an agent', () => {
  it('observations.list says it through the entry, or what the source says, under names', async () => {
    const out = await ask('observations.list', {}, NAMES)
    expect(recordersOf(parsed(out).observations!)).toEqual(UNDER_NAMES)
  })

  it('observations.list says pseudonyms under a pseudonym policy, and leaves out a name with nothing to stand for it', async () => {
    const out = await ask('observations.list', {}, PSEUDONYMS)
    expect(recordersOf(parsed(out).observations!)).toEqual(UNDER_PSEUDONYMS)
    expect(textOf(out)).not.toMatch(/Stored Words|Bram Vos|Mira Kuiper|Erased person/)
  })

  it('observation.read says the same, under either policy', async () => {
    for (const [policy, want] of [[NAMES, UNDER_NAMES], [PSEUDONYMS, UNDER_PSEUDONYMS]] as const) {
      for (const key of IDS) {
        const out = await ask('observation.read', { id: `ob-${key}` }, policy)
        expect(parsed(out).recordedBy, key).toEqual(want[key as keyof typeof want])
      }
    }
  })

  it('project.export hands out no account and no name an entry answers for, as json', async () => {
    const named = await ask('project.export', { format: 'json' }, NAMES)
    expect(textOf(named)).not.toContain('sub-')
    expect(textOf(named)).not.toContain(STORED)
    expect(recordersOf(parsed(named).observations!)).toEqual(UNDER_NAMES)

    const withheld = await ask('project.export', { format: 'json' }, PSEUDONYMS)
    expect(textOf(withheld)).not.toContain('sub-')
    expect(textOf(withheld)).not.toMatch(/Stored Words|Bram Vos|Mira Kuiper|Erased person/)
    expect(recordersOf(parsed(withheld).observations!)).toEqual(UNDER_PSEUDONYMS)
  })

  it('leaves no account in an answer however the register came, or with none to ask', async () => {
    const out = await handle({ id: '1', tool: 'project.export', args: { format: 'json' } }, session(), {
      screen: () => ({}), open: () => {}, client: () => 'An agent', driving: new Driving(),
    } as unknown as ShellView)
    expect(textOf(out)).not.toContain('sub-')
    // With nobody to ask, a name with no entry is the record's own word; one beside an entry is still not said.
    expect(recordersOf(parsed(out).observations!).plain).toEqual({ name: 'Bram Vos' })
    expect(recordersOf(parsed(out).observations!).forgotten).toEqual({ person: 'pe-gone' })
    expect(recordersOf(parsed(out).observations!).active).toEqual({ person: 'pe-mira', via: 'An agent' })
  })

  it('says a scope that is not open the same way', async () => {
    const read = async () => ({ model: host, activeDiagramId: '', ancestorDecisions: [] })
    const out = await handle({ id: '1', tool: 'observations.list', args: { scope: 'elsewhere' } }, session({ recorder, tree: { read } as never }), shellWith(PSEUDONYMS))
    expect(recordersOf(parsed(out).observations!)).toEqual(UNDER_PSEUDONYMS)
  })

  it('takes the source\'s word from the register\'s view where nothing is open', async () => {
    const read = async () => ({ model: host, activeDiagramId: '', ancestorDecisions: [] })
    const shell = shellWith(PSEUDONYMS, { read })
    const lent = { ...shell, people: { ...shell.people!, recorder } } as ShellView
    const out = await handle({ id: '1', tool: 'observations.list', args: { scope: 'claims' } }, undefined, lent)
    expect(recordersOf(parsed(out).observations!)).toEqual(UNDER_PSEUDONYMS)
  })

  it('a new record with an entry holds no name in the step, and an agent still reads who', async () => {
    const steps: Command[] = []
    let model = fromArrays({ ...host, observations: [] })
    const held = session({
      indexed: () => model,
      current: () => toArrays(model),
      dispatch: (command: Command) => {
        steps.push(command)
        const result = apply(model, command)
        if (!result.ok) return undefined
        model = result.model
        return toArrays(model)
      },
      account: () => ({ id: 'sub-mira', name: 'Mira Kuiper' }),
      me: () => 'pe-mira',
      people: () => people,
    })
    const out = await handle({ id: '1', tool: 'observation.record', args: { title: 'Seen twice', where: 'Desk', by: 'M.K.' } }, held, shellWith(NAMES))
    expect(JSON.stringify(steps)).not.toContain('Mira')
    expect(JSON.stringify(steps)).toContain('"person":"pe-mira"')
    expect(parsed(out).recordedBy).toEqual({ person: 'pe-mira', name: 'Mira Kuiper', via: 'An agent' })
    expect(textOf(out)).not.toContain('sub-mira')
  })

  it('leaves a word that merely looks like a recorder alone', async () => {
    const out = await handle({ id: '1', tool: 'project.export', args: { format: 'json' } }, session({
      current: () => ({ ...toArrays(fromArrays(host)), observations: [], recordedBy: { type: 'string', enum: ['me'] } } as never),
    }), shellWith(NAMES))
    expect(JSON.parse(textOf(out)).recordedBy).toEqual({ type: 'string', enum: ['me'] })
  })
})
