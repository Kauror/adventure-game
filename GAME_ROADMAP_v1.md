# Browser Co-op Adventure Game — Execution Roadmap v1

Based on `PLAN_v2.1.md` (content revision **v2.2**, which incorporates the KOCorp hosting decision and the permanent Arena). This document converts the approved architecture into an ordered build programme with work packages, gates, test criteria, and scope controls.

**Revision 2026-08-28b:** Stage 1 is now the permanent **Arena / Training Grounds** rather than an abstract online-combat proof, **Kid Test 1** follows it, and **KOCorp Unraid** is the fixed host from Stage 0B onward.

**Starting decision:** Stage 0A is approved. Do not reopen the whole architecture unless Stage 0A/0B testing disproves a core assumption.

---

## 1. What success looks like

The first major target is **not the finished game**. It is a reliable, fun vertical slice that proves the architecture and the core play loop with real children on real phones.

The first major acceptance milestone is:

> Four children open a browser URL on phones, meet in the shared village, enter a roughly 25-minute adventure, fight and dodge, revive one another, solve a cooperative puzzle, defeat a boss, receive persistent loot, survive a phone lock/reload, return home, and find their progress intact the next day.

Everything before that milestone exists to remove a specific risk:

1. **Stage 0A-1:** Is the basic game fun and controllable on phones?
2. **Kid Test 0:** Do children understand it without being taught — and do they come back to it unprompted?
3. **Stage 0A-2:** Does the art pipeline hold, and what do the real devices actually do?
4. **Stage 0B:** Does the internet/multiplayer/session infrastructure work reliably?
5. **Stage 1:** Does the fun combat still feel good online and authoritative — and do we now have a permanent place to test everything that comes later?
6. **Kid Test 1:** What do the children actually *do* when given a free playground, before we commit to adventure content?
7. **Stage 2:** Do all of those pieces work together as an actual game session?

Only after Stage 2 do we invest heavily in persistent-world content, drawing creation, economy, player-created adventures, pets, and a growing world.

---

# 2. Project operating rules

These rules should be treated as part of the architecture.

## 2.1 One stage at a time

A stage has:

- a frozen scope;
- a short task list;
- automated tests where applicable;
- real-device testing where applicable;
- a written exit report;
- an explicit GO / ITERATE / STOP decision.

Do not start substantial work on the next stage before the current gate passes.

## 2.2 Cut scope before extending a stage

The project is a solo hobby build at roughly 5–10 hours/week. If a stage starts expanding, remove features rather than silently extending the stage indefinitely.

Order of protection:

1. core fun;
2. reliability;
3. mobile usability;
4. architecture correctness;
5. visual polish;
6. optional features.

## 2.3 No speculative frameworks

Do not build generalized systems until at least two or three concrete examples require them.

Examples:

- boss framework only after boss #3;
- advanced quest editor only after several quests exist;
- generalized pet system only when pets are actually scheduled;
- trading only when there is a demonstrated need;
- procedural generation only if authored/recombined content becomes the bottleneck.

## 2.4 Content and engine code stay separate

Game logic should make it easy to add a new item, enemy, region, quest or puzzle mostly as data.

Engine changes are justified when a **new kind of behavior** is needed, not when a new instance of an existing behavior is added.

## 2.5 The children are the product test

A technically perfect system that they do not voluntarily replay is a failed stage.

Important observations should be written down immediately after each child test rather than reconstructed from memory later.

## 2.6 Every gate has an iteration budget

A gate returning ITERATE may be retried **at most twice, at ≤2 weekends each**.

After the second failed iteration the answer is not a third attempt. Either accept a reduced target and move on, or change the design premise the gate is testing.

Unbounded ITERATE is how hobby projects die without anyone ever deciding to stop. No gate is exempt.

## 2.7 Stall detection

With no deadline, the real risk is not overrun — it is silence. Stage reports only appear at stage boundaries that can be ten weekends apart.

So: keep a fixed weekly slot, and **if two consecutive weeks pass with no commit, write one line in the stage log saying why.**

That turns a stall into visible data instead of an unexamined gap, and writing the line is usually enough to restart. A three-month pause is fine — the deployed world keeps running and the resume document exists for exactly this. An unnoticed three-month pause is how the project ends by accident.

---

# 3. Development workflow

## 3.1 Repository

Use one GitHub monorepo:

```text
/adventure-game
  /apps
    /client
    /server
  /packages
    /game-core
    /game-protocol
    /content
    /tools
  /assets
  /deploy
  /docs
```

Stage 0A initially uses only the client plus the minimum shared scaffolding necessary. Do not create empty complexity just to match the final tree.

## 3.2 Git workflow

For every meaningful change:

1. create a small issue/task;
2. create a dedicated branch;
3. have the coding agent implement only that task;
4. run lint/typecheck/tests/build;
5. inspect the actual result;
6. merge only after the task's acceptance criteria pass.

Avoid giant branches containing an entire stage.

Suggested branch naming:

```text
stage0a/client-bootstrap
stage0a/character-rig
stage0a/touch-movement
stage0a/hammer-combat
stage0a/enemy-telegraph
stage0b/auth
stage0b/village-room
...
```

## 3.3 AI-agent rule

Every implementation prompt should state:

- current stage;
- exact allowed scope;
- explicit non-goals;
- files/modules the agent may change;
- acceptance criteria;
- tests that must pass;
- requirement to report assumptions instead of silently redesigning architecture.

Default agent instruction:

> Do not implement future-stage features, do not introduce new frameworks unless required by this task, and do not refactor unrelated code. Preserve the architecture in PLAN_v2.1.md and this roadmap.

## 3.4 Definition of done for a task

A task is done only when:

- implementation works;
- TypeScript compiles cleanly;
- tests pass where tests are meaningful;
- no unrelated regressions are introduced;
- mobile behavior has been checked when the task touches input/rendering/session lifecycle;
- a short note is added to the stage log describing what changed and anything learned.

---

# 4. Milestone map

Approximate timeboxes are planning boundaries, not promises.

| Milestone | Purpose | Approx. timebox |
|---|---|---:|
| Stage 0A-1 | Offline mobile combat feel (published to a URL) | 3–4 weekends |
| Kid Test 0 | Child-understanding/fun gate | 2 sittings, days apart |
| Stage 0A-2 | Rig pipeline + device baseline (after GO) | 2–3 weekends |
| Stage 0B | Internet multiplayer + ops proof, on KOCorp | ~4 weekends |
| Stage 1 | Permanent Arena: online combat, revive, PvP ring, test bed | ~6–8 weekends |
| Kid Test 1 | Emergent-behaviour gate in the Arena | 1 session |
| Stage 2 | First real playable adventure | ~10 weekends |
| Stage 3 | Persistent shared world | scope after Stage 2 |
| Stage 4 | Drawings become game content | scope after Stage 3 |
| Stage 5 | Economy/social expansion | only after actual need |
| Stage 6 | Player-created adventures | later |
| Stage 7 | Living-world expansion | ongoing |

At 5–10 h/week, Stage 0A through Stage 2 is roughly a **multi-month prototype programme**, not a weekend project. That is acceptable; the roadmap is designed so that useful playable builds appear much earlier.

---

# 5. PREP — repository and decision freeze

This is not a new stage. It is the first working session before Stage 0A.

## Goal

Create the minimum development skeleton and record the few concrete choices needed to begin.

## Tasks

### PREP-01 — Create repository

- create GitHub repository;
- add `PLAN_v2.1.md`;
- add this roadmap;
- add `README.md` with one-paragraph game description;
- add `docs/decisions/` for short Architecture Decision Records;
- add `CLAUDE.md` / coding-agent project instructions.

### PREP-02 — Toolchain

Lock:

- Node LTS version;
- pnpm;
- TypeScript strict mode;
- Vite;
- Babylon.js modular imports;
- Vitest;
- one formatter/linter setup.

Three things that are cheap now and genuinely painful to retrofit:

- **Git LFS (or an explicit decision against it) before the first GLB lands.** Binary assets — models, textures, and later hundreds of kid drawings — bloat a repo permanently, and rewriting history to fix it later is miserable.
- **The i18n key pattern**, even though 0A has almost no text. Estonian is the authoring locale; if agents learn to hardcode display strings in week one, every later screen inherits the habit.
- **`assets/ATTRIBUTION.md`** — see PREP-04.

Do not add Colyseus/Postgres yet unless required to prepare the workspace; they belong to Stage 0B.

### PREP-03 — Representative devices

Create the initial device list:

- iPhone 13 mini;
- at least one Android phone;
- one tablet if available;
- one PC/laptop browser.

Add weaker/older Android hardware as soon as one becomes available.

### PREP-04 — Pick one temporary art pack/rig

Choose one low-poly humanoid that can legally be used and that provides or can accept:

- one shared skeleton;
- walk;
- attack;
- dodge;
- hand attachment/socket.

This is a pipeline test asset, not the final protagonist.

Start `assets/ATTRIBUTION.md` with the first pack: source, author, licence, URL, date. Kenney is CC0, but other packs are not, licences differ per pack, and mixed sources create attribution obligations that are impossible to reconstruct a year later from memory. One line per asset source, added when the asset is added.

### PREP-05 — Confirm KOCorp readiness

No deployment work yet (that is Stage 0B), only confirm the host is ready to receive it:

- Docker available on KOCorp with room for a dedicated network;
- Cloudflare account + domain reachable for the game hostname;
- Tailscale reachable for admin-only access;
- an `appdata/adventure` path and an `adventure-assets` path can be created;
- record the host profile (Ryzen 5 7430U, 32 GB, SSD, gigabit) in `docs/decisions/`.

## Exit

Repository builds a blank Babylon page locally and PLAN + roadmap are committed.

---

# 6. STAGE 0A — Combat-feel toy, then baseline

## Core question

> Is moving, dodging and timing one hammer attack enjoyable and understandable on a phone?

## The 0A-1 / 0A-2 split

Stage 0A as originally written was two to three times its timebox, and it put the project's most important gate — real children playing it — behind all of the measurement and art-pipeline work. It is therefore split:

**0A-1 — Combat feel** *(~3–4 weekends)*: 0A.1, 0A.2, 0A.4, 0A.5, 0A.6, 0A.7, 0A.8, 0A.9, 0A.10, 0A.11. Everything needed for a *fair* fun test and nothing else. **Kid Test 0 happens at the end of 0A-1.**

**0A-2 — Rig pipeline & device baseline** *(~2–3 weekends, only after a GO)*: 0A.3 and 0A.12. The work the kid test did not need.

The rig gate still happens — it is simply not allowed to delay the answer to "is this fun?"

## Pre-agreed cut list

If 0A-1 overruns, cut in this order rather than extending the stage. Decided now, so it is not a judgement call under pressure:

1. the second visual/texture variant;
2. the elevation example in the test area;
3. screen shake and particles (keep hit stop and impact sound — they carry most of the feel);
4. the real GLB character: fall back to a capsule with a visible weapon and move the whole rig gate into 0A-2.

## Hard scope

Allowed:

- one map;
- one character;
- one hammer;
- one enemy;
- walk;
- dodge;
- hammer charge/release;
- GOOD/GREAT/PERFECT;
- hit/death feedback;
- fixed camera;
- touch controls;
- debug/performance overlay + in-page console;
- assist toggle (build constant + `?assist=1`);
- minimal audio;
- static hosting of the build (0A.11).

Not allowed:

- accounts;
- networking;
- multiplayer;
- database;
- loot;
- inventory;
- village systems;
- quests;
- ability trees;
- more weapon families;
- persistence;
- final art production.

"Networking" here means **game** networking — sockets, rooms, server state. Uploading a static build to Cloudflare Pages is deployment, not networking, and is explicitly allowed: the client still runs entirely offline in the browser.

---

## 0A.1 — Client foundation

### Build

- Vite + TypeScript client;
- Babylon engine/bootstrap;
- responsive full-screen canvas;
- fixed landscape game viewport;
- safe handling of resize/orientation changes;
- minimal Preact overlay shell for debug/UI;
- basic asset loader.

### Acceptance

- loads on target phone browsers;
- no console errors;
- handles resize/orientation gracefully;
- blank/test scene maintains acceptable frame rate.

---

## 0A.2 — Coordinate and region prototype

### Build

Lock the world convention:

```text
1 world unit = 1 metre
1 navigation tile = 1 m x 1 m
X = east/west
Y = elevation
Z = north/south
```

Create one tiny grid-authored test area, approximately arena-sized, containing:

- floor;
- impassable edges;
- a few obstacles;
- one height/elevation example if cheap enough;
- player spawn;
- enemy spawn.

The grid is the logical truth; visible props decorate it.

### Acceptance

- map data can be loaded from structured content;
- character cannot leave intended playable area;
- coordinates are readable/debuggable in overlay;
- no second competing coordinate system appears.

---

## 0A.3 — Real character rig pipeline — **0A-2**

Runs *after* Kid Test 0. For 0A-1, a rough rigged pack humanoid is fine, and a capsule with a visible weapon is acceptable if the asset fights back — the kid test needs readable motion, not final art.

### Build

Prove:

```text
GLB
 -> shared skeleton
 -> walk
 -> attack
 -> dodge
 -> named hand socket
 -> hammer attachment
 -> texture/palette variant
```

### Acceptance

- real GLB loads on all target devices;
- animations do not break skeleton transforms;
- hammer stays correctly attached during movement/attack;
- a second visual variant uses the same rig/animations;
- pipeline steps are documented in `/docs/art-pipeline.md`.

### Stop condition

If the chosen asset/rig is awkward enough that every future animation will require manual repair, replace the asset now.

---

## 0A.4 — Fixed camera

### Build

Test only a small set of camera configurations:

- orthographic;
- very weak perspective;
- two or three sensible 3/4 angles/zooms.

No rotation controls.

### Evaluate

- can a small child see enemies and obstacles;
- does the player ever disappear behind scenery;
- do fingers obscure action;
- is forward/back movement visually intuitive;
- does the scene still read on the iPhone 13 mini.

### Acceptance

Choose one default camera configuration for the rest of Stage 0A and record it in an ADR.

---

## 0A.5 — Touch movement

### Build

Left-thumb virtual joystick:

- tolerant dead zone;
- max run speed;
- optional joystick origin-on-touch experiment;
- `touch-action: none`;
- prevent accidental page scroll/zoom/pull-to-refresh where possible;
- keyboard movement on PC for development.

### Acceptance

A child can circle an obstacle and approach an enemy without fighting the browser or camera.

---

## 0A.6 — Dodge

### Build

Right-thumb dodge button:

- clear press feedback;
- fixed travel distance or speed burst;
- short cooldown/stamina placeholder;
- temporary invulnerability only if needed for the intended combat feel;
- strong animation/VFX cue.

### Acceptance

Player can reliably dodge the test enemy's telegraphed attack on phones without requiring twitch-level timing.

---

## 0A.7 — Hammer timing mechanic

### Build

**One button, two modes.** Tap for speed, hold for strength.

TAP (release under ~180 ms):

1. a quick light hit that **chains** — tap again in rhythm to continue to a finisher;
2. short recovery, so taps actually flow;
3. the chain lapses if the rhythm is broken;
4. light hits are individually weaker than any heavy swing: taps buy speed and safety, not power.

HOLD:

1. a visible, learnable charge meter runs for a **total charge of ~0.85 s**;
2. release produces a heavy attack;
3. grade is GOOD / GREAT / PERFECT, defined as **concentric bands measured in width, not as points in time**:
   - **PERFECT** = a band **250–300 ms wide**, centred around 60 % of the charge;
   - **GREAT** = the ~450 ms band around PERFECT;
   - **GOOD** = everything else — released too early, or **overcharged** past the window;
4. every release attacks — missing the mastery bands never jams or cancels;
5. the meter caps rather than auto-firing;
6. better timing improves impact but never determines whether the attack happens.

### Assist toggle (required for Kid Test 0)

Implement assist now, as a local build constant plus a `?assist=1` URL parameter — accounts do not exist yet and are not needed. Assist **widens PERFECT and GREAT and never narrows GOOD** — and must always leave room to overcharge, or "hold it forever" becomes the best strategy for the very child it is meant to help.

Without this, a five-year-old who cannot land GREAT produces a false STOP on the most important gate in the project, and we would read "this combat is bad" when the truth is "this combat has no easy mode yet."

### Feedback

Each grade should differ through at least two channels:

- animation/impact strength;
- sound;
- particles/screen shake;
- damage number styling if damage numbers are used.

Do not rely on text alone.

### Acceptance

A player can explain through behavior—not necessarily words—that releasing at the right moment is better.

---

## 0A.8 — One enemy

### Build

Enemy state machine only:

```text
idle
 -> pursue
 -> wind-up
 -> attack
 -> recover
 -> pursue
 -> death
```

No sophisticated AI.

### Requirements

- obvious anticipation animation;
- attack readable through silhouette/shape as well as colour;
- enough recovery time to counterattack;
- no unavoidable damage.

### Acceptance

The intended loop emerges naturally:

> read -> dodge -> counterattack -> time hammer.

---

## 0A.9 — Feel pass

Add only cheap, high-value feedback:

- hit stop or micro-pause;
- impact sound;
- small screen shake;
- damage flash;
- simple particles;
- satisfying enemy defeat;
- charge/timing audio reinforcement.

The purpose is to prevent testing a technically correct but emotionally dead combat loop.

---

## 0A.10 — Debug overlay and in-page console

Hidden/temporary overlay showing:

- FPS;
- frame time;
- world position;
- camera mode;
- current input state;
- timing grade;
- basic device/browser information.

Make it possible to toggle without developer tools.

### In-page console — not optional on this project

iOS Safari's Web Inspector requires macOS, and the development machine is Windows. There is **no** way to see a console, a stack trace or a failed request on the iPhone 13 mini otherwise.

Bundle a self-hosted in-page console (eruda or vConsole) behind the same hidden toggle, from this first build onward. It is the difference between "the kid's phone shows a black screen" being a five-minute fix and a lost evening.

---

## 0A.11 — Publish to a static URL

A Vite build is just static files. Deploy it to Cloudflare Pages (or equivalent) — free, no server, no tunnel, none of the Stage 0B infrastructure.

Why this is a task and not a nicety:

- Kid Test 0's real criterion is the **second sitting days later**, which only works if the children can reach the toy themselves;
- it keeps them attached to the project during the months between Kid Test 0 and the first adventure — the "kids lose interest during the gap" risk;
- retesting after a tweak costs a deploy, not a LAN setup session.

Keep `pnpm dev --host` working for local iteration; the published URL is for the children.

---

## 0A.12 — Device baseline — **0A-2**

Runs *after* Kid Test 0. The stress-ladder scene below is a **synthetic measurement scene, explicitly exempt from this stage's one-character/one-enemy gameplay scope** — it exists to produce numbers, is never shown to a child, and its entities need no AI or combat behaviour.

Use a representative scene and a stress ladder rather than trying to discover Safari's precise kill ceiling.

### Normal scene

- 6 animated humanoids;
- ~10 enemies or representative animated entities;
- environment props;
- basic particles;
- representative textures;
- shadows on/off comparison.

### Stress ladder

- normal target load;
- ~2x representative entity/asset load;
- ~3x representative entity/asset load.

### Measure/observe

- median FPS;
- noticeable frame spikes;
- temperature/thermal degradation over ~30 minutes;
- Low Power Mode behavior;
- accidental browser gestures;
- landscape usability;
- audio unlock/resume;
- short phone lock/return behavior even though networking does not yet exist;
- WebGL2 baseline;
- WebGPU only as an experiment, not a dependency.

### Output

`docs/device-baseline-stage0a.md`

Record actual devices and observations. Do not invent precision where measurements are noisy.

---

# 7. KID TEST 0 — mandatory gate

## Why the method matters

This is the highest-consequence gate in the project, and the sample is two children being tested by their own parent. Novelty inflates a first session, children answer their parent's hopes rather than the question, and one hungry or tired child can produce a false STOP on years of work. The method below exists to get an honest signal out of a very small, very biased sample.

## Participants

At minimum one younger child and one older child.

- **Test the youngest first** — they are the constraint.
- **Test each child separately**, before they teach each other.
- **Do not introduce it as "the game I'm making."** A child performing enthusiasm for a parent is not data.

## Instruction

Only:

> "Try playing this."

Do not explain dodge/timing unless they become completely blocked.

## Two sittings

**Sitting one** — the observations below, run **once with assist on and once with it off**, noting which produced the fun.

**Sitting two, two to seven days later — this is the actual gate.** Do not prompt, do not remind, do not ask. **Do they come back to it on their own?** Sitting one measures novelty; sitting two measures whether anything was really built. This is the whole reason 0A.11 publishes the toy to a URL they can reach themselves.

Write the observations down the same evening, not from memory later.

## Observe

Record:

- time until first successful movement;
- time until first attack;
- whether dodge is discovered;
- whether enemy wind-up is understood;
- whether timing mechanic is discovered;
- whether controls are physically comfortable;
- accidental browser interactions;
- where they look/tap when confused;
- whether they retry after dying;
- whether they ask to fight again after winning;
- differences between younger/older player.

## Decision

### GO

Both children can play (the younger one may need assist), **and at least one returns to it unprompted in sitting two.**

### ITERATE

The core idea reads as fun but input, readability or timing confuses them. Return to 0A-1 — **under the iteration budget: at most two iterations of ≤2 weekends each** (§2.6).

### STOP / CHANGE THE PREMISE

They understand the controls and are simply not interested. Do not begin networking to rescue unfun combat — and do not start an unbounded third redesign either.

After two failed iterations the honest move is to change the *premise* the gate is testing — a different weapon feel, a different enemy, or exploration rather than combat as the core verb — and re-test **once**. If that also fails, the game premise is wrong, and that is worth knowing after eight weekends instead of after two years. See the pre-commitment in PLAN §28.

## Output

`docs/playtests/kid-test-0.md`

---

# 8. STAGE 0B — Networking, accounts and operations proof

## Core question

> Can four phones on real internet connections reliably inhabit the same session, recover from mobile interruptions, and preserve durable data?

This stage deliberately returns to simple coloured/representative characters. It is an infrastructure proof, not another combat-content stage.

## Hard scope

Allowed:

- Colyseus;
- PostgreSQL;
- authentication;
- sessions;
- one village/test room;
- player movement sync;
- reconnection/rejoin;
- Cloudflare Tunnel;
- basic admin account tools;
- telemetry/logging;
- backup/restore pipeline;
- multiplayer bot harness.

Not allowed:

- boss;
- real adventure;
- inventory/economy;
- drawing system;
- extensive combat;
- generalized matchmaking;
- public registration;
- free-text chat.

---

## 0B.1 — Server foundation

Create:

- `/apps/server`;
- Colyseus server;
- health endpoint;
- structured logging;
- config/environment validation;
- clean startup/shutdown;
- server version identifier.

Acceptance: server can run locally and in Docker without game state yet.

---

## 0B.2 — PostgreSQL foundation

Create migrations for only what Stage 0B needs:

- accounts;
- sessions/login tokens as appropriate;
- characters/minimal profile;
- audit/security fields needed for account recovery.

Do not prematurely create every future table unless a stable schema field is already required by an explicit invariant.

Acceptance:

- fresh DB can be created entirely from migrations;
- migrations can run automatically/safely in test deployment;
- account creation is tested.

---

## 0B.3 — Authentication

Implement:

- admin-created accounts only;
- email + password;
- argon2id password hashes;
- login rate limit;
- rolling long-lived session;
- logout/revoke;
- admin password reset.

Acceptance:

- no public signup route;
- account works from phone and PC;
- invalid sessions fail safely.

---

## 0B.4 — One-tap recovery link / QR

Implement an admin command/RPC to issue a short-lived one-tap login URL that can be represented as a QR code.

Test scenario:

> child clears browser data -> parent issues link -> child is back into the same account without knowing/typing the password.

This is a first-class requirement, not polish.

---

## 0B.5 — Shared test room (the Arena shell)

Author this room as the **empty Arena** in the grid region format, not as a throwaway box — Stage 1 fills it in rather than replacing it.

Implement one Colyseus room with:

- join/leave;
- player ID;
- position;
- facing;
- basic movement sync;
- no durable combat state.

The synchronization implementation may use Colyseus state patches/messages/hybrid as appropriate. Do not lock the project to a speculative snapshot architecture.

Acceptance:

Four clients can move simultaneously and see one another smoothly enough for the intended game.

---

## 0B.6 — Movement sanity checking

Client remains movement-authoritative at this stage, but server checks:

- maximum displacement;
- teleport threshold;
- allowed region;
- coarse grid legality.

Violations are:

- clamped/rejected;
- logged;
- corrected on the client.

No full rollback/prediction architecture.

---

## 0B.7 — Mobile lifecycle

Implement and test:

- heartbeat/dead-socket detection;
- 120-second grace slot;
- reconnect after socket loss;
- cold page reload -> automatic rejoin using persisted session/room context;
- visibility change handling;
- audio resume plumbing;
- after grace: safe exit semantics.

Test each relevant scenario as:

1. network/socket drop;
2. complete page reload/tab eviction simulation.

Acceptance target:

A child does not have to understand the word "reconnect."

---

## 0B.8 — KOCorp deployment

KOCorp Unraid is the fixed host from this stage onward. Deploy the five containers named in PLAN §22:

- `adventure-web` — static Vite/Babylon build, HTTP delivery only, no privileged host access;
- `adventure-server` — Node + Colyseus: auth, rooms, rules, persistence, admin RPCs (admin path private only);
- `adventure-db` — PostgreSQL, dedicated database and credentials, never publicly exposed;
- `adventure-backup` — scheduled pg_dump, drawing/art backup, offsite copy, restore support;
- `cloudflared-adventure` — public HTTPS/WSS ingress **for the game only**.

Mandatory isolation (the game stack is untrusted relative to the rest of KOCorp):

- dedicated Docker network;
- dedicated database, credentials and appdata/storage paths;
- no Docker socket;
- no host-network mode unless explicitly justified later;
- no broad `/mnt/user` mount, no access to unrelated shares, appdata, services or databases;
- public ingress reaches only the game-facing web/server services — never PostgreSQL, the Unraid UI, admin RPCs or internal tooling, which are Tailscale-only.

Suggested paths (may shift; isolation may not): `/mnt/user/appdata/adventure/{server,postgres,backups}` and `/mnt/user/adventure-assets/{drawings,processed,characters,items}`.

**Resource safety:** measure first, then limit. Record real CPU/RAM usage during this stage and the Arena, and set container limits/reservations from those numbers — a runaway development bug must not be able to starve unrelated KOCorp workloads. Do not guess aggressive limits before measurements exist.

Keep a fast local `docker compose` loop as the development inner loop; KOCorp is the integration and measurement target, so "test on the real path" never means waiting for a deploy to try one change.

Document fallback to direct 443/Caddy only; do not implement unless measured tunnel performance warrants it.

---

## 0B.9 — Telemetry

Implement:

- browser error POST endpoint;
- structured server logs by player/session;
- client/server version logging;
- hidden debug overlay ping/client version;
- enough context to investigate "it doesn't work" from a remote phone.

Do not collect unnecessary child data.

---

## 0B.10 — Bot harness

Create Node test clients using the actual Colyseus client library.

Initial automated scenarios:

- join 4 clients;
- movement visibility;
- leave/rejoin;
- duplicate player/session protection;
- speed/teleport rejection;
- 10-client soak roaming a small map.

This becomes the backbone of later multiplayer correctness testing.

---

## 0B.11 — Backup and restore foundation

From the first persistent database:

- nightly pg_dump;
- uploaded/config assets as applicable;
- offsite copy;
- health/dead-man notification;
- image/config version recorded with backup.

Perform one manual restore before calling the stage complete, even though the fully scripted recurring restore drill is required later.

---

## 0B.12 — Internet/device test

Test against the real KOCorp deployment, at minimum:

- home Wi-Fi → KOCorp via the public game URL;
- another household/network → KOCorp;
- LTE/mobile-data client;
- a Wi-Fi ↔ mobile-data transition where possible;
- 2, 4 and 6 simultaneous clients (bots may stand in for missing children);
- 10 protocol-level bots;
- 10 s / 60 s / longer background/lock cases;
- 4G cold load;
- PWA vs browser tab if PWA work is included.

Measure: RTT/ping, reconnect time, cold-load time, connection stability, server CPU/RAM, Colyseus room behaviour, PostgreSQL load, Cloudflare Tunnel behaviour.

The likely early constraints are mobile-browser lifecycle and network quality, not KOCorp compute.

Output:

`docs/device-baseline-stage0b.md`

---

## Stage 0B exit gate

GO only if:

- four clients share the room from real networks;
- session recovery is automatic enough for children;
- a cold reload returns to the intended room;
- bot tests are stable;
- persistent account data survives deployment restart;
- first restore works;
- Cloudflare path performs acceptably;
- no admin/DB service is publicly exposed.

---

# 9. STAGE 1 — The Arena / Training Grounds

## Core question

> Can the working movement/network foundation support combat that is fun with several real children, while also giving development a permanent place to test every future system?

## What changed

Stage 1 is no longer an abstract "online combat proof." It builds a **permanent Arena** — real playable content for the children and the project's permanent QA, graphics, balance and regression playground. It must not be disposable prototype code, and it is authored with the same grid format, rig and authority model as real content. Later it joins the village fictionally as "The Training Grounds."

## Scope

Server-owned combat, downed/revive, Arena death/respawn, opt-in PvP in a marked ring, a temporary weapon rack, an admin monster spawn gate, and hidden performance controls.

**Ship Arena v1 only.** Arena v1 = safe spawn/respawn area, open combat field, one PvP ring, training-dummy corner, weapon rack (hammer + at most one second weapon), monster spawn gate, a few cover obstacles, readable edges.

**Explicitly Arena v2+, not now:** archery lane, dodge/obstacle course, wave-survival pit, boss-practice gate, extra game modes, normalized-stat implementation. The Arena is permanent; it grows by accretion. Do not let it become a second vertical slice.

No adventure, no village systems, no loot, no persistence beyond accounts/characters.

---

## 1.0 — Arena map

Author the Arena in the same grid-first region format intended for real content (`/packages/content/regions`), as a fill-in of the Stage 0B test room rather than a new throwaway space.

Acceptance:

- loads from structured content, no hardcoded geometry;
- all v1 spaces exist and are readable on the iPhone 13 mini;
- edges and navigation are obvious to a child;
- deliberately reusable as the standard performance scene.

---

## 1.1 — Move shared combat math into game-core

Implement pure TypeScript definitions/rules for:

- health;
- damage application;
- cooldown legality;
- timing-grade clamp;
- downed state;
- revive state;
- temporary invulnerability if used;
- basic difficulty inputs.

No Babylon or Colyseus imports in `game-core`.

Unit-test everything deterministic.

---

## 1.2 — Authoritative enemy

Server owns:

- enemy HP;
- target;
- logical position/path;
- telegraph state;
- attack timing;
- damage outcome;
- death.

Client presents the same state using Babylon animations/VFX.

Acceptance:

Two clients see the same enemy state and cannot disagree on whether it died.

---

## 1.3 — Online player attack

Client sends attack intent including bounded timing grade claim.

Server validates:

- weapon cooldown;
- range/position plausibility;
- grade limit;
- perfect-rate sanity;
- target eligibility;
- applies actual damage.

Automated tests include attack-rate cheating.

---

## 1.4 — Downed/revive

Implement:

- downed instead of immediate death;
- crawl or minimal downed activity;
- teammate revive interaction;
- revive progress;
- interrupt semantics;
- assist modifier for younger player;
- optional assisted self-revive after configured delay.

The mechanic must produce teamwork rather than merely a waiting timer.

---

## 1.5 — Full core animations

Add/validate:

- run;
- downed;
- revive;
- interact.

Do not expand weapon families yet unless needed to prove animation architecture.

---

## 1.6 — Network combat tests

Bot scenarios:

- two players damage same enemy;
- attack faster than allowed -> reject;
- player disconnects while downed;
- revive exactly once;
- reconnect during encounter;
- enemy death committed once;
- assist setting changes permitted server outcomes without altering rewards.

---

## 1.7 — Remote-player presentation

The named risk "networking makes combat mushy" needs an owner, and this is it. Implement and tune the presentation of *other* players and enemies: an interpolation buffer (start around 100 ms), a snap threshold for large corrections, and smoothing that never lies about where an attack landed.

Acceptance: remote players read as players, not as teleporting sprites, on both Wi-Fi and LTE.

---

## 1.8 — Arena death and respawn

Arena death is deliberately a different model from adventure death: short respawn delay, then respawn at the safe area. No loot at risk, no wipe, no recovery cache.

Keep the two models separate in `game-core`; do not let an agent unify them with the §13 adventure rules.

---

## 1.9 — Opt-in PvP ring

PvP damage applies only inside the marked ring; leaving disables it; safe areas never permit it.

Must NOT: remove items or coins, damage durability, grant persistent power or currency, transfer loot, or create leaderboards or permanent rankings.

**Three additional protections for the 5–13 age span** — zero mechanical consequence does not mean zero emotional consequence, and a 13-year-old beats a 6-year-old every single time:

- assist settings apply in PvP exactly as in PvE;
- **no score, streak or round counter is displayed in v1** — not even between two players; a visible 7–0 is the part that actually hurts;
- a per-account, admin-settable PvP flag exists from the start, so a child who does not want to be hit by their older sibling simply cannot be, without having to negotiate it in the moment.

Purpose is fun plus latency/hitbox/dodge/weapon testing: "I hit you with the ridiculous hammer," never "I farm another child for progression."

---

## 1.10 — Temporary Arena equipment

A rack grants weapons that exist only inside the Arena, never enter persistent inventory, and vanish on leaving. Enforced server-side.

This is what makes the Arena safe as a permanent test bed, and it establishes the pipeline used later for child-designed weapons:

```text
new weapon -> Arena -> kids/devs test it -> balance and feel changes -> only then into real content
```

Automated test: rack gear provably cannot leak into persistent inventory.

---

## 1.11 — Monster spawn gate

Admin/debug control only — spawn 1 / 5 / 10 / elite. No generalized spawner UI.

Enables controlled testing of enemy AI, pathfinding, crowd behaviour, area attacks, co-op revival and difficulty scaling.

---

## 1.12 — Performance lab

Hidden developer controls to vary character count, enemy count, particle intensity, shadows and dynamic lights, plus an optional WebGL2/WebGPU comparison.

Standard stress cases: 4 players + 10 enemies; 6 players + 25 enemies; 10 bot clients; heavy particles; shadows on.

Record client FPS/frame time, thermal degradation, memory behaviour, ping, server CPU/RAM on KOCorp, and room tick stability. **From here the Arena replaces synthetic benchmarks as the standard performance scene.**

---

# 9b. KID TEST 1 — mandatory gate

Hand the children the Arena with minimal direction. This is the project's first look at emergent behaviour, and it should shape Stage 2 before a single adventure room is built.

Observe — and record what they *do*, not what they say:

- do they fight each other, or cooperate against monsters?
- which weapon do they choose?
- do they use dodge? do they attempt revives?
- do they invent their own games and rules?
- do they repeatedly spam the monster gate?
- do they ask for teams? for more weapons?
- do they want to keep playing after the planned test ends?
- what confuses the youngest player?
- what does the oldest exploit within the first minute?

Output: `docs/playtests/kid-test-1.md`

---

# 9c. STAGE 1 EXIT GATE

GO only if:

1. the Arena runs on KOCorp through the real public game path;
2. at least four real players join reliably;
3. six-player operation has been tested (bots may stand in for missing children);
4. ten protocol-level bots connect and roam/fight without correctness failure;
5. Stage 0A combat still feels responsive online;
6. damage, health and cooldowns are server-controlled;
7. PvP works only in the intended opt-in area;
8. Arena PvP has no persistent-loss consequences;
9. at least one enemy works online;
10. players can be downed and revived, and revive creates cooperation rather than a waiting timer;
11. Arena death/respawn works;
12. a phone can disconnect/lock/reload and be restored correctly;
13. temporary Arena equipment cannot leak into permanent inventory;
14. same-item/transaction correctness tests still pass;
15. performance is acceptable on the weakest available target phone;
16. server resource usage is recorded on KOCorp (and informs the §22 container limits);
17. Kid Test 1 is complete and its observations are written down.

If multiplayer makes combat noticeably worse, fix it here — before building a dungeon on top of it.

---

# 10. STAGE 2 — Vertical slice: the first actual game

## Core question

> Is there a 20–40 minute cooperative adventure here that the children actually want to replay?

This is the most important stage before persistence becomes sacred.

**The Arena has already de-risked most of it.** By now movement, fixed camera, mobile controls, internet multiplayer, reconnect/rejoin, combat, damage authority, the timing mechanic, dodge, revive, death/respawn semantics, at least one enemy, weapon switching, KOCorp performance and the bot harness are all proven. Stage 2 must therefore **not re-invent the multiplayer or combat foundation** — it assembles proven systems into an adventure. Anything that starts to look like foundation work in this stage belongs back in Stage 1's Arena, where it can be tested in isolation.

## Target experience

```text
LOGIN
 -> VILLAGE
 -> FOREST GATE
 -> tutorial encounter
 -> combat room
 -> wordless riddle door
 -> recovery/checkpoint
 -> boss
 -> loot
 -> return to village
```

Target real run: roughly 25 minutes.

---

## 2.1 — Minimal village

Build only what the slice needs:

- spawn area;
- visible adventure gate;
- obvious party presence;
- return location;
- minimal signs/icons/pings;
- no elaborate shops/home interiors yet.

The village proves readability and social gathering, not world breadth.

---

## 2.2 — Region content pipeline

Create first real structured region definitions:

- village;
- forest/adventure area.

Validate:

- grid data;
- spawn IDs;
- gate IDs;
- triggers;
- encounter markers;
- puzzle references;
- content schema version.

Add referential-integrity checks to CI.

---

## 2.3 — Party/adventure instance

Implement explicit party/adventure lifecycle:

- create/join adventure;
- max party;
- instance ID;
- rejoin by instance ID;
- room disposal after safe persistence;
- graceful leave/go-home path.

No public matchmaking.

---

## 2.4 — Backpack and item instances

Implement only the inventory model needed for the slice:

- 8–12 expedition slots;
- immutable valuable item instance ID;
- item definition ID;
- acquisition source/date;
- roll seed/provenance if needed;
- equipped/signature distinction;
- pickup ownership transaction.

First critical test:

> two players pick up the same item -> exactly one succeeds.

---

## 2.5 — Loot: kept, not banked

**Simplified for the slice.** Loot is granted on pickup and simply kept. No banked-versus-unbanked distinction, no per-room banking rules, no icons explaining a risk model.

- post-room checkpoint exists as a *progress* marker (where you resume), not as a loot-safety mechanism;
- a graceful "go home" exit at any checkpoint keeps everything collected.

Checkpoint durability need only survive the §6 grace window and a rejoin, not an arbitrary server restart.

---

## 2.6 — Party wipe (no loss in the slice)

**A wipe fails the adventure and costs nothing.** Party returns to the village keeping what they collected.

The full loss system — recovery cache created exactly once, three attempts, abandoned runs not consuming an attempt, no real-time expiry, courier/tax floor on the third failure, protected categories, admin recovery path — **moves to Stage 3** (§12.7), where persistence is sacred and loot actually matters.

Reason: this is the most transaction-heavy work in the stage, and the Stage 2 playtest measures whether the *adventure* is fun, not whether the loss rules feel fair. Nobody is asking that question yet. Building it here is the single largest avoidable cost in Stage 2.

What stays in Stage 2: the wipe *event* itself, party return, and the difficulty recompute in 2.9.

---

## 2.7 — First puzzle/riddle door

Do not build a puzzle engine.

Create one concrete cooperative puzzle that:

- can be understood by pre-readers;
- uses shapes/positions/actions;
- benefits from two or more players;
- cannot be brute-forced instantly;
- has visible feedback for wrong/right attempts;
- does not require precision timing from the youngest player.

Observe actual children; the puzzle's difficulty cannot be inferred from adult intuition.

---

## 2.8 — First boss

Hard-code it.

Recommended structure:

1. readable attack pattern;
2. phase change;
3. cooperative mechanic/puzzle;
4. final damage phase;
5. downed/revive opportunities;
6. boss scales appropriately with active party size.

No generalized boss DSL/state engine.

---

## 2.9 — Difficulty recompute

When active party size changes:

- scale future damage/HP/pressure using explicit rules;
- preserve current boss phase;
- do not heal/reset in a confusing way;
- rejoining player can re-enter within grace without breaking state.

Test deliberate mid-boss disconnect.

---

## 2.10 — Wordless onboarding

The path from village to first fight acts as tutorial:

- movement demonstration;
- attack cue;
- dodge cue;
- timing cue;
- revive cue when relevant;
- interact cue;
- no wall of Estonian tutorial text.

Use icons, ghost-hand animation and environmental composition.

---

## 2.11 — Pings/emotes

Add only a tiny set:

- come here;
- help/revive;
- wait;
- yes/ready;
- celebration.

No free-text chat.

---

## 2.12 — Audio/VFX/content pass

Minimum asset target:

- shared rig;
- 2 weapon-family animation sets at most;
- 2 normal enemy models;
- 1 boss;
- village/forest environment set;
- ~6 useful SFX;
- ~2 music loops;
- basic hit/heal/revive/boss VFX.

Do not use content volume to disguise weak mechanics.

---

## 2.13 — Restore drill automation

Before Stage 2 exits:

- restore latest backup to scratch DB;
- run sanity queries;
- verify account count/item count/critical state;
- tear down scratch DB;
- document outcome.

This becomes the template for monthly restore drills.

---

## 2.14 — Stage 2 acceptance test

Run the full v2.1 scenario with real children:

- 4 phones;
- at least 2 networks;
- login without password typing;
- meet in village;
- enter adventure;
- combat/dodge;
- one down/revive;
- cooperative riddle;
- boss;
- exactly-once loot;
- one phone locked for 60 seconds -> automatic return to same fight;
- one player yanked mid-boss -> others remain viable;
- return home;
- loot persists;
- one simple flag persists to next day;
- full run ~25 minutes;
- restore drill proves persistence can be recovered.

### GO to Stage 3 only if

1. technically reliable;
2. younger player participates meaningfully;
3. children voluntarily want another run / ask what comes next.

If criterion 3 fails, the next step is **game-design iteration**, not persistent-world expansion.

---

# 11. POST-STAGE-2 REVIEW — mandatory architecture checkpoint

Before Stage 3, stop and write a short review.

Questions:

- What did children repeatedly do that we did not predict?
- What did they ignore?
- Did 25 minutes feel right?
- Which controls caused confusion?
- Which device/network caused the most trouble?
- Was recovery too harsh/too soft?
- Did younger children contribute meaningfully?
- Did they care about loot?
- Did they ask about customization/drawings?
- Did they want exploration, bosses, collecting, social play or creation most?

The answers determine Stage 3–4 priorities.

Do not allow the old roadmap to override evidence from the children.

---

# 12. STAGE 3 — Persistent shared world

## Core question

> Can actions become part of a world history that remains trustworthy for months?

From this point onward the **world-reset covenant** applies: player/world progress is sacred except for explicit recovery/admin action.

## Work packages

### 3.1 World flags

Implement stable, idempotent flags:

- e.g. `bridge_repaired`;
- unique event IDs;
- concurrent double-completion collapses to one transition;
- immutable event history row records who/when/what.

### 3.2 Unlockable bridge

Build one concrete shared-world transformation:

- gather/quest/boss requirement;
- canonical event may require GM arming for major progression;
- bridge visually changes for all players;
- new area opens for everyone.

### 3.3 Second region

Add one region that proves the content/grid pipeline is reusable without redesign.

### 3.4 Personal room/dashboard

Responsive HTML/Preact view that feels like the player's own room:

- character;
- equipped items;
- weapon/armour rack presentation;
- storage;
- gifts placeholder;
- adventure history;
- created-item gallery placeholder.

It is intentionally not a walkable 3D house.

### 3.5 Large storage

Persistent storage separate from expedition backpack.

### 3.6 World event history

Record major changes so the world's history can eventually become a Chronicle.

### 3.7 The full loss system (moved here from Stage 2)

Now that persistence is sacred and loot matters, implement PLAN §13 in full:

- checkpoint banking: banked vs unbanked expedition loot, graceful exit preserving banked loot;
- party wipe → recovery cache created **exactly once**;
- three recovery attempts, no real-time expiry;
- an abandoned or disconnected recovery run does **not** consume an attempt;
- third failure → courier/tax return, **never deletion**;
- protected categories (created items, signature gear, cosmetics, story rewards, progression) never lost;
- any party member or a parent account may run the recovery for the owner;
- admin recovery path, every cache event logged.

This requires strong transaction/idempotency tests — the §30 recovery rows in PLAN land with this package.

## Stage 3 gate

- one shared unlock remains correct across restarts;
- concurrent unlock test passes;
- second region loads through same content pipeline;
- player storage survives restore;
- personal room works well on phone;
- reset covenant is communicated to the children.

---

# 13. STAGE 4 — Children's drawings become real game content

## Core question

> Can a paper drawing reliably become a safe, balanced, recognizable game item without requiring bespoke programming?

This is the project's most distinctive milestone.

## 4.0 — Mandatory drawing-pipeline spike

Before building creator UI, use **one real child drawing**.

Measure the real process:

1. photograph paper;
2. upload;
3. crop/clean background/shadows;
4. preserve recognizable drawing;
5. turn into inventory art;
6. create papercraft weapon mesh;
7. attach to rig;
8. create item definition;
9. validate content;
10. deploy;
11. child sees it in game.

Record actual parent labor in minutes/hours.

If Tier 1 art cleanup is unexpectedly labor-intensive, preserve Tier 0 as the guaranteed feature and simplify Tier 1.

---

## 4.1 Submission data model

States:

```text
draft
submitted
needs_changes
approved
live
```

Retain:

- original photo;
- creator ID;
- creation date;
- name;
- weapon family;
- star allocations;
- special template mapping;
- drawback(s);
- balance version;
- art version;
- approval history.

Nothing becomes visible to another child without parent approval.

---

## 4.2 Kid-facing creator

Keep it understandable:

- choose weapon family;
- name it;
- allocate 10 stars among Power / Speed / Reach / Control / Magic;
- choose/describe special;
- optional drawback from controlled list.

The child chooses identity, not raw damage numbers.

---

## 4.3 Effect-template library

Implement the initial small library only as needed by real drawings, aiming toward roughly:

- stun/grab;
- burn;
- knockback;
- slow;
- lifesteal;
- bonus-vs-family;
- stamina refund;
- cosmetic companion/effect.

Each template is parameterized and server-known.

No bespoke item scripting for ordinary submissions.

---

## 4.4 Balance formula

Now—not earlier—define the first production formula from real item examples.

Rules remain:

- Power x Speed normalized toward similar expected DPS;
- created items live around solid mid-tier;
- Reach/Control/Magic trade against raw simplicity;
- max 1–2 drawbacks;
- cosmetic drawbacks do not award power;
- derived stats are recalculated from definition/balance version, not frozen in each instance.

---

## 4.5 Tier 0 art

Guaranteed pipeline:

photo -> cleanup -> transparent/cropped image -> inventory icon/card.

This alone must be reliable enough to promise to children.

---

## 4.6 Tier 1 papercraft weapon

Cleaned drawing becomes a flat/slightly extruded mesh attached to the standard socket.

Success metric is recognition:

> child immediately says "that's mine."

Not visual sophistication.

---

## 4.7 Admin review screen

Build the first `/apps/admin` UI and **only one major screen**:

- view submission;
- inspect cleaned image;
- choose family;
- adjust/confirm stars;
- map special to template;
- request changes;
- approve;
- generate content package/art output.

Avoid grand admin dashboard scope.

---

## 4.8 First Forged ownership

The first live instance:

- belongs permanently to creator;
- is untradeable;
- retains creator provenance;
- cannot be accidentally deleted by normal game systems;
- can later coexist with world-loot copies of the approved design.

## Stage 4 gate

At least one child:

1. draws an item on paper;
2. sees it go through the forge process;
3. receives the First Forged item;
4. equips and uses it in a multiplayer adventure;
5. recognizes it as their creation.

---

# 14. STAGE 5 — Economy and social systems

Do not assume every listed feature ships. Stage 2–4 behavior determines priority.

## 5.1 Coins

Implement ledger-backed currency:

- every source/sink recorded;
- balance derived/maintained transactionally;
- admin audit query;
- no client-authored balance.

## 5.2 Vendors

Start with one vendor and a tiny catalog.

Use coins for:

- cosmetics;
- consumables;
- modifications;
- useful but non-dominating equipment.

## 5.3 Gifting

Prefer controlled gifting before open trading.

Potential flow:

- choose item;
- choose friend;
- server validates ownership/tradeability;
- recipient accepts or item lands in gift box;
- one DB transaction;
- provenance logged.

## 5.4 Trading — conditional

Implement only if real play demonstrates that direct trade will improve the game.

If built:

- both sides lock offer;
- both accept;
- one transaction;
- disconnect cancels safely;
- protected/First Forged/story items untradeable;
- admin reversal path;
- complete audit history.

No auction house.

## Stage 5 gate

The economy creates choices but does not dominate play or create serious older/younger-player inequality.

---

# 15. STAGE 6 — Player-created adventures

## Goal

Let children create stories **without becoming level designers**.

## Initial feature: treasure hunt

Creation flow:

1. choose real owned reward;
2. reward moves into escrow immediately;
3. choose approved hiding anchor;
4. create one or more clues/signs;
5. choose recipients;
6. submit for parent approval if any free-form text is visible;
7. publish;
8. recipient discovers/claims exactly once.

## Rules

- hunts never mint the reward;
- one reward can only be claimed once;
- removing/cancelling hunt returns escrow safely;
- world anchors are predefined;
- expired/abandoned hunts cannot clutter the world permanently;
- all player-visible child-authored text remains approval-gated.

## Expansion only if successful

Later possibilities:

- clue chains;
- NPC clue handoff;
- simple switches;
- creator-chosen encounter from approved templates;
- decorative signs/statues.

No Minecraft-style unrestricted building.

---

# 16. STAGE 7 — Living world

This is intentionally open-ended and evidence-driven.

Possible workstreams:

## Pets

- never die from absence;
- mood/bond rather than punishment;
- small exploration utility;
- no meaningful combat advantage;
- eventually drawn companions.

## New regions

Each new region should add at least one genuinely new experience rather than only a new visual skin.

Examples:

- darkness/torch cooperation;
- vertical cliffs/elevation;
- weather/environment hazard;
- stealth/avoidance;
- puzzle-heavy ruins;
- frightening late-game zone.

## Bosses

After boss #3, inspect common behavior and only then design a reusable boss authoring model.

## World events

Use GM arming for canonical events where absence would cause social disappointment.

## Chronicle

Build only if real players care about missed/old events enough to justify replay/history features.

## GM tooling

Expand only around real recurring parent labor.

If a CLI task is performed weekly and is annoying, that is evidence for a UI.

---

# 17. Cross-stage technical workstreams

Some work continues throughout stages rather than belonging to one feature.

## 17.1 Security

At every stage with a server:

- validate all client input;
- never trust durable client claims;
- rate-limit auth/admin-sensitive operations;
- separate admin/game network exposure;
- protect secrets through environment/config;
- dependency updates reviewed deliberately;
- no Docker socket/host filesystem access;
- log security-relevant rejects without collecting unnecessary personal data.

## 17.2 Performance

Every new region/major asset pass should check:

- cold load;
- FPS;
- draw calls;
- texture memory;
- animated entity count;
- thermal behavior;
- Safari background/reload behavior.

KTX2/Basis becomes required by Stage 2 for meaningful texture content.

## 17.3 Accessibility/age span

Every mechanic asks:

- can a 5–7-year-old understand the cue without reading;
- can the youngest contribute without twitch skill;
- can assist widen difficulty without announcing inferiority;
- does the mechanic remain interesting for a 10–13-year-old;
- does color have redundant shape/motion coding.

## 17.4 Reliability

From Stage 0B onward:

- backup daily;
- offsite copy;
- monitor backup success;
- restore-test regularly;
- idempotency for durable grants/unlocks;
- transaction boundaries around item/currency transfer;
- client version visible in debug data.

## 17.5 Content validation

CI validator grows with content schema and checks:

- unique stable IDs;
- valid references;
- required locale keys;
- valid asset paths;
- valid loot/item references;
- no deleted live definitions;
- schema version compatibility.

---

# 18. Decision points we deliberately postpone

Do **not** solve these now unless testing forces the issue:

- exact final art style;
- exact stat formulas;
- full economy rates;
- auction house;
- broad PvP;
- free-text chat;
- procedural world generation;
- complex housing/building;
- walkable private homes;
- generalized quest editor;
- generalized boss engine;
- pet implementation;
- trading;
- Chronicle/echo bosses;
- dozens of weapon classes;
- sprint, dash and jump (design notes in PLAN §29 — jump in particular changes the world model, not just the controls);
- mobile app-store packaging.

The architecture keeps room for them without paying their complexity cost now.

---

# 19. Main risks and responses

| Risk | Early warning | Response |
|---|---|---|
| Combat is not fun | kids stop after one fight | remain in 0A; do not network it yet |
| Touch controls are awkward | missed buttons/browser gestures | simplify controls, adjust camera/UI |
| Rig/art pipeline is fragile | repeated manual animation repair | replace rig/asset pipeline before 0B |
| iOS tab lifecycle causes frustration | frequent manual relog/rejoin | solve in 0B; automatic cold-rejoin is mandatory |
| Networking makes combat mushy | online toy feels worse than offline | remain in Stage 1 and fix presentation/protocol |
| Scope creep | tasks from future stages enter PRs | reject PR/split issue; stage scope is hard |
| Content creation takes too long | each room/item requires code | strengthen data-driven content/tools |
| Drawings require too much parent labor | Tier 0/1 takes hours each | simplify pipeline; guarantee Tier 0 only |
| Younger kids cannot contribute | older players carry all action | widen assists/non-twitch roles/co-op mechanics |
| Gear grind dominates | kids compare numbers instead of adventure | narrow power band; reward variety/cosmetics/knowledge |
| Economy inflation | coins stop mattering | tune sources/sinks only after measured play |
| Server/world loss | backup exists but cannot restore | automated restore drill before sacred persistence |
| AI agents over-refactor | architecture drifts between tasks | small scoped prompts + plan/ADR constraints |
| PvP hurts the youngest | one child stops wanting to enter the ring; tears after duels | assists apply in PvP; no score/streak shown; per-account PvP flag; normalized Arena gear |
| Arena becomes a second vertical slice | v2 features creep into Stage 1 | ship Arena v1 only; the Arena is permanent and grows later by accretion |
| Kids lose interest during the long gap to Stage 2 | they stop asking about the game | publish 0A to a URL and keep the Arena permanently reachable; add small things between stages |
| Developer motivation gap | two quiet weeks become three quiet months | §2.7 stall rule; stage logs; deployed world runs untouched; resume document kept current |
| A friend's device or family turns out to be a blocker | discovered at the first multi-household test, late | test one friend's actual phone during PREP-03/0A-1, not at Stage 0B |
| Kid Test 0 gives a false signal | one bad session decides years of work | §7 method: youngest first, separately, assist on/off, second sitting days later |

---

# 20. Stage report template

At the end of every stage create:

`docs/stage-reports/STAGE-X.md`

Use:

```markdown
# Stage X report

## Outcome
PASS / ITERATE / STOP

## What was built
...

## Acceptance criteria
- [x] ...
- [ ] ...

## Real-device results
...

## Child-playtest results
...

## Performance/network findings
...

## Architecture changes
None / list ADRs

## Known problems
...

## Scope explicitly deferred
...

## Decision for next stage
...
```

This becomes extremely valuable when resuming the hobby project after a long break or giving context to an AI coding agent.

---

# 21. Immediate next actions

The project should now move into **PREP + Stage 0A**, not more whole-game design.

Execute in this order:

1. **Create/prepare the GitHub monorepo** and commit PLAN v2.1 + this roadmap.
2. **Add project agent instructions (`CLAUDE.md`)** with hard Stage 0A scope boundaries.
3. **Bootstrap Babylon + Vite + TypeScript** and load a blank test scene on the iPhone.
4. **Select one representative humanoid source** and start `assets/ATTRIBUTION.md`. A rough rigged pack humanoid is enough for 0A-1; the full rig gate is 0A-2.
5. **Create the one tiny grid-authored arena** on the locked coordinate convention.
6. **Lock the fixed camera angle/zoom through real-phone testing.**
7. **Implement left-thumb movement.**
8. **Implement dodge.**
9. **Implement hammer hold/release GOOD/GREAT/PERFECT** with the ~1.2 s charge and the concentric bands — **including the assist toggle.**
10. **Implement one telegraphed enemy.**
11. **Add impact/audio feedback, the debug overlay and the in-page console.**
12. **Publish the toy to a static URL.**
13. **Run Kid Test 0** — two sittings, days apart.
14. Only after a GO: **Stage 0A-2** — the full rig pipeline gate, then the device baseline.
15. Then **Stage 0B networking on KOCorp.**
16. Then **Stage 1: build the permanent Arena**, and run **Kid Test 1** in it before any adventure content.

The next practical task is therefore **PREP-01 through PREP-04**, followed immediately by **0A.1 Client Foundation**.

---

# 22. What I would ask the coding agent to do first

The first implementation task should stay intentionally small:

> Set up the Stage 0A client foundation for the Browser Co-op Adventure Game according to PLAN_v2.1.md and GAME_ROADMAP_v1.md. Create a pnpm/TypeScript/Vite Babylon.js client that renders a minimal full-screen scene, uses modular Babylon imports, supports a Preact HTML overlay, handles resize/orientation, and runs cleanly on mobile Safari/Chrome. Do not add networking, Colyseus, database code, accounts, inventory, combat, content systems beyond the minimal bootstrap, or future-stage infrastructure. Add typecheck/build/test scripts and document how to run the client locally and expose it to a phone on the LAN. Stop after the client foundation works and report exactly what was created and any assumptions.

Then we review that result before asking the agent to touch the rig, controls, or combat.

---

# Final roadmap rule

**Do not optimize for reaching Stage 7. Optimize for proving each stage cheaply enough that we are willing to change direction.**

The earliest irreversible investment should come only after the children have already shown that the core game is enjoyable.
