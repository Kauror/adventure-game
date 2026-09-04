import { describe, expect, it } from 'vitest';

import { switchClip } from '../src/game/character';

/**
 * Changing clips has to undo the previous one.
 *
 * From a real session: kill the enemy, wait three seconds, and it respawns
 * alive and fighting — health bar, chasing the player — while lying flat on its
 * face. `die` is a one-shot that holds its final frame on purpose, and it moves
 * joints `idle` never touches, so starting `idle` left them on the floor.
 *
 * Measured in the browser before it was fixed: standing, the head sits 0.94 m
 * above the legs; after `die`, 0.11 m; after switching back to `idle`, still
 * 0.11 m.
 */
function fakeClip(name: string, log: string[]) {
  return {
    stop: () => log.push(`${name}.stop`),
    reset: () => log.push(`${name}.reset`),
    start: (loop: boolean) => log.push(`${name}.start(${loop ? 'loop' : 'once'})`),
  };
}

describe('switchClip', () => {
  it('resets the outgoing clip, or its last pose outlives it', () => {
    const log: string[] = [];
    switchClip(fakeClip('die', log), fakeClip('idle', log), true);
    expect(log).toContain('die.reset');
  });

  it('stops the outgoing clip before resetting it', () => {
    const log: string[] = [];
    switchClip(fakeClip('die', log), fakeClip('idle', log), true);
    expect(log.indexOf('die.stop')).toBeLessThan(log.indexOf('die.reset'));
  });

  it('starts the incoming clip from its beginning', () => {
    const log: string[] = [];
    switchClip(null, fakeClip('attack', log), false);
    expect(log).toEqual(['attack.reset', 'attack.start(once)']);
  });

  it('carries the looping flag through', () => {
    const looping: string[] = [];
    switchClip(null, fakeClip('walk', looping), true);
    expect(looping).toContain('walk.start(loop)');

    const once: string[] = [];
    switchClip(null, fakeClip('die', once), false);
    expect(once).toContain('die.start(once)');
  });

  it('copes with nothing playing yet', () => {
    const log: string[] = [];
    expect(() => switchClip(null, fakeClip('idle', log), true)).not.toThrow();
    expect(log.some((entry) => entry.startsWith('idle'))).toBe(true);
  });
});
