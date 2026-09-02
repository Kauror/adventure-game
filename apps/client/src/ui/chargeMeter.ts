import type { TimingBands } from '@adventure/game-core';
import { HAMMER } from '@adventure/game-core';

/**
 * The hammer's charge meter.
 *
 * The sweet spot is **drawn on the track**, not hidden. That is the difference
 * between the anticipation mechanic PLAN §11 asks for and a reaction test: the
 * child can see the marker coming and learn the rhythm. Assist widens the bands,
 * and because they are rendered from the same numbers the meter simply shows a
 * bigger target — nothing announces that the setting is on.
 *
 * Updated by writing transforms every frame rather than re-rendering the Preact
 * overlay, for the same reason as the joystick: reconciling the HUD at 60 fps on
 * a phone is a waste of the frame budget.
 */
export interface ChargeMeter {
  readonly update: (progress: number, charging: boolean) => void;
  readonly dispose: () => void;
}

function bandElement(className: string, startFraction: number, endFraction: number): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.style.left = `${startFraction * 100}%`;
  element.style.width = `${(endFraction - startFraction) * 100}%`;
  return element;
}

export function createChargeMeter(container: HTMLElement, bands: TimingBands): ChargeMeter {
  const root = document.createElement('div');
  root.className = 'ui-charge';
  root.setAttribute('aria-hidden', 'true');

  const track = document.createElement('div');
  track.className = 'ui-charge__track';

  const toFraction = (seconds: number): number => seconds / HAMMER.chargeSeconds;

  track.appendChild(
    bandElement(
      'ui-charge__band ui-charge__band--great',
      toFraction(bands.great.startSeconds),
      toFraction(bands.great.endSeconds),
    ),
  );
  track.appendChild(
    bandElement(
      'ui-charge__band ui-charge__band--perfect',
      toFraction(bands.perfect.startSeconds),
      toFraction(bands.perfect.endSeconds),
    ),
  );

  const fill = document.createElement('div');
  fill.className = 'ui-charge__fill';
  track.appendChild(fill);

  root.appendChild(track);
  container.appendChild(root);

  let wasCharging = false;

  return {
    update: (progress, charging) => {
      if (charging !== wasCharging) {
        root.classList.toggle('ui-charge--active', charging);
        wasCharging = charging;
      }
      if (charging) {
        fill.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
      }
    },
    dispose: () => {
      root.remove();
    },
  };
}
