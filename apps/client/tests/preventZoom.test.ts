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
