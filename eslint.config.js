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
  {
    // These modules compute. If one can see React or an adapter it stops being
    // pure: you cannot test it in node and you cannot reuse it on the desktop.
    // Listed by module rather than by a `**` glob because `decisions/`,
    // `documentation/` and `search/` are pure at their root and React under
    // their `ui/`, which is the shape every module with a screen has.
    files: [
      'src/model/**/*.ts', 'src/layout/**/*.ts', 'src/platform/**/*.ts',
      'src/projects/**/*.ts', 'src/ports/**/*.ts',
      'src/decisions/*.ts', 'src/documentation/*.ts', 'src/search/*.ts',
    ],
    // `model/types.ts` is exempt for exactly as long as it takes to split it:
    // it is the editor package's old contract file, half domain and half props,
    // and the props half imports `ReactNode`. The next commit moves that half
    // to `editor/props.ts` and this line goes with it.
    ignores: ['**/*.test.ts', '**/*.contract.ts', 'src/model/types.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-dom', 'react/*', '@mui/*', '@emotion/*', '@xyflow/*'],
            message: 'This module computes; screen work belongs in its ui/ folder, in editor/ or in app/.' },
          { group: ['**/adapters/**', '**/composition'],
            message: 'References point inward: a seam may not know its filling.' },
        ],
      }],
    },
  },
  {
    // Screen work talks to a seam, never to a filling: otherwise the choice is
    // back in twenty places instead of in the composition.
    files: ['src/app/**/*.{ts,tsx}', 'src/*/ui/**/*.{ts,tsx}', 'src/editor/**/*.{ts,tsx}'],
    // Tests may reach for a filling directly — that is how you get an in-memory
    // store into a component — and `app/testing/` is test code that happens not
    // to end in `.test`. The composition is the one place that chooses.
    ignores: ['**/*.test.{ts,tsx}', 'src/app/testing/**', 'src/app/composition.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/adapters/**'],
            message: 'Ask for a ProjectStore / PreferencesStore / DocumentGateway; src/app/composition.ts picks which.' },
        ],
      }],
    },
  },
)
