/**
 * The message a snapshot gets, drafted from what was actually done.
 *
 * This is what the command log from ADR-0002 buys that nothing else could: a
 * history whose lines say something. "Update project" forty times is a history
 * nobody goes back to.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import type { StepSummary } from '../model/activity'
import { draftCommitMessage } from './commitMessage'

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
      step('activity.connectionAdded'),
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
