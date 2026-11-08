// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the folder keeps in the preferences is text of unknown provenance, like
 * the rest of the blob: read forgivingly, written without losing a key.
 */
import { describe, expect, it } from 'vitest'
import {
  adoptingFoldersWith, mayOfferAdoption, readAdoptingFolders, readDeclinedFolders, readMigratedFolders, readWorkingDirectory, withDeclinedFolder,
  withMigratedFolder, withoutWorkingDirectory, withWorkingDirectory,
} from './remembered'

describe('the folder this machine works in', () => {
  it('reads it back, and reads rubbish as none', () => {
    expect(readWorkingDirectory({ workingDirectory: '/work' })).toBe('/work')
    expect(readWorkingDirectory({ workingDirectory: '' })).toBeUndefined()
    expect(readWorkingDirectory({ workingDirectory: 3 })).toBeUndefined()
    expect(readWorkingDirectory(undefined)).toBeUndefined()
  })

  it('forgets the scope that was open, which was in the folder before', () => {
    expect(withWorkingDirectory({ language: 'nl', lastScope: 'acme', lastProject: 'x' }, '/work'))
      .toEqual({ language: 'nl', workingDirectory: '/work' })
  })

  it('lets go of the folder and of nothing else, for a person who went back to where they were', () => {
    expect(withoutWorkingDirectory({ language: 'nl', workingDirectory: '/work', textSize: 112 })).toEqual({ language: 'nl', textSize: 112 })
    expect(withoutWorkingDirectory(undefined)).toEqual({})
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
  it('stops once the work has been copied whole anywhere at all', () => {
    const after = { adoptedFolders: ['/Documents/test'] }
    expect(mayOfferAdoption(after, '/Documents/test')).toBe(false)
    expect(mayOfferAdoption(after, '/Documents/test2')).toBe(false)
  })

  /**
   * A build before the copy read its work back could leave the organisation
   * itself behind and write this list all the same. Its word ends nothing.
   */
  it('asks again where only a build that did not check says a copy happened', () => {
    expect(mayOfferAdoption(withMigratedFolder({}, '/Documents/test'), '/Documents/test')).toBe(true)
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

describe('the folders a copy has not come whole to', () => {
  it('puts a folder on and takes it off, keeps the others, and leaves nothing where none is left', () => {
    expect(adoptingFoldersWith({}, '/a', true)).toEqual(['/a'])
    expect(adoptingFoldersWith({ adoptingFolders: ['/b', '/a'] }, '/a', false)).toEqual(['/b'])
    expect(adoptingFoldersWith({ adoptingFolders: ['/a'] }, '/a', false)).toBeUndefined()
    expect(readAdoptingFolders({ adoptingFolders: ['/a', 3] })).toEqual(['/a'])
    expect(readAdoptingFolders('rubbish')).toEqual([])
  })
})
