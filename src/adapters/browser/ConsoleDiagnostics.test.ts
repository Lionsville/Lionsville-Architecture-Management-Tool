// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsoleDiagnostics, LOG_PREFIX } from './ConsoleDiagnostics'

afterEach(() => vi.restoreAllMocks())

describe('ConsoleDiagnostics', () => {
  it('writes one prefixed line per report, at the level asked for', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const diagnostics = new ConsoleDiagnostics(200, () => '2026-09-06T10:00:00.000Z')

    diagnostics.report({ level: 'error', where: 'boot', message: 'shell.crashed' })
    diagnostics.report({ level: 'warn', where: 'autosave', message: 'shell.storageFailed' })

    expect(error).toHaveBeenCalledWith(
      `${LOG_PREFIX} 2026-09-06T10:00:00.000Z ERROR boot: shell.crashed`, '')
    expect(warn).toHaveBeenCalledOnce()
  })

  it('keeps what it wrote, so it can be handed over without devtools', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const diagnostics = new ConsoleDiagnostics()
    diagnostics.report({ level: 'info', where: 'boot', message: 'started' })
    expect(diagnostics.recent()).toHaveLength(1)
    expect(diagnostics.recent()[0].message).toBe('started')
  })

  it('survives a console that refuses: reporting a failure must not become one', () => {
    vi.spyOn(console, 'error').mockImplementation(() => { throw new Error('no console') })
    const diagnostics = new ConsoleDiagnostics()
    expect(() => diagnostics.report({ level: 'error', where: 'boot', message: 'kept anyway' }))
      .not.toThrow()
    expect(diagnostics.recent()[0].message).toBe('kept anyway')
  })
})
