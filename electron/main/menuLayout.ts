/**
 * Where our File menu goes among Electron's own.
 *
 * Pure, and a file of its own, for the same reason `src/app/updates.ts` is
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
