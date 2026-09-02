/**
 * Assist: the per-player generosity setting.
 *
 * PLAN §11 makes this mandatory for the 5–13 age span, and requires it to exist
 * **in Stage 0A, before accounts do**. The reason is Kid Test 0: without assist,
 * a five-year-old who cannot land GREAT produces a false STOP on the most
 * important gate in the project, and we would read "this combat is bad" when the
 * truth is "this combat has no easy mode yet". Kid Test 0 explicitly runs each
 * child once with it on and once off.
 *
 * It is a local toggle for now. It becomes a per-account, admin-set, invisible
 * setting when accounts arrive at Stage 0B — invisible being the point: it must
 * never announce to a child that they are on the easier setting.
 */

const DEFAULT_ASSIST = false;

/** `?assist=1` (or `?assist=0`) overrides the default for a session. */
export function assistFromLocation(search: string = window.location.search): boolean {
  const requested = new URLSearchParams(search).get('assist');

  if (requested === null) {
    return DEFAULT_ASSIST;
  }
  return requested !== '0' && requested !== 'false';
}
