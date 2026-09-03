import type { EnemyState, Region, WorldPoint } from '@adventure/game-core';
import {
  ENEMY,
  advanceEnemy,
  createEnemy,
  damageEnemy,
  elevationAtWorld,
  healthFraction,
  recoverProgress,
  respawnEnemy,
  windUpProgress,
} from '@adventure/game-core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/discBuilder';
import '@babylonjs/core/Meshes/Builders/planeBuilder';

import type { Character } from './character';
import { enemyClipFor } from './characterClips';

/** Shorter than the player, so the two read apart at a glance. */
export const ENEMY_HEIGHT_METRES = 1.5;
const BODY_HEIGHT_METRES = ENEMY_HEIGHT_METRES;

/**
 * Phase colours.
 *
 * Colour alone is never the signal — the body's *silhouette* changes with every
 * phase too. PLAN §11 requires telegraphs to be shape-coded as well as
 * colour-coded, so a colourblind child reads the same fight.
 */
const IDLE_COLOUR = new Color3(0.45, 0.4, 0.52);
const PURSUE_COLOUR = new Color3(0.62, 0.44, 0.44);
const WINDUP_COLOUR = new Color3(1, 0.32, 0.22);
const STRIKE_COLOUR = new Color3(1, 0.92, 0.8);
const RECOVER_COLOUR = new Color3(0.32, 0.3, 0.36);
/** The counterattack window. Cool and inviting — never confusable with danger. */
const OPENING_COLOUR = new Color3(0.35, 1, 0.75);
const DEAD_COLOUR = new Color3(0.18, 0.16, 0.2);
/** Flashed the instant a blow lands, so a hit is never ambiguous. */
const HIT_FLASH_COLOUR = new Color3(1, 1, 1);
const HIT_FLASH_SECONDS = 0.09;

export interface Enemy {
  readonly state: () => EnemyState;
  readonly update: (deltaSeconds: number, target: WorldPoint) => { strikeLanded: boolean };
  readonly damage: (amount: number) => void;
  /** Top of the body, in metres — where an impact effect should appear. */
  readonly impactHeight: () => number;
  readonly dispose: () => void;
}

/**
 * A flat ground wedge spanning `halfAngle` either side of local +Z.
 *
 * Built by hand rather than with a disc, because the shape has to be *exactly*
 * the arc the enemy actually swings through. The first playtest read the old
 * full circle as "everything in here will be hit", which left the player with
 * no idea whether to back away, step aside or dodge through — and it was not
 * even true: the swing is frontal and its facing locks at the wind-up, so
 * sidestepping beats it. The telegraph now says that.
 */
function buildAttackWedge(
  scene: Scene,
  name: string,
  radius: number,
  halfAngle: number,
  segments = 24,
): Mesh {
  const mesh = new Mesh(name, scene);
  const positions: number[] = [0, 0, 0];
  const normals: number[] = [0, 1, 0];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const angle = -halfAngle + (i / segments) * halfAngle * 2;
    positions.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    normals.push(0, 1, 0);
    if (i < segments) {
      indices.push(0, i + 1, i + 2);
    }
  }

  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.indices = indices;
  data.applyToMesh(mesh);
  return mesh;
}

function flatMaterial(scene: Scene, name: string, colour: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = colour;
  material.specularColor = Color3.Black();
  return material;
}

/**
 * The enemy, as the child sees it.
 *
 * All the behaviour lives in game-core; this only draws it. Three channels carry
 * the telegraph, because a wind-up a five-year-old cannot read is the same as no
 * wind-up at all: the body **rears up** (silhouette), it turns **red**
 * (colour), and a **ring appears on the ground** showing exactly how far the
 * swing reaches (position). Stepping outside that ring is the whole lesson.
 */
export function createEnemyActor(
  scene: Scene,
  region: Region,
  spawn: WorldPoint,
  character: Character,
): Enemy {
  let state = createEnemy(spawn);
  let flashSeconds = 0;
  /** Seconds of the frame being drawn, so `place()` can advance animation. */
  let frameSeconds = 0;

  // The second visual variant on the shared rig (roadmap 0A.3): identical
  // skeleton, identical clips, a different texture. Which is also why the enemy
  // needs no separate art pipeline of its own.
  const body = character.root;

  // The danger wedge: the actual arc the swing covers, pointing where the enemy
  // has committed to swinging. Stepping out of the side of it is the lesson.
  const wedge = buildAttackWedge(
    scene,
    'enemy-danger',
    ENEMY.attackRangeMetres,
    ENEMY.attackHalfAngleRadians,
  );
  const wedgeMaterial = flatMaterial(scene, 'enemy-danger-material', WINDUP_COLOUR);
  wedgeMaterial.alpha = 0.25;
  wedgeMaterial.backFaceCulling = false;
  wedge.material = wedgeMaterial;
  wedge.isPickable = false;
  wedge.setEnabled(false);

  // The counterattack window, drawn as a disc that closes as the moment passes.
  // Green, because it is the one ground marker that means "come here".
  const opening = MeshBuilder.CreateDisc(
    'enemy-opening',
    { radius: 1.35, tessellation: 28 },
    scene,
  );
  const openingMaterial = flatMaterial(scene, 'enemy-opening-material', OPENING_COLOUR);
  openingMaterial.alpha = 0.3;
  openingMaterial.backFaceCulling = false;
  opening.material = openingMaterial;
  opening.rotation.x = Math.PI / 2;
  opening.isPickable = false;
  opening.setEnabled(false);

  // Health bar, billboarded so it always faces the fixed camera.
  const barAnchor = new TransformNode('enemy-health', scene);
  const barBack = MeshBuilder.CreatePlane('enemy-health-back', { width: 1.1, height: 0.16 }, scene);
  barBack.material = flatMaterial(scene, 'enemy-health-back-material', new Color3(0.1, 0.1, 0.12));
  barBack.parent = barAnchor;
  barBack.billboardMode = Mesh.BILLBOARDMODE_ALL;

  const barFill = MeshBuilder.CreatePlane('enemy-health-fill', { width: 1.1, height: 0.16 }, scene);
  barFill.material = flatMaterial(
    scene,
    'enemy-health-fill-material',
    new Color3(0.85, 0.35, 0.35),
  );
  barFill.parent = barAnchor;
  barFill.billboardMode = Mesh.BILLBOARDMODE_ALL;
  barFill.position.z = -0.01;

  const place = (): void => {
    const { position, phase } = state;
    const ground = elevationAtWorld(region, position.x, position.z);
    const progress = windUpProgress(state);
    const progressOfRecovery = recoverProgress(state);

    let colour = IDLE_COLOUR;
    let scale = new Vector3(1, 1, 1);

    switch (phase) {
      case 'pursue':
        colour = PURSUE_COLOUR;
        break;
      case 'windUp':
        // Rears up as it winds: taller and narrower, and redder.
        colour = Color3.Lerp(PURSUE_COLOUR, WINDUP_COLOUR, progress);
        scale = new Vector3(1 - progress * 0.06, 1 + progress * 0.16, 1 - progress * 0.06);
        break;
      case 'strike':
        // Slams down: short and wide. Unmistakable against the rear-up.
        colour = STRIKE_COLOUR;
        scale = new Vector3(1.15, 0.9, 1.15);
        break;
      case 'recover':
        // Properly slumped, not merely dull. At 1.05/0.75 the difference from
        // an idle enemy was too small to notice mid-fight, which is why the
        // playtester never spotted the opening.
        colour = RECOVER_COLOUR;
        scale = new Vector3(1.1, 0.72, 1.1);
        break;
      case 'dead':
        colour = DEAD_COLOUR;
        scale = new Vector3(1, 1, 1);
        break;
      default:
        break;
    }

    // The rig carries the phase now — it raises its weapon to wind up and swings
    // to strike — and colour only reinforces it. The flash overrides every phase
    // colour, because being hit must read even mid-wind-up when the body is
    // already glowing red.
    character.animate(frameSeconds);
    character.play(enemyClipFor(phase));
    character.tint(flashSeconds > 0 ? HIT_FLASH_COLOUR : colour);
    character.setScale(scale.x, scale.y, scale.z);
    // The model stands on its own feet: the loader normalised its origin.
    body.position.set(position.x, ground, position.z);
    body.rotation.y = state.facing;
    // Reeling while helpless. A slumped body is easy to miss; one that wobbles
    // is not, and it costs nothing.
    body.rotation.z =
      phase === 'recover'
        ? Math.sin(state.elapsedSeconds * 13) * 0.16 * (1 - progressOfRecovery)
        : 0;

    const telegraphing = phase === 'windUp';
    wedge.setEnabled(telegraphing);
    if (telegraphing) {
      wedge.position.set(position.x, ground + 0.02, position.z);
      // Same locked facing as the body, so the wedge and the character always
      // agree about where the blow is going.
      wedge.rotation.y = state.facing;
      wedgeMaterial.alpha = 0.18 + progress * 0.35;
    }

    // The counterattack window: a green disc that shrinks as it closes, so
    // "now" is visible without any text and its ending is visible too.
    const open = phase === 'recover';
    opening.setEnabled(open);
    if (open) {
      const remaining = 1 - recoverProgress(state);
      opening.position.set(position.x, ground + 0.02, position.z);
      opening.scaling.set(remaining, remaining, 1);
      openingMaterial.alpha = 0.15 + remaining * 0.35;
    }

    const alive = phase !== 'dead';
    barAnchor.setEnabled(alive);
    if (alive) {
      const fraction = healthFraction(state.health);
      barAnchor.position.set(position.x, ground + BODY_HEIGHT_METRES * scale.y + 0.35, position.z);
      barFill.scaling.x = Math.max(0.001, fraction);
      // Scaling shrinks around the centre; nudge it so the bar empties leftward.
      barFill.position.x = -(1 - fraction) * 0.55;
    }
  };

  place();

  return {
    state: () => state,

    update: (deltaSeconds, target) => {
      frameSeconds = deltaSeconds;
      flashSeconds = Math.max(0, flashSeconds - deltaSeconds);
      const update = advanceEnemy(state, region, target, deltaSeconds);
      state = update.readyToRespawn ? respawnEnemy(update.state) : update.state;
      place();
      return { strikeLanded: update.strikeLanded };
    },

    damage: (amount) => {
      state = damageEnemy(state, amount);
      flashSeconds = HIT_FLASH_SECONDS;
      place();
    },

    impactHeight: () => elevationAtWorld(region, state.position.x, state.position.z) + 1,

    dispose: () => {
      opening.dispose();
      wedge.dispose();
      barFill.dispose();
      barBack.dispose();
      barAnchor.dispose();
      character.dispose();
    },
  };
}
