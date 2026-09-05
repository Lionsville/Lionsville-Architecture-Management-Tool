/**
 * Where this user's preferences are kept.
 *
 * Deliberately a different seam from {@link ProjectStore}, and not out of
 * tidiness: they lead different lives. A project travels to another machine;
 * preferences belong to this screen. In phase 6 the project comes from disk
 * while preferences stay local — which only works if the two can be swapped
 * independently.
 *
 * What exactly is in the blob is not this layer's business. The package vets its
 * own part (`mergePreferences`), the shell reads language and theme out of it
 * (`core/preferences.ts`), and both ignore what they do not recognise. Hence
 * `unknown` rather than a strict type: an old store with a new field in it
 * should keep working.
 */
export interface PreferencesStore {
  readonly id: string

  /** The stored preferences, or `undefined` when there is nothing usable. */
  read(): Promise<unknown>

  /** Write the preferences out. Rejects on a full or blocked store. */
  write(preferences: Record<string, unknown>): Promise<void>
}
