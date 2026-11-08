// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Search within the help: every word typed must be in a place, and a place
 * whose name holds them comes before one whose text does. Folded for case and
 * accents, so *ubersicht* finds *Übersicht*.
 */
import { GETTING_STARTED } from './types'
import type { HelpChapterOutline, HelpText } from './types'

export type HelpHit = {
  /** Where it goes: a section's id, a chapter's, or a chapter's background topic (`<chapter>~<n>`). */
  readonly id: string
  readonly title: string
  /** The chapter it is in. */
  readonly chapter: string
  /** A few words around the first match in the text, for the list. */
  readonly excerpt: string
}

type Entry = { id: string; title: string; chapter: string; name: string; body: string; text: string }

export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** What a search reads: one entry per section, per chapter and per background topic. */
export function helpIndex(outline: readonly HelpChapterOutline[], text: HelpText): readonly Entry[] {
  const entries: Entry[] = []
  for (const [at, step] of (text.start?.steps ?? []).entries()) {
    const body = step.text.replace(/[*`_]/g, '')
    entries.push({ id: `${GETTING_STARTED}~${at}`, title: step.title, chapter: GETTING_STARTED, name: fold(step.title), body: fold(body), text: body })
  }
  for (const chapter of outline) {
    const words = text.chapters[chapter.id]
    if (words) {
      const body = [words.intro, words.worked?.title ?? '', ...(words.worked?.steps ?? [])].join(' ')
      entries.push({ id: chapter.id, title: words.title, chapter: chapter.id, name: fold(words.title), body: fold(body), text: body })
    }
    for (const section of chapter.sections) {
      const said = text.sections[section.id]
      if (!said) continue
      const [name, what, where, steps, example, keys] = said
      const body = [what, where, ...steps, example, keys ?? ''].join(' ')
      entries.push({ id: section.id, title: name, chapter: chapter.id, name: fold(name), body: fold(body), text: body })
    }
    for (const [at, topic] of (text.background[chapter.id] ?? []).entries()) {
      const body = topic.text.replace(/[*`_#|]/g, '')
      entries.push({ id: `${chapter.id}~${at}`, title: topic.title, chapter: chapter.id, name: fold(topic.title), body: fold(body), text: body })
    }
  }
  return entries
}

/** The places that hold every word asked for, those that name it first, at most `limit`. */
export function searchHelp(index: readonly Entry[], query: string, limit = 60): readonly HelpHit[] {
  const words = fold(query).split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return []
  const scored: { entry: Entry; score: number }[] = []
  for (const entry of index) {
    let score = 0
    let all = true
    for (const word of words) {
      if (entry.name.includes(word)) score += 10
      else if (entry.body.includes(word)) score += 1
      else { all = false; break }
    }
    if (all) scored.push({ entry, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(({ entry }) => ({
    id: entry.id, title: entry.title, chapter: entry.chapter, excerpt: excerptOf(entry, words[0]),
  }))
}

function excerptOf(entry: Entry, word: string): string {
  const at = entry.body.indexOf(word)
  if (at < 0) return entry.text.slice(0, 140)
  const start = Math.max(0, at - 50)
  return `${start > 0 ? '…' : ''}${entry.text.slice(start, start + 160).trim()}${start + 160 < entry.text.length ? '…' : ''}`
}
