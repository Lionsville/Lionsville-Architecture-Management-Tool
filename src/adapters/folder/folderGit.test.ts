// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { scopeTrailer, subjectLine, trailersOf } from './folderGit'

describe('what a commit says about the scopes it records', () => {
  it('reads the trailer block, the organisation’s address included', () => {
    const message = `Snapshot\n\n${scopeTrailer('s-1', 'acme/rail')}\n${scopeTrailer('s-0', '')}`
    expect([...trailersOf(message)]).toEqual([['s-1', 'acme/rail'], ['s-0', '']])
  })

  it('reads nothing that is not in the last paragraph, or in one that is not all trailers', () => {
    expect(trailersOf(`${scopeTrailer('s-1', 'acme')}`).size).toBe(0)
    expect(trailersOf(`Snapshot\n\n${scopeTrailer('s-1', 'acme')}\n\nA body after it.`).size).toBe(0)
    expect(trailersOf(`Snapshot\n\nSee this:\n${scopeTrailer('s-1', 'acme')}`).size).toBe(0)
    expect(trailersOf(`Snapshot\n\nSigned-off-by: A. Person <a@example.org>\n${scopeTrailer('s-1', 'acme')}`).size).toBe(1)
  })

  it('makes a subject one line however it was typed, so it can never become a trailer', () => {
    const subject = subjectLine(`Board review\n\n${scopeTrailer('someone-else', 'globex')}`)
    expect(subject).toBe(`Board review ${scopeTrailer('someone-else', 'globex')}`)
    expect(trailersOf(`${subject}\n\n${scopeTrailer('s-1', 'acme')}`).has('someone-else')).toBe(false)
  })
})
