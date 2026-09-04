import { describe, expect, it } from 'vitest';

import { effectsEnabled, shadowsRequested } from '../src/game/arenaEffects';

/**
 * The switches for the arena's post-processing.
 *
 * Both exist for the same reason the lighting and zoom dials do: whether an
 * effect is affordable is a question about a phone, and it has to be answerable
 * without a deploy.
 */
describe('effectsEnabled', () => {
  it('is on by default, because the arena was authored with it', () => {
    expect(effectsEnabled('')).toBe(true);
    expect(effectsEnabled('?zoom=8')).toBe(true);
  });

  it('is off with ?fx=0, so the cost of bloom can be measured on the device', () => {
    expect(effectsEnabled('?fx=0')).toBe(false);
  });

  it('treats anything else as on rather than leaving a child with a flat scene', () => {
    expect(effectsEnabled('?fx=1')).toBe(true);
    expect(effectsEnabled('?fx=yes')).toBe(true);
  });
});

describe('shadowsRequested', () => {
  it('is off by default, because shadows do not currently render', () => {
    // The map draws; nothing samples it. Off means a phone does not spend half
    // a millisecond a frame on a shadow nobody can see.
    expect(shadowsRequested('')).toBe(false);
    expect(shadowsRequested('?fx=1')).toBe(false);
  });

  it('can be switched on to keep investigating', () => {
    expect(shadowsRequested('?shadows=1')).toBe(true);
  });
});
