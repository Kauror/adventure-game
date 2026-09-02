import type {
  AttackState,
  AttackSwing,
  DodgeState,
  Health,
  MoveDirection,
  Region,
  TileCoord,
  WorldPoint,
} from '@adventure/game-core';
import {
  MOVEMENT,
  advanceAttack,
  applyDamage,
  createHealth,
  isDead,
  advanceDodge,
  beginCharge,
  canAttack,
  cancelCharge,
  chargeProgress,
  createAttackState,
  isPastTapThreshold,
  createDodgeState,
  dodgeSpeed,
  elevationAtWorld,
  isCharging,
  isDodging,
  isInvulnerable,
  isWalkableWorld,
  releaseCharge,
  startDodge,
  stepMovement,
  worldToTile,
} from '@adventure/game-core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Meshes/Builders/boxBuilder';

/** Placeholder proportions until the real rig arrives at 0A.3. */
const BODY_HEIGHT_METRES = 1.8;
const BODY_WIDTH_METRES = 0.6;

const BODY_COLOUR = new Color3(0.95, 0.85, 0.55);
/** Bright and unmistakable while the dodge's invulnerability window is open. */
const DODGE_COLOUR = new Color3(0.55, 0.9, 1);
/** Deepens as the hammer charges, so the wind-up reads on the character too. */
const CHARGE_COLOUR = new Color3(0.98, 0.5, 0.2);
/** Flashed when hit, and held while defeated. */
const HURT_COLOUR = new Color3(0.9, 0.25, 0.3);

/**
 * How much slower the player moves while winding up the hammer.
 *
 * A charge that costs nothing is strictly better than not charging, which
 * removes the decision entirely. Slowing the wind-up makes committing to a big
 * swing a real choice, and makes the hammer feel heavy. Tunable in the 0A.9 feel
 * pass — flagged there because it was a judgement call, not a requirement.
 */
const CHARGING_SPEED_FACTOR = 0.45;

/** How long the grade of the last swing stays visible, in seconds. */
const GRADE_FLASH_SECONDS = 0.45;

/** Hits the player can take. Small numbers a child can count and watch. */
const MAX_HEALTH = 5;

/**
 * Brief invulnerability after being hit.
 *
 * Without it, standing inside an enemy drains the whole bar in a moment and the
 * child never learns what hit them. Mercy frames make damage legible.
 */
const MERCY_SECONDS = 0.8;

/** How long the player lies defeated before getting back up. */
const DEFEAT_SECONDS = 1.5;

export interface PlayerSnapshot {
  readonly world: WorldPoint;
  readonly tile: TileCoord;
  readonly elevation: number;
  readonly walkable: boolean;
  readonly dodge: DodgeState;
  readonly invulnerable: boolean;
  readonly attack: AttackState;
  /** 0..1 for the charge meter. */
  readonly chargeProgress: number;
  /** True only once a press has been held long enough to be a charge, not a tap. */
  readonly charging: boolean;
  /** The most recent swing, or null once the flash has faded. */
  readonly lastSwing: AttackSwing | null;
  readonly health: Health;
  /** True while down and waiting to get back up. */
  readonly defeated: boolean;
  /** True while a hit would be ignored — dodging, mercy frames, or defeated. */
  readonly protected: boolean;
}

export interface PlayerInput {
  readonly direction: MoveDirection;
  readonly dodgeRequested: boolean;
  readonly attackHeld: boolean;
  /**
   * Input was interrupted rather than released — the window lost focus with
   * keys down. Abandons a wind-up instead of swinging it.
   */
  readonly interrupted: boolean;
}

export interface PlayerFrame {
  /** The swing produced this frame, if any — the moment a hit is resolved. */
  readonly swing: AttackSwing | null;
  /**
   * True only on the frame a dodge actually begins.
   *
   * Reported here rather than inferred from the dodge clock outside: a
   * "clock is nearly zero" test fires on two consecutive frames, which is how
   * the dodge sound came to play twice.
   */
  readonly dodgeStarted: boolean;
}

export interface Player {
  readonly update: (deltaSeconds: number, input: PlayerInput) => PlayerFrame;
  readonly snapshot: () => PlayerSnapshot;
  readonly position: () => WorldPoint;
  readonly facing: () => number;
  /** Chest height in world metres — where an impact effect belongs. */
  readonly impactHeight: () => number;
  /** Applies damage unless the player is currently protected. Returns whether it landed. */
  readonly takeDamage: (amount: number) => boolean;
  readonly followTarget: () => { x: number; y: number; z: number };
  readonly dispose: () => void;
}

/**
 * The player character.
 *
 * A blank box with a nose, deliberately: the real rigged character is task
 * 0A.3, and this only has to be tall enough to judge scale and pointed enough
 * to show which way movement is heading. Neither movement nor dodging is
 * improvised here — both go through game-core, so the rules the server will
 * eventually enforce are the rules the client already obeys.
 */
export function createPlayer(
  scene: Scene,
  region: Region,
  start: WorldPoint,
  assist: boolean,
): Player {
  const body = MeshBuilder.CreateBox(
    'player',
    { width: BODY_WIDTH_METRES, depth: BODY_WIDTH_METRES, height: BODY_HEIGHT_METRES },
    scene,
  );
  const bodyMaterial = new StandardMaterial('player-material', scene);
  bodyMaterial.diffuseColor = BODY_COLOUR;
  bodyMaterial.specularColor = Color3.Black();
  body.material = bodyMaterial;

  // A small marker on the front face so facing is visible on a featureless box.
  const nose = MeshBuilder.CreateBox(
    'player-facing',
    { width: 0.22, depth: 0.28, height: 0.22 },
    scene,
  );
  const noseMaterial = new StandardMaterial('player-facing-material', scene);
  noseMaterial.diffuseColor = new Color3(0.25, 0.2, 0.15);
  noseMaterial.specularColor = Color3.Black();
  nose.material = noseMaterial;
  nose.parent = body;
  nose.position.set(0, BODY_HEIGHT_METRES / 4, BODY_WIDTH_METRES / 2);

  let position: WorldPoint = start;
  let facing = 0;
  let dodge: DodgeState = createDodgeState();
  let attack: AttackState = createAttackState();
  let attackHeldLastFrame = false;
  let lastSwing: AttackSwing | null = null;
  let gradeFlashSeconds = 0;
  let health: Health = createHealth(MAX_HEALTH);
  let mercySeconds = 0;
  let defeatedSeconds = 0;

  const defeated = (): boolean => defeatedSeconds > 0;
  const isProtected = (): boolean => isInvulnerable(dodge) || mercySeconds > 0 || defeated();

  const place = (): void => {
    const elevation = elevationAtWorld(region, position.x, position.z);
    body.position.set(position.x, elevation + BODY_HEIGHT_METRES / 2, position.z);
    body.rotation.y = facing;

    // Placeholder art cannot animate, so state reads through colour and shape
    // instead. Real animation replaces all of this at 0A.3/0A.9.
    const evading = isInvulnerable(dodge);
    const charge = chargeProgress(attack);

    if (defeated()) {
      // Flat on the floor. A stand-in for the downed/revive system that arrives
      // with multiplayer at Stage 1 — there is nobody here to revive you.
      bodyMaterial.diffuseColor = HURT_COLOUR;
      body.scaling.set(1.2, 0.2, 1.2);
      return;
    }

    if (mercySeconds > 0) {
      // Blink, so being hit is unmistakable and the free moment is visible.
      const blink = Math.floor(mercySeconds * 12) % 2 === 0;
      bodyMaterial.diffuseColor = blink ? HURT_COLOUR : BODY_COLOUR;
      body.scaling.set(1, 1, 1);
      return;
    }

    if (evading) {
      bodyMaterial.diffuseColor = DODGE_COLOUR;
      body.scaling.set(1.25, 0.7, 1.25);
      return;
    }

    if (isPastTapThreshold(attack)) {
      // Winds up visibly: colour deepens and the body compresses as the meter
      // fills, so the swing is telegraphed on the character and not only in the
      // HUD. A tap is too brief to show anything, which is correct.
      bodyMaterial.diffuseColor = Color3.Lerp(BODY_COLOUR, CHARGE_COLOUR, charge);
      body.scaling.set(1 + charge * 0.18, 1 - charge * 0.16, 1 + charge * 0.18);
      return;
    }

    if (gradeFlashSeconds > 0 && lastSwing !== null) {
      // Impact reads through size as well as colour, so swings differ on more
      // than one channel (the roadmap forbids relying on text alone). A heavy
      // PERFECT lands hardest; a combo finisher is the light path's payoff.
      const punch =
        lastSwing.kind === 'heavy'
          ? lastSwing.grade === 'perfect'
            ? 0.5
            : lastSwing.grade === 'great'
              ? 0.28
              : 0.14
          : lastSwing.comboCount >= 3
            ? 0.24
            : 0.1;
      const fade = gradeFlashSeconds / GRADE_FLASH_SECONDS;
      bodyMaterial.diffuseColor = Color3.Lerp(BODY_COLOUR, CHARGE_COLOUR, fade * punch);
      body.scaling.set(1 + punch * fade, 1 - punch * fade * 0.5, 1 + punch * fade);
      return;
    }

    bodyMaterial.diffuseColor = BODY_COLOUR;
    body.scaling.set(1, 1, 1);
  };

  place();

  return {
    update: (deltaSeconds, input) => {
      const { direction, dodgeRequested, attackHeld } = input;

      mercySeconds = Math.max(0, mercySeconds - deltaSeconds);

      if (defeated()) {
        // Down and out: no input is accepted until the player gets back up.
        defeatedSeconds = Math.max(0, defeatedSeconds - deltaSeconds);
        if (defeatedSeconds === 0) {
          position = start;
          health = createHealth(MAX_HEALTH);
          dodge = createDodgeState();
          attack = createAttackState();
          mercySeconds = MERCY_SECONDS;
          // Forget the pre-death button state, so a child who never let go of
          // attack gets a fresh charge rather than a button that does nothing
          // until they release and press again.
          attackHeldLastFrame = false;
        }
        place();
        return { swing: null, dodgeStarted: false };
      }

      let swungThisFrame: AttackSwing | null = null;
      let dodgeStarted = false;

      dodge = advanceDodge(dodge, deltaSeconds);
      attack = advanceAttack(attack, deltaSeconds);
      gradeFlashSeconds = Math.max(0, gradeFlashSeconds - deltaSeconds);
      if (gradeFlashSeconds === 0) {
        lastSwing = null;
      }

      if (input.interrupted) {
        // Focus was taken away with keys down. Abandon the wind-up rather than
        // swinging it, and forget the edge so nothing fires on the way back.
        attack = cancelCharge(attack);
        attackHeldLastFrame = false;
        place();
        return { swing: null, dodgeStarted: false };
      }

      // Hold to charge, let go to swing. Both transitions matter, so the edges
      // are detected here where the attack state actually lives.
      if (attackHeld && !attackHeldLastFrame && canAttack(attack)) {
        attack = beginCharge(attack);
      } else if (!attackHeld && attackHeldLastFrame && isCharging(attack)) {
        const released = releaseCharge(attack, assist);
        attack = released.state;
        if (released.swing !== null) {
          lastSwing = released.swing;
          swungThisFrame = released.swing;
          gradeFlashSeconds = GRADE_FLASH_SECONDS;
        }
      }
      attackHeldLastFrame = attackHeld;

      if (dodgeRequested) {
        // Dodge in the direction being held; standing still, step backwards —
        // away from whatever is being faced, which is what "get out of the way"
        // means when an attack is coming at you.
        const burst =
          direction.x === 0 && direction.y === 0
            ? { x: -Math.sin(facing), y: -Math.cos(facing) }
            : direction;
        const started = startDodge(dodge, burst);

        // Dodging out of a wind-up abandons it. That is what gives the dodge a
        // defensive role: escaping costs you the swing you were charging.
        if (isDodging(started) && !isDodging(dodge)) {
          attack = cancelCharge(attack);
          dodgeStarted = true;
        }
        dodge = started;
      }

      if (isDodging(dodge)) {
        // A dodge is committed: it ignores steering, but never passes a wall.
        position = stepMovement(region, position, dodge.direction, deltaSeconds, dodgeSpeed());
        place();
        return { swing: swungThisFrame, dodgeStarted };
      }

      if (direction.x === 0 && direction.y === 0) {
        place();
        return { swing: swungThisFrame, dodgeStarted };
      }

      const speed =
        MOVEMENT.maxSpeedMetresPerSecond * (isPastTapThreshold(attack) ? CHARGING_SPEED_FACTOR : 1);
      position = stepMovement(region, position, direction, deltaSeconds, speed);
      // Face the way the input points, not the way movement resolved: sliding
      // along a wall should not spin the character into the wall.
      facing = Math.atan2(direction.x, direction.y);
      place();
      return { swing: swungThisFrame, dodgeStarted };
    },

    position: () => position,
    facing: () => facing,
    impactHeight: () =>
      elevationAtWorld(region, position.x, position.z) + BODY_HEIGHT_METRES * 0.65,

    takeDamage: (amount) => {
      if (isProtected()) {
        return false;
      }

      health = applyDamage(health, amount);
      mercySeconds = MERCY_SECONDS;

      if (isDead(health)) {
        defeatedSeconds = DEFEAT_SECONDS;
        dodge = createDodgeState();
        attack = createAttackState();
      }

      place();
      return true;
    },

    snapshot: () => ({
      world: position,
      tile: worldToTile(region, position.x, position.z),
      elevation: elevationAtWorld(region, position.x, position.z),
      walkable: isWalkableWorld(region, position.x, position.z),
      dodge,
      invulnerable: isInvulnerable(dodge),
      attack,
      chargeProgress: chargeProgress(attack),
      charging: isPastTapThreshold(attack),
      lastSwing,
      health,
      defeated: defeated(),
      protected: isProtected(),
    }),

    followTarget: () => ({
      x: position.x,
      y: elevationAtWorld(region, position.x, position.z),
      z: position.z,
    }),

    dispose: () => {
      nose.dispose();
      body.dispose();
      bodyMaterial.dispose();
      noseMaterial.dispose();
    },
  };
}
