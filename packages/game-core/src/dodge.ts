import type { MoveDirection } from './movement';

/**
 * Dodge: a short, fast, committed burst that gets the player out of an incoming
 * attack.
 *
 * This is a **combat** mechanic, not a movement one — see
 * docs/decisions/0007-dodge-vs-dash.md. It lives in game-core because PLAN §4
 * lists dodge among the things the server decides: the client says "I pressed
 * dodge", the server owns whether the cooldown allowed it.
 */
export const DODGE = {
  /** How far a dodge travels, in metres — roughly two tiles. */
  distanceMetres: 3,
  /** How long the burst lasts. Short enough to feel committed, not floaty. */
  durationSeconds: 0.22,
  /**
   * Invulnerability window, measured from the start of the dodge.
   *
   * Deliberately most of the burst rather than a tight frame near its centre:
   * PLAN §11 requires anticipation over reaction, and a five-year-old who
   * presses dodge as the wind-up plays should be rewarded. Mastery later comes
   * from spacing and cooldown management, never from a narrower window.
   */
  invulnerableSeconds: 0.18,
  /** Time after the burst before another dodge is allowed. */
  cooldownSeconds: 0.8,
} as const;

export type DodgePhase = 'ready' | 'dodging' | 'cooldown';

export interface DodgeState {
  readonly phase: DodgePhase;
  /** Seconds spent in the current phase. */
  readonly elapsedSeconds: number;
  /** Unit direction of the active burst; zero while not dodging. */
  readonly direction: MoveDirection;
}

const IDLE: DodgeState = {
  phase: 'ready',
  elapsedSeconds: 0,
  direction: { x: 0, y: 0 },
};

export function createDodgeState(): DodgeState {
  return IDLE;
}

export function canDodge(state: DodgeState): boolean {
  return state.phase === 'ready';
}

export function isDodging(state: DodgeState): boolean {
  return state.phase === 'dodging';
}

/** Invulnerable for the opening window of the burst. Nothing reads this until damage exists (0A.8). */
export function isInvulnerable(state: DodgeState): boolean {
  return state.phase === 'dodging' && state.elapsedSeconds < DODGE.invulnerableSeconds;
}

/** Constant speed of the burst, in metres per second. */
export function dodgeSpeed(): number {
  return DODGE.distanceMetres / DODGE.durationSeconds;
}

/**
 * Begins a dodge if one is allowed. Returns the state unchanged when it is not,
 * so callers do not have to check first.
 *
 * A zero direction is rejected rather than guessed at: the caller knows whether
 * an idle dodge should step backwards or forwards, and silently picking one here
 * would hide that decision.
 */
export function startDodge(state: DodgeState, direction: MoveDirection): DodgeState {
  if (!canDodge(state)) {
    return state;
  }

  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude === 0) {
    return state;
  }

  return {
    phase: 'dodging',
    elapsedSeconds: 0,
    direction: { x: direction.x / magnitude, y: direction.y / magnitude },
  };
}

/**
 * Advances the dodge clock.
 *
 * Overshoot is carried into the next phase rather than discarded, so a long
 * frame cannot stretch a dodge or its cooldown. Phases are resolved in a loop
 * because one very long frame can span a whole burst *and* its cooldown.
 */
export function advanceDodge(state: DodgeState, deltaSeconds: number): DodgeState {
  if (deltaSeconds <= 0 || state.phase === 'ready') {
    return state;
  }

  let phase = state.phase;
  let elapsed = state.elapsedSeconds + deltaSeconds;
  let direction = state.direction;

  for (;;) {
    if (phase === 'dodging' && elapsed >= DODGE.durationSeconds) {
      elapsed -= DODGE.durationSeconds;
      phase = 'cooldown';
      direction = IDLE.direction;
      continue;
    }
    if (phase === 'cooldown' && elapsed >= DODGE.cooldownSeconds) {
      return IDLE;
    }
    break;
  }

  return { phase, elapsedSeconds: elapsed, direction };
}
