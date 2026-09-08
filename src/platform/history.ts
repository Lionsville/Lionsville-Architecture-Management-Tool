/**
 * What two processes agree on about a label on a snapshot (ADR-0008).
 *
 * A label is a person's word for a version — "Shown to the board" — kept as
 * an annotated tag on the desktop, so a colleague's git client shows the same
 * mark in the same place. The tag's NAME is a slug of the label, because a
 * ref name may not hold a space, a colon or most punctuation; the label
 * itself is the tag's message and is what the page shows.
 *
 * Here rather than in the adapter because both ends need the same slug: the
 * main process to make the tag, the renderer to say beforehand that two
 * labels would be one tag.
 */

/**
 * `done`, or one of the two ways a label is refused: the name is taken in
 * this folder (slugs collide, and a tag is not overwritten), or nothing of
 * the label survives slugging. A value, never an exception.
 */
export type LabelOutcome = 'done' | 'exists' | 'unnamed'

/**
 * The tag name for a label. Letters and digits, joined by single hyphens —
 * which satisfies every rule `git check-ref-format` has, since none of the
 * characters it refuses survive, and neither does a leading hyphen that git
 * would read as an option. Empty when nothing survives.
 */
export function labelSlug(label: string): string {
  return String(label ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
