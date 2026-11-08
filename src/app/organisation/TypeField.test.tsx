// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** What a scope is, chosen from the unit types and the kinds, which may share a word. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../testing/renderShell'
import { EN } from '../../i18n/strings.en'
import { translateFrom } from '../../i18n/interpolate'
import { TypeField } from './TypeField'

afterEach(cleanup)
const s = translateFrom(EN)

describe('TypeField', () => {
  it('heads the unit types and the kinds apart, so two of the same name read as two things', () => {
    renderShell(<TypeField type="" unitTypes={[{ id: 'team', name: 'Team' }]} onChange={() => undefined} s={s} />)
    fireEvent.click(screen.getByTestId('scope-type-field'))
    const heads = [...document.querySelectorAll('.kit-select__group')].map((one) => one.textContent)
    expect(heads).toEqual(['Unit types', 'Kinds'])
  })

  it('has no headings where there are no unit types', () => {
    renderShell(<TypeField type="" unitTypes={[]} onChange={() => undefined} s={s} />)
    fireEvent.click(screen.getByTestId('scope-type-field'))
    expect(document.querySelectorAll('.kit-select__group')).toHaveLength(0)
  })
})
