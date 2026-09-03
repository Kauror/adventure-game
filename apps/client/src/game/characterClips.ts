/**
 * The animation clips this game asks a character for, and their names in the
 * asset.
 *
 * Kept as data, and separate from any Babylon code, for one reason: the roadmap
 * (0A.3) has a stop condition — *if the chosen asset is awkward enough that every
 * future animation needs manual repair, replace the asset now* — and swapping an
 * asset is only cheap if the coupling to it is one table. Everything else in the
 * game asks for `walk`, not for `"walk"` in whatever spelling this pack happened
 * to use.
 *
 * `tests/characterAsset.test.ts` reads the shipped GLB files and fails if any
 * clip named here is missing from them, so a swapped asset breaks the build
 * rather than silently animating nothing.
 */

/** What the game needs a character to be able to do. */
export type CharacterClip = 'idle' | 'walk' | 'attack' | 'carry' | 'defeated';

/**
 * Clip names as they appear in Kenney's Blocky Characters.
 *
 * `carry` is the pose held while simply standing with the hammer, and `attack`
 * is the right-handed melee swing — right, because that is the arm the hammer is
 * socketed to.
 */
export const CLIP_NAMES: Readonly<Record<CharacterClip, string>> = {
  idle: 'idle',
  walk: 'walk',
  attack: 'attack-melee-right',
  carry: 'holding-right',
  defeated: 'die',
};

/** Clips that play once and hold their last frame rather than repeating. */
export const ONE_SHOT_CLIPS: ReadonlySet<CharacterClip> = new Set<CharacterClip>([
  'attack',
  'defeated',
]);

export function isLooping(clip: CharacterClip): boolean {
  return !ONE_SHOT_CLIPS.has(clip);
}

/**
 * The clip for a player in a given state, in priority order.
 *
 * Pure, so the decision can be tested without a scene — which matters here
 * because the automation pane cannot reliably run a frame loop, and "the
 * character stands still while walking" is exactly the kind of bug that only
 * shows up in motion.
 */
export interface CharacterMotion {
  readonly defeated: boolean;
  readonly swinging: boolean;
  readonly charging: boolean;
  readonly moving: boolean;
}

export function clipFor(motion: CharacterMotion): CharacterClip {
  if (motion.defeated) {
    return 'defeated';
  }
  if (motion.swinging) {
    return 'attack';
  }
  // Charging holds the weapon up rather than idling: the wind-up has to be
  // visible on the body, not only on the hammer.
  if (motion.charging) {
    return 'carry';
  }
  return motion.moving ? 'walk' : 'idle';
}

/**
 * The clip an enemy shows for each phase of its attack cycle.
 *
 * The phases were already shape-coded by squashing a box; a rig says the same
 * things properly. `carry` raises the weapon for the wind-up — which is the
 * telegraph the whole fight is built around — and the recovery deliberately
 * drops back to `idle`, because the cue that matters there is the closing green
 * disc on the ground and a second animation would only compete with it.
 */
export function enemyClipFor(phase: string): CharacterClip {
  switch (phase) {
    case 'dead':
      return 'defeated';
    case 'strike':
      return 'attack';
    case 'windUp':
      return 'carry';
    case 'pursue':
      return 'walk';
    default:
      return 'idle';
  }
}
