import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCAL_SETTINGS } from '../../projects/folderSettings'
import {
  MACHINE_FOLDER_SETTINGS_VERSION, machineFolderSettingsText, readMachineFolderSettings,
} from './machineFolderSettings'

const ROOT = '/Users/someone/Architecture'
const OTHER = '/Volumes/share/Architecture'

describe('readMachineFolderSettings', () => {
  it('answers nothing for a folder the app has never written, so the folder itself can be asked', () => {
    expect(readMachineFolderSettings(undefined, ROOT)).toBeUndefined()
    expect(readMachineFolderSettings('{"version":1,"folders":{}}', ROOT)).toBeUndefined()
    expect(readMachineFolderSettings('not json', ROOT)).toBeUndefined()
  })

  it('reads an entry the way the file it replaces was read, per flag, with the defaults for nonsense', () => {
    const text = JSON.stringify({ version: 1, folders: { [ROOT]: { version: 1, git: { pullOnOpen: true, pushAfterSnapshot: 'yes' } } } })
    expect(readMachineFolderSettings(text, ROOT)).toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: false } })
    expect(readMachineFolderSettings(JSON.stringify({ folders: { [ROOT]: 'nonsense' } }), ROOT)).toEqual(DEFAULT_LOCAL_SETTINGS)
  })
})

describe('machineFolderSettingsText', () => {
  it('writes a whole file from nothing, keyed by the folder', () => {
    const held = JSON.parse(machineFolderSettingsText(undefined, ROOT, { git: { pullOnOpen: true } }))
    expect(held.version).toBe(MACHINE_FOLDER_SETTINGS_VERSION)
    expect(held.folders[ROOT].git).toEqual({ pullOnOpen: true })
    expect(readMachineFolderSettings(JSON.stringify(held), ROOT)).toEqual({ git: { pullOnOpen: true, pushAfterSnapshot: false } })
  })

  it('patches one folder and carries every other folder through untouched', () => {
    const one = machineFolderSettingsText(undefined, OTHER, { git: { pushAfterSnapshot: true } })
    const two = machineFolderSettingsText(one, ROOT, { git: { pullOnOpen: true } })
    const three = JSON.parse(machineFolderSettingsText(two, ROOT, { git: { pushAfterSnapshot: true } }))
    expect(three.folders[OTHER].git).toEqual({ pushAfterSnapshot: true })
    expect(three.folders[ROOT].git).toEqual({ pullOnOpen: true, pushAfterSnapshot: true })
  })

  it('keeps keys it does not know at every level, and never lowers a version', () => {
    const existing = JSON.stringify({
      version: 3, later: true, folders: { [ROOT]: { version: 2, git: { rebase: true }, extra: 1 } },
    })
    const held = JSON.parse(machineFolderSettingsText(existing, ROOT, { git: { pullOnOpen: true } }))
    expect(held.version).toBe(3)
    expect(held.later).toBe(true)
    expect(held.folders[ROOT]).toEqual({ version: 2, extra: 1, git: { rebase: true, pullOnOpen: true } })
  })

  it('emits stable JSON, so a change is one line in a diff', () => {
    const a = machineFolderSettingsText('{"folders":{"b":{},"a":{}}}', ROOT, {})
    const b = machineFolderSettingsText('{"folders":{"a":{},"b":{}}}', ROOT, {})
    expect(a).toBe(b)
  })
})
