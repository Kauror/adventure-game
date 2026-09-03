import type { Region } from '@adventure/game-core';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';

/**
 * The arena's surfaces.
 *
 * These replaced a procedural set that existed only because the art direction
 * had not been chosen yet. It has been now, so the placeholder is gone and these
 * are the authored tiles — see `assets/ATTRIBUTION.md`.
 *
 * Three conventions come from the asset handoff and all three matter:
 *
 *  - **64 px = 1 m.** The ground repeats once per tile, so a metre of floor is a
 *    metre of texture and the picture agrees with the rules (ADR 0002). Walls
 *    and platforms are 1 m boxes whose faces are UV 0–1, so they get the correct
 *    scale for free.
 *  - **NEAREST sampling, no mipmaps.** This is indexed-look pixel art. Smoothing
 *    turns crisp slabs to mush, which is the one thing that would make it read
 *    as a mistake rather than a style.
 *  - **Repeat, not clamp.** Babylon textures clamp by default, and a clamped
 *    ground samples its edge texel across the whole floor. That produced a flat
 *    sheet of colour once already: a texture drawn correctly and sampled wrong
 *    looks exactly like one that failed to load.
 */

/** Chosen from the handoff manifest's intended use, not by eye. */
const FLOOR_URL = '/textures/ground/flagstone_a.png';
const WALL_URL = '/textures/stone/stone_block.png';
const PLATFORM_URL = '/textures/ground/flagstone_teal.png';

export interface RegionTextures {
  readonly floor: Texture;
  readonly wall: Texture;
  readonly platform: Texture;
  readonly dispose: () => void;
}

/**
 * Loads one pixel-art tile.
 *
 * The cost of turning mipmaps off is shimmer when a surface is heavily
 * minified. The camera here is fixed and orthographic, so the ground sits at one
 * constant scale and there is nothing to shimmer.
 */
function loadTile(scene: Scene, url: string, name: string): Texture {
  const texture = new Texture(url, scene, true, true, Texture.NEAREST_SAMPLINGMODE);
  texture.name = name;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

export function createRegionTextures(scene: Scene, region: Region): RegionTextures {
  const floor = loadTile(scene, FLOOR_URL, 'region-floor-texture');
  // One repeat per tile: 64 px of texture is one metre of world.
  floor.uScale = region.width;
  floor.vScale = region.height;

  const wall = loadTile(scene, WALL_URL, 'region-wall-texture');
  const platform = loadTile(scene, PLATFORM_URL, 'region-platform-texture');

  return {
    floor,
    wall,
    platform,
    dispose: () => {
      floor.dispose();
      wall.dispose();
      platform.dispose();
    },
  };
}
