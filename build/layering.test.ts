/**
 * The import matrix in `eslint.config.js`, asked about files that are not there.
 *
 * The matrix is an allow-list only if a folder nobody listed is refused rather
 * than left out of every rule, and that is a property of the config that no
 * file in the tree exercises — the day it stops holding, nothing goes red. So
 * the linter is handed a file at a path that does not exist and asked what it
 * thinks.
 */
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
// Without the types: the files asked about here do not exist, so no program
// holds them, and what is asked is the layering — which reads the path and the
// import lines and nothing a compiler knows. `promises.test.ts` asks the rules
// that do need the types.
const eslint = new ESLint({
  cwd: root,
  overrideConfig: {
    languageOptions: { parserOptions: { projectService: false, project: null } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
    },
  },
})

const HEADER = '// SPDX-License-Identifier: AGPL-3.0-only\n// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV\n\n'

const LAYERING = [
  'layering/known-module', 'no-restricted-imports', '@typescript-eslint/no-restricted-imports', 'no-restricted-globals',
]

/** What the layering rules say about `source`, were it at `path`. */
async function layeringAt(path: string, source = 'export const one = 1\n'): Promise<string[]> {
  const [result] = await eslint.lintText(`${HEADER}${source}`, { filePath: path })
  return result.messages
    .filter((message) => LAYERING.includes(message.ruleId ?? ''))
    .map((message) => message.message)
}

describe('the import matrix', () => {
  it('fails a file in a folder under src/ that is not a module', async () => {
    const said = await layeringAt('src/stray/one.ts')
    expect(said).toHaveLength(1)
    expect(said[0]).toMatch(/`src\/stray` is not a module/)
  })

  it('fails a file of code at the root of src/, which is in no module either', async () => {
    expect(await layeringAt('src/loose.ts')).toHaveLength(1)
  })

  it('passes a file in a module, and a declaration at the root', async () => {
    expect(await layeringAt('src/model/one.ts')).toEqual([])
    expect(await layeringAt('src/ambient.d.ts', 'declare const one: number\n')).toEqual([])
  })

  /** The rows still apply to the modules they name: the allow-list did not replace them. */
  it('still refuses what a module\'s row does not allow', async () => {
    const said = await layeringAt('src/model/one.ts', "import { App } from '../app/App'\nexport const one = App\n")
    expect(said.join('\n')).toMatch(/model is the bottom of the tree/)
  })
})

/**
 * The registry imports every slice, so a process that wants one sentence in
 * English loads all of them; a slice that imported a helper or read a global
 * would be that process failing at its first import.
 */
describe('a translation slice', () => {
  it('may name its English twin\'s type', async () => {
    expect(await layeringAt('src/app/strings/nl.ts', "import type { EN } from './en'\nexport const NL = {} satisfies Partial<Record<keyof typeof EN, string>>\n"))
      .toEqual([])
  })

  it('may import nothing it would have to evaluate, even from its own module', async () => {
    const said = await layeringAt('src/app/strings/en.ts', "import { EN as MORE } from '../../model/strings/en'\nexport const EN = { ...MORE }\n")
    expect(said.join('\n')).toMatch(/a translation slice is a table/i)
  })

  it('names no global a process without a browser lacks, and neither does the registry', async () => {
    const reading = "export const EN = { key: navigator.platform === 'MacIntel' ? '\u2318' : 'Ctrl' }\n"
    expect(await layeringAt('src/editor/strings/en.ts', reading)).toHaveLength(1)
    expect(await layeringAt('src/i18n/strings.ts', 'export const here = window.location.href\n')).toHaveLength(1)
  })
})
