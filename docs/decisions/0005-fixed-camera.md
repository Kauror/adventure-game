# 0005 — Fixed camera

- **Status:** **accepted (final)** — confirmed on device 2026-08-28; the losing candidates have
  been deleted
- **Date:** 2026-08-28
- **Stage:** 0A.4

## Context

The game presents as 2.5D through a camera the player never controls (PLAN §2). Task 0A.4 is to
compare a few sensible configurations on real devices and fix one for the rest of Stage 0A.

The judgement criteria the roadmap sets — can a small child see enemies and obstacles, does the
player disappear behind scenery, do fingers obscure the action, is movement visually intuitive,
does it still read on a 13 mini — are all things a person has to look at. Four candidates were
therefore built and made switchable at runtime, compared on device, and one chosen.

## Decision

**`ortho-steep` — orthographic, 55° tilt from the horizon, 12 m visible vertically.**

The camera is fixed at `alpha = -PI/2`, looking north from the south, so north (high Z, and
`rows[0]` of an authored region) is up the screen. No control is ever attached. It follows the
player's position with exponential smoothing rather than snapping.

It is now the **only** camera in the codebase, as `GAME_CAMERA` in `apps/client/src/game/camera.ts`.

Four candidates were compared on device before the choice was made:

| id                 | Projection   | Tilt | Vertical extent | Outcome                                           |
| ------------------ | ------------ | ---- | --------------- | ------------------------------------------------- |
| `ortho-steep`      | orthographic | 55°  | 12 m            | **chosen**                                        |
| `ortho-shallow`    | orthographic | 40°  | 12 m            | rejected — more dimensional, but more occlusion   |
| `weak-perspective` | perspective  | 55°  | 12 m (FOV 22°)  | rejected — depth not worth the inconsistent scale |
| `perspective`      | perspective  | 45°  | 14 m (FOV 40°)  | rejected — most depth, most edge distortion       |

### Why orthographic, and why 55°

**Orthographic** keeps an object the same size wherever it sits on screen. A child judging "how
far away is that enemy" gets a consistent read, and nothing distorts toward the edges — which
matters on a phone in landscape, where a wide viewport puts a lot of the action well off-centre.

**55° is a compromise about occlusion.** Walls are 1.6 m; a steeper camera hides less behind
them, and "the player disappears behind scenery" is the failure the roadmap explicitly warns
about. Going steeper still would flatten silhouettes into top-down blobs, which works against
readable enemy telegraphs (PLAN §11).

**12 m vertical** shows roughly 15 m of ground depth at this tilt, and about 26 m across on a
19.5:9 phone — enough warning of an approaching enemy to react, without shrinking a 1.8 m
character to a speck on a 5.4" screen.

The vertical extent is the fixed quantity; a wider screen reveals more world to the sides rather
than scaling everything down. Orthographic bounds are recomputed whenever the viewport aspect
changes, so rotating a phone or an iOS toolbar sliding away does not change how big things look.

## What was removed when this became final

Per the pre-commitment below, the scaffolding went with the decision rather than being kept "just
in case":

- the three rejected presets, the preset registry (`cameraPresets.ts`), and the cycling helper;
- the on-screen switcher button and the `?camera=<id>` override;
- perspective support entirely — `perspectiveRadius`, the `projection` and `fovDegrees` fields.
  The camera is orthographic, so a perspective code path was dead weight. If perspective is ever
  wanted again it is a few lines, and this ADR records why it was not.

`CameraPreset` became `CameraConfig`: there is no set to pick from any more.

## Still open (a tunable, not a decision)

`verticalExtentMetres` is 12 m, chosen against a **placeholder box**. A real rigged character
(0A.3) is a much better guide to how large a person should look, so expect to revisit the zoom
then. The tilt and the projection are settled; only this number is expected to move.

## Consequences

- One fixed camera for the rest of the project; nothing downstream has to handle a moving one, and
  input maps straight from screen axes to world axes (ADR 0006) precisely because it never rotates.
- Wall occlusion has no mitigation (no fade or cutaway). At 55° very little hides behind a 1.6 m
  wall; revisit only if a real encounter proves otherwise.
- Camera arithmetic (`cameraMath.ts`) is pure and unit-tested; only the Babylon wiring is not.
- **Do not reintroduce a camera switcher.** An unresolved camera is a permanent invitation to
  re-litigate a settled decision. If the camera is wrong, change `GAME_CAMERA` and amend this ADR.
