// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pictures a report prints, asked for when it is produced (ADR-0031 §3).
 *
 * **What it prints is what the renderer drew.** A report renders its documents
 * with `MarkdownView` — the component itself, not the one `renderMarkdown`
 * loads on first use, which draws nothing until its script arrives — inside
 * `CollectPictures` (`ui/PictureCollector.tsx`). Every picture the renderer
 * draws from a library is written down in a {@link DrawnPictures} as it is
 * drawn, with the scope whose library it is. The names come from the parse
 * that prints them, so a picture in a code block, or a name the library does
 * not hold, is not asked for, and one named twice in two spellings is one
 * picture; the same name in two scopes is two.
 *
 * **Rendered, then asked.** Pictures are written down while the render runs,
 * so once a render has returned — `renderToStaticMarkup`, or a root rendered
 * inside `flushSync` — the list is whole, and that is when a report calls
 * {@link picturesForReport}. It asks the source for each once, a few at a
 * time, and waits for every answer: a picture whose bytes are not there, or
 * whose ask failed or threw, is left out — the failure said where the caller
 * says — and the report prints its alt text.
 */
import { imageNameKey } from '../model/imageName'
import type { ImageEntry } from '../model/imageName'
import type { ImageSource, PictureBytes } from './pictureSource'

/** One picture a report drew: the scope whose library holds it, and its entry there. */
export type DrawnPicture = { scope: string; entry: ImageEntry }

/** The pictures a report's documents drew, in the order drawn, once each per scope by the library's rule for a name. */
export type DrawnPictures = {
  add(scope: string, entry: ImageEntry): void
  pictures(): readonly DrawnPicture[]
}

function keyOf(scope: string, entry: ImageEntry): string {
  return `${scope}\u0000${imageNameKey(entry.name)}`
}

export function drawnPictures(): DrawnPictures {
  const held = new Map<string, DrawnPicture>()
  return {
    add: (scope, entry) => {
      const key = keyOf(scope, entry)
      if (!held.has(key)) held.set(key, { scope, entry })
    },
    pictures: () => [...held.values()],
  }
}

export type ReportOptions = {
  /** How many asks are open at once; at least one. */
  limit?: number
  /** One ask that failed; the rest go on. */
  onFailure?: (error: unknown) => void
}

/** How many pictures a report asks for at once: enough to keep a source busy, few enough not to swamp it. */
export const REPORT_ASKS = 4

/** A picture a report prints: what was drawn, and its bytes. */
export type ReportPicture = DrawnPicture & { picture: PictureBytes }

/** The pictures whose bytes came, in the order drawn, and one of them by its scope and name. */
export type ReportPictures = {
  readonly pictures: readonly ReportPicture[]
  of(scope: string, name: string): PictureBytes | undefined
}

/** How many asks may be open: a whole number of at least one, the default where none is said. */
function lanesFor(limit: number | undefined, waiting: number): number {
  const most = limit === undefined || Number.isNaN(limit) ? REPORT_ASKS : Math.max(1, Math.floor(limit))
  return Math.max(1, Math.min(most, waiting))
}

/**
 * Every picture drawn, asked for now, once each, at most `limit` at a time.
 * An ask that throws before it answers is a failed ask like any other, and a
 * report is never refused for one: a failure the caller's handler throws on
 * is dropped, since there is nowhere else to say it.
 */
export async function picturesForReport(
  source: ImageSource,
  drawn: Iterable<DrawnPicture>,
  options: ReportOptions = {},
): Promise<ReportPictures> {
  const once = new Map<string, DrawnPicture>()
  for (const one of drawn) {
    const key = keyOf(one.scope, one.entry)
    if (!once.has(key)) once.set(key, one)
  }
  const order = [...once.values()]
  const answers: (PictureBytes | undefined)[] = new Array(order.length)
  let next = 0
  const failed = (error: unknown) => {
    try {
      options.onFailure?.(error)
    } catch {
      // The caller's own handler failed: the report goes on without it.
    }
  }
  const ask = async (): Promise<void> => {
    for (let at = next++; at < order.length; at = next++) {
      const { scope, entry } = order[at]
      try {
        answers[at] = await Promise.resolve().then(() => source.bytes(scope, entry.name))
      } catch (error) {
        failed(error)
      }
    }
  }
  await Promise.all(Array.from({ length: lanesFor(options.limit, order.length) }, ask))
  const pictures = order.flatMap((one, at) => {
    const picture = answers[at]
    return picture ? [{ ...one, picture }] : []
  })
  const byKey = new Map(pictures.map((one) => [keyOf(one.scope, one.entry), one.picture]))
  return {
    pictures,
    of: (scope, name) => byKey.get(`${scope}\u0000${imageNameKey(name)}`),
  }
}
