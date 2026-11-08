// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The large preview over a list: opened only by selecting a row, carried by the
 * address, walked by ‹ › and the arrows, left by Esc with the focus back on the row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { List } from './List'
import { Preview, PreviewFact } from './Preview'
import { DraftQuestion, draftHeld, useDraft } from './drafts'
import { FRESH_VIEW, readListView, writeListView } from './listView'

afterEach(() => cleanup())

const RECORDS = [
  { id: 'a', text: 'The first record' },
  { id: 'b', text: 'The second record' },
  { id: 'c', text: 'The third record' },
]

/** A list and its preview over a fake address, the way a screen wires them. */
function Host({ start = '' }: { readonly start?: string }) {
  const [address, setAddress] = useState(start)
  const view = readListView(new URLSearchParams(address))
  const select = (id: string | null) => setAddress(writeListView({ ...view, select: id }, new URLSearchParams(address)).toString())
  const record = RECORDS.find((one) => one.id === view.select)
  return (
    <>
      <output data-testid="address">{address}</output>
      <List label="Records" groups={[{ id: 'g', label: '', rows: RECORDS }]} selectedId={view.select} onOpen={select} />
      <Preview
        ids={RECORDS.map((one) => one.id)} currentId={view.select} onSelect={select} title={record?.text ?? 'A record moved away'}
        code={record && `OB-000${RECORDS.indexOf(record) + 1}`} listWord="waiting"
        openFull={{ label: 'Open full record', onPress: () => undefined }}
        facts={<PreviewFact label="Impact">Critical</PreviewFact>}
        foot={<button type="button">Edit</button>}
      >
        <p>What was seen <input aria-label="A field" /></p>
      </Preview>
    </>
  )
}

const dialog = () => screen.getByRole('dialog', { hidden: false })
const address = () => screen.getByTestId('address').textContent

describe('the preview', () => {
  it('says what the record is over its title, where told', () => {
    renderShell(<Preview ids={['a']} currentId="a" onSelect={() => {}} title="Department" kind="Unit type"><p>Body</p></Preview>)
    const title = screen.getByRole('heading', { name: 'Department' })
    expect(title.previousElementSibling?.textContent).toBe('Unit type')
  })

  it('opens at a record\'s measure, or compact for a line or two where asked', () => {
    renderShell(<Preview ids={['a']} currentId="a" onSelect={() => {}} title="A change"><p>Body</p></Preview>)
    expect(dialog().getAttribute('data-size')).toBeNull()
    cleanup()
    renderShell(<Preview ids={['a']} currentId="a" onSelect={() => {}} title="A change" size="compact"><p>Body</p></Preview>)
    expect(dialog().getAttribute('data-size')).toBe('compact')
  })

  it('is not there until a row is selected, and a press writes the address', () => {
    renderShell(<Host />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByText('The second record'))
    expect(address()).toBe('select=b')
    expect(screen.getByRole('heading', { name: 'The second record' })).toBeTruthy()
    expect(screen.getByText('2 of 3 waiting')).toBeTruthy()
    expect(screen.getByText('OB-0002')).toBeTruthy()
  })

  it('opens from an address, with what else the address holds left alone', () => {
    renderShell(<Host start="tab=seen&select=c" />)
    expect(screen.getByRole('heading', { name: 'The third record' })).toBeTruthy()
    fireEvent.keyDown(dialog(), { key: 'ArrowLeft' })
    expect(address()).toBe('tab=seen&select=b')
  })

  it('walks by the arrows and the buttons, and stops at the ends', () => {
    renderShell(<Host start="select=a" />)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Previous' }).disabled).toBe(true)
    fireEvent.keyDown(dialog(), { key: 'ArrowUp' })
    expect(address()).toBe('select=a')
    fireEvent.keyDown(dialog(), { key: 'ArrowRight' })
    expect(address()).toBe('select=b')
    fireEvent.keyDown(dialog(), { key: 'ArrowDown' })
    expect(address()).toBe('select=c')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Next' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(address()).toBe('select=b')
  })

  it('leaves the arrows to a field being typed in', () => {
    renderShell(<Host start="select=b" />)
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'A field' }), { key: 'ArrowLeft' })
    expect(address()).toBe('select=b')
  })

  it('goes back to the row last shown on Esc, taking the choice out of the address', () => {
    renderShell(<Host start="select=a" />)
    fireEvent.keyDown(dialog(), { key: 'ArrowRight' })
    fireEvent.keyDown(dialog(), { key: 'Escape' })
    expect(address()).toBe('')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByText('The second record').closest('[role="row"]'))
  })

  it('closes by × as Esc does', () => {
    renderShell(<Host start="select=c" />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(address()).toBe('')
    expect(document.activeElement).toBe(screen.getByText('The third record').closest('[role="row"]'))
  })

  it('takes the focus in, and is named by its title', () => {
    renderShell(<Host start="select=b" />)
    expect(dialog().contains(document.activeElement)).toBe(true)
    expect(dialog().getAttribute('aria-labelledby')).toBe(screen.getByRole('heading', { name: 'The second record' }).id)
  })

  it('reads a record the list no longer shows, with no position and nowhere to walk', () => {
    renderShell(<Host start="select=gone" />)
    expect(screen.getByRole('heading', { name: 'A record moved away' })).toBeTruthy()
    expect(screen.queryByText(/ of 3/)).toBeNull()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Next' }).disabled).toBe(true)
    fireEvent.keyDown(dialog(), { key: 'ArrowRight' })
    expect(address()).toBe('select=gone')
  })

  it('keeps the head, the title and the foot out of what scrolls', () => {
    renderShell(<Host start="select=b" />)
    const body = dialog().querySelector('.kit-preview__body') as HTMLElement
    expect(body.contains(screen.getByRole('heading', { name: 'The second record' }))).toBe(false)
    expect(body.contains(screen.getByRole('button', { name: 'Edit' }))).toBe(false)
    expect(body.contains(screen.getByText('Impact'))).toBe(true)
  })

  it('says Open full record only where the screen offers it', () => {
    const onPress = vi.fn()
    const { rerender } = renderShell(<Preview ids={['x']} currentId="x" onSelect={() => undefined} title="T">body</Preview>)
    expect(screen.queryByText('Open full record')).toBeNull()
    rerender(<Preview ids={['x']} currentId="x" onSelect={() => undefined} title="T" openFull={{ label: 'Open full record', onPress }}>body</Preview>)
    fireEvent.click(screen.getByText('Open full record'))
    expect(onPress).toHaveBeenCalled()
  })

  it('puts Open full record, what can be done and × at the end of the head, and the next step under the title', () => {
    const edit = vi.fn()
    renderShell(
      <Preview
        ids={['x']} currentId="x" onSelect={() => undefined} title="T"
        actions={<button type="button" onClick={edit}>Edit</button>} openFull={{ label: 'Open full record', onPress: () => undefined }}
        next={<button type="button">Ask why</button>}
      >
        body
      </Preview>,
    )
    const head = document.querySelector('.kit-preview__head')!
    expect([...head.querySelectorAll('button')].slice(-3).map((one) => one.getAttribute('aria-label') ?? one.textContent)).toEqual(['Open full record', 'Edit', 'Close'])
    expect(document.querySelector('.kit-preview__next')?.textContent).toBe('Ask why')
    expect(document.querySelector('.kit-preview__foot')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(edit).toHaveBeenCalled()
  })

  it('passes axe', async () => {
    renderShell(<Host start="select=b" />)
    expect(await axeFindings()).toEqual([])
  })

  it('writes nothing fresh into an address it was not given', () => {
    expect(writeListView(FRESH_VIEW).toString()).toBe('')
  })
})

describe('a draft written in the preview', () => {
  function Box() {
    const [text, setText] = useState('')
    useDraft(text !== '')
    return <textarea aria-label="Write a comment" value={text} onChange={(event) => setText(event.target.value)} />
  }
  function Writing({ onSelect, beside }: { readonly onSelect: (id: string | null) => void; readonly beside?: boolean }) {
    return (
      <>
        <DraftQuestion />
        {beside && <Box />}
        <Preview ids={['a', 'b']} currentId="a" onSelect={onSelect} title="The first record">
          {!beside && <Box />}
        </Preview>
      </>
    )
  }

  it('is asked about before ×, › or Escape leaves the record, and Escape in the box only leaves the box', async () => {
    const onSelect = vi.fn()
    renderShell(<Writing onSelect={onSelect} />)
    const box = screen.getByRole('textbox', { name: 'Write a comment' })
    fireEvent.change(box, { target: { value: 'Who owns this?' } })
    box.focus()
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.queryByTestId('draft-question')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep writing' }))
    await waitFor(() => expect(screen.queryByTestId('draft-question')).toBeNull())
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
    fireEvent.click(await screen.findByTestId('draft-leave'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('does not ask about a draft beside it, a form under the preview, and leaves it held', () => {
    const onSelect = vi.fn()
    renderShell(<Writing onSelect={onSelect} beside />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Write a comment', hidden: true }), { target: { value: 'Who owns this?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('draft-question')).toBeNull()
    expect(onSelect).toHaveBeenCalledWith(null)
    expect(draftHeld()).toBe(true)
  })
})
