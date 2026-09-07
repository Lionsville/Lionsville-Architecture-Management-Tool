/**
 * The update settings, over the desktop's own small channel.
 *
 * Not over the file channel: `DesktopFiles` resolves every path inside a
 * folder the user granted, and `userData` is not one. It also would not be
 * enough — main keeps the settings in memory and starts or stops its timer
 * when they change, so a file written behind its back changes nothing until
 * the next launch. Hence a typed channel of its own (`DesktopSettings`).
 */
import type { UpdateSettings, UpdateSettingsPatch } from '../../platform/updateSettings'
import type { UpdateSettingsStore } from '../../ports/UpdateSettings'
import type { DesktopSettings } from './channel'

export class DesktopUpdateSettings implements UpdateSettingsStore {
  readonly id = 'desktop'

  constructor(private readonly channel: DesktopSettings) {}

  read(): Promise<UpdateSettings> {
    return this.channel.readUpdates()
  }

  write(patch: UpdateSettingsPatch): Promise<UpdateSettings> {
    return this.channel.writeUpdates(patch)
  }
}
