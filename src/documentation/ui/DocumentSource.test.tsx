// @vitest-environment jsdom
/**
 * The one source pane every page writes markdown into: a pasted picture
 * lands where the caret is, the project's pictures can be put in, and the
 * preview beside it can be sent away.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { DocumentSource } from './DocumentSource'
import type { DocumentSourceProps } from './DocumentSource'

function imageFile(name = 'Screenshot.png'): File {
  return new File([new Uint8Array([1, 2])], name, { type: 'image/png' })
}

function transfer(files: File[], text = '') {
  return { files, items: [], types: files.length ? ['Files'] : [], getData: () => text }
}

function setup(over: Partial<DocumentSourceProps> = {}) {
  const onChange = vi.fn()
  renderShell(<DocumentSource value="Hello" onChange={onChange} label="Source" {...over} />)
  return { onChange, area: screen.getByLabelText('Source') as HTMLTextAreaElement }
}

describe('DocumentSource', () => {
  afterEach(cleanup)

  it('answers a pasted picture with the whole next text, the reference at the caret', async () => {
    const onAddImage = vi.fn(async () => 'screenshot-k1.png')
    const { onChange, area } = setup({ onAddImage })
    area.setSelectionRange(5, 5)
    fireEvent.paste(area, { clipboardData: transfer([imageFile()]) })
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onAddImage).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith('Hello\n\n![Screenshot](../images/screenshot-k1.png)\n\n')
  })

  it('offers neither pictures nor the hint about them on a host that cannot take one', () => {
    setup()
    expect(screen.queryByRole('button', { name: /^Pictures/ })).toBeNull()
    expect(screen.getByText('Markdown. [[Name]] links to another element.')).toBeTruthy()
  })

  it('lists the project’s pictures and puts one in', () => {
    const images = {
      library: [{ file: 'cutover-k1.png', url: 'data:image/png;base64,AQI=', bytes: 2 }],
      usedBy: () => [],
      onRemove: vi.fn(),
    }
    const { onChange } = setup({ images })
    fireEvent.click(screen.getByRole('button', { name: 'Pictures (1)' }))
    fireEvent.click(within(screen.getByTestId('doc-pictures')).getByRole('button', { name: 'Insert' }))
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('![cutover-k1](../images/cutover-k1.png)'))
  })

  it('wraps a selection in bold on ⌘B', () => {
    const { onChange, area } = setup()
    area.setSelectionRange(0, 5)
    fireEvent.keyDown(area, { key: 'b', metaKey: true })
    expect(onChange).toHaveBeenCalledWith('**Hello**')
  })

  it('says whether the preview is up, and asks the page to change it', () => {
    const onToggle = vi.fn()
    setup({ preview: { shown: true, onToggle } })
    const button = screen.getByRole('button', { name: 'Hide preview' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('has no toggle when there is no preview to send away', () => {
    setup()
    expect(screen.queryByRole('button', { name: /preview/i })).toBeNull()
  })
})
