import {
  applyDamage,
  createHealth,
  distanceBetween,
  headingTo,
  isDead,
  isWithinMeleeArc,
  type Health,
} from './combat';
import { stepMovement } from './movement';
import type { Region, WorldPoint } from './region/types';

/**
 * One enemy, and deliberately only one kind of it.
 *
 * The whole point of this enemy is to make the combat loop the roadmap asks for
 * emerge on its own:
 *
 *     read the wind-up -> dodge -> counterattack -> time the hammer
 *
 * So it is a plain state machine, not AI. It walks at the player, commits to a
 * slow and obvious swing, and is helpless for a moment afterwards. Everything
 * hard about it is in the *timings*, which is where a child's skill goes.
 *
 * Three properties keep it fair, and are asserted as tests rather than left to
 * good intentions (PLAN §11: no unavoidable damage):
 *
 *  - it is **slower than the player**, so walking away always works;
 *  - its wind-up is **far longer than a dodge**, so there is always time to react;
 *  - it **locks its facing when the wind-up starts**, so stepping aside beats it.
 */
export const ENEMY = {
  maxHealth: 10,

  /** Slower than the player's 4.5 m/s: retreating is always an option. */
  speedMetresPerSecond: 2.6,

  /** How close the player must come before it notices. */
  aggroRangeMetres: 8,
  /** How close it must be to start a swing. */
  attackRangeMetres: 1.7,
  /** Half-width of its swing arc — roughly 55 degrees each side. */
  attackHalfAngleRadians: 0.96,

  /**
   * The telegraph. Long and obvious on purpose: PLAN §11 requires anticipation
   * rather than reaction, and a five-year-old needs to *see it coming*, not
   * flinch at it.
   */
  windUpSeconds: 0.9,
  /** The dangerous moment itself. */
  strikeSeconds: 0.15,
  /**
   * Helpless afterwards. Long enough to land a full hammer charge or a whole
   * three-tap combo — the counterattack is the reward for dodging well.
   *
   * Raised from 1 s alongside the slower hammer: the charge now takes 1.5 s and
   * a three-tap combo 1.5 s, so a 1 s window would have quietly made the
   * counterattack impossible to complete — the invariant tests below catch
   * exactly that. It also answers the playtest directly, since a window nobody
   * can finish an attack inside is one nobody can learn to use.
   */
  recoverSeconds: 1.5,

  damage: 1,

  /**
   * How long the body lies there before a fresh one appears, so the fight can
   * be had again. There is deliberately no separate "corpse lingers, then
   * vanishes" phase: nothing needs one, and a second constant that looked like
   * it controlled the pause but did not was worse than no constant at all.
   */
  respawnSeconds: 3,
} as const;

export type EnemyPhase = 'idle' | 'pursue' | 'windUp' | 'strike' | 'recover' | 'dead';

export interface EnemyState {
  readonly phase: EnemyPhase;
  /** Seconds spent in the current phase. */
  readonly elapsedSeconds: number;
  readonly position: WorldPoint;
  /** Heading, locked for the duration of a swing. */
  readonly facing: number;
  readonly health: Health;
  /** Where it returns when it respawns. */
  readonly spawn: WorldPoint;
}

export interface EnemyUpdate {
  readonly state: EnemyState;
  /**
   * True on the single frame its swing connects — close enough and in the arc.
   * Whether that actually costs the player health is the caller's decision,
   * because only the caller knows about dodge invulnerability.
   */
  readonly strikeLanded: boolean;
  /** True on the frame it finishes dying, so the caller can respawn it. */
  readonly readyToRespawn: boolean;
}

export function createEnemy(spawn: WorldPoint): EnemyState {
  return {
    phase: 'idle',
    elapsedSeconds: 0,
    position: spawn,
    facing: 0,
    health: createHealth(ENEMY.maxHealth),
    spawn,
  };
}

export function isEnemyDead(state: EnemyState): boolean {
  return state.phase === 'dead';
}

/** True while the wind-up is showing — the window in which a dodge should happen. */
export function isTelegraphing(state: EnemyState): boolean {
  return state.phase === 'windUp';
}

/** 0..1 through the current wind-up, for drawing the telegraph. */
export function windUpProgress(state: EnemyState): number {
  if (state.phase !== 'windUp') {
    return 0;
  }
  return Math.min(1, state.elapsedSeconds / ENEMY.windUpSeconds);
}

/** True while the enemy is helpless after a committed swing — the counter window. */
export function isRecovering(state: EnemyState): boolean {
  return state.phase === 'recover';
}

/**
 * 0..1 through the recovery, for drawing the counterattack window.
 *
 * The first playtest could not tell when hitting back was safe. The state
 * existed and the body slumped, but nothing said "now" — so the client draws
 * this as a closing window rather than leaving the player to guess.
 */
export function recoverProgress(state: EnemyState): number {
  if (state.phase !== 'recover') {
    return 0;
  }
  return Math.min(1, state.elapsedSeconds / ENEMY.recoverSeconds);
}

/** Applies damage, and starts dying if that was enough. */
export function damageEnemy(state: EnemyState, amount: number): EnemyState {
  if (state.phase === 'dead') {
    return state;
  }

  const health = applyDamage(state.health, amount);
  if (isDead(health)) {
    return { ...state, phase: 'dead', elapsedSeconds: 0, health };
  }

  // Being hit does not interrupt a committed swing. A player who trades blows
  // instead of dodging should not be rewarded for it.
  return { ...state, health };
}

export function respawnEnemy(state: EnemyState): EnemyState {
  return createEnemy(state.spawn);
}

/**
 * Advances the enemy one frame.
 *
 * Pure: it takes the world and the player's position and returns the next state,
 * so the same code can run on the server later without changes.
 */
export function advanceEnemy(
  state: EnemyState,
  region: Region,
  target: WorldPoint,
  deltaSeconds: number,
): EnemyUpdate {
  if (deltaSeconds <= 0) {
    return { state, strikeLanded: false, readyToRespawn: false };
  }

  const elapsed = state.elapsedSeconds + deltaSeconds;
  const distance = distanceBetween(state.position, target);

  switch (state.phase) {
    case 'dead':
      return {
        state: { ...state, elapsedSeconds: elapsed },
        strikeLanded: false,
        readyToRespawn:
          state.elapsedSeconds < ENEMY.respawnSeconds && elapsed >= ENEMY.respawnSeconds,
      };

    case 'idle': {
      if (distance <= ENEMY.aggroRangeMetres) {
        return {
          state: { ...state, phase: 'pursue', elapsedSeconds: 0 },
          strikeLanded: false,
          readyToRespawn: false,
        };
      }
      return {
        state: { ...state, elapsedSeconds: elapsed },
        strikeLanded: false,
        readyToRespawn: false,
      };
    }

    case 'pursue': {
      if (distance <= ENEMY.attackRangeMetres) {
        // Facing is locked here, for the whole swing. This is what makes
        // sidestepping a committed attack work.
        return {
          state: {
            ...state,
            phase: 'windUp',
            elapsedSeconds: 0,
            facing: headingTo(state.position, target),
          },
          strikeLanded: false,
          readyToRespawn: false,
        };
      }

      if (distance > ENEMY.aggroRangeMetres) {
        return {
          state: { ...state, phase: 'idle', elapsedSeconds: 0 },
          strikeLanded: false,
          readyToRespawn: false,
        };
      }

      const facing = headingTo(state.position, target);
      const direction = { x: Math.sin(facing), y: Math.cos(facing) };
      const position = stepMovement(
        region,
        state.position,
        direction,
        deltaSeconds,
        ENEMY.speedMetresPerSecond,
      );

      return {
        state: { ...state, elapsedSeconds: elapsed, position, facing },
        strikeLanded: false,
        readyToRespawn: false,
      };
    }

    case 'windUp': {
      if (elapsed < ENEMY.windUpSeconds) {
        return {
          state: { ...state, elapsedSeconds: elapsed },
          strikeLanded: false,
          readyToRespawn: false,
        };
      }

      // The swing resolves the instant it becomes a strike, against the locked
      // facing — so where the player stands *now* is what decides it.
      const landed = isWithinMeleeArc(
        state.position,
        state.facing,
        target,
        ENEMY.attackRangeMetres,
        ENEMY.attackHalfAngleRadians,
      );

      return {
        state: { ...state, phase: 'strike', elapsedSeconds: 0 },
        strikeLanded: landed,
        readyToRespawn: false,
      };
    }

    case 'strike': {
      if (elapsed < ENEMY.strikeSeconds) {
        return {
          state: { ...state, elapsedSeconds: elapsed },
          strikeLanded: false,
          readyToRespawn: false,
        };
      }
      return {
        state: { ...state, phase: 'recover', elapsedSeconds: 0 },
        strikeLanded: false,
        readyToRespawn: false,
      };
    }

    case 'recover': {
      if (elapsed < ENEMY.recoverSeconds) {
        return {
          state: { ...state, elapsedSeconds: elapsed },
          strikeLanded: false,
          readyToRespawn: false,
        };
      }
      return {
        state: {
          ...state,
          phase: distance <= ENEMY.aggroRangeMetres ? 'pursue' : 'idle',
          elapsedSeconds: 0,
        },
        strikeLanded: false,
        readyToRespawn: false,
      };
    }
  }
}
