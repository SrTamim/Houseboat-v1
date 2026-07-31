import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

/**
 * Flat config (ESLint 9). Replaces the old .eslintrc.cjs, which ESLint 9 no
 * longer reads — the lint script aborted with "couldn't find an eslint.config"
 * before examining a single file.
 *
 * Deliberately built from the installed @typescript-eslint plugin rather than
 * the `typescript-eslint` meta-package: that package (and `globals`) are not
 * resolvable in this workspace, so language options are spelled out instead.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'prisma/seed.ts'] },
  ...tsPlugin.configs['flat/recommended'],
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Destructure-to-omit is a deliberate idiom in the env specs
      // (`const { REDIS_URL: _omitted, ...rest } = good`). Without these
      // options those lines error, and "fixing" them would break the tests.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Prettier last: turns off stylistic rules it owns.
      ...prettier.rules,
    },
  },
];