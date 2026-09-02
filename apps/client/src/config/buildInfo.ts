/**
 * Which build the phone actually loaded.
 *
 * A bug report from a nine-year-old is "it doesn't work". Without a version
 * marker there is no way to tell whether that phone is running today's deploy
 * or a copy Safari cached last week, and the first hour of every investigation
 * is spent finding out. The published build (0A.11) is therefore stamped with
 * the commit it came from.
 *
 * It is *not* child-facing: it appears in the hidden debug overlay, and is
 * logged once at boot so the in-page console shows it even if the game fails
 * before the overlay mounts — which is exactly the case where it matters most.
 *
 * The values are substituted at build time by `vite.config.ts`; see there for
 * where they come from and what happens when git is unavailable.
 */

declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;

export interface BuildInfo {
  /** Short commit SHA, suffixed `+dirty` when built from an unclean tree. */
  readonly sha: string;
  /** ISO 8601 instant the bundle was produced. */
  readonly builtAt: string;
}

export const BUILD: BuildInfo = {
  sha: __BUILD_SHA__,
  builtAt: __BUILD_TIME__,
};

/**
 * A single line short enough for a phone screen: the SHA, and the build date
 * and time to the minute. Seconds are noise, and the timezone is UTC because
 * the deploy log is the thing it gets compared against.
 */
export function buildLabel(build: BuildInfo = BUILD): string {
  const stamp = build.builtAt.length >= 16 ? build.builtAt.slice(0, 16).replace('T', ' ') : '?';
  return `${build.sha} · ${stamp}Z`;
}
