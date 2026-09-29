// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pictures a report prints, asked for when it is produced (ADR-0031 §3).
 *
 * **What it prints is what the renderer drew.** A report renders its documents
 * as a page does, inside `CollectPictures` (`ui/PictureCollector.tsx`), and
 * every picture the renderer draws from the library is written down in a
 * {@link DrawnPictures}. The names come from the parse that prints them, so a
 * picture in a code block, or a name the library does not hold, is not asked
 * for, and one named twice in two spellings is one picture.
 *
 * **Asked for then, and all of them.** {@link picturesForReport} asks the
 * source for each once, a few at a time, and waits for every answer: a
 * picture whose bytes are not there, or whose ask failed, is left out — the
 * failure said where the caller says — and the report prints its alt text.
 */
import { imageNameKey } from '../model/imageName'
import type { ImageEntry, ImageName } from '../model/imageName'
import type { ImageSource, PictureBytes } from './pictureSource'

/** The pictures a report's documents drew, once each by the library's rule for one name. */
export type DrawnPictures = {
  add(entry: ImageEntry): void
  entries(): readonly ImageEntry[]
}

export function drawnPictures(): DrawnPictures {
  const held = new Map<string, ImageEntry>()
  return {
    add: (entry) => {
      const key = imageNameKey(entry.name)
      if (!held.has(key)) held.set(key, entry)
    },
    entries: () => [...held.values()],
  }
}

export type ReportOptions = {
  /** How many asks are open at once. */
  limit?: number
  /** One ask that failed; the rest go on. */
  onFailure?: (error: unknown) => void
}

/** How many pictures a report asks for at once: enough to keep a source busy, few enough not to swamp it. */
export const REPORT_ASKS = 4

/**
 * Every picture drawn, asked for now, once each, at most `limit` at a time;
 * answered by the entry's name, with the pictures whose bytes came.
 */
export async function picturesForReport(
  source: ImageSource,
  scope: string,
  drawn: Iterable<ImageEntry>,
  options: ReportOptions = {},
): Promise<ReadonlyMap<ImageName, PictureBytes>> {
  const once = new Map<string, ImageEntry>()
  for (const entry of drawn) {
    const key = imageNameKey(entry.name)
    if (!once.has(key)) once.set(key, entry)
  }
  const waiting = [...once.values()]
  const found = new Map<ImageName, PictureBytes>()
  const ask = async (): Promise<void> => {
    for (let entry = waiting.shift(); entry; entry = waiting.shift()) {
      const [answer] = await Promise.allSettled([source.bytes(scope, entry.name)])
      if (answer.status === 'rejected') options.onFailure?.(answer.reason)
      else if (answer.value) found.set(entry.name, answer.value)
    }
  }
  const lanes = Math.max(1, Math.min(options.limit ?? REPORT_ASKS, waiting.length))
  await Promise.all(Array.from({ length: lanes }, ask))
  return found
}
