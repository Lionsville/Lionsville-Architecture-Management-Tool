// @vitest-environment jsdom
/**
 * What the bar does for the window, which is the part of it nobody can see.
 *
 * On the desktop this bar *is* the title bar (`titleBarStyle: 'hiddenInset'`),
 * and both of the jobs it inherited are silent when they go wrong: without the
 * inset the traffic lights sit on top of the first button, and without a drag
 * region the window cannot be moved at all. Two CSS declarations, no visible
 * difference in a screenshot, so they are pinned here.
 *
 * The rules are read out of the stylesheet rather than off the element:
 * `-webkit-app-region` is a property jsdom's computed style does not keep, and
 * "did Emotion emit it" is exactly the question worth asking.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../i18n'
import { ShellToolbar } from './ShellToolbar'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

const props = {
  designName: 'Warehouse landscape',
  crumbs: [{ path: '', name: 'Acme Logistics' }, { path: 'retail', name: 'Retail' }],
  savedAt: null,
  language: 'en' as const,
  onGoHome: () => {},
  onOpenSettings: () => {},
  onOpenDocumentation: () => {},
  onOpenDecisions: () => {},
  onOpenRoadmap: () => {},
  onOpenSearch: () => {},
  activity: () => [],
  scopePath: 'retail/warehouse',
  s: translator('en'),
}

/** Rendered per test rather than looked up globally: two bars in one document
    would leave the second test reading the first one's rules. */
const barIn = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-testid="shell-toolbar"]')!

/** Every rule Emotion wrote for that element, its nested selectors included. */
const rulesFor = (element: HTMLElement): string => {
  const css = [...document.querySelectorAll('style')].map((tag) => tag.textContent).join('')
  const own = [...element.classList].find((name) => css.includes(`.${name}{`))
  return (css.match(/[^{}]*\{[^{}]*\}/g) ?? []).filter((rule) => rule.includes(`.${own}`)).join('')
}

describe('the saved indicator', () => {
  const indicator = () => screen.getByTestId('saved-indicator').textContent

  it('says nothing has happened yet before the first write', () => {
    renderShell(<ShellToolbar {...props} />)
    expect(indicator()).toBe('Not saved yet')
  })

  it('says when the store last accepted it', () => {
    renderShell(<ShellToolbar {...props} savedAt={new Date(2026, 8, 6, 14, 2)} />)
    expect(indicator()).toContain('Saved')
    expect(indicator()).toContain('14:02')
  })

  it('replaces the time when a write was refused, rather than standing beside it', () => {
    // The expensive wrong: a time from before the failure is older than the
    // work on screen, and reads as reassurance.
    renderShell(<ShellToolbar {...props} savedAt={new Date(2026, 8, 6, 14, 2)} saveFailed />)
    expect(indicator()).toBe('Not saved — storage refused')
    expect(indicator()).not.toContain('14:02')
  })

  it('says where the document stands, when that is not simply "saved"', () => {
    // Each of these is an answer to "can I close this window now", which is the
    // only question this corner of the bar is really being asked. A time is an
    // answer to a different one, so it gives way.
    const at = new Date(2026, 8, 6, 14, 2)
    for (const [status, expected] of [
      ['dirty', 'Unsaved changes'],
      ['saving', 'Saving…'],
      ['external-changed', 'Changed on disk'],
      ['conflict', 'Changed here and on disk'],
    ] as const) {
      cleanup()
      renderShell(<ShellToolbar {...props} savedAt={at} status={status} />)
      expect(indicator(), status).toBe(expected)
    }
  })

  it('keeps the time for a document that is clean', () => {
    renderShell(<ShellToolbar {...props} savedAt={new Date(2026, 8, 6, 14, 2)} status="clean" />)
    expect(indicator()).toContain('14:02')
  })
})

describe('ShellToolbar and the window around it', () => {
  it('starts where the window controls end', () => {
    const { container } = renderShell(
      <ShellToolbar {...props} windowChrome={{ controlsInset: 78, draggable: true }} />)
    expect(getComputedStyle(barIn(container)).paddingLeft).toBe('90px')
  })

  it('lets the window be dragged by the bar, but not by a control on it', () => {
    const { container } = renderShell(
      <ShellToolbar {...props} windowChrome={{ controlsInset: 78, draggable: true }} />)
    const rules = rulesFor(barIn(container))
    expect(rules).toContain('-webkit-app-region:drag')
    expect(rules).toContain('button')
    expect(rules).toContain('-webkit-app-region:no-drag')
  })

  it('leaves a window that has a title bar of its own alone', () => {
    const { container } = renderShell(<ShellToolbar {...props} />)
    const bar = barIn(container)
    expect(getComputedStyle(bar).paddingLeft).toBe('12px')
    expect(rulesFor(bar)).not.toContain('-webkit-app-region:drag')
  })

  it('says where you are, first: every scope above as a crumb, then the open one', () => {
    // The organisation, the domain between, and the landscape — in that order,
    // because the level between used to be left out and the bar read
    // "organisation · landscape" over a folder that had three levels.
    const { container } = renderShell(<ShellToolbar {...props} />)
    const text = barIn(container).textContent ?? ''
    expect(text.indexOf('Acme Logistics')).toBeLessThan(text.indexOf('Retail'))
    expect(text.indexOf('Retail')).toBeLessThan(text.indexOf('Warehouse landscape'))
    expect(screen.getByTestId('crumb-current').textContent).toBe('Warehouse landscape')
  })

  it('leaves by a crumb, to the home of the scope it names', () => {
    const went: string[] = []
    renderShell(<ShellToolbar {...props} onGoHome={(path) => went.push(path)} />)
    fireEvent.click(screen.getByTestId('crumb-retail'))
    fireEvent.click(screen.getByTestId('crumb-'))
    // The open scope's own crumb leads to its home as well: a canvas with
    // nothing to draw would otherwise be a page with no way out.
    fireEvent.click(screen.getByTestId('crumb-current'))
    expect(went).toEqual(['retail', '', 'retail/warehouse'])
  })

  it('no longer says where the project is kept: that is the root’s home’s to say', () => {
    renderShell(<ShellToolbar {...props} />)
    expect(screen.queryByTestId('working-source')).toBeNull()
  })

  it('carries the menu in an overflow only where the host has no menu bar', () => {
    renderShell(<ShellToolbar {...props} />)
    expect(screen.queryByTestId('overflow-button')).toBeNull()
    cleanup()
    renderShell(<ShellToolbar {...props} overflow={{
      themeMode: 'dark', can: { history: false, folders: false }, onCommand: () => {},
    }} />)
    expect(screen.getByTestId('overflow-button')).toBeDefined()
  })

  it('offers the three pages beside the canvas', () => {
    // By text, not by accessible name: the tooltip supplies the name, and it
    // is the words on the button a user finds it by.
    const { container } = renderShell(<ShellToolbar {...props} />)
    const labels = [...barIn(container).querySelectorAll('button')].map((button) => button.textContent)
    for (const label of ['Documentation', 'Decisions', 'Search']) {
      expect(labels).toContain(label)
    }
  })
})
