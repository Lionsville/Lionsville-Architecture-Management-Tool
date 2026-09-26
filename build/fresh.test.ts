// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { staleness } from './fresh'

let root = ''
const at = (path: string, minutesAgo: number) => {
  const when = new Date(Date.now() - minutesAgo * 60_000)
  utimesSync(join(root, path), when, when)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lv-fresh-'))
  mkdirSync(join(root, 'src', 'node_modules'), { recursive: true })
  mkdirSync(join(root, 'out', 'renderer'), { recursive: true })
  writeFileSync(join(root, 'src', 'a.ts'), '')
  writeFileSync(join(root, 'src', 'node_modules', 'dep.js'), '')
  writeFileSync(join(root, 'out', 'main.cjs'), '')
  writeFileSync(join(root, 'out', 'renderer', 'index.js'), '')
  at('src/a.ts', 30)
  at('src/node_modules/dep.js', 1)
  at('out/main.cjs', 10)
  at('out/renderer/index.js', 9)
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('a build and what it was built from', () => {
  it('is fresh when every source is older than the build, whatever an install did since', () => {
    expect(staleness(join(root, 'out'), [join(root, 'src')])).toBeUndefined()
  })

  it('is stale when a source changed after the build started, and says which', () => {
    at('src/a.ts', 5)
    expect(staleness(join(root, 'out'), [join(root, 'src')])).toMatch(/older than .*a\.ts \(by 5 min\); build it again\./)
  })

  it('is not a build at all when the output is missing', () => {
    expect(staleness(join(root, 'nothing'), [join(root, 'src')])).toMatch(/is not built/)
  })

  it('takes a file as a source as well as a folder, and ignores one that is not there', () => {
    writeFileSync(join(root, 'index.html'), '')
    at('index.html', 2)
    expect(staleness(join(root, 'out'), [join(root, 'src'), join(root, 'gone'), join(root, 'index.html')])).toMatch(/index\.html/)
  })
})
