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
import { cleanup, screen } from '@testing-library/react'
import { translator } from '../i18n'
import { ShellToolbar } from './ShellToolbar'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

const props = {
  designName: 'Warehouse landscape',
  groupName: 'Acme Logistics',
  savedAt: null,
  language: 'en' as const,
  themeMode: 'dark' as const,
  onCycleTheme: () => {},
  onSaveWorkingFile: () => {},
  onSaveInterchange: () => {},
  onOpenFile: () => {},
  onLeave: () => {},
  onOpenSettings: () => {},
  onOpenDocumentation: () => {},
  onOpenDecisions: () => {},
  onOpenSearch: () => {},
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
