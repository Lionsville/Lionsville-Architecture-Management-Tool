/**
 * One way to put a piece of this shell on screen in a test.
 *
 * Three things came out of writing the same twenty lines in six files.
 *
 * **The surroundings, always.** A component rendered bare is a component
 * rendered under MUI's default light theme and with no language in context,
 * which is not where it lives. Every `sx` colour, every `useStrings()` and the
 * whole dark palette are silently different from production.
 *
 * **The theme canary, in every test.** `harness.test.tsx` exists because two
 * copies of Emotion once put every `sx`-coloured surface back on the default
 * light theme — a white bar with white text, and not one test that noticed.
 * `vite.config.ts` and `vitest.config.ts` solve it with `dedupe`, and that line
 * is one careless merge from disappearing. So this helper paints a probe on
 * every render and checks it took the theme's colour: from here on, ANY
 * component test fails the moment Emotion is doubled, not just the one written
 * to look for it.
 *
 * **In-memory everything.** Stores that behave like the real ones (they copy,
 * they validate refs, they run the same contract) and spies for the seams that
 * would otherwise reach the outside world.
 */
import type { ReactElement, ReactNode } from 'react'
import { vi } from 'vitest'
import type { Mock } from 'vitest'
import { render } from '@testing-library/react'
import type { RenderOptions, RenderResult } from '@testing-library/react'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { LanguageProvider, translator } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { InMemoryGroupStore } from '../../adapters/memory/InMemoryGroupStore'
import { InMemoryPreferencesStore } from '../../adapters/memory/InMemoryPreferencesStore'
import { InMemoryProjectStore } from '../../adapters/memory/InMemoryProjectStore'
import { RecordingDiagnostics } from '../../adapters/memory/RecordingDiagnostics'
import type { ProjectSnapshot } from '../../projects/project'
import type { AppProps } from '../App'
import { App } from '../App'
import type { TextDocument } from '../../ports/DocumentGateway'

export type ShellOptions = {
  language?: Language
  mode?: 'light' | 'dark'
}

const PROBE = 'shell-theme-probe'

/** The surroundings every component in this shell renders inside. */
function Surroundings({ theme, language, children }: {
  theme: Theme; language: Language; children: ReactNode
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageProvider language={language}>
        {children}
        <Box data-testid={PROBE} sx={{ bgcolor: 'background.paper', display: 'none' }} />
      </LanguageProvider>
    </ThemeProvider>
  )
}

export type ShellRender = RenderResult & {
  s: Translate
  theme: Theme
}

export function renderShell(node: ReactElement, options: ShellOptions = {}): ShellRender {
  const { language = 'en', mode = 'dark' } = options
  const theme = createTheme({ palette: { mode } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    <Surroundings theme={theme} language={language}>{children}</Surroundings>

  const result = render(node, { wrapper } as RenderOptions)
  assertThemeReached(theme)
  return { ...result, s: translator(language), theme }
}

/**
 * Did the theme actually reach the tree?
 *
 * Under a doubled Emotion it does not, and everything still renders — that is
 * exactly what made the original bug expensive. Thrown rather than expected, so
 * this file needs no assertion library and the failure names its own cause.
 */
function assertThemeReached(theme: Theme): void {
  const probe = document.querySelectorAll(`[data-testid="${PROBE}"]`)
  const painted = getComputedStyle(probe[probe.length - 1]).backgroundColor
  if (painted !== hexToRgb(theme.palette.background.paper)) {
    throw new Error(
      `The theme did not reach the tree: a themed surface painted ${painted} instead of ` +
      `${theme.palette.background.paper}. Two copies of Emotion is the usual cause — check ` +
      '`dedupe` in vitest.config.ts.',
    )
  }
}

/** MUI writes both `#121212` and `#fff`; jsdom answers in `rgb()` either way. */
function hexToRgb(colour: string): string {
  if (!colour.startsWith('#')) return colour
  const value = colour.slice(1)
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

// --- the whole app, with an outside world that leaves nothing behind ---------

/** A document gateway that keeps what it was handed instead of downloading it. */
export function recordingDocuments() {
  return {
    saved: [] as TextDocument[],
    text: '{}',
    dataUrl: 'data:image/png;base64,AA',
    save(doc: TextDocument) { this.saved.push(doc); return Promise.resolve() },
    readText() { return Promise.resolve(this.text) },
    readDataUrl() { return Promise.resolve(this.dataUrl) },
  }
}

export type ShellHarness = {
  projects: InMemoryProjectStore
  groups: InMemoryGroupStore
  preferences: InMemoryPreferencesStore
  documents: ReturnType<typeof recordingDocuments>
  diagnostics: RecordingDiagnostics
  hostControls: {
    reload: Mock<() => void>
    copyText: Mock<(text: string) => Promise<void>>
  }
}

/** The seams, filled with things that keep receipts. */
export function shellHarness(projects: readonly ProjectSnapshot[] = []): ShellHarness {
  return {
    projects: new InMemoryProjectStore(projects),
    groups: new InMemoryGroupStore(),
    preferences: new InMemoryPreferencesStore(),
    documents: recordingDocuments(),
    diagnostics: new RecordingDiagnostics(),
    hostControls: {
      reload: vi.fn(() => {}),
      copyText: vi.fn((_text: string) => Promise.resolve()),
    },
  }
}

export type AppRender = ShellRender & ShellHarness

/**
 * The whole shell, opened where you say.
 *
 * `App` brings its own `ThemeProvider`; the one around it is what the probe
 * reads, and nesting two is what the real tree does anyway.
 *
 * What comes back is what this helper built. A seam you passed in yourself is
 * already yours — no attempt is made to hand it back, because then half the
 * fields would be the caller's and half the helper's and nobody could tell
 * which by reading.
 */
export function renderApp(
  over: Partial<AppProps> = {},
  options: ShellOptions = {},
): AppRender {
  const harness = shellHarness()
  const props: AppProps = {
    projects: harness.projects,
    groupRecords: harness.groups,
    preferences: harness.preferences,
    documents: harness.documents,
    diagnostics: harness.diagnostics,
    hostControls: harness.hostControls,
    initialProject: undefined,
    initialPreferences: { language: options.language ?? 'en' },
    examples: [],
    makeId: (prefix) => `${prefix}-new`,
    browserLanguages: [options.language ?? 'en'],
    ...over,
  }
  return { ...renderShell(<App {...props} />, options), ...harness }
}
