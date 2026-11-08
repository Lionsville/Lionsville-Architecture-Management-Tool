// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A document written and read beside each other: the written one is a field and
 * the read one the page, under a heading of its own, so the two that say the same
 * words do not look the same.
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import { MarkdownFlowBeside } from './MarkdownFlow'

afterEach(() => cleanup())

const both = (view: 'write' | 'side' | 'preview') => renderShell(
  <MarkdownFlowBeside view={view} writing={<textarea aria-label="Text" defaultValue="# Words" />} reading={<h2>Words</h2>} data-testid="read" />,
)

describe('MarkdownFlowBeside', () => {
  it('names the preview beside the text, and only there', async () => {
    both('side')
    expect(screen.getByTestId('read').textContent).toBe('PreviewWords')
    expect(await axeFindings()).toEqual([])
    cleanup()
    both('preview')
    expect(screen.getByTestId('read').textContent).toBe('Words')
    expect((document.querySelector('.md-beside__write') as HTMLElement).hidden).toBe(true)
    cleanup()
    both('write')
    expect(screen.queryByTestId('read')).toBeNull()
  })

  it('draws the written side as a field and the read side as the page past a rule', () => {
    const css = readFileSync('src/documentation/ui/MarkdownDocument.css', 'utf8')
    const rule = (selector: string) => css.slice(css.indexOf(`${selector} {`)).split('}')[0]
    expect(rule(".md-beside[data-view='side'] .md-beside__write")).toMatch(/border: 1px solid var\(--line-strong\)/)
    expect(rule(".md-beside[data-view='side'] .md-beside__write")).toMatch(/background: var\(--surface-raised\)/)
    expect(rule(".md-beside[data-view='side'] .md-beside__write:focus-within")).toMatch(/--focus-ring/)
    expect(rule(".md-beside[data-view='side'] .md-beside__read")).toMatch(/border-inline-start: 1px solid var\(--line\)/)
  })
})
