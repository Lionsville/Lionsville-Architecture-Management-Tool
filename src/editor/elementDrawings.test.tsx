// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The element's inspector lists the drawings in this scope whose links point
 * at it.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import type { DesignDiagram, DesignElement, DesignModel } from '../model/types'
import type { EditorActions } from './useEditorState'
import { testTheme } from './testing/theme'
import { ElementInspector } from './ElementInspector'

afterEach(() => cleanup())

const billing: DesignElement = {
  id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: false, aspects: {},
}

function drawing(id: string, name: string, elementId: string | undefined): DesignDiagram {
  return {
    id, kind: 'drawing', name, members: [],
    drawing: {
      xml: '',
      links: elementId
        ? [{ shapeId: 'a', elementId, area: { x: 0, y: 0, width: 10, height: 10 } }]
        : [],
    },
  }
}

const board: DesignDiagram = { id: 'l7', kind: 'layer7', name: 'Landscape', members: [{ id: 'billing' }] }

function show(diagrams: DesignDiagram[]) {
  const model: DesignModel = { name: 'Retail', diagrams, elements: [billing], relations: [] }
  const actions = new Proxy({}, { get: () => vi.fn() }) as unknown as EditorActions
  render(
    <ThemeProvider theme={testTheme}>
      <ElementInspector
        element={billing}
        model={model}
        diagram={board}
        readOnly={false}
        actions={actions}
        onRequestDelete={vi.fn()}
      />
    </ThemeProvider>,
  )
}

describe('drawings in the inspector', () => {
  it('lists the drawings whose links point at the element', () => {
    const anchored: DesignDiagram = { ...drawing('anchored', 'Anchored only', undefined), elementId: 'billing' }
    show([
      board,
      drawing('ctx', 'Context', 'billing'),
      drawing('dep', 'Deployment', 'ledger'),
      anchored,
    ])
    const listed = screen.getByTestId('element-drawings')
    expect(listed.textContent).toContain('On drawings')
    expect(listed.textContent).toContain('Context')
    expect(listed.textContent).not.toContain('Deployment')
    expect(listed.textContent).not.toContain('Anchored only')
    expect(listed.textContent).not.toContain('Landscape')
  })

  it('lists nothing when no drawing points at it', () => {
    show([board, drawing('dep', 'Deployment', 'ledger')])
    expect(screen.queryByTestId('element-drawings')).toBeNull()
  })
})
