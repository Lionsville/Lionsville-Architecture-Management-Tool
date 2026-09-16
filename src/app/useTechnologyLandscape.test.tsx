// @vitest-environment jsdom
/**
 * The shell's side of the technology landscape (ADR-0015).
 *
 * The arithmetic is pinned in `model/technologyLandscape.test.ts` and the
 * page in `TechnologyLandscapePage.test.tsx`. What is pinned here is the
 * wiring: that the view is a diagram but never the active one, that making
 * one is one step on the session's stack, and that the page it opens is the
 * one it made.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { translator } from '../i18n'
import { shippingScope } from '../business/testFixtures'
import type { HostModel } from '../model/fromInterchange'
import type { ScopeSnapshot } from '../projects/scope'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'
import { useTechnologyLandscape } from './useTechnologyLandscape'
import type { TechnologyLandscapes } from './useTechnologyLandscape'

afterEach(() => cleanup())

const project = (): ScopeSnapshot => {
  const { elements, relations } = shippingScope()
  const model: HostModel = {
    name: 'Platforms',
    elements,
    relations,
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  }
  return { path: 'acme/platforms', model, activeDiagramId: 'd1', logoLibrary: [] }
}

function mount() {
  let views!: TechnologyLandscapes
  let session!: ModelSession
  let counter = 0
  function Host() {
    session = useModelSession({ initialProject: project(), notify: vi.fn(), s: translator('en') })
    views = useTechnologyLandscape({ session, makeId: (p) => `${p}-${++counter}`, s: translator('en') })
    return null
  }
  render(<Host />)
  return {
    views: () => views,
    model: () => session.current(),
    activeId: () => session.currentActiveId(),
    steps: () => session.history().length,
    undo: () => act(() => session.undo()),
  }
}

describe('making one', () => {
  it('adds a technology view with no members, named in the shell\'s words, and opens it', () => {
    const host = mount()
    act(() => host.views().create())
    const made = host.model().diagrams.find((d) => d.id === 'tl-1')
    expect(made).toMatchObject({ kind: 'technology', name: 'Technology landscape' })
    expect(host.views().diagramId).toBe('tl-1')
    expect(host.views().diagram?.id).toBe('tl-1')
  })

  it('becomes the active view, drawn in the tab (ADR-0016)', () => {
    const host = mount()
    act(() => host.views().create())
    expect(host.activeId()).toBe('tl-1')
  })

  it('is one step, and undoing it takes the view back off', () => {
    const host = mount()
    act(() => host.views().create())
    expect(host.steps()).toBe(1)
    host.undo()
    expect(host.model().diagrams.some((d) => d.kind === 'technology')).toBe(false)
    expect(host.views().diagram).toBeUndefined()
  })
})

describe('opening and closing', () => {
  it('opens by id, and a board active leaves it', () => {
    const host = mount()
    act(() => host.views().create())
    act(() => host.views().open('d1'))
    expect(host.views().diagramId).toBeUndefined()
    act(() => host.views().open('tl-1'))
    expect(host.views().diagram?.name).toBe('Technology landscape')
  })
})
