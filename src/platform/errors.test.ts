import { describe, expect, it } from 'vitest'
import { reasonOf, ShellError } from './errors'
import { LogoError } from '../model/logo'

describe('ShellError', () => {
  it('carries a key and its numbers, not a sentence', () => {
    const error = new ShellError('shell.logoTooBig', { size: 300, max: 200 })
    expect(error.key).toBe('shell.logoTooBig')
    expect(error.params).toEqual({ size: 300, max: 200 })
  })

  it('uses the key as its message, so an unread one still says which refusal', () => {
    expect(new ShellError('shell.badProjectRef').message).toBe('shell.badProjectRef')
  })

  it('is an Error, so nothing that catches broadly has to learn about it', () => {
    expect(new ShellError('shell.crashed')).toBeInstanceOf(Error)
  })
})

describe('LogoError', () => {
  it('is one of these, so one helper translates both', () => {
    const error = new LogoError('shell.logoBadType')
    expect(error).toBeInstanceOf(ShellError)
    expect(error.key).toBe('shell.logoBadType')
  })

  it('keeps its own name, so a reader still knows which reader refused', () => {
    expect(new LogoError('shell.logoUnreadable').name).toBe('LogoError')
  })
})

describe('reasonOf', () => {
  it('is the message alone — the class name is for the log, not for the user', () => {
    expect(reasonOf(new RangeError('disk full'))).toBe('disk full')
  })

  it('reads a message off a thrown object that is not an Error', () => {
    expect(reasonOf({ message: 'quota exceeded' })).toBe('quota exceeded')
  })

  it('stringifies anything else, because `throw "oops"` is legal', () => {
    expect(reasonOf('oops')).toBe('oops')
    expect(reasonOf(undefined)).toBe('undefined')
  })
})
