// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Every question dialog keeps what is typed into it while the page behind it
 * renders, and starts afresh only for another subject (`widgets/useFreshFor`).
 *
 * Each one used to clear its fields whenever its subject object changed, and
 * the pages build that object on every render: the autosave's three states,
 * a blur that saves, a reader's commit, an agent's step and a sync each
 * wiped a half-written answer, and the successor picker went back to its
 * first record, so Confirm could supersede with the wrong one. A dialog
 * that asks a question about a subject belongs in this list.
 */
import { afterEach, describe, it } from 'vitest'
import { cleanup, fireEvent, within } from '@testing-library/react'
import { chooseLast, keepsWhatIsTyped } from './testing/questionDialogs'
import type { QuestionDialogCase } from './testing/questionDialogs'
import { translator } from '../i18n'
import { newCause, newObservation } from '../observations/observation'
import { ArchiveDialog, MergeDialog, SeenDialog, VerifyDialog } from '../observations/ui/ObservationDialogs'
import { LinkDialog } from '../observations/ui/LinkForm'
import { AddressDialog, ConcludeDialog, DropDialog, NewExperimentDialog } from '../observations/ui/SolutionDialogs'
import { newAdr } from '../decisions/adr'
import type { Adr } from '../decisions/adr'
import { SupersedeDialog } from '../decisions/ui/AdrDialogs'
import { ReplaceDialog } from '../roadmap/ui/ReplaceDialog'
import type { DesignElement, DesignModel } from '../model'
import { ScopeSettingsDialog } from './organisation/ScopeSettingsDialog'

afterEach(() => cleanup())

const s = translator('en')
const nothing = () => {}
const causes = () => [1, 2].map((number) => newCause({ id: `c${number}`, number, title: `Cause ${number}`, t: s }))
const observation = (id: string, number: number) => newObservation({ id, number, title: `Seen ${number}`, date: '2026-01-01', t: s })
const accepted = (id: string, number: number): Adr => ({ ...newAdr({ id, number, title: `Record ${number}`, date: '2026-01-01', t: s }), status: 'accepted' })
const application = (id: string): DesignElement =>
  ({ id, kind: 'application', name: 'Warehouse', lifecycle: 'live', isManaged: true, aspects: {} }) as DesignElement
const landscape = (id: string) =>
  ({ name: 'Acme', diagrams: [], connections: [], elements: [application(id), { ...application('erp'), name: 'Ledger' }] }) as unknown as DesignModel

const CASES: QuestionDialogCase[] = [
  {
    name: 'archiving an observation',
    open: (id) => <ArchiveDialog subject={{ id, label: 'O-1 Seen' }} onCancel={nothing} onConfirm={nothing} s={s} />,
  },
  {
    name: 'seeing an observation again',
    open: (id) => <SeenDialog subject={{ id, label: 'O-1 Seen', firstSeen: '2020-01-01' }} today="2026-09-28" onCancel={nothing} onConfirm={nothing} s={s} />,
  },
  {
    name: 'verifying a cause',
    open: (id) => <VerifyDialog subject={{ id, label: 'C-1 Cause' }} onCancel={nothing} onConfirm={nothing} s={s} />,
  },
  {
    name: 'merging an observation',
    open: (id) => <MergeDialog target={observation(id, 1)} candidates={[observation('o2', 2), observation('o3', 3)]} onCancel={nothing} onConfirm={nothing} s={s} />,
  },
  {
    name: 'linking a cause',
    open: (id) => (
      <LinkDialog
        spec={{
          id, title: 'Cause for O-1', intro: 'Why?', subject: 'O-1 Seen',
          candidates: causes().map((one) => ({ key: one.id, label: one.title, title: one.title, root: false })),
          create: { madeIn: 'Acme', nextNumber: 3, behind: [] },
        }}
        onCancel={nothing} onCreate={nothing} onLink={nothing} renderMarkdown={(md) => md} s={s}
      />
    ),
    // The cause's own fields: its title typed and its strength chosen.
    fill: () => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
      fireEvent.change(within(dialog).getByTestId('cause-draft-title'), { target: { value: 'Too few pickers' } })
      chooseLast(within(dialog).getAllByRole('combobox')[0]!)
    },
  },
  {
    name: 'addressing a cause',
    open: (id) => <AddressDialog subject={{ id, label: 'S-1 Solution' }} candidates={causes()} onCancel={nothing} onConfirm={nothing} s={s} />,
  },
  {
    name: 'planning an experiment',
    open: (id) => <NewExperimentDialog subject={{ id, label: 'S-1 Solution' }} onCancel={nothing} onCreate={nothing} s={s} />,
  },
  {
    name: 'dropping a solution',
    open: (id) => <DropDialog subject={{ id, label: 'S-1 Solution' }} onCancel={nothing} onConfirm={nothing} s={s} />,
  },
  {
    name: 'concluding an experiment',
    open: (id) => <ConcludeDialog subject={{ id, label: 'E-1 Trial', outcome: 'confirmed', from: '2020-01-01' }} today="2026-09-28" onCancel={nothing} onConfirm={nothing} s={s} />,
  },
  {
    name: 'superseding a record',
    open: (id) => <SupersedeDialog target={accepted(id, 1)} candidates={[accepted('a2', 2), accepted('a3', 3)]} onCancel={nothing} onConfirm={nothing} s={s} />,
  },
  {
    name: 'replacing an application',
    open: (id) => <ReplaceDialog subject={application(id)} model={landscape(id)} onCancel={nothing} onConfirm={nothing} />,
  },
  {
    name: 'a scope’s settings',
    open: (id) => <ScopeSettingsDialog target={{ path: id, name: 'Sales', diagrams: 0, children: [] }} onSave={nothing} onCancel={nothing} s={s} />,
  },
]

describe('a question dialog', () => {
  it.each(CASES.map((one) => [one.name, one] as const))('keeps what is typed while the page renders, and starts afresh for another subject: %s', (_, one) => {
    keepsWhatIsTyped(one)
  })
})
