import type { Region } from '@adventure/game-core';
import { elevationAtWorld, tileCentreToWorld } from '@adventure/game-core';
import type { Material } from '@babylonjs/core/Materials/material';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import { flattenPbrMaterials } from './flatMaterials';
import { registerGltfLoader } from './gltf';

/**
 * The arena's scenery: pillars, braziers, fallen columns, crates.
 *
 * Placement is **data**. A region says "a brazier here, turned this way" and
 * this draws it; nothing about the arena's dressing lives in code, which is the
 * direction PLAN §20 sets for all content and the reason the layout can be
 * redrawn without a developer.
 *
 * Regions name a *model*, not a path. `brazier`, not
 * `/models/props/brazier_bowl.glb` — content that hardcoded the folder would
 * break the moment the assets moved, and regions are meant to outlive the
 * layout of the repository.
 *
 * Simpler than the character loader on purpose: these have no animation, no
 * socket and no fitting. The art set is authored at 1 unit = 1 metre with
 * base origins and embedded textures, so a placement is a position and a
 * rotation and nothing else. That is worth stating because it is *why* this is
 * short — the discipline is in the assets, not here.
 */

const MODEL_URLS: Readonly<Record<string, string>> = {
  'pillar-stump': '/models/props/pillar_stump.glb',
  'fallen-column': '/models/props/fallen_column.glb',
  'wall-segment': '/models/props/wall_segment_2m.glb',
  'wall-crumble-cap': '/models/props/wall_crumble_cap.glb',
  'gate-arch': '/models/props/gate_arch.glb',
  brazier: '/models/props/brazier_bowl.glb',
  'wall-torch': '/models/props/wall_torch.glb',
  crate: '/models/props/crate.glb',
  'weapon-rack': '/models/props/weapon_rack.glb',
  puddle: '/models/props/puddle_decal.glb',
};

export interface Props {
  /** Where each brazier and torch sits, so flames can be put on them. */
  readonly firePoints: readonly { x: number; y: number; z: number }[];
  readonly dispose: () => void;
}

/**
 * Loads every model a region asks for, once each, and places every instance.
 *
 * One container per distinct model, however many copies stand in the arena —
 * six pillars are six clones of one download, not six downloads.
 */
export async function createProps(scene: Scene, region: Region): Promise<Props> {
  const placements = region.objects.filter((object) => object.type === 'prop');
  const wanted = [...new Set(placements.map((object) => object.model))].filter(
    (model): model is string => model !== undefined && model in MODEL_URLS,
  );

  // Awaited before any load. Props and characters are loaded concurrently, so
  // whichever gets there first must not race the loader's registration.
  await registerGltfLoader();

  const roots: TransformNode[] = [];
  const firePoints: { x: number; y: number; z: number }[] = [];

  const containers = new Map(
    await Promise.all(
      wanted.map(
        async (model) => [model, await LoadAssetContainerAsync(MODEL_URLS[model]!, scene)] as const,
      ),
    ),
  );

  for (const placement of placements) {
    const container = placement.model === undefined ? undefined : containers.get(placement.model);
    if (container === undefined) {
      // An unknown model is a content mistake, not a crash. The rest of the
      // arena still builds, and the gap is visible.
      continue;
    }

    const entries = container.instantiateModelsToScene((name) => name, false, {
      doNotInstantiate: true,
    });

    const root = new TransformNode(placement.id, scene);
    for (const node of entries.rootNodes) {
      node.parent = root;
    }

    const centre = tileCentreToWorld(region, placement.tile.col, placement.tile.row);
    const ground = elevationAtWorld(region, centre.x, centre.z);
    // Base-origin models, so the tile's own height is the whole story — no
    // measuring, no offset.
    root.position.set(centre.x, ground, centre.z);
    root.rotation.y = ((placement.rotationDegrees ?? 0) * Math.PI) / 180;

    roots.push(root);

    if (placement.model === 'brazier' || placement.model === 'wall-torch') {
      // The bowl height, roughly: the flame belongs above the coals rather than
      // at the model's feet.
      const height = placement.model === 'brazier' ? 0.8 : 0.35;
      firePoints.push({ x: centre.x, y: ground + height, z: centre.z });
    }
  }

  // Twenty-four props arrive as ~180 separate meshes, because the models carry
  // a material per face. That is ~180 draw calls a frame for scenery that never
  // moves, and it was most of why the arena ran badly.
  //
  // Merged into a single mesh with a multi-material, the cost becomes one draw
  // call per *distinct material* rather than per mesh — the six pillars stop
  // being six copies of five draw calls and become part of five. World matrices
  // are baked in, which is exactly what makes it safe: none of this is ever
  // going to move.
  const parts = roots.flatMap((root) => root.getChildMeshes(false));

  // Before the merge, so the multi-material it builds is made of the flat
  // materials rather than of the PBR ones.
  const flattened = flattenPbrMaterials(scene, parts);

  let merged: Mesh | null = null;

  if (parts.length > 0) {
    merged = Mesh.MergeMeshes(
      // Geometry only. The glTF loader inserts a `__root__` node that is a Mesh
      // with no vertices, and merging one of those fails on vertex data that
      // does not exist.
      parts.filter(
        (mesh): mesh is Mesh =>
          mesh instanceof Mesh && mesh.getTotalVertices() > 0 && mesh.material !== null,
      ),
      true,
      true,
      undefined,
      false,
      // Keep the per-face materials, as submeshes of one mesh.
      true,
    );

    if (merged !== null) {
      merged.name = 'region-props';
      // Static scenery: stop recomputing a matrix that cannot change, and stop
      // re-evaluating materials that will never be dirty.
      merged.freezeWorldMatrix();
      merged.isPickable = false;
      // A multi-material is a list; freezing it does not reach the materials it
      // holds, and those are the ones the renderer checks.
      merged.material?.freeze();
      for (const sub of subMaterialsOf(merged.material)) {
        sub.freeze();
      }
    }
  }

  // The empty parents have served their purpose — the geometry is baked.
  for (const root of roots) {
    root.dispose(false, false);
  }

  return {
    firePoints,
    dispose: () => {
      merged?.dispose();
      flattened.dispose();
      for (const container of containers.values()) {
        container.dispose();
      }
    },
  };
}

/** The materials inside a multi-material, or the material itself if it is plain. */
function subMaterialsOf(material: Material | null): readonly Material[] {
  if (material === null) {
    return [];
  }
  const multi = material as { subMaterials?: (Material | null)[] };
  return multi.subMaterials === undefined
    ? [material]
    : multi.subMaterials.filter((sub): sub is Material => sub !== null);
}
