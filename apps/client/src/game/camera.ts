import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

import type { CameraConfig } from './cameraMath';
import { orthoBounds, tiltToBeta } from './cameraMath';

/**
 * The game camera. Settled at 0A.4 after comparing candidates on real devices;
 * see docs/decisions/0005-fixed-camera.md.
 *
 * Orthographic so an object never changes size with position — a child judging
 * "how far away is that enemy" gets a consistent read, and nothing distorts at
 * the edges of a wide landscape screen. 55° is steep enough that 1.6 m walls
 * hide very little, without flattening silhouettes into top-down blobs.
 *
 * `verticalExtentMetres` moved from 12 m to 9 m after the first adult playtest,
 * which reported that "the action feels distant rather than personal". A 25%
 * tighter frame puts the player and the enemy meaningfully on screen without
 * touching the tilt, which was not the complaint. `?zoom=wide` restores the old
 * framing for comparison; it is a development affordance, never offered to a
 * player, because the camera is not theirs to manage (PLAN §2).
 *
 * The tilt stays at 55°: steep enough that 1.6 m walls hide very little,
 * without flattening silhouettes into top-down blobs.
 */
const NEAR_EXTENT_METRES = 9;
const WIDE_EXTENT_METRES = 12;

/**
 * The framing is fixed in **metres**, and the character is not.
 *
 * This matters more than it looks. The playtest that chose 9 m was played with
 * a 1.8 m box: the player stood one fifth of the screen tall. The box was then
 * replaced with a real character the artist authored at 1.3 m — a child, and
 * correctly so — and the metre count stayed where it was. The player is now
 * 14% of the screen instead of 20%, roughly a **third smaller**, without a
 * single camera value being touched.
 *
 * Apparent speed is judged against the thing that is moving rather than against
 * metres, so a smaller character crossing a larger arena reads as slower even
 * though `maxSpeedMetresPerSecond` has not changed. That is a real effect and
 * not a matter of taste.
 *
 * It is left at 9 m rather than quietly tightened, because the enemy aggroes
 * from 8 m and a frame shorter than that lets something charge from off-screen
 * — which is a worse bug than a distant camera. Settling this properly is a
 * decision to make on the device, so `?zoom=` takes a number of metres.
 */
const MIN_EXTENT_METRES = 4;
const MAX_EXTENT_METRES = 40;

/** `?zoom=wide` for the old framing, `?zoom=7.5` for anything else. */
export function extentFromSearch(search: string): number {
  const requested = new URLSearchParams(search).get('zoom');
  if (requested === null) {
    return NEAR_EXTENT_METRES;
  }
  if (requested === 'wide') {
    return WIDE_EXTENT_METRES;
  }

  const parsed = Number.parseFloat(requested);
  return Number.isFinite(parsed) && parsed >= MIN_EXTENT_METRES && parsed <= MAX_EXTENT_METRES
    ? parsed
    : NEAR_EXTENT_METRES;
}

function requestedExtent(): number {
  if (typeof window === 'undefined') {
    return NEAR_EXTENT_METRES;
  }
  return extentFromSearch(window.location.search);
}

export const GAME_CAMERA: CameraConfig = {
  tiltDegrees: 55,
  verticalExtentMetres: requestedExtent(),
};

/** Where the camera should be looking. Metres. */
export interface FollowTarget {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface GameCamera {
  /**
   * Shakes the view briefly. Magnitude is in metres of world offset — small
   * numbers: this is a fixed camera and a child's screen, so a nudge reads as
   * impact while anything larger just reads as broken.
   */
  readonly shake: (metres: number) => void;
  readonly dispose: () => void;
}

/**
 * Fixed camera looking north, from the south.
 *
 * `alpha = -PI/2` puts the camera on the low-Z side of its target looking
 * towards +Z, so north (high Z, and `rows[0]` of a region) is up the screen and
 * an authored map reads the way it was written. This never changes at runtime:
 * the player has no camera control at all (PLAN §2).
 */
const FIXED_ALPHA = -Math.PI / 2;

/** How quickly the camera catches up with its target, per second. */
const FOLLOW_RESPONSIVENESS = 8;

/** Hard ceiling on shake, so nothing can ever make the view unreadable. */
const MAX_SHAKE_METRES = 0.35;
/** How fast a shake dies away. Impacts should punctuate, not wobble. */
const SHAKE_DECAY_PER_SECOND = 9;

/**
 * Distance back from the target. For an orthographic camera this only decides
 * where the near and far planes fall, not how large anything looks.
 */
const STANDOFF_METRES = 60;

export function createGameCamera(
  scene: Scene,
  engine: Engine,
  follow: () => FollowTarget,
): GameCamera {
  const start = follow();
  const camera = new ArcRotateCamera(
    'game-camera',
    FIXED_ALPHA,
    tiltToBeta(GAME_CAMERA.tiltDegrees),
    STANDOFF_METRES,
    new Vector3(start.x, start.y, start.z),
    scene,
  );

  // No control is ever attached: this is a fixed camera, not a free one.
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 400;

  const applyOrthoBounds = (): void => {
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const aspect = height > 0 ? width / height : 1;
    const bounds = orthoBounds(GAME_CAMERA.verticalExtentMetres, aspect);

    camera.orthoLeft = bounds.left;
    camera.orthoRight = bounds.right;
    camera.orthoTop = bounds.top;
    camera.orthoBottom = bounds.bottom;
  };

  applyOrthoBounds();

  // Orthographic bounds are in world units, so they must be recomputed whenever
  // the viewport aspect changes — rotating a phone, or an iOS toolbar sliding
  // away — or the world would stretch.
  const resizeObserver = engine.onResizeObservable.add(applyOrthoBounds);

  let shakeMetres = 0;

  const renderObserver = scene.onBeforeRenderObservable.add(() => {
    const target = follow();
    // Exponential smoothing: frame-rate independent, and gentle enough that the
    // view does not snap when the target jumps.
    const dt = engine.getDeltaTime() / 1000;
    const t = 1 - Math.exp(-FOLLOW_RESPONSIVENESS * dt);

    camera.target.x += (target.x - camera.target.x) * t;
    camera.target.y += (target.y - camera.target.y) * t;
    camera.target.z += (target.z - camera.target.z) * t;

    if (shakeMetres > 0.0005) {
      // Offset the *target*, so the shake survives the follow smoothing above
      // instead of being immediately smoothed away.
      camera.target.x += (Math.random() * 2 - 1) * shakeMetres;
      camera.target.z += (Math.random() * 2 - 1) * shakeMetres;
      shakeMetres = Math.max(0, shakeMetres - SHAKE_DECAY_PER_SECOND * shakeMetres * dt);
    } else {
      shakeMetres = 0;
    }
  });

  return {
    shake: (metres) => {
      shakeMetres = Math.min(MAX_SHAKE_METRES, Math.max(shakeMetres, metres));
    },
    dispose: () => {
      engine.onResizeObservable.remove(resizeObserver);
      scene.onBeforeRenderObservable.remove(renderObserver);
      camera.dispose();
    },
  };
}
