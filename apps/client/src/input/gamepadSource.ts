import { applyDeadZone, clampMagnitude, ZERO, type Vector2 } from './inputMath';

/**
 * Gamepad movement, for a controller attached to a phone, tablet or PC.
 *
 * The Gamepad API is polled rather than event-driven, so this is read once per
 * frame. Sticks are generous with their dead zone: worn controllers drift, and
 * a character that wanders on its own is worse than one that needs a firm push.
 */
const STICK_DEAD_ZONE = 0.2;

/** Standard-mapping button indices for the d-pad. */
const DPAD = { up: 12, down: 13, left: 14, right: 15 } as const;

/**
 * Dodge is the east face button (B / circle).
 *
 * The south button (A / cross, index 0) is deliberately left free for attack at
 * 0A.7. Mapping both to dodge now would be friendlier today and then have to be
 * taken away, which is worse than learning it right the first time.
 */
const DODGE_BUTTON = 1;

/** Attack is the south face button (A / cross), reserved for it since 0A.6. */
const ATTACK_BUTTON = 0;

export interface GamepadSource {
  readonly read: () => Vector2;
  readonly dodgeHeld: () => boolean;
  readonly attackHeld: () => boolean;
  readonly isConnected: () => boolean;
}

function readStick(pad: Gamepad): Vector2 {
  const x = pad.axes[0] ?? 0;
  // The Gamepad API reports the vertical axis with up as negative.
  const y = -(pad.axes[1] ?? 0);
  return applyDeadZone({ x, y }, STICK_DEAD_ZONE);
}

function readDpad(pad: Gamepad): Vector2 {
  const pressed = (index: number): boolean => pad.buttons[index]?.pressed === true;

  const x = (pressed(DPAD.right) ? 1 : 0) - (pressed(DPAD.left) ? 1 : 0);
  const y = (pressed(DPAD.up) ? 1 : 0) - (pressed(DPAD.down) ? 1 : 0);

  return x === 0 && y === 0 ? ZERO : clampMagnitude({ x, y });
}

export function createGamepadSource(): GamepadSource {
  const connectedPads = (): Gamepad[] => {
    if (typeof navigator.getGamepads !== 'function') {
      return [];
    }
    return Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => pad !== null);
  };

  return {
    isConnected: () => connectedPads().length > 0,
    dodgeHeld: () => connectedPads().some((pad) => pad.buttons[DODGE_BUTTON]?.pressed === true),
    attackHeld: () => connectedPads().some((pad) => pad.buttons[ATTACK_BUTTON]?.pressed === true),
    read: () => {
      for (const pad of connectedPads()) {
        const stick = readStick(pad);
        if (stick.x !== 0 || stick.y !== 0) {
          return stick;
        }

        const dpad = readDpad(pad);
        if (dpad.x !== 0 || dpad.y !== 0) {
          return dpad;
        }
      }
      return ZERO;
    },
  };
}
