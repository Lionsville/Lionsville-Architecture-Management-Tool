import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

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
 */
const MODULES = [
  'model', 'layout', 'i18n', 'platform', 'widgets', 'documentation', 'decisions',
  'search', 'projects', 'editor', 'ports', 'adapters', 'app',
]

const MAY_IMPORT = {
  model: ['i18n', 'platform'],
  layout: ['model', 'i18n', 'platform'],
  i18n: [],
  platform: ['i18n'],
  widgets: ['i18n'],
  documentation: ['model', 'i18n', 'platform', 'widgets'],
  decisions: ['model', 'i18n', 'platform', 'widgets', 'documentation'],
  search: ['model', 'i18n', 'platform', 'widgets', 'documentation', 'decisions'],
  projects: ['model', 'i18n', 'platform', 'decisions', 'ports'],
  editor: ['model', 'layout', 'i18n', 'platform', 'widgets', 'documentation', 'search'],
  ports: ['model', 'platform', 'projects'],
  adapters: ['model', 'platform', 'projects', 'ports'],
  app: MODULES.filter((m) => m !== 'adapters' && m !== 'app'),
}

const WHY = {
  model: 'The model is the bottom of the tree: the words and the platform are all it may know.',
  layout: 'Layout computes geometry over the model. It draws nothing and stores nothing.',
  i18n: 'The words know nobody — every module hands its own slice to the registry.',
  platform: 'A refusal, a diagnostic, the window. Everything may read it, so it may read almost nothing.',
  widgets: 'An icon does not know what an element is. Anything model-shaped belongs in the module that draws it.',
  documentation: 'documentation renders a description: the model, the words and the widgets.',
  decisions: 'A decision is markdown about the model. It does not know how the model is drawn or where it is saved.',
  search: 'search reads what it searches — the model, documentation, decisions — and nothing that draws them.',
  projects: 'A project is what is saved and reopened: the model, its decisions, and the ports it is saved through.',
  editor: 'The editor takes a model and emits batches. Decisions and projects reach it as props.',
  ports: 'A seam names what crosses it: a project, a model, a diagnostic.',
  adapters: 'An adapter fills one seam: the model, projects, ports and platform are all it may know.',
  app: 'Ask for a ProjectStore / PreferencesStore / DocumentGateway; src/app/composition.ts picks which.',
}

/**
 * Which modules compute and nothing else. React, MUI, Emotion or React Flow in
 * one of these means a node test has to boot a DOM to ask where a box goes —
 * which is how thirteen pure files ended up importing a canvas library for four
 * strings. Separate from the matrix because it restricts package names rather
 * than paths, and because `i18n` is on the list with one exception: a language
 * needs a context to travel in.
 */
const PURE = ['model', 'layout', 'platform', 'ports', 'projects', 'i18n']
const SCREEN_PACKAGES = ['react', 'react-dom', 'react/*', '@mui/*', '@emotion/*', '@xyflow/*']

const PURITY = [{
  files: PURE.map((m) => `src/${m}/**/*.ts`),
  // The module roots only: `documentation/`, `decisions/` and `search/` are pure
  // at their root and React under their `ui/`, which every `.tsx` here would
  // otherwise trip over. A `.ts` file that wanted React would have to become one.
  ignores: ['**/*.test.ts', '**/*.contract.ts', 'src/i18n/LanguageContext.tsx'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{ group: SCREEN_PACKAGES, message: 'This module computes; screen work belongs in a ui/ folder, in editor/ or in app/.' }],
    }],
  },
}]

const IMPORT_MATRIX = MODULES.map((from) => ({
  files: [`src/${from}/**/*.{ts,tsx}`],
  // Tests are exempt: a test reaching across the tree for a fixture is not the
  // coupling this guards against, and the alternative is a fixture module per
  // pair of modules. `app/testing/` is test code that happens not to end in
  // `.test`, and the composition is the one place that may name a filling.
  ignores: ['**/*.test.{ts,tsx}', '**/*.contract.ts', 'src/app/testing/**', 'src/app/composition.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: MODULES
          .filter((to) => to !== from && !MAY_IMPORT[from].includes(to))
          .flatMap((to) => [`**/${to}/**`, `**/${to}`]),
        message: WHY[from],
      }],
    }],
  },
}))

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
  ...IMPORT_MATRIX,
  ...PURITY,

)
