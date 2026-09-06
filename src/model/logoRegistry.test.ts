/**
 * The registry, as machinery — what a pack does when it joins, and what it does
 * not. The marks themselves are covered in `editor/nodes/logoRegistry.test.tsx`.
 */
import { describe, expect, it } from 'vitest'
import {
  LOGO_CATEGORIES,
  LOGO_ENTRIES,
  builtInLogo,
  isBuiltInLogoKey,
  logoCategoryLabel,
  registerLogoPack,
  type LogoPack,
} from './logoRegistry'

const pack = (category: string): LogoPack => ({
  category,
  labelKey: 'logo.category.rail',
  marks: [{ key: `${category}-one`, label: 'One', category, keywords: ['een'], path: 'M0 0h24' }],
})

describe('registerLogoPack', () => {
  it('adds a pack’s marks to the vocabulary and its heading to the picker', () => {
    // Before: the key is not one this build knows, so an export would not write it.
    expect(isBuiltInLogoKey('birds-one')).toBe(false)

    registerLogoPack(pack('birds'))

    expect(isBuiltInLogoKey('birds-one')).toBe(true)
    expect(builtInLogo('birds-one')?.label).toBe('One')
    expect(LOGO_ENTRIES.some((entry) => entry.key === 'birds-one')).toBe(true)
    expect(LOGO_CATEGORIES.map((category) => category.key)).toContain('birds')
  })

  it('puts a registered pack after the ones that ship', () => {
    registerLogoPack(pack('trees'))
    const keys = LOGO_CATEGORIES.map((category) => category.key)
    expect(keys.indexOf('trees')).toBeGreaterThan(keys.indexOf('vendors'))
  })

  it('ignores a pack that is already registered rather than duplicating it', () => {
    // Two suites in one process may each register the packs they need.
    registerLogoPack(pack('fish'))
    const before = LOGO_ENTRIES.length
    registerLogoPack(pack('fish'))
    expect(LOGO_ENTRIES.length).toBe(before)
    expect(LOGO_CATEGORIES.filter((category) => category.key === 'fish')).toHaveLength(1)
  })

  it('gives the heading in the language asked for, through the pack’s own key', () => {
    registerLogoPack(pack('boats'))
    expect(logoCategoryLabel('boats')).toBe('Rail')
  })

  it('says nothing about a key no pack brought', () => {
    expect(isBuiltInLogoKey('nothing-like-this')).toBe(false)
    expect(builtInLogo('nothing-like-this')).toBeUndefined()
  })
})
