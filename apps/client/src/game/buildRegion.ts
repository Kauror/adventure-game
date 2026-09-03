import type { Region } from '@adventure/game-core';
import { TILE_METRES, regionSizeMetres, tileAt, tileCentreToWorld } from '@adventure/game-core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';

import { createRegionTextures } from './regionTextures';

/** Height of a wall block, in metres. Tall enough to read, short enough to see over. */
const WALL_HEIGHT_METRES = 1.6;

export const GROUND_MESH_NAME = 'region-ground';

function flatMaterial(scene: Scene, name: string, colour: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = colour;
  material.specularColor = Color3.Black();
  return material;
}

/**
 * Builds the visible scenery for a region.
 *
 * The grid is the logical truth; everything here is decoration derived from it.
 * Nothing in the scene is authored by hand, so the picture cannot drift away
 * from what the simulation believes.
 */
export function buildRegion(scene: Scene, region: Region): { readonly ground: Mesh } {
  const size = regionSizeMetres(region);
  const textures = createRegionTextures(scene, region);

  const ground = MeshBuilder.CreateGround(
    GROUND_MESH_NAME,
    { width: size.width, height: size.depth },
    scene,
  );
  // CreateGround is centred on its origin; the region starts at world (0, 0).
  ground.position.x = size.width / 2;
  ground.position.z = size.depth / 2;
  // The colour lives in the texture now, so the material must not tint it.
  const groundMaterial = flatMaterial(scene, 'region-ground-material', Color3.White());
  groundMaterial.diffuseTexture = textures.floor;
  ground.material = groundMaterial;

  const wallMaterial = flatMaterial(scene, 'region-wall-material', Color3.White());
  wallMaterial.diffuseTexture = textures.wall;

  const platformMaterial = flatMaterial(scene, 'region-platform-material', Color3.White());
  platformMaterial.diffuseTexture = textures.platform;

  const walls: Mesh[] = [];
  const platforms: Mesh[] = [];

  for (let row = 0; row < region.height; row += 1) {
    for (let col = 0; col < region.width; col += 1) {
      const tile = tileAt(region, col, row);
      if (tile === undefined) {
        continue;
      }

      const centre = tileCentreToWorld(region, col, row);

      if (!tile.walkable) {
        const wall = MeshBuilder.CreateBox(
          `wall-${col}-${row}`,
          { width: TILE_METRES, depth: TILE_METRES, height: WALL_HEIGHT_METRES },
          scene,
        );
        wall.position.set(centre.x, WALL_HEIGHT_METRES / 2, centre.z);
        walls.push(wall);
        continue;
      }

      if (tile.elevation > 0) {
        const platform = MeshBuilder.CreateBox(
          `platform-${col}-${row}`,
          { width: TILE_METRES, depth: TILE_METRES, height: tile.elevation },
          scene,
        );
        platform.position.set(centre.x, tile.elevation / 2, centre.z);
        platforms.push(platform);
      }
    }
  }

  // Merge per-tile boxes into one mesh each: a 20x14 region is ~90 wall tiles,
  // and 90 draw calls for static scenery is not a budget a phone should spend.
  mergeInto(walls, 'region-walls', wallMaterial);
  mergeInto(platforms, 'region-platforms', platformMaterial);

  buildSpawnMarker(scene, region, 'player-spawn', new Color3(0.4, 0.8, 0.45));
  buildSpawnMarker(scene, region, 'enemy-spawn', new Color3(0.85, 0.35, 0.35));

  return { ground };
}

function mergeInto(meshes: Mesh[], name: string, material: StandardMaterial): void {
  if (meshes.length === 0) {
    return;
  }

  const merged = Mesh.MergeMeshes(meshes, true, true);
  if (merged === null) {
    // Merging failed for some reason — keep the individual meshes rather than
    // silently rendering nothing.
    for (const mesh of meshes) {
      mesh.material = material;
    }
    return;
  }

  merged.name = name;
  merged.material = material;
}

function buildSpawnMarker(
  scene: Scene,
  region: Region,
  type: 'player-spawn' | 'enemy-spawn',
  colour: Color3,
): void {
  const material = flatMaterial(scene, `${type}-material`, colour);

  for (const object of region.objects.filter((candidate) => candidate.type === type)) {
    const tile = tileAt(region, object.tile.col, object.tile.row);
    const centre = tileCentreToWorld(region, object.tile.col, object.tile.row);
    const elevation = tile?.elevation ?? 0;

    const marker = MeshBuilder.CreateBox(object.id, { size: 0.4 * TILE_METRES }, scene);
    marker.position.set(centre.x, elevation + 0.2, centre.z);
    marker.material = material;
  }
}
