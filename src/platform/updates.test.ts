// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UPDATE_SETTINGS,
  isNewerVersion,
  parseVersion,
  pickDownloadAsset,
  readNewestRelease,
  readRelease,
  readUpdateSettings,
  offersUpdateCheck,
  shouldCheckForUpdates,
  updateAvailable,
  updateSettingsFor,
} from './updates'

describe('parseVersion', () => {
  it('reads a tag with or without its v, fills in what it leaves out, and keeps the prerelease', () => {
    expect(parseVersion('v1.2.3')?.numbers).toEqual([1, 2, 3])
    expect(parseVersion('1.2.3')?.numbers).toEqual([1, 2, 3])
    expect(parseVersion('1.2')?.numbers).toEqual([1, 2, 0])
    expect(parseVersion('1')?.numbers).toEqual([1, 0, 0])
    // The prerelease is part of the order; the build metadata is not.
    expect(parseVersion('1.2.3-rc.1')?.prerelease).toBe('rc.1')
    expect(parseVersion('1.2.3+abc123')).toEqual({ numbers: [1, 2, 3], prerelease: '' })
  })

  it('rejects what is not a version', () => {
    for (const raw of ['', 'latest', '1.2.3.4', '1.x.3', 'v', 'nightly-2026-09-05']) {
      expect(parseVersion(raw)).toBeUndefined()
    }
  })
})

describe('isNewerVersion', () => {
  it('compares segment by segment, not as text, and prefers a release to its prerelease', () => {
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true)
    expect(isNewerVersion('1.9.0', '1.10.0')).toBe(false)
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true)
    expect(isNewerVersion('1.2.3', 'v1.2.3')).toBe(false)
    expect(isNewerVersion('1.2.3', '1.2.3-rc.1')).toBe(true)
    expect(isNewerVersion('1.2.3-rc.1', '1.2.3')).toBe(false)
  })

  // A build that cannot say what it is must not be talked into replacing itself.
  it('is false when either side is unparseable', () => {
    expect(isNewerVersion('nightly', '1.2.3')).toBe(false)
    expect(isNewerVersion('9.9.9', 'dev')).toBe(false)
  })
})

describe('pickDownloadAsset', () => {
  const assets = [
    { name: 'tool-1.2.3-mac-arm64.dmg', url: 'https://example.test/mac.dmg' },
    { name: 'tool-1.2.3-mac-arm64.zip', url: 'https://example.test/mac.zip' },
    { name: 'tool-1.2.3-win-x64.exe', url: 'https://example.test/win-x64.exe' },
    { name: 'tool-1.2.3-win-arm64.exe', url: 'https://example.test/win-arm64.exe' },
    { name: 'tool-1.2.3-win-x64.exe.blockmap', url: 'https://example.test/win.blockmap' },
    { name: 'tool-1.2.3-linux-x86_64.AppImage', url: 'https://example.test/linux.AppImage' },
    { name: 'tool-1.2.3-linux-amd64.deb', url: 'https://example.test/linux.deb' },
    { name: 'latest-mac.yml', url: 'https://example.test/latest-mac.yml' },
  ]

  it('takes the installer this machine can run, on each of the three platforms', () => {
    expect(pickDownloadAsset(assets, 'darwin', 'arm64')?.url).toBe('https://example.test/mac.dmg')
    expect(pickDownloadAsset(assets, 'win32', 'x64')?.url).toBe('https://example.test/win-x64.exe')
    expect(pickDownloadAsset(assets, 'win32', 'arm64')?.url).toBe('https://example.test/win-arm64.exe')
    // electron-builder names the AppImage x86_64, not x64.
    const linux = pickDownloadAsset(assets, 'linux', 'x64')
    expect(linux?.url).toBe('https://example.test/linux.AppImage')
    // The .deb is the package manager's, and a blockmap is not an installer.
    expect(linux?.name.endsWith('.deb')).toBe(false)
    expect(pickDownloadAsset(assets, 'win32', 'x64')?.name.endsWith('.blockmap')).toBe(false)
  })

  it('is undefined when nothing matches, and takes a lone file that names no architecture', () => {
    expect(pickDownloadAsset([], 'darwin', 'arm64')).toBeUndefined()
    expect(pickDownloadAsset(assets, 'aix', 'x64')).toBeUndefined()
    const one = [{ name: 'tool.dmg', url: 'https://example.test/only.dmg' }]
    expect(pickDownloadAsset(one, 'darwin', 'arm64')?.url).toBe('https://example.test/only.dmg')
  })

  it('refuses to hand over a file built for somebody else, or to guess between two', () => {
    // The release carries one AppImage and it is x86_64. Handing it to an arm64
    // machine because it is the only file on the shelf gives that user a binary
    // that will not run; the release page is the honest answer.
    expect(pickDownloadAsset(assets, 'linux', 'arm64')).toBeUndefined()
    expect(pickDownloadAsset(assets, 'darwin', 'x64')).toBeUndefined()
    // Two files, neither of them named for this machine: the release page and a
    // human beat a rule guessing wrong.
    const two = [
      { name: 'a.dmg', url: 'https://example.test/a.dmg' },
      { name: 'b.dmg', url: 'https://example.test/b.dmg' },
    ]
    expect(pickDownloadAsset(two, 'darwin', 'arm64')).toBeUndefined()
  })
})

describe('readRelease', () => {
  const payload = {
    tag_name: 'v1.2.3',
    html_url: 'https://github.com/o/r/releases/tag/v1.2.3',
    assets: [{ name: 'tool-1.2.3-mac-arm64.dmg', browser_download_url: 'https://example.test/mac.dmg' }],
  }

  it('reads the version without its v and the installer for this machine, or the page instead', () => {
    expect(readRelease(payload, 'darwin', 'arm64')).toEqual({
      version: '1.2.3',
      pageUrl: 'https://github.com/o/r/releases/tag/v1.2.3',
      downloadUrl: 'https://example.test/mac.dmg',
    })
    // No asset fits, or there are none at all: the release page still works.
    expect(readRelease(payload, 'win32', 'x64')?.downloadUrl)
      .toBe('https://github.com/o/r/releases/tag/v1.2.3')
    expect(readRelease({ ...payload, assets: undefined }, 'darwin', 'arm64')?.downloadUrl)
      .toBe('https://github.com/o/r/releases/tag/v1.2.3')
  })

  // This is the one JSON document in the app that comes off the network, and
  // the URL it yields is about to be opened in the user's browser.
  it('is undefined for anything that is not a release', () => {
    for (const bad of [
      undefined, null, 'ok', 42, {},
      { tag_name: 'v1.2.3' },
      { tag_name: 'nightly', html_url: 'https://github.com/o/r' },
      { message: 'API rate limit exceeded' },
    ]) {
      expect(readRelease(bad, 'darwin', 'arm64')).toBeUndefined()
    }
  })

  it('refuses a page URL that is not https, and drops an asset URL that is not', () => {
    expect(readRelease({ ...payload, html_url: 'javascript:alert(1)' }, 'darwin', 'arm64'))
      .toBeUndefined()
    const poisoned = {
      ...payload,
      assets: [{ name: 'tool-mac-arm64.dmg', browser_download_url: 'file:///etc/passwd' }],
    }
    expect(readRelease(poisoned, 'darwin', 'arm64')?.downloadUrl).toBe(payload.html_url)
  })
})

describe('readUpdateSettings', () => {
  it('checks by default, whatever the file says, and turns off only on an explicit false', () => {
    for (const stored of [undefined, null, {}, 'nonsense', { checkAutomatically: 'yes' }]) {
      expect(readUpdateSettings(stored)).toEqual(DEFAULT_UPDATE_SETTINGS)
    }
    expect(readUpdateSettings({ checkAutomatically: false }).checkAutomatically).toBe(false)
  })

  it('follows the stable channel unless the file says beta, in that one word', () => {
    expect(readUpdateSettings({}).channel).toBe('stable')
    expect(readUpdateSettings({ channel: 'beta' }).channel).toBe('beta')
    for (const held of ['Beta', 'nightly', true, 1, '']) {
      expect(readUpdateSettings({ channel: held }).channel, String(held)).toBe('stable')
    }
  })

  it('remembers a skipped version', () => {
    expect(readUpdateSettings({ skippedVersion: '1.2.3' }).skippedVersion).toBe('1.2.3')
    expect(readUpdateSettings({ skippedVersion: '' }).skippedVersion).toBeUndefined()
    expect(readUpdateSettings({ skippedVersion: 7 }).skippedVersion).toBeUndefined()
  })
})

describe('readNewestRelease', () => {
  const release = (tag: string, over: Record<string, unknown> = {}) => ({
    tag_name: tag,
    html_url: `https://github.com/x/y/releases/tag/${tag}`,
    assets: [{ name: 'app-arm64.dmg', browser_download_url: `https://example.test/${tag}.dmg` }],
    ...over,
  })

  it('takes the newest by version, prerelease or not, and the stable above the beta it follows', () => {
    const any = [release('v1.3.0-beta.1', { prerelease: true }), release('v1.2.9')]
    expect(readNewestRelease(any, 'darwin', 'arm64')?.version).toBe('1.3.0-beta.1')
    // Nobody on a beta is stranded on it once the stable arrives.
    const both = [release('v1.3.0-beta.2', { prerelease: true }), release('v1.3.0')]
    expect(readNewestRelease(both, 'darwin', 'arm64')?.version).toBe('1.3.0')
    // The order the page lists them in says nothing.
    const shuffled = [release('v1.2.0'), release('v1.4.0'), release('v1.3.0')]
    expect(readNewestRelease(shuffled, 'darwin', 'arm64')?.version).toBe('1.4.0')
  })

  it('skips a draft or an entry that is not a release, and answers nothing for a non-list', () => {
    const list = [release('v9.0.0', { draft: true }), 'nonsense', null, release('not-a-version'), release('v1.1.0')]
    expect(readNewestRelease(list, 'darwin', 'arm64')?.version).toBe('1.1.0')
    expect(readNewestRelease({ message: 'rate limited' }, 'darwin', 'arm64')).toBeUndefined()
    expect(readNewestRelease([release('v2.0.0', { draft: true })], 'darwin', 'arm64')).toBeUndefined()
    expect(readNewestRelease([], 'darwin', 'arm64')).toBeUndefined()
  })
})

describe('updateAvailable', () => {
  const release = { version: '1.2.3', pageUrl: 'https://x.test', downloadUrl: 'https://x.test/a.dmg' }

  it('is true only for a newer version nobody skipped, and a skip is of one version', () => {
    expect(updateAvailable(release, '1.2.2', {})).toBe(true)
    expect(updateAvailable(release, '1.2.3', {})).toBe(false)
    expect(updateAvailable(release, '1.2.2', { skippedVersion: '1.2.3' })).toBe(false)
    // Skipping 1.2.3 does not skip everything after it.
    expect(updateAvailable({ ...release, version: '1.3.0' }, '1.2.2', { skippedVersion: '1.2.3' }))
      .toBe(true)
    expect(updateAvailable(undefined, '1.2.2', {})).toBe(false)
  })
})

describe('shouldCheckForUpdates', () => {
  it('checks in a packaged app, and in nothing else', () => {
    expect(shouldCheckForUpdates(true, [], {})).toBe(true)
    expect(shouldCheckForUpdates(false, [], {})).toBe(false)
    // A dialog in front of the window the smoke is photographing.
    expect(shouldCheckForUpdates(true, ['electron', '.', '--smoke'], {})).toBe(false)
    expect(shouldCheckForUpdates(true, [], { LVARCH_NO_UPDATE: '1' })).toBe(false)
  })

  // Otherwise the only way to see the dialog is to cut a release.
  it('checks in a dev run when asked to', () => {
    expect(shouldCheckForUpdates(false, [], { LVARCH_UPDATE_CHECK: '1' })).toBe(true)
  })

  it('still refuses under --smoke, and still refuses to phone home', () => {
    expect(shouldCheckForUpdates(false, ['--smoke'], { LVARCH_UPDATE_CHECK: '1' })).toBe(false)
    expect(shouldCheckForUpdates(false, [], { LVARCH_UPDATE_CHECK: '1', LVARCH_NO_UPDATE: '1' }))
      .toBe(false)
  })
})

/**
 * Whether the app OFFERS a check at all: the menu item, and the switch.
 *
 * Narrower than `shouldCheckForUpdates`, and the difference is the point. A dev
 * run and a smoke run do not check by THEMSELVES, and checking by hand is worth
 * keeping in both — it is the only way to look at the feature without cutting a
 * release, and a manual check that still works is what an off switch is for.
 */
describe('offersUpdateCheck', () => {
  it('offers one anywhere updates are this build\u2019s business', () => {
    expect(offersUpdateCheck({})).toBe(true)
    // A dev run, a smoke run: neither checks by itself, both may be asked.
    expect(offersUpdateCheck({ LVARCH_UPDATE_CHECK: '1' })).toBe(true)
  })

  /**
   * And none where they are not: a machine that must not phone home, or a build
   * composed from this one that keeps its own updates — where this app's release
   * page is not where its versions come from.
   */
  it('offers none where updates are not this build\u2019s to check', () => {
    expect(offersUpdateCheck({ LVARCH_NO_UPDATE: '1' })).toBe(false)
    expect(offersUpdateCheck({ LVARCH_NO_UPDATE: '1', LVARCH_UPDATE_CHECK: '1' })).toBe(false)
  })
})

describe('updateSettingsFor', () => {
  it('answers what is kept where this build checks', () => {
    const kept = { checkAutomatically: true, channel: 'beta' as const }
    expect(updateSettingsFor(kept, true)).toBe(kept)
  })

  /**
   * And says off where it does not, whatever the file remembers: *check
   * automatically* ticked in a process that asks nobody anything is a switch with
   * no engine behind it. What is on disk is left alone — it is the answer for a
   * build that does check.
   */
  it('says off where this build checks nothing, and leaves the channel alone', () => {
    expect(updateSettingsFor({ checkAutomatically: true, channel: 'beta' }, false))
      .toEqual({ checkAutomatically: false, channel: 'beta' })
    expect(updateSettingsFor(DEFAULT_UPDATE_SETTINGS, false).checkAutomatically).toBe(false)
  })
})
