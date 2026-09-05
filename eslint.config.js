import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * The shell. The package under `vendor/` has its own config; this one covers
 * `src/`.
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
 *   core/        arithmetic. No React, no browser, no storage.
 *   ports/       the seams: interfaces, no implementations.
 *   adapters/    the outside world, one per flavour. May know about browsers.
 *   ui/          React.
 *   composition  who gets which adapter — the only place that knows both.
 *
 * References point inward. `core` knows nobody, `adapters` and `ui` talk to
 * `ports`, and only `composition.ts` chooses.
 */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'vendor/**', 'public/**', '*.config.ts', '*.config.js'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
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
    // The core computes. If it can see React or an adapter it is no longer a
    // core: you cannot test it in node and you cannot reuse it on the desktop.
    files: ['src/core/**/*.ts', 'src/ports/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.contract.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-dom', 'react/*', '@mui/*', '@emotion/*', '@xyflow/*'],
            message: 'core and ports compute; screen work belongs in src/ui.' },
          { group: ['**/adapters/**', '**/composition'],
            message: 'References point inward: a seam may not know its filling.' },
        ],
      }],
    },
  },
  {
    // Screen work talks to a seam, never to a filling: otherwise the choice is
    // back in twenty places instead of in the composition.
    files: ['src/ui/**/*.{ts,tsx}', 'src/main.tsx'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/adapters/**'],
            message: 'Ask for a ProjectStore / PreferencesStore / DocumentGateway; src/composition.ts picks which.' },
        ],
      }],
    },
  },
)
