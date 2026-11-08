// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help's chapters: core's, and those a build composed from this one adds.
 *
 * A build that adds functions of its own describes them in chapters of its
 * own, after core's, in the same shape and the same three languages
 * (`registerHelpChapters`, called by that build's help entry before
 * `bootHelp`). Core knows nothing of what they say; it reads them as it reads
 * its own, searches them and links to them by the same ids.
 */
import { fillKeys } from '../i18n/keyNames'
import type { Language } from '../i18n/languages'
import { CHAPTERS } from './outline'
import { loadCoreText } from './text/load'
import type { HelpChapterOutline, HelpContribution, HelpText } from './types'

const added: HelpContribution[] = []

/** Chapters a host adds. Ids that core uses already are refused: an address means one place. */
export function registerHelpChapters(contribution: HelpContribution): void {
  const taken = new Set(helpOutline().flatMap((chapter) => [chapter.id, ...chapter.sections.map((one) => one.id)]))
  for (const chapter of contribution.chapters) {
    for (const id of [chapter.id, ...chapter.sections.map((one) => one.id)]) {
      if (taken.has(id)) throw new Error(`the help already has a place called '${id}'`)
    }
  }
  added.push(contribution)
}

/** Every chapter, core's first. */
export function helpOutline(): readonly HelpChapterOutline[] {
  return [...CHAPTERS, ...added.flatMap((one) => one.chapters)]
}

/** Everything the help says in a language, every chapter's words together. */
export async function loadHelpText(language: Language): Promise<HelpText> {
  const parts = (await Promise.all([loadCoreText(language), ...added.map((one) => one.text(language))]))
    .map((part) => keysSaid(part, language))
  return {
    ...(parts[0].start ? { start: parts[0].start } : {}),
    chapters: Object.assign({}, ...parts.map((part) => part.chapters)),
    sections: Object.assign({}, ...parts.map((part) => part.sections)),
    background: Object.assign({}, ...parts.map((part) => part.background)),
  }
}

/** For a test: the help as core alone has it. */
/**
 * Every key the words name (`{key:Mod+K}`) said for this platform, once, as
 * the text arrives: what is searched is then what is read.
 */
function keysSaid<T>(value: T, language: Language): T {
  if (typeof value === 'string') return fillKeys(value, language) as T
  if (Array.isArray(value)) return value.map((item: unknown) => keysSaid(item, language)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, keysSaid(item, language)])) as T
  }
  return value
}

export function forgetHelpChapters(): void {
  added.length = 0
}
