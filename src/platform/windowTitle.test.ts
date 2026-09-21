import { describe, expect, it } from 'vitest'
import { PRODUCT_NAME, windowTitleFor } from './windowTitle'

describe('windowTitleFor', () => {
  it('names the scope, then the organisation, then the product', () => {
    expect(windowTitleFor('Acme Logistics', 'Warehouse landscape'))
      .toBe('Warehouse landscape — Acme Logistics — Lionsville Architect')
  })

  it('is the product alone before anything is open', () => {
    expect(windowTitleFor('')).toBe(PRODUCT_NAME)
  })

  it('leaves out the half that has nothing to say', () => {
    expect(windowTitleFor('Acme Logistics')).toBe('Acme Logistics — Lionsville Architect')
    expect(windowTitleFor('', 'Warehouse')).toBe('Warehouse — Lionsville Architect')
  })

  /** A scope with nothing above it says its own name once, not twice. */
  it('says a name once when the scope and the organisation are the same', () => {
    expect(windowTitleFor('Acme', 'Acme')).toBe('Acme — Lionsville Architect')
  })

  it('trims what it is given', () => {
    expect(windowTitleFor('  Acme  ', '  Rail  ')).toBe('Rail — Acme — Lionsville Architect')
  })
})
