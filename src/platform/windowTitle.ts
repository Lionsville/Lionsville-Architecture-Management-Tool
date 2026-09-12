/**
 * What the window is called.
 *
 * One sentence, written once, because two hosts show it: a browser tab in its
 * tab strip, and the desktop in its title bar — which on macOS is not drawn at
 * all and still names the window in Mission Control and the Window menu.
 *
 * **The scope first**, because that is what changes and what a person is
 * looking for when they have four windows open; the product last, because it is
 * the same in all four. The short name is used, for the reason it exists: a
 * title bar is a tight space (*Names, decided*).
 *
 * Pure, and forgiving: a tree nobody has named yet is the product on its own,
 * which is what the page says before anything is open.
 */

/** The short name, for menus, window titles and tight spaces. */
export const PRODUCT_NAME = 'Architecture Management Tool'

/**
 * `Warehouse — Acme Logistics — Architecture Management Tool`, with each part
 * left out when there is nothing to say.
 *
 * The organisation is the root scope's name (ADR-0012 §1) and the scope is the
 * one that is open; a scope with nothing above it says its own name once rather
 * than twice, which is the same rule the top bar follows.
 */
export function windowTitleFor(organisation: string, scope?: string): string {
  const parts = [scope?.trim(), organisation.trim(), PRODUCT_NAME]
    .filter((part): part is string => !!part)
  return [...new Set(parts)].join(' — ')
}
