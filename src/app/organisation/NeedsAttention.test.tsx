// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** A finding about something on a view opens the view; any other opens its record. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { renderShell } from '../testing/renderShell'
import { NeedsAttention } from './NeedsAttention'

afterEach(() => cleanup())

const s = translator('en')

describe('NeedsAttention', () => {
  it('opens a drawing for a shape on it, and the element for an element', () => {
    const onOpen = vi.fn()
    const onOpenView = vi.fn()
    renderShell(
      <NeedsAttention
        items={[
          { key: 'check.drawingLinkMissing', kind: 'drawingLinkMissing', scope: 'retail', id: 'ctx:b', view: 'ctx', text: 'A shape' },
          { key: 'check.dangling', kind: 'dangling', scope: 'retail', id: 'crm', text: 'An element' },
        ]}
        onOpen={onOpen}
        onOpenView={onOpenView}
        s={s}
      />,
    )
    fireEvent.click(screen.getByTestId('attention-retail-ctx:b'))
    expect(onOpenView).toHaveBeenCalledWith('retail', 'ctx')
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('attention-retail-crm'))
    expect(onOpen).toHaveBeenCalledWith('retail', 'crm')
  })

  it('opens a finding about the operating model on its page, and offers nothing the host cannot open', () => {
    const onOpen = vi.fn()
    const onOpenOperating = vi.fn()
    const items = [{ key: 'check.unitTypeNowhere' as const, kind: 'unitTypeNowhere', scope: '', id: 'ut-guild', page: 'operating' as const, text: 'Guild sits nowhere' }]
    renderShell(<NeedsAttention items={items} onOpen={onOpen} onOpenOperating={onOpenOperating} s={s} />)
    fireEvent.click(screen.getByTestId('attention--ut-guild'))
    expect(onOpenOperating).toHaveBeenCalledWith('ut-guild')
    expect(onOpen).not.toHaveBeenCalled()
    cleanup()
    renderShell(<NeedsAttention items={items} onOpen={onOpen} s={s} />)
    expect(screen.getByTestId<HTMLButtonElement>('attention--ut-guild').disabled).toBe(true)
  })
})
