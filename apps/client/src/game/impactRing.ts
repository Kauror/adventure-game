import type { AttackSwing } from '@adventure/game-core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Meshes/Builders/discBuilder';

/**
 * A shockwave on the ground where a blow lands.
 *
 * The grades already differed in damage, sound, hit stop and spark count, and
 * the first adult playtest still could not tell them apart — every channel was
 * a matter of *degree*, and degrees are invisible without a side-by-side. This
 * is the one channel that differs in **kind**: nothing draws a ring except a
 * heavy swing, so a ring means "that was the charged attack", and how far it
 * travels says how well it was timed.
 *
 * One pooled disc, scaled and faded by hand. A ring per hit would be a mesh per
 * hit, which is how a phone dies.
 */
export interface ImpactRing {
  /** Starts a wave at a world position, sized and coloured for the swing. */
  readonly strike: (x: number, y: number, z: number, swing: AttackSwing) => void;
  readonly advance: (deltaSeconds: number) => void;
  readonly dispose: () => void;
}

/** Base radius of the disc; every wave is a scaling of this. */
const BASE_RADIUS = 0.5;

const GOOD_COLOUR = new Color3(1, 0.8, 0.45);
const GREAT_COLOUR = new Color3(1, 0.62, 0.2);
const PERFECT_COLOUR = new Color3(1, 1, 0.85);

interface Shape {
  readonly reach: number;
  readonly seconds: number;
  readonly colour: Color3;
  readonly alpha: number;
}

/**
 * How far and how bright each grade's wave is.
 *
 * A tap draws nothing at all. That silence is the point: it makes the charged
 * attack's ring mean something, rather than being one more effect among many.
 */
function shapeFor(swing: AttackSwing): Shape | null {
  if (swing.kind === 'light') {
    return null;
  }
  switch (swing.grade) {
    case 'perfect':
      return { reach: 7, seconds: 0.5, colour: PERFECT_COLOUR, alpha: 0.85 };
    case 'great':
      return { reach: 4.6, seconds: 0.38, colour: GREAT_COLOUR, alpha: 0.6 };
    default:
      return { reach: 2.8, seconds: 0.3, colour: GOOD_COLOUR, alpha: 0.4 };
  }
}

export function createImpactRing(scene: Scene): ImpactRing {
  const disc = MeshBuilder.CreateDisc(
    'impact-ring',
    { radius: BASE_RADIUS, tessellation: 40 },
    scene,
  );
  const material = new StandardMaterial('impact-ring-material', scene);
  material.emissiveColor = GOOD_COLOUR;
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  material.alpha = 0;
  disc.material = material;
  disc.rotation.x = Math.PI / 2;
  disc.isPickable = false;
  disc.setEnabled(false);

  let elapsed = 0;
  let active: Shape | null = null;

  return {
    strike: (x, y, z, swing) => {
      const shape = shapeFor(swing);
      if (shape === null) {
        return;
      }
      active = shape;
      elapsed = 0;
      material.emissiveColor = shape.colour;
      // Just clear of the floor, or it fights the ground for depth.
      disc.position.set(x, y + 0.03, z);
      disc.setEnabled(true);
    },

    advance: (deltaSeconds) => {
      if (active === null) {
        return;
      }

      elapsed += deltaSeconds;
      const t = Math.min(1, elapsed / active.seconds);

      // Fast out, slow to fade: a wave leaving the impact, not a growing blob.
      const radius =
        (BASE_RADIUS + (active.reach - BASE_RADIUS) * (1 - (1 - t) ** 3)) / BASE_RADIUS;
      disc.scaling.set(radius, radius, 1);
      material.alpha = active.alpha * (1 - t);

      if (t >= 1) {
        active = null;
        disc.setEnabled(false);
      }
    },

    dispose: () => {
      disc.dispose();
      material.dispose();
    },
  };
}
