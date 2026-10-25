// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Documents that refer rather than copy (ADR-0043 §9–§11): a `ref` fence
 * drawn by what the host hands down, a line where its target is gone, its
 * source where nothing can draw it; the completion while typing and *Insert
 * ▾*; and a view drawn live with the caption that opens it.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import type { DesignDiagram } from '../../model/types'
import type { Referable } from '../references'
import { DocumentSource } from './DocumentSource'
import { MarkdownView } from './MarkdownView'
import { ReferencesProvider } from './References'
import type { ReferencesAccess } from './References'
import { ViewEmbedsProvider } from './ViewEmbed'

afterEach(cleanup)

const CATALOGUE: Referable[] = [
  { kind: 'element', key: 'yard', label: 'Yard system', detail: 'Application', markdown: '[[Yard system]]', block: false },
  { kind: 'decision', key: 'adr-1', label: 'ADR-0001 Buy a yard system', detail: 'Accepted', markdown: '```ref\ndecision: adr-1\n```', block: true },
]

const access = (): ReferencesAccess => ({
  referables: () => CATALOGUE,
  draw: (fields) => (fields.decision === 'adr-1' ? <span>Drawn: ADR-0001</span> : undefined),
})

describe('a ref fence', () => {
  it('is drawn by the host, says so where its target is gone, and shows its source where nothing draws it', async () => {
    const text = ['```ref\ndecision: adr-1\n```', '', '```ref\ndecision: adr-9\n```'].join('\n')
    renderShell(<ReferencesProvider value={access()}><MarkdownView markdown={text} /></ReferencesProvider>)
    expect(screen.getByTestId('ref-decision').textContent).toBe('Drawn: ADR-0001')
    expect(screen.getByTestId('ref-gone').textContent).toBe('decision: adr-9 is no longer here.')
    expect(await axeFindings()).toEqual([])
    cleanup()
    renderShell(<MarkdownView markdown={'```ref\ndecision: adr-1\n```'} />)
    expect(screen.getByTestId('ref-source').textContent).toBe('decision: adr-1')
  })
})

describe('referring while writing', () => {
  function Editor({ onChange }: { onChange: (next: string) => void }) {
    const [value, setValue] = useState('')
    return <ReferencesProvider value={access()}><DocumentSource value={value} onChange={(next) => { setValue(next); onChange(next) }} label="Source" /></ReferencesProvider>
  }

  it('opens a list at [[, narrowed by the words typed, and puts the choice in with Enter', async () => {
    const onChange = vi.fn()
    renderShell(<Editor onChange={onChange} />)
    const area = screen.getByRole('textbox', { name: 'Source' }) as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'See [[yar' } })
    area.setSelectionRange(9, 9)
    fireEvent.select(area)
    const list = await screen.findByTestId('reference-completion')
    expect(list.textContent).toContain('Yard system')
    expect(list.textContent).toContain('ADR-0001 Buy a yard system')
    fireEvent.keyDown(area, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('See [[Yard system]]')
  })

  it('offers each kind under Insert, and puts a fence in on lines of its own', async () => {
    const onChange = vi.fn()
    renderShell(<Editor onChange={onChange} />)
    fireEvent.click(screen.getByTestId('doc-insert'))
    expect(screen.getByRole('menuitem', { name: 'Add a business case' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('doc-insert-decision'))
    const field = await screen.findByRole('combobox')
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('option', { name: /ADR-0001/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('```ref\ndecision: adr-1\n```\n\n'))
  })
})

describe('a view in a document', () => {
  const board: DesignDiagram = { id: 'l7', kind: 'layer7', name: 'Landscape', members: [], geometry: { nodes: [] } }

  it('is drawn live by the host, with a caption that names it and opens it', () => {
    const openView = vi.fn()
    renderShell(
      <ViewEmbedsProvider diagrams={[board]} bytesAt={async () => undefined} openElement={() => {}} live={() => <span data-testid="drawn">the board</span>} openView={openView}>
        <MarkdownView markdown="![Our landscape](view:l7)" />
      </ViewEmbedsProvider>,
    )
    expect(screen.getByTestId('view-live').getAttribute('data-view')).toBe('l7')
    expect(screen.getByTestId('drawn')).toBeTruthy()
    expect(screen.getByTestId('view-live').textContent).toContain('Our landscape')
    fireEvent.click(screen.getByTestId('view-open'))
    expect(openView).toHaveBeenCalledWith('l7')
  })

  it('says it has no picture where the host draws none of its kind', () => {
    renderShell(
      <ViewEmbedsProvider diagrams={[board]} bytesAt={async () => undefined} openElement={() => {}}>
        <MarkdownView markdown="![Our landscape](view:l7)" />
      </ViewEmbedsProvider>,
    )
    expect(screen.getByTestId('view-no-picture')).toBeTruthy()
  })
})
