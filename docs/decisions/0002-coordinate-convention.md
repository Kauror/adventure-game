# 0002 — Coordinate convention

- **Status:** accepted
- **Date:** 2026-08-28
- **Stage:** PREP / 0A.1 (recorded); consumed by 0A.2

## Context

The server will eventually simulate a simplified world (grid tiles, elevation, collision radii)
while the browser renders a 3D scene from the same data. If those two ever disagree about what
a unit means, every later bug becomes ambiguous. The convention is therefore locked before any
content exists.

## Decision

```text
1 Babylon/world unit = 1 metre
1 navigation tile     = 1 m x 1 m
X = east/west
Y = elevation
Z = north/south
```

Region files, server simulation, client placement and content tooling all use this convention.
**No second coordinate system may leak into gameplay APIs** — no pixel space, no row/column
indices masquerading as positions.

The constants live in `@adventure/game-core` (`src/world.ts`), **not** in the client: the future
server simulates against the same grid, so this is a game rule rather than a rendering detail.
The client re-exports them from `gameConfig.ts` for convenience only.

### Grid-to-world mapping (added at 0A.2)

- A region occupies `x ∈ [0, width]` and `z ∈ [0, height]` metres. Its south-west corner is at
  the world origin. Nothing is centred, so the conversions carry no offset term.
- `col` increases with **+X (east)**.
- **`rows[0]` is the NORTH edge and `+Z` points north.** Row index therefore increases
  southward, so converting between row and Z involves a `height - 1 - row` flip.

The flip exists so an authored text map reads north-up, the way a person looks at it. The
alternative — an identity mapping with a vertically mirrored picture — trades a tested
five-character expression for a permanent source of "why is the map upside down" confusion.

The flip is confined to `tileCentreToWorld` and `worldToTile` and is covered by a round-trip
test over every tile. **Do not reimplement it anywhere else.**

## Consequences

- Sizes in code read as real-world measurements (a 1.8 m character, a 20 × 14 m arena).
- Tile ↔ world conversion has exactly one implementation, in game-core, with tests.
- Anything outside the grid is treated as non-walkable, so the grid itself bounds movement.
- Asset import must scale models to metres; this belongs in the art pipeline notes at 0A-2.
