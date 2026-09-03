import type { TimingBands } from '@adventure/game-core';
import { HAMMER } from '@adventure/game-core';

import type { ChargeLamp } from './chargeZone';
import { chargeZone } from './chargeZone';

/**
 * The hammer's charge indicator.
 *
 * Three shapes so far, each one a correction of the last.
 *
 *  1. A track with the sweet spot drawn on it — right idea (PLAN §11 wants the
 *     timing *visible*, not a reaction test), wrong shape. By the time it
 *     carried a GREAT band, a PERFECT band, a fill and a travelling head, an
 *     adult on a phone called it too many blocks.
 *  2. Three traffic-light lamps — legible, but literal enough to read as
 *     furniture rather than as part of the game.
 *  3. This: **one bar that fills, and changes colour as it crosses the bands.**
 *
 * The traffic light survives as meaning rather than as pictures. The fill runs
 * red → amber → green, and green *is* the PERFECT band; hold too long and it
 * runs back down through amber to red, which is exactly what overcharging is.
 * Releasing on red still lands the hit — red means "you get the ordinary one",
 * never "you failed" (every release lands).
 *
 * One element carries two facts at once, which is why it beats both earlier
 * shapes: **how far along you are** (the fill, continuous, so the moment can be
 * seen approaching) and **what you would get** (the colour). Anticipation comes
 * from the glow ramping up through amber, so green never has to be caught cold
 * in the fraction of a second amber lasts.
 *
 * Assist widens the bands, so an assisted player simply gets a longer green.
 * Nothing announces that the setting is on.
 *
 * Updated by writing styles every frame rather than re-rendering the Preact
 * overlay, for the same reason as the joystick: reconciling the HUD at 60 fps on
 * a phone wastes the frame budget.
 */
export interface ChargeMeter {
  readonly update: (progress: number, charging: boolean) => void;
  readonly dispose: () => void;
}

export function createChargeMeter(container: HTMLElement, bands: TimingBands): ChargeMeter {
  const root = document.createElement('div');
  root.className = 'ui-charge';
  root.setAttribute('aria-hidden', 'true');

  const track = document.createElement('div');
  track.className = 'ui-charge__track';

  const fill = document.createElement('div');
  fill.className = 'ui-charge__fill';
  track.appendChild(fill);

  root.appendChild(track);
  container.appendChild(root);

  let wasCharging = false;
  let lastLamp: ChargeLamp | null = null;

  return {
    update: (progress, charging) => {
      if (charging !== wasCharging) {
        root.classList.toggle('ui-charge--active', charging);
        wasCharging = charging;
        if (!charging) {
          // Reset rather than freezing mid-sweep, so the next press starts red
          // and empty.
          fill.style.transform = 'scaleX(0)';
          root.classList.remove('ui-charge--amber', 'ui-charge--green');
          lastLamp = null;
        }
      }
      if (!charging) {
        return;
      }

      const clamped = Math.min(1, Math.max(0, progress));
      fill.style.transform = `scaleX(${clamped})`;

      const zone = chargeZone(clamped * HAMMER.chargeSeconds, bands);

      // Guarded: touching classList every frame would invalidate style for
      // nothing 60 times a second.
      if (zone.lamp !== lastLamp) {
        root.classList.toggle('ui-charge--amber', zone.lamp === 'amber');
        root.classList.toggle('ui-charge--green', zone.lamp === 'green');
        lastLamp = zone.lamp;
      }

      // The approach. Amber lasts under two tenths of a second, so it cannot be
      // the only warning that green is coming — the bar brightens through it.
      const warmth = zone.lamp === 'amber' ? zone.progress : 0;
      root.style.setProperty('--charge-warmth', `${warmth}`);
    },
    dispose: () => {
      root.remove();
    },
  };
}
