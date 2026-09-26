// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A test fails when React complained while it ran.
 *
 * React says what is wrong with a tree through `console.error` and carries on:
 * a key two children share, an update outside `act()`, a prop the DOM does not
 * have, and — the one that hides best — an error a boundary caught and drew over.
 * Every one of those left its test green, because nothing asserts on the
 * console; this setup file (`vitest.config.ts`) is what does. It fails the test
 * that caused the complaint, in `afterEach`, with the sentence, and still lets
 * the console say it.
 *
 * Only the kinds below. React's own sentences, and since the suite was cleared
 * of them, the advice of the two libraries the tree is drawn with: MUI's (a
 * Tabs value no tab has, a Select value no option has) and Emotion's (a
 * selector server rendering would break). Those were let through once, as
 * advice rather than a broken tree, and most turned out to be faults all the
 * same — a tab strip pointing at nothing, a field showing a blank where the
 * address was, a box placed at NaN. The suite now says none of them, so a new
 * one is a regression rather than noise. MUI says some of it through
 * `console.warn`, so both are wrapped.
 * A test that means to provoke one spies on the console and silences it,
 * which replaces this wrapper for that test.
 */
import { afterEach, beforeEach } from 'vitest'

const COMPLAINTS: RegExp[] = [
  // Keys.
  /Each child in a list should have a unique "key" prop/,
  /Encountered two children with the same key/,
  // act().
  /not wrapped in act\(/,
  // A prop or attribute the DOM does not take, and markup HTML does not allow.
  /React does not recognize the `[^`]*` prop on a DOM element/,
  /Invalid DOM property `/,
  /Received `[^`]*` for a non-boolean attribute/,
  /Unknown event handler property `/,
  /In HTML, .* cannot be (a child|a descendant) of/,
  // An error a boundary caught: the screen showed a fallback and the test
  // went on reading what was left of it.
  /The above error occurred in the <[^>]+> component/,
  // A style React would not write: a NaN or an unparsable length.
  /is an invalid value for the `[^`]*` css style property/,
  // MUI's warnings, every one of them: each names a prop that does not fit.
  /^MUI: /,
  // Emotion's unsafe selector: `:first-child` and `:nth-child` count a style
  // tag server rendering puts beside the element.
  /The pseudo class "[^"]*" is potentially unsafe when doing server-side rendering/,
]

/** The sentence React logged, with its `%s` filled in the way the console would. */
export function consoleText(args: readonly unknown[]): string {
  const [first, ...rest] = args
  if (typeof first !== 'string') return args.map(String).join(' ')
  let at = 0
  const filled = first.replace(/%[sdoO]/g, () => (at < rest.length ? String(rest[at++]) : ''))
  return [filled, ...rest.slice(at).map((one) => (one instanceof Error ? one.message : String(one)))].join(' ')
}

/** Whether a line on the console is React, or a library drawing through it, saying the tree is wrong. */
export function isReactComplaint(text: string): boolean {
  return COMPLAINTS.some((one) => one.test(text))
}

const heard: string[] = []

// Once per file, before the file's own code runs, so a test that spies on the
// console — in a hook of any kind — wraps this rather than being replaced by it.
for (const level of ['error', 'warn'] as const) {
  const original = console[level]
  console[level] = (...args: unknown[]) => {
    const text = consoleText(args)
    if (isReactComplaint(text)) heard.push(text)
    original(...args)
  }
}

beforeEach(() => {
  heard.length = 0
})

afterEach(() => {
  if (!heard.length) return
  const said = heard.splice(0).map((text) => `  ${text.split('\n')[0]}`).join('\n')
  throw new Error(`React complained while this test ran:\n${said}`)
})
