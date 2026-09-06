import { describe, expect, it } from 'vitest'
import { KEY_RE, claimKey, idPolicy, idsIn, slug } from './keys'

describe('slug', () => {
  it('lowercases, strips accents and joins on dashes', () => {
    expect(slug('Reisinformatie Één')).toBe('reisinformatie-een')
    expect(slug('CREWS')).toBe('crews')
    expect(slug('Donné & Co')).toBe('donne-co')
  })

  it('collapses runs of punctuation and trims the edges', () => {
    expect(slug('  -- Crews / Planning --  ')).toBe('crews-planning')
    expect(slug('a___b')).toBe('a-b')
  })

  it('falls back to "element" when nothing survives', () => {
    expect(slug('')).toBe('element')
    expect(slug('///')).toBe('element')
    expect(slug('日本語')).toBe('element')
    expect(slug(undefined as unknown as string)).toBe('element')
  })

  it('only ever produces valid interchange keys', () => {
    for (const name of ['Crews', 'Réisinformatie 2.0', '  ', 'A/B & C', '日本語']) {
      expect(KEY_RE.test(slug(name))).toBe(true)
    }
  })
})

describe('claimKey', () => {
  it('slugs the name when the key is free, and claims it', () => {
    const taken = new Set<string>()
    expect(claimKey('Crews', taken)).toBe('crews')
    expect(taken.has('crews')).toBe(true)
  })

  it('suffixes from -2 upwards on a collision', () => {
    const taken = new Set<string>(['crews'])
    expect(claimKey('Crews', taken)).toBe('crews-2')
    expect(claimKey('Crews', taken)).toBe('crews-3')
    expect(claimKey('crews', taken)).toBe('crews-4')
  })

  it('skips suffixes that are already taken rather than reusing them', () => {
    const taken = new Set<string>(['crews', 'crews-2', 'crews-3'])
    expect(claimKey('Crews', taken)).toBe('crews-4')
  })

  it('is stable: the same name against the same free set gives the same key', () => {
    expect(claimKey('Reisinformatie', new Set())).toBe('reisinformatie')
    expect(claimKey('Reisinformatie', new Set())).toBe('reisinformatie')
    // and a rename never revisits the key: claimKey is called once, at creation
    const taken = new Set<string>()
    const key = claimKey('Werkplek', taken)
    expect(claimKey('Werkplek anders genoemd', taken)).not.toBe(key)
  })

  it('gives a nameless element the fallback slug, then numbers it', () => {
    const taken = new Set<string>()
    expect(claimKey('', taken)).toBe('element')
    expect(claimKey('', taken)).toBe('element-2')
  })
})

/**
 * The id an element will have in the file, minted at the moment it is drawn.
 * Everything that used to be a temporary id, an alias map and a reconciliation
 * pass is this function and its memory of what it has already answered.
 */
describe('idPolicy', () => {
  it('answers with the key the name would have had', () => {
    const ids = idPolicy(() => [])
    expect(ids.element('Order Management')).toBe('order-management')
  })

  it('steps around what the document already holds', () => {
    const ids = idPolicy(() => ['order-management', 'landscape'])
    expect(ids.element('Order Management')).toBe('order-management-2')
    expect(ids.element('Landscape')).toBe('landscape-2')
  })

  /** Five elements pasted in one gesture ask for five ids before any lands. */
  it('remembers what it handed out, before any of it reaches the model', () => {
    const ids = idPolicy(() => [])
    const three = [ids.element('Depot'), ids.element('Depot'), ids.element('Depot')]
    expect(new Set(three).size).toBe(3)
  })

  it('does not hand a key back once the thing that had it is gone', () => {
    const taken = new Set(['depot'])
    const ids = idPolicy(() => taken)
    const first = ids.element('Depot')
    taken.delete('depot')
    expect(ids.element('Depot')).not.toBe(first)
  })

  it('gives connections a serial, which the interchange format leaves to us', () => {
    const ids = idPolicy(() => [])
    const first = ids.connection()
    expect(first).toMatch(/^c#\d+-/)
    expect(ids.connection()).not.toBe(first)
  })
})

describe('idsIn', () => {
  it('is every id in the document, because they share one namespace', () => {
    expect(idsIn({
      elements: [{ id: 'a' }],
      connections: [{ id: 'c#1' }],
      diagrams: [{ id: 'landscape' }],
    })).toEqual(['a', 'c#1', 'landscape'])
  })
})
