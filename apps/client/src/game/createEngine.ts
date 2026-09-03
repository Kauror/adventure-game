import { Engine } from '@babylonjs/core/Engines/engine';

import { effectiveDevicePixelRatio } from './renderScale';

export interface EngineHandle {
  readonly engine: Engine;
  /** Removes listeners and disposes the engine. */
  readonly dispose: () => void;
}

/**
 * Creates the Babylon engine and owns the browser-level concerns that go with
 * it: device pixel ratio, and resize/orientation handling.
 *
 * Phones change viewport size constantly — rotation, URL bar collapse, keyboard
 * — so resize handling is foundational rather than polish.
 */
export function createEngine(canvas: HTMLCanvasElement): EngineHandle {
  /** The ratio this canvas can afford right now, at its current size. */
  const ratio = (): number =>
    effectiveDevicePixelRatio(
      // Before the stylesheet lands the canvas can still be 0x0; fall back to
      // the window so the first ratio is never computed from nothing.
      canvas.clientWidth || window.innerWidth,
      canvas.clientHeight || window.innerHeight,
      window.devicePixelRatio,
      window.location.search,
    );

  const engine = new Engine(
    canvas,
    // Multisampling is a second full-resolution cost, and it buys least exactly
    // where it is dearest: at 2x the backbuffer is already resolving the edges
    // this would smooth. Kept for displays we render at 1x, where the jaggies
    // are genuinely visible.
    ratio() < 1.5,
    {
      stencil: true,
      powerPreference: 'high-performance',
      // Losing the context on a backgrounded phone tab is normal; do not treat
      // it as fatal.
      doNotHandleContextLost: false,
    },
    // adaptToDeviceRatio is deliberately off: the scaling level is set below
    // from our own budget rather than from whatever the device reports.
    false,
  );

  // Babylon counts CSS pixels per rendered pixel, so a 2x ratio is a level of
  // 0.5.
  const applyScaling = (): void => {
    engine.setHardwareScalingLevel(1 / ratio());
  };
  applyScaling();

  const handleResize = (): void => {
    // Order matters: the budget depends on the canvas' new CSS size, and
    // `resize()` is what sizes the backbuffer from the level.
    applyScaling();
    engine.resize();
  };

  /*
   * A ResizeObserver on the canvas is the primary signal, not window 'resize'.
   *
   * Two real failures this avoids, both seen during 0A.1 verification:
   *  - the stylesheet can land *after* the engine is constructed (Vite injects
   *    CSS asynchronously in dev), so the canvas has no layout size yet and the
   *    backbuffer sticks at the HTML default 300x150, stretched across the
   *    screen until something else triggers a resize;
   *  - viewport changes do not always emit a window 'resize' event.
   *
   * ResizeObserver fires once on observe and again whenever the box actually
   * changes, which covers both. The window listeners stay as a cheap backstop
   * for mobile browsers that change the visual viewport without relaying out
   * the canvas (iOS toolbar collapse, rotation).
   */
  const observer = new ResizeObserver(handleResize);
  observer.observe(canvas);

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', handleResize);

  return {
    engine,
    dispose: (): void => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      engine.dispose();
    },
  };
}
