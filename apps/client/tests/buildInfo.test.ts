import { describe, expect, it } from 'vitest';

import { BUILD, buildLabel } from '../src/config/buildInfo';

describe('build identity', () => {
  it('is substituted at build time rather than left as a placeholder', () => {
    // If the vite `define` is ever removed, these become undefined and the
    // published build silently loses the only marker that says which bundle a
    // phone loaded.
    expect(typeof BUILD.sha).toBe('string');
    expect(BUILD.sha).not.toBe('');
    expect(typeof BUILD.builtAt).toBe('string');
    expect(BUILD.builtAt).not.toBe('');
  });

  it('renders a short one-line label', () => {
    const label = buildLabel({ sha: 'abc123def456', builtAt: '2026-09-02T18:42:07.113Z' });
    expect(label).toBe('abc123def456 · 2026-09-02 18:42Z');
  });

  it('keeps the dirty marker visible', () => {
    const label = buildLabel({ sha: 'abc123def456+dirty', builtAt: '2026-09-02T18:42:07.113Z' });
    expect(label).toContain('+dirty');
  });

  it('does not pretend to know a timestamp it was not given', () => {
    expect(buildLabel({ sha: 'abc123def456', builtAt: '' })).toBe('abc123def456 · ?Z');
  });
});
