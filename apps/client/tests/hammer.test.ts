import {
  HAMMER,
  advanceAttack,
  beginCharge,
  createAttackState,
  releaseCharge,
  timingBands,
} from '@adventure/game-core';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHammer } from '../src/game/hammer';

/**
 * Where the hammer actually travels during a swing.
 *
 * Not a rendering test — nothing here looks at a pixel. It checks the one thing
 * about an animation that no amount of tuning can fix: that the weapon is in
 * the wrong *place*. A hammer resting underground, or one whose "swing" never
 * crosses in front of the body, is a bug you can normally only find by looking
 * — and looking is exactly what this machine cannot do, and what the automation
 * pane has repeatedly refused to allow.
 *
 * Babylon's `NullEngine` runs the transform hierarchy without a GPU, so these
 * are the same numbers the phone will use. The swing is driven through the real
 * attack state machine rather than by posing frames by hand, because the arc
 * depends on where the wind-up had got to when the button was released.
 */

const BODY_HEIGHT = 1.8;
/** The body's centre sits half its height above the floor. */
const BODY_CENTRE_Y = BODY_HEIGHT / 2;
const STEP = 1 / 120;

let engine: NullEngine;
let scene: Scene;

beforeAll(() => {
  engine = new NullEngine();
  scene = new Scene(engine);
});

afterAll(() => {
  scene.dispose();
  engine.dispose();
});

interface Sample {
  readonly y: number;
  /** Positive is in front of the body, which faces +Z. */
  readonly z: number;
}

interface Swing {
  readonly rest: Sample;
  /** The pose at the moment the button was released. */
  readonly wound: Sample;
  /** Every frame of the follow-through. */
  readonly arc: readonly Sample[];
  readonly settled: Sample;
}

/**
 * Presses, holds for `holdSeconds`, releases, and follows the swing to the end.
 *
 * One hammer instance throughout, because the downswing starts from wherever
 * the wind-up actually reached.
 */
function swingAfterHolding(holdSeconds: number): Swing {
  const body = new TransformNode('body', scene);
  body.position.set(0, BODY_CENTRE_Y, 0);
  const hammer = createHammer(scene, body, timingBands(false), BODY_HEIGHT);

  const head = scene.getMeshByName('hammer-head');
  if (head === null) {
    throw new Error('hammer head mesh missing');
  }

  const sample = (): Sample => {
    // No render, and so no camera needed: only the transform hierarchy matters.
    head.computeWorldMatrix(true);
    const at = head.getAbsolutePosition();
    return { y: at.y, z: at.z };
  };

  let state = createAttackState();
  // Several settled frames, so the rest pose is the eased-to value.
  for (let i = 0; i < 30; i += 1) {
    hammer.update(state, STEP);
  }
  const rest = sample();

  state = beginCharge(state);
  for (let held = 0; held < holdSeconds; held += STEP) {
    state = advanceAttack(state, STEP);
    hammer.update(state, STEP);
  }
  const wound = sample();

  state = releaseCharge(state, false).state;
  const arc: Sample[] = [];
  for (let spent = 0; spent < state.recoverySeconds; spent += STEP) {
    state = advanceAttack(state, STEP);
    hammer.update(state, STEP);
    arc.push(sample());
  }

  for (let i = 0; i < 30; i += 1) {
    hammer.update(state, STEP);
  }
  const settled = sample();

  hammer.dispose();
  body.dispose();
  return { rest, wound, arc, settled };
}

const heavy = (): Swing => swingAfterHolding(HAMMER.chargeSeconds);
const tap = (): Swing => swingAfterHolding(0.1);

describe('the hammer travels a real arc', () => {
  it('rests above the player, not through the floor', () => {
    const { rest } = heavy();
    expect(rest.y).toBeGreaterThan(BODY_HEIGHT);
  });

  it('rests behind the body, out of the way of the view', () => {
    // The body faces +Z, so behind is negative.
    expect(heavy().rest.z).toBeLessThan(0);
  });

  it('cocks back behind the body as the charge fills', () => {
    const { rest, wound } = heavy();
    // A wound hammer is drawn back past the shoulder, which takes the head
    // down and behind — not up. It must still never reach the ground.
    expect(wound.z).toBeLessThan(rest.z);
    expect(wound.y).toBeLessThan(rest.y);
    expect(wound.y).toBeGreaterThan(0.2);
  });

  it('passes overhead on the way down, which is what makes it read as a chop', () => {
    const { wound, arc } = heavy();
    const peak = Math.max(...arc.map((s) => s.y));
    expect(peak).toBeGreaterThan(wound.y + 1);
  });

  it('carries the head well in front of the body', () => {
    const reach = Math.max(...heavy().arc.map((s) => s.z));
    expect(reach).toBeGreaterThan(0.8);
  });

  it('never buries the head below the floor at any point', () => {
    for (const sample of heavy().arc) {
      expect(sample.y).toBeGreaterThan(0);
    }
  });

  it('returns to rest once the swing is spent', () => {
    const { rest, settled } = heavy();
    expect(settled.y).toBeCloseTo(rest.y, 1);
    expect(settled.z).toBeCloseTo(rest.z, 1);
  });
});

describe('a tap is a real hammer blow, only quicker', () => {
  it('swings through the same forward arc', () => {
    // The whole point of the change: a tap has to visibly *do* something.
    expect(Math.max(...tap().arc.map((s) => s.z))).toBeGreaterThan(0.8);
  });

  it('is over sooner than a charged swing', () => {
    expect(tap().arc.length).toBeLessThan(heavy().arc.length);
  });

  it('starts from a lifted hammer, because the press itself raises it', () => {
    const { rest, wound } = tap();
    expect(wound.z).toBeLessThan(rest.z);
  });
});
