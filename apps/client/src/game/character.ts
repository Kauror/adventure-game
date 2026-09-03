import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import type { CharacterClip } from './characterClips';
import { registerGltfLoader } from './gltf';
import { CLIP_NAMES, isLooping } from './characterClips';

/**
 * A loaded, animated character.
 *
 * This is the 0A.3 pipeline in one file: GLB in, a rig with named parts, a set
 * of clips the game can ask for by meaning rather than by the asset's spelling,
 * and a socket to hang the hammer on.
 *
 * The rig is a **node hierarchy**, not a skinned mesh — Kenney's blocky
 * characters animate six separate body parts by transform. That is not a
 * compromise on a phone, it is the cheap option: no skinning, no bone matrices,
 * six meshes. It also means the "named hand socket" the roadmap asks for is
 * simply the `arm-right` node, and anything parented to it inherits the swing.
 *
 * Height is measured from the loaded model and scaled to the metre the game
 * uses, rather than hardcoding a factor. That is deliberate: the roadmap's stop
 * condition for this task is *replace the asset if it fights you*, and an asset
 * swap should not also be a hunt for a magic number.
 */

/** The node the hammer hangs from. Named in the asset. */
const SOCKET_NODE = 'arm-right';

/**
 * Rotation applied to the model so its front matches the game's heading of 0,
 * which points north (+Z).
 *
 * Verified rather than derived. glTF is right-handed and Babylon is not, so the
 * loader inserts a `__root__` with a mirrored Z — which makes the handedness
 * argument unreliable on paper and makes the node named `arm-right` appear on
 * the visually opposite side. The measurement that settles it is in
 * `docs/art-pipeline.md`: face the character north, play the melee clip, and
 * check which way the arm actually travels. It reaches +0.43 m forward against
 * a 0.34 m backswing, so this value is right for this asset.
 */
const MODEL_FORWARD_OFFSET = Math.PI;

export interface Character {
  /** Parent this to place the character in the world. */
  readonly root: TransformNode;
  /**
   * Where a held weapon belongs, or `null` if this asset has no such node —
   * in which case the caller falls back to a body-relative position rather
   * than crashing, because a missing socket is a cosmetic problem.
   */
  readonly socket: TransformNode | null;
  /** Plays a clip, doing nothing if it is already the one running. */
  readonly play: (clip: CharacterClip) => void;
  /** The clip currently playing. */
  readonly current: () => CharacterClip | null;
  /** True when a one-shot clip has finished, so the caller can move on. */
  readonly finished: () => boolean;
  /**
   * Washes the whole character in a colour, or clears it with `null`.
   *
   * Keeps the colour language the placeholder boxes established — red for hurt,
   * orange for a charging swing — now that the body is textured and cannot
   * simply have its diffuse swapped. Applied as emissive, so it reads as the
   * character glowing rather than as a different character.
   */
  readonly tint: (colour: Color3 | null) => void;
  /** Hides the body without disturbing its animation, for a damage flicker. */
  readonly setVisible: (visible: boolean) => void;
  /** Multiplies the fitted scale, for squash-and-stretch on top of a clip. */
  readonly setScale: (x: number, y: number, z: number) => void;
  /**
   * The uniform scale the model was fitted by.
   *
   * Anything parented to the socket inherits it, so a prop authored in metres —
   * the hammer — has to divide by this or it arrives shrunk to the asset's own
   * units. Exposed rather than guessed at, because it changes with the asset.
   */
  readonly fittedScale: number;
  /**
   * Where in the socket's own space a held object belongs — the hand.
   *
   * Measured from the socket mesh rather than assumed, because "the socket" is
   * a whole arm: its origin is the shoulder, and a hammer pivoted there sticks
   * up past the character's head. Bottom-centre of the arm is the hand, and
   * that holds for any humanoid rig this is swapped for.
   */
  readonly socketGrip: { readonly x: number; readonly y: number; readonly z: number };
  readonly dispose: () => void;
}

export interface CharacterOptions {
  /** Metres from the floor to the top of the head. */
  readonly heightMetres: number;
}

/**
 * Loads a GLB and returns it ready to animate.
 *
 * Uses an asset container rather than adding straight to the scene, so two
 * characters from the same file never share animation groups — the enemy
 * playing `die` must not stop the player walking.
 */
export async function loadCharacter(
  scene: Scene,
  url: string,
  { heightMetres }: CharacterOptions,
): Promise<Character> {
  // Awaited before the load, so registration is ordered by construction.
  await registerGltfLoader();
  const container = await LoadAssetContainerAsync(url, scene);
  // Clones rather than instances: each character animates its own six body
  // parts, and two characters from the same file must not share transforms.
  const entries = container.instantiateModelsToScene((name) => name, false, {
    doNotInstantiate: true,
  });

  const root = new TransformNode('character', scene);
  // An inner node absorbs the fitting, so `root` can be placed at the feet and
  // rotated by heading without either concern touching the other.
  const fitted = new TransformNode('character-fitted', scene);
  fitted.parent = root;
  for (const node of entries.rootNodes) {
    node.parent = fitted;
  }

  // Measured, not assumed: the asset's own units and origin are its business,
  // and the roadmap expects this asset to be replaced. Fitting it here means an
  // asset swap is a file copy rather than a hunt for a magic scale factor and a
  // magic vertical offset.
  const bounds = fitted.getHierarchyBoundingVectors(true);
  const modelHeight = bounds.max.y - bounds.min.y;
  const scale = modelHeight > 0 ? heightMetres / modelHeight : 1;
  fitted.scaling = new Vector3(scale, scale, scale);
  // Stand it on the floor: `root.position.y` is now ground level, whatever the
  // asset thought its origin was.
  fitted.position.y = -bounds.min.y * scale;

  // Which way the model faces is a property of the asset, not of the game.
  // Verified on the device rather than derived: glTF's handedness conversion
  // makes it genuinely ambiguous on paper, and a character that moonwalks is
  // obvious in one glance and invisible in any amount of reasoning.
  fitted.rotation.y = MODEL_FORWARD_OFFSET;

  const groups = new Map<string, AnimationGroup>();
  for (const group of entries.animationGroups) {
    group.stop();
    groups.set(group.name, group);
  }

  // Searched inside *this* character, never by scene-wide name: both the hero
  // and the foe come from the same rig, so a scene lookup would hand the second
  // character the first one's arm and the hammer would swing on the wrong body.
  const socket =
    root
      .getDescendants(false)
      .find((node): node is TransformNode => node.name === SOCKET_NODE && 'position' in node) ??
    null;

  const meshes = root.getChildMeshes(false);
  const materials = new Map<number, { emissiveColor: Color3 }>();
  for (const mesh of meshes) {
    const material = mesh.material as ({ emissiveColor?: Color3 } & { uniqueId: number }) | null;
    if (material !== null && 'emissiveColor' in material) {
      materials.set(
        material.uniqueId,
        material as { emissiveColor: Color3 } & { uniqueId: number },
      );
    }
  }
  const restingEmissive = new Map<number, Color3>();
  for (const [id, material] of materials) {
    restingEmissive.set(id, material.emissiveColor.clone());
  }

  // Bottom-centre of the arm, nudged up a little so the grip is in the hand
  // rather than at the fingertips.
  const socketGrip = (() => {
    const bounds = (
      socket as {
        getBoundingInfo?: () => { boundingBox: { minimum: Vector3; maximum: Vector3 } };
      } | null
    )?.getBoundingInfo?.().boundingBox;
    if (bounds === undefined) {
      return { x: 0, y: 0, z: 0 };
    }
    const { minimum, maximum } = bounds;
    return {
      x: (minimum.x + maximum.x) / 2,
      y: minimum.y + (maximum.y - minimum.y) * 0.12,
      z: (minimum.z + maximum.z) / 2,
    };
  })();

  let current: CharacterClip | null = null;
  let playing: AnimationGroup | null = null;
  let done = false;

  const play = (clip: CharacterClip): void => {
    if (clip === current) {
      return;
    }
    const next = groups.get(CLIP_NAMES[clip]);
    if (next === undefined) {
      // A missing clip must never take the game down: the character simply
      // keeps its last pose, which is wrong but playable. The asset test is
      // what stops this reaching a phone.
      return;
    }

    playing?.stop();
    done = false;
    const looping = isLooping(clip);
    next.reset();
    next.start(looping, 1);
    if (!looping) {
      // One-shots hold their final frame instead of snapping back, so a swing
      // ends on the follow-through and death stays down.
      next.onAnimationGroupEndObservable.addOnce(() => {
        done = true;
      });
    }

    playing = next;
    current = clip;
  };

  return {
    root,
    socket,
    play,
    current: () => current,
    finished: () => done,

    tint: (colour) => {
      for (const [id, material] of materials) {
        const resting = restingEmissive.get(id);
        material.emissiveColor = colour ?? resting ?? material.emissiveColor;
      }
    },

    setVisible: (visible) => {
      for (const mesh of meshes) {
        mesh.isVisible = visible;
      }
    },

    setScale: (x, y, z) => {
      fitted.scaling.set(scale * x, scale * y, scale * z);
    },

    fittedScale: scale,
    socketGrip,
    dispose: () => {
      playing?.stop();
      for (const group of groups.values()) {
        group.dispose();
      }
      root.dispose(false, true);
      container.dispose();
    },
  };
}
