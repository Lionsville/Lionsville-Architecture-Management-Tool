// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** Who else is here: discs of initials, the rest counted, the names said in full. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Faces, initialsOf } from './Faces'

afterEach(() => cleanup())

describe('initials', () => {
  it('takes the first letter of the first and the last word', () => {
    expect(initialsOf('Anna de Vries')).toBe('AV')
    expect(initialsOf('bram')).toBe('B')
    expect(initialsOf('  (Éva) Kovács ')).toBe('ÉK')
    expect(initialsOf('')).toBe('?')
  })
})

describe('faces', () => {
  it('draws a disc per person up to three, and names them all', async () => {
    renderShell(<Faces names={['Anna de Vries', 'Bram Jansen']} label="Also here: Anna de Vries, Bram Jansen" testId="faces" />)
    const faces = screen.getByRole('img', { name: 'Also here: Anna de Vries, Bram Jansen' })
    expect([...faces.querySelectorAll('.kit-faces__disc')].map((disc) => disc.textContent)).toEqual(['AV', 'BJ'])
    expect(await axeFindings()).toEqual([])
  })

  it('counts the rest past the third place, in the same width', () => {
    renderShell(<Faces names={['A One', 'B Two', 'C Three', 'D Four', 'E Five']} label="five" />)
    const discs = [...screen.getByRole('img', { name: 'five' }).querySelectorAll('.kit-faces__disc')].map((disc) => disc.textContent)
    expect(discs).toEqual(['AO', 'BT', '+3'])
  })
})
