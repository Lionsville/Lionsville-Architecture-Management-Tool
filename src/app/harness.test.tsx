// @vitest-environment jsdom
/**
 * Proof that the shell CAN run component tests — not a test of a function, but
 * of the tooling underneath.
 *
 * The shell only ever had node tests over pure functions. Without this harness
 * test a broken jsdom setup would first show up when somebody writes their first
 * real component test, and then it looks as if their component is broken.
 *
 * The theme is in here on purpose. In phase 4B it turned out that two copies of
 * Emotion put every `sx`-coloured surface back on the default light theme —
 * white bar, white text. `vite.config.ts` solves that with `dedupe`, and this
 * config does the same; this is the test that notices if that line ever falls
 * away, because then the default colour comes out here instead of the dark one.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Box from '@mui/material/Box'
import { ThemeProvider, createTheme } from '@mui/material/styles'

describe('shell test harness', () => {
  it('renders a React component into a document', () => {
    render(<p>hello</p>)
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('gives an sx-styled surface the colours of the theme it is under', () => {
    const theme = createTheme({ palette: { mode: 'dark' } })
    render(
      <ThemeProvider theme={theme}>
        <Box data-testid="surface" sx={{ bgcolor: 'background.paper' }}>surface</Box>
      </ThemeProvider>,
    )
    const surface = screen.getByTestId('surface')
    const painted = getComputedStyle(surface).backgroundColor
    // MUI's dark theme: #121212. Were Emotion loaded twice, the default light
    // theme would win and this would be white.
    expect(painted).toBe('rgb(18, 18, 18)')
  })
})
