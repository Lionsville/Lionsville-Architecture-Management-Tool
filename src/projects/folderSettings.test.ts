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
  DEFAULT_LOCAL_SETTINGS, FOLDER_SETTINGS_PATH, FOLDER_SETTINGS_VERSION, LOCAL_SETTINGS_PATH,
  LOCAL_SETTINGS_VERSION, folderSettingsText, localSettingsText, readFolderSettings,
  readLocalSettings,
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

  it('reads what a machine has been told to do', () => {
    expect(readLocalSettings('{"version":1,"git":{"pullOnOpen":true,"pushAfterSnapshot":true}}'))
      .toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: true } })
  })

  it('fails towards the safe default for anything that is not the file', () => {
    for (const text of ['', 'not json', '[]', '42', '{"git":"yes"}', '{"git":[]}']) {
      expect(readLocalSettings(text), JSON.stringify(text)).toEqual(DEFAULT_LOCAL_SETTINGS)
    }
  })

  it('keeps the flag it can read when the other is nonsense', () => {
    expect(readLocalSettings('{"git":{"pullOnOpen":true,"pushAfterSnapshot":"later"}}'))
      .toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: false } })
  })

  it('reads a file from a newer build for the keys it recognises', () => {
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

  it('patches rather than replaces: the other flag stays', () => {
    const first = localSettingsText(undefined, { git: { pullOnOpen: true, pushAfterSnapshot: true } })
    const second = localSettingsText(first, { git: { pullOnOpen: false } })
    expect(readLocalSettings(second)).toEqual({ git: { pullOnOpen: false, pushAfterSnapshot: true } })
  })

  it('carries keys this build does not recognise through unchanged', () => {
    // An older build must not prune a newer one's settings, at either level.
    const theirs = '{"version":1,"git":{"pullOnOpen":false,"rebase":true},"sync":{"interval":5}}'
    const ours = JSON.parse(localSettingsText(theirs, { git: { pullOnOpen: true } }))
    expect(ours.git.rebase).toBe(true)
    expect(ours.sync).toEqual({ interval: 5 })
    expect(ours.git.pullOnOpen).toBe(true)
  })

  it('does not downgrade the version a newer build wrote', () => {
    const newer = localSettingsText('{"version":7,"git":{}}', { git: { pullOnOpen: true } })
    expect(JSON.parse(newer).version).toBe(7)
  })

  it('stamps its own version over an absent or nonsensical one', () => {
    expect(JSON.parse(localSettingsText('{"version":"one"}', {})).version).toBe(LOCAL_SETTINGS_VERSION)
    expect(JSON.parse(localSettingsText('{}', {})).version).toBe(LOCAL_SETTINGS_VERSION)
  })

  it('starts over when the existing text is not a file at all', () => {
    expect(JSON.parse(localSettingsText('not json', { git: { pushAfterSnapshot: true } })))
      .toEqual({ version: LOCAL_SETTINGS_VERSION, git: { pushAfterSnapshot: true } })
  })

  it('emits stable, readable JSON, so a settings change is one line in a diff', () => {
    const text = localSettingsText(undefined, { git: { pushAfterSnapshot: true, pullOnOpen: true } })
    expect(text).toBe(localSettingsText(undefined, { git: { pullOnOpen: true, pushAfterSnapshot: true } }))
    expect(text.endsWith('\n')).toBe(true)
    expect(text.split('\n').length).toBeGreaterThan(3)
  })
})

describe('readFolderSettings', () => {
  it('tolerates an absent, empty or malformed file', () => {
    for (const text of [undefined, '', '{}', 'nonsense', '{"version":3,"remote":"x"}']) {
      expect(readFolderSettings(text), String(text)).toEqual({})
    }
  })

  it('reads the organisation, which is the first key this file has', () => {
    const text = folderSettingsText(undefined, { organisation: { name: 'Acme Logistics' } })
    expect(readFolderSettings(text)).toEqual({ organisation: { name: 'Acme Logistics' } })
  })

  /**
   * A section this build cannot read is absent rather than fatal: an
   * organisation nobody can name still opens, which is the whole point of
   * reading key by key.
   */
  it('drops a section that is not a record this build understands', () => {
    for (const held of ['{"organisation":"Acme"}', '{"organisation":{"name":7}}',
      '{"organisation":{"name":"Acme","links":"lots"}}']) {
      expect(readFolderSettings(held), held).toEqual({})
    }
  })
})

describe('folderSettingsText', () => {
  it('stamps this build\'s version and writes the record normalised', () => {
    const text = folderSettingsText(undefined, {
      organisation: { name: '  Acme  ', description: '   ', links: [{ label: '', url: 'javascript:alert(1)' }] },
    })
    expect(JSON.parse(text)).toEqual({
      version: FOLDER_SETTINGS_VERSION,
      organisation: { name: 'Acme' },
    })
  })

  /**
   * This file is committed, so the newer build whose keys must survive an older
   * one writing is routinely a colleague's.
   */
  it('keeps keys it does not know, and never lowers the version', () => {
    const existing = '{"version":9,"somethingLater":{"kept":true}}'
    const held = JSON.parse(folderSettingsText(existing, { organisation: { name: 'Acme' } }))
    expect(held.version).toBe(9)
    expect(held.somethingLater).toEqual({ kept: true })
  })

  it('leaves the organisation alone when the patch does not carry one', () => {
    const existing = folderSettingsText(undefined, { organisation: { name: 'Acme' } })
    expect(readFolderSettings(folderSettingsText(existing, {})).organisation?.name).toBe('Acme')
  })

  /**
   * A section is replaced rather than merged: the form is saved whole, so a
   * cleared field has to be distinguishable from an untouched one.
   */
  it('replaces the organisation rather than merging into it', () => {
    const existing = folderSettingsText(undefined, {
      organisation: { name: 'Acme', description: 'A haulier' },
    })
    const held = readFolderSettings(folderSettingsText(existing, { organisation: { name: 'Acme' } }))
    expect(held.organisation).toEqual({ name: 'Acme' })
  })

  it('is stable JSON, so a settings change is one readable line in a diff', () => {
    const once = folderSettingsText(undefined, { organisation: { name: 'Acme', client: 'Acme BV' } })
    expect(folderSettingsText(undefined, {
      organisation: { client: 'Acme BV', name: 'Acme' },
    })).toBe(once)
  })
})
