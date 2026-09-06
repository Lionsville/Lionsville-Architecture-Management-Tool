// @vitest-environment jsdom
/**
 * The one component that has to work on the day everything else does not.
 *
 * Its job is three things at once, and each of them is silent when it goes
 * wrong: draw something instead of a white page, record what happened before
 * drawing it, and hand that recording over. All three are pinned here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { translator } from '../i18n'
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
import { ErrorBoundary } from './ErrorBoundary'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

/** React logs a caught throw to console.error; that is noise, not a failure. */
function quietly<T>(run: () => T): T {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  try { return run() } finally { spy.mockRestore() }
}

function Boom(): never {
  throw new Error('the canvas fell over')
}

const controls = () => ({
  reload: vi.fn(),
  copyText: vi.fn((_text: string) => Promise.resolve()),
})

function mount(options: {
  diagnostics?: RecordingDiagnostics
  controls?: ReturnType<typeof controls>
  showStack?: boolean
  children?: React.ReactNode
} = {}) {
  const diagnostics = options.diagnostics ?? new RecordingDiagnostics()
  const host = options.controls ?? controls()
  quietly(() => renderShell(
    <ErrorBoundary
      where="editor"
      diagnostics={diagnostics}
      controls={host}
      s={translator('en')}
      showStack={options.showStack ?? false}
    >
      {options.children ?? <Boom />}
    </ErrorBoundary>,
  ))
  return { diagnostics, host }
}

describe('ErrorBoundary', () => {
  it('leaves a working child alone', () => {
    mount({ children: <p>the canvas</p> })
    expect(screen.getByText('the canvas')).toBeTruthy()
    expect(screen.queryByTestId('crash-fallback')).toBeNull()
  })

  it('draws a fallback instead of unmounting the tree', () => {
    mount()
    expect(screen.getByTestId('crash-fallback')).toBeTruthy()
    expect(screen.getByText('Something went wrong on this screen.')).toBeTruthy()
  })

  it('records the crash before it draws anything, naming where and what', () => {
    const { diagnostics } = mount()
    const [entry] = diagnostics.recent()
    expect(entry.level).toBe('error')
    expect(entry.where).toBe('editor')
    expect(entry.message).toContain('render threw')
    expect((entry.cause as Error).message).toBe('the canvas fell over')
  })

  it('names the component that threw, and nothing from the bundle`s paths', () => {
    const { diagnostics } = mount()
    expect(diagnostics.recent()[0].message).toBe('render threw in Boom')
  })

  it('offers a way back, and takes it', () => {
    const { host } = mount()
    fireEvent.click(screen.getByText('Reload'))
    expect(host.reload).toHaveBeenCalledOnce()
  })

  it('hands the whole trail over, not just this crash', async () => {
    const diagnostics = new RecordingDiagnostics()
    diagnostics.report({ level: 'warn', where: 'autosave', message: 'shell.storageFailed' })
    const { host } = mount({ diagnostics })

    fireEvent.click(screen.getByText('Copy diagnostics'))
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy())

    const copied = host.copyText.mock.calls[0][0]
    expect(copied).toContain('shell.storageFailed')
    expect(copied).toContain('render threw')
  })

  it('says so when the clipboard refuses, rather than claiming a copy', async () => {
    const host = {
      reload: vi.fn(),
      copyText: vi.fn((_text: string) => Promise.reject(new Error('denied'))),
    }
    mount({ controls: host })
    fireEvent.click(screen.getByText('Copy diagnostics'))
    await waitFor(() => expect(screen.getByText('Could not copy')).toBeTruthy())
    expect(screen.queryByText('Copied')).toBeNull()
  })

  it('shows the stack while the bug is being written, and not afterwards', () => {
    mount({ showStack: true })
    expect(screen.getByTestId('crash-stack').textContent).toContain('the canvas fell over')
    cleanup()
    mount({ showStack: false })
    expect(screen.queryByTestId('crash-stack')).toBeNull()
  })
})
