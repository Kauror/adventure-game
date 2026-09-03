/**
 * The hammer's attack: tap for a quick combo, hold for a heavy swing.
 *
 * One button, two modes, because that is what makes the weapon interesting
 * without adding a second control to a screen that only has two thumbs:
 *
 * - **Tap** — a fast light hit that chains. Tap again in rhythm and the chain
 *   continues to a stronger finisher. Cheap, safe, quick to recover from.
 * - **Hold** — a charged heavy swing. Releasing on the sweet spot is where the
 *   real power is, and holding too long loses it again.
 *
 * So speed comes from tapping and strength comes from committing, and the
 * player chooses which risk to take. The same split is meant to carry to other
 * weapon families later: a bow taps for a quick shot and holds for a drawn one.
 *
 * It lives in game-core because the server has to know these numbers. PLAN §4
 * makes the timing grade a bounded client claim: the client says "that was a
 * PERFECT", and the server clamps the resulting power to the table below.
 *
 * Only the hammer exists so far, so this is hammer-shaped on purpose. A second
 * weapon family is what will show which parts are actually general (CLAUDE.md:
 * do not generalise before two or three concrete cases).
 */

export const HAMMER = {
  /**
   * Release before this and it is a tap, not a charge.
   *
   * Short enough that a deliberate hold is never mistaken for a tap, long enough
   * that a child's press — which is not crisp — is not mistaken for a charge.
   */
  tapThresholdSeconds: 0.22,

  /** Damage of a plain hit, before the grade or combo multiplier. */
  baseDamage: 2,

  /** How far the hammer reaches, and how wide its swing is. */
  reachMetres: 2.2,
  swingHalfAngleRadians: 1.05,

  /**
   * Recovery after a light hit.
   *
   * Lengthened from 0.18 s after the first adult playtest: three taps resolved
   * so fast they blurred into one indistinct motion and the tester could not
   * tell whether tapping had done anything. A hammer that recovers instantly is
   * also not a hammer. Still short enough to chain comfortably.
   */
  lightRecoverySeconds: 0.28,

  /** How long after a light hit the next tap still continues the chain. */
  comboWindowSeconds: 0.7,

  /** Hits in a full chain; the last is the finisher. */
  comboLength: 3,

  /**
   * Time for the charge meter to fill completely.
   *
   * Raised from 0.85 s after the first adult playtest: an adult could not tell
   * the character was charging at all, let alone aim for a band inside it.
   * PLAN §11 sets ~1.2 s as the shape of the mechanic, and the roadmap allows
   * lengthening for readability but never shortening. At 1.5 s the wind-up is
   * long enough to *watch*, which is the entire point of an anticipation
   * mechanic.
   */
  chargeSeconds: 1.5,

  /**
   * Where the sweet spot sits, as a fraction of the charge. Placed so there is
   * room to release too early *and* to overcharge — a window you can only miss
   * in one direction is half a mechanic.
   */
  perfectCentreFraction: 0.62,

  /** Width of the PERFECT band. Never narrower than 250 ms, for anyone (PLAN §11). */
  perfectWidthSeconds: 0.34,
  /** Width of the GREAT band, which contains PERFECT. */
  greatWidthSeconds: 0.7,

  /** Recovery after a heavy swing. Longer than a light hit: commitment has a cost. */
  heavyRecoverySeconds: 0.4,

  /**
   * Charge time that must remain past the end of the GREAT band.
   *
   * Guarantees overcharging is always a real mistake — including with assist on.
   * Without it, a widened GREAT band reaches the end of the meter and "just hold
   * the button forever" becomes the best strategy, which would remove the
   * mechanic for precisely the child assist exists to help.
   */
  minOverchargeSeconds: 0.18,

  /**
   * How much wider assist makes the mastery bands.
   *
   * Assist widens PERFECT and GREAT; it never touches the success floor, because
   * every release already lands (PLAN §11). A five-year-old lands more GREATs, an
   * eleven-year-old is unaffected, and neither is told which is which.
   */
  assistWidthMultiplier: 1.6,

  /**
   * How fast the player moves while charging, as a fraction of normal speed.
   *
   * A charge that costs nothing is strictly better than not charging, which
   * removes the decision. But the first playtest ran at 0.45 and committing
   * felt like being stuck, so it sits at 0.65: deliberate, never rooted. It is
   * a game rule rather than presentation because the server will eventually
   * check displacement against it.
   */
  chargingSpeedFactor: 0.65,
} as const;

/** Every release attacks. The grade only changes how hard. */
export type AttackGrade = 'good' | 'great' | 'perfect';

/** Tap or charge. */
export type AttackKind = 'light' | 'heavy';

export type AttackPhase = 'idle' | 'charging' | 'recovering';

export interface AttackState {
  readonly phase: AttackPhase;
  /** Seconds spent in the current phase. While charging, this is the charge time. */
  readonly elapsedSeconds: number;
  /** Light hits landed in the current chain, 0 when there is no chain. */
  readonly comboCount: number;
  /** Time since the last light hit, used to expire the chain. */
  readonly sinceLightHitSeconds: number;
  /**
   * How long the current recovery lasts. Stored because it depends on what was
   * swung — a tap recovers quickly, a heavy swing does not.
   */
  readonly recoverySeconds: number;
}

export interface TimingBand {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface TimingBands {
  readonly perfect: TimingBand;
  readonly great: TimingBand;
}

/** What a release produced. */
export interface AttackSwing {
  readonly kind: AttackKind;
  /** Heavy swings are graded on release timing; light hits are always `good`. */
  readonly grade: AttackGrade;
  /** Position in the chain for a light hit (1-based); 0 for a heavy swing. */
  readonly comboCount: number;
  /** Damage multiplier for this swing. */
  readonly power: number;
}

const IDLE: AttackState = {
  phase: 'idle',
  elapsedSeconds: 0,
  comboCount: 0,
  sinceLightHitSeconds: 0,
  recoverySeconds: 0,
};

/**
 * Damage multiplier per heavy grade.
 *
 * This is the "fixed defined range" PLAN §4 requires: the server will clamp a
 * client's claimed grade to this table, so a tampered client can pick a value
 * from it but never invent one.
 *
 * The spread widened after the first playtest, where a charged hit "felt
 * similar to an ordinary attack". A well-timed heavy now hits about four times
 * as hard as a tap, which is what makes committing to the charge worth the
 * exposure.
 */
export function gradeBonus(grade: AttackGrade): number {
  switch (grade) {
    case 'perfect':
      return 2;
    case 'great':
      return 1.45;
    default:
      return 1;
  }
}

/**
 * Damage multiplier for a light hit at a given position in the chain.
 *
 * Individually weaker than any heavy swing: taps buy speed and safety, not
 * power. The finisher is the reward for keeping the rhythm going.
 */
export function comboPower(comboCount: number): number {
  return comboCount >= HAMMER.comboLength ? 1 : 0.55;
}

function band(centre: number, width: number): TimingBand {
  const half = width / 2;
  const latestEnd = HAMMER.chargeSeconds - HAMMER.minOverchargeSeconds;

  return {
    startSeconds: Math.max(0, centre - half),
    endSeconds: Math.min(latestEnd, centre + half),
  };
}

/**
 * Where the mastery bands sit, in seconds of charge.
 *
 * The UI needs these to *draw* the sweet spot. An invisible timing window would
 * make this a reaction test, which is exactly what PLAN §11 forbids.
 */
export function timingBands(assist: boolean): TimingBands {
  const centre = HAMMER.chargeSeconds * HAMMER.perfectCentreFraction;
  const scale = assist ? HAMMER.assistWidthMultiplier : 1;

  return {
    perfect: band(centre, HAMMER.perfectWidthSeconds * scale),
    great: band(centre, HAMMER.greatWidthSeconds * scale),
  };
}

function within(value: number, range: TimingBand): boolean {
  return value >= range.startSeconds && value <= range.endSeconds;
}

/** Grades a heavy release. Anything outside the mastery bands is still a hit. */
export function gradeFor(chargeSeconds: number, assist: boolean): AttackGrade {
  const bands = timingBands(assist);

  if (within(chargeSeconds, bands.perfect)) {
    return 'perfect';
  }
  if (within(chargeSeconds, bands.great)) {
    return 'great';
  }
  return 'good';
}

export function createAttackState(): AttackState {
  return IDLE;
}

export function isCharging(state: AttackState): boolean {
  return state.phase === 'charging';
}

export function canAttack(state: AttackState): boolean {
  return state.phase === 'idle';
}

/**
 * Whether the press has been held long enough to count as a charge.
 * Used by the UI so a tap does not flash the charge meter.
 */
export function isPastTapThreshold(state: AttackState): boolean {
  return state.phase === 'charging' && state.elapsedSeconds >= HAMMER.tapThresholdSeconds;
}

/**
 * 0..1 through the recovery after a swing.
 *
 * Drives the follow-through of the swing animation. Without it the hammer would
 * teleport back to rest, and the arc — the thing that makes a tap legible as a
 * hammer blow rather than a flicker — would never be seen.
 */
export function recoveryProgress(state: AttackState): number {
  if (state.phase !== 'recovering' || state.recoverySeconds <= 0) {
    return 0;
  }
  return Math.min(1, state.elapsedSeconds / state.recoverySeconds);
}

/** 0..1 for the charge meter. Zero when not charging. */
export function chargeProgress(state: AttackState): number {
  if (state.phase !== 'charging') {
    return 0;
  }
  return Math.min(1, state.elapsedSeconds / HAMMER.chargeSeconds);
}

export function beginCharge(state: AttackState): AttackState {
  if (!canAttack(state)) {
    return state;
  }
  return { ...state, phase: 'charging', elapsedSeconds: 0 };
}

/**
 * Ages the combo chain and expires it once the rhythm is broken.
 *
 * The clock deliberately stops while the button is held: a player who has
 * already pressed has committed to the next hit, and letting the chain lapse
 * mid-press would punish them for holding a fraction too long. Without this the
 * real slack between taps shrinks to the window minus recovery minus hold time,
 * which is far too tight for a small child.
 */
function ageCombo(state: AttackState, deltaSeconds: number): AttackState {
  if (state.comboCount === 0 || state.phase === 'charging') {
    return state;
  }

  const since = state.sinceLightHitSeconds + deltaSeconds;
  if (since > HAMMER.comboWindowSeconds) {
    return { ...state, comboCount: 0, sinceLightHitSeconds: 0 };
  }
  return { ...state, sinceLightHitSeconds: since };
}

/**
 * Advances the attack clock.
 *
 * The charge is capped rather than auto-firing: holding forever is allowed, and
 * simply means the meter sits past the sweet spot having missed it. That teaches
 * "release at the right moment" far better than the game swinging on its own.
 */
export function advanceAttack(state: AttackState, deltaSeconds: number): AttackState {
  if (deltaSeconds <= 0) {
    return state;
  }

  const aged = ageCombo(state, deltaSeconds);
  const elapsed = aged.elapsedSeconds + deltaSeconds;

  if (aged.phase === 'charging') {
    return { ...aged, elapsedSeconds: Math.min(elapsed, HAMMER.chargeSeconds) };
  }

  if (aged.phase === 'recovering') {
    return elapsed >= aged.recoverySeconds
      ? { ...aged, phase: 'idle', elapsedSeconds: 0, recoverySeconds: 0 }
      : { ...aged, elapsedSeconds: elapsed };
  }

  return aged;
}

export interface AttackRelease {
  readonly state: AttackState;
  /** Null when there was nothing to release. */
  readonly swing: AttackSwing | null;
}

export function releaseCharge(state: AttackState, assist: boolean): AttackRelease {
  if (state.phase !== 'charging') {
    return { state, swing: null };
  }

  // A quick press is a light hit that continues the chain.
  if (state.elapsedSeconds < HAMMER.tapThresholdSeconds) {
    const comboCount = (state.comboCount % HAMMER.comboLength) + 1;

    return {
      state: {
        phase: 'recovering',
        elapsedSeconds: 0,
        comboCount,
        sinceLightHitSeconds: 0,
        recoverySeconds: HAMMER.lightRecoverySeconds,
      },
      swing: { kind: 'light', grade: 'good', comboCount, power: comboPower(comboCount) },
    };
  }

  // A held press is a heavy swing, graded on when it was let go.
  const grade = gradeFor(state.elapsedSeconds, assist);

  return {
    state: {
      phase: 'recovering',
      elapsedSeconds: 0,
      comboCount: 0,
      sinceLightHitSeconds: 0,
      recoverySeconds: HAMMER.heavyRecoverySeconds,
    },
    swing: { kind: 'heavy', grade, comboCount: 0, power: gradeBonus(grade) },
  };
}

/** Abandons a charge without swinging — used when a dodge interrupts it. */
export function cancelCharge(state: AttackState): AttackState {
  return state.phase === 'charging' ? { ...state, phase: 'idle', elapsedSeconds: 0 } : state;
}
