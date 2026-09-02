import { execFileSync } from 'node:child_process';

import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

/**
 * The commit this bundle was built from.
 *
 * `BUILD_SHA` wins, because the production image builds from a source copy that
 * deliberately has no `.git` directory (see deploy/stage0a/Dockerfile) — the
 * deploy script passes the SHA in. Falling back to git keeps `pnpm build` on a
 * developer machine honest, and `unknown` keeps the build working in an
 * exported tarball rather than failing over a diagnostic.
 */
function buildSha(): string {
  const provided = process.env.BUILD_SHA?.trim();
  if (provided !== undefined && provided !== '') {
    return provided.slice(0, 12);
  }

  try {
    const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    // A published build from an uncommitted tree is not traceable, and that is
    // worth knowing on the phone rather than discovering later.
    const dirty =
      execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '';
    return dirty ? `${sha}+dirty` : sha;
  } catch {
    return 'unknown';
  }
}

/**
 * When this bundle was produced. `BUILD_TIME` is checked for emptiness rather
 * than for `undefined`, because a Docker `ENV BUILD_TIME=` with no value sets
 * an empty string, which `??` would happily accept as a timestamp.
 */
function buildTime(): string {
  const provided = process.env.BUILD_TIME?.trim();
  return provided !== undefined && provided !== '' ? provided : new Date().toISOString();
}

// @preact/preset-vite installs the react -> preact/compat aliases by default
// (reactAliasesEnabled), so React-only libraries can be adopted later without
// migrating the UI stack. See docs/decisions/0001-foundation-stack.md.
export default defineConfig({
  plugins: [preact()],
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_TIME__: JSON.stringify(buildTime()),
  },
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    // Kept on for the published build: iOS Safari cannot be inspected from a
    // Windows machine, so a stack trace in the in-page console is the only
    // diagnostic a phone bug will ever produce. Maps are fetched only when a
    // console is opened, so a child playing never downloads them.
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
