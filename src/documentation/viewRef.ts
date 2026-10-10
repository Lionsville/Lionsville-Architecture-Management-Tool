// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How a document names a view: `view:<id>`, the way `image:` names a picture.
 *
 * The id is a view of the document's own scope. `view:<scope>/<id>` would be
 * a view of another scope, and a document does not show one — it is read as
 * a view that is not here.
 */
export const VIEW_REFERENCE = 'view:'

/** A picture source that names a view: its id, or a reference this scope does not show. */
export type ViewSource = { id: string } | { missing: true }

/**
 * The view a picture's source names, or `undefined` when the source is not a
 * `view:` reference at all. Read after undoing the percent-encoding a markdown
 * renderer applies, the same way a picture's name is read.
 */
export function viewOfSource(src: string | undefined): ViewSource | undefined {
  if (!src) return undefined
  const bare = src.startsWith('<') && src.endsWith('>') ? src.slice(1, -1) : src
  let target = bare
  try {
    target = decodeURIComponent(bare)
  } catch {
    // Not percent-encoding anybody wrote on purpose: read as it stands.
  }
  if (!target.startsWith(VIEW_REFERENCE)) return undefined
  const id = target.slice(VIEW_REFERENCE.length)
  if (!id || id.includes('/')) return { missing: true }
  return { id }
}
