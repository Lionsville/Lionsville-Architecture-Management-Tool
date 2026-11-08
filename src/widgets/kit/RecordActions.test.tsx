// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** One order on every record surface: other verbs, ✎ Edit, ⋯ with Delete last, then × where it floats; the next step under the head. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Button } from './Button'
import { Preview } from './Preview'
import { RecordActions } from './RecordActions'
import { RecordPage } from './RecordPage'

afterEach(cleanup)

const actions = (onEdit = vi.fn(), onDelete = vi.fn()) => (
  <RecordActions
    verbs={<Button variant="quiet" onClick={() => undefined}>Seen again</Button>}
    edit={{ onPress: onEdit, testId: 'edit' }}
    more={[{ label: 'Delete…', final: true, onSelect: onDelete }, { label: 'Copy link', onSelect: () => undefined }]}
  />
)

describe('RecordActions', () => {
  it('draws the verbs, then ✎ Edit with its pencil, then ⋯, with Delete last in it', () => {
    const onEdit = vi.fn()
    renderShell(actions(onEdit))
    const names = screen.getAllByRole('button').map((one) => one.getAttribute('aria-label') ?? one.textContent)
    expect(names).toEqual(['Seen again', 'Edit', 'More'])
    const edit = screen.getByRole('button', { name: 'Edit' })
    expect(edit.querySelector('svg')).toBeTruthy()
    fireEvent.click(edit)
    expect(onEdit).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const items = screen.getAllByRole('menuitem').map((one) => one.textContent)
    expect(items.at(-1)).toContain('Delete…')
  })

  it('draws nothing with nothing to offer', () => {
    const { container } = renderShell(<RecordActions more={[]} />)
    expect(container.querySelector('.kit-record-actions')).toBeNull()
  })
})

describe('where a record surface puts them', () => {
  it('a preview: Open full record, the actions and × at the end of the head, and the next step under the title', async () => {
    renderShell(
      <Preview ids={['a']} currentId="a" onSelect={() => undefined} title="A record" openFull={{ label: 'Open full record', onPress: () => undefined }} actions={actions()} next={<Button variant="primary" onClick={() => undefined}>Ask why</Button>}>
        <p>Text</p>
      </Preview>,
    )
    const head = document.querySelector('.kit-preview__head')!
    const names = [...head.querySelectorAll('button')].map((one) => one.getAttribute('aria-label') ?? one.textContent)
    expect(names.slice(-5)).toEqual(['Open full record', 'Seen again', 'Edit', 'More', 'Close'])
    const next = document.querySelector('.kit-preview__next')!
    expect(next.textContent).toBe('Ask why')
    expect(next.previousElementSibling?.classList.contains('kit-preview__title')).toBe(true)
    expect(document.querySelector('.kit-preview__foot')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('a page: the actions at the end of the head and the next step under it, and no ×', () => {
    renderShell(<RecordPage back={{ label: 'Seen', onPress: () => undefined }} title="A record" actions={actions()} next={<span>Ask why</span>} sections={[]} />)
    const head = document.querySelector('.kit-record__head')!
    expect(head.querySelector('.kit-record-actions')).toBeTruthy()
    expect(head.querySelector('.kit-record__next')?.textContent).toBe('Ask why')
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})
