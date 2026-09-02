/**
 * Best-effort pointer capture.
 *
 * `setPointerCapture` throws `NotFoundError` when the pointer is no longer
 * active — which genuinely happens if a finger lifts between the event being
 * queued and the handler running, and happens constantly with synthetic events
 * in tests.
 *
 * This bit us twice: once in the joystick (the origin was never set, so the
 * stick steered from the corner of the screen) and once in the attack button
 * (the charge never started, then stuck on). Both times the throw aborted the
 * rest of an event handler that had real work left to do.
 *
 * Capture is an *improvement* — it keeps tracking a thumb that slides outside
 * the element — never a requirement, because the ordinary listeners still fire.
 * So it is always safe to swallow the failure. **Call this after the handler's
 * own state is already set, never before.**
 */
export function tryCapturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Pointer already gone; the ordinary listeners still work.
  }
}

export function tryReleasePointer(element: Element, pointerId: number): void {
  try {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    // Already released; releasing is best-effort.
  }
}
