import type { TimingBands } from '@adventure/game-core';

/**
 * Which lamp the charge is currently on, and how far through it.
 *
 * The charge meter used to be a track carrying two overlapping bands, a fill
 * and a travelling head — five things stacked on top of each other, which on a
 * phone read as "too many blocks". This replaces them with three lamps, because
 * the three timing grades are already a traffic light and every child on earth
 * knows what one means before they can read:
 *
 *     red → not yet · amber → nearly · green → **now**
 *
 * That is honest, not a metaphor stretched to fit: green *is* the PERFECT band,
 * amber *is* the rest of GREAT, and red is everything outside them — including
 * an overcharge, where the lights run back down through amber to red. Releasing
 * on red still lands the hit, because every release lands (PLAN §11); red means
 * "you get the ordinary one", never "you failed".
 *
 * Kept pure and separate from the drawing so it can be tested without a DOM,
 * which is the only kind of test this project can run on the UI.
 */

export type ChargeLamp = 'red' | 'amber' | 'green';

export interface ChargeZone {
  readonly lamp: ChargeLamp;
  /**
   * 0..1 through the current lamp's stretch of time.
   *
   * The drawing uses it to warm the *next* lamp up as this one runs out, which
   * is what keeps the mechanic anticipatory rather than a reaction test: amber
   * only lasts a moment, so it cannot be the only warning that green is coming.
   */
  readonly progress: number;
}

/** Safe against zero-width stretches, which assist can produce at the edges. */
function fraction(value: number, from: number, to: number): number {
  if (to <= from) {
    return 1;
  }
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/**
 * Maps seconds of charge onto a lamp.
 *
 * Both halves of GREAT are amber and both outsides are red, so the sequence a
 * player sees while holding too long is red, amber, green, amber, red — the
 * moment passing, which is exactly what overcharging is.
 */
export function chargeZone(heldSeconds: number, bands: TimingBands): ChargeZone {
  const { perfect, great } = bands;

  if (heldSeconds < great.startSeconds) {
    return { lamp: 'red', progress: fraction(heldSeconds, 0, great.startSeconds) };
  }

  if (heldSeconds < perfect.startSeconds) {
    return {
      lamp: 'amber',
      progress: fraction(heldSeconds, great.startSeconds, perfect.startSeconds),
    };
  }

  if (heldSeconds <= perfect.endSeconds) {
    return {
      lamp: 'green',
      progress: fraction(heldSeconds, perfect.startSeconds, perfect.endSeconds),
    };
  }

  if (heldSeconds <= great.endSeconds) {
    return { lamp: 'amber', progress: fraction(heldSeconds, perfect.endSeconds, great.endSeconds) };
  }

  // Overcharged. Red again, and it stays red however long the button is held.
  return { lamp: 'red', progress: 1 };
}
