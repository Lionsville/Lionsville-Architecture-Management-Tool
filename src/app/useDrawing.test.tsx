// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { translator } from '../i18n'
import type { HostModel } from '../model/hostModel'
import type { ScopeSnapshot } from '../projects/scope'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'
import { useDrawing } from './useDrawing'
import type { Drawings } from './useDrawing'

afterEach(() => cleanup())

const project = (): ScopeSnapshot => {
  const model: HostModel = {
    name: 'Landscape',
    elements: [],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  }
  return { path: 'acme', model, activeDiagramId: 'd1', logoLibrary: [] }
}

function mount() {
  let drawings!: Drawings
  let session!: ModelSession
  let counter = 0
  function Host() {
    session = useModelSession({ initialProject: project(), notify: vi.fn(), s: translator('en') })
    drawings = useDrawing({ session, makeId: (prefix) => `${prefix}-${++counter}`, s: translator('en') })
    return null
  }
  render(<Host />)
  return {
    drawings: () => drawings,
    model: () => session.current(),
    activeId: () => session.currentActiveId(),
    undo: () => act(() => session.undo()),
  }
}

describe('making a drawing', () => {
  it('adds one, opens it, and undoing takes it off', () => {
    const host = mount()
    act(() => host.drawings().create())
    const made = host.model().diagrams.find((diagram) => diagram.kind === 'drawing')
    expect(made).toMatchObject({ id: 'dr-1', name: 'Drawing', kind: 'drawing' })
    expect(made?.geometry).toBeUndefined()
    expect(made?.drawing).toBeUndefined()
    expect(host.activeId()).toBe('dr-1')
    host.undo()
    expect(host.model().diagrams.some((diagram) => diagram.kind === 'drawing')).toBe(false)
  })
})
