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
 * A provider is registered by the composition root and by nothing else: the
 * app asks for a source's parts and draws its chrome where the registration
 * says, and an adapter fills one seam without a screen. Either reaching into
 * `providers/` would be a second place that chooses where work is kept.
 */
describe('the providers', () => {
  const importing = "import { FOLDER } from '../providers/folder/folderSource'\nexport const one = FOLDER\n"

  it('are imported by the composition root and nothing else of the app', async () => {
    expect(await layeringAt('src/app/composition.ts', importing)).toEqual([])
    expect((await layeringAt('src/app/one.ts', importing)).join('\n')).toMatch(/ProjectStore/)
  })

  it('are not imported by an adapter', async () => {
    expect((await layeringAt('src/adapters/one.ts', importing)).join('\n')).toMatch(/An adapter fills one seam/)
  })

  it('may import an adapter, the words and the widgets, and no screen of the app', async () => {
    const reaching = "import { browserStorage } from '../../adapters/webStorage/available'\nimport { useStrings } from '../../i18n'\nimport { TidyIcon } from '../../widgets/icons'\nexport const one = [browserStorage, useStrings, TidyIcon]\n"
    expect(await layeringAt('src/providers/folder/one.tsx', reaching)).toEqual([])
    const app = "import { App } from '../../app/App'\nexport const one = App\n"
    expect((await layeringAt('src/providers/folder/one.tsx', app)).join('\n')).toMatch(/A provider is a place work is kept/)
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

/**
 * The one edge narrower than a module (`NARROW_EDGES` in `eslint.config.js`):
 * the node side reads the folder's own format and nothing else of the
 * implementations, and the format does not read the node side back.
 */
describe('the node side and the folder\'s format', () => {
  it('lets the node side read the folder\'s format', async () => {
    const reading = "import { LOCAL_SETTINGS_PATH } from '../../adapters/folder/format/folderSettings'\nexport const one = LOCAL_SETTINGS_PATH\n"
    expect(await layeringAt('src/platform/node/one.ts', reading)).toEqual([])
  })

  it('refuses the node side every other part of the implementations', async () => {
    for (const source of [
      "import { memoryRepositories } from '../../adapters/memory/memoryRepositories'\nexport const one = memoryRepositories\n",
      "import { folderRepositories } from '../../adapters/folder/folderRepositories'\nexport const one = folderRepositories\n",
      "import * as all from '../../adapters'\nexport const one = all\n",
      "import { folderRepositories } from '../../adapters/folder/format/../folderRepositories'\nexport const one = folderRepositories\n",
      "import { memoryGit } from '../../adapters/folder/format/examples/../../memoryGit'\nexport const one = memoryGit\n",
    ]) {
      expect((await layeringAt('src/platform/node/one.ts', source)).join('\n'), source).toMatch(/Node and nothing else/)
    }
  })

  it('refuses the folder\'s format the node side', async () => {
    const reading = "import { gitStatus } from '../../../platform/node/git'\nexport const one = gitStatus\n"
    expect((await layeringAt('src/adapters/folder/format/one.ts', reading)).length).toBeGreaterThan(0)
  })
})

