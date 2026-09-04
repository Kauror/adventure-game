import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Bloom, glow and shadows — the three things the mockup had and the game did not.
 *
 * Worth being precise about why all three are needed, because they look like one
 * effect and are not:
 *
 *  - **Glow** makes a surface that is *emissive* bleed light past its own edges.
 *    It is what turns the gold rim and the rune inlay from painted-on brightness
 *    into something that appears to be lit from within, and it only ever touches
 *    materials that declare themselves emissive — which the arena has seven of.
 *  - **Bloom** takes whatever is bright *on screen*, wherever it came from, and
 *    spreads a halo around it. That is what the brazier flames need: they are
 *    additive sprites, not emissive materials, so glow ignores them entirely.
 *  - **Shadows** are the only one of the three that says anything about *space*.
 *    A character with no shadow floats; the shadow is how a player knows where
 *    they are standing, which matters more in a fight than either of the others.
 *
 * All three are off with `?fx=0`, because they are the first things to cut if
 * the phone cannot afford them and that has to be answerable without a deploy.
 */

/** `?fx=0` turns post-processing off. */
export function effectsEnabled(search: string): boolean {
  return new URLSearchParams(search).get('fx') !== '0';
}

/**
 * `?shadows=1` turns shadows on. They are **off by default because they do not
 * work**, and that is worth writing down rather than quietly deleting.
 *
 * The shadow map renders: reading it back shows real depth values, so the 73
 * casters are being drawn into it. The receiving side never samples it — no
 * surface darkens, at any bias, with the light anywhere, with the map at any
 * darkness.
 *
 * Ruled out, each by testing rather than by reasoning: the light's position
 * (moved over the arena, since the point lights had exactly that bug), bias and
 * normalBias (both zeroed), PCF versus exponential maps (both, and the
 * exponential one is how the map was confirmed non-empty), frozen materials
 * (unfrozen), stale shaders (`markAllMaterialsAsDirty` with every flag),
 * `receiveShadows` (set on all 85), `scene.shadowsEnabled`, and the four-light
 * limit on `StandardMaterial` (raised to eight).
 *
 * Left wired and off rather than removed: a broken shadow map still costs about
 * half a millisecond a frame re-rendering static scenery, and a child's phone
 * should not pay that for nothing — but the next person to look at this should
 * not start from zero either.
 */
export function shadowsRequested(search: string): boolean {
  return new URLSearchParams(search).get('shadows') === '1';
}

/**
 * Shadow map resolution.
 *
 * 1024 is a compromise chosen for a phone: 2048 is visibly crisper on a desktop
 * and costs four times the memory and fill for a shadow that is, at this camera
 * distance, a soft blob under a character either way.
 */
const SHADOW_MAP_SIZE = 1024;

/** Anything shallower than this is a floor, and floors do not cast. */
const FLAT_METRES = 0.3;

export interface ArenaEffects {
  /** Adds a mesh to the shadow map. Safe to call with anything, including nothing. */
  readonly castShadows: (meshes: readonly AbstractMesh[]) => void;
  readonly dispose: () => void;
}

export function createArenaEffects(
  scene: Scene,
  camera: Camera,
  shadowLight: DirectionalLight | null,
  search: string,
): ArenaEffects {
  if (!effectsEnabled(search)) {
    return { castShadows: () => undefined, dispose: () => undefined };
  }

  /*
   * Bloom only. The pipeline can do image processing too, and must not here:
   * `StandardMaterial` already applies the scene's tone mapping and exposure in
   * its own shader, so letting the pipeline apply them as well would tone-map a
   * tone-mapped image and wash the arena out.
   */
  const pipeline = new DefaultRenderingPipeline('arena-fx', false, scene, [camera]);
  pipeline.imageProcessingEnabled = false;
  pipeline.fxaaEnabled = false;
  pipeline.bloomEnabled = true;
  // Only genuinely bright things bloom: flames, the gold rim, the rune core.
  // Lower and the whole floor starts to glow, which reads as fog on a lens
  // rather than as light.
  pipeline.bloomThreshold = 0.62;
  pipeline.bloomWeight = 0.45;
  pipeline.bloomKernel = 48;
  // Half resolution. Bloom is a blur; nobody has ever noticed one being soft.
  pipeline.bloomScale = 0.5;

  const glow = new GlowLayer('arena-glow', scene, {
    mainTextureFixedSize: 256,
    blurKernelSize: 32,
  });
  glow.intensity = 0.7;

  let shadows: ShadowGenerator | null = null;
  if (shadowLight !== null && shadowsRequested(search)) {
    shadows = new ShadowGenerator(SHADOW_MAP_SIZE, shadowLight);
    // Soft, and cheap. A hard shadow edge under a blocky character at this
    // camera angle looks like a bug rather than like sunlight.
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
    shadows.bias = 0.01;
    shadows.normalBias = 0.02;
    // The arena is 24 m across and the light is far outside it; letting Babylon
    // fit the range to what actually casts keeps the depth precision usable.
    shadowLight.autoCalcShadowZBounds = true;
  }

  return {
    castShadows: (meshes) => {
      const map = shadows?.getShadowMap();
      for (const mesh of meshes) {
        if (mesh.getTotalVertices() === 0) {
          continue;
        }

        // Everything receives. The floor is the whole point of having shadows.
        mesh.receiveShadows = true;

        if (map?.renderList == null) {
          continue;
        }

        /*
         * Only things with height cast.
         *
         * The shadow map is a second render of every caster, every frame, and
         * measuring it made the trade obvious: 85 casters cost 1.45 ms a frame
         * against 0.88 ms with the map frozen — and most of those 85 were the
         * floor, the rim step, the puddles and the rune inlay, which are flat
         * and cast nothing anyone could see. The pillars, walls, braziers and
         * the characters are the shadows worth paying for.
         */
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        if (box.maximumWorld.y - box.minimumWorld.y >= FLAT_METRES) {
          map.renderList.push(mesh);
        }
      }
    },
    dispose: () => {
      shadows?.dispose();
      glow.dispose();
      pipeline.dispose();
    },
  };
}
