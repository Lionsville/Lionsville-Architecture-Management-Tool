// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record's body cut at its headings, so it can be written one box a section,
 * and put back to the character: what is stored is still one markdown body, and
 * the source is one press away. A heading is a line of its own that a box does
 * not edit, so a person cannot fail the gate by renaming one by accident; the
 * source is where a heading is changed.
 *
 * Which line of the gate a section answers is read with the gate's own rule
 * (`sectionFor`'s shape in `adr.ts`), so the two cannot disagree.
 *
 * Pure.
 */
import type { Translate } from '../i18n'
import { adrGateSection, madrTemplate } from './adr'
import type { AdrGateItem } from './adr'

export type AdrSection = {
  /** The heading as written, `## Context`. Empty for what stands before the first. */
  readonly heading: string
  /** The heading's words. */
  readonly name: string
  /** Everything up to the next heading, its line ends included. */
  readonly text: string
}

const HEADING = /^(#{2,3})\s+(.*?)\s*#*\s*$/

/** Cut at every `##` and `###`; what `joinSections` makes of the answer is the body it was given. */
export function splitSections(body: string): readonly AdrSection[] {
  const out: { heading: string; name: string; text: string }[] = [{ heading: '', name: '', text: '' }]
  let fenced = false
  const lines = body.split(/(?<=\n)/)
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const found = fenced ? null : HEADING.exec(line.replace(/\r?\n$/, ''))
    if (found) out.push({ heading: line, name: found[2] ?? '', text: '' })
    else (out[out.length - 1] as { text: string }).text += line
  }
  return out[0]?.text === '' && out.length > 1 ? out.slice(1) : out
}

export function joinSections(sections: readonly AdrSection[]): string {
  return sections.map((one) => one.heading + one.text).join('')
}

/** A section's text with a person's words put in it: the file's blank lines round them, so a heading stays on its own line. */
export function withText(sections: readonly AdrSection[], index: number, text: string): readonly AdrSection[] {
  return sections.map((one, at) => {
    if (at !== index) return one
    if (!one.heading) return { ...one, text }
    return { ...one, text: at < sections.length - 1 ? `\n${text}\n\n` : `\n${text}\n` }
  })
}

/** What a box shows of a section: its text without the blank lines round it, which are only the file's. */
export function shownText(section: AdrSection): string {
  return section.text.replace(/^\s*\n/, '').trimEnd()
}

/** The template's own text under each of its headings: what is not yet writing, so a box starts empty over it. */
export function templateTexts(t: Translate): ReadonlyMap<string, string> {
  return new Map(splitSections(madrTemplate(t)).filter((one) => one.heading).map((one) => [one.name, shownText(one)]))
}

/**
 * What of a record has been written: sections holding nothing or only the
 * template's text are left out, since read as they stand they look like content.
 * A heading with only such sections under it goes with them.
 */
export function writtenBody(body: string, t: Translate): string {
  const template = templateTexts(t)
  const sections = splitSections(body)
  const kept = sections.filter((one) => {
    const text = shownText(one)
    return !one.heading || (text !== '' && template.get(one.name) !== text)
  })
  // The template's placeholder options under *Pros and Cons* are headings of their own, whose text is the template's too.
  const placeholder = new Set(splitSections(madrTemplate(t)).map((one) => shownText(one)))
  return joinSections(kept.filter((one) => !one.heading || !placeholder.has(shownText(one))))
}

/** Which section a line of the gate is answered in, or nothing where it is not answered in the text. */
export function sectionOfGate(sections: readonly AdrSection[], item: AdrGateItem): number | undefined {
  const index = sections.findIndex((one) => one.heading !== '' && adrGateSection(one.name) === item)
  return index < 0 ? undefined : index
}
