import { clampMagnitude, ZERO, type Vector2 } from './inputMath';

/**
 * Keyboard movement, for development on a PC and for anyone who plays on a
 * laptop (PLAN §0 lists desktops among the target devices).
 *
 * Keys are read by `event.code`, i.e. physical position, so WASD works
 * regardless of the keyboard layout the child is using.
 */
const KEY_VECTORS: Readonly<Record<string, Vector2>> = {
  KeyW: { x: 0, y: 1 },
  ArrowUp: { x: 0, y: 1 },
  KeyS: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * Dodge keys. Space is the obvious one; Shift suits players who keep a hand on
 * the movement keys. Both are read by physical position via `event.code`.
 */
const DODGE_CODES: ReadonlySet<string> = new Set(['Space', 'ShiftLeft', 'ShiftRight']);

/**
 * Attack keys. J sits under the right hand while the left hand steers with WASD;
 * K is offered as well because reaching for one specific key is a poor thing to
 * demand of a child.
 */
const ATTACK_CODES: ReadonlySet<string> = new Set(['KeyJ', 'KeyK']);

export interface KeyboardSource {
  readonly read: () => Vector2;
  readonly dodgeHeld: () => boolean;
  readonly attackHeld: () => boolean;
  /**
   * True once after focus was lost.
   *
   * Clearing the held keys on blur is necessary — otherwise a key released
   * while the window was away stays stuck down forever — but it is
   * indistinguishable from letting go of the attack button, which would fire a
   * swing the player never asked for. Reporting it lets the consumer cancel
   * instead of release.
   */
  readonly consumeFocusLoss: () => boolean;
  readonly dispose: () => void;
}

function anyPressed(pressed: ReadonlySet<string>, codes: ReadonlySet<string>): boolean {
  for (const code of codes) {
    if (pressed.has(code)) {
      return true;
    }
  }
  return false;
}

export function createKeyboardSource(): KeyboardSource {
  const pressed = new Set<string>();
  let focusLost = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (
      !Object.hasOwn(KEY_VECTORS, event.code) &&
      !DODGE_CODES.has(event.code) &&
      !ATTACK_CODES.has(event.code)
    ) {
      return;
    }
    pressed.add(event.code);
    // Otherwise the arrow keys scroll the page and Space scrolls or re-clicks
    // whatever the browser thinks is focused.
    event.preventDefault();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    pressed.delete(event.code);
  };

  // Losing focus mid-keypress would otherwise leave the character running
  // forever, because the keyup never arrives.
  const onBlur = (): void => {
    if (pressed.size > 0) {
      focusLost = true;
    }
    pressed.clear();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    read: () => {
      let x = 0;
      let y = 0;

      for (const code of pressed) {
        const vector = KEY_VECTORS[code];
        if (vector !== undefined) {
          x += vector.x;
          y += vector.y;
        }
      }

      if (x === 0 && y === 0) {
        return ZERO;
      }

      // Holding two keys must not travel faster than holding one.
      return clampMagnitude({ x, y });
    },
    dodgeHeld: () => anyPressed(pressed, DODGE_CODES),
    attackHeld: () => anyPressed(pressed, ATTACK_CODES),
    consumeFocusLoss: () => {
      const lost = focusLost;
      focusLost = false;
      return lost;
    },
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      pressed.clear();
    },
  };
}
