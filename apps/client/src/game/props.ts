import type { Region } from '@adventure/game-core';
import { elevationAtWorld, tileCentreToWorld } from '@adventure/game-core';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

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

  return {
    firePoints,
    dispose: () => {
      for (const root of roots) {
        root.dispose(false, true);
      }
      for (const container of containers.values()) {
        container.dispose();
      }
    },
  };
}
