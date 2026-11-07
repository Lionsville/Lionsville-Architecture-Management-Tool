// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import { statusWord } from './statusWord'
import type { StatusFacts } from './statusWord'

const s = translator('en')
const word = (facts: StatusFacts) => statusWord(facts, 'en', s)

describe('the status word', () => {
  it('never says sent while there is nobody to send to', () => {
    const steps = { publishesSteps: true, sourceStatus: true }
    expect(word({ ...steps, status: 'clean', connected: true }).text).toBe(s('shell.stepsSent'))
    expect(word({ ...steps, status: 'clean', connected: false }).text).toBe(s('frame.offline'))
    expect(word({ ...steps, status: 'dirty', connected: false })).toEqual({ text: s('frame.offlineWaiting'), alarm: true })
  })

  it('says a refused write first, whatever else is true', () => {
    expect(word({ status: 'clean', saveFailed: true, savedAt: new Date(), connected: false })).toEqual({ text: s('shell.saveRefused'), alarm: true })
  })

  it('keeps what a person has to act on ahead of being offline', () => {
    expect(word({ status: 'conflict', connected: false }).text).toBe(s('shell.conflict'))
    expect(word({ status: 'external-changed' }).alarm).toBe(true)
  })

  it('says the source’s word and never a save where changes travel as steps, and nothing where it has none', () => {
    expect(word({ publishesSteps: true, sourceStatus: true, status: 'saving' }).text).toBe(s('shell.stepsSending'))
    expect(word({ publishesSteps: true, sourceStatus: false, status: 'clean', savedAt: new Date() }).text).toBe('')
  })

  it('keeps a time for a document that is clean, and says not yet where there is none', () => {
    expect(word({ status: 'clean', savedAt: new Date('2026-11-07T10:23:00') }).text).toContain('10:23')
    expect(word({ status: 'clean', savedAt: null }).text).toBe(s('shell.notSaved'))
    expect(word({ status: 'dirty' }).text).toBe(s('shell.unsaved'))
  })

  it('says nothing is waiting where nothing is open', () => {
    expect(word({}).text).toBe(s('frame.nothingWaiting'))
  })
})
