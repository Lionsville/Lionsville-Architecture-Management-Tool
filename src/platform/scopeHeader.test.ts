import { describe, expect, it } from 'vitest'
import { SCOPE_FILE, scopeNameIn } from './scopeHeader'

describe('scopeNameIn', () => {
  it('is the name a scope’s header carries, trimmed', () => {
    expect(scopeNameIn('{"type":"lionsville-architecture","version":5,"name":"  Acme Logistics  "}'))
      .toBe('Acme Logistics')
  })

  /** A header somebody wrote by hand is still a scope. */
  it('reads a header that does not say which tool wrote it', () => {
    expect(scopeNameIn('{"name":"Acme"}')).toBe('Acme')
  })

  it('reads nothing out of a file that is not ours, or not one', () => {
    expect(scopeNameIn('{"type":"something-else","name":"Acme"}')).toBeUndefined()
    expect(scopeNameIn('{"name":7}')).toBeUndefined()
    expect(scopeNameIn('{"name":"   "}')).toBeUndefined()
    expect(scopeNameIn('[]')).toBeUndefined()
    expect(scopeNameIn('half a fi')).toBeUndefined()
    expect(scopeNameIn(undefined)).toBeUndefined()
  })

  it('names the file the format writes', () => {
    expect(SCOPE_FILE).toBe('scope.json')
  })
})
