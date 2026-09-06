// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import { ShellError } from '../platform/errors'
import { LogoError } from '../model/logo'
import { messageFor } from './messageFor'

const en = translator('en')
const nl = translator('nl')

describe('messageFor', () => {
  it('turns a key into words, with its numbers in place', () => {
    expect(messageFor(new ShellError('shell.logoTooBig', { size: 300, max: 200 }), en))
      .toBe('This logo is too big (300 kB). The limit is 200 kB.')
  })

  it('speaks whichever language it is handed — which is the whole point', () => {
    expect(messageFor(new LogoError('shell.logoBadType'), nl))
      .toBe('Alleen SVG- en PNG-bestanden kunnen als logo worden toegevoegd.')
  })

  it('names an ordinary error inside the generic sentence, so it can be quoted', () => {
    expect(messageFor(new TypeError('x is not a function'), en))
      .toBe('The document could not be processed: x is not a function')
  })

  it('copes with something that is not an error at all', () => {
    expect(messageFor('oops', en)).toBe('The document could not be processed: oops')
  })
})
