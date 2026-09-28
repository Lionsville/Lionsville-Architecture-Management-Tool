// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the two workflows promise about delivery, read off their text.
 *
 * Neither runs here, and a step deleted from a workflow is noticed on the run
 * that needed it — for a release, after the installers are out. So the
 * promises are asserted on the files: the check audits what the bundle is
 * built from, what a release publishes is attested, a release builds no
 * installer, and every action is pinned to a commit rather than a tag
 * somebody can move.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const workflow = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../.github/workflows/${name}`, import.meta.url)), 'utf8')

describe('the workflows', () => {
  it('audit the whole tree at high before the check, since everything bundled is a dev dependency', () => {
    const check = workflow('check.yml')
    expect(check).toMatch(/- run: npm audit --audit-level=high\n\s+- run: npm run check/)
    expect(check).not.toMatch(/npm audit[^\n]*--omit=dev/)
  })

  it('attest what a release publishes, with the sums it wrote, and may', () => {
    const release = workflow('release.yml')
    expect(release).toMatch(/uses: actions\/attest-build-provenance@[0-9a-f]{40} # v\d/)
    expect(release).toMatch(/subject-checksums: SHA256SUMS/)
    const web = release.slice(release.indexOf('\n  web:'), release.indexOf('\n  web-host:'))
    expect(web).toMatch(/> SHA256SUMS/)
    expect(web).toMatch(/id-token: write/)
    expect(web).toMatch(/attestations: write/)
  })

  /**
   * ADR-0030: the desktop app is built and signed where it is downloaded from,
   * so a release here builds no installer and needs no signing credential. A
   * step that reached for one would be a secret nothing configures any more,
   * failing on the day of a release.
   */
  it('build no installer and read no secret but the run\'s own token', () => {
    const release = workflow('release.yml')
    expect(release).not.toMatch(/npx electron-builder|npm run (dist|pack):desktop/)
    const secrets = [...release.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1])
    expect(new Set(secrets)).toEqual(new Set(['GITHUB_TOKEN']))
  })

  it('pin every action to a commit', () => {
    for (const name of ['check.yml', 'release.yml']) {
      const unpinned = workflow(name).split('\n').filter((line) => /uses: /.test(line) && !/@[0-9a-f]{40}\b/.test(line))
      expect(unpinned, name).toEqual([])
    }
  })
})
