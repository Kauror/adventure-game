import type { AttackState, TimingBands } from '@adventure/game-core';
import {
  HAMMER,
  chargeProgress,
  isCharging,
  isPastTapThreshold,
  recoveryProgress,
} from '@adventure/game-core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Meshes/Builders/boxBuilder';

/**
 * The hammer, and the swing it makes.
 *
 * Added after the first adult playtest, which found two things that turned out
 * to be the same thing: a tap did not visibly do anything, and the weapon did
 * not feel like a hammer. Both had one cause — **there was no hammer**. The
 * player was a box, and an attack was a brief change of its colour and scale.
 * Nothing swung, so nothing read as a blow.
 *
 * So this is a real object on a real arc: it lifts the instant you press, winds
 * back while you charge, and comes down through a forward arc slow enough to be
 * seen. Weight comes from the timing of that arc, not from slowing the game.
 *
 * It also carries the timing mechanic. The head brightens as the charge enters
 * GREAT and flares white at PERFECT, so the sweet spot can be learned while
 * watching the fight rather than the HUD — which is exactly what the meter
 * alone failed to teach. Placeholder geometry until the rig at 0A.3; the motion
 * is the part worth keeping.
 */

/** Resting angle: carried back over the shoulder, out of the way. */
const REST_ANGLE = -0.4;
/** A press lifts it this far at once, before tap or charge is known. */
const READY_ANGLE = -0.85;
/**
 * Fully wound: drawn back past the shoulder, head low behind the body.
 *
 * Past vertical on purpose. It is what gives the downswing an overhead chop
 * rather than a short poke — the head climbs through the highest point of the
 * arc on its way forward, which is the shape that reads as a hammer.
 * `tests/hammer.test.ts` pins that: the peak of the swing is more than a metre
 * above the wound pose.
 */
const WOUND_ANGLE = -2.25;
/** End of the arc: driven down and forward, well in front of the body. */
const FOLLOW_THROUGH_ANGLE = 1.3;
/** Fraction of the recovery spent on the downswing; the rest returns to rest. */
const STRIKE_FRACTION = 0.32;

/** How quickly the hammer eases back to rest when idle, per second. */
const SETTLE_RESPONSIVENESS = 14;

const HANDLE_LENGTH = 0.95;
const HEAD_COLOUR = new Color3(0.62, 0.64, 0.7);
const HANDLE_COLOUR = new Color3(0.42, 0.28, 0.16);
const CHARGE_GLOW = new Color3(1, 0.45, 0.1);
const GREAT_GLOW = new Color3(1, 0.72, 0.2);
const PERFECT_GLOW = new Color3(1, 1, 0.9);

export interface Hammer {
  readonly update: (state: AttackState, deltaSeconds: number) => void;
  readonly dispose: () => void;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Builds the hammer and parents it to `owner`.
 *
 * The pivot sits at the shoulder so the weapon rotates about the hands, which
 * is what makes the arc read as a swing rather than a spinning prop.
 */
export interface HammerMount {
  /**
   * Divides out scale inherited from the owner.
   *
   * A character model is fitted to a height, and anything parented into its rig
   * inherits that fitting — so a hammer authored in metres arrives in the
   * asset's own units instead. One number, taken from the character rather than
   * guessed, so swapping the asset does not resize the weapon.
   */
  readonly scaleCompensation?: number;
  /** Where the pivot sits in the owner's space, after compensation. */
  readonly offset?: { readonly x: number; readonly y: number; readonly z: number };
}

export function createHammer(
  scene: Scene,
  owner: TransformNode,
  bands: TimingBands,
  bodyHeight: number,
  mount: HammerMount = {},
): Hammer {
  const compensation = mount.scaleCompensation ?? 1;
  const offset = mount.offset ?? { x: 0.34, y: bodyHeight * 0.12, z: 0 };

  const pivot = new TransformNode('hammer-pivot', scene);
  pivot.parent = owner;
  pivot.position.set(offset.x, offset.y, offset.z);
  pivot.scaling.setAll(compensation);

  const handle = MeshBuilder.CreateBox(
    'hammer-handle',
    { width: 0.09, depth: 0.09, height: HANDLE_LENGTH },
    scene,
  );
  const handleMaterial = new StandardMaterial('hammer-handle-material', scene);
  handleMaterial.diffuseColor = HANDLE_COLOUR;
  handleMaterial.specularColor = Color3.Black();
  handle.material = handleMaterial;
  handle.parent = pivot;
  handle.position.y = HANDLE_LENGTH / 2;

  const head = MeshBuilder.CreateBox(
    'hammer-head',
    { width: 0.34, depth: 0.3, height: 0.42 },
    scene,
  );
  const headMaterial = new StandardMaterial('hammer-head-material', scene);
  headMaterial.diffuseColor = HEAD_COLOUR;
  headMaterial.specularColor = Color3.Black();
  head.material = headMaterial;
  head.parent = pivot;
  head.position.y = HANDLE_LENGTH + 0.1;

  let angle = REST_ANGLE;
  // Where the wind-up actually got to when the button was let go, so the
  // downswing starts from there instead of snapping to a fixed pose.
  let releaseAngle = READY_ANGLE;
  let wasSwinging = false;

  const glow = (charge: number, heldSeconds: number): void => {
    if (charge <= 0) {
      headMaterial.emissiveColor = Color3.Black();
      return;
    }

    // Keyed to the same seconds the meter draws its bands from, so the hammer
    // and the meter can never disagree about where the sweet spot is.
    const inPerfect =
      heldSeconds >= bands.perfect.startSeconds && heldSeconds <= bands.perfect.endSeconds;
    const inGreat =
      heldSeconds >= bands.great.startSeconds && heldSeconds <= bands.great.endSeconds;

    if (inPerfect) {
      // Flares, and pulses fast enough to feel urgent without strobing.
      const pulse = 0.75 + 0.25 * Math.sin(heldSeconds * 34);
      headMaterial.emissiveColor = PERFECT_GLOW.scale(pulse);
      return;
    }
    if (inGreat) {
      headMaterial.emissiveColor = GREAT_GLOW.scale(0.55);
      return;
    }
    // Before and after the bands: a dull heat that only says "charging".
    headMaterial.emissiveColor = CHARGE_GLOW.scale(0.12 + charge * 0.22);
  };

  return {
    update: (state, deltaSeconds) => {
      const charge = chargeProgress(state);
      const swinging = state.phase === 'recovering';

      if (swinging) {
        if (!wasSwinging) {
          releaseAngle = angle;
        }
        const p = recoveryProgress(state);
        angle =
          p < STRIKE_FRACTION
            ? // Down and through: fast and eased out, so contact reads.
              lerp(releaseAngle, FOLLOW_THROUGH_ANGLE, easeOutCubic(p / STRIKE_FRACTION))
            : // Then back to rest over what remains — the weight settling.
              lerp(
                FOLLOW_THROUGH_ANGLE,
                REST_ANGLE,
                easeOutCubic((p - STRIKE_FRACTION) / (1 - STRIKE_FRACTION)),
              );
      } else if (isCharging(state)) {
        angle = isPastTapThreshold(state)
          ? lerp(READY_ANGLE, WOUND_ANGLE, charge)
          : // The press itself lifts it, so pressing always does something
            // before the game knows whether this is a tap or a charge.
            lerp(REST_ANGLE, READY_ANGLE, state.elapsedSeconds / HAMMER.tapThresholdSeconds);
      } else {
        const t = 1 - Math.exp(-SETTLE_RESPONSIVENESS * Math.max(0, deltaSeconds));
        angle = lerp(angle, REST_ANGLE, t);
      }

      wasSwinging = swinging;
      pivot.rotation.x = angle;

      // Straining at full wind-up: a small tremble, the weapon wanting to fall.
      const strain = isPastTapThreshold(state) ? charge * 0.05 : 0;
      pivot.rotation.z = strain === 0 ? 0 : Math.sin(state.elapsedSeconds * 40) * strain;

      glow(isPastTapThreshold(state) ? charge : 0, state.elapsedSeconds);
    },

    dispose: () => {
      head.dispose();
      handle.dispose();
      headMaterial.dispose();
      handleMaterial.dispose();
      pivot.dispose();
    },
  };
}
