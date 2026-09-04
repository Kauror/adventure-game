# Stage 0A log

Running log for Stage 0A. Newest entry last.

---

## 2026-08-28 — 0A.1 Client foundation

**Outcome:** PASS. `pnpm check` green (format, lint, typecheck, 11 tests, production build).

### What was built

The repository skeleton (PREP-01), toolchain (PREP-02), the attribution foundation (PREP-04),
and the Stage 0A.1 client foundation:

- pnpm workspace with a single package, `apps/client`; root scripts for dev/build/check.
- Vite + TypeScript (strict) + Babylon.js (`@babylonjs/core` modular imports) + Preact.
- A deliberately boring proving scene: dark clear colour, 12 m × 12 m ground, one 1.8 m box,
  one hemispheric light, one static development camera **with no controls attached**.
- Engine lifecycle split into `createEngine` / `createScene`, with `main.ts` wiring boot →
  render loop → teardown, including an HMR dispose hook.
- Full-screen landscape browser baseline: no page scroll, no overscroll, `touch-action: none`
  on the canvas, no text selection or iOS callout, `100dvh` sizing, safe-area CSS variables.
- Preact overlay that is pointer-transparent by default, showing a development badge and a
  portrait-orientation notice.
- Minimal typed i18n (`t()` over an Estonian catalogue); the document title is set from it.

### Decisions

- ADR 0001 foundation stack, ADR 0002 coordinate convention, ADR 0003 state boundaries,
  ADR 0004 Stage 0A scope firewall.
- **TypeScript pinned to 6.x.** TS 7 resolves as `latest` but `typescript-eslint` rejects it
  outright (issue #10940). One compiler every tool agrees on beats a faster one; revisit when
  typescript-eslint supports TS ≥7.1.
- **Git LFS** patterns configured before any binary asset exists — global for formats that are
  never small, scoped to `assets/` for bulk images and audio so small UI icons stay normal git
  objects.

### Learned (two real bugs, found by verifying in a browser rather than assuming)

1. **The canvas backbuffer booted at 300×150.** Vite injects CSS asynchronously in dev, so the
   canvas had no layout size when the Babylon engine was constructed, and the backbuffer stuck
   at the HTML default — stretched across the screen until something else triggered a resize.
   A `ResizeObserver` on the canvas is now the primary resize signal (it fires once on observe
   and whenever the box really changes); the window `resize`/`orientationchange` listeners
   remain as a backstop for viewport changes that do not relayout the canvas.
2. **The portrait notice did not clear on rotation.** Relying solely on the media query's own
   `change` event is fragile. The hook now also listens to `resize` and `orientationchange` and
   re-reads `matches`; re-reading is idempotent, so redundant events cost nothing while a
   missed event would leave a wrong full-screen notice on a child's phone.

Both fixes belong to 0A.1's "safe handling of resize/orientation changes" acceptance criterion.

### Known issues / notes for later

- **Babylon bundle is ~1.05 MB raw / ~256 kB gzipped** with sourcemaps, and Vite warns about
  the chunk size. Acceptable for a foundation, but the cold-load budget on 4G is a real Stage
  0A-2 measurement, and code-splitting or trimming side-effect imports may be needed.
- **`adaptToDeviceRatio` is enabled**, so the backbuffer is DPR-scaled (verified: 390×844 CSS
  became a 780×1688 buffer at DPR 2). Crisp, but whether a mediocre phone can afford full DPR
  is exactly what 0A-2 measures; a DPR cap may follow.
- No visual screenshot could be captured in this environment (the automation browser pane was
  not compositing). Rendering was verified indirectly — Babylon reports WebGL2 initialisation,
  the console is error-free, and the canvas sizes correctly.
- `apps/client/src/game` holds no asset loader yet. The roadmap lists "basic asset loader"
  under 0A.1, but there are no assets to load and no format decided; building one now would be
  the empty complexity the roadmap forbids. It arrives with the rig work in 0A-2.

### Next approved task

**0A.2 — Coordinate and region prototype.** Not started.

---

## 2026-08-28 — 0A.2 Coordinate and region prototype

**Outcome:** PASS. `pnpm check` green across three packages (format, lint, typecheck, **50 tests**,
production build).

### What was built

Two workspace packages arrived, because this is the stage that needs them:

- **`packages/game-core`** — the region format and all grid logic, as pure TypeScript with no
  Babylon, no engine and no DOM. The server will simulate against this same grid, so walkability
  is a game rule, not a rendering detail. Contains `parseRegion` (validation), tile ↔ world
  conversion, `isWalkableWorld`, `elevationAtWorld`, `clampMovement` and `traceMovement`.
- **`packages/content`** — authored data only, exporting the region JSON as `unknown` so a
  consumer cannot skip validation by leaning on an inferred shape.

The client now renders **from** that data rather than from hand-placed geometry: ground sized to
the region, wall blocks and raised platforms generated per tile and merged into one mesh each,
and spawn markers from the region's objects. The overlay became a coordinate readout — region
name, grid size, probe position in metres, tile col/row, elevation, walkable — and a tappable
debug probe demonstrates containment by refusing to enter walls.

The test arena is deliberately **20 × 14, not square**, so a width/height transposition cannot
hide. It has a sealed border, interior obstacles, a raised 4 × 4 platform, one player spawn and
two enemy spawns.

### Decisions

- **The world convention moved into game-core** and the client now re-exports it. Keeping
  `WORLD` in the client would have created exactly the second competing coordinate system that
  ADR 0002 forbids, the moment the server appeared.
- **`rows[0]` is north and `+Z` points north**, so row → Z carries a `height - 1 - row` flip.
  Recorded in ADR 0002; confined to two functions and covered by a round-trip test over every
  tile.
- **Regions are authored as a character grid plus a legend** (`#` wall, `.` floor, `+` platform).
  Hand-editable, diff-friendly, and readable by a coding agent. Spawns are typed _objects_ with
  tile coordinates, not legend characters, per PLAN §7.
- **Validation is hand-written rather than a schema library.** The format is small, the errors can
  name the exact offending tile or object, and it avoids a dependency the project does not need
  yet. This becomes the core of the CI content validator later.
- **`tContent()` added for content-supplied i18n keys.** A region's `nameKey` cannot be proven to
  exist at compile time; a missing key now renders as the key itself, because a visible
  `region.foo.name` on screen is an obvious bug report and silence is not.

### Learned

- **`clampMovement` alone is not enough for a long step.** It only inspects the destination, so a
  single large move tunnels straight through a wall into the space beyond. `traceMovement`
  subdivides the step and is what the debug probe uses; per-frame movement in 0A.5 can call
  `clampMovement` directly. There is a regression test for the tunnelling case specifically.
- **Axis-separated clamping gives wall sliding for free**, which is the behaviour a top-down game
  wants: walking north-east into a north wall still moves you east.
- Verified live in the browser: the probe reported `Käidav: jah` at every position it was moved
  to, including when a tap west of tile (10, 8) was correctly refused by the wall at columns 8–9.
- Console is clean on a fresh tab. (Errors seen mid-session were stale: killing the dev server
  with the page still open makes Babylon's lazily-fetched shader modules 404. Not a code defect —
  worth recognising rather than chasing next time.)

### Known issues / notes for later

- The dev camera now frames the region, but it is still a **temporary** ArcRotateCamera. Choosing
  the real fixed camera is 0A.4, and the north-up authoring choice above should be sanity-checked
  by eye when that happens.
- `clampMovement` is **point-based**; a character radius is not modelled yet. That is a 0A.5/1.x
  concern and deliberately not invented now.
- Bundle grew to ~1.07 MB raw / ~263 kB gzipped. Still a 0A-2 measurement question.
- Walls are merged into a single mesh, so scenery costs one draw call rather than ~90 — worth
  keeping in mind as regions grow.

### Next approved task

**0A.3 (0A-2) rig pipeline** or **0A.4 fixed camera**, per the roadmap ordering — Kid Test 0 gates
the 0A-2 work. Not started.

---

## 2026-08-28 — 0A.4 Fixed camera

**Outcome:** PASS on the buildable half; the **on-device choice is still open** (see below).
`pnpm check` green — format, lint, typecheck, **65 tests**, production build.

### What was built

Four candidate cameras, switchable at runtime, and the machinery to make a fixed camera behave
properly on a phone:

- `cameraMath.ts` — pure, unit-tested arithmetic: tilt → Babylon `beta`, orthographic bounds from
  vertical extent and aspect, and the distance a perspective camera needs to show a given extent.
- `cameraPresets.ts` — the four candidates as data, with lookup and cycling.
- `camera.ts` — Babylon wiring: fixed `alpha = -PI/2` (north up the screen), no control ever
  attached, orthographic bounds recomputed on viewport change, and exponential-smoothed following.
- An on-screen switcher button plus `?camera=<id>`, so the comparison can be done on the phone
  itself rather than by editing code.

The camera now **follows the probe**, which stands in for the player until 0A.5. Framing a moving
character is the thing this task actually has to judge; framing a static scene would have answered
the wrong question.

### Decisions

- **Provisional default `ortho-steep`** — orthographic, 55° tilt, 12 m visible vertically.
  Reasoning and the on-device confirmation checklist are in ADR 0005.
- **Vertical extent is the fixed quantity.** A wider screen reveals more world to the sides
  instead of scaling everything down, so a phone and a tablet show a character at the same size.
- **Presets are data, not a slider.** An infinitely tweakable camera is a way to never decide; the
  roadmap asks for a few candidates and a choice.

### Learned

- **A test asserted the wrong thing and the code was right.** `tiltToBeta(90)` clamps to 89.9°,
  because a `beta` of exactly 0 makes an ArcRotateCamera degenerate — so it returns 0.0017 rad,
  not 0. The fix was to assert the clamp explicitly, which documents the behaviour better than the
  original assertion did.
- Verified live: each preset maps the same screen tap to a measurably different world point
  (z = 8.23 → 9.14 → 9.85 → 10.85 as tilt shallows), so the switch really does reconfigure the
  projection rather than just relabelling. The cycle wraps correctly and the console stays clean
  across aspect changes from 1180×380 to 700×500.

### Open — needs a person, not an agent

The roadmap's evaluation criteria (can a small child read the scene, does the player vanish behind
scenery, do thumbs cover the action, does it work on the 13 mini) cannot be settled from here.
**ADR 0005 is marked provisional and carries a five-point checklist to run on the phone.**

Two things are likely to move the answer: there is **no real character yet** (0A.3), and a
placeholder box is a poor guide to how large a person should look; and the **bottom corners will
be covered by the joystick and buttons** at 0A.5, so the usable play area is narrower than it
currently appears.

### Known issues / notes for later

- Once the camera is confirmed, **delete the losing presets and the switcher.** Leaving them is a
  standing invitation to re-litigate a settled decision.
- Wall occlusion has no mitigation (no fade or cutaway for anything between camera and player).
  Whether it needs one is exactly what the on-device check should reveal.
- Follow smoothing is a single responsiveness constant with no dead zone; if the camera feels
  seasick once there is real movement, that is the knob.

### Next approved task

**0A.5 — Touch movement** (left-thumb virtual joystick), which will drive `clampMovement` from
game-core per frame. Not started.

---

## 2026-08-28 — 0A.5 Movement: touch, keyboard and gamepad

**Outcome:** PASS. `pnpm check` green — format, lint, typecheck, **90 tests**, production build.

### Scope note

The roadmap asked for a touch joystick plus keyboard-on-PC. During the task the requirement grew
to include **an attached controller**. Accepted and built; recorded in ADR 0006.

### What was built

One input layer with three interchangeable sources (`touchJoystick`, `keyboardSource`,
`gamepadSource`), combined by `createInput` — all three are read each frame and the strongest
signal wins. Choosing by magnitude rather than "most recently used" keeps the combiner stateless.

A real **player character** replaces the 0A.2 tap-probe, which was scaffolding for verifying
coordinates and is now superseded. It is a box with a nose so facing is legible; the rigged
character is 0A.3.

Movement itself lives in **game-core** (`stepMovement`, `MOVEMENT`), not the client, because
PLAN §4 makes movement client-authoritative but server-sanity-checked — a displacement cap only
means something if both sides agree on the speed. `isPlausibleDisplacement` is defined now,
unused until Stage 0B, so the two sides cannot drift into two implementations.

### Decisions

- **Screen split**: left half moves, right half reserved for the action buttons at 0A.6/0A.7.
- **Dynamic joystick origin** by default — the stick appears where the thumb lands, so there is no
  small target to hit and no need to look down. `?joystick=fixed` for comparison.
- **One tracked `pointerId`**, so a second thumb on the right cannot disturb movement. Moving and
  acting at once is the whole point of the two-thumb layout; retrofitting it later would be worse.
- **Dead zones are radial and rescaled** from their edge back to 0..1, so the slowest usable speed
  is genuinely slow and a child can creep up to a ledge instead of overshooting it.
- The joystick knob is moved by writing a transform directly, and the readout **polls at 5 Hz**
  rather than subscribing — the player moves every frame, and re-rendering the overlay at 60 fps
  for numbers nobody can read that fast would waste the phone's frame budget.

### Learned (two real bugs, both found by testing rather than assuming)

1. **`stepMovement` could tunnel through walls on a long frame.** It used a single destination
   check, so one dropped frame at 4.5 m/s could cross a 1 m wall. Worse, a phone returning from
   lock reports an enormous first delta — and PLAN §6 treats phone-lock as the _normal_ session,
   not an edge case — which would have flung the child across the map on unlock. Now: the frame is
   capped at `MOVEMENT.maxFrameSeconds` (0.1 s) and the step goes through `traceMovement`, which
   subdivides. At 60 fps that is exactly one subdivision, so the normal case costs nothing.
2. **`setPointerCapture` threw and silently broke the joystick.** It raises `NotFoundError` if the
   pointer is already gone — a real possibility when a finger lifts between the event being queued
   and the handler running. The throw aborted the handler _before_ the origin was set, leaving it
   at (0, 0): the stick stayed invisible and steered from the corner of the screen rather than from
   the thumb, so dragging west moved the character east. Fixed by establishing the origin first and
   treating capture as best-effort inside a `try`.

A third, smaller lesson: a failing test is not automatically a code bug. The wall-slide test failed
because the step was too short to reach the wall, not because sliding was broken — but chasing it
is what exposed bug 1.

### Verified in the browser

Keyboard east moved X only; the NE diagonal moved both axes by _exactly equal_ amounts (correct
normalisation); blur cleared a stuck key. Touch: pressing showed the stick without moving (dead
zone), dragging west decreased X, a second finger on the right did not disturb movement, and
release hid the stick and zeroed the knob. A right-half press never started the joystick.
Containment held under continuous running — north stopped at z = 10.99 against the wall on row 2,
east stopped at x = 5.98 against the wall at column 6 — and walking onto the platform reported
1.00 m elevation, which the camera follows. Fresh-tab console completely clean.

### Known issues / notes for later

- Movement is **point-based**; the character has no collision radius, so the box's corners visually
  overlap walls before movement stops. A radius belongs with the real rig (0A.3) or 0A-2.
- No acceleration or friction — input maps straight to velocity. Whether that feels right for a
  five-year-old is a Kid Test 0 question, not something to tune blind.
- The gamepad path is **untested against real hardware** (none available here); it is written to
  the standard mapping and the readout reports connection state so it can be checked on device.
- Camera follow smoothing has no dead zone; with real movement it may feel slightly floaty.

### Next approved task

**0A.6 — Dodge**, then 0A.7 hammer timing. Both are right-thumb actions and plug into
`createInput` alongside movement. Not started.

---

## 2026-08-28 — 0A.4 closed: camera confirmed, scaffolding removed

**Outcome:** PASS. `pnpm check` green — format, lint, typecheck, **83 tests**, production build.

`ortho-steep` (orthographic, 55° tilt, 12 m vertical extent) is the **final** camera. ADR 0005 is
now accepted rather than provisional.

Per that ADR's own pre-commitment, the scaffolding was deleted along with the decision rather than
kept "just in case":

- the three rejected presets, the preset registry (`cameraPresets.ts`) and the cycling helper;
- the on-screen switcher button and the `?camera=<id>` override;
- **perspective support entirely** — `perspectiveRadius`, and the `projection` / `fovDegrees`
  fields. The camera is orthographic, so a perspective code path was dead weight. `CameraPreset`
  became `CameraConfig`, because there is no set to choose from any more.

The camera is now a single exported `GAME_CAMERA` constant in `camera.ts`. Test count fell from 90
to 83, which is the right direction: the deleted tests covered machinery that no longer exists.

Verified after the cleanup: readout shows no camera row and no buttons, movement still works
(5.50 → 9.10 m east), console clean.

**Still a tunable, not a decision:** `verticalExtentMetres` (12 m) was chosen against a placeholder
box. Expect to revisit the zoom once a real rigged character exists at 0A.3 — the tilt and
projection are settled, only that number is expected to move.

**Do not reintroduce a camera switcher.** If the camera is wrong, change `GAME_CAMERA` and amend
ADR 0005.

---

## 2026-08-28 — 0A.6 Dodge

**Outcome:** PASS on everything buildable and testable here. `pnpm check` green — format, lint,
typecheck, **111 tests**, production build. **Browser verification was not possible this session**
(see below), so the DOM/Babylon glue is unconfirmed by eye.

### Decision first: dodge and dash are different mechanics (ADR 0007)

Settled by asking what each is _for_. A dash is traversal — a quick sprint burst. A dodge is
evasion, and belongs to the fighting loop: read the telegraph, dodge, counterattack. So dodge
carries invulnerability and a cooldown; dash, if it ever ships, belongs with sprint and must stay
distinguishable to a child rather than being a second copy of dodge.

### What was built

`dodge.ts` in **game-core**, not the client — PLAN §4 lists dodge among the things the server
decides ("I pressed dodge" → the server owns whether the cooldown allowed it). It is a pure state
machine: `ready → dodging → cooldown → ready`, with a normalised burst direction, immutable state
and overshoot carried across phase boundaries so frame rate cannot stretch a dodge.

Wired through the whole input model: **Space or Shift** on keyboard, **B / circle** on a gamepad
(A / cross deliberately left free for attack at 0A.7), and a large round **on-screen button** in
the bottom-right for the right thumb. Because the placeholder art cannot animate, the dodge reads
through colour and a squash while the invulnerability window is open.

### Decisions

- **Invulnerability opens immediately** and covers most of the burst, rather than sitting in a
  tight band near its middle. PLAN §11 requires anticipation over reaction: a five-year-old who
  presses dodge as the wind-up plays should be rewarded. Mastery comes later from spacing and
  cooldown management, never from a narrower window.
- **Presses are queued for 220 ms.** Pressing dodge slightly early — mid-burst or during the
  cooldown — still fires rather than being silently dropped. That forgiveness is precisely what
  "without twitch-level timing" in the acceptance criterion asks for. Stale presses are dropped
  rather than firing late, which would feel like the game acting on its own.
- **Idle dodge steps backwards**, away from facing, because "get out of the way" means away from
  the thing attacking you.
- **A dodge is committed**: it ignores steering once started, but it never passes through a wall —
  it goes through the same `stepMovement` as walking, at burst speed.

### Learned

- **The environment could not run the game this session.** `requestAnimationFrame` fired **0 times
  in 800 ms** with `visibilityState: "visible"` — the Browser pane was hidden, so the page never
  composited and Babylon's render loop never ticked. Movement (working since 0A.5) was equally
  frozen, which is what proved it was the environment rather than the new code.
- The useful response was to move logic somewhere testable rather than to claim an unverified pass.
  The press-queue rules were extracted into a pure `actionLatch.ts` and unit-tested, and a
  `dodgeMovement` integration test now drives dodge and movement together the way the frame loop
  does — covering burst distance, wall blocking at burst speed, no chaining before the cooldown,
  and identical results at 30 fps and 240 fps.

### Known issues / notes for later

- **Unverified by eye:** the button → latch → player path, the colour/squash cue, and how the
  dodge actually _feels_. Feel is the whole point of this task, so it needs a real device.
- **The acceptance criterion cannot be closed yet.** "Reliably dodge the test enemy's telegraphed
  attack" needs the enemy from 0A.8. What 0A.6 delivers is the mechanic; whether it defeats a real
  attack is verified there.
- Nothing reads `isInvulnerable` yet — damage arrives at 0A.8. The window exists now because it is
  what makes a dodge a dodge rather than a teleport, and assist (0A.7) will widen it.
- A dodge travels a shade under its configured 3 m, because the frame that ends the burst no longer
  moves. Within one frame's worth; not worth special-casing.
- Constant burst speed, no ease-out. Easing would likely feel better and belongs in the 0A.9 feel
  pass, once it can be judged on a device.

### Next approved task

**0A.7 — Hammer timing mechanic** (hold/release GOOD/GREAT/PERFECT), which also carries the
**assist toggle** required before Kid Test 0. Not started.

---

## 2026-08-28 — 0A.7 Hammer timing mechanic (+ assist)

**Outcome:** PASS. `pnpm check` green — format, lint, typecheck, **137 tests**, production build.
Verified live in the browser: grades, assist, dodge-cancel and the touch button all behave.

**This completes the build work for Stage 0A-1.** What remains before Kid Test 0 is 0A.8 (one
enemy), 0A.9 (feel pass), 0A.10 (debug overlay + in-page console) and 0A.11 (publish to a URL).

### What was built

`attack.ts` in **game-core** — the hammer's charge-and-release state machine
(`idle → charging → recovering`), the timing bands, and the grade table. It lives there because
PLAN §4 makes the grade a _bounded client claim_: the client says "that was a PERFECT" and the
server clamps the bonus to `gradeBonus`, so both sides must share the numbers.

The mechanic as tuned: a **1.2 s** charge, with the sweet spot at **75 %** of it. PERFECT is a
**280 ms** band, GREAT the **500 ms** band containing it, and everything else — including an
instant release — is still a hit. Holding past the window is GOOD: the meter **caps rather than
auto-firing**, because a game that swings on its own teaches nothing about timing.

**Assist** (PLAN §11, required before Kid Test 0) arrived as `assistFromLocation()`: a local
`?assist=1` toggle, since accounts do not exist yet. It multiplies the _widths_ of PERFECT and
GREAT by 1.6 and never touches the success floor. Verified live: the same 680 ms release grades
GREAT unassisted and PERFECT assisted, while the sweet spot itself does not move.

Wired through every input: **J/K** on keyboard, **A/cross** on a gamepad (reserved for it since
0A.6), and an on-screen **Löök** button beside the dodge button. The charge meter draws the bands
on the track rather than hiding them — an invisible window would make this a reaction test, which
PLAN §11 forbids — and because it renders from the same numbers, an assisted child simply sees a
bigger target with nothing announcing the setting.

### Decisions

- **Dodging cancels a wind-up.** That is what gives the dodge a defensive role: escaping costs you
  the swing you were charging. Verified live — charge went to `idle`, and the release produced no
  grade.
- **Charging slows movement to 45 %.** A judgement call, flagged as such: a charge that costs
  nothing is strictly better than not charging, which removes the decision entirely. Tunable in
  the 0A.9 feel pass, and easy to veto.
- **Grade reads on more than one channel** — colour and shape, on the character and the meter —
  because the roadmap forbids relying on text alone. Audio is 0A.9's job.
- **The charge meter is imperative DOM**, like the joystick: it updates every frame, and
  reconciling the Preact HUD at 60 fps on a phone would waste the budget.

### Learned

- **The same `setPointerCapture` bug reappeared**, this time on the attack button. It throws
  `NotFoundError` when the pointer is already gone, and the throw aborted the handler _before_
  `setTouchAttack(true)` ran — so the button charged after release and stuck on `pointercancel`.
  Having now cost time twice, the fix was structural rather than local: `pointerCapture.ts` wraps
  both capture and release, documents the rule (**state first, capture second**), and is used by
  the joystick and the button alike. `onLostPointerCapture` also now releases the charge.
- The browser could run the game again this session (RAF ~120 fps), unlike during 0A.6. The
  difference is whether the Browser pane is displayed; a hidden pane suspends
  `requestAnimationFrame` entirely and no amount of code will tick.
- Console errors survive navigation in this tooling, so "is this error current?" is answered by
  a fresh tab, not by reloading. Third time this has come up — worth remembering.

### Known issues / notes for later

- **`pointercancel` swings** rather than abandoning the charge. It no longer sticks, which was the
  bug, but whether a stolen pointer should fire the hammer is a real question for the feel pass.
- The 1.2 s charge and 75 % centre are **first guesses**. They are the numbers most likely to move
  once a child actually holds the button, and they are the whole subject of Kid Test 0.
- Nothing consumes `gradeBonus` yet — damage arrives with the enemy at 0A.8.
- The readout polls at 5 Hz, so mid-swing values in it lag reality. Fine for debugging; not a bug.

### Next approved task

**0A.8 — One enemy** (idle → pursue → wind-up → attack → recover → death), which finally lets
0A.6's acceptance criterion be closed: dodging a real telegraphed attack. Not started.

---

## 2026-08-28 — 0A.7 revised: tap for combos, hold for strength

**Outcome:** PASS. `pnpm check` green — format, lint, typecheck, **147 tests**, production build.
Verified live in the browser.

### Why it changed

The first cut made every attack a ~1.2 s hold, which felt sluggish: there was no fast option at
all. The direction given was that taps should produce quick combos and holding should give
strength — the bow being the obvious later example of the same split.

So the hammer is now **one button with two modes**, and PLAN §11 and roadmap 0A.7 were rewritten
to match rather than being left to contradict the code.

### What it is now

- **Tap** (under 180 ms) → a quick light hit that **chains**: 1 → 2 → finisher, with a 0.55 s
  rhythm window and a short 0.18 s recovery so taps actually flow. Light hits are individually
  weaker than any heavy swing; taps buy speed and safety, not power.
- **Hold** → the charge meter fills in **0.85 s** (down from 1.2 s) with the sweet spot around
  60 %. PERFECT is a 260 ms band, GREAT the 440 ms around it, and everything else — too early _or_
  overcharged — is GOOD. Heavy swings outhit the whole light chain and pay a 0.4 s recovery.

The charge meter now only appears once a press passes the tap threshold, so a tap does not flash
it, and the movement slow only applies to a real charge rather than to every press.

### Learned — two real bugs the new tests caught

Both were design faults, not typos, and both would have quietly hurt the youngest player:

1. **The combo timer ran while the button was held.** Between the 0.55 s window, the 0.18 s
   recovery and up to 0.18 s of hold, the real slack between taps collapsed to about 0.19 s —
   far too tight for a five-year-old. The clock now **stops while a press is held**: a player who
   has already pressed has committed to the next hit and should not be punished for holding a
   fraction too long.
2. **Assist made "hold forever" the optimal strategy.** Widening GREAT by 1.6× pushed its end past
   the end of the meter, so an assisted player could never overcharge and always got at least
   GREAT by simply holding. That destroys the mechanic for precisely the child assist exists to
   help. There is now a `minOverchargeSeconds` floor: bands are clamped so overcharging stays a
   real mistake at every assist level.

### Verified in the browser

Three taps in rhythm chained `light 1 → light 2 → light 3` with the meter correctly hidden
throughout; pausing dropped the chain to 0 and the next tap restarted at 1. On the hold path:
60 ms → `light 1`, 260 ms → `heavy good` (too early), 530 ms → `heavy perfect`, 900 ms →
`heavy good` (overcharged, meter capped). Console clean.

### Known issues / notes for later

- The numbers are still first guesses — tap threshold, combo window and charge length are exactly
  what Kid Test 0 exists to challenge.
- Combos are **not** graded on rhythm; they either chain or they do not. PLAN §11 reserves "timed
  combo" for the sword, so keeping the hammer's chain ungraded also keeps the two families
  distinct. Worth revisiting only if the chain feels flat.
- Nothing consumes `power` yet — damage arrives with the enemy at 0A.8.

### Next approved task

**0A.8 — One enemy.** Unchanged.

---

## 2026-09-02 — 0A.8 One enemy

**Outcome:** PASS on the rules; **the live fight is unverified by eye** (see below). `pnpm check`
green — format, lint, typecheck, **197 tests**, production build.

**This completes the last build task of Stage 0A-1's combat.** Remaining before Kid Test 0:
0A.9 (feel pass), 0A.10 (debug overlay + in-page console), 0A.11 (publish to a URL).

### What was built

`combat.ts` and `enemy.ts` in **game-core** — health, the melee arc, and the enemy state machine
(`idle → pursue → windUp → strike → recover`, plus `dead`). Both belong there because PLAN §4 puts
damage results under strict server authority and PLAN §5 has the server simulating monsters: the
client may say "I swung", never "the enemy died".

The enemy is a state machine, not AI. Everything hard about it is in the timings. Three properties
keep it fair, and are **asserted as tests rather than left to good intentions**: it is slower than
the player, its wind-up is more than three times a dodge, and it **locks its facing when the
wind-up begins** so sidestepping beats it.

The client draws the telegraph on three channels, because a wind-up a five-year-old cannot read is
the same as no wind-up: the body **rears up** (silhouette), turns **red** (colour), and a **ring
appears on the ground** at exactly the swing's reach (position). PLAN §11 requires shape-coding as
well as colour-coding, so a colourblind child reads the same fight.

Also added: player health with **mercy frames** after a hit (without them, standing in the enemy
drains the bar before the child sees what happened), a defeat-and-get-back-up placeholder, enemy
respawn a few seconds after death so the fight can be had again, and health shown as **countable
pips rather than a number** — the youngest cannot read, so "how alive am I" must never be text.

`power` from 0A.7 is finally consumed: damage is `HAMMER.baseDamage × power`, so a heavy PERFECT
kills in about four swings and the light chain in about seven.

### The fight, proven end to end

Since the browser could not run the game this session, the loop is verified by simulation instead —
`fight.test.ts` plays the whole thing against the real rules with a deliberately naive policy
("dodge when it telegraphs, otherwise close in and hit it on the sweet spot"). A player following
that instinct **takes zero damage and kills the enemy in a handful of swings**, while a player who
never dodges is punished. That is the roadmap's acceptance criterion — _read → dodge →
counterattack → time the hammer_ — demonstrated rather than asserted.

### Learned — the dodge defends with distance, not invulnerability

The first three versions of that test failed, and each failure was informative rather than a typo:

1. **Backing into a wall.** The 6×4 fixture pinned the player against a wall, so dodging "away"
   moved them nowhere. Which exposed the real rule: **i-frames (0.18 s) cannot cover a 0.9 s
   wind-up**, so an early dodge only saves you because it _displaces_ you.
2. **Retreating is a losing instinct.** In an open arena, always dodging backwards still failed —
   two dodges put the player against the far wall. The enemy locks its facing precisely so
   **sidestepping** is the answer; that is the play the design rewards.
3. **Sidestepping alone wins but never kills.** It leaves the player ~3 m away while the hammer
   reaches 2.2 m, so the policy had to learn to close the distance — which is what a real player
   does between swings.

The wall case is kept as a test in its own right. It is positionally fair, but **a five-year-old
ends up in corners constantly**, so it is recorded as a Kid Test 0 question rather than quietly
accepted.

### Known issues / notes for later

- **Unverified by eye:** the telegraph's readability, whether the ring reads as "get out", and
  whether any of it feels good. The environment's Browser pane was not compositing, so
  `requestAnimationFrame` never fired and the enemy could not move. The UI mounts and the console
  is clean, but that is not the same as watching a fight.
- **Cornered dodges do not protect.** See above — the sharpest open design question here.
- The client's _idle_ dodge still steps backwards, which is the instinct the tests show is weaker.
  Leaving it: a child holding a direction dodges that way anyway, and changing the fallback to
  sideways would be guessing ahead of the playtest.
- All numbers — enemy health, damage, wind-up, recovery — are first guesses in one config block.
- One enemy, hard-coded to the region's `enemy-spawn`. The second spawn in the test arena is unused;
  a second enemy is not in 0A.8's scope.

### Next approved task

**0A.9 — Feel pass**: hit stop, impact sound, screen shake, charge audio. The first task where
audio arrives, and the one that will make the fight land.

---

## 2026-09-02 — 0A.9 Feel pass

**Outcome:** PASS on the build; **none of it verified by eye or ear** (see below). `pnpm check`
green — format, lint, typecheck, **206 tests**, production build.

### What was built

All seven items the roadmap lists, kept cheap:

- **Hit stop** — a 30–100 ms freeze scaled by how good the swing was, 120 ms on a kill. The single
  highest-value piece of feel here: it is what makes a hammer land like a hammer rather than like a
  number changing.
- **Impact sound** — five distinct swing voices, so a PERFECT is audibly different from a tap.
- **Screen shake** — 0.05–0.3 m of camera nudge, hard-capped and fast-decaying.
- **Damage flash** — the enemy flashes white on any hit, overriding its phase colour so a blow
  landing mid-wind-up still reads.
- **Particles** — a pooled spark burst at the point of impact, sized by the swing.
- **Enemy defeat** — the one moment deliberately over-sold: longest freeze, biggest shake, full
  burst, descending tone.
- **Charge audio** — a rising tone that tracks the meter and **chimes when the sweet spot opens**,
  so the timing can be _heard_ while the child is watching the enemy rather than the HUD.

### Decisions

- **All audio is synthesised, not sampled.** `assets/ATTRIBUTION.md` is still empty and no pack has
  been licence-reviewed, so procedural WebAudio means zero assets, zero attribution debt and zero
  bytes to download before the first hit. A proving toy needs _timing_ feedback far more than good
  samples; real SFX replace these with the art pass. The particle texture is drawn in code for the
  same reason.
- **Audio unlocks on the first gesture and resumes on `visibilitychange`.** Both are required on
  iOS (PLAN §27), and the second matters because a phone locking mid-session is the normal case
  (PLAN §6). Missing WebAudio entirely is handled: the game simply plays in silence.
- **Hit stop is client-only, and capped.** It scales the simulation delta, and the server will
  never freeze — so `MAX_FREEZE_SECONDS` (0.12 s) keeps a frozen client from drifting far enough to
  trip the server's displacement check at Stage 0B. Overlapping freezes take the longest rather
  than summing, so three fast hits stay punchy instead of becoming a stall. **It must never grow
  into slow motion.**
- **Only a hit that actually lands gets feedback.** A dodged swing produces nothing, because
  nothing happened — the silence is the reward.

### Learned

- A freeze consumed in 1/60 s frames leaves floating-point crumbs: 0.1 s ends at about 1e-17 s
  remaining, which counted as an extra frozen frame. Harmless in effect, but it is the kind of
  residue that becomes a real bug once something else reads `isFrozen()`, so remainders now snap to
  zero. The failing test was my arithmetic; the snap is the fix worth keeping.

### Known issues / notes for later

- **Nothing here was seen or heard.** The Browser pane was not compositing again, so
  `requestAnimationFrame` never fired, the frame loop never ran, and not one sound, spark or freeze
  was exercised. The page loads clean with no console errors and the production build succeeds —
  that is all this session can honestly claim. **Feel is the entire point of this task, so it needs
  a real device before Kid Test 0.**
- **Bundle is now ~1.21 MB raw / ~294 kB gzipped**, up from ~1.07 MB / ~263 kB. Particles are most
  of that. Still fine, but the 4G cold-load budget is a real 0A-2 measurement and this is the third
  increase in a row.
- All timings — freeze lengths, shake magnitudes, tone choices — are first guesses tuned by
  reasoning, not by listening. Expect to change them once heard.
- No mute control. Worth adding before Kid Test 0 if a sibling is trying to sleep.

### Next approved task

**0A.10 — Debug overlay and in-page console.** Small, and the one that makes the remaining device
testing possible at all: there is no iOS Safari console from a Windows machine.

---

## 2026-09-02 — 0A.10 Debug overlay and in-page console

**Outcome:** PASS, and unusually well verified for once — the panel is DOM, so it works without a
render loop. `pnpm check` green — format, lint, typecheck, **213 tests**, production build.

### What was built

**The readout is now hidden by default.** That turned out to be the more important half of this
task: it had been permanently on screen since 0A.2, and a wall of numbers is the last thing a child
should see at Kid Test 0. What remains visible is only the game — hearts, joystick, the two action
buttons, the charge meter.

Three ways in, because the phone where things go wrong has neither a keyboard nor a URL bar worth
typing into:

- **four quick taps in the top-left corner** — the one that matters on a phone;
- `?debug=1`;
- `F8` or backtick on a laptop.

The tap target is a real element rather than a canvas gesture, so its taps are swallowed by the
overlay and never leak through to the joystick underneath.

The panel gained what it was missing: **FPS and frame time**, the camera configuration, and device
information — Babylon's reported API, the GPU renderer string, DPR and user agent. Plus
**viewport → backbuffer**, which is not decoration: a mismatch between those two numbers _was_ the
0A.1 bug, where the backbuffer stuck at 300×150 and was stretched across the screen. Having both on
the device turns that class of bug into a glance.

**The in-page console (eruda)** sits behind a button in the panel. iOS Safari's Web Inspector needs
macOS and this machine is Windows, so without it there is no console, no stack trace and no network
panel on the iPhone the children actually use.

### Decisions

- **The console is lazy-loaded**, and this matters more than it sounds: it builds as a **separate
  491 kB (151 kB gzipped) chunk**, and the main bundle grew by only 1.2 kB. A child playing the
  game never downloads it; it is fetched the first time someone opens the debug tools. That keeps
  it viable on the published build (0A.11), which is exactly where a phone console earns its keep.
- **Four taps within a rolling window**, not a long-press or a triple-tap: deliberate enough that
  nobody finds it by accident, simple enough to do one-handed while the game is misbehaving. A
  pause resets the run, so idle prodding never accumulates into an activation.
- **A failed console load must never take the game down.** It warns and returns false.
- The panel **stops polling entirely while hidden**, so the diagnostic UI costs nothing during
  normal play.

### Verified in the browser

Hidden on load; three taps do nothing; the fourth reveals it; four more hide it again — with the
hearts unaffected throughout. `?debug=1` opens it directly. The panel reports
`60 fps`, `900×420 → 900×420`, `55° · 12 m`, `WebGL2`, `ANGLE (NVIDIA … RTX 4070 …)`. Pressing the
console button **loaded eruda and mounted it in the DOM**. Console clean.

### Known issues / notes for later

- FPS reads Babylon's default 60 with a 0.0 ms frame time here, because the automation pane still
  is not compositing and no frames are running. On a real device it reports real numbers — and that
  is precisely what 0A-2's device baseline needs.
- `window.screen` reported 0×0 in automation, which is why the panel reports the **viewport** and
  **backbuffer** instead. More useful anyway.
- eruda's bundle triggers a Vite warning about a direct `eval` inside its own code. It is a
  development tool loaded on demand, not shipped into the play path, so this is accepted rather
  than worked around.
- The debug handle sits in the top-left, over nothing. If a later HUD wants that corner, the handle
  moves rather than the HUD.

### Next approved task

**0A.11 — Publish the toy to a static URL.** The last build task before Kid Test 0, and the one
that makes the second sitting — "do they come back to it unprompted?" — possible at all.

---

## 2026-09-02 — Code review of Stage 0A-1, and fixes

**Outcome:** nine findings, all fixed. `pnpm check` green — format, lint, typecheck, **213 tests**,
production build.

A full review of the working tree before publishing. Worth noting the review had to cover
_everything_ rather than a diff, because the repository still has no commits — the first commit
would let every later review be scoped to what actually changed.

### The two that mattered

1. **A controller-only player got no audio at all.** The unlock listened for `pointerdown` and
   `keydown`, and a gamepad button is not user activation in any browser, so the AudioContext
   stayed suspended forever with no error to explain it. Gamepad support is an explicit
   requirement (ADR 0006), so this was a supported configuration silently broken. Fixed with a
   `gamepadconnected` listener plus a self-throttling `tryUnlock()` that the frame loop calls while
   gamepad input is active and audio is not yet running.
2. **The dodge whoosh played twice, every time.** The trigger compared the dodge clock against
   `deltaSeconds * 2`, which is true on the first _two_ frames — and, inversely, false for a dodge
   begun during hit stop, which played nothing. Both symptoms had the same cause: inferring a state
   transition from a clock. The player now reports `dodgeStarted` on the frame the dodge actually
   begins, and the sound follows the transition rather than guessing at it.

### The rest

3. **`ENEMY.deathSeconds` was never read.** It documented a corpse-lingering pause that does not
   exist — the body waits `respawnSeconds`. Deleted rather than implemented: a constant that looks
   like it controls a timing and does not is worse than no constant, and nothing needs a separate
   vanish phase.
4. **Holding attack through a defeat left the button dead.** The defeated early-return skipped the
   edge update, so a child who never let go found nothing happened until they released and pressed
   again. Respawn now clears the edge, so a held button resumes charging.
5. **Losing window focus mid-charge fired a swing.** Clearing held keys on blur is necessary, but
   it looked exactly like a deliberate release. The keyboard now reports the focus loss and the
   player _cancels_ the wind-up, as dodging already did.
6. **Player hit sparks ignored elevation**, spawning at ankle height on the raised platform. Now
   derived from the terrain, like the enemy's already were.
7. **`swingSound` took loose strings**, so adding a grade or weapon kind — five families are
   planned — would have silently fallen through to the plainest sound. Typed against `AttackSwing`
   so it fails to compile instead.
8. **Two impacts in one frame lost one burst**, exactly at the dramatic moment both matter.
   Particle counts now accumulate within a frame and reset after it, with the strongest impact
   owning the emitter position.
9. `isInPageConsoleVisible` was exported with no callers. Deleted.

### Verified

The audio lifecycle, which is event-driven and so testable without a frame loop: no AudioContext
exists before a gesture (correct — iOS requires exactly that), precisely one is created on the
first key press, and `gamepadconnected` does not create a duplicate.

Everything else is frame-driven and the automation pane was not compositing again, so fixes 2, 4,
5, 6 and 8 are verified by construction and by the existing tests, **not by eye**. Adds to the
growing list of things the device pass has to confirm.

### Clean on inspection

Grid and coordinate maths including round-trips, negative coordinates and wall clamping;
`parseRegion`'s validation paths including degenerate rows; the attack, dodge and enemy state
machines' transitions and frame-rate independence; `angleDifference` across the ±π seam; the
hit-stop cap and its relationship to the server's future displacement check; engine resize and
disposal; and the enemy health-bar geometry — though its left-anchored fill relies on the camera
staying fixed, which ADR 0005 now guarantees.

## 2026-09-03 — 0A.11 deployment prepared; **not complete**

The repository is ready to publish and everything that does not require the host is done.
The deployment itself is blocked: there is no way to authenticate to KOCorp from here.

### The commits that did not exist before today

The project had **no git history at all** — 94 files, every ADR, every test, both specification
documents, untracked on one Windows disk. That was the largest standing risk in the project and
it is now closed:

- `7fdf242` — the Stage 0A-1 prototype through 0A.10, as the known-good baseline.
- `995c695` — the deployment, the version marker and the tsconfig split.
- `c20ff7b` — records the exec bit on `deploy.sh`, which `core.filemode=false` had dropped.

Still local only: no git remote is configured, so **push remains outstanding**.

### Deployment shape

`deploy/stage0a/` holds a multi-stage Dockerfile (node builder → `nginx-unprivileged`; the runtime
image carries no Node, pnpm, source or dev dependencies), an nginx config, a compose service, a
deploy script and a runbook. Three decisions are worth keeping:

1. **Reuse the existing tunnel.** `kocorp-harjutaja` is healthy and already publishes `harjutaja`,
   `fotod` and `male`. A fourth published-application route is additive and reversible; a second
   `cloudflared` container would be more moving parts serving one static page.
2. **Route to a host port, not a container name.** `http://adventure-web:8080` would be tidier but
   requires attaching the production `cloudflared` to `adventure-net` — restructuring a tunnel
   three other applications depend on, to save one port. Two of its three existing routes already
   point at `192.168.1.133:<port>`. Port **8091**, after checking 8080, 8085, 8090 and 3000 were
   taken.
3. **No Content-Security-Policy.** Babylon compiles effects at runtime and eruda uses direct eval —
   the production build warns about exactly that. A policy strict enough to be worth having would
   break either the renderer or the only console this project has on iOS. `nosniff`,
   `Referrer-Policy` and a narrow `Permissions-Policy` are set; the policy deliberately does not
   name `gamepad`, whose default allowlist is `self` (ADR 0006 requires controllers to work).

Cache split: `/assets/` is fingerprinted by Vite and immutable for a year; `index.html` is always
revalidated. A child stuck on last week's bundle is a bug report that costs an evening.

### Build identity

The published bundle now says which build it is, in two places, neither of them child-facing: the
first row of the hidden debug overlay, and a `console.info` at boot so the in-page console reports
it even when the game never renders — which is exactly the case where it matters. The SHA and build
time are injected by `vite.config.ts` from `BUILD_SHA`/`BUILD_TIME`, falling back to git locally,
and a build from an unclean tree is marked `+dirty`. Verified in the production bundle: it contained
`7fdf24200ea3+dirty`, correctly flagging the then-uncommitted deployment work.

That config now uses node APIs, so it type-checks under its own `tsconfig.node.json`. Client source
keeps `types: ["vite/client"]` only — reaching for `process` in browser code should fail to compile.

### Why it stopped

KOCorp is reachable (`kocorp` = 192.168.1.133, SSH open, `publickey` offered) but nothing here can
authenticate to it: no SSH key installed, no agent, and the Unraid web session had expired in both
browsers on the development machine. A deploy key was generated and is waiting to be installed:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICNP73AjJJZeW0LblPYO4hJbSaSKg0jHFIKD/QbJZUtd claude-code-deploy@kiuri-mang
```

Once one line lands in `/boot/config/ssh/root.pubkeys` and `/root/.ssh/authorized_keys`, the rest is
`deploy/stage0a/README.md` end to end.

`realm.orgusaar.ee` does not resolve yet (NXDOMAIN), so nothing is half-published and there is
nothing to undo. The apex `orgusaar.ee` points at 217.146.69.39 and is unrelated — it must not be
touched.

**0A.11 is not complete, and Kid Test 0 cannot start until it is.**

## 2026-09-03 — 0A.11 complete: live at https://realm.orgusaar.ee

The toy is published. Deployed commit **`ee23b7e1e5eb`**, image `adventure-web:ee23b7e1e5eb`
(64.5 MB), container `adventure-web` on network `adventure-net`, origin
`http://192.168.1.133:8091`, reached through the existing `kocorp-harjutaja` tunnel.

**Stage 0A-1 is complete. The next thing that happens is children playing it.**

### Verified on the public URL, not merely deployed

HTTP 200 with a valid Let's Encrypt certificate and no redirects; `index.html` revalidated
(`Cache-Control: no-cache`) while hashed assets carry `immutable`; the 1.2 MB bundle arrives as
294 kB over the wire; a missing asset 404s while an unknown path falls back to the app, so a
broken deploy cannot masquerade as a working one; `nosniff`, `Referrer-Policy` and
`Permissions-Policy` survive the tunnel.

The live bundle contains `ee23b7e1e5eb` with no `+dirty` suffix — what the children load traces
to a clean commit. It survived a restart of that container alone; the other 30 KOCorp services
were never touched.

`/Main` and `/login` return the game, not Unraid: the SPA fallback answers every path, and the
tunnel route reaches only this container. No admin surface, no database port and no Docker socket
are exposed anywhere along the path.

### What the first real deploy taught

`deploy.sh` exited 1 _after_ deploying correctly — `ADVENTURE_IMAGE` was prefixed onto the `up`
command, so the `ps` that reports the result could not interpolate the compose file. The image,
network and container were all created; only the report failed. Exported now (`5cd82df`). A
deployment script that lies about its own outcome is worse than one that fails loudly.

Also worth recording: `core.filemode=false` on Windows silently dropped the exec bit on
`deploy.sh`, and the Vite config's move to node APIs needed its own tsconfig so that client source
keeps no route to `process`.

### Still true, and now testable

Everything on the "verified by reasoning, not by eye" list from 0A.8–0A.10 — telegraph
readability, the danger ring, audio, hit stop, the tap-vs-hold threshold, camera zoom, the
cornered-dodge sharp edge — is unchanged. It was never resolvable in an automation pane. It is
resolvable now, on a phone, which is exactly what Kid Test 0 is for.

Open items carried forward: the repository still has **no git remote**, so five commits on one
Windows disk remain the only copy; and there is no mute control, which one sitting with a
five-year-old may well demand.

## 2026-09-03 — Adult playtest readability iteration

An adult played the published build on an iPhone. The half of the toy that was
about _moving_ came back well — dynamic joystick preferred, speed and
responsiveness good, dodge working, no corner or wall problem, obstacles
readable, controls not in the way, wind-up noticeable, quick to load, good
performance, and the tester voluntarily replaying fights to improve. That last
one is the only unprompted signal that matters at this stage, and it was there.

The half about _reading_ the combat mostly failed. This iteration is a response
to that list, and to nothing else.

### Three findings that had causes, not opinions

1. **There was no hammer.** The player was a box; an attack was a brief change of
   its colour and scale. "Could not tell the tap attack worked" and "did not feel
   like a hammer" were the same bug seen twice. There is now a real weapon on a
   real arc — it lifts the instant the button goes down, cocks back behind the
   shoulder as the charge fills, and comes down through an overhead chop that
   passes above the player's head on the way. Weight comes from the timing of
   that arc, not from slowing the game down.
2. **The health pips never changed during play.** They were fed by the debug
   overlay's poll, which only runs while that overlay is open. "Could not tell I
   was losing health" was not a presentation problem: the number on screen was
   frozen unless a developer happened to have the readout showing. Health has its
   own always-on poll now, and the pips are 34 px rather than 20 px.
3. **The danger circle was a lie.** The enemy's swing is frontal — 55° either
   side — and it locks its facing at the wind-up, so sidestepping beats it. A
   full circle said "everything in here is dangerous", which told the player
   nothing about how to respond and was not true. It is now a wedge built from
   the same two constants `isWithinMeleeArc` uses to decide the hit, and
   `readability.test.ts` fails if those two ever disagree.

### Timing, slowed enough to be seen

|                | was    | now        |
| -------------- | ------ | ---------- |
| Charge         | 0.85 s | **1.5 s**  |
| PERFECT band   | 0.26 s | **0.34 s** |
| GREAT band     | 0.44 s | **0.70 s** |
| Tap threshold  | 0.18 s | **0.22 s** |
| Light recovery | 0.18 s | **0.28 s** |
| Charging speed | 0.45×  | **0.65×**  |
| Enemy recovery | 1.0 s  | **1.5 s**  |

The roadmap permits lengthening the charge for readability and forbids
shortening it; a mechanic nobody can see is not a difficulty setting.

The enemy's recovery was not a balance decision. The slower hammer made a
counterattack take longer than the window meant to contain it, and the existing
fairness tests caught exactly that — the counter window would have become a
window you cannot finish an attack inside. A green disc now closes over it, so
both the opening and its ending are visible.

A charged hit lands about four times a tap, rather than one and a half times.
"The charged hit felt similar to an ordinary attack" was arithmetically true.

### Where the timing mechanic actually lives now

Not in the meter. The **hammer head brightens in GREAT and flares white at
PERFECT**, so the sweet spot can be learned while watching the enemy — which is
where a fighting child is looking. The meter still exists, moved to the bottom
centre at nearly twice the size, with a travelling head and a PERFECT band drawn
taller than the track so shape distinguishes it and not colour alone. Both are
keyed to the same seconds, so they cannot disagree.

Grades also differ in **kind** and not only degree: only a heavy swing draws a
ground shockwave, and how far it travels says how well it was timed. Every
previous channel was a matter of degree, which is invisible without a
side-by-side comparison the player never gets.

### Audio on iPhone

Most likely cause, and it is invisible from any log: **iOS routes WebAudio
through the "ambient" audio session, which the ring/silent switch mutes.** The
context reports `running`, every node plays, and nothing is heard. The unlock now
claims `navigator.audioSession.type = 'playback'` where Safari supports it,
listens in the **capture** phase across five gesture types so a control that
stops propagation cannot break it, plays a silent priming buffer inside the
gesture, and handles bfcache restores as well as visibility changes.

The debug overlay reports context state, unlocked, _what_ unlocked it, and the
session category — four facts, because "no sound" has four different causes and
they need different fixes. Confirmed in the browser: the capture-phase listener
records `keydown` as the unlock. **The mute-switch behaviour itself is not
verified** — it needs the phone, and both the switch position and the result
should be written down when it is.

### Verified by geometry, since it could not be verified by eye

The automation pane composited for two screenshots — long enough to confirm the
closer camera, the hammer on the player, the larger hearts, the smaller buttons
and the audio readout — and then stopped driving `requestAnimationFrame`, as it
has all through this project.

So the swing is pinned by `hammer.test.ts`, which drives the real attack state
machine through a headless `NullEngine` and checks where the head actually goes:
above the player at rest, behind and low when cocked, more than a metre higher
at the peak of the arc, past 0.8 m in front during the strike, never below the
floor, and back to rest when spent. It earned its place immediately by catching
that my own comment described the wind-up backwards — I had written "overhead
and behind" for a pose that is behind and _low_.

### UI

Action buttons draw at 68 px with the touch target kept at 96 px by an invisible
ring, so the screen is less covered without making the targets small. Hearts
enlarged and animated. A screen-edge flash on damage plus a stagger on the body,
with camera shake _reduced_ from 0.22 to 0.14 — shake big enough to notice is
also big enough to disturb steering with the other thumb. Portrait notice is now
`Pööra seadet` above an inline rotate diagram, since most of the players cannot
read.

### Deliberately not done

The tester found fighting one enemy repetitive and wanted another. That is the
expected result and not a problem to solve here: one enemy exists to prove the
combat vocabulary, and Kid Test 0 asks whether that vocabulary is legible.
Sprint, jump and dash remain notes. Nothing was added.

### Deployed

Commit `6545df67a975`. **249 tests** (165 game-core + 84 client), `pnpm check`
green.

### Still open

The mute-switch question above; whether the closer camera is close enough;
whether the tap threshold at 0.22 s suits a five-year-old's press; and every
feel judgement in this entry, all of which are now answerable on a phone rather
than by argument.

## 2026-09-03 — Phone follow-up: browser zoom, and losing the URL bar

Two things reported straight off the phone after the readability build went out.

### A mistap zoomed the page, and there was no way back

The viewport meta tag looked like it handled this and did not. **iOS Safari has
ignored `user-scalable=no` and `maximum-scale` since iOS 10**, so that line is
decoration on iOS — worth knowing before trusting it again. What actually
governs zoom is two separate mechanisms:

- **double-tap** is `touch-action`, which is **not an inherited property**. It
  was set on the canvas and the two action buttons, so a tap landing anywhere
  else — the debug corner, a heart, the overlay — got the browser default. Now
  set across the whole `#app` subtree.
- **pinch** is only preventable through Safari's non-standard `gesturestart` /
  `gesturechange` / `gestureend`, which `input/preventZoom.ts` cancels.

The trap afterwards was the fixed layout: with nothing scrollable there was
nothing to pinch back out with, so the only escape was rotating the phone twice.

**Not done, deliberately:** cancelling multi-touch `touchmove`, which is the
usual advice. Steering with one thumb while attacking with the other _is_ a
two-finger gesture, and cancelling those touches takes the pointer events with
them — it would trade a zoom bug for an unplayable game.

The guard is scoped to `#app` so the in-page console, which attaches to `body`,
stays pinchable and scrollable. On a phone that is sometimes the only way to
read it. The debug readout also gained a `max-height` and its own scrolling: it
had quietly grown taller than a phone held sideways.

### The URL bar

It cannot be removed from inside Safari — there is no API, and the fullscreen
API does not apply to arbitrary elements on iPhone. **Add to Home Screen** is the
only route, and the meta tags for it were already present. What was missing was
any reason to use it: an install took a screenshot of a dark canvas as its icon.

There is now a generated 180 px hammer icon and a short home-screen name. This
matters more than it looks for Kid Test 0: the second sitting asks whether they
come back _unprompted_, and an icon on a home screen is something a child can
find on their own. A URL is not.

Deployed `70db8a146a9f`. **254 tests** (165 game-core + 89 client).

One observation from verifying it: Cloudflare rewrites the icon's
`Cache-Control` to its own 4-hour browser TTL. `index.html` is unaffected and
still revalidates, which is the one that matters — checked directly rather than
assumed.

## 2026-09-03 — Stage 0A-2 begins: 0A.3 real character rig

Kid Test 0 was called complete by the parent. Recorded here as it stands: sitting
one happened and the toy worked; **sitting two — the unprompted return, which is
the actual gate — could not have happened yet**, since sitting one was the same
day. Written down because a gate the log says was passed, and a gate that was
passed, need to stay distinguishable later.

The boxes are gone. Both the player and the enemy are rigged GLB characters,
animated from the state the rules already track.

### The asset, and a substitution worth knowing about

**Kenney Blocky Characters 2.0** (CC0), not the pack originally chosen. The
_Animated Characters_ packs ship **FBX only** with idle/jump/run — no attack, and
no format Babylon loads without dragging in a conversion toolchain. Two of the
four things 0A.3 needs, missing. Blocky Characters ships GLB with 27 clips
including `attack-melee-right` and `holding-right`, at 113 kB per character, and
its 18 characters share one rig — so the "second visual variant" acceptance costs
one file copy, and the enemy needed no art pipeline of its own.

It is a **node rig, not a skinned mesh**: six body parts animated by transform.
Cheap on a phone, and it makes the hand socket an ordinary node — anything
parented to `arm-right` inherits the swing for free.

### Three things that would have shipped, caught by tests

1. **The GLBs do not embed their textures.** They reference files beside them, so
   the characters would have loaded untextured, with no error anywhere.
2. **The socket is a whole arm, and its origin is the shoulder.** The hammer
   floated above the character's head. The grip is now computed as the
   bottom-centre of the socket's own bounds, which holds for any humanoid rig.
3. **A prop authored in metres inherits the model's fitting scale**, so the
   hammer arrived shrunk into the asset's units until it divided that back out.

### Measured, never assumed

Height and standing position come from the model's bounding box, so placement
code says "stand here on the ground" and means it whatever the asset thought its
own origin and units were. That is not tidiness: the roadmap's stop condition for
this task is _replace the asset if it fights you_, so the asset will be swapped,
and a swap should not also be a hunt for two magic numbers.

**Which way the model faces was verified, not derived.** glTF is right-handed and
Babylon is not, so the loader inserts a mirrored `__root__` — which makes the
handedness argument unreliable on paper and puts the node named `arm-right` on
the visually opposite side. A screenshot from a 55° camera is no better; mostly
what you see is the top of the head. The measurement that settles it: face north,
play the melee clip, watch which way the arm travels. It reaches **+0.43 m
forward against a 0.34 m backswing**, so the π offset is right. The method is in
`docs/art-pipeline.md`, so the next swap is a thirty-second check.

### What else changed

Boot is asynchronous now, and logs loudly when a model fails to load: on a phone,
a black screen and an unhandled rejection look exactly like the game not working.
The tests moved into their own tsconfig so they can read files from disk while
client source keeps `types: ["vite/client"]` alone — reaching for `process` in
browser code should still fail to compile.

Colour still carries state, but as an emissive wash over a textured body rather
than a diffuse swap, and damage now flickers the character the way every game has
said "hit, and briefly safe" for forty years. That survives any texture, which a
colour swap does not.

### Cost

Bundle **1.22 → 1.48 MB** raw for the glTF loader, plus 227 kB of models and
34 kB of textures. Worth measuring properly at 0A.12 rather than worrying about
now.

**286 tests** (165 game-core + 121 client). Deployed `01d74df6fa90`.

### Still open

Whether the characters read well _in motion on a phone_ — the animation was
verified by driving the real state machine and measuring, and seen only in
desktop screenshots. **0A.12, the device baseline, is the remaining 0A-2 task**,
and the numbers it wants are exactly the ones this change makes interesting.

## 0A.13 — the arena was slow, and it was fill rate

The report was "extremely slow, unoptimized". Rather than guess, the scene was
asked what it contained. It answered **280 meshes, 96 materials, 76 of them
`PBRMaterial`, rendering at full device pixel ratio**.

Three separate problems, and the interesting part is that only one of them was
the one I would have guessed.

### The scenery was drawn one box at a time

Twenty-four props arrived as ~180 meshes, because the models carry a material
per _face_. Merged into a single mesh with a multi-material — 39 submeshes for
39 distinct materials, world matrices baked, `freezeWorldMatrix`,
`isPickable = false`, materials frozen. **280 → 75 meshes.**

The merge has one trap worth recording: the glTF loader inserts a `__root__`
node that is a `Mesh` with no vertices, and merging one of those fails on vertex
data that does not exist. Filtering to `getTotalVertices() > 0` is the fix, and
the on-screen failure panel from 0A.11 caught it on the first reload instead of
showing another grey rectangle.

### The suspect that was innocent

`foe.glb` carries **27 animation clips**, and the scene showed 25 animatables.
That looks damning. It is not: the 25 are the targeted animations of the single
clip that is playing, and the other 26 groups are stopped. Measuring took two
minutes and saved a day of optimising something that was already correct.

### The two that actually mattered, and both are fill rate

**Materials.** Every `.glb` loads as `PBRMaterial`, because that is what glTF
means. This art is flat-shaded boxes and 64-px nearest-sampled tiles under one
hemispheric light; the PBR shader spends an image-based lighting term, a BRDF
lookup and an energy-conservation pass to arrive at the flat colour the artist
drew. `flatMaterials.ts` swaps them for `StandardMaterial`, carrying albedo,
emissive, alpha and culling across, once per distinct material rather than once
per mesh. **76 PBR materials, 0 still drawn.** Duck-typed on `getClassName()`
rather than `instanceof`, so testing for PBR does not drag the PBR chunk into
the first-paint bundle.

**Pixels.** `createEngine` was constructed with `adaptToDeviceRatio: true` and a
comment admitting that whether we could afford full DPR was a measurement still
to be made. This is that answer: we cannot. A phone reports ratio 3, so a
375×812 screen is 2.7 M pixels — **nine times** the same layout at 1× — and
every one runs the fragment shader. `renderScale.ts` imposes a ratio cap of 2
and a 1.4 M pixel budget, tighter wins, never below 1×, recomputed on resize
because the budget depends on the canvas' current size. MSAA is now only
requested when we render below 1.5×, where it is the cheapest and the only place
it still buys anything.

This is the piece the 30 fps cap could not help with. **Frame rate divides the
cost per second; it does nothing about the cost per frame**, and half as many
frames of a load the GPU cannot finish is still a load it cannot finish.

`?dpr=` overrides both limits in either direction, so 0A.12 can compare honestly
— the same escape hatch `?fps=` already provides.

Also: `scene.skipPointerMovePicking = true`. Nothing in this game picks — the
controls are DOM over the canvas — so Babylon was prepared to consider a ray
cast on every pointer move, which with a thumb on the joystick is every frame.

### What was _not_ done

The player character is **36 meshes and 36 materials — one per box face**. It is
now 36 cheap materials rather than 36 expensive ones, but the right fix is an
atlased single-material export from the art side, not more code. Flagged, not
worked around.

### Cost

**325 tests** (170 game-core + 155 client). No measured frame time: the local
preview pane stopped compositing, and a desktop GPU figure would not predict an
iPhone anyway. The structural numbers are the evidence; **0A.12 on the phone is
the measurement that settles it.**

## 0A.14 — the character never moved, and the zoom came back

Two bugs from the same playtest. Neither was caused by 0A.13; the first had been
there since the character landed.

### The T-pose

The rig has the joints it should — `hip_L`, `shoulder_R`, `neck`, all present and
found. The animator ran every frame and wrote the right angles. The character
never moved a millimetre.

**glTF stores rotations as quaternions, and Babylon's loader assigns
`rotationQuaternion` on every node it creates — including nodes with no rotation
at all. While that property is set, Babylon ignores `rotation` completely.** So
`rigAnimator` spent every frame writing Euler angles into a property nothing
read.

The scene said it plainly once asked: every joint quaternion-posed, every Euler
angle `0`. And the shoulders read `(0, 0, ±0.707, 0.707)` — a quarter turn about
Z, which _is_ the T-pose, baked into the bind transform where the animator could
not reach it.

Two fixes, because there were two problems stacked:

1. `makeEulerWritable` converts the quaternion to Euler once at setup and clears
   it, preserving the authored orientation to the degree and making the Euler
   path live.
2. The shoulders' quarter turn is zeroed, because the bind pose is a **modelling
   convention, not a stance**. Every clip swings the shoulders about X; applied
   on top of a quarter turn that rotates a sideways-pointing arm around its own
   length, which reads as nothing happening.

Verified in the running scene rather than by argument: arms drop, and 45 forced
frames move shoulders, neck and torso off zero for the first time.

### Why the tests did not catch it, which is the real lesson

There were tests. They passed. They asserted `joint.rotation.x` — **the property
the animator writes** — which was always correct. The bug lived entirely in
whether anything _read_ it.

The new tests build the rig the way the loader really builds it, quaternion-posed
and T-shouldered, and measure **limb direction in world space** via the world
matrix. Disabling the fix now fails four of them, including "actually moves the
legs during a walk". Written against `rotation` they fail one.

A test that reads back the value you just wrote tests your arithmetic. Asking
where the limb ended up is the only assertion that could tell the difference —
and this stage has now been caught twice by the gap between "the state is right"
and "the thing on screen is right".

### The zoom, after five to seven quick taps

`#app *` was already `touch-action: none`, and a player still had the page zoom
land on them mid-fight. Whatever iOS does with a fast tap sequence, it is not
honouring that, and `dblclick` never arrives to be cancelled because Safari does
not fire it for a gesture it has decided is a zoom.

So the sequence is tracked directly and the second tap of a pair has its default
cancelled. Safe because of two properties, both deliberate:

- **single-finger taps only**, so a two-finger pinch is untouched and stays the
  way back from a zoom the browser is already holding — the trap of 0A.10 is not
  being rebuilt;
- **it costs the game nothing**, because every control fires on `pointerdown`.
  Cancelling a `touchend` default suppresses the synthesised `click`, and
  gameplay does not use one. The debug panel does, so taps there are excluded.

A burst does not collapse into silence: taps pair up, so seven fast taps suppress
three and pass four. A guard that ate every tap after the first would be a worse
bug than the zoom.

The tests caught a real edge on the way: `timeStamp` is measured from page load,
so a `0` sentinel makes the **first tap of a session** look like the second half
of a double-tap. It is `null` now.

### Cost

**338 tests** (170 game-core + 168 client).

### Still open

The zoom fix is reasoned, not observed — it cannot be reproduced on a desktop.
If it recurs, the next step is instrumenting `visualViewport.scale` on the phone
to establish whether it is page zoom at all, rather than guessing a third time.

## 0A.15 — "it feels slow, is it zoomed out?"

The player's own diagnosis, and it is right. Two things shrank the picture
without anyone changing a camera value.

**The character got a third smaller.** The playtest that settled 9 m was played
with a 1.8 m box: the player stood one fifth of the screen tall. The box became
a real character authored at 1.3 m — a child, and correctly so — and the metre
count stayed. The player is now 14% of the screen instead of 20%.

**The arena got two and a half times bigger.** 20x14 to 32x22. Crossing it at an
unchanged 4.5 m/s went from about 4.4 s to about 7.1 s, and
`maxSpeedMetresPerSecond`'s own comment says the number was chosen so that "the
20 x 14 m test arena takes a few seconds to cross".

Apparent speed is judged against the thing that is moving, not against metres.
A smaller character crossing a larger, emptier floor reads as slower with every
simulation number identical. That is a real effect, not a matter of taste.

It is **not** frame rate: 57 active meshes and 1.18 ms per frame locally after
0A.13. And "rougher" has a separate and simpler cause — the render ratio is
capped at 2x where the phone offers 3x, which is exactly a slightly chunkier
image.

### What was not done, and why

The obvious move is to tighten the camera, and it is wrong as a silent default:
**the enemy aggroes from 8 m**, and a frame shorter than that lets something
charge from off-screen. A test already pins that floor, which is why this got
caught before shipping rather than after. Framing is now settleable on the
device instead — `?zoom=` takes metres — because this is a judgement to make
while holding the phone, not while reading the source.

## 0A.16 — the frame cap was running the game in slow motion

"Still slow, like in slowmo even." The word was exact, and it named a bug the
previous three attempts at "slow" had all walked past.

### What it was

The 30 fps cap was a gate: the render loop ran at full rate and `scene.render()`
was skipped on alternate ticks. The reasoning written down at the time was that
a skipped frame simply hands the simulation a 33 ms delta instead of a 17 ms
one, and `stepMovement` caps a frame anyway.

That reasoning never checked **where Babylon measures time**.
`AbstractEngine._processFrame` calls `beginFrame()` — which recomputes
`_deltaTime` — on _every_ animation frame, before it invokes the render
callback the gate lived in:

```js
_processFrame(timestamp) {
    if (!this._contextWasLost && !this._isOverFrameTime(timestamp)) {
        ...
        this.beginFrame();          // <- _measureFps(), every tick
        if (!this.skipFrameRender && !this._renderViews()) {
            this._renderFrame();    // <- our callback, where the gate was
        }
```

So the delta was always one _tick_, never one _rendered frame_. Every drawn
frame was told 17 ms had passed when 33 ms really had. **The entire world —
movement, the hammer, enemy recovery, hit stop — ran at exactly half speed, and
at quarter speed on a 120 Hz ProMotion phone.**

The cap is now `engine.maxFPS`, which Babylon tests in `_isOverFrameTime`
_before_ `beginFrame`. A skipped tick never touches the clock; a rendered frame
is told exactly how long since the last rendered frame. Babylon's accumulator
also absorbs the arrival jitter `earlyTolerance` was invented to paper over, so
that constant is gone.

### Why nothing caught it

There were nine tests on the frame gate. They were good tests. They simulated
frame arrivals at 60 and 120 Hz, checked the drawn count was 30, checked the
reported rate was 30 rather than 60, checked stalls and the first frame. All of
them passed, for months, while the game ran at half speed.

**Not one of them could have failed**, because every one measured how often
frames were drawn and the bug was in what each frame was _told about time_.
Counting frames cannot detect a lie about the clock.

The replacements assert the mechanism instead: the cap must be handed to the
engine, because that is the only place it can be applied before the clock is
sampled. A cheaper test that is actually load-bearing.

This is the third bug this stage where the tests described the code and not the
game — after the health pips driven by a debug poll, and the animator writing
Euler angles nothing read. The pattern is the same every time: **asserting the
value we just computed, instead of the effect it was supposed to have.**

### The zoom guard is withdrawn

0A.14's tap-sequence guard was reported as making the zoom _worse_. It is
removed rather than defended — two guesses in a row at a bug that cannot be
reproduced on a desktop, and a third would be worse than none, because every
attempt so far changes touch handling during a fight.

`touch-action` and `dblclick` remain. The next move is measurement: the debug
readout has shown `visualViewport.scale` on its viewport line since 0A.1 — the
`@1.00×` in "Vaade" — and nobody has yet read it during a session that went
wrong. Whether the page is zoomed at all is still, after three attempts, an
open question.

### Cost

**332 tests** (170 game-core + 162 client), down from 342: the nine frame-gate
tests that could never fail were replaced by four that can.
