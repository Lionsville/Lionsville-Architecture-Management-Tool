/**
 * Is this browser's storage there, and does it work?
 *
 * Existing is not enough. In a private window, under strict policy, or inside an
 * embedded frame, `localStorage` can be present and still throw on the first
 * *write* — sometimes even on reading the property. Hence a real probe write,
 * and hence this being the only place in the shell that says the word.
 */
import type { KeyValueStorage } from './KeyValueStorage'

const PROBE = '__lvarch-probe__'

export function browserStorage(): KeyValueStorage | undefined {
  try {
    localStorage.setItem(PROBE, PROBE)
    localStorage.removeItem(PROBE)
    return {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
      // `Object.keys` rather than the `length` / `key(i)` loop: the loop
      // renumbers as you remove, which is exactly what a caller iterating in
      // order to delete would do.
      keys: () => Object.keys(localStorage),
    }
  } catch {
    return undefined
  }
}
