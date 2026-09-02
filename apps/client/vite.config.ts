import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

// @preact/preset-vite installs the react -> preact/compat aliases by default
// (reactAliasesEnabled), so React-only libraries can be adopted later without
// migrating the UI stack. See docs/decisions/0001-foundation-stack.md.
export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
