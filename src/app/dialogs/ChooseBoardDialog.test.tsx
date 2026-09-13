// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { ChooseBoardDialog } from './ChooseBoardDialog'
import { renderShell } from '../testing/renderShell'
import { translator } from '../../i18n'
import type { DesignDiagram } from '../../model'

afterEach(() => cleanup())

const board = (id: string, name: string, asOf?: string): DesignDiagram => ({
  id, kind: 'layer7', name, members: [], geometry: { nodes: [] }, ...(asOf ? { asOf } : {}),
})

describe('ChooseBoardDialog', () => {
  it('names the thing, lists the boards with their day, and answers with the one pressed', () => {
    const onChoose = vi.fn()
    renderShell(
      <ChooseBoardDialog
        choice={{ id: 'wms', name: 'Warehouse system', boards: [board('d1', 'Landscape'), board('d2', 'Landscape in 2027', '2027-06-01')] }}
        onChoose={onChoose} onCancel={vi.fn()} s={translator('en')}
      />,
    )
    expect(screen.getByText('Warehouse system is drawn on more than one board.')).toBeTruthy()
    expect(screen.getByText('As of 2027-06-01')).toBeTruthy()
    fireEvent.click(screen.getByText('Landscape in 2027'))
    expect(onChoose).toHaveBeenCalledWith('d2')
  })

  it('is not there without a question', () => {
    renderShell(<ChooseBoardDialog choice={undefined} onChoose={vi.fn()} onCancel={vi.fn()} s={translator('en')} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
