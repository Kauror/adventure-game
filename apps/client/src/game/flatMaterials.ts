import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Material } from '@babylonjs/core/Materials/material';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Replaces the physically-based materials glTF brings with flat ones.
 *
 * Every `.glb` in this project loads as `PBRMaterial`, because that is what the
 * format means. For most games that is the right default and worth its price.
 * For this one it is neither: the art is untextured or 64-px-nearest boxes with
 * no metal, no roughness map and no reflections, lit by a single hemispheric
 * light. The PBR shader computes an image-based lighting term, a BRDF lookup
 * and an energy-conservation pass to arrive, expensively, at approximately the
 * flat colour the artist drew.
 *
 * It was 76 of the scene's 96 materials, and the cost is paid per *pixel* — on
 * a phone filling a couple of million of them, that is the frame.
 *
 * This is a rendering-cost decision, not an art decision: the intent is that
 * the scene looks the same afterwards. Anything the assets genuinely use —
 * albedo colour and texture, emissive, alpha, culling — is carried across;
 * specular is set to black because these surfaces have no highlight to lose.
 *
 * Duck-typed rather than `instanceof PBRMaterial` on purpose. The PBR material
 * lives in the lazily-loaded glTF chunk, and importing it here to test against
 * would drag the whole thing into the first-paint bundle to answer a question
 * `getClassName()` already answers.
 */

/** The handful of properties worth carrying across. All optional — a material may set none. */
interface PbrLike {
  readonly albedoColor?: Color3;
  readonly albedoTexture?: BaseTexture | null;
  readonly emissiveColor?: Color3;
  readonly emissiveTexture?: BaseTexture | null;
  readonly alpha?: number;
  readonly backFaceCulling?: boolean;
  readonly transparencyMode?: number | null;
}

function isPbr(material: Material): boolean {
  return material.getClassName() === 'PBRMaterial';
}

function flatten(scene: Scene, source: Material): StandardMaterial {
  const pbr = source as unknown as PbrLike;
  const flat = new StandardMaterial(`${source.name}-flat`, scene);

  flat.diffuseColor = pbr.albedoColor?.clone() ?? Color3.White();
  if (pbr.albedoTexture != null) {
    flat.diffuseTexture = pbr.albedoTexture;
  }

  flat.emissiveColor = pbr.emissiveColor?.clone() ?? Color3.Black();
  if (pbr.emissiveTexture != null) {
    flat.emissiveTexture = pbr.emissiveTexture;
  }

  // Matte by definition. A specular highlight from a hemispheric light on a
  // flat-shaded box reads as a rendering error rather than as a shine.
  flat.specularColor = Color3.Black();

  flat.alpha = pbr.alpha ?? 1;
  flat.backFaceCulling = pbr.backFaceCulling ?? true;
  if (pbr.transparencyMode != null) {
    flat.transparencyMode = pbr.transparencyMode;
  }

  /*
   * Transparency has to be asked for twice.
   *
   * A glTF material with `alphaMode: "BLEND"` carries its transparency in the
   * base colour texture's alpha channel, and `PBRMaterial` reads it there
   * without being told. `StandardMaterial` does not: it needs the texture
   * flagged as having alpha *and* to be told to use it, and until both are set
   * it draws the transparent pixels as opaque black.
   *
   * The arena made this impossible to miss — the rune mosaic at the centre of
   * the fight floor is a 256 px texture with a transparent surround, and it
   * rendered as a black square sitting on the floor. Thirteen of its materials
   * blend: the mosaic, the puddles and every banner.
   */
  const blends =
    typeof (source as { needAlphaBlending?: () => boolean }).needAlphaBlending === 'function' &&
    (source as { needAlphaBlending: () => boolean }).needAlphaBlending();

  if (blends && flat.diffuseTexture !== null) {
    flat.diffuseTexture.hasAlpha = true;
    flat.useAlphaFromDiffuseTexture = true;
  }

  return flat;
}

export interface FlatMaterials {
  /** Disposes the replacements. The originals are left to their owner. */
  readonly dispose: () => void;
}

/**
 * Swaps every PBR material on these meshes for a flat equivalent.
 *
 * Converts each distinct material once however many meshes share it, which
 * matters for the props: six pillars are six meshes pointing at one material,
 * and six copies of it would undo the saving.
 *
 * The originals are deliberately *not* disposed. Loaded models keep their
 * materials on an `AssetContainer` that outlives the meshes and disposes them
 * itself; freeing them here would pull the rug from under that, and an
 * unreferenced material costs nothing per frame.
 */
export function flattenPbrMaterials(scene: Scene, meshes: readonly AbstractMesh[]): FlatMaterials {
  const replacements = new Map<Material, StandardMaterial>();

  for (const mesh of meshes) {
    const source = mesh.material;
    if (source === null || !isPbr(source)) {
      continue;
    }

    let flat = replacements.get(source);
    if (flat === undefined) {
      flat = flatten(scene, source);
      replacements.set(source, flat);
    }
    mesh.material = flat;
  }

  return {
    dispose: () => {
      for (const flat of replacements.values()) {
        // Textures are shared with the originals, which still own them.
        flat.dispose(true, false);
      }
      replacements.clear();
    },
  };
}
