// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  isForeignSpec,
  licenceAllowed,
  licenceProblems,
  lockfileProblems,
  policyProblems,
  runtimeListProblems,
  singletonProblems,
  type Lockfile,
} from './dependencies'
import { policy } from './dependencyPolicy'

const root = fileURLToPath(new URL('..', import.meta.url))
const tarball = (name: string, version: string) => `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`
const entry = (name: string, version: string, extra: object = {}) => ({
  version, resolved: tarball(name, version), integrity: 'sha512-x', ...extra,
})

describe('the lockfile', () => {
  it('takes the registry and nothing else', () => {
    const lock: Lockfile = {
      lockfileVersion: 3,
      packages: {
        '': {},
        'node_modules/react': entry('react', '19.0.0'),
        'node_modules/fromgit': { version: '1.0.0', resolved: 'git+ssh://git@github.com/a/b.git#abc', integrity: 'sha512-x' },
        'node_modules/plain': { version: '1.0.0', resolved: 'http://registry.npmjs.org/plain/-/plain-1.0.0.tgz', integrity: 'sha512-x' },
        'node_modules/unhashed': { version: '1.0.0', resolved: tarball('unhashed', '1.0.0') },
        'node_modules/linked': { link: true, resolved: '../linked' },
        'node_modules/parent/node_modules/carried': { version: '1.0.0', inBundle: true },
      },
    }
    const said = lockfileProblems(lock, {})
    expect(said).toHaveLength(4)
    expect(said.join('\n')).toMatch(/fromgit resolves to git\+ssh/)
    expect(said.join('\n')).toMatch(/plain resolves to http:/)
    expect(said.join('\n')).toMatch(/unhashed has no integrity hash/)
    expect(said.join('\n')).toMatch(/linked is a link/)
  })

  it('refuses a manifest that installs from anywhere but the registry', () => {
    expect(isForeignSpec('^19.0.0')).toBe(false)
    expect(isForeignSpec('npm:string-width@^4')).toBe(false)
    expect(isForeignSpec('$elkjs')).toBe(false)
    expect(isForeignSpec('latest')).toBe(false)
    for (const spec of ['git+https://github.com/a/b.git', 'github:a/b', 'a/b', 'file:../x', 'link:../x', 'http://x/y.tgz', 'https://x/y.tgz']) {
      expect(isForeignSpec(spec), spec).toBe(true)
    }
    const said = lockfileProblems({ lockfileVersion: 3, packages: {} }, {
      dependencies: { ok: '^1.0.0', bad: 'file:../bad' },
      overrides: { mermaid: { elkjs: '$elkjs', evil: 'github:a/b' } },
    })
    expect(said).toEqual([
      'package.json dependencies bad is "file:../bad", which is not the registry.',
      'package.json overrides mermaid > evil is "github:a/b", which is not the registry.',
    ])
  })

  it('needs a lockfile that lists packages', () => {
    expect(lockfileProblems({ lockfileVersion: 1 }, {})).toHaveLength(1)
  })
})

describe('one copy of what must be one', () => {
  const lock: Lockfile = {
    lockfileVersion: 3,
    packages: {
      'node_modules/react': entry('react', '19.3.0'),
      'node_modules/@mui/material': entry('@mui/material', '9.4.0'),
      'node_modules/@mui/utils': entry('@mui/utils', '9.4.0'),
      'node_modules/other/node_modules/@mui/utils': entry('@mui/utils', '7.0.0'),
    },
  }

  it('fails a second version, by name, including one inside a scope', () => {
    expect(singletonProblems(lock, ['react', 'react/jsx-runtime', '@mui/*'])).toEqual([
      '@mui/utils must be one copy and is installed as 7.0.0, 9.4.0.',
    ])
  })

  it('fails a singleton that is not installed at all', () => {
    expect(singletonProblems(lock, ['react-dom'])).toEqual(['react-dom must be one copy and is not installed at all.'])
  })

  it('holds a tree to the versions of the tree it builds against', () => {
    const pinned: Lockfile = { lockfileVersion: 3, packages: { 'node_modules/react': entry('react', '19.2.0') } }
    expect(singletonProblems(lock, ['react', '@mui/material'], pinned)).toEqual([
      'react is 19.3.0 here and 19.2.0 in the tree it builds against.',
      '@mui/material 9.4.0 is installed here and not in the tree it builds against.',
    ])
  })
})

describe('licences', () => {
  const allowed = new Set(['MIT', 'Apache-2.0', 'MPL-2.0'])

  it('reads an SPDX expression', () => {
    expect(licenceAllowed('MIT', allowed)).toBe(true)
    expect(licenceAllowed('mit', allowed)).toBe(true)
    expect(licenceAllowed('(MPL-2.0 OR Apache-2.0)', allowed)).toBe(true)
    expect(licenceAllowed('EPL-2.0 OR GPL-3.0-or-later', allowed)).toBe(false)
    expect(licenceAllowed('MIT AND GPL-3.0-only', allowed)).toBe(false)
    expect(licenceAllowed('MIT AND (Apache-2.0 OR GPL-2.0)', allowed)).toBe(true)
    expect(licenceAllowed('GPL-2.0 WITH Classpath-exception-2.0', allowed)).toBe(false)
    expect(licenceAllowed('GPL-2.0 WITH Classpath-exception-2.0', new Set(['GPL-2.0 WITH Classpath-exception-2.0']))).toBe(true)
  })

  it('refuses what does not parse, rather than guessing', () => {
    for (const odd of ['', 'BSD', 'SEE LICENSE IN LICENSE.md', 'UNLICENSED', 'MIT OR', '(MIT', 'MIT)']) {
      expect(licenceAllowed(odd, allowed), odd).toBe(false)
    }
  })

  it('names the package that is outside the set, undeclared, or not the licence its exception was written for', () => {
    const said = licenceProblems(
      [
        { name: 'fine', version: '1', licence: 'MIT' },
        { name: 'strong', version: '2', licence: 'GPL-3.0-only' },
        { name: 'silent', version: '3' },
        { name: 'relicensed', version: '4', licence: 'BUSL-1.1' },
      ],
      [...allowed],
      {
        relicensed: { licence: 'LGPL-2.1-or-later', why: 'was LGPL' },
        gone: { licence: 'MIT', why: 'shipped once' },
      },
    )
    expect(said).toEqual([
      'strong 2 is GPL-3.0-only, which is not in the allowed set and has no exception.',
      'silent 3 declares no licence and ships no text this can read; it may not ship until one is known.',
      'relicensed 4 is BUSL-1.1; its exception was written for LGPL-2.1-or-later.',
      'The licence exception for gone names a package that no longer ships; remove it.',
    ])
  })
})

describe('the runtime list', () => {
  it('fails a package that ships without a line, a line gone stale, and a licence that moved', () => {
    const said = runtimeListProblems(
      [
        { name: 'listed', version: '1', licence: 'MIT' },
        { name: 'new', version: '1', licence: 'ISC' },
        { name: 'moved', version: '2', licence: 'Apache-2.0' },
      ],
      {
        listed: { licence: 'MIT', why: 'draws things' },
        moved: { licence: 'MIT', why: 'was MIT' },
        old: { licence: 'MIT', why: 'nothing needs it now' },
      },
      'policy.ts',
    )
    expect(said).toEqual([
      'new ships and is not on the runtime list in policy.ts: add it with its licence (ISC) and why it is needed.',
      'moved is Apache-2.0; policy.ts says MIT.',
      'old is on the runtime list in policy.ts and nothing ships it; remove the line.',
    ])
  })
})

describe('this tree, as installed', () => {
  // The same answer `npm run deps` gives, so a dependency added without its
  // line, its licence or its one copy is a red test as well as a red script.
  it('holds its policy', () => {
    expect(policyProblems(root, policy, 'build/dependencyPolicy.ts')).toEqual([])
  })

  it('lists a reason for everything it ships directly', () => {
    for (const [name, line] of Object.entries(policy.runtime)) expect(line.why.length, name).toBeGreaterThan(10)
  })
})
