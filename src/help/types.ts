// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The shapes of the help: what it holds with no words in it (the outline), and
 * the words, one set per language.
 */
import type { Language } from '../i18n/languages'

/** Where a function is offered when it is not everywhere. */
export type HelpAvailability = 'desktop' | 'web' | 'hosted'

/** One section: one function of the product. */
export type HelpSectionOutline = {
  /** The function's id, which is also the section's address: `help/#<id>`. */
  readonly id: string
  /** The controls it is about, by their `data-guide` name (`platform/controlNames.ts`). */
  readonly controls?: readonly string[]
  /** The menu items it answers for, by their label (`platform/menu.ts`). */
  readonly menu?: readonly string[]
  /** Offered only here; everywhere when absent. */
  readonly on?: HelpAvailability
  /** It changes the work, so a reader who may only read does not see it. */
  readonly writes?: true
  readonly seeAlso?: readonly string[]
}

export type HelpChapterOutline = {
  /** The chapter's address: `help/#<id>`. Plain words, so it never meets a section's. */
  readonly id: string
  readonly sections: readonly HelpSectionOutline[]
}

/**
 * A section's words: its name, what it does, where to find it, the steps, an
 * example from the example organisation, and the keys where it has them.
 */
export type SectionText = readonly [
  name: string, what: string, where: string, steps: readonly string[], example: string, keys?: string,
]

export type SectionTexts = Readonly<Record<string, SectionText>>

/** A chapter's own words: its title, a line to say what it is about, and one worked example. */
export type ChapterText = {
  readonly title: string
  readonly intro: string
  readonly worked?: { readonly title: string; readonly steps: readonly string[] }
  /** What its picture shows, said for a reader who cannot see it. */
  readonly picture?: string
}

/** How something works, in the manual's words: a title and Markdown under it. */
export type Background = { readonly title: string; readonly text: string }

export type Backgrounds = Readonly<Record<string, readonly Background[]>>

/** Everything the help says in one language. */
export type HelpText = {
  readonly chapters: Readonly<Record<string, ChapterText>>
  readonly sections: SectionTexts
  readonly background: Backgrounds
}

/** What a build composed from this one adds to the help: chapters of its own, after core's. */
export type HelpContribution = {
  readonly chapters: readonly HelpChapterOutline[]
  /** Its words, fetched when the help opens in that language. */
  readonly text: (language: Language) => Promise<HelpText>
}
