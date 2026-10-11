// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Every reader of a field that names a person (ADR-0036 §8) reads it through
 * the one register the shell provides: an element's owner, a plan's, who saw
 * an observation, who runs an experiment, who proposed and who signed a
 * decision. A forget made in the register reaches every one of them at once
 * — the pseudonym from then on — and a signature keeps the name it was
 * signed with. A merged id reads as the entry it went into.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AdrPage } from '../decisions/ui/AdrPage'
import { MarkdownView } from '../documentation/ui/MarkdownView'
import { ElementRecord, recordSummary } from '../editor/ElementRecord'
import type { EditorActions } from '../editor/useEditorState'
import { translator } from '../i18n'
import type { Adr } from '../model/adr'
import type { HostModel } from '../model/hostModel'
import type { Experiment, Observation } from '../model/observation'
import type { Transition } from '../model/transition'
import type { DesignElement, DesignModel } from '../model/types'
import { ObservationsPage } from '../observations/ui/ObservationsPage'
import type { Person } from '../people/person'
import { DEFAULT_POLICY } from '../people/policy'
import type { PeopleRegisterAccess } from '../people/ui/access'
import { PersonNamesProvider, personNames } from '../people/ui/names'
import { PlanPage } from '../roadmap/ui/PlanPage'
import type { PlanActions } from '../roadmap/ui/PlanPage'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')

const EVA: Person = { id: 'pe-eva', name: 'Eva Lind', pseudonym: 'BCDF', kind: 'internal', state: 'active' }
const KIM: Person = { id: 'pe-kim', name: 'Kim Bakker', pseudonym: 'GHJK', kind: 'internal', state: 'active' }
const EVA_TOO: Person = { id: 'pe-eva2', pseudonym: 'LMNP', kind: 'internal', state: 'active', mergedInto: 'pe-eva' }
const forgotten = ({ name: _name, ...rest }: Person): Person => ({ ...rest, state: 'forgotten', forgottenOn: '2026-10-11' })

const nothing = () => Promise.resolve({ refused: 'people.unknown' as const })
const access = (people: readonly Person[]): PeopleRegisterAccess => ({
  people, policy: DEFAULT_POLICY, me: undefined, readOnly: false, today: '2026-10-11',
  add: nothing, change: nothing, leave: nothing, forget: nothing, remove: nothing, merge: nothing,
  setPolicy: () => Promise.resolve(), setMe: () => Promise.resolve(), mentionsOf: () => Promise.resolve([]),
})

const BEFORE = [EVA, KIM, EVA_TOO]
const AFTER = [forgotten(EVA), forgotten(KIM), EVA_TOO]

function withRegister(people: readonly Person[], children: ReactNode) {
  return <PersonNamesProvider names={personNames(access(people), s)}>{children}</PersonNamesProvider>
}

const shop: DesignElement = {
  id: 'shop', kind: 'application', name: 'Webshop', owner: { person: 'pe-eva2' }, lifecycle: 'live', isManaged: true, aspects: {},
}

describe('an element’s owner', () => {
  const actions = { updateElement: vi.fn() } as unknown as EditorActions
  const record = (people: readonly Person[]) => withRegister(people, (
    <ElementRecord element={shop} model={{ elements: [shop], relations: [], diagrams: [] } as unknown as DesignModel} readOnly={false} actions={actions} owned={() => false} />
  ))

  it('reads through the register, a merged id as the entry it went into, and the pseudonym once forgotten', () => {
    const view = renderShell(record(BEFORE))
    expect(screen.getByTestId('record-owner-field-picked').textContent).toBe('Eva Lind')
    view.rerender(record(AFTER))
    expect(screen.getByTestId('record-owner-field-picked').textContent).toBe('Former colleague BCDF')
  })

  it('is said in the panel’s line, and where nobody wrote one, as the rule works it out today', () => {
    const names = personNames(access(BEFORE), s)
    expect(recordSummary(shop, { elements: [shop], relations: [], diagrams: [] } as unknown as DesignModel, s, [], { names })).toEqual(['Owner: Eva Lind'])
    const unowned = { ...shop, owner: undefined }
    const workedOut = { people: ['pe-kim'], role: 'Product Owner', unit: 'Team Orders', day: '2026-10-11' }
    expect(recordSummary(unowned, { elements: [], relations: [], diagrams: [] } as unknown as DesignModel, s, [], { names, answeredBy: { workedOut } }))
      .toEqual(['Owner: Kim Bakker, the Product Owner of Team Orders: worked out from the role today, not stored'])
    renderShell(withRegister(BEFORE, (
      <ElementRecord element={unowned} model={{ elements: [unowned], relations: [], diagrams: [] } as unknown as DesignModel}
        readOnly={false} actions={actions} owned={() => false} answeredBy={{ workedOut }} />
    )))
    expect(screen.getByTestId('record-owner-worked-out').textContent).toContain('Kim Bakker')
  })

  it('shows a stand-in’s owner as its master names it, by the same id', () => {
    const standIn = { ...shop, owner: undefined, ref: 'sales' }
    renderShell(withRegister(BEFORE, (
      <ElementRecord element={standIn} model={{ elements: [standIn], relations: [], diagrams: [] } as unknown as DesignModel}
        readOnly={false} actions={actions} owned={(field) => field === 'owner'} answeredBy={{ owner: { person: 'pe-kim' } }} />
    )))
    expect(screen.getByTestId('record-owner-field-picked').textContent).toBe('Kim Bakker')
  })
})

describe('a plan’s owner', () => {
  const plan: Transition = {
    id: 'tr-1', number: 1, title: 'Replace the store', status: 'draft', owner: { person: 'pe-kim' }, elements: [], decisions: [], milestones: [], body: '',
  }
  const page = (people: readonly Person[]) => withRegister(people, (
    <PlanPage open plan={plan} model={{ name: 'Orders', elements: [], relations: [], diagrams: [] } as unknown as DesignModel}
      decisions={[]} today="2026-10-11" readOnly={false} onClose={() => {}} renderMarkdown={(md) => <div>{md}</div>}
      actions={{ updateTransition: vi.fn() } as unknown as PlanActions} />
  ))

  it('reads through the register, and the pseudonym once forgotten', () => {
    const view = renderShell(page(BEFORE))
    expect(screen.getByTestId('plan-owner-picked').textContent).toBe('Kim Bakker')
    view.rerender(page(AFTER))
    expect(screen.getByTestId('plan-owner-picked').textContent).toBe('Former colleague GHJK')
  })
})

describe('who saw an observation, and who runs an experiment', () => {
  const observation: Observation = {
    id: 'o1', number: 1, title: 'Orders arrive twice', date: '2026-10-01', where: 'Checkout', by: { person: 'pe-eva2' },
    impact: 'minor', seen: 1, body: '', history: [{ date: '2026-10-01', kind: 'recorded' }],
  }
  const experiment: Experiment = {
    id: 'e1', number: 1, title: 'Deduplicate', tests: [], hypothesis: 'Half the doubles go', by: { person: 'pe-kim' }, outcome: 'planned', body: '',
  }
  const model: HostModel = { name: 'Orders', elements: [], relations: [], diagrams: [], observations: [observation], experiments: [experiment] }
  const page = (people: readonly Person[], initialId: string) => withRegister(people, (
    <ObservationsPage open onClose={() => {}} model={model} groupName="Acme" scopeLabel={(path) => path} onChange={vi.fn()}
      s={s} language="en" makeId={(prefix) => `${prefix}-1`} today={() => '2026-10-11'} renderMarkdown={(md) => <MarkdownView markdown={md} />}
      initialId={initialId} />
  ))

  it('reads through the register, and the pseudonym once forgotten', async () => {
    const view = renderShell(page(BEFORE, 'o1'))
    expect((await screen.findByTestId('observation-by')).textContent).toBe('Eva Lind')
    view.rerender(page(AFTER, 'o1'))
    expect(screen.getByTestId('observation-by').textContent).toBe('Former colleague BCDF')
    cleanup()
    const again = renderShell(page(BEFORE, 'ex:e1'))
    expect((await screen.findByTestId('experiment-by')).textContent).toBe('Kim Bakker')
    again.rerender(page(AFTER, 'ex:e1'))
    expect(screen.getByTestId('experiment-by').textContent).toBe('Former colleague GHJK')
  })
})

describe('who proposed and who signed a decision', () => {
  const decision: Adr = {
    id: 'ad-1', number: 1, title: 'One order store', status: 'accepted', date: '2026-10-02', body: '## Context\n\nWhy.',
    proposedBy: { person: 'pe-eva2' }, proposedAs: 'Eva Lind',
    signers: [
      { name: { person: 'pe-kim' }, verdict: 'approved', signedAt: '2026-10-02', signedAs: 'Kim Bakker' },
      { name: { person: 'pe-eva' } },
    ],
  }
  const page = (people: readonly Person[], over: Partial<Adr> = {}) => withRegister(people, (
    <AdrPage open onClose={() => {}} model={{ name: 'Orders', elements: [], relations: [], diagrams: [], decisions: [{ ...decision, ...over }] }}
      groupName="Acme" onProjectDecisionsChange={vi.fn()} s={s} language="en" makeId={(prefix) => `${prefix}-1`} today={() => '2026-10-11'}
      renderMarkdown={(md) => <MarkdownView markdown={md} />} initialAdrId="ad-1" />
  ))

  it('keeps the names a signature kept after a forget; the one who did not sign reads as the pseudonym', async () => {
    const view = renderShell(page(BEFORE))
    expect((await screen.findByTestId('adr-signer-0')).textContent).toBe('Kim Bakker')
    expect(screen.getByTestId('adr-signer-1').textContent).toBe('Eva Lind')
    expect(screen.getByTestId('adr-proposed-by').textContent).toBe('Eva Lind')
    view.rerender(page(AFTER))
    expect(screen.getByTestId('adr-signer-0').textContent).toBe('Kim Bakker')
    expect(screen.getByTestId('adr-signer-1').textContent).toBe('Former colleague BCDF')
    expect(screen.getByTestId('adr-proposed-by').textContent).toBe('Eva Lind')
  })

  /**
   * Once the signer is forgotten, the signature links to nobody (ADR-0036 §8):
   * the name as signed is shown alone, even where the record is still being
   * written, and never beside the pseudonym — the page holds no picked person
   * to follow to the entry.
   */
  it('shows a forgotten signer\'s and proposer\'s kept names alone where the record is still written, never their pseudonyms', async () => {
    const open: Partial<Adr> = { status: 'reviewing', signers: [decision.signers[0]] }
    const view = renderShell(page(BEFORE, open))
    expect((await screen.findByTestId('adr-signer-0-picked')).textContent).toBe('Kim Bakker')
    view.rerender(page(AFTER, open))
    expect(screen.queryByTestId('adr-signer-0-picked')).toBeNull()
    expect(screen.getByTestId('adr-signer-0').textContent).toBe('Kim Bakker')
    expect(screen.getByTestId('adr-proposed-by').textContent).toBe('Eva Lind')
    const shown = document.body.textContent ?? ''
    expect(shown).not.toContain('GHJK')
    expect(shown).not.toContain('BCDF')
  })

  it('writes the name a person signs with when they give a verdict', async () => {
    const changed = vi.fn()
    renderShell(withRegister(BEFORE, (
      <AdrPage open onClose={() => {}} groupName="Acme" onProjectDecisionsChange={changed} s={s} language="en"
        model={{ name: 'Orders', elements: [], relations: [], diagrams: [], decisions: [{ ...decision, status: 'reviewing', proposedAs: undefined, signers: [{ name: { person: 'pe-kim' } }] }] }}
        makeId={(prefix) => `${prefix}-1`} today={() => '2026-10-11'} renderMarkdown={(md) => <MarkdownView markdown={md} />} initialAdrId="ad-1" />
    )))
    const table = await screen.findByTestId('adr-signers')
    fireEvent.mouseDown(within(table).getByRole('combobox', { name: 'Verdict' }))
    fireEvent.click(screen.getByRole('option', { name: 'Approved' }))
    const [next] = changed.mock.calls.at(-1)! as [Adr[]]
    expect(next[0].signers[0]).toMatchObject({ name: { person: 'pe-kim' }, verdict: 'approved', signedAs: 'Kim Bakker' })
    expect(next[0].proposedAs).toBe('Eva Lind')
  })
})
