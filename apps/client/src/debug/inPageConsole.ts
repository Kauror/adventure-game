/**
 * An in-page developer console.
 *
 * **Not optional on this project.** iOS Safari's Web Inspector requires macOS,
 * and the development machine is Windows — so without this there is no console,
 * no stack trace and no network panel on the iPhone the children actually play
 * on. It is the difference between "the phone shows a black screen" being a
 * five-minute fix and a lost evening.
 *
 * Loaded **lazily**, so the ~100 kB never reaches a child who is just playing:
 * the chunk is only fetched the first time someone opens the debug tools. That
 * matters most on the published build (0A.11), which is exactly where a phone
 * console is worth having.
 */

let loading: Promise<void> | null = null;
let visible = false;

async function load(): Promise<void> {
  const eruda = (await import('eruda')).default;
  eruda.init();
  // It starts up open; the caller decides whether to show it.
  eruda.hide();
}

/** Loads the console on first use, then toggles it. Safe to call repeatedly. */
export async function toggleInPageConsole(): Promise<boolean> {
  loading ??= load().catch((error: unknown) => {
    // A missing console must never take the game down with it.
    console.warn('in-page console unavailable', error);
    loading = null;
    throw error;
  });

  try {
    await loading;
  } catch {
    return false;
  }

  const eruda = (await import('eruda')).default;
  visible = !visible;
  if (visible) {
    eruda.show();
  } else {
    eruda.hide();
  }
  return visible;
}
