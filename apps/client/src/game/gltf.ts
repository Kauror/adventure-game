/**
 * Registers Babylon's glTF loader, once, before anything tries to load a model.
 *
 * It lives in its own module because it is shared and because getting it wrong
 * is invisible until it isn't. It was originally a private detail of the
 * character loader, awaited there — and then the props began loading in the
 * same `Promise.all` as the characters, raced the registration, and the whole
 * boot failed with *"No plugin or fallback for pillar_stump.glb"*. Anything that
 * loads a model must await this, so it belongs somewhere both callers can see.
 *
 * Imported dynamically so the loader — a large chunk the HUD does not need — is
 * fetched on first model load rather than at first paint, and so its
 * registration is ordered after module evaluation by construction.
 */
let ready: Promise<void> | null = null;

export function registerGltfLoader(): Promise<void> {
  ready ??= import('@babylonjs/loaders/glTF/2.0').then(() => undefined);
  return ready;
}
