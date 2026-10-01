// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * An element selected on a view as it is opened: through the editor where a
 * board places it, through the card on the technology landscape, through a
 * request a sheet or a map honours — and nowhere a board does not place it.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { DesignDiagram } from '../model'
import type { HostModel } from '../model/hostModel'
import { useViewSelect } from './useViewSelect'

const view = (id: string, kind: DesignDiagram['kind']): DesignDiagram => ({ id, kind, name: id, members: [], geometry: { nodes: [] } })
const model: HostModel = {
  name: 'Landscape', elements: [], relations: [],
  diagrams: [
    laidOut({ id: 'b1', kind: 'layer7', name: 'One', placements: [{ id: 'billing', x: 0, y: 0 }] }),
    view('t1', 'technology'), view('s1', 'sheet'), view('m1', 'map'),
  ],
}

function mount() {
  const focusElement = vi.fn()
  const select = vi.fn()
  const { result } = renderHook(() => useViewSelect({ session: { current: () => model }, focusElement, landscapes: { select } }))
  return { result, focusElement, select }
}

describe('useViewSelect', () => {
  it('asks the editor to select on a board that places it, and nothing where it does not', () => {
    const { result, focusElement } = mount()
    act(() => result.current.select('b1', 'billing'))
    expect(focusElement).toHaveBeenCalledWith('billing')
    act(() => result.current.select('b1', 'crm'))
    expect(focusElement).toHaveBeenCalledTimes(1)
  })

  it('chooses the card on the technology landscape', () => {
    const { result, select, focusElement } = mount()
    act(() => result.current.select('t1', 'openshift'))
    expect(select).toHaveBeenCalledWith('openshift')
    expect(focusElement).not.toHaveBeenCalled()
  })

  it('hands a sheet or a map a request of its own, numbered, and no other view one', () => {
    const { result } = mount()
    act(() => result.current.select('s1', 'invoicing'))
    expect(result.current.requestFor('s1')).toEqual({ id: 'invoicing', nonce: 1 })
    expect(result.current.requestFor('m1')).toBeUndefined()
    act(() => result.current.select('m1', 'invoicing'))
    expect(result.current.requestFor('m1')).toEqual({ id: 'invoicing', nonce: 2 })
    expect(result.current.requestFor('s1')).toBeUndefined()
  })

  it('does nothing for a view the scope does not have', () => {
    const { result, focusElement, select } = mount()
    act(() => result.current.select('gone', 'billing'))
    expect(focusElement).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
    expect(result.current.requestFor('gone')).toBeUndefined()
  })
})
