// @vitest-environment jsdom
/**
 * What the renderer promises the rest of the app.
 *
 * Most of it is ordinary: headings, tables and task lists come out as the
 * elements you would expect. The parts worth pinning are the ones that are
 * silent when they go wrong. HTML in a description must come out as text, a
 * `javascript:` href must not survive, an ordinary link must leave the app
 * rather than navigate it, and an element link must reach the callback and
 * nothing else.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MarkdownView } from './MarkdownView'

afterEach(() => cleanup())

describe('MarkdownView', () => {
  it('renders GFM: headings, a table, and a task list', () => {
    const { container } = render(
      <MarkdownView
        markdown={[
          '## Interfaces',
          '',
          '| With | Direction |',
          '|---|---|',
          '| Billing | out |',
          '',
          '- [x] decided',
          '- [ ] open',
        ].join('\n')}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Interfaces' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'With' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Billing' })).toBeTruthy()
    const boxes = container.querySelectorAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(2)
    expect((boxes[0] as HTMLInputElement).checked).toBe(true)
    expect((boxes[1] as HTMLInputElement).checked).toBe(false)
  })

  it('shows HTML as text instead of rendering it', () => {
    const { container } = render(<MarkdownView markdown={'before <script>alert(1)</script> <b>bold</b> after'} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>bold</b>')
  })

  it('drops a javascript: href', () => {
    const { container } = render(<MarkdownView markdown={'[click](javascript:alert(1))'} />)
    // Without an href it is not even a link any more, only the words.
    const anchor = container.querySelector('a')
    expect(anchor?.textContent).toBe('click')
    expect(anchor?.getAttribute('href') ?? '').not.toContain('javascript')
  })

  it('opens an ordinary link outside the app', () => {
    render(<MarkdownView markdown={'[docs](https://example.org/x)'} />)
    const link = screen.getByRole('link', { name: 'docs' })
    expect(link.getAttribute('href')).toBe('https://example.org/x')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('hands an element link back by id and does not navigate', () => {
    const onElementLink = vi.fn()
    render(<MarkdownView markdown={'see [Billing](element:el-42)'} onElementLink={onElementLink} />)
    const link = screen.getByRole('link', { name: 'Billing' })
    expect(link.getAttribute('target')).toBeNull()
    const event = fireEvent.click(link)
    expect(onElementLink).toHaveBeenCalledWith('el-42')
    // fireEvent returns false when a handler called preventDefault.
    expect(event).toBe(false)
  })

  it('keeps an element link intact when no one is listening', () => {
    render(<MarkdownView markdown={'[Billing](element:el-42)'} />)
    expect(screen.getByRole('link', { name: 'Billing' }).getAttribute('href')).toBe('element:el-42')
  })
})
