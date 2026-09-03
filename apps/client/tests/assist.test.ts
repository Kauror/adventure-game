import { describe, expect, it } from 'vitest';

import { assistFromLocation, resolveAssist } from '../src/config/assist';

describe('assist from the URL', () => {
  it('says nothing when the parameter is absent, so a remembered choice can win', () => {
    expect(assistFromLocation('')).toBe(null);
    expect(assistFromLocation('?joystick=fixed')).toBe(null);
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

describe('resolving assist', () => {
  it('is off unless something asks for it', () => {
    expect(resolveAssist(null, null)).toBe(false);
  });

  it('uses the remembered choice when the URL is silent', () => {
    // The home-screen install has no URL bar, so this is the only route to
    // assist on the device the children actually play on.
    expect(resolveAssist(null, true)).toBe(true);
    expect(resolveAssist(null, false)).toBe(false);
  });

  it('lets an explicit URL override what was remembered, in both directions', () => {
    expect(resolveAssist(true, false)).toBe(true);
    expect(resolveAssist(false, true)).toBe(false);
  });
});
