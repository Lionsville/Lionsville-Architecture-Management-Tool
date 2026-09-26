// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { keepOnly, merge, parsePart, type Bom } from './sbom'

const component = (name: string, version = '1.0.0') => ({ 'bom-ref': `${name}@${version}`, name, version })

const whole: Bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  metadata: { component: component('app', '0.0.0') },
  components: [component('react'), component('vitest'), component('scheduler')],
  dependencies: [
    { ref: 'app@0.0.0', dependsOn: ['react@1.0.0', 'vitest@1.0.0'] },
    { ref: 'react@1.0.0', dependsOn: ['scheduler@1.0.0'] },
    { ref: 'vitest@1.0.0', dependsOn: ['scheduler@1.0.0'] },
  ],
}

describe('a bill of materials for what ships', () => {
  it('keeps the shipped components and the graph between them, and drops the toolchain', () => {
    const kept = keepOnly(whole, new Set(['react', 'scheduler']))
    expect(kept.components?.map((one) => one.name)).toEqual(['react', 'scheduler'])
    expect(kept.dependencies).toEqual([
      { ref: 'app@0.0.0', dependsOn: ['react@1.0.0'] },
      { ref: 'react@1.0.0', dependsOn: ['scheduler@1.0.0'] },
    ])
    expect(kept.metadata).toEqual(whole.metadata)
  })

  it('makes one document of several installs, every component once', () => {
    const server: Bom = {
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      metadata: { component: component('server') },
      components: [component('fastify'), component('react')],
      dependencies: [{ ref: 'server@1.0.0', dependsOn: ['fastify@1.0.0'] }],
    }
    const both = merge([keepOnly(whole, new Set(['react'])), server])
    expect(both.metadata?.component?.name).toBe('app')
    expect(both.components?.map((one) => one['bom-ref'])).toEqual(['fastify@1.0.0', 'react@1.0.0'])
    expect(both.dependencies).toContainEqual({ ref: 'server@1.0.0', dependsOn: ['fastify@1.0.0'] })
  })

  it('reads a part as an install and what it ships', () => {
    expect(parsePart('.=src,electron')).toEqual({ install: '.', sources: ['src', 'electron'] })
    expect(parsePart('.=production')).toEqual({ install: '.', production: true })
    expect(() => parsePart('src')).toThrow(/a part is/)
  })
})

describe('the release', () => {
  it('puts a bill of materials, and its checksum, on every release', () => {
    const release = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
    expect(release).toMatch(/node build\/sbom\.ts "sbom-\$VERSION\.cdx\.json" \.=src,electron/)
    expect(release).toMatch(/gh release upload [^\n]*\\\n\s+"sbom-\$VERSION\.cdx\.json" "sbom-\$VERSION\.cdx\.json\.sha256"/)
  })
})
