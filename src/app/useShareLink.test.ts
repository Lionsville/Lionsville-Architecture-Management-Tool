// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { readPlace } from '../agent/place'
import type { Screen } from '../agent/screen'
import { shareLinkOf } from './useShareLink'

const onDecision: Screen = {
  open: { path: 'acme/rail', name: 'Rail', view: { id: 'b1', name: 'Board', kind: 'layer7' } },
  page: { page: 'decisions', id: 'adr-2' },
}

describe('the link to a screen', () => {
  it('is the source’s address with the place as its fragment, the record on screen included', () => {
    const answer = shareLinkOf('https://work.example/', onDecision)
    expect(answer).toEqual({ link: 'https://work.example/#place?scope=acme%2Frail&page=decisions&id=adr-2' })
    if (!('link' in answer)) throw new Error('no link')
    expect(readPlace(new URL(answer.link).hash)).toEqual({ scope: 'acme/rail', page: 'decisions', id: 'adr-2' })
  })

  it('names a home, the organisation’s included', () => {
    expect(shareLinkOf('https://work.example/', { home: { path: '', name: 'Acme' } }))
      .toEqual({ link: 'https://work.example/#place?scope=&page=home' })
  })

  it('carries the observations page’s tab', () => {
    const screen: Screen = { open: { path: 'acme', name: 'Acme' }, page: { page: 'observations', id: 'ob-1', tab: 'analysis' } }
    expect(shareLinkOf('https://work.example/', screen))
      .toEqual({ link: 'https://work.example/#place?scope=acme&page=observations&id=ob-1&tab=analysis' })
  })

  it('is refused where the source has no address, whatever is on screen', () => {
    expect(shareLinkOf(undefined, onDecision)).toEqual({ refused: 'share.noAddress' })
    expect(shareLinkOf('', onDecision)).toEqual({ refused: 'share.noAddress' })
    expect(shareLinkOf(undefined, undefined)).toEqual({ refused: 'share.noAddress' })
  })

  it('is refused where the screen is not a place yet', () => {
    expect(shareLinkOf('https://work.example/', undefined)).toEqual({ refused: 'share.noPlace' })
    expect(shareLinkOf('https://work.example/', { open: { path: 'acme', name: 'Acme' } })).toEqual({ refused: 'share.noPlace' })
  })
})
