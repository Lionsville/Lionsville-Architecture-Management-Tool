// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where our File menu goes among Electron's own.
 *
 * Pure, and a file of its own, for the same reason `src/platform/updates.ts` is
 * separate from `electron/main/updates.ts`: the decision is worth a test, and
 * an `electron` import is what would stop one running in node.
 */

/** Enough of a menu item to place one against. */
export type PlaceableItem = { readonly role?: string | undefined }

/** A slot in the menu bar: where to put ours, and what to do with what is there. */
export type FileMenuSlot = { readonly index: number; readonly replace: boolean }

/**
 * `role` as Electron hands it back, which is **lower case** — `filemenu`, not
 * the `fileMenu` the constructor took and the type union spells. Comparing
 * against the documented spelling finds nothing, silently, which is a
 * particularly quiet way for a menu to be wrong.
 */
const roleOf = (item: PlaceableItem): string => item.role?.toLowerCase() ?? ''

/**
 * Where our File menu belongs in `items`, and whether it takes the place of one
 * that is already there.
 *
 * Electron's default menu **already has a File menu** — `{ role: 'fileMenu' }`,
 * which on macOS holds nothing but Close Window. Inserting ours next to it is
 * what put two File menus in the bar, the second one a single orphaned item.
 * Ours ends with that same item, so it takes the slot rather than joining it.
 *
 * The fallback is the placement this had before: after the app menu on macOS,
 * first on the platforms that have none. It is for a default menu with no File
 * menu in it, which is not a shape Electron builds today but is one it is free
 * to start building.
 */
export function fileMenuSlot(
  items: readonly PlaceableItem[],
  platform: NodeJS.Platform,
): FileMenuSlot {
  const existing = items.findIndex((item) => roleOf(item) === 'filemenu')
  if (existing !== -1) return { index: existing, replace: true }
  return { index: platform === 'darwin' ? 1 : 0, replace: false }
}

/**
 * Where a menu of ours goes that Electron builds a default for as well — Edit
 * and Help. Over the default where there is one, for the reason File takes
 * its slot: two Edit menus is a bar with a wrong one in it. Where there is
 * none, at the end, which is where Help belongs and where Edit would be the
 * only thing left to place.
 */
export function replacingSlot(items: readonly PlaceableItem[], role: 'editmenu' | 'help'): FileMenuSlot {
  const existing = items.findIndex((item) => roleOf(item) === role)
  return existing !== -1 ? { index: existing, replace: true } : { index: items.length, replace: false }
}

/**
 * What the Help menu ends with.
 *
 * *Check for Updates…* is main's own item, in one place on every platform, and
 * it is there only where something answers it. **A build composed from this one
 * may keep its own updates**, and so does a development run, a smoke run and a
 * machine told not to phone home (`shouldCheckForUpdates`): in all of those the
 * item used to be drawn and used to call a check the process had already decided
 * not to make — which answers *You are up to date* about a question it did not
 * ask, or reaches a release page that is not this build's.
 *
 * The separator goes with it, which is the whole reason this is data rather than
 * a conditional at the end of the menu: a Help menu ending in a rule with
 * nothing under it is the shape that gets shipped.
 */
export type HelpTailEntry = { readonly kind: 'separator' } | { readonly kind: 'checkForUpdates' }

export function helpMenuTail(checksForUpdates: boolean): readonly HelpTailEntry[] {
  return checksForUpdates ? [{ kind: 'separator' }, { kind: 'checkForUpdates' }] : []
}
