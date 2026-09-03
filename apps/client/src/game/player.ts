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
  timingBands,
  HAMMER,
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
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

import type { Character } from './character';
import { clipFor } from './characterClips';
import { createHammer } from './hammer';

/**
 * How tall the player stands.
 *
 * 1.30 m because that is the height the character was actually authored at —
 * it is a child, and the asset says so. Fitting it to an adult 1.8 m stretched
 * a drawing of a kid into a grown-up, which is both wrong and the sort of thing
 * that goes unnoticed because everything still renders.
 *
 * The fit is therefore a no-op for this model and stays only as the safety net
 * that lets a differently-scaled asset drop in without hunting for a factor.
 */
export const PLAYER_HEIGHT_METRES = 1.3;
const BODY_HEIGHT_METRES = PLAYER_HEIGHT_METRES;

/**
 * State colours, now washed over a textured character rather than painted onto
 * a box.
 *
 * The language is the one the placeholder established and the playtest did not
 * complain about: blue means the dodge is protecting you, orange means a swing
 * is winding up, red means damage. Applied as emissive, so the character glows
 * rather than turning into a different character.
 */
const DODGE_COLOUR = new Color3(0.25, 0.55, 0.8);
const CHARGE_COLOUR = new Color3(0.7, 0.28, 0.05);
const HURT_COLOUR = new Color3(0.75, 0.1, 0.14);

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

/** How long the recoil from a hit lasts, inside the mercy window. */
const STAGGER_SECONDS = 0.22;

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

/** The bare minimum the always-on HUD reads. */
export interface PlayerVitals {
  readonly health: Health;
  readonly defeated: boolean;
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
  /**
   * Just the numbers the HUD needs, every frame it asks.
   *
   * Separate from `snapshot()` because the health pips must update during
   * ordinary play, while the full snapshot — tile lookups, elevation, walkable
   * — is only worth computing when the debug overlay is open. Before this
   * existed the HUD shared the debug poll, so a child's health bar silently
   * never changed unless a developer had the readout showing.
   */
  readonly vitals: () => PlayerVitals;
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
 * The box is gone: this drives a real rigged model loaded at 0A.3, animated
 * from the same state the rules already track. Neither movement nor dodging is
 * improvised here — both go through game-core, so the rules the server will
 * eventually enforce are the rules the client already obeys, and the animation
 * layer only ever *reports* that state rather than deciding anything.
 */
export function createPlayer(
  scene: Scene,
  region: Region,
  start: WorldPoint,
  assist: boolean,
  character: Character,
): Player {
  const body = character.root;

  // The hammer hangs from the rig's named hand socket, so it inherits the swing
  // of the attack animation rather than having to be animated in parallel with
  // it. Its scale compensation undoes the fitting applied to the model: the
  // weapon is authored in metres and the arm is in the asset's own units.
  const socket = character.socket;
  const hammer =
    socket === null
      ? // No socket in this asset: fall back to the body, which looks wrong but
        // plays. A missing socket is cosmetic, not fatal.
        createHammer(scene, body, timingBands(assist), BODY_HEIGHT_METRES)
      : createHammer(scene, socket, timingBands(assist), BODY_HEIGHT_METRES, {
          scaleCompensation: 1 / character.fittedScale,
          // The socket is the whole arm; the grip is its hand end.
          offset: character.socketGrip,
        });

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
  /**
   * Seconds of the frame being drawn, so `place()` can pose the hammer.
   *
   * Kept here rather than threaded through every early return: `place()` is
   * called from six places and the hammer must be posed on all of them, or the
   * swing freezes whenever the player is standing still.
   */
  let frameSeconds = 0;
  /** Whether the player moved under their own steering this frame. */
  let moving = false;

  const defeated = (): boolean => defeatedSeconds > 0;
  const isProtected = (): boolean => isInvulnerable(dodge) || mercySeconds > 0 || defeated();

  const place = (): void => {
    const elevation = elevationAtWorld(region, position.x, position.z);
    // The model stands on its own feet: the loader normalised its origin, so
    // this is ground level rather than a body-centre guess.
    body.position.set(position.x, elevation, position.z);
    body.rotation.y = facing;
    hammer.update(attack, frameSeconds);

    // The rig animates the state; colour and squash now only *emphasise* it.
    // That is the whole point of 0A.3 — before it, a change of colour was the
    // only thing a state could say.
    character.animate(frameSeconds);
    character.play(
      clipFor({
        defeated: defeated(),
        swinging: attack.phase === 'recovering',
        charging: isPastTapThreshold(attack),
        moving,
      }),
    );

    const evading = isInvulnerable(dodge);
    const charge = chargeProgress(attack);

    character.setVisible(true);

    if (defeated()) {
      // Down. The `die` clip holds its last frame, so the body stays on the
      // floor — a stand-in for the downed/revive system that arrives with
      // multiplayer at Stage 1, since there is nobody here to revive you.
      character.tint(HURT_COLOUR);
      character.setScale(1, 1, 1);
      return;
    }

    if (mercySeconds > 0) {
      // Flicker, the way every game has said "you are hit and briefly safe"
      // for forty years. It survives any texture, which a colour swap does not.
      const blink = Math.floor(mercySeconds * 12) % 2 === 0;
      character.setVisible(!blink);
      character.tint(HURT_COLOUR);

      // A stagger over the first moments of the mercy window. The playtester
      // could not tell they were losing health; a body that visibly reels is
      // the channel that does not require looking at the HUD at all.
      const staggerLeft = Math.max(0, mercySeconds - (MERCY_SECONDS - STAGGER_SECONDS));
      const stagger = staggerLeft / STAGGER_SECONDS;
      character.setScale(1 + stagger * 0.25, 1 - stagger * 0.22, 1 + stagger * 0.25);
      return;
    }

    if (evading) {
      character.tint(DODGE_COLOUR);
      character.setScale(1.1, 0.85, 1.1);
      return;
    }

    if (isPastTapThreshold(attack)) {
      // The wind-up already shows in the held-weapon pose and on the hammer
      // head; this adds heat to it as the charge fills.
      character.tint(CHARGE_COLOUR.scale(charge));
      character.setScale(1, 1, 1);
      return;
    }

    if (gradeFlashSeconds > 0 && lastSwing !== null) {
      // Impact reads on more than one channel, which the roadmap requires: the
      // swing animation carries the motion, this carries the force.
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
      character.tint(CHARGE_COLOUR.scale(fade * punch));
      character.setScale(1 + punch * fade * 0.4, 1, 1 + punch * fade * 0.4);
      return;
    }

    character.tint(null);
    character.setScale(1, 1, 1);
  };

  place();

  return {
    update: (deltaSeconds, input) => {
      const { direction, dodgeRequested, attackHeld } = input;

      frameSeconds = deltaSeconds;
      moving = false;
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

      moving = true;
      const speed =
        MOVEMENT.maxSpeedMetresPerSecond *
        (isPastTapThreshold(attack) ? HAMMER.chargingSpeedFactor : 1);
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

      // Not a frame boundary: posing the hammer again here would advance its
      // settle twice in one frame.
      frameSeconds = 0;

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

    vitals: () => ({ health, defeated: defeated() }),

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
      hammer.dispose();
      character.dispose();
    },
  };
}
