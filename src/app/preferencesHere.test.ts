// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { PreferencesStore } from '../ports/PreferencesStore'
import { preferencesHere } from './preferencesHere'

describe('the preferences the app is handed', () => {
  it('tells the boot every blob written, so an app mounted afresh starts from the language chosen last', async () => {
    let held: unknown = { language: 'de' }
    const written: unknown[] = []
    const store: PreferencesStore = { id: 'test', read: () => Promise.resolve(held), write: (blob) => { written.push(blob); return Promise.resolve() } }
    const here = preferencesHere((blob) => { held = blob })
    await here(store).write({ language: 'nl' })
    expect(held).toEqual({ language: 'nl' })
    expect(written).toEqual([{ language: 'nl' }])
    expect(await here(store).read()).toEqual({ language: 'nl' })
  })

  it('tells the boot even when the store refuses, since the screen shows what was chosen', async () => {
    let held: unknown
    const store: PreferencesStore = { id: 'full', read: () => Promise.resolve(undefined), write: () => Promise.reject(new Error('full')) }
    await expect(preferencesHere((blob) => { held = blob })(store).write({ language: 'nl' })).rejects.toThrow('full')
    expect(held).toEqual({ language: 'nl' })
  })

  it('hands the same store back for the same store, so the app\'s writer stays put across renders', () => {
    const store: PreferencesStore = { id: 'one', read: () => Promise.resolve(undefined), write: () => Promise.resolve() }
    const here = preferencesHere(() => {})
    expect(here(store)).toBe(here(store))
  })
})
