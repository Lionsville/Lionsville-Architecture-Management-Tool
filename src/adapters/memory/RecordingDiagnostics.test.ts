import { describe, expect, it } from 'vitest'
import { RecordingDiagnostics } from './RecordingDiagnostics'

describe('RecordingDiagnostics', () => {
  it('keeps what was reported, in order, stamped', () => {
    const diagnostics = new RecordingDiagnostics()
    diagnostics.report({ level: 'error', where: 'boot', message: 'first' })
    diagnostics.report({ level: 'warn', where: 'autosave', message: 'second' })

    expect(diagnostics.messages()).toEqual(['first', 'second'])
    expect(diagnostics.recent()[0].at).toBe('1970-01-01T00:00:01.000Z')
    expect(diagnostics.recent()[1].where).toBe('autosave')
  })

  it('hands back a copy, so a caller cannot edit the trail', () => {
    const diagnostics = new RecordingDiagnostics()
    diagnostics.report({ level: 'info', where: 'boot', message: 'kept' })
    diagnostics.recent().length = 0
    expect(diagnostics.messages()).toEqual(['kept'])
  })

  it('forgets the oldest once it is full', () => {
    const diagnostics = new RecordingDiagnostics(2)
    for (const message of ['a', 'b', 'c']) {
      diagnostics.report({ level: 'info', where: 'boot', message })
    }
    expect(diagnostics.messages()).toEqual(['b', 'c'])
  })
})
