import { applyDeadZone, ZERO, type Vector2 } from './inputMath';
import { tryCapturePointer, tryReleasePointer } from './pointerCapture';

/** Maximum thumb travel from the joystick origin, in CSS pixels. */
const RADIUS_PX = 56;

/**
 * Dead zone as a fraction of the radius. Deliberately small for touch: a thumb
 * already rests where it means to, unlike a spring-loaded stick.
 */
const DEAD_ZONE = 0.08;

/**
 * Fraction of the screen width reserved for movement. The right-hand side is
 * left free for the action buttons that arrive at 0A.6 and 0A.7.
 */
const MOVEMENT_ZONE_WIDTH = 0.5;

export type JoystickOrigin = 'dynamic' | 'fixed';

export interface TouchJoystick {
  readonly read: () => Vector2;
  readonly isActive: () => boolean;
  readonly dispose: () => void;
}

/**
 * Left-thumb virtual joystick.
 *
 * Two decisions matter more than the rest for a five-year-old:
 *
 * - **Dynamic origin (default).** The stick appears wherever the thumb lands
 *   inside the movement zone, so there is no small target to hit and no need to
 *   look down at the screen. `?joystick=fixed` switches to a fixed position for
 *   comparison.
 * - **One tracked pointer.** The joystick claims a single `pointerId` and
 *   ignores every other finger, so a second thumb on the right-hand side cannot
 *   disturb movement. Moving and acting at the same time is the whole point of
 *   the two-thumb layout, and it must work from the start.
 *
 * The knob is moved by writing a transform directly rather than by re-rendering
 * the Preact overlay: this updates every frame, and reconciling the whole HUD at
 * 60 fps on a phone would be a waste of the frame budget.
 */
export function createTouchJoystick(
  canvas: HTMLElement,
  container: HTMLElement,
  origin: JoystickOrigin = 'dynamic',
): TouchJoystick {
  const base = document.createElement('div');
  base.className = 'ui-joystick';
  base.setAttribute('aria-hidden', 'true');

  const knob = document.createElement('div');
  knob.className = 'ui-joystick__knob';
  base.appendChild(knob);
  container.appendChild(base);

  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  let value: Vector2 = ZERO;

  const fixedOrigin = (): { x: number; y: number } => ({
    x: RADIUS_PX + 32,
    y: window.innerHeight - RADIUS_PX - 32,
  });

  const show = (x: number, y: number): void => {
    originX = x;
    originY = y;
    base.style.transform = `translate(${x - RADIUS_PX}px, ${y - RADIUS_PX}px)`;
    base.classList.add('ui-joystick--active');
  };

  const moveKnob = (dx: number, dy: number): void => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const reset = (): void => {
    pointerId = null;
    value = ZERO;
    moveKnob(0, 0);
    if (origin === 'dynamic') {
      base.classList.remove('ui-joystick--active');
    }
  };

  if (origin === 'fixed') {
    const start = fixedOrigin();
    show(start.x, start.y);
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (pointerId !== null) {
      return; // already tracking a thumb; ignore other fingers
    }
    if (event.clientX > window.innerWidth * MOVEMENT_ZONE_WIDTH) {
      return; // right-hand side is reserved for actions
    }

    pointerId = event.pointerId;

    // Establish the origin BEFORE anything that can fail. If this is skipped,
    // the origin stays at (0, 0) and the stick silently steers from the corner
    // of the screen instead of from the thumb.
    if (origin === 'dynamic') {
      show(event.clientX, event.clientY);
    }

    tryCapturePointer(canvas, event.pointerId);

    onPointerMove(event);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) {
      return;
    }

    const dx = event.clientX - originX;
    const dy = event.clientY - originY;
    const distance = Math.hypot(dx, dy);
    const limited = distance > RADIUS_PX ? RADIUS_PX / distance : 1;

    moveKnob(dx * limited, dy * limited);

    value = applyDeadZone(
      {
        x: (dx * limited) / RADIUS_PX,
        // Screen Y grows downward; movement Y is screen-up.
        y: -((dy * limited) / RADIUS_PX),
      },
      DEAD_ZONE,
    );
  };

  const onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) {
      return;
    }
    tryReleasePointer(canvas, event.pointerId);
    reset();
  };

  const onResize = (): void => {
    if (origin === 'fixed' && pointerId === null) {
      const start = fixedOrigin();
      show(start.x, start.y);
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  window.addEventListener('resize', onResize);

  return {
    read: () => value,
    isActive: () => pointerId !== null,
    dispose: () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('resize', onResize);
      base.remove();
    },
  };
}
