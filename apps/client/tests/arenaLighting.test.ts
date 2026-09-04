import { describe, expect, it } from 'vitest';

import { lightScaleFromSearch } from '../src/game/arenaScene';

/**
 * The brightness override.
 *
 * Exists because the arena's lighting cannot be verified where it is written:
 * the manifest's numbers are three.js units, the art was authored through a
 * tone curve Babylon does not reproduce exactly, and the screen that decides
 * whether it looks right is a phone. This is the knob that can be turned there.
 */
describe('lightScaleFromSearch', () => {
  it('leaves the authored lighting alone by default', () => {
    expect(lightScaleFromSearch('')).toBe(1);
    expect(lightScaleFromSearch('?zoom=8')).toBe(1);
  });

  it('brightens and darkens on request', () => {
    expect(lightScaleFromSearch('?light=1.4')).toBe(1.4);
    expect(lightScaleFromSearch('?light=0.7')).toBe(0.7);
  });

  it('refuses values that would black out or blow out the arena', () => {
    // A child who lands on a bad link must still get a playable screen.
    expect(lightScaleFromSearch('?light=0')).toBe(1);
    expect(lightScaleFromSearch('?light=-2')).toBe(1);
    expect(lightScaleFromSearch('?light=99')).toBe(1);
    expect(lightScaleFromSearch('?light=hele')).toBe(1);
  });
});
