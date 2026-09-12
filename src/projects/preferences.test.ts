/**
 * What comes out of browser storage is text of unknown provenance: written by an
 * older version, edited by hand, or cut off halfway by a full store. Preferences
 * are never worth a broken editor.
 */
import { describe, expect, it } from 'vitest'

import {
  readLanguage, readLastScope, readThemeMode, withoutLastScope,
} from './preferences'

describe('readLanguage', () => {
  it('reads a valid language back', () => {
    expect(readLanguage({ language: 'nl' })).toBe('nl')
    expect(readLanguage({ language: 'en' })).toBe('en')
  })

  it('returns nothing for a language we do not speak', () => {
    expect(readLanguage({ language: 'fr' })).toBeUndefined()
    expect(readLanguage({ language: 42 })).toBeUndefined()
    expect(readLanguage({})).toBeUndefined()
    expect(readLanguage(undefined)).toBeUndefined()
    expect(readLanguage('nl')).toBeUndefined()
  })
})

describe('readThemeMode', () => {
  it('leest de drie standen terug', () => {
    expect(readThemeMode({ themeMode: 'light' })).toBe('light')
    expect(readThemeMode({ themeMode: 'dark' })).toBe('dark')
    expect(readThemeMode({ themeMode: 'system' })).toBe('system')
  })

  it('geeft niets terug voor iets anders', () => {
    expect(readThemeMode({ themeMode: 'donker' })).toBeUndefined()
    expect(readThemeMode({ themeMode: true })).toBeUndefined()
    expect(readThemeMode(null)).toBeUndefined()
  })
})

describe('withoutLastScope', () => {
  it('drops the path and keeps everything else', () => {
    expect(withoutLastScope({ language: 'nl', themeMode: 'dark', lastScope: 'a/b' }))
      .toEqual({ language: 'nl', themeMode: 'dark' })
  })

  /** Or the boot would hand the same broken address back on the next run. */
  it('drops the key an older build wrote too', () => {
    expect(withoutLastScope({ language: 'nl', lastProject: { group: 'a', project: 'b' } }))
      .toEqual({ language: 'nl' })
  })

  it('leaves a blob that never had one alone', () => {
    expect(withoutLastScope({ language: 'en' })).toEqual({ language: 'en' })
  })

  it('turns nothing into an empty blob rather than throwing', () => {
    expect(withoutLastScope(undefined)).toEqual({})
    expect(withoutLastScope('not a blob')).toEqual({})
  })
})

describe('readLastScope', () => {
  it('reads a path back', () => {
    expect(readLastScope({ lastScope: 'acme/rail' })).toBe('acme/rail')
  })

  /** The two spell the same address, so a blob from before scopes still lands you in your work. */
  it('reads the group and key an older build wrote as the path they always were', () => {
    expect(readLastScope({ lastProject: { group: 'acme', project: 'rail' } })).toBe('acme/rail')
  })

  it('refuses a path that could walk out of the folder, and an absent one', () => {
    expect(readLastScope({ lastScope: '../elsewhere' })).toBeUndefined()
    expect(readLastScope({ lastScope: '' })).toBeUndefined()
    expect(readLastScope({})).toBeUndefined()
    expect(readLastScope(undefined)).toBeUndefined()
  })
})
