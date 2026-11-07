// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { attachmentMarkdown, attachmentOfHref, attachmentsUsedIn } from './attachments'

describe('the link to an attachment', () => {
  it('holds the name and an id, with what would end either made safe', () => {
    expect(attachmentMarkdown('a b', 'plan [v2].pdf')).toBe('[plan \\[v2\\].pdf](attachment:a%20b)')
    expect(attachmentOfHref('attachment:a%20b')).toBe('a b')
  })

  it('names nothing for any other address, or one that cannot be read', () => {
    expect(attachmentOfHref('https://example.org')).toBeUndefined()
    expect(attachmentOfHref('attachment:')).toBeUndefined()
    expect(attachmentOfHref('attachment:%E0%A4%A')).toBeUndefined()
    expect(attachmentOfHref(undefined)).toBeUndefined()
  })

  it('is found in a document, once each', () => {
    const text = '[a](attachment:one) and [b](attachment:two)\n\n[a again](attachment:one) ![pic](image:x.png) [web](https://x.org)'
    expect(attachmentsUsedIn(text)).toEqual(['one', 'two'])
  })
})
