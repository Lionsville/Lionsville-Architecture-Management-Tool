// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import { RecordChanges, RecordChangesProvider } from './RecordChanges'
import type { RecordChangeEntry, RecordChangesAccess } from './RecordChanges'

afterEach(cleanup)

const entries: RecordChangeEntry[] = [
  { id: 'e3', at: Date.UTC(2026, 9, 20, 9), by: 'Bo Example', via: 'An agent' },
  { id: 'e2', at: Date.UTC(2026, 9, 12, 9), by: 'Bo Example' },
  { id: 'e1', at: Date.UTC(2026, 9, 1, 9), by: 'Ada Example' },
]

function access(over: Partial<RecordChangesAccess> = {}): RecordChangesAccess {
  return {
    entriesOf: vi.fn(async () => ({ entries, more: false })),
    whatOf: vi.fn(async () => ['changed tone', 'changed title', 'Created']),
    ...over,
  }
}

const about = { kind: 'observation' as const, id: 'ob-1' }

describe('a record\'s changes on its reader (ADR-0038, amended §11)', () => {
  it('says who recorded it, who changed it last via which client, and how often', async () => {
    renderShell(<RecordChangesProvider value={access()}><RecordChanges about={about} /></RecordChangesProvider>)
    const line = await screen.findByTestId('record-changes-line')
    expect(line.textContent).toContain('Recorded by Ada Example')
    expect(line.textContent).toContain('last changed by Bo Example via An agent')
    expect(line.textContent).toContain('3 changes')
  })

  it('reads what each did only when the list is opened', async () => {
    const held = access()
    renderShell(<RecordChangesProvider value={held}><RecordChanges about={about} /></RecordChangesProvider>)
    await screen.findByTestId('record-changes-line')
    expect(held.whatOf).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Changes' }))
    await waitFor(() => expect(screen.getByTestId('record-changes-list').textContent).toContain('changed tone'))
    expect(held.whatOf).toHaveBeenCalledTimes(1)
    expect(await axeFindings()).toEqual([])
  })

  it('leaves out who began it where older entries were not read, and says there are more', async () => {
    renderShell(<RecordChangesProvider value={access({ entriesOf: async () => ({ entries, more: true }) })}><RecordChanges about={about} /></RecordChangesProvider>)
    const line = await screen.findByTestId('record-changes-line')
    expect(line.textContent).not.toContain('Recorded by')
    expect(line.textContent).toContain('3+ changes')
  })

  it('draws nothing with no history, and nothing for a record no entry wrote yet', async () => {
    const { container } = renderShell(<RecordChanges about={about} />)
    expect(container.querySelector('[data-testid="record-changes"]')).toBeNull()
    renderShell(<RecordChangesProvider value={access({ entriesOf: async () => ({ entries: [], more: false }) })}><RecordChanges about={about} /></RecordChangesProvider>)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByTestId('record-changes')).toBeNull()
  })
})
