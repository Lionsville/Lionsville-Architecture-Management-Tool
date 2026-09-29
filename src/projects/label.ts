// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a label on a version is, wherever it is kept (ADR-0008; ADR-0031).
 *
 * A label is a person's word for a version — "Shown to the board" — and two
 * labels are the same label when the letters and digits that survive
 * {@link labelSlug} are the same. The rule is the domain's, not a source's,
 * because a label travels: a history carried from one source to another, in
 * a working file or a copy, arrives with its labels, and a label that was
 * unique where it was made must still be unique where it lands. So every
 * source compares labels by one rule, and the rule is narrow enough that any
 * source can keep a label under that name: letters, digits and single
 * hyphens are a name almost anything that keeps names accepts.
 */

/**
 * `done`, or one of the two ways a label is refused: the name is taken where
 * it would be kept (two labels whose slugs are one are one label, and a label
 * is never overwritten), or nothing of the label survives slugging. A value,
 * never an exception.
 */
export type LabelOutcome = 'done' | 'exists' | 'unnamed'

/**
 * What a label is compared by, and the name a source may keep it under:
 * letters and digits, lower case and without accents, joined by single
 * hyphens, with none leading or trailing. Empty when nothing survives.
 */
export function labelSlug(label: string): string {
  return String(label ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Whether a space is shaped as the identity of a scope, and nothing a person
 * would call a tag: a UUID, as a scope is given when it is made, or `f-` and
 * base-36 digits, as one is made from an address or an identity of another
 * shape. `release` and `v2` are not.
 */
export function isLabelSpace(space: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(space) || /^f-[0-9a-z]+$/.test(space)
}

/**
 * Whether a name is a label kept in one scope's own space — `<space>/<slug>`,
 * the space shaped as an identity ({@link isLabelSpace}), the slug as
 * {@link labelSlug} makes one. A name so shaped is that space's wherever it is
 * found, whether or not anything answers to the space now; `release/final`,
 * which a person may well have made, is not one.
 */
export function isSpacedLabel(name: string): boolean {
  const at = name.indexOf('/')
  return at > 0 && isLabelSpace(name.slice(0, at)) && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name.slice(at + 1))
}
