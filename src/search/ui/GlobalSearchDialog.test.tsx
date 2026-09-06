// @vitest-environment jsdom
/**
 * The wide finder: grouped hits, the keyboard driving the list from the field,
 * and a chosen hit handed back whole so the caller can open what it is about.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/fromInterchange'
import type { Adr } from '../../decisions/adr'
import { GlobalSearchDialog } from './GlobalSearchDialog'
import { renderShell } from '../../app/testing/renderShell'

afterEach(() => cleanup())

const element = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id, name, kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {}, ...over,
}) as HostModel['elements'][number]

const model: HostModel = {
  name: 'Landscape', customerName: 'Acme',
  elements: [
    element('billing', 'Billing', { technology: 'Kafka' }),
    element('crm', 'CRM', { description: 'Publishes customer events on Kafka.' }),
  ],
  connections: [], diagrams: [],
  decisions: [{ id: 'adr-1', number: 1, title: 'Use Kafka for events', status: 'accepted', date: '2026-09-01', body: '', signers: [] }],
}
const groupDecisions: Adr[] = [
  { id: 'adr-g', number: 1, title: 'One message broker for the group', status: 'proposed', date: '2026-09-01', body: 'Kafka, not RabbitMQ.', signers: [] },
]

describe('GlobalSearchDialog', () => {
  it('groups hits by kind and says where a decision lives', () => {
    renderShell(<GlobalSearchDialog open model={model} groupDecisions={groupDecisions} onClose={() => {}} onChoose={() => {}} s={translator('en')} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kafka' } })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(4)
    expect(screen.getByText('Elements')).toBeTruthy()
    expect(screen.getByText('Documentation')).toBeTruthy()
    expect(screen.getByText('Decisions')).toBeTruthy()
    expect(screen.getByText(/Group · Kafka, not RabbitMQ/)).toBeTruthy()
    expect(screen.getByText('Landscapes')).toBeTruthy()
  })

  it('Enter takes the highlighted hit and closes; the arrows move the highlight', () => {
    const onChoose = vi.fn()
    const onClose = vi.fn()
    renderShell(<GlobalSearchDialog open model={model} groupDecisions={groupDecisions} onClose={onClose} onChoose={onChoose} s={translator('en')} />)
    const field = screen.getByRole('combobox')
    fireEvent.change(field, { target: { value: 'kafka' } })
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ kind: 'documentation', elementId: 'crm' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('says so when nothing matches', () => {
    renderShell(<GlobalSearchDialog open model={model} groupDecisions={[]} onClose={() => {}} onChoose={() => {}} s={translator('en')} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nothing matches “zzz”.')).toBeTruthy()
  })
})
