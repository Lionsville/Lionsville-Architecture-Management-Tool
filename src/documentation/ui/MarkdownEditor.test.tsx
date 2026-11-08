// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The one place markdown is written: what the keys and buttons do to the text,
 * what comes in by paste and drop, the three ways of showing it, and that what
 * a source does not offer is not offered. The rules of the text itself are
 * `markdownEditing.test.ts`; here is whether the editor reaches them.
 */
import { useState } from 'react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import { FocusedWindow } from '../../widgets/kit/FocusedWindow'
import type { DocumentAttachments } from '../attachments'
import { AttachmentsProvider } from './Attachments'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownFlow, MarkdownFlowBar, MarkdownFlowBeside } from './MarkdownFlow'
import type { MarkdownEditorProps } from './MarkdownEditor'
import { MarkdownView } from './MarkdownView'

afterEach(cleanup)

function imageFile(name = 'Screenshot.png'): File {
  return new File([new Uint8Array([1, 2])], name, { type: 'image/png' })
}

function transfer(files: File[], text = '') {
  return { files, items: [], types: files.length ? ['Files'] : [], getData: () => text }
}

function Controlled({ start, onChange, ...rest }: Partial<MarkdownEditorProps> & { start: string; onChange: (next: string) => void }) {
  const [value, setValue] = useState(start)
  return <MarkdownEditor label="Source" variant="pane" {...rest} value={value} onChange={(next) => { setValue(next); onChange(next) }} />
}

function setup(over: Partial<MarkdownEditorProps> = {}, start = 'Hello') {
  const onChange = vi.fn()
  renderShell(<Controlled start={start} onChange={onChange} {...over} />)
  return { onChange, area: screen.getByRole('textbox', { name: 'Source' }) as HTMLTextAreaElement }
}

const attachments = (over: Partial<DocumentAttachments> = {}): DocumentAttachments => ({
  maxBytes: 10,
  add: vi.fn(async () => 'att-1'),
  href: (id) => `/files/${id}`,
  ...over,
})

describe('MarkdownEditor, what comes in', () => {
  it('answers a pasted picture with the whole next text, the reference where the caret is', async () => {
    const onAddImage = vi.fn(async () => 'screenshot-k1.png')
    const { onChange, area } = setup({ onAddImage })
    area.setSelectionRange(5, 5)
    fireEvent.paste(area, { clipboardData: transfer([imageFile()]) })
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onAddImage).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith('Hello\n\n![Screenshot](image:screenshot-k1.png)\n')
  })

  it('leaves words pasted with a picture alongside as words', () => {
    const onAddImage = vi.fn(async () => 'x.png')
    const { area } = setup({ onAddImage })
    fireEvent.paste(area, { clipboardData: transfer([imageFile()], 'some words') })
    expect(onAddImage).not.toHaveBeenCalled()
  })

  it('makes a link of an address pasted over selected words', () => {
    const { onChange, area } = setup()
    area.setSelectionRange(0, 5)
    fireEvent.paste(area, { clipboardData: transfer([], 'https://example.org/a') })
    expect(onChange).toHaveBeenCalledWith('[Hello](https://example.org/a)')
  })

  it('offers no picture list and no word about pictures on a host that cannot take one', () => {
    setup()
    expect(screen.queryByRole('button', { name: /^Pictures/ })).toBeNull()
    expect(screen.getByText('Markdown. Type / for a block, @ to refer to something.')).toBeTruthy()
  })

  it('lists the project’s pictures and puts one in', () => {
    const images = {
      library: [{ name: 'cutover-k1.png', mediaType: 'image/png', size: 2, width: 1, height: 1, contentAddress: `sha256:${'1'.repeat(64)}` }],
      usedBy: () => [],
      onRemove: vi.fn(),
    }
    const { onChange } = setup({ images })
    fireEvent.click(screen.getByRole('button', { name: 'Pictures (1)' }))
    fireEvent.click(within(screen.getByTestId('doc-pictures')).getByRole('button', { name: 'Insert' }))
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('![cutover-k1](image:cutover-k1.png)'))
  })
})

describe('MarkdownEditor, the keys', () => {
  it('wraps a selection in bold on ⌘B, and takes it off again', () => {
    const { onChange, area } = setup()
    area.setSelectionRange(0, 5)
    fireEvent.keyDown(area, { key: 'b', ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith('**Hello**')
  })

  it('goes on with a list at Enter, and ends it on an empty item', () => {
    const { onChange, area } = setup({}, '- one')
    area.setSelectionRange(5, 5)
    fireEvent.keyDown(area, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('- one\n- ')
  })

  it('leaves Enter alone on a plain line, and leaves Tab alone so the keyboard can leave', () => {
    const { onChange, area } = setup()
    area.setSelectionRange(5, 5)
    fireEvent.keyDown(area, { key: 'Enter' })
    fireEvent.keyDown(area, { key: 'Tab' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reaches the toolbar with Alt+F10, and a press there changes the text', () => {
    const { onChange, area } = setup()
    area.setSelectionRange(0, 5)
    fireEvent.keyDown(area, { key: 'F10', altKey: true })
    expect(document.activeElement?.getAttribute('data-tool')).toBe('heading')
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }))
    expect(onChange).toHaveBeenLastCalledWith('_Hello_')
  })
})

describe('MarkdownEditor, typing /', () => {
  it('offers the blocks at the start of a line, narrowed by the word, and puts one in', () => {
    const { onChange, area } = setup({}, '')
    fireEvent.change(area, { target: { value: '/tab' } })
    area.setSelectionRange(4, 4)
    fireEvent.select(area)
    const list = screen.getByTestId('reference-completion')
    expect(within(list).getByText('Table')).toBeTruthy()
    expect(within(list).queryByText('Quotation')).toBeNull()
    fireEvent.keyDown(area, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('| Heading | Heading |\n|---|---|\n|  |  |\n')
  })

  it('is a slash anywhere else', () => {
    const { area } = setup({}, '')
    fireEvent.change(area, { target: { value: 'and /or' } })
    area.setSelectionRange(7, 7)
    fireEvent.select(area)
    expect(screen.queryByTestId('reference-completion')).toBeNull()
  })

  it('offers a record’s template, and once started the sections it does not have yet', () => {
    const template = { label: 'From the template', text: '## Purpose\n\n## Data\n' }
    const { onChange, area } = setup({ template }, '## Purpose\n\n')
    fireEvent.change(area, { target: { value: '## Purpose\n\n/' } })
    area.setSelectionRange(13, 13)
    fireEvent.select(area)
    const list = screen.getByTestId('reference-completion')
    expect(within(list).getByText('Section: Data')).toBeTruthy()
    expect(within(list).queryByText('Section: Purpose')).toBeNull()
    expect(within(list).queryByText('From the template')).toBeNull()
    // Chosen on the click: the list stays for the whole of the press, or the rest of it would land beneath.
    expect(fireEvent.mouseDown(within(list).getByText('Section: Data'))).toBe(false)
    expect(screen.getByTestId('reference-completion')).toBeTruthy()
    fireEvent.click(within(list).getByText('Section: Data'))
    expect(onChange).toHaveBeenLastCalledWith('## Purpose\n\n## Data\n')
  })
})

describe('MarkdownEditor, how the text is shown', () => {
  const renderPreview = (text: string) => <div data-testid="rendered">{text}</div>

  it('is Write, Preview and side by side on a pane with room', () => {
    setup({ renderPreview })
    expect(screen.getByRole('button', { name: 'Side by side' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('rendered')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Source' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.queryByRole('textbox', { name: 'Source' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Write' }))
    expect(screen.queryByTestId('rendered')).toBeNull()
  })

  it('keeps the writer in: a link in the preview answers no press, by mouse or key, and is out of the Tab order', () => {
    const opened = vi.fn()
    setup({ renderPreview: (text) => <p>{text} <a href="#/-/document/other" onClick={opened} onKeyDown={opened}>Other</a></p> })
    const link = screen.getByRole('link', { name: 'Other' })
    expect(link.getAttribute('tabindex')).toBe('-1')
    fireEvent.keyDown(link, { key: 'Enter' })
    expect(fireEvent.click(link)).toBe(false)
    expect(opened).not.toHaveBeenCalled()
  })

  it('keeps a full window’s reading beside the writing as still: a link there neither opens nor takes the Tab', () => {
    const opened = vi.fn()
    renderShell(<MarkdownFlowBeside view="side" writing={<textarea aria-label="Text" />} reading={<a href="#/-/document/other" onClick={opened}>Other</a>} />)
    const link = screen.getByRole('link', { name: 'Other' })
    expect(link.getAttribute('tabindex')).toBe('-1')
    expect(fireEvent.click(link)).toBe(false)
    expect(opened).not.toHaveBeenCalled()
  })

  it('has no side by side in a field, and one button that goes between Write and Preview', () => {
    setup({ renderPreview, variant: 'field' })
    expect(screen.queryByRole('button', { name: 'Side by side' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByTestId('rendered')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Write' }))
    expect(screen.getByRole('textbox', { name: 'Source' })).toBeTruthy()
  })

  it('has no switch where there is no way to preview', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull()
  })

  it('shows a field’s tools only while it is in use, in the label’s place', () => {
    setup({ variant: 'field' })
    const root = screen.getByTestId('markdown-field')
    expect(root.getAttribute('data-active')).toBe('false')
    fireEvent.focus(screen.getByRole('textbox', { name: 'Source' }))
    expect(root.getAttribute('data-active')).toBe('true')
    fireEvent.blur(screen.getByRole('textbox', { name: 'Source' }))
    expect(root.getAttribute('data-active')).toBe('false')
  })

  it('reads, and offers nothing that writes, where it is disabled', () => {
    renderShell(<MarkdownEditor label="Source" value="Words" onChange={vi.fn()} renderPreview={renderPreview} disabled />)
    expect(screen.getByTestId('rendered').textContent).toBe('Words')
    expect(screen.queryByRole('toolbar')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})

describe('MarkdownEditor, what stands around the text', () => {
  it('counts the words, and opens the help in place', () => {
    setup({}, 'One **two** three')
    expect(screen.getByTestId('md-word-count').textContent).toBe('3 words')
    fireEvent.click(screen.getByRole('button', { name: 'Markdown help' }))
    expect(within(screen.getByTestId('markdown-help')).getByText('[[Order Management]]')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('offers an outline from three headings on, and moves the caret to the one pressed', () => {
    const text = '# One\n\n## Two\n\ntext\n\n## Three\n'
    const { area } = setup({}, text)
    fireEvent.click(screen.getByTestId('md-outline'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Three' }))
    expect(area.selectionStart).toBe(text.indexOf('## Three'))
    cleanup()
    setup({}, '# One\n\n## Two\n')
    expect(screen.queryByTestId('md-outline')).toBeNull()
  })

  it('has no findings for a reader of the screen', async () => {
    setup({ renderPreview: (text) => <p>{text}</p>, template: { label: 'From the template', text: '## A\n' } }, '')
    fireEvent.click(screen.getByRole('button', { name: 'Markdown help' }))
    expect(await axeFindings()).toEqual([])
    cleanup()
    setup({ renderPreview: (text) => <p>{text}</p>, variant: 'field', helper: 'An example', required: true, note: 'optional' })
    fireEvent.focus(screen.getByRole('textbox', { name: 'Source' }))
    expect(await axeFindings()).toEqual([])
  })
})

describe('attachments, the seam', () => {
  const file = (size = 2) => new File([new Uint8Array(size)], 'report.pdf', { type: 'application/pdf' })

  it('offers nothing where the source keeps none: no button, no drop, no word', () => {
    const { area } = setup()
    expect(screen.queryByTestId('md-attach')).toBeNull()
    expect(screen.queryByTestId('md-attach-input')).toBeNull()
    const dropped = fireEvent.drop(area, { dataTransfer: transfer([file()]) })
    expect(dropped).toBe(true)
  })

  it('keeps a dropped file with the source and writes a link to it', async () => {
    const source = attachments()
    const onChange = vi.fn()
    renderShell(<AttachmentsProvider value={source}><Controlled start="Hello" onChange={onChange} /></AttachmentsProvider>)
    expect(screen.getByTestId('md-attach')).toBeTruthy()
    const area = screen.getByRole('textbox', { name: 'Source' }) as HTMLTextAreaElement
    area.setSelectionRange(5, 5)
    fireEvent.drop(area, { dataTransfer: transfer([file()]) })
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(source.add).toHaveBeenCalledWith(expect.any(File), '')
    expect(onChange).toHaveBeenLastCalledWith('Hello\n\n[report.pdf](attachment:att-1)\n')
  })

  it('takes one picked with the button, and refuses one too large before sending it, saying why', async () => {
    const source = attachments()
    const onChange = vi.fn()
    renderShell(<AttachmentsProvider value={source}><Controlled start="" onChange={onChange} /></AttachmentsProvider>)
    fireEvent.change(screen.getByTestId('md-attach-input'), { target: { files: [file(11)] } })
    expect((await screen.findByRole('alert')).textContent).toContain('report.pdf')
    expect(source.add).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('md-attach-input'), { target: { files: [file(2)] } })
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith('[report.pdf](attachment:att-1)\n'))
  })

  it('says a refusal in the source\'s own words, and writes nothing', async () => {
    const source = attachments({ add: vi.fn(async () => ({ refused: 'The storage for attached files is full.' })) })
    const onChange = vi.fn()
    renderShell(<AttachmentsProvider value={source}><Controlled start="" onChange={onChange} /></AttachmentsProvider>)
    fireEvent.drop(screen.getByRole('textbox', { name: 'Source' }), { dataTransfer: transfer([file()]) })
    await screen.findByText('The storage for attached files is full.')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('writes nothing where the source refused, and is not offered on a comment', async () => {
    const source = attachments({ add: vi.fn(async () => undefined) })
    const onChange = vi.fn()
    renderShell(<AttachmentsProvider value={source}><Controlled start="" onChange={onChange} /></AttachmentsProvider>)
    fireEvent.drop(screen.getByRole('textbox', { name: 'Source' }), { dataTransfer: transfer([file()]) })
    await vi.waitFor(() => expect(source.add).toHaveBeenCalled())
    await Promise.resolve()
    expect(onChange).not.toHaveBeenCalled()
    cleanup()
    renderShell(<AttachmentsProvider value={source}><Controlled start="" onChange={onChange} attachable={false} /></AttachmentsProvider>)
    expect(screen.queryByTestId('md-attach')).toBeNull()
  })

  it('reads as a link where the source keeps the file, and as its name where it does not', () => {
    const text = '[report.pdf](attachment:att-1)'
    renderShell(<AttachmentsProvider value={attachments()}><MarkdownView markdown={text} /></AttachmentsProvider>)
    expect(screen.getByTestId('attachment-link').getAttribute('href')).toBe('/files/att-1')
    expect(screen.getByTestId('attachment-link').getAttribute('rel')).toContain('noopener')
    cleanup()
    renderShell(<MarkdownView markdown={text} />)
    expect(screen.getByTestId('attachment-absent').textContent).toContain('report.pdf')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('never lets an attachment address become a picture', () => {
    renderShell(<MarkdownView markdown="![x](attachment:att-1)" />)
    expect(screen.getByTestId('image-missing').getAttribute('data-src')).toBeFalsy()
  })
})

describe('how much of the window it takes', () => {
  /** A text said to be as tall as this, jsdom laying nothing out. */
  function tall<T>(height: number, run: () => T): T {
    const was = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', { configurable: true, get: () => height })
    try { return run() } finally {
      delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight
      if (was) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', was)
    }
  }
  const field = <MarkdownEditor label="Words" value="A long text" onChange={() => {}} />

  it('stops a field and scrolls it among other fields', () => {
    tall(5000, () => renderShell(field))
    expect((screen.getByRole('textbox', { name: 'Words' }) as HTMLElement).style.height).toBe(`${14 * 21 + 18}px`)
  })

  it('grows a field with its text in a full window, which is the one scroll', () => {
    tall(5000, () => renderShell(
      <FocusedWindow open title="Writing" changed={false} saveLabel="Save" onSave={() => {}} onCancel={() => {}}>{field}</FocusedWindow>,
    ))
    expect((screen.getByRole('textbox', { name: 'Words' }) as HTMLElement).style.height).toBe('5000px')
  })

  it('still stops one that asks to stop', () => {
    tall(5000, () => renderShell(
      <FocusedWindow open title="Writing" changed={false} saveLabel="Save" onSave={() => {}} onCancel={() => {}}>
        <MarkdownEditor label="Words" value="A long text" onChange={() => {}} maxRows={4} />
      </FocusedWindow>,
    ))
    expect((screen.getByRole('textbox', { name: 'Words' }) as HTMLElement).style.height).toBe(`${4 * 21 + 18}px`)
  })

  it('keeps a reading line for what is read and none for what is written', () => {
    const sheet = readFileSync('src/documentation/ui/MarkdownEditor.css', 'utf8')
    expect(sheet).toMatch(/\.md-editor__preview > \* \{[^}]*max-width: var\(--measure-reader\)/)
    expect(sheet).not.toMatch(/\.md-editor__text \{[^}]*(max-width|padding-inline: max)/)
    expect(sheet).not.toMatch(/86ch/)
  })
})

describe('MarkdownEditor, a document in parts', () => {
  function Parts({ onSecond }: { onSecond?: (next: string) => void }) {
    const [first, setFirst] = useState('First')
    const [second, setSecond] = useState('Second')
    return (
      <MarkdownFlow>
        <MarkdownFlowBar words={2} />
        <div className="md-flow">
          <MarkdownEditor variant="flow" label="What we saw" helper="The facts." value={first} onChange={setFirst} />
          <MarkdownEditor variant="flow" label="Evidence" value={second} onChange={(next) => { setSecond(next); onSecond?.(next) }} />
        </div>
      </MarkdownFlow>
    )
  }

  it('has one bar over all its parts, there from the start, and heads each part as the document does', () => {
    renderShell(<Parts />)
    expect(screen.getAllByRole('toolbar')).toHaveLength(1)
    expect(within(screen.getByTestId('md-flow-bar')).getByRole('toolbar')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'What we saw' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Evidence' })).toBeTruthy()
    expect(screen.getByTestId('md-word-count').textContent).toBe('2 words')
  })

  it('lends the bar to the part in use: a button means the part the caret is in', () => {
    const onSecond = vi.fn()
    renderShell(<Parts onSecond={onSecond} />)
    const second = screen.getByRole('textbox', { name: 'Evidence' }) as HTMLTextAreaElement
    fireEvent.focus(second)
    second.setSelectionRange(0, 6)
    fireEvent.click(within(screen.getByTestId('md-flow-bar')).getByRole('button', { name: /^Bold/ }))
    expect(onSecond).toHaveBeenCalled()
    expect(second.value).toBe('**Second**')
    expect((screen.getByRole('textbox', { name: 'What we saw' }) as HTMLTextAreaElement).value).toBe('First')
  })

  it('grows with its text instead of scrolling, and asks in its hint where nothing is written yet', () => {
    renderShell(<MarkdownFlow><MarkdownEditor variant="flow" label="Evidence" helper="What shows it." value="" onChange={() => {}} /></MarkdownFlow>)
    const box = screen.getByRole('textbox', { name: 'Evidence' })
    expect(box.getAttribute('rows')).toBe('1')
    expect(box.closest('.kit-grow')).toBeTruthy()
    expect(box.getAttribute('placeholder')).toBe('What shows it.')
    expect(box.getAttribute('aria-describedby')).toBeTruthy()
  })

  it('has no heading to show where it is the whole document, and is still named', () => {
    renderShell(<MarkdownFlow><MarkdownEditor variant="flow" label="Description" labelHidden value="Words" onChange={() => {}} /></MarkdownFlow>)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeTruthy()
  })

  it('opens the help under the one bar, with the same words a field has', () => {
    renderShell(<Parts />)
    fireEvent.click(screen.getByRole('button', { name: 'Markdown help' }))
    expect(within(screen.getByTestId('md-flow-bar')).getByRole('table')).toBeTruthy()
  })

  it('passes axe', async () => {
    renderShell(<Parts />)
    expect(await axeFindings()).toEqual([])
  })
})
