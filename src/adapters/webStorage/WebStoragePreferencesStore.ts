/**
 * Preferences in the browser's storage.
 *
 * Its own key, alongside the document's: preferences belong to this browser and
 * not to this design, so they must not disappear along with it when somebody
 * picks "shipped document" and the document key is cleared.
 */
import type { PreferencesStore } from '../../ports/PreferencesStore'
import type { KeyValueStorage } from './KeyValueStorage'

export const PREFERENCES_KEY = 'lvarch.preferences'

export class WebStoragePreferencesStore implements PreferencesStore {
  readonly id = 'browser-storage'

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string = PREFERENCES_KEY,
  ) {}

  read(): Promise<unknown> {
    try {
      const raw = this.storage.getItem(this.key)
      if (!raw) return Promise.resolve(undefined)
      const parsed: unknown = JSON.parse(raw)
      return Promise.resolve(parsed && typeof parsed === 'object' ? parsed : undefined)
    } catch {
      // Half-written or hand-edited JSON: the defaults are a fine answer, an
      // empty editor is not.
      return Promise.resolve(undefined)
    }
  }

  write(preferences: Record<string, unknown>): Promise<void> {
    try {
      this.storage.setItem(this.key, JSON.stringify(preferences))
      return Promise.resolve()
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)))
    }
  }
}
