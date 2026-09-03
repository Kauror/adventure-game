import { afterEach, describe, expect, it } from 'vitest';

import {
  assistFromLocation,
  assistFromStorage,
  rememberAssist,
  resolveAssist,
} from '../src/config/assist';

/**
 * A stand-in for the browser's storage, since these tests run in node.
 *
 * Worth having rather than mocking the module: the guard around every access is
 * the point — storage throws outright in a private window on some browsers, and
 * a diagnostic setting must never be what stops the game booting.
 */
function withStorage(store: Map<string, string> | null): void {
  (globalThis as { window?: unknown }).window = {
    localStorage:
      store === null
        ? {
            getItem: () => {
              throw new Error('storage disabled');
            },
            setItem: () => {
              throw new Error('storage disabled');
            },
          }
        : {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
          },
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

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

describe('remembering the choice', () => {
  it('round-trips through storage', () => {
    const store = new Map<string, string>();
    withStorage(store);

    expect(assistFromStorage()).toBe(null);
    rememberAssist(true);
    expect(assistFromStorage()).toBe(true);
    rememberAssist(false);
    expect(assistFromStorage()).toBe(false);
  });

  it('settles an explicit URL choice, so it outlives one page load', () => {
    const store = new Map<string, string>();
    withStorage(store);

    expect(resolveAssist(true, null)).toBe(true);
    // The next launch has no parameter and must still be assisted.
    expect(resolveAssist(null, assistFromStorage())).toBe(true);
  });

  it('survives storage being unavailable entirely', () => {
    withStorage(null);

    // A private window must not take the game down with it.
    expect(assistFromStorage()).toBe(null);
    expect(() => {
      rememberAssist(true);
    }).not.toThrow();
    expect(resolveAssist(null, null)).toBe(false);
  });
});
