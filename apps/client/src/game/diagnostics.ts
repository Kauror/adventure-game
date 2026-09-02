import type { Engine } from '@babylonjs/core/Engines/engine';

/**
 * Numbers worth knowing when a phone misbehaves.
 *
 * Frame rate is the one that matters: PLAN §26 sets 30 fps as the floor and
 * 0A-2 measures it for real, but a live readout on the device is what turns
 * "it feels laggy" into a number while a child is holding the phone.
 */
export interface LiveDiagnostics {
  readonly fps: number;
  readonly frameMs: number;
  /** CSS pixels the canvas occupies. */
  readonly viewport: string;
  /**
   * Actual backbuffer size.
   *
   * Worth its own line because a mismatch between this and the viewport is a
   * real bug that has already happened once: at 0A.1 the backbuffer stuck at
   * the HTML default 300×150 and was stretched across the screen. Having both
   * numbers visible on the device turns that into a glance.
   */
  readonly buffer: string;
}

/** Collected once at boot — none of it changes while the page is open. */
export interface DeviceInfo {
  readonly renderer: string;
  readonly engine: string;
  readonly devicePixelRatio: number;
  readonly platform: string;
}

export interface Diagnostics {
  readonly live: () => LiveDiagnostics;
  readonly device: DeviceInfo;
}

/** Trims a GPU string down to something that fits on a phone screen. */
function shorten(value: string, max = 42): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

export function createDiagnostics(engine: Engine): Diagnostics {
  let renderer = 'unknown';
  try {
    const info = engine.getGlInfo();
    renderer = shorten(info.renderer || info.vendor || 'unknown');
  } catch {
    // Some browsers mask this; not worth failing over.
  }

  const device: DeviceInfo = {
    renderer,
    // Babylon reports the API actually in use, which is the WebGL2-vs-WebGL1
    // question PLAN §26 cares about.
    engine: shorten(engine.description ?? 'unknown', 28),
    devicePixelRatio: Math.round(window.devicePixelRatio * 100) / 100,
    platform: shorten(navigator.userAgent, 52),
  };

  return {
    device,
    live: () => ({
      fps: Math.round(engine.getFps()),
      frameMs: Math.round(engine.getDeltaTime() * 10) / 10,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      buffer: `${engine.getRenderWidth()}×${engine.getRenderHeight()}`,
    }),
  };
}
