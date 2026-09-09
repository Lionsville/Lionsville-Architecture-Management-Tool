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
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { MarkdownView } from './MarkdownView'
import { renderShell } from '../../app/testing/renderShell'

afterEach(() => cleanup())

describe('MarkdownView', () => {
  it('renders GFM: headings, a table, and a task list', () => {
    const { container } = renderShell(
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
    const { container } = renderShell(<MarkdownView markdown={'before <script>alert(1)</script> <b>bold</b> after'} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>bold</b>')
  })

  it('drops a javascript: href', () => {
    const { container } = renderShell(<MarkdownView markdown={'[click](javascript:alert(1))'} />)
    // Without an href it is not even a link any more, only the words.
    const anchor = container.querySelector('a')
    expect(anchor?.textContent).toBe('click')
    expect(anchor?.getAttribute('href') ?? '').not.toContain('javascript')
  })

  it('opens an ordinary link outside the app', () => {
    renderShell(<MarkdownView markdown={'[docs](https://example.org/x)'} />)
    const link = screen.getByRole('link', { name: 'docs' })
    expect(link.getAttribute('href')).toBe('https://example.org/x')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('hands an element link back by id and does not navigate', () => {
    const onElementLink = vi.fn()
    renderShell(<MarkdownView markdown={'see [Billing](element:el-42)'} onElementLink={onElementLink} />)
    const link = screen.getByRole('link', { name: 'Billing' })
    expect(link.getAttribute('target')).toBeNull()
    const event = fireEvent.click(link)
    expect(onElementLink).toHaveBeenCalledWith('el-42')
    // fireEvent returns false when a handler called preventDefault.
    expect(event).toBe(false)
  })

  it('keeps an element link intact when no one is listening', () => {
    renderShell(<MarkdownView markdown={'[Billing](element:el-42)'} />)
    expect(screen.getByRole('link', { name: 'Billing' }).getAttribute('href')).toBe('element:el-42')
  })

  it('draws a mermaid fence with the renderer it is given, and only that fence', async () => {
    const render_ = vi.fn(async (code: string) => `<svg data-code="${code.trim()}"></svg>`)
    const { container } = renderShell(
      <MarkdownView
        markdown={'```mermaid\nflowchart LR\n  A --> B\n```\n\n```js\nconst x = 1\n```'}
        renderMermaid={render_}
      />,
    )
    await waitFor(() => expect(container.querySelector('svg[data-code]')).not.toBeNull())
    expect(render_).toHaveBeenCalledTimes(1)
    expect(render_.mock.calls[0][0]).toBe('flowchart LR\n  A --> B')
    // The mermaid fence is not wrapped in a code block; the JS fence still is.
    expect(container.querySelectorAll('pre')).toHaveLength(1)
    expect(container.querySelector('pre')?.textContent).toContain('const x = 1')
  })

  it('draws a picture the project holds, through the resolver', () => {
    const { container } = renderShell(
      <MarkdownView
        markdown={'![Cutover](../images/cutover.png)'}
        resolveImage={(src) => (src === '../images/cutover.png' ? 'data:image/png;base64,AQI=' : undefined)}
      />,
    )
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,AQI=')
    expect(img?.getAttribute('alt')).toBe('Cutover')
  })

  it('opens the same picture full size on a click, and closes it on the next', async () => {
    renderShell(
      <MarkdownView
        markdown={'![Cutover](../images/cutover.png)'}
        resolveImage={() => 'data:image/png;base64,AQI='}
      />,
    )
    expect(screen.queryByTestId('lightbox')).toBeNull()
    fireEvent.click(screen.getByRole('img', { name: 'Cutover' }))
    const large = screen.getByTestId('lightbox')
    // The file from disk, not a copy resized for the page.
    expect(large.getAttribute('src')).toBe('data:image/png;base64,AQI=')
    fireEvent.click(large)
    await waitFor(() => expect(screen.queryByTestId('lightbox')).toBeNull())
  })

  it('marks the blocks that may run wider than the prose, and only those', () => {
    const { container } = renderShell(
      <MarkdownView
        markdown={[
          'A paragraph.',
          '![Cutover](../images/cutover.png)',
          '| a | b |\n|---|---|\n| 1 | 2 |',
          '```\ncode\n```',
          '```business-case\ncurrency: EUR\nperiods: 2026\nlines:\n  - Thing: -1\n```',
        ].join('\n\n')}
        resolveImage={() => 'data:image/png;base64,AQI='}
      />,
    )
    const wide = Array.from(container.querySelectorAll('[data-wide]'))
    expect(wide.map((el) => el.tagName.toLowerCase())).toEqual(['p', 'div', 'pre', 'div'])
    expect(container.querySelector('p:not([data-wide])')?.textContent).toBe('A paragraph.')
  })

  it('never fetches a remote image, whatever a description asks for', () => {
    // The resolver is the allowlist. Anything it declines is drawn as its alt
    // text, so a tracking pixel in somebody's markdown makes no request.
    const resolveImage = vi.fn(() => undefined)
    const { container } = renderShell(
      <MarkdownView
        markdown={'![Pixel](https://example.org/p.gif)\n\n![Gone](../images/missing.png)'}
        resolveImage={resolveImage}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('Pixel')
    expect(container.textContent).toContain('Gone')
  })

  it('draws nothing at all when no resolver was given', () => {
    const { container } = renderShell(<MarkdownView markdown={'![x](../images/x.png)'} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('keeps the source on screen when the diagram cannot be drawn', async () => {
    const { container } = renderShell(
      <MarkdownView markdown={'```mermaid\nnot a diagram\n```'} renderMermaid={async () => { throw new Error('Parse error') }} />,
    )
    await waitFor(() => expect(container.querySelector('[data-state="failed"]')).not.toBeNull())
    expect(container.textContent).toContain('not a diagram')
    expect(container.textContent).toContain('Parse error')
  })
})
