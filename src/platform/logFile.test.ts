import { describe, expect, it } from 'vitest'
import { logFileName, MAX_LOG_BYTES, needsRotation, rolledName } from './logFile'

describe('logFileName', () => {
  it('is dated, padded, and says which app wrote it', () => {
    expect(logFileName(new Date(2026, 8, 6))).toBe('lvarch-2026-09-06.log')
  })

  it('follows the user`s day rather than UTC`s', () => {
    // 23:30 local on the 6th is the 7th in UTC; the log belongs to the evening
    // the user had.
    expect(logFileName(new Date(2026, 8, 6, 23, 30))).toBe('lvarch-2026-09-06.log')
  })
})

describe('rolledName', () => {
  it('keeps exactly one file behind the current one', () => {
    expect(rolledName('lvarch-2026-09-06.log')).toBe('lvarch-2026-09-06.log.1')
  })
})

describe('needsRotation', () => {
  it('rolls before the write that would cross the cap, not after', () => {
    expect(needsRotation(MAX_LOG_BYTES - 10, 20)).toBe(true)
    expect(needsRotation(MAX_LOG_BYTES - 10, 5)).toBe(false)
  })

  it('never rolls an empty file, however long the line', () => {
    expect(needsRotation(0, MAX_LOG_BYTES * 2)).toBe(false)
  })
})
