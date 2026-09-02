# 0007 — Dodge and dash are different mechanics

- **Status:** accepted
- **Date:** 2026-08-28
- **Stage:** 0A.6

## Context

Sprint, dash and jump were noted as wanted (PLAN §29), and dash looked close
enough to dodge that building both risked two buttons doing nearly the same
thing — which is exactly what confuses the youngest players the design has to
serve (PLAN §1, "fair for the youngest").

The question was settled by asking what each one is _for_:

> a dash is like a quick sprint; a dodge is getting ahead of / away from an
> attack — dodge is part of a fighting mechanic

## Decision

**They are separate mechanics, and dodge is the combat one.**

**Dodge** — built now, at 0A.6. A short committed burst whose purpose is
evasion, so it carries an invulnerability window and a cooldown, and it ignores
steering once started. It belongs to the fighting loop: read the telegraph,
dodge, counterattack. Its cost is the cooldown, and its reward is not being hit.

**Dash** — still deferred. A movement burst with no i-frames and no combat role:
covering ground, not escaping an attack. If it ships it belongs with sprint, as
traversal, and it should feel different from dodge rather than being a second
copy of it.

The practical consequence is that the two must remain **distinguishable to a
child**. If dash is ever built, it needs its own read — different cue, different
cost, ideally not a button that competes for the same thumb at the same moment.
The moment a player has to think "which of my two nearly-identical dodges is
this", the design has failed.

## Consequences

- `dodge.ts` lives in game-core, not the client: PLAN §4 lists dodge among the
  things the server decides ("I pressed dodge" → the server owns whether the
  cooldown allowed it), so the rule has to be shared.
- The invulnerability window is generous and opens **immediately** on the burst,
  rather than sitting in a tight band near its middle. PLAN §11 requires
  anticipation over reaction: a five-year-old who presses dodge as the wind-up
  plays should be rewarded. Mastery comes later from spacing and cooldown
  management, never from a narrower window.
- Nothing reads `isInvulnerable` yet — damage arrives with the enemy at 0A.8.
  The window exists now because it is what makes a dodge a dodge rather than a
  teleport, and because the assist system (0A.7) will widen it for younger
  players.
- The dodge acceptance criterion — "reliably dodge the test enemy's telegraphed
  attack" — **cannot be closed until 0A.8 exists**. What 0A.6 delivers is the
  mechanic and its feel; whether it defeats a real attack is verified then.
