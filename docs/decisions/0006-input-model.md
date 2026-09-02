# 0006 — Input model: touch, keyboard and gamepad

- **Status:** accepted
- **Date:** 2026-08-28
- **Stage:** 0A.5

## Context

The roadmap's 0A.5 asks for a left-thumb virtual joystick plus "keyboard movement on PC for
development". During the task the requirement grew: an attached **controller** should work too,
on whichever device it is plugged into.

That is a reasonable ask — PLAN §0 already lists desktops and tablets among the target devices,
and an older child with a controller is a plausible player. But three input devices is exactly
the point where ad-hoc handling turns into three divergent code paths.

## Decision

**One input layer with three interchangeable sources**, all reduced to a single movement vector.

- `touchJoystick` — left-thumb virtual stick (the primary device).
- `keyboardSource` — WASD and arrows, read by `event.code` so the physical key positions work
  regardless of keyboard layout.
- `gamepadSource` — left stick and d-pad, polled once per frame via the Gamepad API.

`createInput` reads all three each frame and **the strongest signal wins**. Choosing by magnitude
rather than "most recently used" keeps the combiner stateless: a resting thumb reads as zero and
simply loses to a pressed key, so nothing has to track which device was last touched or decide
when that claim expires.

Conventions that follow from the fixed camera (ADR 0005):

- Input is a 2D vector where **`y` is screen-up, which is world +Z (north)**. That direct mapping
  is only valid because the camera never rotates. If it ever gained rotation, input would have to
  be transformed into camera space in `inputMath`, not at each call site.
- Diagonals are clamped to unit length everywhere, so two keys never travel faster than one.
- Dead zones are **radial and rescaled** from their edge back to 0..1. Without rescaling, crossing
  the dead zone jumps straight to dead-zone speed and a child can never creep up to a ledge.

Touch specifics:

- **The screen is split**: the left half moves, the right half is reserved for the action buttons
  arriving at 0A.6 and 0A.7.
- **Dynamic origin by default** — the stick appears wherever the thumb lands, so there is no small
  target to hit and no need to look down. `?joystick=fixed` switches to a fixed position for
  comparison.
- **One tracked `pointerId`.** The joystick claims a single pointer and ignores every other finger,
  so a second thumb on the right cannot disturb movement. Moving and acting simultaneously is the
  entire point of the two-thumb layout and must work from the start, not be retrofitted.
- The knob is moved by writing a transform directly, **not** by re-rendering the Preact overlay —
  it updates every frame, and reconciling the HUD at 60 fps on a phone would waste the budget.

Movement itself is **not** implemented in the client. `stepMovement` lives in game-core alongside
`MOVEMENT.maxSpeedMetresPerSecond`, because PLAN §4 makes movement client-authoritative but
server-sanity-checked, and a displacement cap only means something if both sides agree on the
speed. `isPlausibleDisplacement` is defined there now, unused until Stage 0B, so the two sides
cannot drift into two implementations.

## Anticipated, not designed

Beyond attack and dodge, **sprint, dash and jump** are wanted later (PLAN §29, which carries the
design notes). They land here, in `createInput`, alongside movement. Two implications for whoever
adds them: sprint on touch is probably a stick-to-the-rim gesture rather than a button, so the
input layer will need a magnitude threshold rather than a new source; and jump is not an input
problem at all — the simulation has no vertical axis yet, so it needs a world-model spike first.

## Consequences

- Action buttons plug into `createInput` rather than growing a parallel path per device.
- A gamepad works on any device that can pair one, with no separate code path.
- The readout shows the active source and whether a pad is connected, so "is my controller
  working?" is answerable on the phone without a debugger.
- Adding a second local player later is not free: the combiner assumes one player and picks a
  single winning source. That is the right trade for now — split-screen is not in the plan.
