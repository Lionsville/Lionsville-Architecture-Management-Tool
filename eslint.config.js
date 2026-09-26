import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import { relative } from 'node:path'

/**
 * Every line of TypeScript in the repository. The editor's tree under
 * `vendor/` used to have its own config; there is one now.
 *
 * The rules that matter are at the bottom: they guard the layering. An
 * architecture that lives only in a readme disappears in the third hurried
 * patch — not out of ill will, but because one `import` is always the shortest
 * path in the moment. These rules close that path, immediately, with a sentence
 * explaining why. That is cheaper than a review round and far cheaper than
 * pulling it apart again later.
 *
 * The layers, inside out:
 *
 *   model/ layout/ platform/   arithmetic. No React, no browser, no storage.
 *   ports/                     the seams: interfaces, no implementations.
 *   adapters/                  the outside world, one per flavour.
 *   ui/ in each module,
 *   editor/, app/              React.
 *   app/composition.ts         who gets which adapter — the only place that
 *                              knows both.
 *
 * References point inward. The pure modules know nobody, `adapters` and the
 * React side talk to `ports`, and only `app/composition.ts` chooses. The full
 * module-by-module matrix lands with the module indices; these are the rules
 * that were already here, pointing at where their code lives now.
 */

/**
 * THE IMPORT MATRIX — who may know about whom.
 *
 * A row per module, listing what it may import besides itself. Everything not
 * listed is an error with a sentence saying why, so the shape of the app is
 * readable here rather than reconstructable from three hundred import lines.
 *
 * Three modules are leaves everyone may read and so have short rows of their
 * own: `i18n` (the words), `platform` (a refusal, a diagnostic, the window) and
 * `widgets` (icons and one dialog, with no knowledge of the model). Nobody
 * imports `app`: it is the composition root, and a module that needs something
 * from it takes it as a prop.
 *
 * Generated rather than written out, because a hand-written matrix is where the
 * eleventh row quietly disagrees with the other ten — and because a per-module
 * `no-restricted-imports` block REPLACES the rule rather than adding to it, so
 * every row has to be complete.
 *
 * One row is a folder inside another module: `platform/node`, the only place in
 * `src/` that may say `node:`. It is a row rather than a rule of its own because
 * everything the matrix does for a module it has to do for this one too — most
 * of all keeping it OUT of every other row, since a renderer bundle that pulls
 * in `node:child_process` fails at the first import. It comes after `platform`
 * in this list on purpose: its files match both rows, and the last config wins,
 * so `platform`'s shorter row must not be the one left standing.
 */
const MODULES = [
  'model', 'layout', 'i18n', 'platform', 'platform/node', 'widgets', 'documentation', 'decisions', 'observations',
  'roadmap', 'business', 'technology', 'search', 'projects', 'editor', 'agent', 'ports', 'adapters', 'app',
]

const MAY_IMPORT = {
  model: ['i18n', 'platform'],
  layout: ['model', 'i18n', 'platform'],
  i18n: [],
  platform: ['i18n'],
  'platform/node': ['model', 'i18n', 'platform', 'projects'],
  widgets: ['i18n'],
  documentation: ['model', 'i18n', 'platform', 'widgets'],
  decisions: ['model', 'i18n', 'platform', 'widgets', 'documentation'],
  observations: ['model', 'i18n', 'platform', 'widgets', 'documentation'],
  roadmap: ['model', 'i18n', 'platform', 'widgets', 'documentation', 'decisions'],
  business: ['model', 'i18n', 'platform', 'widgets', 'documentation'],
  technology: ['model', 'i18n', 'platform', 'widgets'],
  search: ['model', 'i18n', 'platform', 'widgets', 'documentation', 'decisions', 'roadmap'],
  projects: ['model', 'i18n', 'platform', 'decisions', 'observations', 'ports'],
  editor: ['model', 'layout', 'i18n', 'platform', 'widgets', 'documentation', 'search'],
  agent: ['model', 'layout', 'i18n', 'platform', 'documentation', 'decisions', 'observations', 'business', 'search'],
  ports: ['model', 'platform', 'projects', 'agent'],
  adapters: ['model', 'platform', 'projects', 'ports', 'agent'],
  // `platform/node` is the one thing the top of the tree may not have either:
  // `app` is the renderer, and code that says `node:` cannot be in it.
  app: MODULES.filter((m) => m !== 'adapters' && m !== 'app' && m !== 'platform/node'),
}

const WHY = {
  model: 'The model is the bottom of the tree: the words and the platform are all it may know.',
  layout: 'Layout computes geometry over the model. It draws nothing and stores nothing.',
  i18n: 'The words know nobody — every module hands its own slice to the registry.',
  platform: 'A refusal, a diagnostic, the window. Everything may read it, so it may read almost nothing.',
  'platform/node': 'Node and nothing else: `node:` lives here, so this folder may read the pure modules and is imported by no module at all — only by a process that has a node under it (electron/main, or a build composed from this one).',
  widgets: 'An icon does not know what an element is. Anything model-shaped belongs in the module that draws it.',
  documentation: 'documentation renders a description: the model, the words and the widgets.',
  decisions: 'A decision is markdown about the model. It does not know how the model is drawn or where it is saved.',
  observations: 'An observation is what was seen and a cause what lies behind it (ADR-0021): markdown over the model, laid out in lanes. It does not know how the model is drawn or where it is saved.',
  roadmap: 'A roadmap is the model on a time axis, and the plans over it. It does not know how a landscape is drawn or where it is saved.',
  business: 'A sheet is laid out from the model\'s own trees, not dragged. It does not know what a canvas is, nor a project.',
  technology: 'A platform\'s report is derived from the rows that name it (ADR-0013). It is read, never drawn and never captured, so it does not know what a canvas is, nor a project.',
  search: 'search reads what it searches — the model, documentation, decisions, plans — and nothing that draws them.',
  projects: 'A project is what is saved and reopened: the model, its decisions, and the ports it is saved through.',
  editor: 'The editor takes a model and emits batches. Decisions and projects reach it as props.',
  agent: 'An agent asks about the landscape in the landscape\'s own terms — including a laid-out page, which is arithmetic like any other. It does not know how the model is drawn or where it is saved.',
  ports: 'A seam names what crosses it: a project, a model, a diagnostic, an agent\'s request.',
  adapters: 'An adapter fills one seam: the model, projects, ports, platform and the agent\'s vocabulary are all it may know.',
  app: 'Ask for a ProjectStore / PreferencesStore / DocumentGateway; src/app/composition.ts picks which.',
}

/**
 * Which modules compute and nothing else. React, MUI, Emotion or React Flow in
 * one of these means a node test has to boot a DOM to ask where a box goes —
 * which is how thirteen pure files ended up importing a canvas library for four
 * strings.
 *
 * Part of the same generated rule as the matrix rather than a block of its own,
 * because a second block naming the same files would REPLACE
 * `no-restricted-imports` instead of adding to it, and the matrix would silently
 * stop applying to exactly the modules that most need it.
 */
const PURE = ['model', 'layout', 'platform', 'platform/node', 'ports', 'projects', 'i18n', 'agent']
const SCREEN_PACKAGES = ['react', 'react-dom', 'react/*', '@mui/*', '@emotion/*', '@xyflow/*']

/**
 * The barrels that carry a page, and so are not a way in for a module that
 * computes.
 *
 * Keeping a pure module out of every `ui/` folder is not the same promise as
 * keeping a screen out of it, and the difference is a barrel: an `index.ts` at a
 * module's root, pure by its own extension, that re-exports its module's pages
 * so a screen can have them in one import. `agent/commandFor.ts` said
 * `from '../business'` for six pure functions and got React, MUI and three
 * dialogs with them — into the module the desktop's agent server loads in a
 * process that has no DOM at all.
 *
 * So a pure module names the file the function is in, which is what the module
 * map asks of every cross-module import anyway. Listed by hand because a lint
 * config cannot walk an import graph; `src/agent/pure.test.ts` walks the one
 * chain where it matters, and is what would catch a barrel that grows a page
 * after this line was written.
 *
 * `paths` rather than `patterns`, because this is the one restriction here that
 * has to be exact. A `group` is matched with gitignore semantics, where a
 * pattern ending in a folder's name covers everything *under* that folder too —
 * so a group naming the `i18n` barrel would forbid `i18n/strings` with it, which
 * is the file these imports are being sent to. A negated glob does not narrow a
 * group in this ESLint either (see the table's exemption above), so the four
 * spellings a barrel has from inside `src/` are written out instead.
 */
const BARRELS_THAT_DRAW = [
  'i18n', 'widgets', 'decisions', 'observations', 'roadmap', 'business', 'technology', 'search',
]

/** A barrel as it is written from inside `src/`: one level up, or two from `platform/node`. */
const barrelPaths = (from) => BARRELS_THAT_DRAW
  .filter((to) => to !== from)
  .flatMap((to) => [`../${to}`, `../../${to}`, `../${to}/index`, `../../${to}/index`])
  .map((name) => ({
    name,
    message: 'This module computes, and that barrel has pages on it: name the file the function is in.',
  }))


/**
 * The one hole in the matrix, and it is a hole on purpose.
 *
 * These two files ARE the composition: they import every module's `strings/`
 * slice and spread them into the table `t()` reads. It has to be a static
 * import, because `StringKey` is `keyof typeof EN` and a type cannot be built
 * from a runtime registration.
 *
 * Exempting the composing files rather than widening the row to every module's
 * strings folder, because a negated glob inside a `no-restricted-imports` group
 * does not narrow one in this ESLint — it is silently ignored, which would have
 * left the whole i18n row unenforced. Every other file in `i18n` knows nobody.
 */
const COMPOSES_THE_TABLE = [
  'src/i18n/strings.en.ts',
  'src/i18n/strings.nl.ts',
  'src/i18n/strings.fy.ts',
  'src/i18n/strings.de.ts',
]

/**
 * Files their own module's row does not apply to. `i18n` has both exceptions:
 * the files that compose the tables, and `LanguageContext` — a language needs
 * a context to travel in, and it is the one screen-shaped file down here.
 */
const EXEMPT = { i18n: ['src/i18n/LanguageContext.tsx', ...COMPOSES_THE_TABLE] }

/**
 * THE LICENCE, ON EVERY FILE.
 *
 * `LICENSE` says what the tree is under; a file that has left the tree — a
 * fork, a gist, an answer, a bug report — says nothing unless it carries the
 * line itself, and a licence scanner reads the file rather than the repository.
 * `scripts/spdx.mjs` wrote them once and can write the next one (`--check`
 * lists what is missing); this is what keeps a new file from arriving without.
 *
 * A local rule rather than a plugin: it is fifteen lines, and a dependency in
 * the lint config is a dependency in every contributor's install.
 */
const SPDX = [
  '// SPDX-License-Identifier: AGPL-3.0-only',
  '// SPDX-FileCopyrightText: 2024\u20132026 Lionsville Group BV',
]

const licenceHeader = {
  rules: {
    header: {
      meta: {
        type: 'problem',
        fixable: 'code',
        schema: [],
        messages: { missing: 'Every source file carries its licence. Run `node scripts/spdx.mjs`.' },
      },
      create(context) {
        return {
          Program(node) {
            const source = context.sourceCode ?? context.getSourceCode()
            const lines = source.getText().split('\n')
            // A shebang is the one line that has to come first; the header
            // goes under it.
            const at = lines[0]?.startsWith('#!') ? 1 : 0
            if (lines[at] === SPDX[0] && lines[at + 1] === SPDX[1]) return
            const offset = lines.slice(0, at).reduce((n, line) => n + line.length + 1, 0)
            context.report({
              node,
              loc: { line: at + 1, column: 0 },
              messageId: 'missing',
              fix: (fixer) => fixer.insertTextAfterRange([0, offset], `${SPDX.join('\n')}\n\n`),
            })
          },
        }
      },
    },
  },
}

/**
 * THE MATRIX IS AN ALLOW-LIST, AND THIS IS WHAT MAKES IT ONE.
 *
 * The rows below say what each module may import, and a module nobody listed
 * has no row — which used to mean no rule at all: a new folder under `src/`
 * could import anything, and anything could import it, because every `group`
 * is built from `MODULES` and a folder outside it is in no group. The matrix
 * was documented as an allow-list and behaved as a deny-list for the one case
 * an allow-list exists for.
 *
 * So a file under `src/` whose folder is not a module fails here, with the
 * sentence that says what to do about it. The answer is always the same: add
 * the folder to `MODULES` with a row of its own and a `WHY`, or put the file in
 * the module it belongs to. The declarations at the root of `src/` are the one
 * thing that is not in a module, and they hold no code.
 */
const TOP_LEVEL = new Set(MODULES.map((module) => module.split('/')[0]))

const knownModule = {
  rules: {
    'known-module': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          stray: '`src/{{folder}}` is not a module, so the import matrix says nothing about it. Add it to MODULES in eslint.config.js with a row and a reason, or move the file into the module it belongs to.',
          loose: 'A file at the root of `src/` is in no module, so the import matrix says nothing about it. Only declarations (`*.d.ts`) live there.',
        },
      },
      create(context) {
        return {
          Program(node) {
            // From the root of the repository rather than by looking for a
            // folder called `src` in the path, which a checkout may well sit in.
            const [top, ...inside] = relative(context.cwd, context.filename).split(/[\\/]/)
            if (top !== 'src') return
            if (inside.length === 1) {
              if (!inside[0].endsWith('.d.ts')) context.report({ node, messageId: 'loose' })
              return
            }
            if (!TOP_LEVEL.has(inside[0])) context.report({ node, messageId: 'stray', data: { folder: inside[0] } })
          },
        }
      },
    },
  },
}

const IMPORT_MATRIX = MODULES.map((from) => ({
  files: [`src/${from}/**/*.{ts,tsx}`],
  // Tests are exempt: a test reaching across the tree for a fixture is not the
  // coupling this guards against, and the alternative is a fixture module per
  // pair of modules. `app/testing/` is test code that happens not to end in
  // `.test`, and the composition is the one place that may name a filling.
  ignores: [
    '**/*.test.{ts,tsx}', '**/*.contract.ts', 'src/app/testing/**', 'src/app/composition.ts',
    ...(EXEMPT[from] ?? []),
  ],
  rules: {
    'no-restricted-imports': ['error', {
      paths: PURE.includes(from) ? barrelPaths(from) : [],
      patterns: [
        {
          group: MODULES
            .filter((to) => to !== from && !MAY_IMPORT[from].includes(to))
            .flatMap((to) => [`**/${to}/**`, `**/${to}`]),
          message: WHY[from],
        },
        ...(PURE.includes(from) ? [{
          group: SCREEN_PACKAGES,
          message: 'This module computes; screen work belongs in a ui/ folder, in editor/ or in app/.',
        }, {
          group: ['**/ui/**'],
          message: 'This module computes; a page belongs to whoever draws it.',
        }] : []),
      ],
    }],
  },
}))

/**
 * A TRANSLATION SLICE IS A TABLE, AND NOTHING ELSE.
 *
 * Every module keeps its words in `strings/<language>.ts`, and the registry
 * (`i18n/strings.ts`) imports every one of them to compose the table `t()`
 * reads. So whatever reaches the registry reaches every slice — `app/`'s and
 * `editor/`'s included — and a process with no screen reaches the registry the
 * moment it wants a sentence in English. That is fine for as long as a slice is
 * data. The day one of them imports a helper, or reads `navigator` to pick a
 * shortcut's name, that process fails at its first import, in a place nobody
 * was looking.
 *
 * So a slice imports nothing it has to evaluate — the type of its English
 * twin, and that is all it ever needs — and names no global a node process
 * lacks; the files the registry is made of name none either.
 * `i18n/registry.test.ts` walks the registry and loads it in a plain node
 * process, which is what this rule is the early sentence for.
 *
 * After the matrix, because a later block's `no-restricted-imports` replaces an
 * earlier one's for the same files; nothing is lost by it, since a slice that
 * may import nothing is inside every row. The storage globals are repeated for
 * the same reason.
 */
const NO_BROWSER = ['window', 'document', 'navigator', 'self', 'location', 'globalThis'].map((name) => ({
  name,
  message: 'The registry and every slice load in a process with no browser: a word is a string, and choosing one belongs to whoever draws it.',
}))
const STORAGE_GLOBALS = [
  { name: 'localStorage', message: 'Storage goes through a ProjectStore or PreferencesStore (src/ports), implemented in src/adapters.' },
  { name: 'sessionStorage', message: 'Storage goes through a store from src/ports, implemented in src/adapters.' },
]
const TRANSLATION_SLICES = [
  {
    files: ['src/**/strings/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [{
          regex: '.*',
          allowTypeImports: true,
          message: 'A translation slice is a table: it may name its English twin\'s type and import nothing it would have to evaluate.',
        }],
      }],
      'no-restricted-globals': ['error', ...STORAGE_GLOBALS, ...NO_BROWSER],
    },
  },
  {
    files: ['src/i18n/strings.ts', 'src/i18n/strings.*.ts', 'src/i18n/interpolate.ts', 'src/i18n/languages.ts', 'src/i18n/table.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-globals': ['error', ...STORAGE_GLOBALS, ...NO_BROWSER] },
  },
]

/**
 * THE SIZE OF A UNIT.
 *
 * A function's cyclomatic complexity at most 25, and at most 150 lines of
 * code, not counting blank lines and comments. Step 49 took the five units
 * that held the product's decision logic from 155, 150, 128, 127 and 115 down
 * to single figures by dispatching on a table and extracting the pieces; this
 * is what keeps that from growing back, and keeps the next one from starting.
 * Tests are held to the complexity and not to the length: a `describe` is one
 * function as long as its cases.
 *
 * **The units already over either line are listed, each at its own measure**
 * — the file's largest, the day this was written — so nothing listed can grow
 * and nothing new can arrive over the line. It is a ratchet, not an amnesty:
 * `build/unitSize.test.ts` fails when a listed file measures less than its
 * entry, so a unit made smaller takes its number down with it, and one that
 * no longer needs an entry loses it. Adding a file here, or raising a number,
 * is a decision said in the commit that does it.
 */
export const MOST_COMPLEX = 25
export const LONGEST_FUNCTION = 150

/** The units over the line on 26 September 2026: each file's largest, by rule. */
export const GROWN = {
  'electron/main/smoke.ts': { lines: 572 },
  'src/agent/answer.ts': { complexity: 101, lines: 352 },
  'src/agent/handle.ts': { complexity: 39 },
  'src/agent/screen.ts': { complexity: 27 },
  'src/agent/shell.ts': { complexity: 42 },
  'src/agent/tools.ts': { complexity: 34 },
  'src/app/history/HistoryPage.tsx': { lines: 218 },
  'src/app/history/useProjectHistory.ts': { lines: 164 },
  'src/app/organisation/OrganisationCards.tsx': { complexity: 38, lines: 180 },
  'src/app/organisation/OrganisationScreen.tsx': { complexity: 51, lines: 350 },
  'src/app/organisation/ScopeSettingsDialog.tsx': { lines: 160 },
  'src/app/organisation/organisationPages.ts': { complexity: 30 },
  'src/app/organisation/useOrganisation.ts': { lines: 321 },
  'src/app/useModelSession.ts': { lines: 336 },
  'src/business/ui/FunctionInspector.tsx': { lines: 153 },
  'src/business/ui/SheetPage.tsx': { complexity: 68, lines: 359 },
  'src/decisions/ui/AdrPage.tsx': { lines: 348 },
  'src/decisions/ui/AdrReader.tsx': { complexity: 26, lines: 195 },
  'src/documentation/bpmn.ts': { complexity: 31 },
  'src/documentation/ui/BpmnBlock.tsx': { complexity: 41 },
  'src/documentation/ui/DocumentSource.tsx': { lines: 198 },
  'src/documentation/ui/DocumentationPage.tsx': { complexity: 36, lines: 279 },
  'src/editor/ConnectionInspector.tsx': { complexity: 55, lines: 416 },
  'src/editor/EditorToolbar.tsx': { complexity: 57, lines: 431 },
  'src/editor/canvas/DiagramCanvas.tsx': { complexity: 29, lines: 1005 },
  'src/editor/canvas/DomainGroupLayer.tsx': { lines: 202 },
  'src/editor/canvas/ElementPalette.tsx': { lines: 479 },
  'src/editor/canvas/Layer7Canvas.tsx': { lines: 187 },
  'src/editor/canvas/ZoneLayer.tsx': { lines: 222 },
  'src/editor/edges/FloatingEdge.tsx': { complexity: 61, lines: 520 },
  'src/editor/graph.ts': { complexity: 38 },
  'src/editor/use-canvas-shortcuts.ts': { complexity: 37 },
  'src/editor/useEditorState.ts': { lines: 753 },
  'src/layout/tidy.ts': { complexity: 26, lines: 176 },
  'src/model/activity.ts': { complexity: 76 },
  'src/model/checks.ts': { complexity: 41 },
  'src/model/platformReport.ts': { complexity: 28 },
  'src/model/relations.ts': { complexity: 26 },
  'src/model/restore.ts': { complexity: 45 },
  'src/model/technologyLandscape.ts': { complexity: 41 },
  'src/observations/ui/ObservationsPage.tsx': { complexity: 43, lines: 819 },
  'src/observations/ui/Readers.tsx': { complexity: 41, lines: 153 },
  'src/observations/ui/SolutionPicture.tsx': { complexity: 26, lines: 224 },
  'src/observations/ui/SolutionReaders.tsx': { complexity: 56, lines: 281 },
  'src/projects/documentSession.ts': { complexity: 34 },
  'src/projects/folderFormat.ts': { complexity: 35 },
  'src/projects/scopeIndex.ts': { complexity: 44 },
  'src/roadmap/ui/PlanPage.tsx': { lines: 233 },
  'src/roadmap/ui/RoadmapPage.tsx': { lines: 397 },
  'src/technology/ui/TechnologyLandscapePage.tsx': { complexity: 63, lines: 359 },
}

const functionLines = (max) => ['error', { max, skipBlankLines: true, skipComments: true }]

const UNIT_SIZE = [
  {
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
    rules: { complexity: ['error', MOST_COMPLEX] },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.contract.ts', '**/testing/**'],
    rules: { 'max-lines-per-function': functionLines(LONGEST_FUNCTION) },
  },
  ...Object.entries(GROWN).map(([file, grown]) => ({
    files: [file],
    rules: {
      ...(grown.complexity ? { complexity: ['error', grown.complexity] } : {}),
      ...(grown.lines ? { 'max-lines-per-function': functionLines(grown.lines) } : {}),
    },
  })),
]

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', '*.config.ts', '*.config.js'],
  },
  {
    rules: {
      // `ignoreRestSiblings` permits the one idiom that needs it: omitting a
      // property by destructuring it away (`const { color: _c, ...rest } = x`).
      // Narrower than a `^_` varsIgnorePattern, which would excuse every unused
      // local that happened to be named with a leading underscore. It came from
      // the editor's config and is the better of the two, so it is now the rule
      // everywhere.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    /**
     * **Promises, checked with the types.** The renderer is a window that
     * saves, loads, watches a folder and answers an agent, and the main
     * process is the other end of every one of those: a promise nobody awaits
     * and nobody catches is a failure that happened and was never said —
     * in the renderer an unhandled rejection in a console nobody reads, in
     * main one that takes the process with it. None of the three is visible
     * without the types, which is why they are here and not in
     * `tseslint.configs.recommended`.
     *
     * A promise deliberately left running is written `void`, with its
     * rejection handled on the line or a comment saying who handles it (the
     * convention *A failure has somewhere to go* in CLAUDE.md asks the same);
     * a disable comment is not an answer to any of these.
     */
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    // The renderer's program, `tsconfig.json`, which the project service
    // finds for itself.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Main, the preload and the build's own code are the second program,
    // `tsconfig.electron.json`, and the project service only ever looks for a
    // file named `tsconfig.json` — so these are pointed at theirs by name.
    files: ['electron/**/*.ts', 'build/**/*.ts'],
    languageOptions: {
      parserOptions: { project: './tsconfig.electron.json', tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // The outside world belongs in an adapter. Once `localStorage` sits in an
    // ordinary file, the assumption "this runs in a browser" seeps through the
    // whole tree, and a second target (phase 6) stops being a layer and becomes
    // a search.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/adapters/**'],
    rules: {
      'no-restricted-globals': ['error',
        { name: 'localStorage', message: 'Storage goes through a ProjectStore or PreferencesStore (src/ports), implemented in src/adapters.' },
        { name: 'sessionStorage', message: 'Storage goes through a store from src/ports, implemented in src/adapters.' },
      ],
      'no-restricted-properties': ['error',
        { object: 'window', property: 'localStorage', message: 'Storage goes through src/ports + src/adapters.' },
        { object: 'window', property: 'showSaveFilePicker', message: 'File access goes through the DocumentGateway (src/ports).' },
        { object: 'window', property: 'showOpenFilePicker', message: 'File access goes through the DocumentGateway (src/ports).' },
      ],
    },
  },
  {
    // The three folders `scripts/spdx.mjs` writes into; anything else in the
    // tree is data, config or build output.
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.{ts,tsx}', 'scripts/**/*.{mjs,cjs,ts}'],
    ignores: ['**/*.d.ts'],
    plugins: { licence: licenceHeader },
    rules: { 'licence/header': 'error' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { layering: knownModule },
    rules: { 'layering/known-module': 'error' },
  },
  ...IMPORT_MATRIX,
  ...TRANSLATION_SLICES,
  ...UNIT_SIZE,

)
