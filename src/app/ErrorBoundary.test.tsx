// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { ErrorBoundary, ProblemOfferContext } from './ErrorBoundary'
import { problemOffer } from './problem'
import type { Problem } from './problem'
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
    diagnostics.report({ level: 'warn', where: 'autosave', message: 'shell.keepFailed' })
    const { host } = mount({ diagnostics })

    fireEvent.click(screen.getByText('Copy diagnostics'))
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy())

    const copied = host.copyText.mock.calls[0][0]
    expect(copied).toContain('shell.keepFailed')
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

  it('offers two things and no third where no provider offers an action on a problem', () => {
    mount()
    const buttons = screen.getAllByRole('button').map((one) => one.textContent)
    expect(buttons).toEqual(['Reload', 'Copy diagnostics'])
    expect(screen.queryByTestId('crash-problem-action')).toBeNull()
  })

  /**
   * The open source's provider's action on a problem, beside the two (ADR-0022,
   * amended): in its own words, and handed the problem as it was when the
   * render threw — only when it is pressed.
   */
  it('offers the provider\u2019s action as a third, and hands it the problem when pressed', () => {
    const handed: Problem[] = []
    const offer = problemOffer(
      { labelKey: 'elsewhere.passOn', run: (problem) => handed.push(problem) },
      () => 'Pass it on', () => ({ home: { path: '', name: 'Acme' } }), () => new Date('2026-10-01T09:30:00.000Z'),
    )
    quietly(() => renderShell(
      <ProblemOfferContext.Provider value={offer}>
        <ErrorBoundary where="editor" diagnostics={new RecordingDiagnostics()} controls={controls()} s={translator('en')} showStack={false}>
          <Boom />
        </ErrorBoundary>
      </ProblemOfferContext.Provider>,
    ))
    const action = screen.getByTestId('crash-problem-action')
    expect(action.textContent).toBe('Pass it on')
    expect(handed).toEqual([])
    fireEvent.click(action)
    expect(handed).toHaveLength(1)
    expect(handed[0]).toMatchObject({
      where: 'editor', name: 'Error', message: 'the canvas fell over', at: '2026-10-01T09:30:00.000Z',
      screen: { home: { path: '', name: 'Acme' } },
    })
    expect(handed[0].stack).toContain('the canvas fell over')
  })

  it('offers two things and no third where the provider\u2019s action cannot be taken when the render throws', () => {
    const run = vi.fn()
    const offer = problemOffer({ labelKey: 'x', run, available: () => false }, () => 'Pass it on', () => undefined)
    quietly(() => renderShell(
      <ProblemOfferContext.Provider value={offer}>
        <ErrorBoundary where="editor" diagnostics={new RecordingDiagnostics()} controls={controls()} s={translator('en')} showStack={false}>
          <Boom />
        </ErrorBoundary>
      </ProblemOfferContext.Provider>,
    ))
    expect(screen.getAllByRole('button').map((one) => one.textContent)).toEqual(['Reload', 'Copy diagnostics'])
    expect(screen.queryByTestId('crash-problem-action')).toBeNull()
    expect(run).not.toHaveBeenCalled()
  })

  it('offers nothing where it draws a fallback of its caller\u2019s instead of the crash screen', () => {
    const run = vi.fn()
    const offer = problemOffer({ labelKey: 'x', run }, () => 'Pass it on', () => undefined)
    quietly(() => renderShell(
      <ProblemOfferContext.Provider value={offer}>
        <ErrorBoundary where="face" diagnostics={new RecordingDiagnostics()} controls={controls()} s={translator('en')} fallback={<i>label</i>}>
          <Boom />
        </ErrorBoundary>
      </ProblemOfferContext.Provider>,
    ))
    expect(screen.getByText('label')).toBeTruthy()
    expect(screen.queryByText('Pass it on')).toBeNull()
  })
})
