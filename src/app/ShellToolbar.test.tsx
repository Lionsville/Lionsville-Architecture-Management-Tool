// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What the frame still takes from the bar's module: the crumbs a place is named
 * by, and what the chip says about the source. The rows themselves are pinned in
 * `widgets/kit/Frame.test.tsx` and `App.frame.test.tsx`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { translator } from '../i18n'
import { crumbsFor, sourceIsAlarming, sourceLabel, sourceTipKey } from './ShellToolbar'

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
