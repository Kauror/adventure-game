import type { Region } from '@adventure/game-core';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';

import { buildRegion } from './buildRegion';

/**
 * Builds the scene for a region: lighting and scenery.
 *
 * The camera is created separately (`createGameCamera`) because it follows a
 * target that the scene does not own.
 */
export function createScene(engine: Engine, region: Region): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.06, 0.08, 1);

  const light = new HemisphericLight('scene-light', new Vector3(0.4, 1, 0.2), scene);
  light.intensity = 0.95;

  buildRegion(scene, region);

  return scene;
}
