/**
 * What comes out of browser storage is text of unknown provenance: written by an
 * older version, edited by hand, or cut off halfway by a full store. Preferences
 * are never worth a broken editor.
 */
import { describe, expect, it } from 'vitest'

import {
  mayOfferAdoption, readDeclinedFolders, readLanguage, readLastScope, readMigratedFolders,
  readThemeMode, withDeclinedFolder, withMigratedFolder, withoutLastScope,
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

describe('the folders a rescue has been offered for', () => {
  it('reads both lists back, and reads rubbish as neither', () => {
    expect(readMigratedFolders({ migratedFolders: ['/a', '/b'] })).toEqual(['/a', '/b'])
    expect(readDeclinedFolders({ declinedFolders: ['/c'] })).toEqual(['/c'])
    expect(readMigratedFolders({ migratedFolders: 'a' })).toEqual([])
    expect(readDeclinedFolders({ declinedFolders: [1, 'c'] })).toEqual(['c'])
    expect(readDeclinedFolders(undefined)).toEqual([])
  })

  it('adds a folder without repeating it, and keeps the rest of the blob', () => {
    const once = withMigratedFolder({ language: 'nl' }, '/a')
    expect(withMigratedFolder(once, '/a')).toEqual({ language: 'nl', migratedFolders: ['/a'] })
    expect(withDeclinedFolder(once, '/b'))
      .toEqual({ language: 'nl', migratedFolders: ['/a'], declinedFolders: ['/b'] })
  })

  /**
   * The two answers are recorded apart because they are read apart: one copy
   * anywhere ends the offer everywhere, while a no ends it for that folder
   * only. A single list could not say which of the two a folder was in.
   */
  it('keeps a no apart from a yes', () => {
    const said = withDeclinedFolder(withMigratedFolder({}, '/a'), '/b')
    expect(readMigratedFolders(said)).toEqual(['/a'])
    expect(readDeclinedFolders(said)).toEqual(['/b'])
  })
})

describe('mayOfferAdoption', () => {
  it('offers on a machine that has never put its work anywhere', () => {
    expect(mayOfferAdoption({}, '/a')).toBe(true)
    expect(mayOfferAdoption(undefined, '/a')).toBe(true)
  })

  /**
   * The bug this rule replaced. Keyed per folder, the answer here was `true`
   * for every folder that had not been copied into yet — which is every folder
   * somebody has just made. Two new folders in a row, two copies of an
   * organisation nobody asked to move.
   */
  it('stops once the work has been copied anywhere at all', () => {
    const after = withMigratedFolder({}, '/Documents/test')
    expect(mayOfferAdoption(after, '/Documents/test')).toBe(false)
    expect(mayOfferAdoption(after, '/Documents/test2')).toBe(false)
  })

  it('stops for a folder that was offered and turned down', () => {
    // A browser folder permission rarely survives a restart, so the same folder
    // is picked again and again; the question is answered once.
    expect(mayOfferAdoption(withDeclinedFolder({}, '/a'), '/a')).toBe(false)
  })

  it('still asks about a folder that has not been offered one', () => {
    // A no is about a place. The work is still stranded, so the next folder is
    // a fair question.
    expect(mayOfferAdoption(withDeclinedFolder({}, '/a'), '/b')).toBe(true)
  })
})
