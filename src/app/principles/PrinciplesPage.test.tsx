// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The principles page over a scope's session (ADR-0041 §12): written with a
 * group made on the spot in one step, accepted, sharpened with its note,
 * merged, and removed — each a step on the session, as the workspace lands
 * it — and a principle from above read and not written.
 */
import { useMemo, useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderShell } from '../testing/renderShell'
import { axeFindings } from '../testing/axe'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { fromArrays, toArrays } from '../../model/normalised'
import type { Principle } from '../../model/principle'
import { apply } from '../../model/reducer'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import { PrinciplesPage } from '../../principles/ui/PrinciplesPage'
import { PrinciplesProvider } from '../../principles/ui/PrinciplesContext'
import type { ScopePrinciples } from '../../projects/scopeIndex'
import { usePrinciplesAccess } from './usePrinciplesAccess'

afterEach(cleanup)

const above: Principle = {
  id: 'pr-org', number: 1, title: 'Data is owned where it is made', statement: 'The scope that makes data answers for it.',
  aspects: [{ id: 'a1', number: 1, text: 'One owner per record', nature: 'design' }], lastAspect: 1,
  groups: [], regime: 'fixed', status: 'accepted',
}

/** A topic's principle (ADR-0042 §4): in force wherever the topic is relevant. */
const topical: Principle = { ...above, id: 'pr-sec', title: 'Least privilege', statement: 'Grant the least that works.' }

function Harness({ initial, steps, readOnly = false, topics }: { initial: HostModel; steps: Command[]; readOnly?: boolean; topics?: (scope: string) => string[] }) {
  const [model, setModel] = useState(initial)
  const latest = useRef(model)
  const counter = useRef(0)
  const session = useMemo(() => ({
    model,
    readOnly,
    indexed: () => fromArrays(latest.current),
    dispatch: (command: Command) => {
      const result = apply(fromArrays(latest.current), command)
      if (!result.ok) return undefined
      steps.push(command)
      latest.current = toArrays(result.model)
      setModel(latest.current)
      return latest.current
    },
  }), [model, readOnly, steps])
  const access = usePrinciplesAccess({
    session, scope: 'acme',
    index: {
      principlesAt: (path: string): ScopePrinciples => (path === '' ? { principles: [above], groups: [] } : path === 'topics/security' ? { principles: [topical], groups: [] } : { principles: [], groups: [] }),
      citations: () => [],
    },
    ...(topics ? { topics } : {}),
    scopeLabel: (path) => (path === '' ? 'Organisation' : path === 'topics/security' ? 'Security' : 'Acme'),
    makeId: (prefix) => { counter.current += 1; return `${prefix}-${counter.current}` },
    today: () => '2026-10-25',
    openHere: () => {},
  })
  return (
    <PrinciplesProvider value={access}>
      <PrinciplesPage open onClose={() => {}} scope="acme" windowChrome={NO_WINDOW_CHROME} />
    </PrinciplesProvider>
  )
}

const blank: HostModel = { name: 'Acme', elements: [], relations: [], diagrams: [] }

function write(title: string, statement: string, aspect: string) {
  fireEvent.click(screen.getByTestId('principles-new'))
  fireEvent.change(screen.getByTestId('principle-title'), { target: { value: title } })
  fireEvent.change(within(screen.getByTestId('principle-statement')).getByRole('textbox'), { target: { value: statement } })
  fireEvent.click(screen.getByTestId('principle-add-aspect'))
  fireEvent.change(screen.getAllByRole('textbox', { name: 'What it claims' }).at(-1)!, { target: { value: aspect } })
}

describe('the principles page (ADR-0041)', () => {
  it('lists a topic\'s principles under the topic, apart from those above, wherever the topic is relevant (ADR-0042 §4)', () => {
    renderShell(<Harness initial={blank} steps={[]} topics={(scope) => (scope === 'acme' ? ['topics/security'] : [])} />)
    expect(screen.getByRole('row', { name: /In force here, from the topic Security/ })).toBeTruthy()
    expect(screen.getByRole('row', { name: /In force here, from Organisation/ })).toBeTruthy()
    expect(screen.getByText('Least privilege')).toBeTruthy()
  })

  it('says on a row only what stands out: nothing for accepted and flexible, and a candidate that is fixed says both', async () => {
    const steps: Command[] = []
    renderShell(<Harness initial={blank} steps={steps} />)
    // From above, accepted and fixed.
    expect(screen.getByRole('row', { name: /Data is owned where it is made/ }).textContent).toContain('Fixed')
    write('Reuse before buy', 'Reuse before buy before build.', 'Look for one first')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    const made = await screen.findByRole('row', { name: /Reuse before buy/, hidden: true })
    expect(made.textContent).toContain('Candidate')
    expect(made.textContent).not.toContain('Flexible')
  })

  it('writes a principle with a group made on the spot, in one step, and opens it', async () => {
    const steps: Command[] = []
    renderShell(<Harness initial={blank} steps={steps} />)
    write('Reuse before buy', 'Reuse before buy before build.', 'Look for one first')
    const groups = within(screen.getByTestId('principle-groups')).getByRole('combobox')
    groups.focus()
    fireEvent.change(groups, { target: { value: 'Reuse' } })
    fireEvent.click(await screen.findByRole('option', { name: 'New group “Reuse”' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(screen.getByTestId('principles-list').textContent).toContain('Reuse before buy'))
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({ type: 'transaction' })
    // The group's heading, made with it.
    expect(screen.getByTestId('principles-list').textContent).toContain('Reuse')
    expect(screen.getByRole('dialog').textContent).toContain('PR-0001')
    expect(await axeFindings()).toEqual([])
  })

  it('accepts one, then asks for a note before it is sharpened, and lists it', async () => {
    const steps: Command[] = []
    renderShell(<Harness initial={blank} steps={steps} />)
    write('Reuse before buy', 'Reuse before buy before build.', 'Look for one first')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.click(await screen.findByTestId('principle-accept'))
    await waitFor(() => expect(screen.getByTestId('principle-status').textContent).toContain('25 Oct 2026'))
    fireEvent.click(screen.getByTestId('principle-edit'))
    fireEvent.change(within(screen.getByTestId('principle-statement')).getByRole('textbox'), { target: { value: 'Reuse first, always.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    // Not saved yet: the note is asked first.
    const note = await screen.findByTestId('principle-sharpen-note')
    expect(steps).toHaveLength(2)
    fireEvent.change(note, { target: { value: 'First means first' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the sharpening' }))
    await waitFor(() => expect(screen.getByTestId('principle-reader').textContent).toContain('First means first'))
    expect(steps).toHaveLength(3)
  })

  it('merges one into another, typed to find, and removes one from More', async () => {
    const steps: Command[] = []
    renderShell(<Harness initial={blank} steps={steps} />)
    write('Reuse before buy', 'Reuse first.', 'Look for one first')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await screen.findByTestId('principle-reader')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    write('Reuse is cheaper', 'Reuse costs less.', 'Count what it saves')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('Reuse is cheaper'))
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Merge another into this one…' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /Reuse before buy/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    await waitFor(() => expect(screen.queryByRole('row', { name: /Reuse before buy/, hidden: true })).toBeNull())
    expect(screen.getByTestId('principle-aspects').textContent).toContain('Look for one first')
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('row', { name: /Reuse is cheaper/, hidden: true })).toBeNull())
  })

  it('reads a principle from above, says where it is kept, and offers nothing that would write it', async () => {
    renderShell(<Harness initial={blank} steps={[]} />)
    expect(screen.getByTestId('principles-list').textContent).toContain('In force here, from Organisation')
    fireEvent.click(screen.getByRole('row', { name: /Data is owned where it is made/ }))
    expect(screen.getByTestId('principle-reader').textContent).toContain('Kept in Organisation')
    expect(screen.queryByTestId('principle-edit')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('leaves retired ones out of a search, and says how to include them', () => {
    renderShell(<Harness initial={blank} steps={[]} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search principles' }), { target: { value: 'tariff' } })
    expect(screen.getByText('Nothing here says “tariff”.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Include retired' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Write it as a new principle' })).toBeTruthy()
  })

  it('offers nothing to write where the scope is only read', () => {
    renderShell(<Harness initial={blank} steps={[]} readOnly />)
    expect(screen.queryByTestId('principles-new')).toBeNull()
  })
})
