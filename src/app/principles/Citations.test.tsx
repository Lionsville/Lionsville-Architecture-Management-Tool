// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Citing a principle from a record (ADR-0041 §7, §9), over a scope's
 * session as the workspace lands it: a decision supports one and departs from
 * a flexible one with its reason, a fixed one refuses the departure, and
 * *Deviates…* on an element proposes a new decision about it.
 */
import { useMemo, useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderShell } from '../testing/renderShell'
import { axeFindings } from '../testing/axe'
import { translator } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { fromArrays, toArrays } from '../../model/normalised'
import type { Principle } from '../../model/principle'
import { apply } from '../../model/reducer'
import { CitationsSection } from '../../principles/ui/CitationsSection'
import { PrinciplesProvider } from '../../principles/ui/PrinciplesContext'
import type { ScopePrinciples } from '../../projects/scopeIndex'
import { usePrinciplesAccess } from './usePrinciplesAccess'

afterEach(cleanup)

const principle = (id: string, number: number, title: string, regime: Principle['regime']): Principle => ({
  id, number, title, statement: `${title}.`, aspects: [{ id: `${id}-a`, number: 1, text: 'The claim', nature: 'design' }], lastAspect: 1,
  groups: [], regime, status: 'accepted',
})
const reuse = principle('pr-reuse', 1, 'Reuse before buy', 'flexible')
const owned = principle('pr-owned', 2, 'Data is owned where made', 'fixed')

const start: HostModel = {
  name: 'Acme', diagrams: [], relations: [],
  elements: [{ id: 'crm', kind: 'application', name: 'CRM', lifecycle: 'live', isManaged: true, aspects: {} }],
  decisions: [{ id: 'adr-1', number: 1, title: 'Buy a CRM', status: 'proposed', date: '2026-10-01', body: 'We buy one.', subjectId: 'crm' } as never],
}

function Harness({ steps, opened, about }: { steps: Command[]; opened: (id: string) => void; about: { kind: 'decision' | 'element'; id: string } }) {
  const [model, setModel] = useState(start)
  const latest = useRef(model)
  const counter = useRef(0)
  const session = useMemo(() => ({
    model, readOnly: false,
    indexed: () => fromArrays(latest.current),
    dispatch: (command: Command) => {
      const result = apply(fromArrays(latest.current), command)
      if (!result.ok) return undefined
      steps.push(command)
      latest.current = toArrays(result.model)
      setModel(latest.current)
      return latest.current
    },
  }), [model, steps])
  const access = usePrinciplesAccess({
    session, scope: 'acme',
    index: { principlesAt: (path: string): ScopePrinciples => (path === '' ? { principles: [reuse, owned], groups: [] } : { principles: [], groups: [] }), citations: () => [] },
    scopeLabel: (path) => (path === '' ? 'Organisation' : 'Acme'),
    makeId: (prefix) => { counter.current += 1; return `${prefix}-new-${counter.current}` },
    today: () => '2026-10-25', openHere: () => {}, openDecision: opened, t: translator('en'),
  })
  return <PrinciplesProvider value={access}><CitationsSection about={about} subject="Buy a CRM" /></PrinciplesProvider>
}

async function pick(title: string) {
  const input = within(await screen.findByRole('dialog')).getByRole('combobox', { name: 'Principle' })
  input.focus()
  fireEvent.change(input, { target: { value: title } })
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(title) }))
}

describe('citing a principle from a record (ADR-0041 §7)', () => {
  it('lets a decision support one, as a step, and lists it', async () => {
    const steps: Command[] = []
    renderShell(<Harness steps={steps} opened={() => {}} about={{ kind: 'decision', id: 'adr-1' }} />)
    fireEvent.click(screen.getByTestId('cite-open'))
    await pick('Reuse before buy')
    fireEvent.click(screen.getByTestId('cite-submit'))
    await waitFor(() => expect(screen.getByTestId('citations-section').textContent).toContain('Reuse before buy'))
    expect(steps).toEqual([expect.objectContaining({ type: 'citation.add', citation: expect.objectContaining({ stance: 'supports', principle: { scope: '', id: 'pr-reuse' } }) })])
    expect(await axeFindings()).toEqual([])
  })

  it('departs from a flexible one with a reason, and refuses a departure from a fixed one', async () => {
    const steps: Command[] = []
    renderShell(<Harness steps={steps} opened={() => {}} about={{ kind: 'decision', id: 'adr-1' }} />)
    fireEvent.click(screen.getByTestId('cite-open'))
    await pick('Data is owned')
    fireEvent.click(screen.getByTestId('cite-stance-deviates'))
    expect(screen.getByTestId('cite-fixed')).toBeTruthy()
    expect((screen.getByTestId('cite-submit') as HTMLButtonElement).disabled).toBe(true)
    await pick('Reuse before buy')
    expect((screen.getByTestId('cite-submit') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(screen.getByTestId('cite-reason')).getByRole('textbox'), { target: { value: 'Nothing we have fits' } })
    fireEvent.click(screen.getByTestId('cite-submit'))
    await waitFor(() => expect(steps).toHaveLength(1))
    expect(steps[0]).toMatchObject({ type: 'citation.add', citation: { stance: 'deviates', reason: 'Nothing we have fits' } })
  })

  it('proposes a new decision about an element that departs from a principle, cited, in one step, and opens it', async () => {
    const steps: Command[] = []
    const opened = vi.fn()
    renderShell(<Harness steps={steps} opened={opened} about={{ kind: 'element', id: 'crm' }} />)
    fireEvent.click(screen.getByTestId('deviate-open'))
    await pick('Reuse before buy')
    fireEvent.change(within(screen.getByTestId('cite-reason')).getByRole('textbox'), { target: { value: 'Nothing we have fits' } })
    fireEvent.click(screen.getByTestId('cite-submit'))
    await waitFor(() => expect(steps).toHaveLength(1))
    const step = steps[0] as Extract<Command, { type: 'transaction' }>
    expect(step.commands.map((one) => one.type)).toEqual(['decision.add', 'citation.add'])
    expect(step.commands[0]).toMatchObject({ decision: { subjectId: 'crm', title: 'CRM departs from PR-0001 Reuse before buy', number: 2 } })
    expect(opened).toHaveBeenCalledWith((step.commands[0] as Extract<Command, { type: 'decision.add' }>).decision.id)
  })
})
