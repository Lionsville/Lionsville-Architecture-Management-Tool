// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A link a record carries: only one a browser opens as a page, and never one
 * that runs as script when somebody else's working file is opened.
 */
import { describe, expect, it } from 'vitest'
import { isLinkList, isSafeLinkUrl, normaliseLinks } from './links'

describe('the links of a record', () => {
  it('takes a web address, and nothing that would run or is not an address at all', () => {
    expect(isSafeLinkUrl('https://example.org/wiki')).toBe(true)
    expect(isSafeLinkUrl(' http://example.org ')).toBe(true)
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeLinkUrl('data:text/html,<script>1</script>')).toBe(false)
    expect(isSafeLinkUrl('not an address')).toBe(false)
  })

  it('trims what it keeps, drops what it may not open, and labels an unlabelled one with its address', () => {
    expect(normaliseLinks([
      { label: '  Wiki ', url: ' https://example.org/wiki ' },
      { label: 'Run me', url: 'javascript:alert(1)' },
      { label: '   ', url: 'https://example.org/runbook' },
    ])).toEqual([
      { label: 'Wiki', url: 'https://example.org/wiki' },
      { label: 'https://example.org/runbook', url: 'https://example.org/runbook' },
    ])
    expect(normaliseLinks(undefined)).toEqual([])
  })

  it('reads back as links only a list of labels and addresses', () => {
    expect(isLinkList([{ label: 'Wiki', url: 'https://example.org' }])).toBe(true)
    expect(isLinkList([{ label: 'Wiki' }])).toBe(false)
    expect(isLinkList('https://example.org')).toBe(false)
  })
})
