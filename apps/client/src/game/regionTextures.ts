import type { TerrainKind } from '@adventure/game-core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

/**
 * A material per terrain surface.
 *
 * The region's legend names what each tile is made of, and this is the only
 * place those names become pictures. Adding a surface to the art set means a
 * line here and a line in `TerrainKind` — the arena's appearance is data, not
 * code, which is the direction PLAN §20 sets for all content.
 *
 * Three conventions come from the asset handoff and all three matter:
 *
 *  - **64 px = 1 m.** Every tile is a one-metre quad with UV 0–1, so a tile
 *    shows exactly one repeat and the picture agrees with the rules (ADR 0002).
 *  - **NEAREST sampling, no mipmaps.** Indexed-look pixel art. Filtering turns
 *    crisp slabs to mush, which is the one thing that would make it read as a
 *    mistake rather than a style.
 *  - **Repeat, not clamp.** Babylon clamps by default, and a clamped surface
 *    samples its edge texel across its whole face. That produced a flat sheet of
 *    colour once already: a texture drawn correctly and sampled wrong looks
 *    exactly like one that failed to load.
 */

const TEXTURE_FOR: Readonly<Record<TerrainKind, string>> = {
  // The authored arena surfaces.
  flagstone: '/textures/ground/flagstone_a.png',
  'flagstone-cracked': '/textures/ground/flagstone_b_cracked.png',
  'flagstone-teal': '/textures/ground/flagstone_teal.png',
  moss: '/textures/ground/flagstone_mossy.png',
  dirt: '/textures/ground/dirt.png',
  'dirt-mossy': '/textures/ground/dirt_mossy.png',
  stone: '/textures/stone/stone_block.png',
  'stone-broken': '/textures/stone/stone_broken.png',
  rim: '/textures/stone/stone_cap.png',

  // The original generic three, kept so an older region still loads.
  floor: '/textures/ground/flagstone_a.png',
  wall: '/textures/stone/stone_block.png',
  platform: '/textures/ground/flagstone_teal.png',
};

/**
 * The arena rim glows.
 *
 * There is no gold texture in the set — in the design the rim is an *emissive*
 * strip, which is a material property rather than a picture. This is that,
 * applied to the cap stone: warm, low, and the only self-lit surface in the
 * arena, so it reads as a boundary rather than as another wall.
 */
const RIM_EMISSIVE = new Color3(0.42, 0.26, 0.05);

export interface RegionMaterials {
  /** The material for a surface, created once and shared by every tile of it. */
  readonly forTerrain: (terrain: TerrainKind) => StandardMaterial;
  readonly dispose: () => void;
}

function loadTile(scene: Scene, url: string): Texture {
  // noMipmap, invertY, NEAREST — the art direction, not preference.
  const texture = new Texture(url, scene, true, true, Texture.NEAREST_SAMPLINGMODE);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

export function createRegionMaterials(scene: Scene): RegionMaterials {
  const materials = new Map<TerrainKind, StandardMaterial>();

  const build = (terrain: TerrainKind): StandardMaterial => {
    const material = new StandardMaterial(`terrain-${terrain}`, scene);
    // White, so the texture shows its authored colour rather than a tint of it.
    material.diffuseColor = Color3.White();
    material.specularColor = Color3.Black();
    material.diffuseTexture = loadTile(scene, TEXTURE_FOR[terrain]);
    if (terrain === 'rim') {
      material.emissiveColor = RIM_EMISSIVE;
    }
    return material;
  };

  return {
    forTerrain: (terrain) => {
      const existing = materials.get(terrain);
      if (existing !== undefined) {
        return existing;
      }
      // One material and one texture per surface, however many tiles use it.
      const created = build(terrain);
      materials.set(terrain, created);
      return created;
    },

    dispose: () => {
      for (const material of materials.values()) {
        material.diffuseTexture?.dispose();
        material.dispose();
      }
      materials.clear();
    },
  };
}
