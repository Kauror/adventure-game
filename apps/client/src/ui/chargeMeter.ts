import type { TimingBands } from '@adventure/game-core';
import { HAMMER } from '@adventure/game-core';

import type { ChargeLamp } from './chargeZone';
import { chargeZone } from './chargeZone';

/**
 * The hammer's charge indicator: a sweeping marker against a marked zone.
 *
 * Four shapes so far, and the differences between them are the whole design.
 *
 *  1. A track carrying two bands, a fill *and* a travelling head — five
 *     overlapping things, which an adult on a phone called too many blocks.
 *  2. Three traffic-light lamps — legible, but literal enough to read as
 *     furniture sitting on the screen rather than as part of the game.
 *  3. One bar that filled and changed colour — compact, but a filling bar tells
 *     you where you *are* without ever saying where you are *going*.
 *  4. This, which is the Gears of War active-reload bar: the target is drawn on
 *     the track and a crisp marker sweeps toward it.
 *
 * The difference from (1) is the fill. Removing it is what makes this readable:
 * a fill and a marker are two things racing along the same track saying the same
 * thing, and the eye has to work out which to watch. With the fill gone there is
 * one moving object and one place it is heading, which is the entire mechanic —
 * and anticipation comes for free, because you can see the marker approaching
 * rather than having to catch a colour change.
 *
 * Colour keeps the meaning the traffic light established: amber is GREAT, green
 * is PERFECT, and everywhere else is a plain hit. Releasing outside the zones
 * still lands — every release lands (PLAN §11) — so the marker never has to be
 * caught, only aimed at.
 *
 * Assist widens the bands, so an assisted player simply gets a bigger target.
 * Nothing announces that the setting is on.
 *
 * Updated by writing transforms every frame rather than re-rendering the Preact
 * overlay, for the same reason as the joystick: reconciling the HUD at 60 fps on
 * a phone wastes the frame budget.
 */
export interface ChargeMeter {
  readonly update: (progress: number, charging: boolean) => void;
  readonly dispose: () => void;
}

function band(className: string, startFraction: number, endFraction: number): HTMLElement {
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
    band(
      'ui-charge__band ui-charge__band--great',
      toFraction(bands.great.startSeconds),
      toFraction(bands.great.endSeconds),
    ),
  );
  track.appendChild(
    band(
      'ui-charge__band ui-charge__band--perfect',
      toFraction(bands.perfect.startSeconds),
      toFraction(bands.perfect.endSeconds),
    ),
  );

  // Full width with only a left edge drawn, so a percentage translate moves it
  // by that fraction of the *track* rather than of itself.
  const marker = document.createElement('div');
  marker.className = 'ui-charge__marker';
  track.appendChild(marker);

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
          // Back to the start rather than frozen mid-sweep.
          marker.style.transform = 'translateX(0%)';
          root.classList.remove('ui-charge--amber', 'ui-charge--green');
          lastLamp = null;
        }
      }
      if (!charging) {
        return;
      }

      const clamped = Math.min(1, Math.max(0, progress));
      marker.style.transform = `translateX(${clamped * 100}%)`;

      const zone = chargeZone(clamped * HAMMER.chargeSeconds, bands);

      // Guarded: touching classList every frame would invalidate style sixty
      // times a second for nothing.
      if (zone.lamp !== lastLamp) {
        root.classList.toggle('ui-charge--amber', zone.lamp === 'amber');
        root.classList.toggle('ui-charge--green', zone.lamp === 'green');
        lastLamp = zone.lamp;
      }
    },
    dispose: () => {
      root.remove();
    },
  };
}
