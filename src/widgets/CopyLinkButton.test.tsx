// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CopyLinkButton } from './CopyLinkButton'

afterEach(() => cleanup())

describe('Copy link', () => {
  it('is a button that asks for the link', () => {
    const onCopy = vi.fn()
    render(<CopyLinkButton label="Copy link" onCopy={onCopy} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(onCopy).toHaveBeenCalledOnce()
  })
})
