import { describe, expect, it } from 'vitest'
import { BROWSER_STORAGE, IN_MEMORY, sourceKey } from './workingSource'

describe('sourceKey', () => {
  it('tells two folders apart by root, not by name', () => {
    expect(sourceKey({ kind: 'folder', name: 'NS', root: '/a/NS' }))
      .not.toBe(sourceKey({ kind: 'folder', name: 'NS', root: '/b/NS' }))
    expect(sourceKey({ kind: 'folder', name: 'NS', root: '/a/NS' }))
      .toBe(sourceKey({ kind: 'folder', name: 'renamed', root: '/a/NS' }))
  })

  it('keeps a folder apart from both fallbacks, and the fallbacks from each other', () => {
    const keys = [sourceKey({ kind: 'folder', name: 'x', root: '/x' }), sourceKey(BROWSER_STORAGE), sourceKey(IN_MEMORY)]
    expect(new Set(keys).size).toBe(3)
  })
})
