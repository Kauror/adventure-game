import type { DeviceInfo } from '../game/diagnostics';
import type { FrameSummary } from './frameStats';

/**
 * The numbers, on the screen of the device being measured.
 *
 * Deliberately plain DOM and deliberately not translated: nobody plays this, and
 * the only people who read it are holding a phone and writing figures into
 * `docs/device-baseline-stage0a.md`. Large, high contrast, and photographable —
 * a photograph of this panel is the most reliable way to get numbers off an
 * iPhone that cannot be inspected from a Windows machine at all.
 *
 * Two medians are shown side by side because their *difference* is the finding:
 * a session median that slowly pulls away from the recent one is thermal
 * throttling, which is precisely what a thirty-minute run is looking for.
 */

export interface StressReadoutOptions {
  readonly ladder: number;
  readonly shadows: boolean;
  readonly humanoids: number;
  readonly entities: number;
  readonly props: number;
  readonly device: DeviceInfo;
  /** Clears the statistics, for measuring after warm-up. */
  readonly onReset: () => void;
}

export interface StressReadout {
  readonly update: (summary: FrameSummary) => void;
  readonly dispose: () => void;
}

/** How often the panel redraws. Faster than this is unreadable and wasteful. */
const REFRESH_MS = 500;

function row(label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:12px"><span style="opacity:.65">${label}</span><span>${value}</span></div>`;
}

function minutes(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function createStressReadout(
  container: HTMLElement,
  options: StressReadoutOptions,
): StressReadout {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute',
    'top:calc(env(safe-area-inset-top,0px) + 8px)',
    'left:calc(env(safe-area-inset-left,0px) + 8px)',
    'padding:10px 12px',
    'border-radius:8px',
    'background:rgba(0,0,0,.72)',
    'color:#e8eef5',
    'font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
    'font-variant-numeric:tabular-nums',
    'pointer-events:auto',
    'min-width:240px',
    'max-width:min(340px,70vw)',
  ].join(';');

  const heading = document.createElement('div');
  heading.style.cssText = 'font-weight:700;margin-bottom:6px';
  heading.textContent = `STRESS ×${options.ladder}${options.shadows ? ' + shadows' : ''}`;
  panel.appendChild(heading);

  const body = document.createElement('div');
  panel.appendChild(body);

  const scene = document.createElement('div');
  scene.style.cssText =
    'margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.18);opacity:.7;font-size:12px;line-height:1.35';
  scene.textContent = `${options.humanoids} humanoids · ${options.entities} entities · ${options.props} props`;
  panel.appendChild(scene);

  const device = document.createElement('div');
  device.style.cssText =
    'opacity:.55;font-size:11px;line-height:1.3;margin-top:4px;word-break:break-word';
  device.textContent = `${options.device.engine} · ${options.device.renderer} · dpr ${options.device.devicePixelRatio}×`;
  panel.appendChild(device);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset (measure from now)';
  reset.style.cssText = [
    'margin-top:8px',
    'width:100%',
    'min-height:36px',
    'border:1px solid rgba(255,255,255,.3)',
    'border-radius:6px',
    'background:rgba(255,255,255,.1)',
    'color:inherit',
    'font:inherit',
    'font-size:12px',
    'touch-action:manipulation',
  ].join(';');
  reset.addEventListener('click', options.onReset);
  panel.appendChild(reset);

  container.appendChild(panel);

  let lastPaintMs = 0;

  const paint = (summary: FrameSummary): void => {
    const drift = summary.medianFps - summary.recentMedianFps;
    body.innerHTML = [
      row('median fps', summary.medianFps.toFixed(1)),
      row('recent fps', summary.recentMedianFps.toFixed(1)),
      // The finding, computed rather than left to be eyeballed.
      row('drift', `${drift >= 0 ? '−' : '+'}${Math.abs(drift).toFixed(1)}`),
      row('median ms', summary.medianMs.toFixed(1)),
      row('p95 ms', summary.p95Ms.toFixed(1)),
      row('worst ms', summary.worstMs.toFixed(0)),
      row('spikes', `${summary.spikes}`),
      row('frames', `${summary.samples}`),
      row('elapsed', minutes(summary.elapsedSeconds)),
    ].join('');
  };

  // Painted once up front, so the panel is never a heading over an empty space
  // while the first frames are still arriving — which on a phone reads as a
  // half-broken screen rather than as a measurement about to begin.
  paint({
    samples: 0,
    elapsedSeconds: 0,
    medianMs: 0,
    medianFps: 0,
    p95Ms: 0,
    worstMs: 0,
    spikes: 0,
    recentMedianFps: 0,
  });

  return {
    update: (summary) => {
      const now = performance.now();
      if (now - lastPaintMs < REFRESH_MS) {
        return;
      }
      lastPaintMs = now;
      paint(summary);
    },

    dispose: () => {
      reset.removeEventListener('click', options.onReset);
      panel.remove();
    },
  };
}
