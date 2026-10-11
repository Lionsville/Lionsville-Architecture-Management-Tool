// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people register as an agent may use it (ADR-0036 §13): three tools,
 * answered with nothing open, names or pseudonyms as the policy says, never
 * an address — and no tool that forgets, removes or merges anyone.
 */
import { describe, expect, it } from 'vitest'
import type { Person } from '../people/person'
import { DEFAULT_POLICY } from '../people/policy'
import type { PeoplePolicy } from '../people/policy'
import { changePeople } from '../people/register'
import { Driving } from './driving'
import { handle } from './handle'
import type { PeopleView } from './people'
import type { ShellView } from './shell'
import { TOOLS, toolSpec } from './tools'
import type { AgentAnswer } from './tools'

const START: Person[] = [
  { id: 'pe-pia', name: 'Pia Schulz', email: 'pia.schulz@acme.example', pseudonym: '4K7Q', kind: 'internal', state: 'active' },
  { id: 'pe-gijs', name: 'Gijs Mulder', pseudonym: 'BCDF', kind: 'internal', state: 'left', leftOn: '2026-08-14' },
  { id: 'pe-gone', pseudonym: '7KQM', kind: 'external', state: 'forgotten', leftOn: '2025-06-30', forgottenOn: '2025-09-28' },
  { id: 'pe-lindt', pseudonym: 'GHJK', kind: 'internal', state: 'active', mergedInto: 'pe-pia' },
  { id: 'pe-eva', name: 'Eva Lind', pseudonym: 'MNPQ', kind: 'internal', state: 'active' },
  { id: 'pe-evt', name: 'Eva Lindt', pseudonym: 'RSTV', kind: 'internal', state: 'active' },
]

function register(policy: PeoplePolicy = DEFAULT_POLICY, readOnly = false) {
  let people: readonly Person[] = START
  const left: [string, string][] = []
  const view: PeopleView = {
    read: () => Promise.resolve({ people, policy }),
    add: (person) => {
      const answer = changePeople(people, { kind: 'add', person }, { id: () => 'pe-new', pseudonym: () => 'WXZ2' })
      if ('refused' in answer) return Promise.resolve(answer)
      people = answer.people
      return Promise.resolve({ person: people.find((one) => one.id === 'pe-new')! })
    },
    leave: (id, on) => {
      const answer = changePeople(people, { kind: 'leave', id, on })
      if ('refused' in answer) return Promise.resolve(answer)
      people = answer.people
      left.push([id, on])
      return Promise.resolve({ person: people.find((one) => one.id === id)!, ended: 2 })
    },
    today: () => '2026-10-11',
    readOnly: () => readOnly,
  }
  return { view, left, people: () => people }
}

function shell(people?: PeopleView): ShellView {
  return {
    screen: () => ({ home: { path: '', name: 'Acme Logistics' } }),
    open: () => {},
    client: () => 'Claude Code',
    driving: new Driving(() => '2026-10-11T10:00:00.000Z'),
    ...(people ? { people } : {}),
  }
}

const call = (tool: string, args: Record<string, unknown> = {}) => ({ id: '1', tool, args })
const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse((out.content[0] as { text: string }).text)
}
const refusal = (out: AgentAnswer) => (out.ok ? undefined : out.refusal)

describe('people.list', () => {
  it('lists everyone with nothing open, says whether they have an address and never the address', async () => {
    const out = parsed(await handle(call('people.list'), undefined, shell(register().view)))
    expect(out.shows).toBe('names')
    expect(out.people).toEqual([
      { id: 'pe-pia', name: 'Pia Schulz', kind: 'internal', state: 'active', hasAddress: true },
      { id: 'pe-gijs', name: 'Gijs Mulder', kind: 'internal', state: 'left', leftOn: '2026-08-14', hasAddress: false },
      { id: 'pe-gone', name: 'Former colleague 7KQM', kind: 'external', state: 'forgotten', leftOn: '2025-06-30', forgottenOn: '2025-09-28', hasAddress: false },
      { id: 'pe-eva', name: 'Eva Lind', kind: 'internal', state: 'active', hasAddress: false },
      { id: 'pe-evt', name: 'Eva Lindt', kind: 'internal', state: 'active', hasAddress: false },
    ])
    expect(out.redirects).toEqual([{ id: 'pe-lindt', mergedInto: 'pe-pia' }])
    expect(out.possibleDuplicates).toEqual([{ keep: 'Eva Lind', keepId: 'pe-eva', drop: 'Eva Lindt', dropId: 'pe-evt', sign: 'nearName' }])
    expect(JSON.stringify(out)).not.toContain('acme.example')
  })

  it('shows pseudonyms where the policy says agents see pseudonyms, and searches what it shows', async () => {
    const view = register({ ...DEFAULT_POLICY, agentsSee: 'pseudonyms' }).view
    const out = parsed(await handle(call('people.list', { state: 'active' }), undefined, shell(view)))
    expect(out.shows).toBe('pseudonyms')
    expect((out.people as { name: string }[]).map((one) => one.name)).toEqual(['Person 4K7Q', 'Person MNPQ', 'Person RSTV'])
    expect(JSON.stringify(out)).not.toMatch(/Pia|Schulz|Eva|Lind/)
    expect((parsed(await handle(call('people.list', { query: 'Schulz' }), undefined, shell(view))).people as unknown[])).toEqual([])
  })

  it('is refused where the shell lends no register, and checks its arguments', async () => {
    expect(refusal(await handle(call('people.list'), undefined, shell()))).toBe('agent.noRegister')
    expect(refusal(await handle(call('people.list', { state: 'gone' }), undefined, shell(register().view)))).toBe('agent.badArguments')
  })
})

describe('person.add', () => {
  it('is refused where somebody similar is there, naming them, and adds them when told to anyway', async () => {
    const held = register()
    const similar = await handle(call('person.add', { name: 'Pia Schultz' }), undefined, shell(held.view))
    expect(refusal(similar)).toBe('agent.possibleDuplicate')
    expect(similar.ok ? '' : similar.detail).toContain('pe-pia')
    expect(held.people()).toHaveLength(START.length)
    const added = parsed(await handle(call('person.add', { name: 'Pia Schultz', addAnyway: true }), undefined, shell(held.view)))
    expect(added.added).toEqual({ id: 'pe-new', name: 'Pia Schultz', kind: 'internal', state: 'active', hasAddress: false })
  })

  it('says only how many resemble the one asked about where names are withheld, so no name or address is paired with an entry', async () => {
    const held = register({ ...DEFAULT_POLICY, agentsSee: 'pseudonyms' })
    for (const asked of [{ name: 'Pia Schulz' }, { name: 'Somebody Else', email: 'pia.schulz@acme.example' }]) {
      const similar = await handle(call('person.add', asked), undefined, shell(held.view))
      expect(refusal(similar)).toBe('agent.possibleDuplicate')
      const detail = similar.ok ? '' : similar.detail ?? ''
      expect(detail).not.toMatch(/pe-pia|4K7Q|same|Schulz/)
      expect(JSON.parse(detail)).toMatchObject({ possibleDuplicates: 1 })
    }
  })

  it('adds somebody nobody resembles, keeps the address and never tells it back', async () => {
    const held = register()
    const out = parsed(await handle(call('person.add', { name: 'Sara Kaya', email: 'sara@acme.example', kind: 'external' }), undefined, shell(held.view)))
    expect(out.added).toEqual({ id: 'pe-new', name: 'Sara Kaya', kind: 'external', state: 'active', hasAddress: true })
    expect(held.people().find((one) => one.id === 'pe-new')?.email).toBe('sara@acme.example')
  })

  it('passes the register’s refusal through, and is refused where the register is only read', async () => {
    expect(refusal(await handle(call('person.add', { name: 'Sara', email: 'no address', addAnyway: true }), undefined, shell(register().view))))
      .toBe('people.badEmail')
    expect(refusal(await handle(call('person.add', { name: 'Sara Kaya' }), undefined, shell(register(DEFAULT_POLICY, true).view))))
      .toBe('agent.readOnly')
  })
})

describe('person.leave', () => {
  it('marks someone as left today, or on the day given, and says what leaving ended', async () => {
    const held = register()
    const out = parsed(await handle(call('person.leave', { id: 'pe-eva' }), undefined, shell(held.view)))
    expect(out).toEqual({ left: { id: 'pe-eva', name: 'Eva Lind', kind: 'internal', state: 'left', leftOn: '2026-10-11', hasAddress: false }, endedAssignments: 2 })
    await handle(call('person.leave', { id: 'pe-pia', on: '2026-10-31' }), undefined, shell(held.view))
    expect(held.left).toEqual([['pe-eva', '2026-10-11'], ['pe-pia', '2026-10-31']])
  })

  it('refuses a day that is none, someone who left already, and a read-only register', async () => {
    const held = register()
    expect(refusal(await handle(call('person.leave', { id: 'pe-eva', on: '31 October' }), undefined, shell(held.view)))).toBe('people.badDay')
    expect(refusal(await handle(call('person.leave', { id: 'pe-gijs' }), undefined, shell(held.view)))).toBe('people.notActive')
    expect(refusal(await handle(call('person.leave', { id: 'pe-eva' }), undefined, shell(register(DEFAULT_POLICY, true).view)))).toBe('agent.readOnly')
  })

  it('refuses a last day so far back that the name would be forgotten at once: agents do not forget people', async () => {
    const held = register()
    expect(refusal(await handle(call('person.leave', { id: 'pe-eva', on: '2020-01-01' }), undefined, shell(held.view)))).toBe('agent.badArguments')
    expect(refusal(await handle(call('person.leave', { id: 'pe-eva', on: '2026-07-13' }), undefined, shell(held.view)))).toBe('agent.badArguments')
    expect(held.left).toEqual([])
    expect((await handle(call('person.leave', { id: 'pe-eva', on: '2026-07-14' }), undefined, shell(held.view))).ok).toBe(true)
  })
})

describe('what an agent may not do with people', () => {
  it('has no tool that forgets, removes or merges a person, or changes the policy', () => {
    const about = TOOLS.filter((tool) => /^(people|person)\./.test(tool.name)).map((tool) => tool.name).sort()
    expect(about).toEqual(['people.list', 'person.add', 'person.leave'])
    for (const tool of TOOLS) expect(tool.name, tool.name).not.toMatch(/forget|policy|person\.(remove|merge)/)
  })

  it('takes no scope and no project revision on the three: the register is the organisation’s, outside the history', () => {
    for (const name of ['people.list', 'person.add', 'person.leave'] as const) {
      const properties = TOOLS.find((tool) => tool.name === name)!.inputSchema.properties
      expect('scope' in properties, name).toBe(false)
      expect('ifRevision' in properties, name).toBe(false)
    }
    expect(toolSpec('person.add').tier).toBe('write')
  })
})

describe('the register\'s writes and the person\'s Stop', () => {
  it('drive with nothing open: the banner goes up, and Stop refuses them', async () => {
    const held = register()
    const around = shell(held.view)
    expect((await handle(call('person.add', { name: 'Sara Kaya' }), undefined, around)).ok).toBe(true)
    expect(around.driving.current().session).toMatchObject({ client: 'Claude Code', calls: 1 })
    around.driving.end('person')
    expect(refusal(await handle(call('person.leave', { id: 'pe-pia' }), undefined, around))).toBe('agent.stopped')
    expect(refusal(await handle(call('person.add', { name: 'Ivo Peters' }), undefined, around))).toBe('agent.stopped')
    expect(held.left).toEqual([])
    // Reading the register is not driving.
    expect((await handle(call('people.list'), undefined, around)).ok).toBe(true)
  })
})
