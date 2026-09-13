import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  dependencyClosure,
  homepageOf,
  isShipped,
  licenseOf,
  noticesFor,
  packagesImportedBy,
  renderNotices,
  shipsCode,
  type Manifest,
} from './thirdPartyNotices'

const root = fileURLToPath(new URL('..', import.meta.url))
const COMMITTED = readFileSync(new URL('../THIRD-PARTY-NOTICES.md', import.meta.url), 'utf8')
const PRODUCT = 'The Lionsville Architecture Management Tool'

describe('what counts as shipped source', () => {
  it('is everything but the tests and their helpers', () => {
    expect(isShipped('src/model/keys.ts')).toBe(true)
    expect(isShipped('src/editor/canvas/Board.tsx')).toBe(true)
    expect(isShipped('src/model/keys.test.ts')).toBe(false)
    expect(isShipped('src/app/App.test.tsx')).toBe(false)
    expect(isShipped('src/ports/ProjectStore.contract.ts')).toBe(false)
    expect(isShipped('src/model/testing/landscape.ts')).toBe(false)
  })
})

describe('the packages a source names', () => {
  it('takes bare specifiers and leaves our own code and the host alone', () => {
    const found = packagesImportedBy([
      "import { useState } from 'react'\nimport { apply } from './reducer'",
      "import Button from '@mui/material/Button'\nimport { app } from 'electron'",
      "const { join } = require('node:path')\nawait import('elkjs/lib/elk.bundled.js')",
      "import wasm from '/libavoid.wasm'\nimport Worker from './router?worker'",
    ])
    expect(found).toEqual(['@mui/material', 'elkjs', 'react'])
  })

  it('keeps a scope with its name and drops the subpath', () => {
    expect(packagesImportedBy(["from '@xyflow/react/dist/style.css'"])).toEqual(['@xyflow/react'])
  })
})

describe('the dependency closure', () => {
  const tree: Record<string, Manifest> = {
    mermaid: { version: '1', dependencies: { khroma: '^2', dagre: '^1' } },
    khroma: { version: '2' },
    dagre: { version: '3', dependencies: { mermaid: '^1' } },
    '@types/dagre': { version: '4' },
  }
  const read = (name: string) => tree[name]

  it('follows dependencies and survives a cycle', () => {
    expect(dependencyClosure(['mermaid'], read)).toEqual(['dagre', 'khroma', 'mermaid'])
  })

  it('leaves out what is not installed rather than throwing', () => {
    expect(dependencyClosure(['mermaid', 'gone'], read)).not.toContain('gone')
  })

  it('leaves out type-only packages, which put no code in the app', () => {
    expect(shipsCode('@types/dagre')).toBe(false)
    expect(dependencyClosure(['@types/dagre'], read)).toEqual([])
  })
})

describe('reading a manifest', () => {
  it('takes the licence in any of the shapes npm has used', () => {
    expect(licenseOf({ license: 'MIT' })).toBe('MIT')
    expect(licenseOf({ license: { type: 'ISC' } })).toBe('ISC')
    expect(licenseOf({ licenses: [{ type: 'MIT' }, { type: 'GPL-2.0' }] })).toBe('MIT OR GPL-2.0')
    expect(licenseOf({})).toBeUndefined()
  })

  it('falls back to the repository when there is no homepage', () => {
    expect(homepageOf({ repository: { url: 'git+https://github.com/a/b.git' } })).toBe(
      'https://github.com/a/b',
    )
  })
})

describe('the notices document', () => {
  it('reproduces each licence text under its package', () => {
    const rendered = renderNotices(
      [{ name: 'thing', version: '1.2.3', license: 'MIT', text: 'Copyright (c) Someone\n' }],
      PRODUCT,
    )
    expect(rendered).toContain('## thing 1.2.3')
    expect(rendered).toContain('Licence: MIT')
    expect(rendered).toContain('Copyright (c) Someone')
  })

  it('fences a licence that is itself markdown with a fence in it', () => {
    const rendered = renderNotices(
      [{ name: 'thing', version: '1', license: 'EPL-2.0', text: '```\nnotice\n```' }],
      PRODUCT,
    )
    expect(rendered).toContain('````\n```\nnotice\n```\n````')
  })

  it('says where to read the original when a package ships no text', () => {
    const rendered = renderNotices(
      [{ name: 'fastdom', version: '1', license: 'MIT', homepage: 'https://example.test/fastdom' }],
      PRODUCT,
    )
    expect(rendered).toContain('ships no licence file')
    expect(rendered).toContain('https://example.test/fastdom')
  })

  it('points at the text for a package that declares nothing but ships one', () => {
    const rendered = renderNotices([{ name: 'khroma', version: '2', text: 'The MIT License' }], PRODUCT)
    expect(rendered).toContain('Licence: not declared; see the text below')
  })
})

describe('THIRD-PARTY-NOTICES.md as committed', () => {
  // The drift guard: a new dependency without a regenerated file is a red check,
  // rather than a release that quietly ships an incomplete notice.
  it('is what generating it now produces', () => {
    expect(renderNotices(noticesFor(root), PRODUCT)).toBe(COMMITTED)
  })

  it('names the libraries whose licences ask for more than a mention', () => {
    expect(COMMITTED).toContain('- elkjs ')
    expect(COMMITTED).toContain('EPL-2.0')
    expect(COMMITTED).toContain('- libavoid-js ')
    expect(COMMITTED).toContain('LGPL-2.1-or-later')
    // The one that started this: React Flow's badge is kept, and so is its text.
    expect(COMMITTED).toContain('- @xyflow/react ')
  })
})
