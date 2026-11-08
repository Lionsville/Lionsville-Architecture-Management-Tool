// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { BUSY_ORDINARY_MS, rowOneFolds, statusCalm } from './rowOneFolds'
import type { StatusTone } from '../../ports/ProviderParts'

const order = (tone: StatusTone, busyForMs = 0) => rowOneFolds(statusCalm(tone, busyForMs))
const CALM = ['status', 'agent', 'activity', 'help', 'size', 'forward']
const NOT_CALM = ['agent', 'activity', 'help', 'size', 'forward']

describe('row one’s fold order, by what the status word says', () => {
  it('folds a saved word first, to its mark, ahead of the Agent and Activity', () => {
    expect(order('saved')).toEqual(CALM)
  })

  it('folds a word that is only read first too: nothing is waiting', () => {
    expect(order('reading')).toEqual(CALM)
  })

  it('keeps an ordinary save calm, so typing does not make the row jump', () => {
    expect(order('busy', 0)).toEqual(CALM)
    expect(order('busy', BUSY_ORDINARY_MS - 1)).toEqual(CALM)
  })

  it('never folds work that has been on its way for longer than is ordinary', () => {
    expect(order('busy', BUSY_ORDINARY_MS)).toEqual(NOT_CALM)
  })

  it('never folds a word that says work is waiting', () => {
    expect(order('waiting')).toEqual(NOT_CALM)
  })

  it('never folds a word that says the work is offline', () => {
    expect(order('offline')).toEqual(NOT_CALM)
  })

  it('never folds a word that says there is a problem or a conflict', () => {
    expect(order('problem')).toEqual(NOT_CALM)
  })

  it('lets the Agent go before Activity, and Forward last, whatever the word', () => {
    for (const calm of [true, false]) {
      const folds = rowOneFolds(calm)
      expect(folds.indexOf('agent')).toBeLessThan(folds.indexOf('activity'))
      expect(folds.at(-1)).toBe('forward')
    }
  })
})
