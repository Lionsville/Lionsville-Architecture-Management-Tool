import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UPDATE_SETTINGS,
  isNewerVersion,
  parseVersion,
  pickDownloadAsset,
  readRelease,
  readUpdateSettings,
  shouldCheckForUpdates,
  updateAvailable,
} from './updates'

describe('parseVersion', () => {
  it('accepts a tag with or without its v', () => {
    expect(parseVersion('v1.2.3')?.numbers).toEqual([1, 2, 3])
    expect(parseVersion('1.2.3')?.numbers).toEqual([1, 2, 3])
  })

  it('fills in missing segments', () => {
    expect(parseVersion('1.2')?.numbers).toEqual([1, 2, 0])
    expect(parseVersion('1')?.numbers).toEqual([1, 0, 0])
  })

  it('keeps the prerelease and drops the build metadata', () => {
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
  it('compares segment by segment, not as text', () => {
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true)
    expect(isNewerVersion('1.9.0', '1.10.0')).toBe(false)
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true)
  })

  it('is false for the same version', () => {
    expect(isNewerVersion('1.2.3', 'v1.2.3')).toBe(false)
  })

  it('prefers a release over its own prerelease', () => {
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

  it('takes the dmg on macOS', () => {
    expect(pickDownloadAsset(assets, 'darwin', 'arm64')?.url).toBe('https://example.test/mac.dmg')
  })

  it('takes the installer for this architecture on Windows', () => {
    expect(pickDownloadAsset(assets, 'win32', 'x64')?.url).toBe('https://example.test/win-x64.exe')
    expect(pickDownloadAsset(assets, 'win32', 'arm64')?.url).toBe('https://example.test/win-arm64.exe')
  })

  // electron-builder names the AppImage x86_64, not x64.
  it('knows the words Linux uses for an architecture', () => {
    expect(pickDownloadAsset(assets, 'linux', 'x64')?.url).toBe('https://example.test/linux.AppImage')
  })

  it('leaves the .deb to the package manager', () => {
    const deb = pickDownloadAsset(assets, 'linux', 'x64')
    expect(deb?.name.endsWith('.deb')).toBe(false)
  })

  it('does not offer a blockmap', () => {
    expect(pickDownloadAsset(assets, 'win32', 'x64')?.name.endsWith('.blockmap')).toBe(false)
  })

  it('is undefined when nothing matches', () => {
    expect(pickDownloadAsset([], 'darwin', 'arm64')).toBeUndefined()
    expect(pickDownloadAsset(assets, 'aix', 'x64')).toBeUndefined()
  })

  it('takes the only candidate when it names no architecture at all', () => {
    const one = [{ name: 'tool.dmg', url: 'https://example.test/only.dmg' }]
    expect(pickDownloadAsset(one, 'darwin', 'arm64')?.url).toBe('https://example.test/only.dmg')
  })

  // The release carries one AppImage and it is x86_64. Handing it to an arm64
  // machine because it is the only file on the shelf gives that user a binary
  // that will not run; the release page is the honest answer.
  it('refuses a lone candidate built for someone else', () => {
    expect(pickDownloadAsset(assets, 'linux', 'arm64')).toBeUndefined()
    expect(pickDownloadAsset(assets, 'darwin', 'x64')).toBeUndefined()
  })

  // Two files, neither of them named for this machine: the release page and a
  // human beat a rule guessing wrong.
  it('refuses to choose between two unlabelled candidates', () => {
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

  it('reads the version without its v, and the installer for this machine', () => {
    expect(readRelease(payload, 'darwin', 'arm64')).toEqual({
      version: '1.2.3',
      pageUrl: 'https://github.com/o/r/releases/tag/v1.2.3',
      downloadUrl: 'https://example.test/mac.dmg',
    })
  })

  it('falls back to the release page when no asset fits', () => {
    expect(readRelease(payload, 'win32', 'x64')?.downloadUrl)
      .toBe('https://github.com/o/r/releases/tag/v1.2.3')
  })

  it('survives a release with no assets at all', () => {
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

  it('refuses a page URL that is not https', () => {
    expect(readRelease({ ...payload, html_url: 'javascript:alert(1)' }, 'darwin', 'arm64'))
      .toBeUndefined()
  })

  it('drops an asset whose URL is not https rather than opening it', () => {
    const poisoned = {
      ...payload,
      assets: [{ name: 'tool-mac-arm64.dmg', browser_download_url: 'file:///etc/passwd' }],
    }
    expect(readRelease(poisoned, 'darwin', 'arm64')?.downloadUrl).toBe(payload.html_url)
  })
})

describe('readUpdateSettings', () => {
  it('checks by default, whatever the file says or fails to say', () => {
    for (const stored of [undefined, null, {}, 'nonsense', { checkAutomatically: 'yes' }]) {
      expect(readUpdateSettings(stored)).toEqual(DEFAULT_UPDATE_SETTINGS)
    }
  })

  it('only turns checking off on an explicit false', () => {
    expect(readUpdateSettings({ checkAutomatically: false }).checkAutomatically).toBe(false)
  })

  it('remembers a skipped version', () => {
    expect(readUpdateSettings({ skippedVersion: '1.2.3' }).skippedVersion).toBe('1.2.3')
    expect(readUpdateSettings({ skippedVersion: '' }).skippedVersion).toBeUndefined()
    expect(readUpdateSettings({ skippedVersion: 7 }).skippedVersion).toBeUndefined()
  })
})

describe('updateAvailable', () => {
  const release = { version: '1.2.3', pageUrl: 'https://x.test', downloadUrl: 'https://x.test/a.dmg' }

  it('is true for a newer version nobody has skipped', () => {
    expect(updateAvailable(release, '1.2.2', {})).toBe(true)
  })

  it('is false for the version already running', () => {
    expect(updateAvailable(release, '1.2.3', {})).toBe(false)
  })

  it('is false for a version the user skipped', () => {
    expect(updateAvailable(release, '1.2.2', { skippedVersion: '1.2.3' })).toBe(false)
  })

  it('skips one version, not every later one', () => {
    const later = { ...release, version: '1.3.0' }
    expect(updateAvailable(later, '1.2.2', { skippedVersion: '1.2.3' })).toBe(true)
  })

  it('is false when there was no release to read', () => {
    expect(updateAvailable(undefined, '1.2.2', {})).toBe(false)
  })
})

describe('shouldCheckForUpdates', () => {
  it('checks in a packaged app', () => {
    expect(shouldCheckForUpdates(true, [], {})).toBe(true)
  })

  it('does not check in a dev run', () => {
    expect(shouldCheckForUpdates(false, [], {})).toBe(false)
  })

  // A dialog in front of the window the smoke is photographing.
  it('does not check under --smoke', () => {
    expect(shouldCheckForUpdates(true, ['electron', '.', '--smoke'], {})).toBe(false)
  })

  it('does not check when the machine must not phone home', () => {
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
