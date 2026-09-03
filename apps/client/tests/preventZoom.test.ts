import { describe, expect, it } from 'vitest';

import { preventBrowserZoom } from '../src/input/preventZoom';

/**
 * The zoom guard, checked without a DOM.
 *
 * What is worth pinning here is not that `preventDefault` exists — it is the
 * two details that are easy to "tidy" away and impossible to notice until a
 * child is stuck on a zoomed screen mid-fight: the listeners must be
 * **non-passive** (a passive listener silently cannot cancel anything), and
 * they must all come off again on teardown, or an HMR reload stacks another set
 * on every save.
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
  it('blocks the Safari pinch gestures, which are the only way to stop pinch zoom', () => {
    const { element, listeners } = fakeSurface();
    preventBrowserZoom(element);

    const types = listeners.map((l) => l.type);
    expect(types).toContain('gesturestart');
    expect(types).toContain('gesturechange');
    expect(types).toContain('gestureend');
  });

  it('also blocks double-tap zoom for browsers that ignore touch-action', () => {
    const { element, listeners } = fakeSurface();
    preventBrowserZoom(element);
    expect(listeners.map((l) => l.type)).toContain('dblclick');
  });

  it('registers every listener as non-passive', () => {
    const { element, listeners } = fakeSurface();
    preventBrowserZoom(element);

    // A passive listener cannot preventDefault, and some browsers default
    // gesture listeners to passive. Getting this wrong fails silently.
    for (const listener of listeners) {
      expect(listener.options?.passive).toBe(false);
    }
  });

  it('actually cancels the event', () => {
    const { element, listeners } = fakeSurface();
    preventBrowserZoom(element);

    let cancelled = false;
    const event = {
      preventDefault: () => {
        cancelled = true;
      },
    } as unknown as Event;

    listeners[0]?.handler(event);
    expect(cancelled).toBe(true);
  });

  it('removes everything it added, so a reload cannot stack handlers', () => {
    const { element, listeners, removed } = fakeSurface();
    preventBrowserZoom(element)();
    expect(removed.sort()).toEqual(listeners.map((l) => l.type).sort());
  });
});
