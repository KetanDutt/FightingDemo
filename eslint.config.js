import globals from 'globals';

/**
 * ESLint flat configuration (ESLint 9+).
 *
 * The game targets modern browsers; Node globals are allowed because the
 * tooling and unit tests run in Node.
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'public/**', '.tmp/**'],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-fallthrough': 'error',
      'no-self-assign': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'warn',
      'object-shorthand': ['warn', 'properties'],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    // Tests are allowed to log: their output *is* the report.
    files: ['tests/**/*.mjs', 'tools/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
];
