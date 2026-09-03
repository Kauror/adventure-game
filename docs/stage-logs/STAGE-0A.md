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
