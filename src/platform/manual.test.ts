import { describe, expect, it } from 'vitest'
import { manualUrl } from './manual'

describe('manualUrl', () => {
  it('names the manual file for the language, in the published repository', () => {
    expect(manualUrl('en')).toBe('https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/blob/main/docs/manual.en.md')
    expect(manualUrl('fy')).toMatch(/manual\.fy\.md$/)
  })
})
