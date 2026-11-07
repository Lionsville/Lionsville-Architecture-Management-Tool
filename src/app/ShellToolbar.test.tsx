// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { crumbsFor, sourceIsAlarming, sourceLabel, sourceTipKey } from './ShellToolbar'
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
  onOpenObservations: () => {},
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

describe('the crumbs', () => {
  it('names each scope above by its own name, and the root by the organisation’s', () => {
    const scopes = [
      { path: '', name: 'Acme Logistics', diagrams: 0, children: [] },
      { path: 'retail', name: 'Retail', diagrams: 0, children: [] },
    ]
    expect(crumbsFor('retail/warehouse', scopes, props.s).map((crumb) => crumb.name)).toEqual(['Acme Logistics', 'Retail'])
    expect(crumbsFor('north/south', [], props.s).map((crumb) => crumb.name)).toEqual(['This organisation', 'north'])
  })
})

/**
 * Who else is in this scope. The shell never works this out — it is told, by
 * whoever answers for the source (`ScopeSession.alsoHere`) — so what is pinned
 * here is what it does with what it is told.
 */
/**
 * What the chip is called, and what hovering it says: the two functions the
 * homes read, and the one case where a provider has the last word.
 *
 * The built-ins are pinned to the exact strings they have always said, because
 * a provider's word now reaches this code and the three that ship must not have
 * moved a byte: a chip handed to it changes nothing at all about a folder.
 */
describe('what the chip says about the source', () => {
  const s = translator('en')
  const chip = { label: 'Anna Berg', tipKey: 'elsewhere.signedIn' }

  it('says what the provider calls a source of its kind, with the source\'s name in it', () => {
    const folder = { provider: 'folder', name: 'Architecture', key: '/w' }
    expect(sourceLabel(folder, s, undefined, 'shell.sourceFolder')).toBe('Folder · Architecture')
    expect(sourceLabel({ provider: 'browserStorage', name: '', key: '' }, s, undefined, 'shell.sourceBrowser')).toBe('In this browser')
    expect(sourceTipKey('shell.sourceTipFolder')).toBe('shell.sourceTipFolder')
  })

  it('draws the source that keeps nothing in the warning colour, and no other', () => {
    expect(sourceIsAlarming({ provider: 'memory', name: '', key: '', transient: true })).toBe(true)
    expect(sourceIsAlarming({ provider: 'folder', name: 'Architecture', key: '/w' })).toBe(false)
  })

  it('calls a registered source what its provider calls it now, not what it was opened as', () => {
    const elsewhere = {
      provider: 'elsewhere', name: 'Elsewhere', key: 'one',
    }
    // No chip: the name the source was opened under, exactly as before.
    expect(sourceLabel(elsewhere, s)).toBe('Elsewhere')
    expect(sourceTipKey('elsewhere.kept')).toBe('elsewhere.kept')
    // A chip: the provider's word about this moment, and its sentence about this
    // moment where it gave one.
    expect(sourceLabel(elsewhere, s, chip)).toBe('Anna Berg')
    expect(sourceTipKey('elsewhere.kept', chip)).toBe('elsewhere.signedIn')
    // A provider that only renamed the chip keeps the standing sentence it
    // registered: nothing new was said, so nothing is taken away.
    expect(sourceTipKey('elsewhere.kept', { label: 'Anna Berg' })).toBe('elsewhere.kept')
  })
})
