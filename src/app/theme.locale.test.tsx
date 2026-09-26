// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * MUI's own labels, in the language that is on. An autocomplete draws its
 * clear and open buttons with names MUI chose, and a toast its close button;
 * until the theme carried the language they said *Clear*, *Open* and *Close*
 * to a screen reader on a Dutch or German screen.
 */
import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import { renderShell } from './testing/renderShell'
import { shellTheme } from './theme'
import type { Language } from '../i18n'

function Field() {
  return (
    <Autocomplete
      options={['one', 'two']}
      value="one"
      renderInput={(params) => <TextField {...params} label="Field" />}
    />
  )
}

const SAID: Partial<Record<Language, { clear: string; open: string; close: string }>> = {
  en: { clear: 'Clear', open: 'Open', close: 'Close' },
  nl: { clear: 'Wissen', open: 'Openen', close: 'Sluiten' },
  de: { clear: 'Leeren', open: 'Öffnen', close: 'Schließen' },
}

describe('MUI’s own labels', () => {
  for (const [language, words] of Object.entries(SAID) as [Language, { clear: string; open: string; close: string }][]) {
    it(`names an autocomplete’s buttons and a toast’s close in ${language}`, () => {
      const { container } = renderShell(
        <>
          <Field />
          <Alert onClose={() => undefined}>Saved</Alert>
        </>,
        { language },
      )
      expect(within(container).getByRole('button', { name: words.open })).toBeTruthy()
      // Drawn only while the field is hovered or focused, so read off the button.
      expect(container.querySelector('.MuiAutocomplete-clearIndicator')?.getAttribute('aria-label')).toBe(words.clear)
      expect(within(container).getByRole('button', { name: words.close })).toBeTruthy()
    })
  }

  it('carries the rest of MUI’s vocabulary in that language too, for a screen that grows one', () => {
    const rows = (language: Language) =>
      shellTheme('light', language).components?.MuiTablePagination?.defaultProps?.labelRowsPerPage
    expect(rows('en')).toBeUndefined()
    expect(rows('nl')).toBe('Regels per pagina:')
    expect(rows('de')).toBe('Zeilen pro Seite:')
  })
})
