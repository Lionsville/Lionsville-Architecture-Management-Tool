// @vitest-environment jsdom
/**
 * The shell's side of a platform's page (ADR-0013).
 *
 * The layout is pinned in `model/technologyDiagram.test.ts` and the page in
 * `TechnologyPage.test.tsx`. What is pinned here is the wiring: that a view
 * is a diagram but never the active one, that making one is one step on the
 * session's stack and made once per platform, and that a platform this
 * scope does not hold gets no view.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { element, laidOut } from '../model/testFixtures'
import { translator } from '../i18n'
import type { HostModel } from '../model/fromInterchange'
import type { ScopeSnapshot } from '../projects/scope'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'
import { useTechnology } from './useTechnology'
import type { Technology } from './useTechnology'

afterEach(() => cleanup())

const project = (): ScopeSnapshot => {
  const model: HostModel = {
    name: 'Landscape',
    elements: [element('esb', { kind: 'platform', name: 'ESB' }), element('orders')],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  }
  return { path: 'acme/landscape', model, activeDiagramId: 'd1', logoLibrary: [] }
}

function mount() {
  let technology!: Technology
  let session!: ModelSession
  let counter = 0
  function Host() {
    session = useModelSession({ initialProject: project(), notify: vi.fn(), s: translator('en') })
    technology = useTechnology({ session, makeId: (p) => `${p}-${++counter}`, s: translator('en') })
    return null
  }
  render(<Host />)
  return {
    technology: () => technology,
    model: () => session.current(),
    activeId: () => session.currentActiveId(),
    steps: () => session.history().length,
    undo: () => act(() => session.undo()),
  }
}

describe('making one', () => {
  it('adds a view named for the platform, and opens it', () => {
    const host = mount()
    act(() => host.technology().create('esb'))
    const made = host.model().diagrams.find((d) => d.kind === 'technology')!
    expect(made).toMatchObject({ id: 'tv-1', name: 'ESB · technology', platformId: 'esb' })
    expect(host.technology().viewId).toBe('tv-1')
    expect(host.technology().view?.id).toBe('tv-1')
  })

  it('leaves the canvas on the board it was on, and is one undo step', () => {
    const host = mount()
    act(() => host.technology().create('esb'))
    expect(host.activeId()).toBe('d1')
    expect(host.steps()).toBe(1)
    host.undo()
    expect(host.model().diagrams.some((d) => d.kind === 'technology')).toBe(false)
    expect(host.technology().view).toBeUndefined()
  })

  it('opens the one already about the platform rather than making a second', () => {
    const host = mount()
    act(() => host.technology().create('esb'))
    act(() => host.technology().close())
    act(() => host.technology().create('esb'))
    expect(host.model().diagrams.filter((d) => d.kind === 'technology')).toHaveLength(1)
    expect(host.technology().viewId).toBe('tv-1')
    expect(host.steps()).toBe(1)
  })

  it('makes nothing about a thing that is not a platform, or that this scope does not hold', () => {
    const host = mount()
    act(() => host.technology().create('orders'))
    act(() => host.technology().create('nowhere'))
    expect(host.model().diagrams.some((d) => d.kind === 'technology')).toBe(false)
    expect(host.technology().viewId).toBeUndefined()
  })
})
