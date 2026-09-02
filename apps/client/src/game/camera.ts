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
 * `verticalExtentMetres` is the one number here still expected to move: 12 m was
 * chosen against a placeholder box, and a real character (0A.3) is a better
 * guide to how large a person should look.
 */
export const GAME_CAMERA: CameraConfig = {
  tiltDegrees: 55,
  verticalExtentMetres: 12,
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
