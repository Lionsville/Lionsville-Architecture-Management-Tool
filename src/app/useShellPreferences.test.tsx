// @vitest-environment jsdom
/**
 * One blob of settings, one writer.
 *
 * Before this hook, three places each wrote their own version of the blob with
 * their own fallback for "the editor has not said anything yet" — so saving a
 * language could drop a panel width, and saving a panel width could drop the
 * theme. What is pinned here is that a write PATCHES: what you did not mention
 * stays, including fields this build does not recognise, so an older shell does
 * not prune a newer one's settings.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useShellPreferences } from './useShellPreferences'
import type { ShellPreferences } from './useShellPreferences'

afterEach(() => cleanup())

function mount(initial: unknown, options: {
  write?: (p: Record<string, unknown>) => Promise<void>
  browserLanguages?: string[]
} = {}) {
  const written: Record<string, unknown>[] = []
  const write = options.write ?? ((p: Record<string, unknown>) => {
    written.push(structuredClone(p))
    return Promise.resolve()
  })
  const onWriteFailed = vi.fn()
  let prefs!: ShellPreferences
  function Host() {
    prefs = useShellPreferences({
      store: { write },
      initial,
      onWriteFailed,
      browserLanguages: options.browserLanguages ?? ['en'],
    })
    return null
  }
  render(<Host />)
  return { written, onWriteFailed, prefs: () => prefs }
}

const settle = () => act(() => Promise.resolve().then(() => {}))

describe('useShellPreferences — where the settings start', () => {
  it('takes the language from the blob when there is one', () => {
    expect(mount({ language: 'nl' }).prefs().language).toBe('nl')
  })

  it('asks the browser when there is not', () => {
    expect(mount({}, { browserLanguages: ['nl-NL', 'en'] }).prefs().language).toBe('nl')
  })

  it('starts on "system", so a screen set to dark is dark straight away', () => {
    expect(mount({}).prefs().themeMode).toBe('system')
  })

  it('ignores a theme the blob invented', () => {
    expect(mount({ themeMode: 'purple' }).prefs().themeMode).toBe('system')
  })
})

describe('useShellPreferences — writing', () => {
  it('round-trips a language choice', () => {
    const { prefs, written } = mount({ language: 'en' })
    act(() => prefs().chooseLanguage('nl'))
    expect(prefs().language).toBe('nl')
    expect(written.at(-1)).toMatchObject({ language: 'nl' })
  })

  it('cycles the theme light → dark → system and back', () => {
    const { prefs } = mount({ themeMode: 'light' })
    act(() => prefs().cycleTheme())
    expect(prefs().themeMode).toBe('dark')
    act(() => prefs().cycleTheme())
    expect(prefs().themeMode).toBe('system')
    act(() => prefs().cycleTheme())
    expect(prefs().themeMode).toBe('light')
  })

  it('patches: what you did not mention stays, including what it does not recognise', () => {
    const { prefs, written } = mount({ language: 'en', themeMode: 'dark', somethingNewer: 42 })
    act(() => prefs().chooseLanguage('nl'))
    expect(written.at(-1)).toEqual({ language: 'nl', themeMode: 'dark', somethingNewer: 42 })
  })

  it('lets the shell remember its own things beside the editor`s', () => {
    const { prefs, written } = mount({ language: 'en' })
    act(() => prefs().writePreference({ projectOrder: 'recent' }))
    expect(written.at(-1)).toMatchObject({ language: 'en', projectOrder: 'recent' })
  })

  it('keeps the language and theme when the editor saves only its own settings', () => {
    const { prefs, written } = mount({ language: 'nl', themeMode: 'dark' })
    act(() => prefs().savePreferences({ inspectorWidth: 320 } as never))
    expect(written.at(-1)).toMatchObject({ language: 'nl', themeMode: 'dark', inspectorWidth: 320 })
  })

  it('reports a refused write, so the storage notice can say so once', async () => {
    const { prefs, onWriteFailed } = mount({}, { write: () => Promise.reject(new Error('full')) })
    act(() => prefs().chooseLanguage('nl'))
    await settle()
    expect(onWriteFailed).toHaveBeenCalledWith(false)
  })

  it('writes once per press, not twice — the updater form would under StrictMode', () => {
    const { prefs, written } = mount({ themeMode: 'light' })
    act(() => prefs().cycleTheme())
    expect(written).toHaveLength(1)
  })
})

describe('useShellPreferences — the theme it hands back', () => {
  it('resolves an explicit choice straight through', () => {
    expect(mount({ themeMode: 'dark' }).prefs().theme.palette.mode).toBe('dark')
  })
})
