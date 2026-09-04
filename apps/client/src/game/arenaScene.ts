import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Material } from '@babylonjs/core/Materials/material';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';

import { flattenPbrMaterials } from './flatMaterials';
import { registerGltfLoader } from './gltf';

/**
 * The arena, as an artist built it.
 *
 * Until now the scenery was derived from the region grid — a textured quad per
 * tile — which is honest and can only ever look like a grid. This loads a single
 * authored model instead. PLAN §7 is unchanged and is in fact the reason this
 * works: the grid was never the picture, it is the **walkability truth**, and it
 * keeps doing that job while something built by hand does the looking.
 *
 * The handoff (`assets/world/videvikumaa-arena-handoff.md`) is explicit about
 * what glTF could not carry, and that is the whole shape of this file: **glTF
 * has no sprites and no lights**, so the exporter dropped both. What it left
 * instead is better than a list of coordinates — empty nodes, named, at exactly
 * the right places: ten `flame`, four `brazier_glow`, six `torch_glow`, plus
 * `gate_spill`, `secret_spill`, `shrine_glow` and `grove_glow`. So the sprite
 * positions are read out of the model rather than copied into code, and moving
 * a brazier in the source moves its fire with it.
 *
 * The lights are the one thing transcribed by hand, from the manifest table,
 * because there is nowhere in the file to keep them.
 */

/** Where each authored model lives, by the name a region asks for. */
const SCENE_MODELS: Readonly<Record<string, string>> = {
  arena: '/models/arena/arena.glb',
};

/** Empty nodes marking a flame billboard. */
const FLAME_ANCHOR = /^flame$/;
/** Empty nodes marking a softer, wider pool of glow. */
const GLOW_ANCHOR = /(_glow|_spill)$/;

/** Surfaces that belong to the wave-active state and are hidden until it runs. */
const WAVE_ONLY = /telegraph/;

export interface ScenePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ArenaScene {
  /** Anchors for flame billboards, read out of the model itself. */
  readonly firePoints: readonly ScenePoint[];
  /** Anchors for the larger, softer glows. */
  readonly glowPoints: readonly ScenePoint[];
  /** Draw calls after merging, so the cost is reportable rather than guessed. */
  readonly drawCalls: number;
  /** Shows the danger ring the board ships with, which is off until a wave runs. */
  readonly setWaveActive: (active: boolean) => void;
  readonly dispose: () => void;
}

/** True when a material is meant to shine rather than be lit. */
function isEmissive(name: string): boolean {
  return name.includes('emissive');
}

/**
 * Decides which materials are really the same material.
 *
 * The export carries **161 materials and 154 embedded images for roughly 28
 * distinct surfaces** — one instance per mesh, the same duplication the props
 * and the character had. Collapsing them by authored name is what turns 484
 * draw calls into a few dozen, and it is safe precisely because the name is the
 * artist's own identifier: two things called `wall_stone` were one material
 * before the exporter split them apart.
 */
function materialKey(material: Material): string {
  return material.name.replace(/-flat$/, '').replace(/[.\-_]\d+$/, '');
}

/**
 * @param centre  where the model's origin belongs, in world metres.
 *
 * The two coordinate systems meet here and they do not agree. A region occupies
 * world space from its **south-west corner**: `tileCentreToWorld` is
 * `(col + 0.5)`, so a 26x26 region runs 0..26 in both axes. An authored model is
 * built around its own **centre**. Loaded as-is the arena sat with its middle at
 * the region's corner and the player spawned 13 m outside the walls, which is
 * exactly what the first run showed.
 */
export async function createArenaScene(
  scene: Scene,
  model: string,
  centre: { readonly x: number; readonly z: number },
): Promise<ArenaScene> {
  const url = SCENE_MODELS[model];
  if (url === undefined) {
    throw new Error(`region names an unknown scene model: ${model}`);
  }

  await registerGltfLoader();
  const container = await LoadAssetContainerAsync(url, scene);
  container.addAllToScene();

  // Moved before anchors are read and before anything is merged, so the offset
  // is baked into the merged geometry rather than applied to it afterwards —
  // merged meshes carry world-space vertices and would not agree with the
  // single meshes that stay parented to the loader's root.
  for (const root of container.rootNodes) {
    // `rootNodes` is typed as `Node`, which has no transform of its own.
    if (root instanceof TransformNode) {
      root.position.x += centre.x;
      root.position.z += centre.z;
      root.computeWorldMatrix(true);
    }
  }
  for (const node of [...container.transformNodes, ...container.meshes]) {
    node.computeWorldMatrix(true);
  }

  const firePoints: ScenePoint[] = [];
  const glowPoints: ScenePoint[] = [];

  for (const node of container.transformNodes) {
    const world = node.getAbsolutePosition();
    const point = { x: world.x, y: world.y, z: world.z };
    if (FLAME_ANCHOR.test(node.name)) {
      firePoints.push(point);
    } else if (GLOW_ANCHOR.test(node.name)) {
      glowPoints.push(point);
    }
  }

  /*
   * The ember cloud is a POINTS primitive. It will not survive a merge and does
   * not read as embers anyway; the manifest describes it as a particle system
   * to rebuild, so it is dropped rather than half-drawn.
   *
   * Selected **by name**, not by "has no indices" — which was the first attempt
   * and was wrong: 10 of the arena's 484 primitives are legitimately
   * non-indexed triangle geometry, and that test threw away real walls.
   */
  const drawable: AbstractMesh[] = [];
  for (const mesh of container.meshes) {
    if (mesh.getTotalVertices() === 0) {
      continue;
    }
    if (mesh.name === 'embers') {
      mesh.dispose();
      continue;
    }
    drawable.push(mesh);
  }

  const byMaterial = new Map<string, { material: Material; meshes: Mesh[] }>();
  for (const mesh of drawable) {
    const material = mesh.material;
    if (!(mesh instanceof Mesh) || material === null) {
      continue;
    }

    const key = materialKey(material);
    const bucket = byMaterial.get(key);
    if (bucket === undefined) {
      byMaterial.set(key, { material, meshes: [mesh] });
    } else {
      bucket.meshes.push(mesh);
    }
  }

  // Collapse first, convert second. The other way round — which is how this was
  // written at first — converts all 161 exported materials and then throws 120
  // of them away, leaving the scene holding hundreds of materials nothing draws.
  // Sharing the representative material *before* flattening means one
  // StandardMaterial is built per actual surface.
  for (const bucket of byMaterial.values()) {
    for (const mesh of bucket.meshes) {
      mesh.material = bucket.material;
    }
  }

  const flattened = flattenPbrMaterials(scene, drawable);

  const merged: Mesh[] = [];
  const waveOnly: Mesh[] = [];
  for (const [key, bucket] of byMaterial) {
    const surface = bucket.meshes[0]?.material ?? bucket.material;
    for (const mesh of bucket.meshes) {
      mesh.material = surface;
    }

    if (isEmissive(key) && surface instanceof StandardMaterial) {
      const material = surface;
      // A glowing rune must not get darker in shadow: that is what makes it
      // read as a light source rather than as a pale stone.
      material.emissiveColor = material.diffuseColor.clone();
      material.disableLighting = true;
    }

    const single = bucket.meshes[0];
    const result =
      bucket.meshes.length === 1 && single !== undefined
        ? single
        : Mesh.MergeMeshes(bucket.meshes, true, true, undefined, false, false);

    if (result !== null && result !== undefined) {
      result.name = `arena-${key}`;
      result.isPickable = false;
      result.freezeWorldMatrix();
      result.material?.freeze();
      merged.push(result);

      // The board ships its wave-active state as geometry, because the design
      // viewer had a toggle for it. A danger telegraph that is permanently on
      // is worse than no telegraph: red is reserved for danger by the colour
      // law, and a red ring that never means anything teaches a child to ignore
      // the one colour that must never be ignored.
      if (WAVE_ONLY.test(key)) {
        result.setEnabled(false);
        waveOnly.push(result);
      }
    }
  }

  return {
    firePoints,
    glowPoints,
    drawCalls: merged.length,
    setWaveActive: (active) => {
      for (const mesh of waveOnly) {
        mesh.setEnabled(active);
      }
    },
    dispose: () => {
      for (const mesh of merged) {
        mesh.dispose();
      }
      flattened.dispose();
      container.dispose();
    },
  };
}

/**
 * The lighting the board was drawn under.
 *
 * Transcribed from the manifest, which calls it "the board's law": one violet
 * twilight ambient, one warm point at the hearth of the ring, one pink at the
 * gate, a faint cool moon rim — and the instruction *only three, keep it that
 * way*. Every other glow in the picture is an emissive material or an additive
 * sprite, which is exactly the budget PLAN §26 asks for: light is spent on the
 * fight, not on the scenery.
 *
 * The intensities are **not** the manifest's numbers, and that is deliberate.
 * Those are three.js values, where a point light carries `distance` and `decay`
 * and the renderer normalises differently; copying `90` into Babylon puts a
 * white hole where the hearth should be. Colours, positions and ranges are
 * transcribed exactly; the two point intensities are matched to the board by
 * eye, which is the only honest way to move between two renderers' units.
 */
export interface ArenaLighting {
  /** Lifts the hearth and gate while a wave is running, as the manifest asks. */
  readonly setWaveActive: (active: boolean) => void;
  readonly dispose: () => void;
}

/*
 * Babylon point lights fall off with the inverse square of distance, so the
 * number here is not brightness — it is brightness *at one metre*. The hearth
 * is 8 m from the arena's edge, where an intensity of 1 arrives as 1/64th of
 * itself: the first attempt used 1.15 and lit almost nothing, which is why the
 * whole board came back looking like a cave.
 *
 * The manifest's 90 and 45 are three.js values, where the light carries its own
 * `distance` and `decay`. These are the Babylon equivalents, set to put roughly
 * the same amount of warm light on the far rim.
 */
const HEARTH_BASE = 48;
const HEARTH_WAVE = 64;
const GATE_BASE = 22;
const GATE_WAVE = 30;

/** #241E44 — the fog and the void behind the walls are the same colour. */
const TWILIGHT_VOID = new Color3(0.141, 0.118, 0.267);

/**
 * `?light=1.3` brightens everything, `?light=0.8` darkens it.
 *
 * Here for the same reason `?zoom=` and `?dpr=` are: the two renderers'
 * lighting units do not correspond, the art was authored through a tone curve
 * this engine does not reproduce exactly, and the only screen whose judgement
 * matters is a phone in Estonia. A number that can be turned on the device
 * beats another round of me guessing from a desktop.
 */
export function lightScaleFromSearch(search: string): number {
  const requested = new URLSearchParams(search).get('light');
  if (requested === null) {
    return 1;
  }
  const parsed = Number.parseFloat(requested);
  return Number.isFinite(parsed) && parsed >= 0.2 && parsed <= 4 ? parsed : 1;
}

export function createArenaLighting(scene: Scene): ArenaLighting {
  const scale = lightScaleFromSearch(typeof window === 'undefined' ? '' : window.location.search);
  scene.clearColor = new Color4(TWILIGHT_VOID.r, TWILIGHT_VOID.g, TWILIGHT_VOID.b, 1);

  // Exponential fog. It is what puts the far wall *behind* the fight rather
  // than beside it, and it is why the arena reads as a place at dusk.
  scene.fogMode = 2; // FOGMODE_EXP
  scene.fogColor = TWILIGHT_VOID;
  scene.fogDensity = 0.009;

  /*
   * ACES filmic at exposure 1.35, straight from the manifest.
   *
   * Leaving this out was why the first build came back looking like a different
   * place: the colours were right and the lights were right, and without the
   * tone curve the whole board sat in the bottom of its range. It is not a
   * finishing touch — the art was authored *through* it, so it is as much a
   * part of the look as the textures are.
   */
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = 1; // ACES
  scene.imageProcessingConfiguration.exposure = 1.6 * scale;

  const twilight = new HemisphericLight('twilight-ambient', new Vector3(0, 1, 0), scene);
  twilight.diffuse = new Color3(0.478, 0.416, 0.659);
  /*
   * The manifest's ground colour is #3A4A5C, and taken literally it left the
   * arena rim almost black.
   *
   * A hemispheric light gives a surface the sky colour when it faces up and the
   * ground colour when it faces down, mixing between the two. The rim step, the
   * wall faces and every vertical edge in the arena sit near the middle of that
   * mix, so they are lit mostly by the ground colour — and a dark ground colour
   * makes exactly the edges a player needs to read disappear.
   *
   * Lifted, and lifted *towards violet* rather than towards grey: in the
   * reference art the shadows are deep blue and purple, never black. Dark
   * shadows are a colour choice, and reading them as an absence of light is how
   * a scene ends up muddy.
   */
  twilight.groundColor = new Color3(0.38, 0.35, 0.52);
  // 1.35 is the manifest's figure and it is a three.js one. Babylon's
  // hemispheric light is dimmer for the same number, and the board's stone is
  // near-black greyscale — every texture in the export averages under 15% grey,
  // because all the colour was always meant to come from the lights.
  twilight.intensity = 2.6 * scale;

  const hearth = new PointLight('hearth-light', new Vector3(0, 3.2, 0), scene);
  hearth.diffuse = new Color3(0.949, 0.569, 0.239);
  hearth.range = 30;
  hearth.intensity = HEARTH_BASE * scale;

  const gate = new PointLight('gate-light', new Vector3(9.6, 2.2, 0), scene);
  gate.diffuse = new Color3(0.878, 0.416, 0.659);
  gate.range = 14;
  gate.intensity = GATE_BASE * scale;

  // Direction, not position: the manifest gives where the moon *is*, so the
  // light travels from there towards the arena.
  const moon = new DirectionalLight('moon-rim', new Vector3(8, -12, 6), scene);
  moon.diffuse = new Color3(0.431, 0.659, 0.784);
  moon.intensity = 1.35 * scale;

  return {
    setWaveActive: (active) => {
      hearth.intensity = (active ? HEARTH_WAVE : HEARTH_BASE) * scale;
      gate.intensity = (active ? GATE_WAVE : GATE_BASE) * scale;
    },
    dispose: () => {
      twilight.dispose();
      hearth.dispose();
      gate.dispose();
      moon.dispose();
    },
  };
}
