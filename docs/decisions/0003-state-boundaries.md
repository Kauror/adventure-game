# 0003 — State boundaries

- **Status:** accepted
- **Date:** 2026-08-28
- **Stage:** PREP / 0A.1 (recorded); enforced from Stage 0B onward

## Context

A persistent shared world that children care about must not lose their progress, but it also
must not try to write every combat tick to a database. Each kind of state needs exactly one
owner, decided before the server exists.

## Decision

Four kinds of state, one owner each:

1. **Content definitions → Git.** Item, monster, quest and region definitions, balance data,
   stable IDs and schemas. Content reaches the server through a build/deploy step. Admin tools
   never edit content — they act on runtime state only.
2. **Durable player/world state → PostgreSQL.** Accounts, ownership, inventory, coins and
   ledger, world flags and events, approved submissions, and any checkpoint that must survive a
   server restart.
3. **Active session state → Colyseus memory.** Current positions, transient monster HP,
   in-flight cooldowns — discardable unless a designed checkpoint persists it.
4. **Local presentation state → the browser.** Joystick position, camera shake, animation and
   VFX state, local UI state, device preferences.

**Crash rule:** anything we would be genuinely upset to lose when the server process dies must
either already be in PostgreSQL, or be deterministically reconstructable from PostgreSQL plus
content definitions.

## Consequences

- PostgreSQL and Colyseus are **future-stage** dependencies (Stage 0B). They are deliberately
  not installed now, and nothing in Stage 0A may assume them.
- Only category 4 exists today, in the client.
- When the server arrives, item instances store a definition ID plus provenance, and derive
  stats at load time — so rebalancing never requires migrating player data.
