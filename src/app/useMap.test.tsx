// @vitest-environment jsdom
/**
 * The shell's side of the enterprise map (ADR-0012 §6).
 *
 * The layout is pinned in `business/map.test.ts` and the page in
 * `MapPage.test.tsx`. What is pinned here is the wiring: that a map is a
 * diagram but never the active one, that making one is one step on the
 * session's stack, and that the page it opens is the one it made.
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
import { useMap } from './useMap'
import type { Maps } from './useMap'

afterEach(() => cleanup())

const project = (): ScopeSnapshot => {
  const { elements, relations } = shippingScope()
  const model: HostModel = {
    name: 'Landscape',
    elements,
    relations,
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  }
  return { path: 'acme/landscape', model, activeDiagramId: 'd1', logoLibrary: [] }
}

function mount() {
  let maps!: Maps
  let session!: ModelSession
  let counter = 0
  function Host() {
    session = useModelSession({ initialProject: project(), notify: vi.fn(), s: translator('en') })
    maps = useMap({ session, makeId: (p) => `${p}-${++counter}`, s: translator('en') })
    return null
  }
  render(<Host />)
  return {
    maps: () => maps,
    model: () => session.current(),
    activeId: () => session.currentActiveId(),
    steps: () => session.history().length,
    undo: () => act(() => session.undo()),
  }
}

describe('making one', () => {
  it('adds a map named for the shell, and opens it', () => {
    const host = mount()
    act(() => host.maps().create())
    const made = host.model().diagrams.find((d) => d.kind === 'map')!
    expect(made).toMatchObject({ id: 'mp-1', name: 'Enterprise map' })
    expect(made.areas).toBeUndefined()
    expect(host.maps().mapId).toBe('mp-1')
    expect(host.maps().map?.id).toBe('mp-1')
  })

  it('leaves the canvas on the board it was on', () => {
    const host = mount()
    act(() => host.maps().create())
    expect(host.activeId()).toBe('d1')
  })

  it('is one step, and undoing it takes the map back off', () => {
    const host = mount()
    act(() => host.maps().create())
    expect(host.steps()).toBe(1)
    host.undo()
    expect(host.model().diagrams.some((d) => d.kind === 'map')).toBe(false)
    // The page is still asked for, and has nothing to show: the workspace
    // closes it, as it does a sheet deleted under it.
    expect(host.maps().map).toBeUndefined()
  })
})

describe('opening and closing', () => {
  it('opens by id and closes to nothing', () => {
    const host = mount()
    act(() => host.maps().create())
    act(() => host.maps().close())
    expect(host.maps().mapId).toBeUndefined()
    act(() => host.maps().open('mp-1'))
    expect(host.maps().map?.name).toBe('Enterprise map')
  })
})
