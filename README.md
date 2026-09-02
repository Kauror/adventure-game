# Browser Co-op Adventure Game

A small, private, persistent 2.5D cooperative adventure game for one family's children and
their friends, played in a phone browser. Players explore one shared world, fight monsters,
solve puzzles together, and gradually turn their own drawings into real game content. It is
built for roughly ten invited accounts, typically about four players at a time — not a public
service.

## Status

**Stage 0A-1 — client foundation only.**

There is no game yet. The repository currently contains the toolchain, a grid-authored test arena
loaded from structured content, a fixed 2.5D camera, and a character that can be walked around
with a touch joystick, keyboard or gamepad. There is deliberately **no** networking, server,
database, combat, enemies, loot or persistence.

Movement works on a phone (left thumb), on a laptop (WASD or arrows) and with an attached
controller (left stick or d-pad).

The authoritative documents are:

- [`PLAN_v2.1.md`](./PLAN_v2.1.md) — architecture and design (content revision v2.2)
- [`GAME_ROADMAP_v1.md`](./GAME_ROADMAP_v1.md) — ordered build programme and gates
- [`CLAUDE.md`](./CLAUDE.md) — rules for coding agents
- [`docs/decisions/`](./docs/decisions) — architecture decision records
- [`docs/stage-logs/`](./docs/stage-logs) — what each stage actually did

> **Do not implement future stages early.** The roadmap is sequenced so each stage is proven
> cheaply before the next one is built. See `CLAUDE.md`.

## Prerequisites

- **Node.js 24** (see `.nvmrc`)
- **pnpm 11** — `npm install -g pnpm`, or enable Corepack
- **Git LFS** — `git lfs install` (once per machine; required before any binary asset lands)

## Install

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Then open <http://localhost:5173>.

### Testing on a phone over the LAN

```bash
pnpm dev:host
```

Vite prints a **Network:** URL containing this machine's LAN address — open that on the phone.
Both devices must be on the same network, and the firewall must allow inbound connections on
port 5173.

Because the client is the primary product, prefer testing on a real phone early and often.

## Commands

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Dev server on localhost                                  |
| `pnpm dev:host`     | Dev server exposed on the LAN, for phone testing         |
| `pnpm build`        | Production build                                         |
| `pnpm preview`      | Serve the production build locally                       |
| `pnpm typecheck`    | TypeScript, no emit                                      |
| `pnpm test`         | Vitest                                                   |
| `pnpm lint`         | ESLint                                                   |
| `pnpm format`       | Prettier, write                                          |
| `pnpm format:check` | Prettier, check only                                     |
| `pnpm check`        | Everything CI runs: format, lint, typecheck, test, build |

Run `pnpm check` before considering any task finished.

## Repository layout

```text
apps/client            Vite + Babylon.js + Preact browser client
packages/game-core     pure game rules — no Babylon, no engine, no runtime
packages/content       authored game content (regions), data only
assets                 external art/audio, with ATTRIBUTION.md
docs/decisions         architecture decision records
docs/stage-logs        per-stage record of what was built and learned
```

`game-core` must never import Babylon or Colyseus: the same rules will run on the server and be
unit-tested in milliseconds. `content` holds data and no logic — validating it is game-core's job.

An `apps/server`, `packages/game-protocol` and `packages/tools` appear in the plan but **do not
exist yet**; they are created when the roadmap reaches them, not before.
