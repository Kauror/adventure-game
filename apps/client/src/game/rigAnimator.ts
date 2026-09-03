import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import type { CharacterClip } from './characterClips';

/**
 * Animation driven by code rather than by clips in the file.
 *
 * The project's own character — built from a child's drawing — ships with a rig
 * and no animation whatsoever. Rather than treat that as a missing asset, it is
 * arguably the better arrangement for this game: the rig is six boxes on named
 * joints, and posing them here means the motion is tied to the *game's* clock
 * instead of to a fixed clip. A swing lasts exactly as long as the hammer's
 * recovery, a walk cycle runs at the speed the player is actually moving, and
 * neither can drift out of step with the rules the way a baked animation does.
 *
 * It is also how a child's drawing becomes an animated character without the
 * child having to animate anything, which is the whole promise of PLAN §19.
 *
 * Deliberately forgiving: if a rig turns up without these joints, every lookup
 * returns null and the character simply stands still. A missing limb should
 * cost you the animation, not the game.
 */

/** The joints this animator drives. All optional — a rig may have fewer. */
interface Rig {
  readonly hipLeft: TransformNode | null;
  readonly hipRight: TransformNode | null;
  readonly shoulderLeft: TransformNode | null;
  readonly shoulderRight: TransformNode | null;
  readonly torso: TransformNode | null;
  readonly neck: TransformNode | null;
}

/** Steps per second at normal walking speed. */
const WALK_HZ = 2.3;
/** How far a leg swings, in radians. */
const LEG_SWING = 0.62;
/** Arms counter-swing, and less than the legs do. */
const ARM_SWING = 0.42;

/** How long the downswing takes. Close to the hammer's own recovery. */
const ATTACK_SECONDS = 0.34;
/** How long the body takes to fall over. */
const DEFEAT_SECONDS = 0.45;

export interface RigAnimator {
  /** Poses the rig for this frame. */
  readonly update: (clip: CharacterClip, deltaSeconds: number) => void;
}

function find(root: TransformNode, name: string): TransformNode | null {
  return (
    root.getDescendants(false).find((node): node is TransformNode => node.name === name) ?? null
  );
}

/**
 * Builds an animator for a rig with named humanoid joints, or `null` if this
 * model is not one — in which case the caller falls back to whatever clips the
 * file brought with it.
 */
export function createRigAnimator(root: TransformNode): RigAnimator | null {
  const rig: Rig = {
    hipLeft: find(root, 'hip_L'),
    hipRight: find(root, 'hip_R'),
    shoulderLeft: find(root, 'shoulder_L'),
    shoulderRight: find(root, 'shoulder_R'),
    torso: find(root, 'torso'),
    neck: find(root, 'neck'),
  };

  // Legs and arms are the minimum worth animating; without them this would be
  // an elaborate way of doing nothing.
  if (rig.hipLeft === null || rig.shoulderRight === null) {
    return null;
  }

  // Rest poses, so every clip returns to where the artist left the joints.
  const rest = new Map<TransformNode, number>();
  for (const joint of Object.values(rig)) {
    if (joint !== null) {
      rest.set(joint, joint.rotation.x);
    }
  }

  const restX = (joint: TransformNode | null): number =>
    joint === null ? 0 : (rest.get(joint) ?? 0);

  const setX = (joint: TransformNode | null, radians: number): void => {
    if (joint !== null) {
      joint.rotation.x = restX(joint) + radians;
    }
  };

  const setZ = (joint: TransformNode | null, radians: number): void => {
    if (joint !== null) {
      joint.rotation.z = radians;
    }
  };

  /** Runs continuously so a walk never restarts mid-stride. */
  let stride = 0;
  /** Restarts whenever a one-shot clip begins. */
  let oneShot = 0;
  let previous: CharacterClip | null = null;

  return {
    update: (clip, deltaSeconds) => {
      const dt = Math.max(0, Math.min(0.1, deltaSeconds));
      if (clip !== previous) {
        oneShot = 0;
        previous = clip;
      }
      oneShot += dt;

      switch (clip) {
        case 'walk': {
          stride += dt * WALK_HZ * Math.PI * 2;
          const swing = Math.sin(stride);
          setX(rig.hipLeft, swing * LEG_SWING);
          setX(rig.hipRight, -swing * LEG_SWING);
          // Arms oppose the legs, which is what stops a walk looking like a
          // march.
          setX(rig.shoulderLeft, -swing * ARM_SWING);
          setX(rig.shoulderRight, swing * ARM_SWING);
          setX(rig.torso, Math.abs(swing) * 0.05);
          setZ(rig.neck, Math.sin(stride * 2) * 0.04);
          break;
        }

        case 'idle': {
          // Barely anything: a slow breath. A character that stands perfectly
          // still reads as broken, and one that fidgets reads as nervous.
          stride += dt;
          const breath = Math.sin(stride * 1.6);
          setX(rig.hipLeft, 0);
          setX(rig.hipRight, 0);
          setX(rig.shoulderLeft, breath * 0.05);
          setX(rig.shoulderRight, breath * 0.05);
          setX(rig.torso, breath * 0.02);
          setZ(rig.neck, Math.sin(stride * 0.9) * 0.05);
          break;
        }

        case 'carry': {
          // Hammer up and ready. The weapon arm is high and the body is coiled,
          // so a charging player reads as charging from the silhouette alone.
          const settle = Math.min(1, oneShot * 6);
          setX(rig.shoulderRight, -1.15 * settle);
          setX(rig.shoulderLeft, -0.25 * settle);
          setX(rig.torso, -0.12 * settle);
          setX(rig.hipLeft, 0.1 * settle);
          setX(rig.hipRight, -0.1 * settle);
          setZ(rig.neck, 0);
          break;
        }

        case 'attack': {
          // Over the top and down. Eased so the fast part is the contact.
          const t = Math.min(1, oneShot / ATTACK_SECONDS);
          const eased = 1 - (1 - t) ** 3;
          setX(rig.shoulderRight, -1.15 + eased * 2.3);
          setX(rig.shoulderLeft, -0.2 + eased * 0.5);
          setX(rig.torso, -0.12 + eased * 0.34);
          setX(rig.hipLeft, 0.1 - eased * 0.2);
          setX(rig.hipRight, -0.1 + eased * 0.2);
          break;
        }

        case 'defeated': {
          // Folds and goes down, and stays down.
          const t = Math.min(1, oneShot / DEFEAT_SECONDS);
          const eased = t * t;
          setX(rig.torso, eased * 1.3);
          setX(rig.shoulderLeft, eased * 0.9);
          setX(rig.shoulderRight, eased * 0.9);
          setX(rig.hipLeft, -eased * 0.8);
          setX(rig.hipRight, -eased * 0.7);
          setZ(rig.neck, eased * 0.4);
          break;
        }
      }
    },
  };
}
