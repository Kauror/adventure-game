import { Engine } from '@babylonjs/core/Engines/engine';

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
  const engine = new Engine(
    canvas,
    true,
    {
      stencil: true,
      powerPreference: 'high-performance',
      // Losing the context on a backgrounded phone tab is normal; do not treat
      // it as fatal.
      doNotHandleContextLost: false,
    },
    // adaptToDeviceRatio: render at the device pixel ratio so the scene is
    // crisp on phones. Whether we can afford full DPR is a 0A-2 measurement.
    true,
  );

  const handleResize = (): void => {
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
