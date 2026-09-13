// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { AddFromLibraryDialog } from './AddFromLibraryDialog'
import { renderShell } from '../testing/renderShell'
import { translator } from '../../i18n'
import type { LibraryRow } from '../../projects/library'

afterEach(() => cleanup())

const rows: LibraryRow[] = [
  { id: 'crm', name: 'CRM', master: '', held: true },
  { id: 'shelf', name: 'Shelf planner', master: 'acme/retail/stores', held: false },
  { id: 'ledger', name: 'Ledger', held: false },
]

function mount(choice: Parameters<typeof AddFromLibraryDialog>[0]['choice'], over: Partial<Parameters<typeof AddFromLibraryDialog>[0]> = {}) {
  const props = {
    choice, scopeLabel: (path: string) => path || 'Acme',
    onPick: vi.fn(), onOwn: vi.fn(), onDrawOnly: vi.fn(), onPlace: vi.fn(), onCancel: vi.fn(), s: translator('en'),
    ...over,
  }
  renderShell(<AddFromLibraryDialog {...props} />)
  return props
}

describe('AddFromLibraryDialog', () => {
  it('lists the rows with where each is answered for, filters them, and answers with the one pressed', () => {
    const props = mount({ kind: 'picking', rows })
    expect(screen.getByText('In this scope, not on this board')).toBeTruthy()
    expect(screen.getByText('Defined in acme/retail/stores')).toBeTruthy()
    expect(screen.getByText('Nobody defines it')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search the register'), { target: { value: 'shelf' } })
    expect(screen.queryByText('CRM')).toBeNull()
    fireEvent.click(screen.getByText('Shelf planner'))
    expect(props.onPick).toHaveBeenCalledWith('shelf')
  })

  it('says so when everything is on the board already', () => {
    mount({ kind: 'picking', rows: [] })
    expect(screen.getByText('Every application in the organisation is on this board already.')).toBeTruthy()
    expect(screen.queryByLabelText('Search the register')).toBeNull()
  })

  it('asks the one question with both answers, and only the yes where no address is on offer', () => {
    const props = mount({ kind: 'asking', id: 'ledger', name: 'Ledger', canDrawOnly: true })
    expect(screen.getByText('Let this scope answer for Ledger?')).toBeTruthy()
    fireEvent.click(screen.getByText('Draw it only'))
    expect(props.onDrawOnly).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Answer for it here'))
    expect(props.onOwn).toHaveBeenCalled()

    cleanup()
    mount({ kind: 'asking', id: 'ledger', name: 'Ledger', canDrawOnly: false })
    expect(screen.queryByText('Draw it only')).toBeNull()
    expect(screen.getByText('Answer for it here')).toBeTruthy()
  })

  it('asks which band a stand-in goes in, and answers with the one pressed', () => {
    const props = mount({ kind: 'placing', id: 'shelf', name: 'Shelf planner' })
    expect(screen.getByText('How should Shelf planner appear here?')).toBeTruthy()
    fireEvent.click(screen.getByText('An application from another domain'))
    expect(props.onPlace).toHaveBeenCalledWith('domain')
    fireEvent.click(screen.getByText('An external reference'))
    expect(props.onPlace).toHaveBeenCalledWith('external')
  })

  it('is not there without a choice', () => {
    mount(undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
