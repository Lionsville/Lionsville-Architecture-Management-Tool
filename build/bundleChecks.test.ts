// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bundleProblems,
  copiesProblems,
  findWordList,
  nodeOnlyProblems,
  noticedPackages,
  noticeProblems,
  ONE_OF_EACH,
  packageOfModule,
  parseWords,
  secretProblems,
  wordProblems,
  type Output,
} from './bundleChecks'

const out = (name: string, text: string, modules?: string[]): Output => ({ name, text, modules })

describe('one React', () => {
  const react = ONE_OF_EACH.react
  const dom = ONE_OF_EACH['react-dom']

  it('passes one of each', () => {
    expect(copiesProblems([out('index.js', `${react};${dom}`)])).toEqual([])
  })

  it('fails a second copy, in the same file or another, and names where', () => {
    expect(copiesProblems([out('index.js', `${react};${dom}`), out('chrome.js', react)])).toEqual([
      'react is in the bundle 2 times (index.js, chrome.js); it must be one copy.',
    ])
    expect(copiesProblems([out('index.js', `${react}${react}${dom}`)])[0]).toMatch(/2 times \(index\.js\)/)
  })

  it('fails none, which is either no React or a mark that moved', () => {
    expect(copiesProblems([out('index.js', dom)])[0]).toMatch(/^react is not in the bundle/)
  })
})

describe('nothing only Node has', () => {
  it('fails an import of a Node module in any of its spellings, and Vite\'s stand-in for one', () => {
    const said = nodeOnlyProblems([
      out('a.js', 'import{readFile as r}from"node:fs/promises";'),
      out('b.js', 'const c=require("child_process")'),
      out('c.js', 'await import("electron")'),
      out('d.js', 'export default {} // __vite-browser-external'),
      out('e.js', 'import x from"node:sqlite"'),
    ])
    expect(said).toEqual([
      'a.js imports node:fs/promises, which a browser or a renderer does not have.',
      'b.js imports child_process, which a browser or a renderer does not have.',
      'c.js imports electron, which a browser or a renderer does not have.',
      "d.js holds Vite's empty stand-in for a Node module: something the page imports reaches for one.",
      'e.js imports node:sqlite, which a browser or a renderer does not have.',
    ])
  })

  it('leaves prose and look-alikes alone', () => {
    expect(nodeOnlyProblems([out('a.js', 'const s="read the fs of the node: here";import"./fs.js"')])).toEqual([])
    expect(nodeOnlyProblems([out('style.css', '@import "fs"')])).toEqual([])
  })
})

describe('a list of words', () => {
  const list = parseWords([
    '# a heading',
    'Voorbeeldbedrijf',
    'ab',
    'word:Cargo',
    'case:word:XY',
    '',
    'tail   # a comment after it',
  ].join('\n'))

  it('reads the format the tree check reads', () => {
    expect(list.map((word) => word.line)).toEqual([2, 3, 4, 5, 7])
    const hit = (text: string) => list.filter((word) => word.pattern.test(text)).map((word) => word.line)
    expect(hit('the voorbeeldbedrijfs portal')).toEqual([2])
    expect(hit('a lab and an ab-test')).toEqual([])
    expect(hit('(ab)')).toEqual([3])
    expect(hit('cargos')).toEqual([])
    expect(hit('cargo ship')).toEqual([4])
    expect(hit('xy XY')).toEqual([5])
    expect(hit('detail')).toEqual([7])
  })

  it('names the file and the line, and never the word', () => {
    const said = wordProblems([out('index.js', 'const a="Voorbeeldbedrijf"')], { file: 'words.txt', words: list })
    expect(said).toEqual(['index.js matches line 2 of words.txt.'])
    expect(said.join('')).not.toMatch(/voorbeeld/i)
  })

  it('is found beside the checkout, and not invented where there is none', () => {
    const parent = mkdtempSync(join(tmpdir(), 'lv-words-'))
    try {
      mkdirSync(join(parent, 'docs', 'boundary'), { recursive: true })
      mkdirSync(join(parent, 'tree'))
      writeFileSync(join(parent, 'docs', 'boundary', 'words.txt'), 'x\n')
      expect(findWordList(join(parent, 'tree'))).toBe(join(parent, 'docs', 'boundary', 'words.txt'))
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
    const alone = mkdtempSync(join(tmpdir(), 'lv-alone-'))
    try {
      expect(findWordList(alone)).toBeUndefined()
    } finally {
      rmSync(alone, { recursive: true, force: true })
    }
  })
})

describe('secrets', () => {
  it('fails the shapes credentials have, naming the shape and not the value', () => {
    const key = ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' ')
    const token = `ghp_${'a'.repeat(36)}`
    const said = secretProblems([out('a.js', key), out('b.js', `const t="${token}"`), out('c.js', 'const k="AKIA' + 'ABCDEFGHIJKLMNOP"')])
    expect(said).toEqual([
      'a.js holds what looks like a private key.',
      'b.js holds what looks like a GitHub token.',
      'c.js holds what looks like an AWS access key.',
    ])
    expect(said.join('')).not.toContain(token)
  })

  it('fails a build-time variable baked in, by its name, and ignores a value too short to mean anything', () => {
    const said = secretProblems([out('index.js', 'const e={VITE_API:"https://internal.example.invalid",VITE_ON:"1"}')], {
      VITE_API: 'https://internal.example.invalid',
      VITE_ON: '1',
    })
    expect(said).toEqual(['index.js holds the value of VITE_API, which the build could see and must not bake in.'])
  })
})

describe('notices', () => {
  it('reads the package a module lives in, scoped or not, nested or not', () => {
    expect(packageOfModule('/r/node_modules/react/index.js')).toBe('react')
    expect(packageOfModule('/r/node_modules/@mui/material/Button/Button.js')).toBe('@mui/material')
    expect(packageOfModule('/r/node_modules/a/node_modules/@emotion/react/dist/x.js')).toBe('@emotion/react')
    expect(packageOfModule('/r/src/app/main.tsx')).toBeUndefined()
    expect(packageOfModule('\0vite/preload-helper.js')).toBeUndefined()
  })

  it('fails a bundled package the notices do not name', () => {
    const noticed = noticedPackages('# Third-party notices\n\n- react 19.3.0 — MIT\n- @mui/material 9.4.0 — MIT\n')
    expect([...noticed]).toEqual(['react', '@mui/material'])
    expect(noticeProblems([out('index.js', '', ['/r/node_modules/react/index.js', '/r/node_modules/@emotion/react/x.js', '/r/src/a.ts'])], noticed, 'NOTICES.md'))
      .toEqual(['@emotion/react is in the bundle and not in NOTICES.md; regenerate it (build/thirdPartyNotices.ts).'])
  })
})

describe('together', () => {
  it('holds a server bundle to the secrets only, and a page to everything', () => {
    const server = [out('main.js', 'import{readFile}from"node:fs"')]
    expect(bundleProblems(server, {})).toEqual([])
    expect(bundleProblems(server, { browser: true }).length).toBeGreaterThan(0)
  })

  it('does not read a binary as text', () => {
    expect(bundleProblems([out('libavoid.wasm', 'require("fs")'), out('index.js', `${ONE_OF_EACH.react}${ONE_OF_EACH['react-dom']}`)], { browser: true })).toEqual([])
  })
})

describe('the builds that use it', () => {
  it('checks the web build', async () => {
    const config = (await import('../vite.config')).default as { plugins?: unknown[] }
    const names = (config.plugins ?? []).flat().map((plugin) => (plugin as { name?: string } | undefined)?.name)
    expect(names).toContain('lv-bundle-checks')
  })
})
