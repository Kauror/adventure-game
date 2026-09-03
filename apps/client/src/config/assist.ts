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
 * It resolves from two places, in this order:
 *
 *  1. **`?assist=1` in the URL** — explicit, and wins. One link can be handed to
 *     either child.
 *  2. **A remembered choice**, so it survives a reload and, more importantly,
 *     works at all from the home-screen install — which has no URL bar to edit.
 *     That install is how the children actually reach the game, so a setting
 *     only reachable through a query string is a setting the parent cannot use
 *     during the test it exists for.
 *
 * It stays invisible in ordinary play. The toggle lives behind the hidden debug
 * gesture, and nothing ever tells a child which setting they are on — being told
 * you are on the easy one is its own kind of unfair.
 *
 * It becomes a per-account, admin-set setting when accounts arrive at Stage 0B.
 */

const DEFAULT_ASSIST = false;
const STORAGE_KEY = 'adventure.assist';

/** `?assist=1` (or `?assist=0`) overrides everything for a session. */
export function assistFromLocation(search: string = window.location.search): boolean | null {
  const requested = new URLSearchParams(search).get('assist');

  if (requested === null) {
    return null;
  }
  return requested !== '0' && requested !== 'false';
}

/**
 * The remembered choice, if there is one.
 *
 * Every access is guarded: storage throws outright in a private window on some
 * browsers, and a diagnostic setting must never be the thing that stops the game
 * booting.
 */
export function assistFromStorage(): boolean | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return null;
    }
    return stored === '1';
  } catch {
    return null;
  }
}

/** Remembers a choice for the next launch. Silently does nothing if it cannot. */
export function rememberAssist(assist: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, assist ? '1' : '0');
  } catch {
    // Private browsing, or storage disabled. The URL parameter still works.
  }
}

/**
 * URL first, then the remembered choice, then off.
 *
 * An explicit URL choice is also *remembered*, so opening `?assist=1` once in
 * Safari settles it for that context rather than lasting a single page load.
 * Note it does not cross into the home-screen install: iOS gives that its own
 * storage, which is exactly why the in-game toggle has to exist.
 */
export function resolveAssist(
  fromUrl: boolean | null = assistFromLocation(),
  fromStorage: boolean | null = assistFromStorage(),
): boolean {
  if (fromUrl !== null) {
    rememberAssist(fromUrl);
    return fromUrl;
  }
  return fromStorage ?? DEFAULT_ASSIST;
}
