// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope put back whole as an entry held it: the pictures that come back
 * where their bytes are kept, and nothing where there is nothing to read.
 * The whole of it over each implementation is the scope repository's suite;
 * the app's flow is `app/history/putBack.test.tsx`.
 */
import { describe, expect, it } from 'vitest'
import type { ScopeRepository } from '../ports/ScopeRepository'
import { putBackWhole } from './putBack'
import { emptyContent } from './scopeState'
import type { ScopeState } from './scopeState'

describe('putting a scope back whole', () => {
  it('leaves out, and counts, the pictures whose bytes are no longer kept', async () => {
    const picture = {
      name: 'map.png', mediaType: 'image/png', size: 3, width: 1, height: 1,
      contentAddress: `sha256:${'1'.repeat(64)}`,
    }
    const held = { ...picture, name: 'kept.png', contentAddress: `sha256:${'2'.repeat(64)}` }
    const then: ScopeState = { ...emptyContent('Acme'), images: [picture, held], id: 'acme', address: 'acme', revision: 'then' }
    const now: ScopeState = { ...emptyContent('Acme'), images: [held], id: 'acme', address: 'acme', revision: 'now', unreadable: ['part'] }
    const applied: unknown[] = []
    const scopes: Pick<ScopeRepository, 'state' | 'apply'> = {
      state: () => Promise.resolve(now),
      apply: (work) => {
        const { command } = work[0].steps[0]
        applied.push(command.type === 'scope.replace' ? command.content.images : undefined)
        return Promise.resolve(applied.length === 1 ? { refused: 'shell.imageBytesGone', scope: 'acme' } : { revisions: ['after'] })
      },
    }
    const history = { stateAt: () => Promise.resolve(then) }
    expect(await putBackWhole({ scopes, history }, 'acme', { id: 'e1', scope: 'acme' })).toEqual({ left: 1 })
    expect(applied).toEqual([[picture, held], [held]])
  })

  it('answers nothing where the entry is not there to be read', async () => {
    const scopes: Pick<ScopeRepository, 'state' | 'apply'> = {
      state: () => Promise.resolve(undefined), apply: () => Promise.reject(new Error('not asked')),
    }
    const history = { stateAt: () => Promise.resolve(undefined) }
    expect(await putBackWhole({ scopes, history }, 'acme', { id: 'e1', scope: 'acme' })).toBeUndefined()
  })
})
