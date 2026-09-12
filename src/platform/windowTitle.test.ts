import { describe, expect, it } from 'vitest'
import { PRODUCT_NAME, windowTitleFor } from './windowTitle'

describe('windowTitleFor', () => {
  it('names the scope, then the organisation, then the product', () => {
    expect(windowTitleFor('Acme Logistics', 'Warehouse landscape'))
      .toBe('Warehouse landscape — Acme Logistics — Architecture Management Tool')
  })

  it('is the product alone before anything is open', () => {
    expect(windowTitleFor('')).toBe(PRODUCT_NAME)
  })

  it('leaves out the half that has nothing to say', () => {
    expect(windowTitleFor('Acme Logistics')).toBe('Acme Logistics — Architecture Management Tool')
    expect(windowTitleFor('', 'Warehouse')).toBe('Warehouse — Architecture Management Tool')
  })

  /** A scope with nothing above it says its own name once, not twice. */
  it('says a name once when the scope and the organisation are the same', () => {
    expect(windowTitleFor('Acme', 'Acme')).toBe('Acme — Architecture Management Tool')
  })

  it('trims what it is given', () => {
    expect(windowTitleFor('  Acme  ', '  Rail  ')).toBe('Rail — Acme — Architecture Management Tool')
  })
})
