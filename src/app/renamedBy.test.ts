// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { HistoryStep } from '../ports/ScopeSession'
import { transaction } from '../model/commands'
import { renamedBy } from './renamedBy'

const step = (over: Partial<HistoryStep> & Pick<HistoryStep, 'commands'>): HistoryStep => ({
  stepId: 's', folds: [], inverses: [], at: 0, summary: { key: 'activity.nothing' }, ...over,
} as HistoryStep)

describe('renamedBy', () => {
  it('names the author of the newest rename from elsewhere', () => {
    const history = [
      step({ commands: [{ type: 'element.update', id: 'a', patch: { name: 'One' } }], origin: 'remote', by: 'First Colleague' }),
      step({ commands: [transaction([{ type: 'element.update', id: 'a', patch: { name: 'Two' } }])], origin: 'remote', by: 'Second Colleague' }),
      step({ commands: [{ type: 'element.update', id: 'a', patch: { description: 'x' } }] }),
    ]
    expect(renamedBy(history, 'a')).toBe('Second Colleague')
  })

  it("names nobody where the newest rename is this keyboard's, or there is none", () => {
    expect(renamedBy([
      step({ commands: [{ type: 'element.update', id: 'a', patch: { name: 'One' } }], origin: 'remote', by: 'A Colleague' }),
      step({ commands: [{ type: 'element.update', id: 'a', patch: { name: 'Mine' } }] }),
    ], 'a')).toBeUndefined()
    expect(renamedBy([], 'a')).toBeUndefined()
  })
})
