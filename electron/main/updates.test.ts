// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The update feed, driven through main's own file with Electron and
 * electron-updater stood in for.
 *
 * The decisions are `src/platform/updates.ts`'s and are tested there; this is
 * the wiring between them: that a feed is registered once and only before the
 * start, that a yes downloads and a second yes restarts, and that every way the
 * in-place route cannot be taken ends at the download page rather than
 * nowhere. The file keeps its state in module variables, so every case imports
 * a fresh copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'

const electron = vi.hoisted(() => ({
  app: {
    isPackaged: true,
    getVersion: () => '1.0.0',
    getName: () => 'Lionsville Architect',
    getPath: (): string => '',
    on: vi.fn(),
    quit: vi.fn(),
  },
  BrowserWindow: { getAllWindows: () => [] },
  dialog: { showMessageBox: vi.fn() },
  ipcMain: { handle: vi.fn() },
  net: { fetch: vi.fn() },
  shell: { openExternal: vi.fn() },
}))

const updater = vi.hoisted(() => ({
  autoUpdater: {
    logger: undefined as unknown,
    autoDownload: true,
    autoInstallOnAppQuit: true,
    forceDevUpdateConfig: false,
    allowPrerelease: false,
    on: vi.fn(),
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}))

vi.mock('electron', () => electron)
vi.mock('electron-updater', () => updater)

const FEED = { url: 'https://downloads.example.test/latest/', page: 'https://example.test/download' }
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!

/** A fresh copy of the module, on the platform the case is about. */
async function updates(on: NodeJS.Platform = 'win32') {
  Object.defineProperty(process, 'platform', { value: on })
  vi.resetModules()
  return import('./updates')
}

/** The dialogs, answered in order; each answer keeps the automatic check on. */
function answer(...responses: number[]): void {
  for (const response of responses) {
    electron.dialog.showMessageBox.mockResolvedValueOnce({ response, checkboxChecked: true })
  }
}

/** What the dialogs said, one message per dialog. */
function said(): string[] {
  return electron.dialog.showMessageBox.mock.calls.map(([options]) => (options as { message: string }).message)
}

beforeEach(() => {
  vi.clearAllMocks()
  electron.app.getPath = () => tmpdir()
  vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  delete process.env['APPIMAGE']
})

afterEach(() => {
  Object.defineProperty(process, 'platform', platform)
  vi.restoreAllMocks()
})

describe('registerUpdateFeed', () => {
  it('takes one feed and refuses a second', async () => {
    const { registerUpdateFeed } = await updates()
    registerUpdateFeed(FEED)
    expect(() => registerUpdateFeed(FEED)).toThrow(/already registered/)
  })

  it('refuses a feed that is not https', async () => {
    const { registerUpdateFeed } = await updates()
    expect(() => registerUpdateFeed({ ...FEED, url: 'http://downloads.example.test/' })).toThrow()
  })

  it('refuses a feed registered after the updates started', async () => {
    const { registerUpdateFeed, startUpdates } = await updates()
    vi.stubEnv('LVARCH_NO_UPDATE', '1')
    startUpdates()
    vi.unstubAllEnvs()
    expect(() => registerUpdateFeed(FEED)).toThrow(/after the updates started/)
  })
})

describe('a check against the feed', () => {
  it('downloads on a yes and restarts on the second', async () => {
    const { registerUpdateFeed, checkForUpdatesNow } = await updates('win32')
    registerUpdateFeed(FEED)
    updater.autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.1.0' } })
    updater.autoUpdater.downloadUpdate.mockResolvedValue([])
    answer(0, 0)

    checkForUpdatesNow()

    await vi.waitFor(() => expect(updater.autoUpdater.quitAndInstall).toHaveBeenCalled())
    expect(updater.autoUpdater.setFeedURL).toHaveBeenCalledWith({ provider: 'generic', url: FEED.url })
    expect(updater.autoUpdater.autoDownload).toBe(false)
    expect(updater.autoUpdater.autoInstallOnAppQuit).toBe(true)
    expect(said()).toEqual(['Version 1.1.0 is available.', 'Version 1.1.0 is ready.'])
  })

  it('says so when there is nothing newer', async () => {
    const { registerUpdateFeed, checkForUpdatesNow } = await updates()
    registerUpdateFeed(FEED)
    updater.autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.0.0' } })
    answer(0)

    checkForUpdatesNow()

    await vi.waitFor(() => expect(said()).toEqual(['You are up to date.']))
  })

  it('hands over the page when the feed cannot be read', async () => {
    const { registerUpdateFeed, checkForUpdatesNow } = await updates()
    registerUpdateFeed(FEED)
    updater.autoUpdater.checkForUpdates.mockRejectedValue(new Error('ENOTFOUND'))
    answer(0)

    checkForUpdatesNow()

    await vi.waitFor(() => expect(electron.shell.openExternal).toHaveBeenCalledWith(FEED.page))
    expect(said()).toEqual(['The update feed could not be reached.'])
  })

  it('sends a copy that cannot replace itself to the page', async () => {
    const { registerUpdateFeed, checkForUpdatesNow } = await updates('linux')
    registerUpdateFeed(FEED)
    updater.autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.1.0' } })
    answer(0)

    checkForUpdatesNow()

    await vi.waitFor(() => expect(electron.shell.openExternal).toHaveBeenCalledWith(FEED.page))
    expect(updater.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
  })

  it('sends a failed download to the page, with nothing left for the quit', async () => {
    const { registerUpdateFeed, checkForUpdatesNow } = await updates('win32')
    registerUpdateFeed(FEED)
    updater.autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.1.0' } })
    updater.autoUpdater.downloadUpdate.mockRejectedValue(new Error('signature mismatch'))
    answer(0, 0)

    checkForUpdatesNow()

    await vi.waitFor(() => expect(electron.shell.openExternal).toHaveBeenCalledWith(FEED.page))
    expect(updater.autoUpdater.autoInstallOnAppQuit).toBe(false)
    expect(updater.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('skips a version when asked to', async () => {
    const { registerUpdateFeed, checkForUpdatesNow } = await updates('win32')
    registerUpdateFeed(FEED)
    updater.autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.1.0' } })
    answer(2)

    checkForUpdatesNow()

    await vi.waitFor(() => expect(said()).toEqual(['Version 1.1.0 is available.']))
    expect(updater.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
  })
})

describe('a check with no feed', () => {
  it('says the release page could not be reached', async () => {
    const { checkForUpdatesNow } = await updates()
    electron.net.fetch.mockResolvedValue({ ok: false, status: 503 })
    answer(0)

    checkForUpdatesNow()

    await vi.waitFor(() => expect(said()).toEqual(['The release page could not be reached.']))
  })
})
