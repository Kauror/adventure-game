import { describe, expect, it } from 'vitest';

import { assistFromLocation } from '../src/config/assist';

describe('assist toggle', () => {
  it('is off unless asked for', () => {
    expect(assistFromLocation('')).toBe(false);
    expect(assistFromLocation('?joystick=fixed')).toBe(false);
  });

  it('turns on with ?assist=1', () => {
    expect(assistFromLocation('?assist=1')).toBe(true);
    expect(assistFromLocation('?joystick=fixed&assist=1')).toBe(true);
  });

  it('accepts a bare ?assist as on, since that is what someone typing it means', () => {
    expect(assistFromLocation('?assist')).toBe(true);
    expect(assistFromLocation('?assist=true')).toBe(true);
    expect(assistFromLocation('?assist=yes')).toBe(true);
  });

  it('can be explicitly turned off, so one URL can be handed to either child', () => {
    expect(assistFromLocation('?assist=0')).toBe(false);
    expect(assistFromLocation('?assist=false')).toBe(false);
  });
});
