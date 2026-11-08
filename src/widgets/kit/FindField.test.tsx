// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { translator } from '../../i18n'
import { LANGUAGE_CODES } from '../../i18n/languages'
import { FindField } from './FindField'

afterEach(() => cleanup())

function Held({ onOuterKey }: { onOuterKey?: () => void }) {
  const [value, setValue] = useState('')
  return <div onKeyDown={onOuterKey}><FindField label="Find a scope" value={value} onChange={setValue} /></div>
}

describe('FindField', () => {
  it('is a search box named by what it finds, the same words as its placeholder', async () => {
    renderShell(<Held />)
    const box = screen.getByRole('searchbox', { name: 'Find a scope' })
    expect(box.getAttribute('placeholder')).toBe('Find a scope')
    expect(await axeFindings()).toEqual([])
  })

  it('empties on Escape first, and leaves the key to the page once empty', () => {
    const outer = vi.fn()
    renderShell(<Held onOuterKey={outer} />)
    const box = screen.getByRole('searchbox') as HTMLInputElement
    fireEvent.change(box, { target: { value: 'retail' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(box.value).toBe('')
    expect(outer).not.toHaveBeenCalled()
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('keeps a width its words fit in wherever there is the room', () => {
    const css = readFileSync(join(process.cwd(), 'src/widgets/kit/FindField.css'), 'utf8')
    expect(css).toMatch(/min-width: min\(var\(--find-min\), 100%\)/)
  })
})

describe('what the find fields say', () => {
  // Every page's find field, in one pattern: *Find …* and its twins.
  const KEYS = [
    'frame.findScope', 'adr.searchPlaceholder', 'observation.findEvery', 'register.find', 'kit.filter.find', 'principles.search',
    'landscape.filter', 'c4.linesFilter', 'chart.findLabel', 'operating.findResponsibility', 'doc.filter', 'checks.findIn',
    'blocks.search', 'topics.search', 'library.search', 'logo.search', 'roadmap.find',
  ] as const
  const PATTERN: Record<string, RegExp> = { en: /^Find /, nl: /^Zoek /, de: / suchen$/ }

  it.each(LANGUAGE_CODES.map((code) => [code]))('says Find … in %s', (code) => {
    const s = translator(code)
    for (const key of KEYS) expect(s(key, { count: 3 }), key).toMatch(PATTERN[code]!)
  })
})
