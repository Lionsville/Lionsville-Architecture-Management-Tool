// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The message a snapshot gets, drafted from what was actually done.
 *
 * This is what the command log from ADR-0002 buys that nothing else could: a
 * history whose lines say something. "Update project" forty times is a history
 * nobody goes back to.
 */
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { translator } from '../i18n'
import type { StepSummary } from '../model/activity'
import { draftCommitMessage, draftCommitMessageInEnglish, translateFrom } from './commitMessage'

const t = translator('en')

const step = (key: StepSummary['key'], over: Partial<StepSummary> = {}): StepSummary =>
  ({ key, ...over })

describe('draftCommitMessage', () => {
  it('says nothing when nothing was done', () => {
    // Whether that is "no changes" or "the first snapshot" is the caller's to
    // know; this only reports what the log holds.
    expect(draftCommitMessage([], t)).toBe('')
  })

  it('is one line when it fits on one line', () => {
    expect(draftCommitMessage([
      step('activity.elementChanged', { name: 'Warehouse Management' }),
      step('activity.movedMany', { count: 3 }),
    ], t)).toBe('Changed Warehouse Management, Moved 3 elements')
  })

  it('names the first few and counts the rest, then lists them all', () => {
    const message = draftCommitMessage([
      step('activity.elementAdded', { name: 'Crews' }),
      step('activity.elementAdded', { name: 'Planning' }),
      step('activity.relationAdded'),
      step('activity.decisionAdded', { name: 'One writer' }),
    ], t)

    const [subject, blank, ...body] = message.split('\n')
    expect(subject).toBe('Added Crews, Added Planning, Drew a connection and 1 more')
    expect(blank).toBe('')
    expect(body.filter(Boolean)).toEqual([
      '- Added Crews',
      '- Added Planning',
      '- Drew a connection',
      '- Added the decision One writer',
    ])
  })

  it('says an afternoon of dragging once', () => {
    const dragging = Array.from({ length: 12 }, () => step('activity.movedOne'))
    expect(draftCommitMessage(dragging, t)).toBe('Moved one element')
  })

  it('keeps two runs of the same thing apart when something happened between', () => {
    // Collapsing them would be a message that disagrees with the history it
    // describes: move, rename, move is three things.
    const message = draftCommitMessage([
      step('activity.movedOne'),
      step('activity.elementChanged', { name: 'Crews' }),
      step('activity.movedOne'),
    ], t)
    expect(message).toBe('Moved one element, Changed Crews, Moved one element')
  })

  it('keeps the subject short enough to read in a log', () => {
    const long = Array.from({ length: 3 }, (_, i) =>
      step('activity.elementAdded', { name: `An application with a rather long name ${i}` }))
    const subject = draftCommitMessage(long, t).split('\n')[0]

    expect(subject.length).toBeLessThanOrEqual(72)
    expect(subject.endsWith('…')).toBe(true)
  })

  it('still lists everything in the body when the subject had to be cut', () => {
    const long = Array.from({ length: 3 }, (_, i) =>
      step('activity.elementAdded', { name: `An application with a rather long name ${i}` }))
    expect(draftCommitMessage(long, t)).toContain('- Added An application with a rather long name 2')
  })

  it('speaks the reader’s language', () => {
    expect(draftCommitMessage([step('activity.movedMany', { count: 3 })], translator('nl')))
      .toBe('3 elementen verplaatst')
  })
})

/**
 * Drafting without the registry — for a build composed from this one that runs
 * the reducer and the folder format in a node process, has no screen, and still
 * wants its snapshots to say something.
 */
describe('drafting with a table rather than the registry', () => {
  const steps = [
    step('activity.elementAdded', { name: 'Crews' }),
    step('activity.rowAdded', { typeKey: 'relation.uses' }),
    step('activity.movedMany', { count: 3 }),
    step('activity.decisionAdded', { name: 'One writer' }),
  ]

  /**
   * The same words, so the two cannot drift: what the English drafter says is
   * what the app says in English, and a key added to either slice is carried by
   * both because the drafter takes the slices whole.
   */
  it('says exactly what the registry’s English says', () => {
    expect(draftCommitMessageInEnglish(steps)).toBe(draftCommitMessage(steps, translator('en')))
    expect(draftCommitMessageInEnglish(steps).split('\n')[0])
      .toBe('Added Crews, Drew a row (Uses), Moved 3 elements and 1 more')
  })

  it('takes a table of its own, in whatever language it is in', () => {
    const t = translateFrom({ 'activity.movedMany': '{count} elementen verplaatst' })
    expect(draftCommitMessage([step('activity.movedMany', { count: 3 })], t)).toBe('3 elementen verplaatst')
  })

  /** A missing word is a blemish in a subject line, never a snapshot refused. */
  it('answers a key it was given no word for with the key', () => {
    expect(draftCommitMessage([step('activity.movedOne')], translateFrom({})))
      .toBe('activity.movedOne')
  })

  /**
   * And the point of all three: the imports this file's subject reaches must not
   * include `app/`.
   *
   * `i18n/strings.ts` is the registry, and a registry composes: importing it
   * imports every module's slice, `app/strings` and `editor/strings` among them.
   * A node process that asked it for a translator would load the whole shell's
   * vocabulary to write one commit subject — and the day something in `app/`
   * grows an import that needs a browser, that process stops starting. So the
   * graph is walked here rather than reasoned about: the static imports a
   * compiler keeps, followed from `commitMessage.ts`, reaching neither `app/`
   * nor the registry.
   */
  it('reaches neither app/ nor the string registry', async () => {
    const reached = await imported(resolve(import.meta.dirname, 'commitMessage.ts'))
    const paths = reached.map((file) => relative(resolve(import.meta.dirname, '..'), file))

    expect(paths.filter((path) => path.startsWith('app/'))).toEqual([])
    expect(paths.filter((path) => path.startsWith('editor/'))).toEqual([])
    expect(paths).not.toContain('i18n/strings.ts')
    expect(paths).not.toContain('i18n/strings.en.ts')
    // What it does reach: the two slices, and the placeholders.
    expect(paths).toContain('model/strings/en.ts')
    expect(paths).toContain('projects/strings/en.ts')
    expect(paths).toContain('i18n/interpolate.ts')
    // The words it is about are a type, and a type is not an import.
    expect(paths).not.toContain('model/activity.ts')
  })
})

/** Where a `from '…'` in this repository's own tree resolves to, if anywhere. */
async function fileFor(from: string, specifier: string): Promise<string | undefined> {
  if (!specifier.startsWith('.')) return undefined
  const at = resolve(dirname(from), specifier)
  for (const candidate of [at, `${at}.ts`, `${at}.tsx`, join(at, 'index.ts'), join(at, 'index.tsx')]) {
    if (await readFile(candidate, 'utf8').then(() => true, () => false)) return candidate
  }
  // A path-looking string that is not a module: a docblock naming a file.
  return undefined
}

/**
 * Every file in this tree a static import chain from `entry` reaches, `entry`
 * included.
 *
 * `import type` is struck out first, because the compiler strikes it out too — a
 * type crossing a module boundary costs nothing at run time, which is the whole
 * reason a pure module may name another module's shapes. What is left is read as
 * imports, and anything that is not a relative path in this tree (`node:`, a
 * package) is somebody else's business.
 */
async function imported(entry: string): Promise<string[]> {
  const found = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()!
    if (found.has(file)) continue
    found.add(file)
    const source = (await readFile(file, 'utf8')).replace(/\b(?:import|export)\s+type\b[\s\S]*?from\s+'[^']*'/g, '')
    for (const match of source.matchAll(/from\s+'([^']+)'|^\s*import\s+'([^']+)'/gm)) {
      const next = await fileFor(file, match[1] ?? match[2])
      if (next) queue.push(next)
    }
  }
  return [...found]
}
