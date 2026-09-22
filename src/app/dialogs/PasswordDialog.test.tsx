// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { renderShell } from '../testing/renderShell'
import { PasswordDialog } from './PasswordDialog'

afterEach(() => cleanup())

const s = translator('en')

describe('PasswordDialog', () => {
  it('asks twice when setting one, and offers Save only when the two agree', () => {
    const onConfirm = vi.fn()
    renderShell(<PasswordDialog open mode="set" onCancel={() => {}} onConfirm={onConfirm} s={s} />)
    const confirm = screen.getByTestId('password-confirm') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    fireEvent.change(screen.getByTestId('password'), { target: { value: 'correct horse' } })
    fireEvent.change(screen.getByTestId('password-repeat'), { target: { value: 'correct hors' } })
    expect(screen.getByText('The two do not match.')).toBeDefined()
    expect(confirm.disabled).toBe(true)

    fireEvent.change(screen.getByTestId('password-repeat'), { target: { value: 'correct horse' } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('correct horse')
  })

  it('asks once when opening, carries the last verdict under the field, and confirms on Enter', () => {
    const onConfirm = vi.fn()
    renderShell(<PasswordDialog
      open mode="enter" error="That is not the password this file was sealed under, or the file is damaged."
      onCancel={() => {}} onConfirm={onConfirm} s={s}
    />)
    expect(screen.queryByTestId('password-repeat')).toBeNull()
    expect(screen.getByText(/not the password/)).toBeDefined()
    fireEvent.change(screen.getByTestId('password'), { target: { value: 'correct horse' } })
    fireEvent.keyDown(screen.getByTestId('password'), { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('correct horse')
  })

  it('never confirms an empty password, and Enter on an empty field does nothing', () => {
    const onConfirm = vi.fn()
    renderShell(<PasswordDialog open mode="enter" onCancel={() => {}} onConfirm={onConfirm} s={s} />)
    fireEvent.keyDown(screen.getByTestId('password'), { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
    expect((screen.getByTestId('password-confirm') as HTMLButtonElement).disabled).toBe(true)
  })
})
