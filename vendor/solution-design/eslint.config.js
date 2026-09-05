import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    rules: {
      // `ignoreRestSiblings` permits the one idiom that needs it: omitting a
      // property by destructuring it away (`const { color: _c, ...rest } = x`).
      // Narrower than a `^_` varsIgnorePattern, which would excuse every
      // unused local that happened to be named with a leading underscore.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
