import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // catch {} kosong dipakai sengaja untuk menelan error non-kritis
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Aturan eksperimental react-hooks v7 (RC): advisory, bukan bug. Diturunkan ke
      // 'warn' agar bug nyata (no-undef/no-unused-vars/dll) tidak terkubur noise.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  // Script build/tooling & worker = lingkungan Node (process, Buffer, require, dll).
  // Tanpa ini, ESLint salah menandai global Node sebagai no-undef (false-positive).
  {
    files: ['scripts/**/*.{js,cjs}', '*.cjs', 'worker/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
