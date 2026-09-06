/**
 * What comes out of browser storage is text of unknown provenance: written by an
 * older version, edited by hand, or cut off halfway by a full store. Preferences
 * are never worth a broken editor.
 */
import { describe, expect, it } from 'vitest'

import {
  readLanguage, readThemeMode, withoutLastProject,
} from './preferences'

describe('readLanguage', () => {
  it('reads a valid language back', () => {
    expect(readLanguage({ language: 'nl' })).toBe('nl')
    expect(readLanguage({ language: 'en' })).toBe('en')
  })

  it('returns nothing for a language we do not speak', () => {
    expect(readLanguage({ language: 'de' })).toBeUndefined()
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

describe('withoutLastProject', () => {
  it('drops the ref and keeps everything else', () => {
    expect(withoutLastProject({ language: 'nl', themeMode: 'dark', lastProject: { group: 'a', project: 'b' } }))
      .toEqual({ language: 'nl', themeMode: 'dark' })
  })

  it('leaves a blob that never had one alone', () => {
    expect(withoutLastProject({ language: 'en' })).toEqual({ language: 'en' })
  })

  it('turns nothing into an empty blob rather than throwing', () => {
    expect(withoutLastProject(undefined)).toEqual({})
    expect(withoutLastProject('not a blob')).toEqual({})
  })
})
