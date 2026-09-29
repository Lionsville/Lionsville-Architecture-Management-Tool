// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Settings, as a repository keeps them (ADR-0031 §1): the organisation's, a
 * scope's, and the person's own on this install.
 *
 * What is in them is not the repository's business. Each reader vets its own
 * part and ignores what it does not recognise, the way the preferences are
 * read (`ports/PreferencesStore.ts`) — so a setting a newer build wrote
 * survives an older build changing one of its own, and the repository keeps a
 * bag of plain values and nothing it would have to understand.
 *
 * **A write is a patch**, so two settings changed from two places never undo
 * each other: an object merges into the object it lands on, key by key and at
 * any depth; anything else — a text, a number, a list — replaces what was
 * there; and `null` takes a key out. `null` rather than `undefined`, because a
 * patch may travel as text, and a key whose value is `undefined` does not
 * survive being written down.
 */

/** One value a setting may hold. */
export type SettingValue = string | number | boolean | readonly SettingValue[] | Settings

/** A set of settings: plain values under keys. */
export type Settings = { readonly [key: string]: SettingValue }

/** A change to a set of settings: what to merge in, and `null` for what to take out. */
export type SettingsPatch = { readonly [key: string]: SettingValue | SettingsPatch | null }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The settings with the patch applied. Neither argument is changed. */
export function patchSettings(held: Settings, patch: SettingsPatch): Settings {
  const next: Record<string, SettingValue> = { ...held }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key]
      continue
    }
    const under = next[key]
    next[key] = isObject(value)
      ? patchSettings(isObject(under) ? under as Settings : {}, value as SettingsPatch)
      : structuredClone(value)
  }
  return next
}
