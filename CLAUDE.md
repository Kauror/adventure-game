# Instructions for coding agents

Read this before touching anything. It is short on purpose.

## 1. Read the specification first

- `PLAN_v2.1.md` — architecture and design. **Filename says v2.1; the content revision is v2.2.**
- `GAME_ROADMAP_v1.md` — the ordered build programme, work packages and gates.

Both are authoritative. This file does not restate them.

## 2. Work only on the current task

The current position is recorded in `docs/stage-logs/`. Right now: **Stage 0A-1**, and the
foundation task (0A.1) is complete.

- Do **not** implement future-stage features, even if they seem small or obvious.
- Do **not** build a generalised system until two or three concrete cases demand it.
- Do **not** refactor code unrelated to your task.
- If a task looks like it needs future-stage work to be done properly, **say so and stop** — do
  not quietly expand scope.

## 3. Protected scope — no server work before Stage 0B

Nothing in this repository may add networking, a game server, Colyseus, PostgreSQL, an ORM,
authentication, accounts, persistence, Docker deployment or WebSockets until the roadmap
reaches Stage 0B. Stage 0A is a purely offline browser toy.

"No networking" means no _game_ networking. Deploying the static build to a host is fine.

## 4. Architecture rules that outlive any single task

- **TypeScript strict stays strict.** Do not relax `tsconfig.base.json`, and do not add `any`
  to make an error go away.
- **`game-core` must never import Babylon** (or Colyseus). Game rules are pure TypeScript so
  they can run identically in the browser and on the server, and be unit-tested in
  milliseconds. That package does not exist yet — when it does, this rule is absolute.
- **Content will be data-driven.** New items, monsters, quests and regions should eventually
  be data, not code. Engine code changes when a genuinely _new kind of behaviour_ is needed,
  not when another instance of an existing behaviour is added.
- **All player-visible text goes through i18n keys.** Estonian is the authoring locale. Never
  inline a display string in a component; add a key to `src/i18n/et.ts` and use `t()`.
- **Mobile browsers are the primary target**, not the desktop you are developing on. Assume no
  mouse, no keyboard, no hover. Assume the phone will lock, rotate and reload mid-session.
- **WebGL2 is the rendering baseline.** WebGPU is a measured opt-in later; do not build
  WebGPU-specific architecture.
- **KOCorp (the Unraid host) is a future deployment target, not an application dependency.**
  Everything stays containerised and environment-configured so the stack can move hosts
  without application changes.
- **Binary game assets go to Git LFS** (see `.gitattributes`), and every external asset gets an
  entry in `assets/ATTRIBUTION.md` in the same commit.

## 5. Definition of done

A task is done only when:

1. it works;
2. `pnpm check` passes (format, lint, typecheck, tests, production build);
3. mobile behaviour was considered if the task touched input, rendering or session lifecycle;
4. a short note was added to the current stage log describing what changed and what was learned.

## 6. Report, do not silently decide

If you had to make an assumption, choose between two reasonable designs, or work around a
tooling problem — **say so explicitly in your final report**. Silent architectural drift across
many small tasks is the main way this project can fail slowly.
