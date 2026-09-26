// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the two workflows promise about delivery, read off their text.
 *
 * Neither runs here, and a step deleted from a workflow is noticed on the run
 * that needed it — for a release, after the installers are out. So the
 * promises are asserted on the files: the check audits what the bundle is
 * built from, every installer is attested, and every action is pinned to a
 * commit rather than a tag somebody can move.
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

  it('attest every installer a build job made, with the sums it wrote, and may', () => {
    const release = workflow('release.yml')
    expect(release).toMatch(/uses: actions\/attest-build-provenance@[0-9a-f]{40} # v\d/)
    expect(release).toMatch(/subject-checksums: installers\.sha256/)
    expect(release).toMatch(/cat \.\/\*\.sha256 > \.\.\/installers\.sha256/)
    const build = release.slice(release.indexOf('\n  build:'), release.indexOf('\n  checksums:'))
    expect(build).toMatch(/id-token: write/)
    expect(build).toMatch(/attestations: write/)
  })

  it('pin every action to a commit', () => {
    for (const name of ['check.yml', 'release.yml']) {
      const unpinned = workflow(name).split('\n').filter((line) => /uses: /.test(line) && !/@[0-9a-f]{40}\b/.test(line))
      expect(unpinned, name).toEqual([])
    }
  })
})
