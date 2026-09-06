// @vitest-environment jsdom
/**
 * The session that leaves nothing behind, and says so.
 *
 * When browser storage refuses at boot the composition swaps in memory stores.
 * Everything then works — and nothing survives the tab. Because those stores
 * never fail, `useStorageNotice` is never called and the user was told
 * precisely nothing; they would find out on the next morning's first coffee.
 *
 * A standing notice rather than a toast: it is true for the whole session, not
 * an event within it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { InMemoryGroupStore } from '../adapters/memory/InMemoryGroupStore'
import { InMemoryPreferencesStore } from '../adapters/memory/InMemoryPreferencesStore'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
import { App } from './App'

afterEach(() => cleanup())

/** The picker, not the workspace: no project open means no editor to mount. */
function renderPicker(storage?: 'browser' | 'memory') {
  render(
    <App
      projects={new InMemoryProjectStore()}
      groupRecords={new InMemoryGroupStore()}
      preferences={new InMemoryPreferencesStore()}
      documents={{
        save: () => Promise.resolve(),
        readText: () => Promise.resolve(''),
        readDataUrl: () => Promise.resolve(''),
      }}
      diagnostics={new RecordingDiagnostics()}
      hostControls={{ reload: () => {}, copyText: () => Promise.resolve() }}
      storage={storage}
      initialProject={undefined}
      initialPreferences={{ language: 'en' }}
      examples={[]}
      makeId={(prefix) => `${prefix}-new`}
      browserLanguages={['en']}
    />,
  )
}

describe('App and the storage it was given', () => {
  it('shows the notice from the first render when nothing will be kept', () => {
    renderPicker('memory')
    expect(screen.getByTestId('storage-notice').textContent)
      .toContain('This browser could not save the design')
  })

  it('says nothing when storage works, which is the ordinary case', () => {
    renderPicker('browser')
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })

  it('assumes storage works when nobody said otherwise', () => {
    renderPicker()
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })
})
