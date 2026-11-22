/**
 * The import matrix in `eslint.config.js`, asked about files that are not there.
 *
 * The matrix is an allow-list only if a folder nobody listed is refused rather
 * than left out of every rule, and that is a property of the config that no
 * file in the tree exercises — the day it stops holding, nothing goes red. So
 * the linter is handed a file at a path that does not exist and asked what it
 * thinks.
 */
import { existsSync } from 'node:fs'
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
  'no-restricted-syntax',
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
 * The tier between the features and the shell (ADR-0049): a seam the window
 * fills, and the modules composed of features over it, in a fixed order. A
 * composed module reads the features its row names and what is before it in
 * that order; nothing below the tier reads it, and it never reads the shell.
 */
describe('a module composed of features', () => {
  it('may import a feature its row names, and the seam', async () => {
    const reading = "import { organisationFacts } from '../operating/organisationFacts'\nimport { holdWrite } from '../session/writeRefusals'\nexport const one = [organisationFacts, holdWrite]\n"
    expect(await layeringAt('src/units/one.ts', reading)).toEqual([])
  })

  it('may not import the shell', async () => {
    const reading = "import { App } from '../app/App'\nexport const one = App\n"
    expect((await layeringAt('src/units/one.ts', reading)).join('\n')).toMatch(/it knows no frame, no workspace and no boot/)
    expect((await layeringAt('src/session/one.ts', reading)).join('\n')).toMatch(/the shell fills it/)
    expect((await layeringAt('src/guidance/one.ts', reading)).join('\n')).toMatch(/what a page of any of them is handed/)
    expect((await layeringAt('src/organisation/one.ts', reading)).join('\n')).toMatch(/It knows no frame and no boot/)
  })

  it('is not imported by a feature it is composed of', async () => {
    const reading = "import { ChartPage } from '../units/ChartPage'\nexport const one = ChartPage\n"
    expect((await layeringAt('src/editor/one.ts', reading)).join('\n')).toMatch(/The editor takes a model and emits batches/)
  })

  it('does not reach the seam from below, nor a composed module after it from one before', async () => {
    const chart = "import { ChartPage } from '../units/ChartPage'\nexport const one = ChartPage\n"
    expect((await layeringAt('src/session/one.ts', chart)).join('\n')).toMatch(/the shell fills it/)
    const home = "import { ScopeHome } from '../organisation/ScopeHome'\nexport const one = ScopeHome\n"
    expect((await layeringAt('src/units/one.ts', home)).join('\n')).toMatch(/it knows no frame, no workspace and no boot/)
    expect((await layeringAt('src/guidance/one.ts', home)).join('\n')).toMatch(/what a page of any of them is handed/)
  })

  /**
   * A composed module is called what the domain calls things, and so are
   * files elsewhere: the rule reads where a specifier goes and not a name in
   * it, and a barrel would be reached by a specifier it could not tell from
   * such a file.
   */
  it('is not a file elsewhere that carries its name, and has no barrel to be mistaken for one', async () => {
    const unitsFile = "import type { Assignment } from '../units'\nimport { isUnit } from '../../model/units'\nexport const one = isUnit as unknown as Assignment\n"
    expect(await layeringAt('src/model/commands/one.ts', unitsFile)).toEqual([])
    const tools = "import { organisationKnown } from './organisation'\nexport const one = organisationKnown\n"
    expect(await layeringAt('src/agent/write/one.ts', tools)).toEqual([])
    for (const module of ['session', 'units', 'guidance', 'organisation']) {
      expect(existsSync(`${root}src/${module}/index.ts`) || existsSync(`${root}src/${module}/index.tsx`), module).toBe(false)
    }
  })

  it('is imported by the shell, and by a composed module after it', async () => {
    const reading = "import { ChartPage } from '../units/ChartPage'\nimport { drawRef } from '../guidance/RefDrawings'\nexport const one = [ChartPage, drawRef]\n"
    expect(await layeringAt('src/app/one.ts', reading)).toEqual([])
    expect(await layeringAt('src/organisation/one.ts', reading)).toEqual([])
  })
})

/**
 * The surface a build composed from this one imports (ADR-0022, amended):
 * entries that pass names on, a folder per kind of process that loads them.
 * Nothing in this tree imports them, each kind reads what its process may
 * load, and an entry is a list of names from files and nothing else.
 */
describe('the surface for a build composed from this one', () => {
  const offering = (from: string) => `export { one } from '${from}'\n`

  it('is imported by nothing in this tree, not by the shell and not by the composition root', async () => {
    const reading = "import { apply } from '../composed/process/model'\nexport const one = apply\n"
    expect((await layeringAt('src/model/one.ts', reading)).join('\n')).toMatch(/model is the bottom of the tree/)
    expect((await layeringAt('src/app/one.ts', reading)).join('\n')).toMatch(/ProjectStore/)
    expect((await layeringAt('src/organisation/one.ts', reading)).join('\n')).toMatch(/It knows no frame and no boot/)
    expect((await layeringAt('src/app/composition.ts', reading)).join('\n')).toMatch(/nothing in this tree imports it/)
    const fixtures = "import { element } from '../composed/testing/fixtures'\nexport const one = element\n"
    expect((await layeringAt('src/app/one.ts', fixtures)).join('\n')).toMatch(/ProjectStore/)
  })

  it('lets a process entry read what computes, the folder\'s format and the two files of the kit that are data', async () => {
    for (const from of [
      '../../model/reducer', '../../projects/scopePath', '../../ports/Repositories', '../../agent/tools', '../../people/person',
      '../../observations/observation', '../../business/coverage', '../../i18n/strings', '../../platform/errors',
      '../../adapters/folder/format/folderFormat', '../../widgets/kit/tokens', '../../widgets/kit/accent',
    ]) {
      expect(await layeringAt('src/composed/process/one.ts', offering(from)), from).toEqual([])
    }
  })

  it('refuses a process entry everything that draws, every other implementation, and the node side', async () => {
    for (const from of [
      '../../app/App', '../../editor/graph', '../../widgets/kit/Button', '../../widgets/icons', '../../widgets/kit/tokens/../Button',
      '../../documentation/ui/MarkdownView', '../../adapters/memory/memoryRepositories', '../../adapters/folder/folderRepositories',
      '../../adapters/folder/format/../memoryGit', '../../providers/folder/folderSource', '../../platform/node/git', '../../session/places',
    ]) {
      expect((await layeringAt('src/composed/process/one.ts', offering(from))).join('\n'), from).toMatch(/A process entry is loaded by a process with no screen/)
    }
    // A barrel carries its module's pages, and a pure module names the file.
    expect((await layeringAt('src/composed/process/one.ts', offering('../../people'))).length).toBeGreaterThan(0)
  })

  it('lets a node entry read the node side and what that folder reads, and nothing else', async () => {
    expect(await layeringAt('src/composed/node/one.ts', offering('../../platform/node/workingFile'))).toEqual([])
    expect(await layeringAt('src/composed/node/one.ts', offering('../../projects/scope'))).toEqual([])
    for (const from of ['../../agent/tools', '../../app/App', '../../adapters/folder/folderRepositories']) {
      expect((await layeringAt('src/composed/node/one.ts', offering(from))).join('\n'), from).toMatch(/A node entry re-exports what only a process with a node under it may load/)
    }
  })

  it('lets a renderer entry read the shell and what the shell reads, and no implementation', async () => {
    for (const from of ['../../app/composition', '../../widgets/kit/Button', '../../units/ChartPage', '../../session/places', '../../model/reducer']) {
      expect(await layeringAt('src/composed/renderer/one.ts', offering(from)), from).toEqual([])
    }
    for (const from of ['../../adapters/memory/memoryRepositories', '../../providers/folder/folderSource', '../../platform/node/git']) {
      expect((await layeringAt('src/composed/renderer/one.ts', offering(from))).join('\n'), from).toMatch(/A renderer entry re-exports what the shell may read/)
    }
  })

  it('lets a testing entry reach across the tree, as test support does', async () => {
    const reaching = "export { memoryRepositories } from '../../adapters/memory/memoryRepositories'\nexport { renderShell } from '../../app/testing/renderShell'\n"
    expect(await layeringAt('src/composed/testing/one.ts', reaching)).toEqual([])
  })

  it('holds an entry to names re-exported from a file: no star, no barrel, no other entry, no code', async () => {
    const said = async (source: string) => (await layeringAt('src/composed/renderer/one.ts', source)).join('\n')
    expect(await said("export * from '../../model/reducer'\n")).toMatch(/`export \*` offers whatever the file comes to hold/)
    expect(await said(offering('../../model'))).toMatch(/never a module's barrel/)
    expect(await said(offering('../../model/index'))).toMatch(/never a module's barrel/)
    expect(await said(offering('./kit'))).toMatch(/never another entry/)
    expect(await said(offering('../process/model'))).toMatch(/never another entry/)
    expect(await said('export const one = 1\n')).toMatch(/holds no code/)
    expect(await said("import { apply } from '../../model/reducer'\nexport { apply }\n")).toMatch(/imports nothing to use/)
    expect(await said("export { one } from '../../model/reducer'\nconsole.log(1)\n")).toMatch(/holds no code/)
    // The one entry that is an import for what it does.
    expect(await said("import '../../app/main'\n")).toBe('')
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

/**
 * The folder's format writes a decision record as a file of its own, and
 * reads what one is from the model (`model/adr.ts`): the decisions module
 * carries its words and its page, which a process with no screen that loads
 * the format has no use for.
 */
describe('an adapter and the decisions module', () => {
  it('may read what a decision record is from the model', async () => {
    const reading = "import { ADR_STATUSES } from '../../../model/adr'\nexport const one = ADR_STATUSES\n"
    expect(await layeringAt('src/adapters/folder/format/one.ts', reading)).toEqual([])
  })

  it('may not import the decisions module', async () => {
    const reading = "import { ADR_STATUSES } from '../../../decisions/adr'\nexport const one = ADR_STATUSES\n"
    expect((await layeringAt('src/adapters/folder/format/one.ts', reading)).join('\n')).toMatch(/An adapter fills one seam/)
  })
})
