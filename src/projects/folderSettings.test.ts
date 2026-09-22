// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two settings files, and what they do when they are wrong.
 *
 * Most of this is about tolerance, because that is the whole contract: a
 * missing file, a hand-edited one, one from a newer build — none of them may
 * stop a folder opening, and none of them may make a machine push or pull
 * that nobody asked to.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCAL_SETTINGS, FOLDER_SETTINGS_PATH, LOCAL_SETTINGS_PATH,
  LOCAL_SETTINGS_VERSION, localSettingsText, readFolderSettings, readLocalSettings,
} from './folderSettings'

describe('where the files are', () => {
  it('keeps both in one dot-folder at the root, named after the discriminator', () => {
    // Not `.lvarch/`: beside `something.lvarch` that is one token meaning two
    // things in the same directory listing.
    expect(FOLDER_SETTINGS_PATH).toBe('.lionsville-architecture/folder.json')
    expect(LOCAL_SETTINGS_PATH).toBe('.lionsville-architecture/local.json')
  })
})

describe('readLocalSettings', () => {
  it('does nothing automatically when there is no file', () => {
    expect(readLocalSettings(undefined)).toEqual(DEFAULT_LOCAL_SETTINGS)
    expect(DEFAULT_LOCAL_SETTINGS.git.pullOnOpen).toBe(false)
    expect(DEFAULT_LOCAL_SETTINGS.git.pushAfterSnapshot).toBe(false)
  })

  it('reads what a machine has been told to do, falling to the safe default per key', () => {
    expect(readLocalSettings('{"version":1,"git":{"pullOnOpen":true,"pushAfterSnapshot":true}}'))
      .toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: true } })
    for (const text of ['', 'not json', '[]', '42', '{"git":"yes"}', '{"git":[]}']) {
      expect(readLocalSettings(text), JSON.stringify(text)).toEqual(DEFAULT_LOCAL_SETTINGS)
    }
    expect(readLocalSettings('{"git":{"pullOnOpen":true,"pushAfterSnapshot":"later"}}'))
      .toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: false } })
    expect(readLocalSettings('{"version":99,"git":{"pullOnOpen":true,"rebase":true}}').git.pullOnOpen)
      .toBe(true)
  })

})

describe('localSettingsText', () => {
  it('writes a whole file from nothing', () => {
    const text = localSettingsText(undefined, { git: { pullOnOpen: true } })
    expect(JSON.parse(text)).toEqual({
      version: LOCAL_SETTINGS_VERSION, git: { pullOnOpen: true },
    })
    expect(readLocalSettings(text)).toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: false } })
  })

  it('patches rather than replaces, keeps a newer version, and starts over on a file it cannot read', () => {
    const first = localSettingsText(undefined, { git: { pullOnOpen: true, pushAfterSnapshot: true } })
    const second = localSettingsText(first, { git: { pullOnOpen: false } })
    expect(readLocalSettings(second)).toEqual({ git: { pullOnOpen: false, pushAfterSnapshot: true } })
    const newer = localSettingsText('{"version":7,"git":{}}', { git: { pullOnOpen: true } })
    expect(JSON.parse(newer).version).toBe(7)
    expect(JSON.parse(localSettingsText('not json', { git: { pushAfterSnapshot: true } })))
      .toEqual({ version: LOCAL_SETTINGS_VERSION, git: { pushAfterSnapshot: true } })
  })

  it('carries keys this build does not recognise through unchanged', () => {
    // An older build must not prune a newer one's settings, at either level.
    const theirs = '{"version":1,"git":{"pullOnOpen":false,"rebase":true},"sync":{"interval":5}}'
    const ours = JSON.parse(localSettingsText(theirs, { git: { pullOnOpen: true } }))
    expect(ours.git.rebase).toBe(true)
    expect(ours.sync).toEqual({ interval: 5 })
    expect(ours.git.pullOnOpen).toBe(true)
  })

  it('stamps its own version over an absent or nonsensical one', () => {
    expect(JSON.parse(localSettingsText('{"version":"one"}', {})).version).toBe(LOCAL_SETTINGS_VERSION)
    expect(JSON.parse(localSettingsText('{}', {})).version).toBe(LOCAL_SETTINGS_VERSION)
  })

  it('emits stable, readable JSON, so a settings change is one line in a diff', () => {
    const text = localSettingsText(undefined, { git: { pushAfterSnapshot: true, pullOnOpen: true } })
    expect(text).toBe(localSettingsText(undefined, { git: { pullOnOpen: true, pushAfterSnapshot: true } }))
    expect(text.endsWith('\n')).toBe(true)
    expect(text.split('\n').length).toBeGreaterThan(3)
  })
})

describe('readFolderSettings', () => {
  it('tolerates an absent, empty or malformed file, and reads the name an older build wrote', () => {
    for (const text of [undefined, '', '{}', 'nonsense', '{"version":3,"remote":"x"}']) {
      expect(readFolderSettings(text), String(text)).toEqual({})
    }
    // The shared file is keyless again (ADR-0012 §1): its one key was the
    // organisation's name, and the root scope's `scope.json` is where a name
    // belongs. The one thing still read out of it is that name, for the 4 → 5
    // pass to give the root it is about to write — and the pass takes the key
    // away afterwards.
    expect(readFolderSettings('{"version":1,"organisation":{"name":"  Acme  "}}'))
      .toEqual({ legacyOrganisationName: 'Acme' })
    for (const held of ['{"organisation":"Acme"}', '{"organisation":{"name":7}}',
      '{"organisation":{"name":"   "}}', '{"organisation":{}}']) {
      expect(readFolderSettings(held), held).toEqual({})
    }
  })

})
