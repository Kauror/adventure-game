# 0001 — Foundation stack

- **Status:** accepted
- **Date:** 2026-08-28
- **Stage:** PREP / 0A.1

## Context

The project is a solo, part-time (5–10 h/week), AI-agent-assisted build of a private browser
game for children, targeting phones first. The stack was chosen in `PLAN_v2.1.md` §3; this
record captures it and the concrete details settled while bootstrapping.

## Decision

**Language and tooling:** TypeScript (strict), pnpm workspaces, Vite, Vitest, ESLint, Prettier.
Node 24 LTS, pinned in `.nvmrc` and `engines`; the package manager is pinned via
`packageManager` in the root `package.json`.

**Rendering:** Babylon.js via modular `@babylonjs/core` imports only — never a monolithic CDN
bundle, so tree-shaking works from the first commit. **No Havok**: the server owns simulation
later, so a client physics engine has no job and would cost WASM weight on phones. WebGL2 is
the baseline path; WebGPU is a measured opt-in later and must not shape the architecture.

**UI:** Preact, mounted as an HTML overlay that is structurally separate from the Babylon
canvas, so future HUD work is ordinary responsive HTML/CSS. `@preact/preset-vite` installs the
`react -> preact/compat` aliases by default, so a React-only library can be adopted later
without migrating the UI stack.

**TypeScript version pinned to 6.x.** TypeScript 7 (the native port) is available and resolves
as `latest`, but `typescript-eslint` does not support it yet — linting fails outright with
"typescript-eslint does not support TS 7.0" (typescript-eslint issue #10940). The documented
alternative is running TS 6 and TS 7 side by side, which means two compilers in one repository:
exactly the kind of thing that confuses future agents for no gain at this stage. One compiler
that every tool agrees on is worth more than a faster one. **Revisit when typescript-eslint
supports TS ≥7.1.**

**Git LFS for binary game assets.** Configured in `.gitattributes` before the first `.glb`
lands, because extracting binaries from history later is miserable. Formats that are never
small (`.glb`, `.ktx2`, `.basis`, `.fbx`, `.blend`) are LFS-tracked globally; bulk image and
audio patterns are scoped to `assets/` so small UI icons inside `apps/*/src` stay as ordinary
git objects. `.gltf` is JSON and stays a normal text file. Each machine still needs
`git lfs install` once.

## Consequences

- One TypeScript version, one lint config, one formatter; CI enforces all of them.
- Babylon stays tree-shakeable, which matters for the phone load budget.
- Adopting TypeScript 7 later is a version bump plus a lint-toolchain check, not a migration.
- Git LFS must be installed on every machine that clones the repository.
