// @vitest-environment jsdom
/**
 * The helper's own canary. `harness.test.tsx` proved the tooling could render a
 * component at all; this proves the surroundings it renders it in are real —
 * and, because every component test now goes through here, that the theme
 * reaching the tree is checked on every render rather than in one file.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import Box from '@mui/material/Box'
import { useStrings } from '@lionsville/solution-design'
import { renderShell } from './renderShell'

afterEach(() => cleanup())

function Words() {
  const { t } = useStrings()
  return <p>{t('shell.reload')}</p>
}

describe('renderShell', () => {
  it('paints an sx surface in the colours of the theme it provides', () => {
    renderShell(<Box data-testid="surface" sx={{ bgcolor: 'background.paper' }}>x</Box>)
    // MUI's dark theme: #121212. Were Emotion loaded twice the default light
    // theme would win, and so would white.
    expect(getComputedStyle(screen.getByTestId('surface')).backgroundColor).toBe('rgb(18, 18, 18)')
  })

  it('renders in light when asked, so both themes stay exercised', () => {
    renderShell(<Box data-testid="surface" sx={{ bgcolor: 'background.paper' }}>x</Box>, { mode: 'light' })
    expect(getComputedStyle(screen.getByTestId('surface')).backgroundColor).toBe('rgb(255, 255, 255)')
  })

  it('puts a language in context, which a bare render does not', () => {
    renderShell(<Words />, { language: 'nl' })
    expect(screen.getByText('Herladen')).toBeTruthy()
  })

  it('hands back a translator for the language it used', () => {
    const { s } = renderShell(<p>x</p>, { language: 'nl' })
    expect(s('shell.reload')).toBe('Herladen')
  })
})
