import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { linkedVersions, withDownloadLinks } from './readmeDownloads'

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

describe('the README download links', () => {
  it('all name one version, the one the version line names', () => {
    // The invariant the release workflow relies on: three links, one version.
    const versions = linkedVersions(README)
    expect(versions).toHaveLength(1)
    expect(README).toContain(`<sub>Version ${versions[0]} `)
  })

  it('move together to a new release', () => {
    const moved = withDownloadLinks(README, '9.8.7')
    expect(linkedVersions(moved)).toEqual(['9.8.7'])
    expect(moved).toContain('<sub>Version 9.8.7 ')
    for (const file of ['mac-arm64.dmg', 'win-x64.exe', 'linux-amd64.deb']) {
      expect(moved).toContain(
        `/releases/download/v9.8.7/lionsville-architecture-management-tool-9.8.7-${file}`,
      )
    }
    // And nothing else about the file changed.
    expect(withDownloadLinks(moved, linkedVersions(README)[0])).toBe(README)
  })

  it('is a no-op for the version already linked', () => {
    expect(withDownloadLinks(README, linkedVersions(README)[0])).toBe(README)
  })

  it('refuses a version that is not a stable one', () => {
    expect(() => withDownloadLinks(README, 'v1.2.3')).toThrow(/not a stable version/)
    expect(() => withDownloadLinks(README, '1.2.3-beta.1')).toThrow()
    expect(() => withDownloadLinks(README, 'latest')).toThrow()
  })
})
