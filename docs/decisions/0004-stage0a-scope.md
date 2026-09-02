# 0004 — Stage 0A scope firewall

- **Status:** accepted
- **Date:** 2026-08-28
- **Stage:** 0A

## Context

The most common way a hobby game project dies is building infrastructure for a game that turns
out not to be fun. The roadmap therefore answers "is this fun on a phone?" before anything is
networked, and puts a hard boundary around Stage 0A so that answer arrives cheaply.

## Decision

**Stage 0A is a purely offline browser toy.** Nothing in it may add: networking, a game server,
Colyseus, PostgreSQL, an ORM, authentication, accounts, persistence, WebSockets, Docker
deployment, multiplayer, inventory, loot, economy, village, Arena, PvP, quests, pets, the
drawing pipeline, an admin UI, a physics engine, or a service worker.

"No networking" means no _game_ networking. Publishing the static build to a host is explicitly
allowed and is in fact a Stage 0A task (0A.11) — the children need to reach the toy themselves
for the second Kid Test 0 sitting.

Empty placeholder modules for future systems are also forbidden: the roadmap says not to create
complexity merely to resemble the final repository tree. Packages such as `game-core` and
`apps/server` are created when the stage that needs them arrives.

**Stage 0A-1** builds the combat feel: fixed camera, one hammer, one telegraphed enemy,
movement, dodge, and a GOOD/GREAT/PERFECT release timing mechanic, plus an assist toggle.
**Kid Test 0** then gates everything else. **Stage 0A-2** follows with the character rig
pipeline and the device baseline.

**None of those combat features are implemented by task 0A.1**, which is the client foundation
only: engine, scene, render loop, resize/orientation handling, UI overlay and i18n.

## Consequences

- Stage 0A stays measurable in weekends rather than months.
- The fun question is answered before any infrastructure is paid for.
- Agents that "helpfully" scaffold future systems are violating this ADR; the correct response
  to a task that seems to need future-stage work is to stop and report.
