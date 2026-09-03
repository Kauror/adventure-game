import type { TimingBands } from '@adventure/game-core';
import { HAMMER } from '@adventure/game-core';

import type { ChargeLamp } from './chargeZone';
import { chargeZone } from './chargeZone';

/**
 * The hammer's charge indicator, as a traffic light.
 *
 * It began as a track with the sweet spot drawn on it, which is the right idea
 * — PLAN §11 wants the timing *visible*, not a reaction test — and the wrong
 * shape. By the time it carried a GREAT band, a PERFECT band, a fill and a
 * travelling head, an adult on a phone described it as too many blocks, and a
 * five-year-old was never going to do better.
 *
 * Three lamps say the same thing with a rule the players already know:
 *
 *     red → not yet · amber → nearly · green → **hit it now**
 *
 * Anticipation is preserved by warming the *next* lamp as the current one runs
 * out. Amber is only a fraction of a second wide, so it cannot be the only
 * warning that green is coming — you watch green brighten, which is a thing you
 * can plan around rather than react to.
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

/** How dim an inactive lamp sits. Visible, so the sequence can be anticipated. */
const LAMP_OFF_OPACITY = 0.16;

const ORDER: readonly ChargeLamp[] = ['red', 'amber', 'green'];

export function createChargeMeter(container: HTMLElement, bands: TimingBands): ChargeMeter {
  const root = document.createElement('div');
  root.className = 'ui-charge';
  root.setAttribute('aria-hidden', 'true');

  const lamps = new Map<ChargeLamp, HTMLElement>();
  for (const lamp of ORDER) {
    const element = document.createElement('div');
    element.className = `ui-charge__lamp ui-charge__lamp--${lamp}`;
    root.appendChild(element);
    lamps.set(lamp, element);
  }

  container.appendChild(root);

  let wasCharging = false;
  let lastLit: ChargeLamp | null = null;

  return {
    update: (progress, charging) => {
      if (charging !== wasCharging) {
        root.classList.toggle('ui-charge--active', charging);
        wasCharging = charging;
        if (!charging) {
          // Leave it dark rather than frozen mid-sequence, so the next press
          // always starts from red.
          for (const element of lamps.values()) {
            element.style.opacity = `${LAMP_OFF_OPACITY}`;
          }
          lastLit = null;
        }
      }
      if (!charging) {
        return;
      }

      const held = Math.min(1, Math.max(0, progress)) * HAMMER.chargeSeconds;
      const zone = chargeZone(held, bands);
      const nextLamp = ORDER[ORDER.indexOf(zone.lamp) + 1];

      for (const [lamp, element] of lamps) {
        if (lamp === zone.lamp) {
          element.style.opacity = '1';
        } else if (lamp === nextLamp) {
          // Warming up: this is the anticipation the bands used to carry.
          element.style.opacity = `${LAMP_OFF_OPACITY + zone.progress * 0.5}`;
        } else {
          element.style.opacity = `${LAMP_OFF_OPACITY}`;
        }
      }

      // Only the lit lamp glows, and only green pulses. Class changes are
      // guarded because touching classList every frame invalidates style for
      // nothing.
      if (zone.lamp !== lastLit) {
        root.classList.toggle('ui-charge--go', zone.lamp === 'green');
        lastLit = zone.lamp;
      }
    },
    dispose: () => {
      root.remove();
    },
  };
}
