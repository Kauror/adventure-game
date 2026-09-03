import type { Region, TerrainKind } from '@adventure/game-core';
import { TILE_METRES, tileAt, tileCentreToWorld } from '@adventure/game-core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';

import { createRegionMaterials } from './regionTextures';

/** Height of a wall block, in metres. Tall enough to read, short enough to see over. */
const WALL_HEIGHT_METRES = 1.6;

/**
 * The arena rim is a low boundary, not a wall you hide behind.
 *
 * In the design it is a glowing strip marking the edge of the fighting floor.
 * At full wall height it would enclose the arena like a room and hide the
 * dressing beyond it; at knee height it reads as a boundary you can see over,
 * which is what it is.
 */
const RIM_HEIGHT_METRES = 0.45;

export const GROUND_MESH_NAME = 'region-ground';

/**
 * Builds the visible scenery for a region.
 *
 * The grid is the logical truth; everything here is decoration derived from it,
 * so the picture cannot drift away from what the simulation believes. Every tile
 * is drawn as its own one-metre quad or block and then **merged by surface**:
 * one draw call per material rather than one per tile. A 32×22 arena is 704
 * tiles, and 704 draw calls of static scenery is not a budget a phone should
 * spend.
 */
export function buildRegion(scene: Scene, region: Region): { readonly ground: Mesh | null } {
  const materials = createRegionMaterials(scene);

  // Collected per surface, merged once at the end.
  const byTerrain = new Map<TerrainKind, Mesh[]>();
  const collect = (terrain: TerrainKind, mesh: Mesh): void => {
    const bucket = byTerrain.get(terrain);
    if (bucket === undefined) {
      byTerrain.set(terrain, [mesh]);
    } else {
      bucket.push(mesh);
    }
  };

  for (let row = 0; row < region.height; row += 1) {
    for (let col = 0; col < region.width; col += 1) {
      const tile = tileAt(region, col, row);
      if (tile === undefined) {
        continue;
      }

      const centre = tileCentreToWorld(region, col, row);

      if (!tile.walkable) {
        const height = tile.terrain === 'rim' ? RIM_HEIGHT_METRES : WALL_HEIGHT_METRES;
        const block = MeshBuilder.CreateBox(
          `block-${col}-${row}`,
          { width: TILE_METRES, depth: TILE_METRES, height },
          scene,
        );
        // Sits on whatever the tile's base height is, so the rim rides the
        // raised arena floor rather than sinking into the ground beside it.
        block.position.set(centre.x, tile.elevation + height / 2, centre.z);
        collect(tile.terrain, block);
        continue;
      }

      // A one-metre quad per walkable tile. Its UVs run 0–1, so a 64 px tile is
      // exactly one metre of world without any scaling.
      const floor = MeshBuilder.CreateGround(
        `floor-${col}-${row}`,
        { width: TILE_METRES, height: TILE_METRES },
        scene,
      );
      floor.position.set(centre.x, tile.elevation, centre.z);
      collect(tile.terrain, floor);

      if (tile.elevation > 0) {
        // The sides of a raised tile, so a platform has thickness.
        const side = MeshBuilder.CreateBox(
          `platform-${col}-${row}`,
          { width: TILE_METRES, depth: TILE_METRES, height: tile.elevation },
          scene,
        );
        side.position.set(centre.x, tile.elevation / 2, centre.z);
        collect(tile.terrain, side);
      }
    }
  }

  let ground: Mesh | null = null;
  for (const [terrain, meshes] of byTerrain) {
    const merged = mergeInto(meshes, `region-${terrain}`, materials.forTerrain(terrain));
    // The largest walkable surface stands in as "the ground" for anything that
    // wants a floor to refer to.
    if (merged !== null && ground === null && terrain !== 'wall' && terrain !== 'rim') {
      merged.name = GROUND_MESH_NAME;
      ground = merged;
    }
  }

  buildSpawnMarker(scene, region, 'player-spawn', new Color3(0.4, 0.8, 0.45));
  buildSpawnMarker(scene, region, 'enemy-spawn', new Color3(0.85, 0.35, 0.35));

  return { ground };
}

function mergeInto(meshes: Mesh[], name: string, material: StandardMaterial): Mesh | null {
  if (meshes.length === 0) {
    return null;
  }

  const merged = Mesh.MergeMeshes(meshes, true, true);
  if (merged === null) {
    // Merging failed for some reason — keep the individual meshes rather than
    // silently rendering nothing.
    for (const mesh of meshes) {
      mesh.material = material;
    }
    return null;
  }

  merged.name = name;
  merged.material = material;
  // Scenery never moves and its material never changes. Freezing both takes
  // them out of the per-frame matrix and material-dirty work entirely.
  merged.freezeWorldMatrix();
  merged.isPickable = false;
  material.freeze();
  return merged;
}

function buildSpawnMarker(
  scene: Scene,
  region: Region,
  type: 'player-spawn' | 'enemy-spawn',
  colour: Color3,
): void {
  const material = new StandardMaterial(`${type}-material`, scene);
  material.diffuseColor = colour;
  material.specularColor = Color3.Black();

  for (const object of region.objects.filter((candidate) => candidate.type === type)) {
    const tile = tileAt(region, object.tile.col, object.tile.row);
    const centre = tileCentreToWorld(region, object.tile.col, object.tile.row);
    const elevation = tile?.elevation ?? 0;

    const marker = MeshBuilder.CreateBox(object.id, { size: 0.4 * TILE_METRES }, scene);
    marker.position.set(centre.x, elevation + 0.2, centre.z);
    marker.material = material;
  }
}
