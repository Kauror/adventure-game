import { describe, expect, it } from 'vitest';

import { createActionLatch } from '../src/input/actionLatch';

const BUFFER = 200;

describe('rising-edge detection', () => {
  it('latches when a button goes down, not while it is held', () => {
    const latch = createActionLatch(BUFFER);

    latch.edge(true, 0);
    expect(latch.consume(0)).toBe(true);

    // Still held on the following frames — this must not re-trigger.
    latch.edge(true, 16);
    expect(latch.consume(16)).toBe(false);
    latch.edge(true, 32);
    expect(latch.consume(32)).toBe(false);
  });

  it('latches again after a release and a second press', () => {
    const latch = createActionLatch(BUFFER);

    latch.edge(true, 0);
    expect(latch.consume(0)).toBe(true);

    latch.edge(false, 16);
    latch.edge(true, 32);
    expect(latch.consume(32)).toBe(true);
  });

  it('does nothing while a button is never pressed', () => {
    const latch = createActionLatch(BUFFER);
    latch.edge(false, 0);
    latch.edge(false, 16);
    expect(latch.consume(16)).toBe(false);
  });
});

describe('consuming', () => {
  it('yields a press exactly once', () => {
    const latch = createActionLatch(BUFFER);
    latch.press(0);

    expect(latch.consume(0)).toBe(true);
    expect(latch.consume(0)).toBe(false);
  });

  it('holds a press until something is ready to use it', () => {
    const latch = createActionLatch(BUFFER);
    latch.press(0);

    // Pressed slightly early — still queued a moment later.
    expect(latch.isQueued(150)).toBe(true);
    expect(latch.consume(150)).toBe(true);
  });

  it('drops a stale press rather than firing it late', () => {
    const latch = createActionLatch(BUFFER);
    latch.press(0);

    expect(latch.isQueued(BUFFER + 1)).toBe(false);
    expect(latch.consume(BUFFER + 1)).toBe(false);
    // ...and it does not linger to fire on some later frame either.
    latch.press(1000);
    expect(latch.consume(1000)).toBe(true);
  });

  it('accepts a press exactly on the buffer boundary', () => {
    const latch = createActionLatch(BUFFER);
    latch.press(0);
    expect(latch.consume(BUFFER)).toBe(true);
  });
});

describe('mixed sources', () => {
  it('lets a direct press override a held-button edge cleanly', () => {
    const latch = createActionLatch(BUFFER);

    // Button held from the keyboard...
    latch.edge(true, 0);
    // ...and the on-screen button tapped as well. Still one press.
    latch.press(5);

    expect(latch.consume(10)).toBe(true);
    expect(latch.consume(10)).toBe(false);
  });
});
