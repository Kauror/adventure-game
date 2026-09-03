import { parseRegion, tileCentreToWorld } from '@adventure/game-core';
import { regions, TEST_ARENA_ID } from '@adventure/content';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';

import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Meshes/Builders/boxBuilder';

import { createGameCamera } from '../game/camera';
import { loadCharacter } from '../game/character';
import type { Character } from '../game/character';
import { createEngine } from '../game/createEngine';
import { createDiagnostics } from '../game/diagnostics';
import { createFrameGate, frameCapFromLocation } from '../game/frameCap';
import { createImpactBurst } from '../game/impactBurst';
import { createScene } from '../game/createScene';
import { createFrameStats } from './frameStats';
import { createStressReadout } from './readout';

/**
 * The device baseline's measurement scene (roadmap 0A.12).
 *
 * Explicitly exempt from Stage 0A's one-character/one-enemy scope, and no child
 * ever sees it: it exists to produce numbers. The entities have no AI and no
 * combat — they walk in circles, because what is being measured is animated
 * meshes, draw calls and fill rate, not behaviour.
 *
 * What makes the numbers worth anything is that everything here is the *real*
 * pipeline: the same GLB characters, the same loader and fitting, the same
 * orthographic camera and projection, the same particle system, the same frame
 * cap. A synthetic scene built from different parts would measure a game nobody
 * is going to ship.
 *
 * Reached only through `?stress=1|2|3`, and imported dynamically, so none of it
 * — including the shadow machinery, which the game does not otherwise use — is
 * in the bundle a child downloads.
 */

/** The roadmap's "normal scene", multiplied by the ladder step. */
const NORMAL_HUMANOIDS = 6;
const NORMAL_ENTITIES = 10;
/** Environment props beyond the region's own walls and platforms. */
const NORMAL_PROPS = 24;

// The character the game actually ships, so the numbers are about the real
// thing rather than about a model nobody sees.
const HERO_MODEL = '/models/kid01.glb';
const FOE_MODEL = '/models/foe.glb';

export interface StressOptions {
  /** 1, 2 or 3 — the roadmap's stress ladder. */
  readonly ladder: number;
  /** Shadows are the roadmap's explicit on/off comparison. */
  readonly shadows: boolean;
}

/** `?stress=2&shadows=1` */
export function stressOptionsFromLocation(search: string = window.location.search): StressOptions {
  const params = new URLSearchParams(search);
  const requested = Number.parseInt(params.get('stress') ?? '1', 10);
  return {
    ladder: Number.isFinite(requested) ? Math.min(3, Math.max(1, requested)) : 1,
    shadows: params.get('shadows') === '1',
  };
}

/** A walker: a character and the circle it paces around. */
interface Walker {
  readonly character: Character;
  readonly centre: { x: number; z: number };
  readonly radius: number;
  readonly speed: number;
  phase: number;
}

export async function runStressScene(
  canvas: HTMLCanvasElement,
  overlay: HTMLElement,
  options: StressOptions,
): Promise<() => void> {
  const region = parseRegion(regions[TEST_ARENA_ID]);
  const { engine, dispose: disposeEngine } = createEngine(canvas);
  const scene = createScene(engine, region);

  const centre = tileCentreToWorld(
    region,
    Math.floor(region.width / 2),
    Math.floor(region.height / 2),
  );
  const camera = createGameCamera(scene, engine, () => ({ x: centre.x, y: 0, z: centre.z }));

  const frames = createFrameGate(frameCapFromLocation());

  // Started before the characters load, not after. Sixteen models at ladder 1
  // and forty-eight at ladder 3 take a visible moment on a phone, and a black
  // screen during it is indistinguishable from the crash this project has
  // already shipped once. The arena draws immediately; the crowd arrives into
  // it.
  engine.runRenderLoop(() => {
    if (frames.shouldRender(performance.now())) {
      scene.render();
    }
  });

  const humanoids = NORMAL_HUMANOIDS * options.ladder;
  const entities = NORMAL_ENTITIES * options.ladder;
  const props = NORMAL_PROPS * options.ladder;

  const stats = createFrameStats();
  const diagnostics = createDiagnostics(engine, frames);
  const readout = createStressReadout(overlay, {
    ladder: options.ladder,
    shadows: options.shadows,
    humanoids,
    entities,
    props,
    device: diagnostics.device,
    onReset: () => {
      // Warm-up frames — shader compilation, texture upload — are not what the
      // baseline is about. Resetting after things settle is the honest way to
      // measure the steady state.
      stats.reset();
    },
  });

  // Loaded once and cloned per instance would be faster — and that is exactly
  // why it is not done. The game loads a container per actor, so the
  // measurement does too, or it measures a loader nobody uses. Loading them
  // concurrently changes none of that and turns a slow crawl at ladder 3 into a
  // moment.
  const walkers: Walker[] = await Promise.all(
    Array.from({ length: humanoids + entities }, async (_unused, i) => {
      const isHumanoid = i < humanoids;
      const character = await loadCharacter(scene, isHumanoid ? HERO_MODEL : FOE_MODEL, {
        heightMetres: isHumanoid ? 1.3 : 1.5,
      });
      character.play('walk');

      // Radius cycles rather than growing with the count: at ladder 3 a growing
      // ring would walk most of the crowd off the edge of a 9 m viewport, and
      // entities the camera never draws measure nothing.
      return {
        character,
        centre: { x: centre.x, z: centre.z },
        radius: 1.2 + (i % 6) * 1.15,
        speed: 0.5 + (i % 5) * 0.12,
        phase: (i / 7) * Math.PI * 2,
      };
    }),
  );

  // Environment props, on top of the region's own walls and platforms.
  const propMaterial = new StandardMaterial('stress-prop-material', scene);
  propMaterial.diffuseColor = new Color3(0.45, 0.42, 0.5);
  propMaterial.specularColor = Color3.Black();

  const propMeshes: Mesh[] = [];
  for (let i = 0; i < props; i += 1) {
    const box = MeshBuilder.CreateBox(`stress-prop-${i}`, { size: 0.5 + (i % 3) * 0.25 }, scene);
    box.material = propMaterial;
    const angle = (i / props) * Math.PI * 2;
    const distance = 3 + (i % 5) * 1.1;
    box.position.set(
      centre.x + Math.sin(angle) * distance,
      0.4,
      centre.z + Math.cos(angle) * distance,
    );
    propMeshes.push(box);
  }

  // Shadows: the roadmap's on/off comparison, and the single most expensive
  // thing that could be added to this scene.
  let shadowLight: DirectionalLight | null = null;
  let shadows: ShadowGenerator | null = null;
  if (options.shadows) {
    shadowLight = new DirectionalLight('stress-sun', new Vector3(-0.4, -1, 0.3), scene);
    shadowLight.position = new Vector3(centre.x + 8, 18, centre.z - 6);
    shadows = new ShadowGenerator(1024, shadowLight);
    shadows.usePercentageCloserFiltering = true;
    for (const walker of walkers) {
      for (const mesh of walker.character.root.getChildMeshes(false)) {
        shadows.addShadowCaster(mesh);
      }
    }
  }

  const impacts = createImpactBurst(scene);

  let sinceBurst = 0;

  const observer = scene.onBeforeRenderObservable.add(() => {
    const frameMs = engine.getDeltaTime();
    stats.record(frameMs);
    const deltaSeconds = frameMs / 1000;

    for (const walker of walkers) {
      walker.phase += walker.speed * deltaSeconds;
      const x = walker.centre.x + Math.sin(walker.phase) * walker.radius;
      const z = walker.centre.z + Math.cos(walker.phase) * walker.radius;
      walker.character.root.position.set(x, 0, z);
      // Face along the circle, so the walk cycle points where it is going.
      walker.character.root.rotation.y = walker.phase + Math.PI / 2;
    }

    // Basic particles, continuously, because the game emits them at exactly the
    // moments it is already busiest.
    sinceBurst += deltaSeconds;
    if (sinceBurst > 0.25) {
      sinceBurst = 0;
      impacts.burst(centre.x, 1, centre.z, 0.6);
    }

    readout.update(stats.summary());
  });

  // The warm-up frames spent loading are not the steady state being measured.
  stats.reset();

  return () => {
    engine.stopRenderLoop();
    scene.onBeforeRenderObservable.remove(observer);
    readout.dispose();
    impacts.dispose();
    shadows?.dispose();
    shadowLight?.dispose();
    for (const mesh of propMeshes) {
      mesh.dispose();
    }
    propMaterial.dispose();
    for (const walker of walkers) {
      walker.character.dispose();
    }
    camera.dispose();
    scene.dispose();
    disposeEngine();
  };
}
