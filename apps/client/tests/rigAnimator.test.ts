import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createRigAnimator } from '../src/game/rigAnimator';

/**
 * That the animator actually moves the character.
 *
 * This exists because it did not, and nothing noticed. glTF stores rotations as
 * quaternions and Babylon's loader sets `rotationQuaternion` on every node,
 * which makes Babylon ignore `rotation` — so the animator wrote Euler angles
 * into a property nothing read and the character stood in its bind pose. The
 * state machine was tested and correct; the joints never moved. A test that
 * asserted the clip logic would have passed the whole time.
 *
 * So the rig here is built the way the loader really builds it: posed by
 * quaternion, with the shoulders in the T the artist modelled.
 */

const JOINTS = ['hip_L', 'hip_R', 'shoulder_L', 'shoulder_R', 'torso', 'neck'] as const;

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

/** A rig shaped like `kid01.glb`: quaternion-posed, arms out at 90 degrees. */
function buildRig(): { root: TransformNode; joint: (name: string) => TransformNode } {
  const root = new TransformNode(`rig-${Math.random()}`, scene);
  const nodes = new Map<string, TransformNode>();

  for (const name of JOINTS) {
    const node = new TransformNode(name, scene);
    node.parent = root;
    node.rotationQuaternion = Quaternion.Identity();
    nodes.set(name, node);
  }

  // The T-pose, exactly as the file carries it: a quarter turn about Z, arms
  // straight out to the sides.
  nodes.get('shoulder_L')!.rotationQuaternion = Quaternion.RotationYawPitchRoll(0, 0, -Math.PI / 2);
  nodes.get('shoulder_R')!.rotationQuaternion = Quaternion.RotationYawPitchRoll(0, 0, Math.PI / 2);

  return {
    root,
    joint: (name) => nodes.get(name)!,
  };
}

/**
 * Which way the limb hanging off this joint actually points, in world space.
 *
 * Deliberately not `joint.rotation`. Reading back the property the animator
 * writes is what made this bug invisible for a whole stage: those numbers were
 * always correct, and the character never moved, because Babylon was reading a
 * quaternion instead. Asking the world matrix is the only assertion that can
 * tell the difference.
 */
function limbDirection(joint: TransformNode): Vector3 {
  joint.computeWorldMatrix(true);
  return Vector3.TransformNormal(Vector3.Down(), joint.getWorldMatrix()).normalize();
}

/** Angle between two directions, in radians. */
function angleBetween(a: Vector3, b: Vector3): number {
  return Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(a, b))));
}

describe('createRigAnimator', () => {
  it('finds a rig with the joints the character actually has', () => {
    expect(createRigAnimator(buildRig().root)).not.toBeNull();
  });

  it('returns null for a model that is not a humanoid rig', () => {
    const bare = new TransformNode('bare', scene);
    expect(createRigAnimator(bare)).toBeNull();
  });

  it('takes control away from the quaternion, or nothing it writes is used', () => {
    const rig = buildRig();
    createRigAnimator(rig.root);

    for (const name of JOINTS) {
      expect(rig.joint(name).rotationQuaternion, `${name} still quaternion-posed`).toBeNull();
    }
  });

  it('brings the arms down out of the modelled T-pose', () => {
    const rig = buildRig();
    const shoulder = rig.joint('shoulder_L');
    shoulder.rotationQuaternion = Quaternion.RotationYawPitchRoll(0, 0, -Math.PI / 2);

    expect(limbDirection(shoulder).y).toBeGreaterThan(-0.1); // out to the side

    createRigAnimator(rig.root);

    // The arm now hangs down rather than sticking out.
    expect(limbDirection(shoulder).y).toBeLessThan(-0.9);
  });

  it('actually moves the legs during a walk', () => {
    const rig = buildRig();
    const animator = createRigAnimator(rig.root);

    const before = limbDirection(rig.joint('hip_L'));
    for (let step = 0; step < 6; step += 1) {
      animator?.update('walk', 1 / 30);
    }

    // Measured in world space: the leg has swung somewhere it can be seen.
    expect(angleBetween(before, limbDirection(rig.joint('hip_L')))).toBeGreaterThan(0.05);
  });

  it('swings the legs in opposition, which is what stops a walk being a march', () => {
    const rig = buildRig();
    const animator = createRigAnimator(rig.root);

    for (let step = 0; step < 4; step += 1) {
      animator?.update('walk', 1 / 30);
    }

    const left = rig.joint('hip_L').rotation.x;
    const right = rig.joint('hip_R').rotation.x;
    expect(Math.sign(left)).toBe(-Math.sign(right));
  });

  it('drives the weapon arm through an attack', () => {
    const rig = buildRig();
    const animator = createRigAnimator(rig.root);
    const arm = rig.joint('shoulder_R');

    animator?.update('attack', 0);
    const wound = limbDirection(arm);

    for (let step = 0; step < 20; step += 1) {
      animator?.update('attack', 1 / 30);
    }

    // Over the top and down: a swing you could watch, not just a number that
    // changed. A quarter turn is the least that reads as a strike.
    expect(angleBetween(wound, limbDirection(arm))).toBeGreaterThan(Math.PI / 4);
  });

  it('folds the body over when defeated, and keeps it down', () => {
    const rig = buildRig();
    const animator = createRigAnimator(rig.root);

    for (let step = 0; step < 30; step += 1) {
      animator?.update('defeated', 1 / 30);
    }
    const folded = rig.joint('torso').rotation.x;

    for (let step = 0; step < 30; step += 1) {
      animator?.update('defeated', 1 / 30);
    }

    expect(folded).toBeGreaterThan(0.5);
    expect(rig.joint('torso').rotation.x).toBeCloseTo(folded, 5);
  });
});
