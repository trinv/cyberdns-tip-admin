import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'drizzle',
      'node_modules',
      'public/maplibre-gl',
      // Vendored verbatim from mapcn (mapcn.dev) — reformatting/linting it
      // just makes future upstream syncs harder.
      'src/components/ui/map.tsx',
      // Config files that aren't part of the app's own source.
      '*.config.{js,ts}',
      'scripts/copy-maplibre-worker.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    // eslint-plugin-react-hooks 7's `recommended-latest` preset still ships a
    // string-array `plugins` key, which current flat-config ESLint rejects —
    // register the plugin ourselves and pull in just its rule set.
    plugins: {
      'react-refresh': reactRefresh,
      'react-hooks': reactHooks,
      'unused-imports': unusedImports,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // The codebase uses `any` deliberately in a number of well-understood
      // spots (Drizzle `Record<string, any>` set-objects, Express error
      // handlers). Flag it as advisory, not a build-breaker.
      '@typescript-eslint/no-explicit-any': 'off',
      // Same for non-null assertions — used sparingly and on purpose.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // unused-imports/* replaces the tseslint rule: no-unused-imports is
      // autofixable (strips the dead import), no-unused-vars keeps flagging
      // genuinely dead locals.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      // Dead locals / props: `warn` for now — a dedicated dead-code pass
      // (DEBT-04: savedFilters scaffolding, release-alert props, MobileBottomNav)
      // removes them, then this flips to `error`.
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Empty `catch {}` is a real pattern here (best-effort cleanup).
      'no-empty': ['error', { allowEmptyCatch: true }],
      // New react-hooks v7 rules that flag legitimate, widespread patterns
      // here — surface them, don't block the build. exhaustive-deps fixes in
      // particular are behaviour-risky.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // The codebase has its own deliberate error-cause convention
      // (`if (e instanceof Error && !e.cause) throw e; throw new Error(msg,
      // { cause: e })`); this rule double-flags spots where that's already
      // handled. Advisory only.
      'preserve-caught-error': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Node scripts + build tooling: browser globals don't apply.
    files: ['scripts/**', 'server.ts', 'src/db/**', 'src/lib/**', 'src/middleware/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-unused-expressions': 'off' },
  },
);
