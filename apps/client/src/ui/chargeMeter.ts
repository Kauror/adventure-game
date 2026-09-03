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
 * Rebuilt after the first adult playtest, which could not read it at all. Three
 * things were wrong and all three were about *seeing* it:
 *
 *  - it lived in the bottom-right corner, under the hand that was charging;
 *  - it was 14 px tall, and the bands within it a few pixels wide;
 *  - the filling edge was the only moving thing, and it moved for 0.85 s.
 *
 * So it is now large, centred above the thumbs, and has a distinct head on the
 * moving edge — the thing whose arrival into the bright band is the whole
 * mechanic. The bands differ in height as well as colour, because a child who
 * cannot read also may not distinguish the colours.
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

  // The head of the fill, as its own element: a bright edge travelling towards
  // the bright band reads as "release when these meet", which a filling bar on
  // its own never did.
  const head = document.createElement('div');
  head.className = 'ui-charge__head';
  track.appendChild(head);

  root.appendChild(track);
  container.appendChild(root);

  const perfectStart = toFraction(bands.perfect.startSeconds);
  const perfectEnd = toFraction(bands.perfect.endSeconds);
  const greatStart = toFraction(bands.great.startSeconds);
  const greatEnd = toFraction(bands.great.endSeconds);

  let wasCharging = false;
  let lastZone = '';

  return {
    update: (progress, charging) => {
      if (charging !== wasCharging) {
        root.classList.toggle('ui-charge--active', charging);
        wasCharging = charging;
      }
      if (!charging) {
        return;
      }

      const clamped = Math.min(1, Math.max(0, progress));
      fill.style.transform = `scaleX(${clamped})`;
      head.style.transform = `translateX(${clamped * 100}%)`;

      // The whole meter reacts when the head is inside a band, so the moment is
      // visible in peripheral vision — a child watching the enemy still catches
      // it. Class changes are guarded: touching classList every frame would
      // invalidate style on every frame for nothing.
      const zone =
        clamped >= perfectStart && clamped <= perfectEnd
          ? 'perfect'
          : clamped >= greatStart && clamped <= greatEnd
            ? 'great'
            : '';
      if (zone !== lastZone) {
        root.classList.toggle('ui-charge--in-great', zone === 'great');
        root.classList.toggle('ui-charge--in-perfect', zone === 'perfect');
        lastZone = zone;
      }
    },
    dispose: () => {
      root.remove();
    },
  };
}
