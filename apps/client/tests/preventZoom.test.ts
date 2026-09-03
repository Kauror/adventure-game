import { describe, expect, it } from 'vitest';

import { preventBrowserZoom } from '../src/input/preventZoom';

/**
 * The zoom guard, checked without a DOM.
 *
 * The important assertion here is a *negative* one: pinch must still work. The
 * first version of this blocked Safari's gesture events too, which meant a phone
 * already holding a stored page zoom could never be un-zoomed — every screen
 * came up magnified with the only remedy disabled. Blocking the accident is the
 * job; blocking the escape hatch was the bug.
 */

interface Registered {
  readonly type: string;
  readonly handler: (event: Event) => void;
  readonly options: AddEventListenerOptions | undefined;
}

function fakeSurface() {
  const listeners: Registered[] = [];
  const removed: string[] = [];

  const element = {
    addEventListener(type: string, handler: (event: Event) => void, options?: unknown) {
      listeners.push({ type, handler, options: options as AddEventListenerOptions | undefined });
    },
    removeEventListener(type: string) {
      removed.push(type);
    },
  } as unknown as HTMLElement;

  return { element, listeners, removed };
}

describe('browser zoom prevention', () => {
  it('blocks double-tap zoom, which is the accident', () => {
    const { element, listeners } = fakeSurface();
    preventBrowserZoom(element);
    expect(listeners.map((l) => l.type)).toContain('dblclick');
  });

  it('leaves pinch zoom alone, because it is the only way back', () => {
    const { element, listeners } = fakeSurface();
    preventBrowserZoom(element);

    // iOS Safari remembers a page zoom per site. Cancel these and a phone that
    // is already zoomed can never be un-zoomed by the person holding it.
    const types = listeners.map((l) => l.type);
    expect(types).not.toContain('gesturestart');
    expect(types).not.toContain('gesturechange');
    expect(types).not.toContain('gestureend');
  });

  it('registers as non-passive, or it could not cancel anything', () => {
    const { element, listeners } = fakeSurface();
    preventBrowserZoom(element);
    for (const listener of listeners) {
      expect(listener.options?.passive).toBe(false);
    }
  });

  it('actually cancels the event', () => {
    const { element, listeners } = fakeSurface();
    preventBrowserZoom(element);

    let cancelled = false;
    listeners[0]?.handler({
      preventDefault: () => {
        cancelled = true;
      },
    } as unknown as Event);
    expect(cancelled).toBe(true);
  });

  it('removes everything it added, so a reload cannot stack handlers', () => {
    const { element, listeners, removed } = fakeSurface();
    preventBrowserZoom(element)();
    expect(removed.sort()).toEqual(listeners.map((l) => l.type).sort());
  });
});

/**
 * The tap-sequence guard.
 *
 * `touch-action: none` was already on every element in the game and a player
 * still had the page zoom on them after five to seven quick taps — which is
 * simply what fighting looks like. These check the guard that replaced trusting
 * it, and in particular that it does not "fix" the zoom by breaking combat.
 */
describe('double-tap suppression during fast play', () => {
  function tapping() {
    const { element, listeners } = fakeSurface();
    preventBrowserZoom(element);
    const handler = listeners.find((l) => l.type === 'touchend')?.handler;

    /** Returns whether the tap's default was cancelled. */
    return (atMs: number, options: { fingers?: number; target?: unknown } = {}): boolean => {
      let cancelled = false;
      handler?.({
        timeStamp: atMs,
        touches: { length: (options.fingers ?? 1) - 1 },
        changedTouches: { length: 1 },
        target: options.target ?? null,
        preventDefault: () => {
          cancelled = true;
        },
      } as unknown as Event);
      return cancelled;
    };
  }

  it('cancels the second of two taps in quick succession', () => {
    const tap = tapping();
    expect(tap(0)).toBe(false);
    expect(tap(120)).toBe(true);
  });

  it('leaves two unhurried taps alone', () => {
    const tap = tapping();
    expect(tap(0)).toBe(false);
    expect(tap(900)).toBe(false);
  });

  it('does not swallow a whole burst, because a fight is a burst', () => {
    // Seven fast taps: the pairs are suppressed, but the odd taps still land.
    // A guard that cancelled everything after the first would be a worse bug
    // than the zoom it prevents.
    const tap = tapping();
    const cancelled = [0, 100, 200, 300, 400, 500, 600].map((at) => tap(at));
    expect(cancelled).toEqual([false, true, false, true, false, true, false]);
  });

  it('ignores anything with a second finger down, so pinch survives', () => {
    const tap = tapping();
    expect(tap(0)).toBe(false);
    expect(tap(100, { fingers: 2 })).toBe(false);
    // ...and the interrupted sequence does not then catch the next tap.
    expect(tap(150)).toBe(false);
  });

  it('leaves the debug panel clickable', () => {
    const tap = tapping();
    const inPanel = { closest: (selector: string) => (selector === '.ui-readout' ? {} : null) };
    // Not an Element instance, so the guard must fall through to the timestamp
    // path rather than throwing.
    expect(tap(0, { target: inPanel })).toBe(false);
    expect(tap(100, { target: inPanel })).toBe(false);
  });
});
