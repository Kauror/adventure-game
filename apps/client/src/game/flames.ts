import { Constants } from '@babylonjs/core/Engines/constants';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Meshes/Builders/planeBuilder';

/**
 * Fire on the braziers and torches.
 *
 * These exist because the models arrived without them, and for a reason worth
 * recording: in the source they were `THREE.Sprite` billboards, and glTF has no
 * equivalent, so the export dropped them silently. The `.glb` files carry the
 * iron and the coals and nothing that burns. The asset manifest says as much
 * and names the two textures to rebuild them from — which is the difference
 * between a five-minute job and an afternoon wondering why the braziers look
 * dead.
 *
 * Billboards rather than particles, and additive rather than lit. Six fires
 * would be six particle systems and six dynamic lights on a phone that has a
 * 30 fps budget; two textured quads each, glowing, cost effectively nothing and
 * read the same at this camera. PLAN §26 is clear that the light budget is
 * spent on the fight, not the scenery.
 */

const FLAME_TEXTURE = '/textures/props/flame_sprite.png';
const GLOW_TEXTURE = '/textures/props/glow_sprite.png';

/** Metres. The flame is a hand's height; the glow is the pool of light it casts. */
const FLAME_SIZE = 0.55;
const GLOW_SIZE = 2.4;

export interface Flames {
  readonly dispose: () => void;
}

export interface FirePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function additiveMaterial(scene: Scene, name: string, url: string): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  const texture = new Texture(url, scene, true, true, Texture.NEAREST_SAMPLINGMODE);
  texture.hasAlpha = true;

  // Emissive, not diffuse: fire is a light source, and should not darken when
  // the scene light does.
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.alphaMode = Constants.ALPHA_ADD;
  material.disableLighting = true;
  // A flame has no back and should never occlude anything behind it.
  material.backFaceCulling = false;
  return material;
}

/**
 * @param points  where a flame burns.
 * @param glows   where a wider, softer pool of light sits. Separate because the
 *                authored arena marks the two with different nodes: a torch has
 *                a flame *and* a glow, but the gate spill and the shrine glow
 *                have no flame at all, and drawing one there would put fire in
 *                the middle of a crystal.
 */
export function createFlames(
  scene: Scene,
  points: readonly FirePoint[],
  glows: readonly FirePoint[] = points,
): Flames {
  if (points.length === 0 && glows.length === 0) {
    return { dispose: () => undefined };
  }

  const flameMaterial = additiveMaterial(scene, 'flame-material', FLAME_TEXTURE);
  const glowMaterial = additiveMaterial(scene, 'glow-material', GLOW_TEXTURE);

  const flames: Mesh[] = [];
  const glowMeshes: Mesh[] = [];

  glows.forEach((point, index) => {
    const glow = MeshBuilder.CreatePlane(`fire-glow-${index}`, { size: GLOW_SIZE }, scene);
    glow.material = glowMaterial;
    glow.billboardMode = Mesh.BILLBOARDMODE_ALL;
    glow.position.set(point.x, point.y, point.z);
    glow.isPickable = false;
    // Never write depth: two overlapping additive quads must not cut holes in
    // each other.
    glow.material.needDepthPrePass = false;
    glowMeshes.push(glow);
  });

  points.forEach((point, index) => {
    const flame = MeshBuilder.CreatePlane(`fire-flame-${index}`, { size: FLAME_SIZE }, scene);
    flame.material = flameMaterial;
    flame.billboardMode = Mesh.BILLBOARDMODE_ALL;
    flame.position.set(point.x, point.y + FLAME_SIZE * 0.35, point.z);
    flame.isPickable = false;
    flames.push(flame);
  });

  let elapsed = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    elapsed += scene.getEngine().getDeltaTime() / 1000;

    // Each fire flickers on its own rhythm. Identical flames pulsing in unison
    // read as one animated decal repeated, which is worse than not moving.
    flames.forEach((flame, index) => {
      const beat = elapsed * 9 + index * 1.7;
      const flicker = 1 + Math.sin(beat) * 0.09 + Math.sin(beat * 2.3) * 0.05;
      flame.scaling.set(flicker, flicker * 1.06, 1);
    });

    glowMeshes.forEach((glow, index) => {
      const beat = elapsed * 5 + index * 2.3;
      const breath = 1 + Math.sin(beat) * 0.07;
      glow.scaling.set(breath, breath, 1);
    });
  });

  return {
    dispose: () => {
      scene.onBeforeRenderObservable.remove(observer);
      for (const mesh of [...flames, ...glowMeshes]) {
        mesh.dispose();
      }
      flameMaterial.dispose(true, true);
      glowMaterial.dispose(true, true);
    },
  };
}
