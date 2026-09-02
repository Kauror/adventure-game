import type { EnemyState, Region, WorldPoint } from '@adventure/game-core';
import {
  ENEMY,
  advanceEnemy,
  createEnemy,
  damageEnemy,
  elevationAtWorld,
  healthFraction,
  respawnEnemy,
  windUpProgress,
} from '@adventure/game-core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/discBuilder';
import '@babylonjs/core/Meshes/Builders/planeBuilder';

const BODY_HEIGHT_METRES = 1.5;
const BODY_WIDTH_METRES = 0.9;

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
export function createEnemyActor(scene: Scene, region: Region, spawn: WorldPoint): Enemy {
  let state = createEnemy(spawn);
  let flashSeconds = 0;

  const body = MeshBuilder.CreateBox(
    'enemy',
    { width: BODY_WIDTH_METRES, depth: BODY_WIDTH_METRES, height: BODY_HEIGHT_METRES },
    scene,
  );
  const bodyMaterial = flatMaterial(scene, 'enemy-material', IDLE_COLOUR);
  body.material = bodyMaterial;

  // A brow on the front so its facing — and therefore the direction it has
  // committed to swinging — is visible.
  const brow = MeshBuilder.CreateBox(
    'enemy-facing',
    { width: 0.5, depth: 0.2, height: 0.16 },
    scene,
  );
  brow.material = flatMaterial(scene, 'enemy-facing-material', new Color3(0.15, 0.12, 0.15));
  brow.parent = body;
  brow.position.set(0, BODY_HEIGHT_METRES / 3, BODY_WIDTH_METRES / 2);

  // The danger ring: exactly the reach of the swing, so "get out of the circle"
  // is a rule a child can see rather than one they have to be told.
  const ring = MeshBuilder.CreateDisc(
    'enemy-danger',
    { radius: ENEMY.attackRangeMetres, tessellation: 32 },
    scene,
  );
  const ringMaterial = flatMaterial(scene, 'enemy-danger-material', WINDUP_COLOUR);
  ringMaterial.alpha = 0.25;
  ringMaterial.backFaceCulling = false;
  ring.material = ringMaterial;
  ring.rotation.x = Math.PI / 2;
  ring.isPickable = false;
  ring.setEnabled(false);

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

    let colour = IDLE_COLOUR;
    let scale = new Vector3(1, 1, 1);

    switch (phase) {
      case 'pursue':
        colour = PURSUE_COLOUR;
        break;
      case 'windUp':
        // Rears up as it winds: taller and narrower, and redder.
        colour = Color3.Lerp(PURSUE_COLOUR, WINDUP_COLOUR, progress);
        scale = new Vector3(1 - progress * 0.15, 1 + progress * 0.35, 1 - progress * 0.15);
        break;
      case 'strike':
        // Slams down: short and wide. Unmistakable against the rear-up.
        colour = STRIKE_COLOUR;
        scale = new Vector3(1.3, 0.7, 1.3);
        break;
      case 'recover':
        // Slumped and dull — visibly the moment to hit back.
        colour = RECOVER_COLOUR;
        scale = new Vector3(1.05, 0.75, 1.05);
        break;
      case 'dead':
        colour = DEAD_COLOUR;
        scale = new Vector3(1.2, 0.15, 1.2);
        break;
      default:
        break;
    }

    // The flash overrides every phase colour: being hit must always read, even
    // mid-wind-up when the body is already bright red.
    bodyMaterial.diffuseColor = flashSeconds > 0 ? HIT_FLASH_COLOUR : colour;
    body.scaling.copyFrom(scale);
    body.position.set(position.x, ground + (BODY_HEIGHT_METRES * scale.y) / 2, position.z);
    body.rotation.y = state.facing;

    const telegraphing = phase === 'windUp';
    ring.setEnabled(telegraphing);
    if (telegraphing) {
      ring.position.set(position.x, ground + 0.02, position.z);
      ringMaterial.alpha = 0.15 + progress * 0.3;
    }

    const alive = phase !== 'dead';
    barAnchor.setEnabled(alive);
    if (alive) {
      const fraction = healthFraction(state.health);
      barAnchor.position.set(position.x, ground + BODY_HEIGHT_METRES * scale.y + 0.45, position.z);
      barFill.scaling.x = Math.max(0.001, fraction);
      // Scaling shrinks around the centre; nudge it so the bar empties leftward.
      barFill.position.x = -(1 - fraction) * 0.55;
    }
  };

  place();

  return {
    state: () => state,

    update: (deltaSeconds, target) => {
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
      ring.dispose();
      barFill.dispose();
      barBack.dispose();
      barAnchor.dispose();
      brow.dispose();
      body.dispose();
    },
  };
}
