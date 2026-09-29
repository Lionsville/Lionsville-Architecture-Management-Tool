// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * An export in the mode the window is not in wears the app's palette, not
 * MUI's default one. The editor is stubbed to print the tokens of the theme
 * it would make the picture in from what the app handed it: what is under
 * test is the app's half, the theme it gives for the other mode.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTheme } from '@mui/material/styles'
import { cleanup, screen } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { heldRepositories } from './testing/heldRepositories'
import type { ScopeSnapshot } from '../projects/scope'
import type { SolutionDesignEditorProps } from '../editor'
import { exportThemeFor } from '../editor/useExport'
import { getExportTokens } from '../editor/theme/tokens'
import { renderApp } from './testing/renderShell'
import { shellTheme } from './theme'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: Pick<SolutionDesignEditorProps, 'themeFor'>) => {
      const theme = useTheme()
      const other = theme.palette.mode === 'dark' ? 'light' : 'dark'
      const made = exportThemeFor(theme, other, props.themeFor)
      return <output data-testid="export-tokens" data-mode={other}>{JSON.stringify(getExportTokens(made))}</output>
    },
  }
})

afterEach(() => cleanup())

const project = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name: 'Landscape', elements: [], relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

describe('an export in the other mode', () => {
  it('is made in the app’s own theme for that mode', async () => {
    renderApp({ repositories: heldRepositories([project()]), boot: { initialProject: project() } })
    const out = await screen.findByTestId('export-tokens')
    const other = out.getAttribute('data-mode') as 'light' | 'dark'
    expect(JSON.parse(out.textContent ?? '')).toEqual(getExportTokens(shellTheme(other)))
  })
})
