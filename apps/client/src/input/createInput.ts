import { createActionLatch } from './actionLatch';
import { magnitude, ZERO, type Vector2 } from './inputMath';
import { createGamepadSource } from './gamepadSource';
import { createKeyboardSource } from './keyboardSource';
import { createTouchJoystick, type JoystickOrigin } from './touchJoystick';

export type InputSourceName = 'none' | 'touch' | 'keyboard' | 'gamepad';

export interface InputReading {
  readonly direction: Vector2;
  readonly source: InputSourceName;
  readonly gamepadConnected: boolean;
  readonly dodgeHeld: boolean;
  /**
   * Attack is a *level*, not an edge: the hammer is charged by holding and
   * swung by letting go, so both transitions matter and the consumer owns them.
   */
  readonly attackHeld: boolean;
}

export interface GameInput {
  /** Called once per frame, before reading. Does the press-edge detection. */
  readonly update: (nowMs: number) => void;
  readonly read: () => InputReading;
  /** True once per dodge press. Clears the latch, so a press is never used twice. */
  readonly consumeDodge: (nowMs: number) => boolean;
  /** Latches a dodge from the on-screen button. */
  readonly pressDodge: (nowMs: number) => void;
  /** Reports the on-screen attack button being held or released. */
  readonly setTouchAttack: (held: boolean) => void;
  /**
   * True once when the window lost focus with keys down. The consumer should
   * abandon anything in progress rather than treat it as a deliberate release.
   */
  readonly consumeInterrupt: () => boolean;
  readonly dispose: () => void;
}

/**
 * How long a dodge press stays queued while it waits to become legal.
 *
 * Pressing dodge a fraction early — during the cooldown, or mid-burst — should
 * still work rather than being silently dropped. That forgiveness is the whole
 * point for a five-year-old, and it is why the acceptance criterion asks for a
 * dodge that works "without twitch-level timing". Long enough to help, short
 * enough that a stale press never fires unexpectedly later.
 */
const DODGE_BUFFER_MS = 220;

/**
 * The single place input comes from.
 *
 * Three sources are read every frame and the strongest movement wins. Choosing
 * by magnitude rather than "most recently used" keeps this stateless: a resting
 * thumb reads as zero and simply loses to a pressed key, so nothing has to
 * track which device was touched last or expire it.
 *
 * Actions are different from movement: they are *edges*, not levels. Keyboard
 * and gamepad report a held button, so the rising edge is detected here in
 * `update`; the on-screen button is already an edge and latches directly. Either
 * way a press is consumed exactly once.
 */
export function createInput(
  canvas: HTMLElement,
  joystickContainer: HTMLElement,
  joystickOrigin: JoystickOrigin = 'dynamic',
): GameInput {
  const touch = createTouchJoystick(canvas, joystickContainer, joystickOrigin);
  const keyboard = createKeyboardSource();
  const gamepad = createGamepadSource();

  const dodgeLatch = createActionLatch(DODGE_BUFFER_MS);
  let touchAttackHeld = false;

  return {
    update: (nowMs) => {
      dodgeLatch.edge(keyboard.dodgeHeld() || gamepad.dodgeHeld(), nowMs);
    },

    pressDodge: (nowMs) => {
      dodgeLatch.press(nowMs);
    },

    setTouchAttack: (held) => {
      touchAttackHeld = held;
    },

    consumeDodge: (nowMs) => dodgeLatch.consume(nowMs),

    consumeInterrupt: () => keyboard.consumeFocusLoss(),

    read: () => {
      const candidates: readonly { readonly source: InputSourceName; readonly value: Vector2 }[] = [
        { source: 'touch', value: touch.read() },
        { source: 'keyboard', value: keyboard.read() },
        { source: 'gamepad', value: gamepad.read() },
      ];

      let best: InputSourceName = 'none';
      let bestValue: Vector2 = ZERO;
      let bestMagnitude = 0;

      for (const candidate of candidates) {
        const size = magnitude(candidate.value);
        if (size > bestMagnitude) {
          best = candidate.source;
          bestValue = candidate.value;
          bestMagnitude = size;
        }
      }

      return {
        direction: bestValue,
        source: best,
        gamepadConnected: gamepad.isConnected(),
        // Dodge held state exists only for the readout: the on-screen dodge
        // button is an edge, not a level, so it deliberately is not folded in.
        dodgeHeld: keyboard.dodgeHeld() || gamepad.dodgeHeld(),
        attackHeld: touchAttackHeld || keyboard.attackHeld() || gamepad.attackHeld(),
      };
    },

    dispose: () => {
      touch.dispose();
      keyboard.dispose();
    },
  };
}
