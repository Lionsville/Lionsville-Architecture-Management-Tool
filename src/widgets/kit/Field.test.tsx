// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Field, GrowingTextArea, PropertyRow, PropertyRows, SelectField, TextField, TextInput, TitleField, TitleRead } from './Field'
import type { PropertyRowProps } from './Field'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Field', () => {
  it('ties the label above and the hint under to the control', async () => {
    renderShell(<TextField label="Name" hint="As people say it." value="" onChange={() => {}} required />)
    const input = screen.getByRole('textbox', { name: /^Name/ })
    expect(input.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toBe('As people say it.')
    expect(input.hasAttribute('required')).toBe(true)
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(await axeFindings()).toEqual([])
  })

  it('says an error in the place of the hint, and marks the control', async () => {
    renderShell(<TextField label="Name" hint="As people say it." error="A name is needed." value="" onChange={() => {}} />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('A name is needed.').dataset.error).toBeDefined()
    expect(screen.queryByText('As people say it.')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('says what is typed, on one line and on several', () => {
    const typed = vi.fn()
    renderShell(<>
      <TextField label="One" value="" onChange={typed} />
      <TextField label="Several" rows={4} value="" onChange={typed} />
    </>)
    fireEvent.change(screen.getByRole('textbox', { name: 'One' }), { target: { value: 'a' } })
    expect(typed).toHaveBeenLastCalledWith('a')
    const several = screen.getByRole('textbox', { name: 'Several' })
    expect(several.tagName).toBe('TEXTAREA')
    fireEvent.change(several, { target: { value: 'b' } })
    expect(typed).toHaveBeenLastCalledWith('b')
  })

  it('offers a short closed list', async () => {
    const chose = vi.fn()
    renderShell(<SelectField label="Impact" value="low" options={[{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }]} onChange={chose} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Impact' }), { target: { value: 'high' } })
    expect(chose).toHaveBeenCalledWith('high')
    expect(await axeFindings()).toEqual([])
  })

  it('takes any control through its render function', () => {
    renderShell(<Field label="Day">{(ties) => <TextInput {...ties} type="date" />}</Field>)
    expect(screen.getByLabelText('Day').getAttribute('type')).toBe('date')
  })
})

function Row({ onCommit, initial = 'Billing', ...rest }: Partial<PropertyRowProps> & { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <PropertyRow label="Category" value={value} edit="text" onCommit={(next) => { setValue(next); onCommit?.(next) }} {...rest} />
}

const press = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }))

describe('PropertyRow', () => {
  it('reads as a term and its value, and is a button only to who may edit', async () => {
    renderShell(<PropertyRows><Row data-guide="category" /><PropertyRow label="Lifecycle" value="Live" /></PropertyRows>)
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Category', 'Lifecycle'])
    expect(screen.getByRole('button', { name: 'Edit Category: Billing' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Lifecycle/ })).toBeNull()
    expect(screen.getByText('Live')).toBeTruthy()
    expect(document.querySelector('[data-guide="category"]')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('refuses to stand outside its rows, which keep editing to one', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderShell(<PropertyRow label="x" />)).toThrow(/PropertyRows/)
  })

  it('becomes a field on a press, Enter keeps it and gives the focus back', async () => {
    const kept = vi.fn()
    renderShell(<PropertyRows><Row onCommit={kept} /></PropertyRows>)
    press('Edit Category: Billing')
    const input = screen.getByRole('textbox', { name: 'Category' }) as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('Billing')
    expect(await axeFindings()).toEqual([])
    fireEvent.change(input, { target: { value: 'Dispatch' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(kept).toHaveBeenCalledWith('Dispatch')
    const back = screen.getByRole('button', { name: 'Edit Category: Dispatch' })
    expect(document.activeElement).toBe(back)
  })

  it('drops the typing on Escape, and the key goes no further', () => {
    const kept = vi.fn()
    const outer = vi.fn()
    renderShell(<div onKeyDown={outer}><PropertyRows><Row onCommit={kept} /></PropertyRows></div>)
    press('Edit Category: Billing')
    const input = screen.getByRole('textbox', { name: 'Category' })
    fireEvent.change(input, { target: { value: 'Dispatch' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(kept).not.toHaveBeenCalled()
    expect(outer).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Category: Billing' }))
  })

  it('keeps what was typed on leaving, and writes nothing when nothing changed', () => {
    const kept = vi.fn()
    renderShell(<PropertyRows><Row onCommit={kept} /></PropertyRows>)
    press('Edit Category: Billing')
    fireEvent.blur(screen.getByRole('textbox', { name: 'Category' }))
    expect(kept).not.toHaveBeenCalled()
    press('Edit Category: Billing')
    fireEvent.change(screen.getByRole('textbox', { name: 'Category' }), { target: { value: 'Dock' } })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Category' }))
    expect(kept).toHaveBeenCalledWith('Dock')
  })

  it('edits one row at a time', () => {
    renderShell(<PropertyRows>
      <PropertyRow label="One" value="a" edit="text" check={() => 'Never right.'} />
      <PropertyRow label="Two" value="b" edit="text" />
    </PropertyRows>)
    press('Edit One: a')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'One' }), { key: 'Enter' })
    expect(screen.getByText('Never right.')).toBeTruthy()
    press('Edit Two: b')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('textbox', { name: 'Two' })).toBeTruthy()
  })

  it('stays open and says why a value will not do, under the row', async () => {
    const kept = vi.fn()
    renderShell(<PropertyRows><Row onCommit={kept} check={(value) => (value === '' ? 'Before it starts. Pick a later day.' : undefined)} /></PropertyRows>)
    press('Edit Category: Billing')
    const input = screen.getByRole('textbox', { name: 'Category' })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(kept).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Before it starts. Pick a later day.')
    expect(await axeFindings()).toEqual([])
    fireEvent.change(input, { target: { value: 'Fine' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(kept).toHaveBeenCalledWith('Fine')
  })

  it('says a refusal from the screen at rest', () => {
    renderShell(<PropertyRows><PropertyRow label="Until" value="May" error="Somebody changed this." /></PropertyRows>)
    expect(screen.getByText('Somebody changed this.')).toBeTruthy()
  })

  it('hides what writes, per row and for all of them', () => {
    const view = renderShell(<PropertyRows><Row readOnly /></PropertyRows>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Billing')).toBeTruthy()
    view.unmount()
    renderShell(
      <PropertyRows readOnly add={{ label: 'Vendor', items: [] }}>
        <Row />
        <PropertyRow label="Owner" empty="Nobody yet" action={{ label: 'Unit', onPress: () => {} }} />
      </PropertyRows>,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Nobody yet')).toBeTruthy()
  })

  it('says an empty row in a word, with an act beside it and a press to edit', async () => {
    const act = vi.fn()
    renderShell(<PropertyRows>
      <PropertyRow label="Owner" empty="Nobody yet" edit="text" action={{ label: 'Unit', onPress: act }} />
      <PropertyRow label="Bare" edit="text" />
    </PropertyRows>)
    fireEvent.click(screen.getByRole('button', { name: '+ Unit' }))
    expect(act).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Edit Owner: Nobody yet' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit Bare' })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('names where a value comes from, and an own value starts empty', () => {
    const kept = vi.fn()
    renderShell(<PropertyRows>
      <PropertyRow label="Client" value="Acme Logistics" inherited edit="text" onCommit={kept} />
      <PropertyRow label="Region" value="North" inherited="Northline" />
    </PropertyRows>)
    expect(screen.getByRole('button', { name: 'Edit Client: Acme Logistics, from above' })).toBeTruthy()
    expect(screen.getByText('North, from Northline')).toBeTruthy()
    press(/Edit Client/)
    expect((screen.getByRole('textbox', { name: 'Client' }) as HTMLInputElement).value).toBe('')
  })

  it('says a mixed value, and how many', () => {
    renderShell(<PropertyRows><PropertyRow label="Lifecycle" value="Live" mixed={3} /></PropertyRows>)
    expect(screen.getByText('Mixed, 3 values')).toBeTruthy()
  })

  it('edits a closed list and commits on the choice', () => {
    const kept = vi.fn()
    renderShell(<PropertyRows><PropertyRow label="Impact" value="low" display="Low" edit={{ options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] }} onCommit={kept} /></PropertyRows>)
    press('Edit Impact: Low')
    const select = screen.getByRole('combobox', { name: 'Impact' })
    fireEvent.change(select, { target: { value: 'high' } })
    expect(kept).toHaveBeenCalledWith('high')
    press('Edit Impact: Low')
    fireEvent.blur(screen.getByRole('combobox', { name: 'Impact' }))
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('takes Enter as a new line in long text, and ⌘Enter as done', () => {
    const kept = vi.fn()
    renderShell(<PropertyRows><Row label="About" initial="Words" edit="long" onCommit={kept} /></PropertyRows>)
    press('Edit About: Words')
    const box = screen.getByRole('textbox', { name: 'About' })
    fireEvent.change(box, { target: { value: 'More words' } })
    expect(fireEvent.keyDown(box, { key: 'Enter' })).toBe(true)
    expect(kept).not.toHaveBeenCalled()
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true })
    expect(kept).toHaveBeenCalledWith('More words')
    press('Edit About: More words')
    fireEvent.blur(screen.getByRole('textbox', { name: 'About' }))
    expect(kept).toHaveBeenCalledOnce()
  })

  it('hands its own editor the value and the way out', () => {
    const kept = vi.fn()
    renderShell(<PropertyRows>
      <PropertyRow
        label="Day" value="2026-05-12" onCommit={kept}
        edit={({ value, onChange, commit, cancel, ties }) => (
          <>
            <input {...ties} value={value} onChange={(event) => onChange(event.target.value)} />
            <button type="button" onClick={() => commit()}>Done</button>
            <button type="button" onClick={() => commit('2027-01-01')}>Next year</button>
            <button type="button" onClick={cancel}>Back</button>
          </>
        )}
      />
    </PropertyRows>)
    press('Edit Day: 2026-05-12')
    fireEvent.change(screen.getByRole('textbox', { name: 'Day' }), { target: { value: '2026-06-01' } })
    press('Back')
    expect(kept).not.toHaveBeenCalled()
    press('Edit Day: 2026-05-12')
    fireEvent.change(screen.getByRole('textbox', { name: 'Day' }), { target: { value: '2026-06-01' } })
    press('Done')
    expect(kept).toHaveBeenCalledWith('2026-06-01')
    press(/Edit Day/)
    press('Next year')
    expect(kept).toHaveBeenLastCalledWith('2027-01-01')
  })

  it('reads as what it is drawn with, naming the value for a press', () => {
    renderShell(<PropertyRows><PropertyRow label="Owner" value="Dock crew" display={<b>Dock crew</b>} edit="text" /></PropertyRows>)
    expect(screen.getByRole('button', { name: 'Edit Owner: Dock crew' }).querySelector('b')).toBeTruthy()
  })

  it('stops a long value at three lines, with Show all as its own control', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(120)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60)
    renderShell(<PropertyRows><Row initial="A very long value" /></PropertyRows>)
    const text = document.querySelector<HTMLElement>('.kit-prop__text')
    expect(text?.dataset.all).toBeUndefined()
    press('Show all')
    expect(text?.dataset.all).toBeDefined()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(await axeFindings()).toEqual([])
    press('Show less')
    expect(text?.dataset.all).toBeUndefined()
  })

  it('offers what is left out behind one add', async () => {
    const added = vi.fn()
    renderShell(
      <PropertyRows add={{ label: 'Vendor, dates…', 'data-guide': 'add-fact', items: [{ label: 'Vendor', onSelect: added }] }}>
        <PropertyRow label="One" value="a" />
      </PropertyRows>,
    )
    const add = screen.getByRole('button', { name: '+ Vendor, dates…' })
    expect(add.dataset.guide).toBe('add-fact')
    fireEvent.click(add)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Vendor' }))
    expect(added).toHaveBeenCalledOnce()
    expect(await axeFindings()).toEqual([])
  })
})

describe('a row told from outside', () => {
  it('says a word at its end, and opens the row a screen names', () => {
    const { rerender } = renderShell(<PropertyRows editing={undefined} onEditing={() => undefined}><PropertyRow rowId="one" label="Day" value="Monday" aside="after the end" edit="text" /></PropertyRows>)
    expect(screen.getByText('after the end')).toBeTruthy()
    rerender(<PropertyRows editing="one" onEditing={() => undefined}><PropertyRow rowId="one" label="Day" value="Monday" aside="after the end" edit="text" /></PropertyRows>)
    expect(screen.getByRole('textbox', { name: 'Day' })).toBeTruthy()
    expect(screen.queryByText('after the end')).toBeNull()
  })
})

describe('a row, for a panel', () => {
  it('can be found by the name a finding asks for it by', () => {
    renderShell(<PropertyRows><PropertyRow label="Until" value="" edit="date" field="validUntil" /></PropertyRows>)
    expect(screen.getByRole('button').getAttribute('data-field')).toBe('validUntil')
  })

  it('says its help while it is edited, and takes it back', () => {
    const onHelp = vi.fn()
    renderShell(<PropertyRows onHelp={onHelp}><PropertyRow label="Vendor" value="Acme" edit="text" help="Who sells it" /></PropertyRows>)
    expect(onHelp).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button'))
    expect(onHelp).toHaveBeenLastCalledWith('Who sells it')
    fireEvent.keyDown(screen.getByLabelText('Vendor'), { key: 'Escape' })
    expect(onHelp).toHaveBeenLastCalledWith(undefined)
  })

  it('arrives as a field where it was just asked for, and stays closed once closed', () => {
    renderShell(<PropertyRows><PropertyRow label="Vendor" value="" edit="text" startOpen /></PropertyRows>)
    const field = screen.getByLabelText('Vendor')
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(screen.queryByLabelText('Vendor')).toBeNull()
  })

  it('takes a day, and keeps its keys from whatever is beside it', () => {
    const onCommit = vi.fn()
    renderShell(<PropertyRows><PropertyRow label="Live from" value="" edit="date" onCommit={onCommit} /></PropertyRows>)
    fireEvent.click(screen.getByRole('button'))
    const field = screen.getByLabelText('Live from')
    expect(field.getAttribute('type')).toBe('date')
    expect(field.closest('[data-shortcuts-ignore]')).not.toBeNull()
    fireEvent.change(field, { target: { value: '2027-03-01' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith('2027-03-01')
  })

  it('keeps an act beside a value where it is to stay', () => {
    const onPress = vi.fn()
    renderShell(<PropertyRows><PropertyRow label="Replaced by" value="Next" action={{ label: 'Replace…', always: true, onPress }} /></PropertyRows>)
    fireEvent.click(screen.getByRole('button', { name: 'Replace…' }))
    expect(onPress).toHaveBeenCalled()
  })
})

describe('a form that reads as a page', () => {
  it('sizes a box by a hidden copy of its text, so it has no scroll of its own and nothing collapses while typing', () => {
    renderShell(<GrowingTextArea aria-label="Words" value={'One\nTwo'} onChange={() => {}} minRows={2} />)
    const box = screen.getByRole('textbox', { name: 'Words' })
    expect(box.getAttribute('rows')).toBe('1')
    expect(box.parentElement?.dataset.text).toBe('One\nTwo')
    expect(box.parentElement?.style.getPropertyValue('--grow-rows')).toBe('2')
  })

  it('writes a title with its hint in the empty box, and says what is wrong under it', async () => {
    const onChange = vi.fn()
    const { rerender } = renderShell(<TitleField label="Title" hint="One sentence." required value="" onChange={onChange} />)
    const box = screen.getByRole('textbox', { name: 'Title' })
    expect(box.getAttribute('placeholder')).toBe('One sentence.')
    expect(box.getAttribute('aria-invalid')).toBeNull()
    fireEvent.change(box, { target: { value: 'Late' } })
    expect(onChange).toHaveBeenCalledWith('Late')
    rerender(<TitleField label="Title" hint="One sentence." required value="" error="Say what was seen." onChange={onChange} />)
    const refused = screen.getByRole('textbox', { name: 'Title' })
    expect(refused.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(refused.getAttribute('aria-describedby') as string)?.textContent).toBe('Say what was seen.')
    expect(await axeFindings()).toEqual([])
  })

  it('reads a title as a heading in the same place', () => {
    renderShell(<TitleRead>Late every night</TitleRead>)
    expect(screen.getByRole('heading', { name: 'Late every night' }).parentElement?.className).toBe('kit-titleField')
  })
})
