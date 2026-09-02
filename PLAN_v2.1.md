# Browser Co-op Adventure Game — Concept & Technical Plan (v2.2)

Revised 2026-08-28. v2.1 added the final pre-build locks for Stage 0A: camera, first combat toy, rig/animation pipeline gate, coordinate/state conventions, a conservative device stress test, implementation-neutral Colyseus sync wording, and a real-child playtest gate before networking. **v2.2 incorporates the KOCorp hosting decision and the permanent Arena / Training Grounds** (§14a, §22, §30).

> **Filename note:** this file stays `PLAN_v2.1.md` so existing roadmap and coding-agent references keep resolving. The *content* revision is v2.2 — cite it as "PLAN_v2.1.md (content revision v2.2)".

---

## 0. Fixed parameters & decision log

### Fixed parameters (decided, not open)

| Parameter | Value |
|---|---|
| Players | Siblings + friends, **ages 5–13** (wide mix — includes pre-readers) |
| Devices | iPhones (Safari; weakest known device: **iPhone 13 mini**), Android phones, tablets (iPad/Android), also PCs/laptops |
| Networks | Mixed from day one: home Wi-Fi, friends' homes, **mobile data** — internet-first, never LAN-only |
| Supervision | The game must be **fair and safe unsupervised**; the parent acts as Game Master asynchronously (before/after sessions), never as a required live referee |
| Development | Solo, **5–10 h/week**, heavily AI-agent-assisted (Claude Code); no prior realtime-networking experience |
| Timeline | No deadline — build as we go; stages are timeboxed anyway to force scope cuts instead of drift |
| Base 3D art | CC0/low-cost low-poly asset packs (Kenney, Quaternius style), restyled — not hand-modeled, not AI-generated |
| Login | **Email + password**, admin-created accounts only (no public registration) |
| Language | **Estonian** is the authoring language; all text behind i18n keys from day one |
| Hosting | **KOCorp Unraid** — fixed development, test and initial production host from Stage 0B onward (AMD Ryzen 5 7430U, 32 GB RAM, SSD-backed, gigabit Ethernet; Cloudflare for public game access, Tailscale for private admin). A deployment *target*, never a dependency: every service stays containerized and environment-configured so the stack can move to a VPS without application redesign (§22) |
| Camera | **Fixed 3/4/isometric presentation; no player-controlled rotation.** Orthographic or very weak perspective; exact angle/zoom tuned in Stage 0A |
| Stage 0A combat toy | **One hammer, one enemy, movement + attack + dodge, one telegraphed timing mechanic.** No abilities, loot, persistence or networking |

### Major changes from v1 (and why)

1. **Nakama → Colyseus (Node.js).** Nakama's TypeScript runtime is goja — a sandboxed pure-Go ES5 interpreter: no step debugger, no hot reload (bundle → restart container → read Go logs), no Node APIs or WASM, ~20× slower than V8 on CPU-heavy code, and it needs a separate tsc/rollup ES5 build chain (esbuild cannot target ES5). That is the worst possible iteration loop for an AI-agent-assisted solo dev and it would forever constrain the shared `game-core` package. Nakama's headline features (public accounts, matchmaking, discovery) were all disabled by our own §9 design anyway. Colyseus (0.17+, actively maintained, MIT, self-hosted) is Node-native TypeScript: `game-core` runs identically on client and server, Vitest tests the real server code, rooms map directly onto adventure instances, and client reconnection support is built in — which matters double given no prior netcode experience.
2. **Tiered authority — no client prediction/reconciliation in v1.** Strict server authority for everything durable; client-authoritative movement with server sanity checks. (§4)
3. **Grid-first world authoring.** The walkability grid is the server's truth; the 3D scene decorates it. (§7)
4. **Mobile session lifecycle is a first-class design section**, not a test case. Phone lock and tab reload are the *normal* session, not the edge case. (§6)
5. **Resequenced stages**: device baseline + combat-feel proof (offline) before any networking. (§30)
6. **Assist system for the 5–13 span** and anticipation-based (not reaction-based) timing combat. (§11)
7. **Softened loot risk** (the floor is taxed, never zero), boss "arming" for canonical kills, mid-adventure checkpoints. (§12–§14)
8. **Drawing pipeline defined in tiers** (only Tiers 0–1 are promised to the kids); specials via a parameterized effect-template library, never bespoke code. (§19)
9. **Content lives only in git**; the GM tool touches runtime state only; item instances store definition ID + provenance, stats derive at load. (§20)
10. **Ops decisions locked**: Cloudflare Tunnel for game traffic + Tailscale for admin, restore-tested offsite backups, protocol-level bot clients for multiplayer tests, no free-text chat, telemetry from Stage 0B.
11. **Explicitly deferred** (ideas kept, design postponed until after kids play the slice): Chronicle/echo bosses, player trading, treasure hunts, generalized boss engine, admin dashboard UI, exact balance math. (§29)

### v2.1 pre-build locks

1. **Camera is fixed.** Players never rotate or manage it; Stage 0A only tunes angle, zoom and orthographic-vs-weak-perspective feel.
2. **Stage 0A combat is specific, not generic:** one hammer, one telegraphed enemy, movement, attack, dodge and a hold/release timing window.
3. **A real GLB character pipeline is a Stage 0A-2 gate** (see v2.2 fix 6): shared rig → walk/attack/dodge → hand socket → attached weapon → texture variant. The project never ships a capsule-only prototype — but the rig gate runs *after* Kid Test 0, so it can never delay the answer to "is this fun?"
4. **Coordinates are unified:** 1 world unit = 1 metre; 1 navigation tile = 1 m × 1 m; X east/west, Y elevation, Z north/south.
5. **State boundaries are explicit:** content definitions in git, durable player/world state in PostgreSQL, disposable active-session state in Colyseus memory, presentation-only state in the browser.
6. **Device memory testing uses a representative stress ladder, not a hunt for Safari's exact kill ceiling.** Budgets are intentionally conservative.
7. **Colyseus synchronization method is an implementation detail.** The contract is authoritative shared state plus smooth client presentation, not a commitment to full-region snapshots.
8. **Kid Test 0 sits between 0A and 0B.** At least one younger and one older child try the toy with almost no explanation; networking does not start until the controls and combat are understandable and replayable.

### v2.2 additions (KOCorp hosting + permanent Arena)

1. **KOCorp Unraid is the fixed dev/test/initial-production host** from Stage 0B onward, with a mandated container layout, isolation rules and measure-then-limit resource policy (§22). Portability is preserved by contract rather than by hedging.
2. **Stage 1 becomes the permanent Arena / Training Grounds** instead of an abstract "online combat proof" (§14a, §30). The Arena is real playable content for the children *and* the project's permanent QA, graphics, balance and regression playground — explicitly not throwaway prototype code.
3. **Opt-in, consequence-free PvP exists only inside the Arena's marked ring** (§14a): no rankings, scores, rewards, currency, durability loss, loot transfer or persistent power of any kind, and never in safe areas.
4. **Kid Test 1 sits between Stage 1 and Stage 2.** The children get the Arena with minimal direction and we record what they actually *do* — emergent behaviour observed before the project invests in adventure content.
5. **Arena-first weapon pipeline:** every new weapon family, and later every child-designed weapon, is tested in the Arena before it is allowed into real content (§14a, §19).

### v2.2 review fixes (applied the same day)

6. **Stage 0A splits into 0A-1 (combat feel) and 0A-2 (rig pipeline + device baseline)**, so Kid Test 0 happens weeks earlier and is not gated behind measurement work. A pre-agreed cut list decides what goes first if 0A-1 overruns. (§30)
7. **Kid Test 0 gets a method, not just a checklist**: youngest first, separately, assist on *and* off, and a **second sitting days later whose real question is "do they come back unprompted?"** The 0A toy is therefore **published to a static URL** (Cloudflare Pages — no server, no tunnel), which also keeps the children attached during the long gap to Stage 2. (§30)
8. **Assist exists in Stage 0A as a local toggle**, before accounts exist, so a five-year-old cannot produce a false STOP on the most important gate. (§11)
9. **An in-page console (eruda/vConsole) ships from the first build** — iOS Safari cannot be inspected from a Windows machine, so without it an iPhone bug has no diagnostics at all. (§25)
10. **Stage 2 carries no loot loss.** Wipe fails the adventure and costs nothing; the recovery cache, three attempts, courier floor and checkpoint banking move to **Stage 3**, where loot actually matters. (§13, §30)
11. **Every gate has an iteration budget** (max two ITERATEs of ≤2 weekends), plus a stall rule and a written pre-commitment about what would end the project. (§28, §30)
12. **Timing bands are specified as widths, not points**: ~1.2 s total charge, PERFECT 250–300 ms wide at ~75 % of the charge, GREAT the ~500 ms around it, GOOD everything else. (§11)

---

## 1. Core concept

A private, persistent 2.5D cooperative adventure game for a small group of children, played directly in the browser. Players explore one shared evolving world, fight monsters, solve puzzles, defeat bosses, discover secrets, collect equipment, and gradually contribute their own drawings, items and adventures to the game.

Not a Diablo clone; no endless level grinding.

| Pillar | Meaning |
|---|---|
| Adventure together | 1–6 players; teamwork, revival and cooperative puzzles matter |
| One shared world | Unlocking a bridge or defeating a major boss changes it for everyone |
| Skill over grind | Timing, dodging, knowledge and cooperation matter more than gear |
| **Fair for the youngest** | A 5-year-old and a 13-year-old must both have fun in the same party — invisible assists, non-twitch roles, no total-loss outcomes |
| Meaningful risk | Expedition loot is at risk on a party wipe — but the floor is taxed, never zero |
| Kids create the world | Drawn characters, weapons, pets, monsters become real content |
| Short sessions work | A 20–40 minute session accomplishes something |
| Secrets matter | Knowledge of locations, puzzles and hidden routes is progression |
| Expandable, not disposable | New systems extend existing mechanics |

Scale: a handful of simultaneous players, architected for 10–20 concurrent clients.

## 2. Visual direction & art sourcing

Real 3D underneath, presented as 2.5D: **fixed isometric/three-quarter camera, never player-controlled** (Minecraft Dungeons readability, not a free camera). Prefer orthographic or very weak perspective so movement, enemy telegraphs and touch controls remain predictable on a small phone. Stage 0A tunes the exact angle and zoom, but the player never has to manage the camera. This buys cliffs, stairs, bridges, caves, walk-behind occlusion, elevations, flying enemies, large bosses and lighting without adding camera-control complexity.

Art style: chunky low-poly geometry + pixel-art-inspired textures + strong silhouettes + simple lighting. Deliberately far below Minecraft Dungeons' fidelity — practical for mobile browsers.

**Art sourcing (decided):** CC0/low-cost packs (Kenney, Quaternius — both ship rigged, animated glTF humanoids and environment kits), restyled with palette/texture swaps toward the target look. Stock animation clips are retargeted onto **one shared humanoid rig** (§10). Blockbench is used for static props and weapons only; **rigging and animation happen in Blender** (Blockbench's glTF animation export has long-standing defects). Every animated asset passes through the Babylon Sandbox as a pipeline gate.

**Design rule:** no mechanic may be added that requires an animation nobody can produce.

## 3. Stack

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript | Client, server, shared rules, tooling — one language everywhere |
| Browser engine | Babylon.js | Tree-shakeable `@babylonjs/core` imports from commit one; **no Havok** (server owns simulation; a client physics engine has no job and costs WASM weight); WebGL2 is the baseline path, WebGPU a measured opt-in |
| Build | Vite | Client dev/build |
| UI | Preact + HTML/CSS | With `preact/compat` alias configured in Vite from day one |
| Game server | **Colyseus (Node.js)** | Rooms = village + adventure instances; built-in state sync + reconnection tokens; fixed-tick simulation loop |
| Database | PostgreSQL | Explicit relational schema: accounts, characters, item_instances, ledger_entries, world_flags, world_events, submissions |
| DB access | Drizzle (or Kysely) + migration tool | Typed queries; every schema change is a versioned migration from day one |
| Shared packages | game-core, game-protocol | Pure TS, zero Babylon/Colyseus imports in game-core |
| Assets | glTF/GLB + **KTX2/Basis textures** (by Stage 2) | PNG textures decompress to full RGBA in GPU memory — the usual thing that gets Safari tabs killed |
| 3D content | Asset packs + Blockbench (props) + Blender (rig/anim) | See §2 |
| Repo | GitHub, pnpm workspaces | Monorepo |
| Unit tests | Vitest | game-core rules AND real server room logic (now possible — it's all Node) |
| Multiplayer tests | **Headless bot clients** (colyseus.js in Node, under Vitest) | See §24 — Playwright is for menus/UI only |
| Deployment | Docker Compose on Unraid | See §22 |
| Exposure | **Cloudflare Tunnel** (game) + **Tailscale** (admin only) | See §22 |

## 4. Authority model (tiered)

> The client controls presentation. The server controls everything durable. Movement is trusted but sanity-checked.

**Tier 1 — strict server authority (transactional):** damage results, health, cooldowns, item pickups (exactly one winner), loot rolls, coins/ledger, inventory changes, gifting, puzzle completion, world flags, adventure results. The browser can never say "I have 10,000 coins" or "the boss died."

**Tier 2 — client-authoritative movement with server sanity checks:** per-tick displacement cap (speed hack rejection), teleport detection, region/gate legality, coarse wall check against the grid (§7); violation → clamp + rubber-band. The threat model is our own children on a private server; full competitive-FPS movement netcode (input buffers, reconciliation, replay) is weeks of the hardest work in the project for no benefit here.

**Bounded exception — client-judged timing grades (§11):** the attack message carries the client's timing-grade claim (good/great/perfect). The server itself applies the damage, clamps the grade bonus to a fixed defined range (perfect ≤ a set +%), and rate-limits perfect claims — the client picks a bonus within server-defined bounds; it never computes damage.

**Future-proofing:** the client sends input + resulting position each tick, so full server-authoritative movement with prediction can be layered in later without a protocol redesign, if an older kid ever gives us a reason.

## 5. Multiplayer simulation

The server never runs Babylon. It simulates a simplified model:

- PLAYER: position, velocity, radius, elevation, health, stamina, equipment, status effects, cooldowns
- MONSTER: position, radius, target, health, state, attack, cooldowns

Server world = the region grid (§7): tiles + height + walkability. Monster pathfinding is plain A* on the grid.

Rates: server simulation starts at 15–20 ticks/sec; client renders 30–60 FPS and smoothly presents/interpolates remote entities from Colyseus state updates. Players and server are expected to have low regional latency, so v1 deliberately avoids lag compensation, interest management and custom compression unless measurement proves a need. **Do not contract the architecture to "full-region snapshots":** Colyseus patches, explicit messages or a small hybrid are implementation choices; the requirement is authoritative shared state plus smooth presentation at the target scale.

All durable world changes (flags, world-event history entries, loot grants) go through **idempotent commits keyed by a unique event id** (adventure-instance id + unlock id): double-completion by two parties and restart-replay both collapse to exactly one world transition. Rooms are disposable; Postgres is the truth.

## 6. Mobile session lifecycle (first-class design)

On phones — especially iOS Safari — the socket dies within seconds of screen lock or tab backgrounding, and under memory pressure Safari silently discards the tab so returning is a **full page reload**, not a reconnect. With kids this happens several times per 20-minute session. This shapes the design; it is not an edge case:

- Server keeps a disconnected player's slot alive in the room for a **grace window of 120 s** (sized with margin for the §31 scenario: 60 s lock + ~5 s detection + a rejoin budget): body pauses/AI-idles, boss pacing tolerates a vanished player.
- Client persists session token + current room/instance id (localStorage), so a **cold page reload auto-rejoins the same adventure** with position and inventory restored — the child does nothing.
- Heartbeat tuned so socket death is detected in < 5 s; `visibilitychange` handler proactively saves state and resumes AudioContext on return.
- Defined semantics: disconnect mid-adventure → resume in place within grace; after grace → exit to village, expedition loot follows recovery rules (§13). Disconnect during any pending transaction → server cancels/rolls back.
- **Every disconnect test runs in both variants: socket drop AND full page reload.** Both are Stage 0 exit criteria.

Platform decisions to settle in Stage 0 on real devices: landscape orientation lock (two-thumb controls), installable PWA (standalone mode removes the address bar and edge-swipe conflicts), `touch-action: none` against pull-to-refresh, Screen Wake Lock, audio unlock on first tap.

## 7. World authoring: grid-first regions

The v1 plan had level geometry authored in 3D and the server model "exported" from it — two sources of truth that diverge, plus a bake pipeline nobody wants to build. Inverted:

- Each region's walkable space is authored **first** as a tile/height grid (Tiled/LDtk or plain JSON in `/packages/content/regions`), including spawns, gates, triggers, hiding anchors.
- **The grid IS the server's collision and pathfinding model.** A* comes free.
- The client generates and decorates the 3D scene from the same grid; asset-pack models and props are decoration, never walkability truth.
- Client and server are geometrically consistent by construction; region authoring is tractable for AI agents and future GM tooling. Babylon Editor is not part of the pipeline (revisit someday, not load-bearing).

**Coordinate convention (locked before content exists):**

- 1 Babylon/world unit = **1 metre**.
- 1 navigation tile = **1 m × 1 m**.
- X = east/west, Y = elevation, Z = north/south.
- Region files, server simulation, client placement and content tools all use the same convention; no pixel-space or row/column coordinate system is allowed to leak into gameplay APIs.
- The first region format only needs tile walkability/elevation/terrain plus typed objects such as spawn, gate, trigger and hiding-anchor. Do not design a universal level format in Stage 0A.


## 8. Repository architecture

```
/adventure-game
  /apps
    /client        Babylon.js + Preact UI
    /server        Colyseus rooms, auth, persistence, admin RPCs
  /packages
    /game-core     combat, stats, items, abilities, loot, progression — pure TS, no engine imports
    /game-protocol network messages, shared types
    /content       items, monsters, quests, regions, bosses, loot tables (data only)
    /tools         content validator, KTX2 encoding, balancing, drawing-pipeline scripts
  /assets          characters, weapons, monsters, world, audio
  /deploy          docker-compose, unraid notes, backup scripts
```

`/apps/admin` is deliberately absent until Stage 4 (§21). A referential-integrity validator in `/packages/tools` (loot tables → items, quests → regions, no dangling IDs, schema-version conformance) runs in CI so no agent or human can land a broken reference.

### State boundaries (locked)

Four kinds of state exist, with one owner each:

1. **Content definitions — git:** item/monster/quest/region definitions, balance data, IDs, schemas and authored content.
2. **Durable player/world state — PostgreSQL:** accounts, ownership, inventory, coins/ledger, world flags/events, approved submissions and any adventure checkpoint needed to survive a server restart.
3. **Active session state — Colyseus memory:** current positions, transient monster HP/state, current cooldown progress and other simulation state that may be discarded unless a designed checkpoint persists it.
4. **Local presentation state — browser:** joystick position, camera shake, temporary animation/VFX state, local UI state and device preferences.

**Crash rule:** anything we would be genuinely upset to lose when the Node container dies must either already be in PostgreSQL or be deterministically reconstructable from PostgreSQL + content definitions. This does **not** mean writing every combat tick to the database.


## 9. Accounts, login & child safety

**Login (decided): email + password.** Kid-friendly implementation on top of that decision:

- Accounts are created only by the admin; no public registration, no discovery, no matchmaking, no real names — invented character names, chosen or approved at account creation.
- **Long-lived rolling sessions (~90 days)** so a password is typed rarely, not per session.
- Admin can reset any password and issue a **one-tap login link / QR** from the admin tools — the practical path for the 5–7-year-olds and for "kid cleared Safari data at grandma's tablet," which is a first-class recovery scenario tested in Stage 0.
- Youngest kids: parent-managed email (plus-addressing on a parent's address is fine — email is an account identifier, not a communication channel).
- Passwords hashed (argon2id), login rate-limited. Cross-device is inherent: same account from phone, tablet or PC.

**Chat: none.** No free-text chat before Stage 5+, if ever — these are friends who see each other at school and will be co-located or on a call; thumbs are busy in combat anyway. Ship pings ("come here!", "help!"), emotes, and a small set of preset Estonian phrases. This removes the single largest safety/moderation surface from the game.

**Other families:** a one-page info sheet for the friends' parents (what is stored — account, drawings, play history; how to request deletion), and a delete/export-child's-data function in the admin tools. Nothing kid-authored (drawings, item names, sign text) is ever visible to another player before parent approval — that sentence is the entire moderation system, and at this scale it is sufficient.

## 10. Character system

One **standard character rig** (a small number of body archetypes at most) + custom appearance + custom texture + equipment. The children's drawings drive face, hair, clothing style, colours. One walk animation works for everyone; every sword attaches to the same hand socket. All pack animations are retargeted onto this rig once, early. The rig + animation set is scheduled, not vague: the minimal clip set (walk, attack, dodge) is a Stage 0A prerequisite; the full core set (run, down, revive, interact) ships by Stage 1; the remaining weapon families' attacks by Stage 2.

**Stage 0A-2 rig gate:** use one representative **real GLB character**, not only programmer capsules. Before networking begins — though after Kid Test 0 — prove the complete path: import GLB → shared skeleton loads correctly → walk/attack/dodge clips play → named hand socket exists → hammer attaches correctly → a second texture/palette variant can use the same rig and clips. The art can be ugly and temporary; the pipeline cannot be hypothetical.


## 11. Combat

Input target for the full game: LEFT THUMB movement (virtual joystick), RIGHT THUMB attack / dodge / ability / interact. Landscape. Minimum touch-target sizes for small hands.

**Stage 0A input is intentionally smaller:** LEFT THUMB = movement; RIGHT THUMB = **ATTACK + DODGE only**. No ability button and no interact button are required for the combat-feel proof. The first weapon is a **hammer**:

- **One button, two modes — speed or strength.** Tapping is fast and safe; holding is slow and powerful, and the player chooses which risk to take. The same split is intended to carry to other weapon families (a bow taps for a quick shot and holds for a drawn one).
- **Tap** (release under ~180 ms) → a quick light hit that **chains**: tap again in rhythm and the chain continues to a stronger finisher, while letting the rhythm lapse resets it. Light hits recover fast so taps flow, and are individually weaker than any heavy swing — taps buy speed and safety, not power.
- **Hold** → a clearly telegraphed charge meter fills over **~0.85 s** (tuned in 0A, but a single named number, not a vague "charge"), carrying **three concentric bands**, all measured as *widths* in milliseconds rather than points in time:
  - **PERFECT** — a band **250–300 ms wide**, centred around 60 % of the charge;
  - **GREAT** — the ~450 ms band surrounding PERFECT;
  - **GOOD** — everything else: released too early, or **overcharged** past the window.
- Release in GOOD → normal hit; GREAT → stronger hit + small stagger; PERFECT → strongest allowed bonus + satisfying impact/VFX. A heavy swing always outhits the light chain, and pays for it with a longer recovery.
- Missing the mastery bands never jams or cancels the attack — **every release attacks**.
- The meter **caps rather than auto-firing**: a game that swings on its own teaches nothing about timing.
- **Assist (below) widens PERFECT and GREAT; it never narrows GOOD**, because GOOD is the floor that guarantees a five-year-old always lands the hit. Assist must also always leave room to **overcharge** — if a widened band reached the end of the meter, "just hold it forever" would become the best strategy for exactly the child assist exists to help.

The single Stage 0A enemy uses one obvious wind-up attack so the toy proves the base loop: **read telegraph → dodge → counterattack → time the hammer release**.

**Timing is anticipation, not reaction.** Reaction-based windows fail here: browser touch latency, network jitter, a 15–20 Hz tick, and 5–8-year-old reaction times (~400–600 ms, highly variable) would make tight windows read as coin flips. Rules baked into the combat spec:

- Timing cues are **telegraphed**: enemy wind-ups, visible charge meters, learnable rhythms — never surprise reactions.
- **Graded outcomes** (good / great / perfect): every grade *succeeds*; better grades add bonus. Mastery tightens the bonus, never the success floor.
- Minimum "perfect" window ~250–300 ms.
- The **client judges timing** against the animation the player actually saw and sends the grade claim with the attack; the server clamps and applies it (§4's bounded exception) and validates plausibility (cooldowns, rate caps — "attack faster than weapon allows" is a server-side timestamp check).
- Telegraphs are shape-coded as well as colour-coded (colorblind-safe).

**Weapon families** (axe/sword/hammer/bow/staff) each own a timing mechanic — hammer: timed release; bow: perfect draw; sword: combo rhythm; staff: charge. This is where mechanical depth lives.

**Assist system (mandatory for the 5–13 span, automated because play is unsupervised):** per-account invisible settings adjustable from the GM tools — damage-taken multiplier, wider timing windows, faster revive-of-them, auto-self-revive from downed after ~20–30 s. Never announced on screen; never affects loot or attribution.

**Assist must exist in Stage 0A, before there are accounts.** A local toggle is enough (a build constant plus a `?assist=1` URL parameter), but it has to be there for Kid Test 0: without it, a five-year-old who cannot land GREAT produces a false STOP on the most important gate in the project, and we would read "this combat is bad" when the truth is "this combat has no easy mode yet." Kid Test 0 explicitly tries both settings. Additionally:

- Every encounter includes at least one **non-twitch co-op role** (torch carrier, lever puller, rune matcher) so the youngest contributes meaningfully.
- The **downed state is active**, not a waiting room: crawl, cheer-buff allies.
- Revivers are rewarded (shared bonus) — picking a sibling up is the selfish choice too.

**Onboarding is a Stage 2 deliverable, wordless-first:** the first village-to-forest quest doubles as the tutorial — one mechanic per room, icon + ghost-hand demonstrations, no text walls. UI is icon-first with minimal Estonian labels (the 5–7s are pre-readers). Design the first adventure so a veteran-plus-newbie pair works well; mentoring is a feature.

## 12. Bosses

Mechanical encounters, not big health bars: phases, a mid-fight puzzle, a cooperative mechanic, a final damage phase. **The first boss is hard-coded.** A content-driven boss state-machine engine is designed only after the third boss exists, from real examples.

**Canonical kills are armed by the GM.** In a persistent world, "first victory is canon" guarantees a "you killed him WITHOUT ME" sibling grievance. So: major world-boss attempts have world consequences only when the parent has armed the event from the admin tools (scheduled Event Night — an asynchronous GM action, no live supervision needed). Unarmed attempts are scouting fights: normal loot, no world flags. Region-unlock effects are surfaced in-game as belonging to everyone ("the bridge is open for ALL").

## 13. Death, recovery & interruptions

**Staging note:** the full system below ships in **Stage 3**, when persistence becomes sacred and loot starts to matter. **In the Stage 2 slice, a party wipe simply fails the adventure and costs nothing** — no cache, no attempts, no courier, no banked-versus-unbanked distinction. The Stage 2 playtest measures whether the adventure is fun, not whether the loss rules feel fair, and the recovery machinery is the most transaction-heavy work in the stage for a question nobody is asking yet.

- **Downed** → friends revive (or assisted auto-self-revive, §11). **Party wipe** → adventure fails; expedition loot goes to a recovery cache.
- Never lost, ever: created personal items, equipped signature gear, cosmetics, story rewards, character progression.
- Recovery: **three attempts, no real-time expiry** — school and bedtime delete nothing. Any party member (or a parent account) may run the recovery for the owner.
- **The floor is taxed, never zero:** after a third failed attempt, the "village courier" returns the cache minus a coin fee / a share of stackable materials. Total loss is not a possible outcome — the child who wiped did so because the content was too hard for them; the game does not then demand they succeed three times or lose everything.
- Every cache event is logged; the admin can restore manually (item instance IDs make this cheap).
- **Arena death is a different model on purpose** (§14a): short respawn delay, no downed state consequence, no loot at risk. The two models stay separate in `game-core`.

**Interruptions are the normal case** (bedtime, dinner, dead battery, rage-quit):

- **Checkpoints** after each room/phase bank the loot collected so far; only post-checkpoint loot is at risk on a wipe.
- A graceful "go home" exit exists at any checkpoint (keeps banked loot, adventure marked incomplete).
- Encounter difficulty **recomputes when party size changes**: scale down immediately when a player disconnects or leaves (boss phase state preserved), scale back up if they rejoin within the §6 grace window — two kids leaving mid-boss must not doom the remaining two. This is a Stage 2 deliverable, tested in §31.

## 14. Adventures & session length

Adventures are temporary instances (Colyseus rooms) entered through gates in the shared world: rooms → combat → puzzle → treasure → boss. Results feed back into the persistent world through idempotent commits (§5).

Adventure gates display an expected-length icon (short/medium/long) so kids can pick something that fits before bedtime. The Stage 2 slice must demonstrably fit ~25 minutes with real kids, timed (§31).

## 14a. The Arena / Training Grounds (permanent)

The Arena is built as **Stage 1** (§30) and never removed. It serves two purposes at once, and both are load-bearing:

1. **Real playable content** — a place the children can enter any time, fight monsters, fight each other, and try weapons, long before the first adventure exists.
2. **The project's permanent laboratory** — the standard place to test every new weapon, enemy, boss mechanic, timing change, revive change, VFX pass, network change and performance regression, for the life of the project.

It is not prototype code. It is authored with the same grid-first region format (§7), the same shared rig (§10) and the same authority model (§4) as real content, and it later joins the village fictionally as "The Training Grounds."

**Map (v1 minimum):** safe spawn/respawn area, open combat field, one marked PvP ring, a training-dummy corner, a temporary weapon rack, a monster spawn gate, a few cover obstacles, and clearly readable edges. *Deferred to Arena v2+ (added incrementally, because the Arena is permanent):* archery lane, dodge/obstacle course, wave-survival pit, boss practice gate.

**Online combat requirements (the real Stage 1 work):** server-owned health and damage results, cooldown validation, timing-grade clamping (§4), dodge, knockback, downed state, ally revive, death, Arena respawn, join/leave, reconnect/rejoin and party-size changes. At least one Stage 0A weapon must work fully online before a second weapon family is added.

**PvP rules — opt-in and consequence-free.** PvP damage applies **only** inside the marked ring; leaving the ring disables it; safe areas never permit it. Arena death costs a short respawn delay and nothing else. PvP must not remove permanent items or coins, damage durability, grant persistent power or PvP currency, transfer loot, or create leaderboards or permanent rankings.

**PvP in a 5–13 age span needs three additional protections**, because the mechanical consequences being zero does not make the emotional ones zero — a 13-year-old will beat a 6-year-old every single time:

- **Assist settings (§11) apply in PvP exactly as in PvE**, and Arena gear is normalized (see below), so the gap is skill alone rather than skill plus gear plus assists being switched off.
- **No score, streak or round counter is displayed in v1** — not even between two players. "No leaderboards" is not enough; a visible 7–0 in a duel is the thing that actually hurts.
- **A per-account PvP flag exists from the start**, admin-settable, so a child who does not enjoy being hit by their older sibling simply cannot be, and does not have to negotiate it in the moment.

**Temporary Arena equipment.** The rack grants weapons that exist *only* inside the Arena: they never enter persistent inventory and vanish on leaving. This is what makes the Arena safe as a test bed, and it must be enforced server-side and covered by a leak test (§24). Arena weapons may use normalized stats.

**Normalized stats.** Arena combat may normalize weapon/character power so persistent progression never makes older players overwhelmingly stronger — the direct expression of the §16 narrow-power-band principle. No implementation is required in Arena v1 while everyone is on rack gear, but **the architecture must not assume PvP uses persistent character power.**

**PvE testing.** One enemy type initially, then an admin/debug spawn control (spawn 1 / 5 / 10 / elite / a known boss). This is where enemy AI, pathfinding, crowd behaviour, area attacks, co-op revival and difficulty scaling get tested. Do not build a generalized spawner UI before it is useful; a debug control is enough.

**Performance lab.** From Stage 1 the Arena replaces synthetic scenes as the **standard benchmark** (§26), with hidden developer controls for character count, enemy count, particle intensity, shadows and dynamic lights, plus an optional WebGL2/WebGPU comparison. Standard stress cases: 4 players + 10 enemies, 6 players + 25 enemies, 10 bot clients, heavy particles, shadows on.

**Death-semantics firewall.** Arena death → short delay → respawn. Adventure death → downed → revive → wipe → recovery (§13). These are deliberately different models: keep them separate in `game-core` and never let an agent "unify" them.

## 15. Persistent world

World Flags (`bridge_repaired`, `bone_king_defeated`, …) plus World Events — a permanent history log with participants, date and effects. This becomes the recorded history of their world. (The Chronicle/echo-boss replay system from v1 is a good idea whose trigger condition hasn't occurred yet — deferred, §29.)

## 16. Region & character progression

Regions are world-unlocked, not level-locked: village at the center; forest/coast open; swamp, mine, mountains, dark peak behind bosses + puzzles + materials + exploration. Repairing the bridge opens it for everyone, permanently.

Character power stays in a narrow band: a veteran has ~30–50 % more theoretical combat capability, never 5,000 %. Veterans really gain: weapon variety, unusual abilities, consumables, map knowledge, secrets, preparation, mastery. Old and new players stay compatible — essential for the age mix and irregular schedules.

## 17. Inventory & personal room

Limited adventure backpack (8–12 slots — real choices in the field); large storage at home. The personal room is responsive HTML for v1 (character, equipment racks, storage, adventure history log, created items, gifts) — the same data can back a walkable 3D house later.

## 18. Economy

One currency (Coins). Sources: adventures, treasure, quests, selling. Sinks: shops, crafting, cosmetics, modifications. **Every currency movement writes a ledger entry; every valuable item has an immutable instance ID** — duplication bugs and "where did my sword go" investigations become queries.

No auction house. **Player-to-player trading is deferred** (§29): at this scale, gifting through a GM grant covers the need, and it removes the "talked my little brother out of his First Forged" failure mode entirely for now. When trading ships (Stage 5), it is server-transactional (both accept → one DB transaction), **First Forged originals and story rewards carry an `untradeable` flag** (in the item schema from day one), and the admin has a trade-reversal tool.

## 19. Drawn equipment & creation pipeline

The child creates the identity; the system creates the mathematics. Kid-facing: name, drawing, star allocation (10 points over Power / Speed / Reach / Control / Magic), a special, optionally a drawback. Internal: derived stats computed from stars by a global formula — rebalancing every item ever made is a formula change, because instances store star allocations, not derived numbers.

**Balance rules (from review):**

- **Weapon family is the first choice in the creator** and a required schema field — it defines stat interpretation and the §11 timing mechanic.
- Power × Speed is normalized so any split yields roughly equal DPS; stars buy *feel* (hit size, stagger, timing window), while Reach/Control/Magic carry real trade-offs. No degenerate DPS build for a clever 13-year-old to find.
- Created items sit at **solid mid-tier power forever** — identity and the First Forged original are the reward, not stat superiority. This keeps loot, risk and the economy meaningful.
- **Specials come from a parameterized effect-template library** (~8 templates: stun/grab, burn, knockback, slow, lifesteal, bonus-vs-family, stamina-refund, cosmetic companion), each with 2–3 tunable numbers. At approval, the parent maps the kid's invention to the closest template + custom name + VFX tint. The kid's fiction is preserved; the server only ever sees data. New template = engine code; new item = data. Drawbacks: a fixed menu with fixed point refunds, max 1–2 per item (no free points from cosmetic non-drawbacks).

**Art pipeline — tiered; only Tiers 0–1 are promised to the kids.** Input is a **photo of a paper drawing** (decided):

- **Tier 0 (fully automatic, always):** photo → background removal + crop/levels cleanup → the drawing itself becomes the item's inventory icon and collection card, stats from stars. This tier alone makes the feature real.
- **Tier 1 (automatic, weapons/shields):** the cleaned cutout becomes a flat, slightly-extruded "papercraft" mesh attached to the standard hand socket. *"Your drawing literally comes to life as a drawing"* is the deliberate aesthetic — it sidesteps style-matching entirely and maximizes recognition ("that's MY axe!").
- **Tier 2 (optional, parent labor in Blockbench, days–weeks later):** a hand-modeled low-poly version swapped in via the `art_version` field, delivered in-fiction as "the blacksmith reforged it."

Characters: standard rig + palette extraction from the drawing + a parent-painted texture variant on the shared UV layout; the original drawing gets framed in their room.

All latency is wrapped in fiction: submissions go "to the forge" and take a few days *by design*. Submission workflow: upload RPC (photo → storage + submission record), states `draft → submitted → needs_changes → approved → live`; the kid-facing status is always in-fiction and there is no visible "rejected" — only "the blacksmith asks for changes." **Spike this pipeline end-to-end with one real drawing as the first task of Stage 4, gating the rest of the stage** — measure the hours; photo cleanup (uneven lighting, shadows) is the tier-0 hinge.

**Every new weapon goes through the Arena first** (§14a): new weapon → Arena rack → children and developer test it → balance/feel changes → only then is it allowed into real content. This matters most for child-designed weapons, where "the blacksmith is testing it at the Training Grounds" is both an honest description of the process and a good piece of fiction.

Provenance is retained forever: `item_design` (creator, creation_date, balance_version, art_version, special, history). Approved designs may later appear as world loot; the First Forged original permanently belongs to its creator.

## 20. Content architecture

Non-negotiable: items, monsters, quests, NPCs, loot tables, puzzles, regions, bosses, world events are **structured data** in `/packages/content` with stable IDs and schema versions.

- **Content definitions live ONLY in git** and reach the server via the content build. The GM tool operates only on runtime state (flags, grants, accounts, submissions, enable/disable tombstones). Submission approval *outputs a generated content file* (item JSON + processed art asset) that gets committed — approved drawings enter the same pipeline as hand-authored content, with git history/rollback for free.
- **Instance/definition rule:** an item instance stores only (definition ID, provenance, acquisition source/date, roll seed). All combat stats derive at load time from the current definition + current balance formula. Definitions are never deleted, only tombstoned. "New content version → existing items remain valid" becomes trivially true.
- **All player-visible text sits behind i18n keys** with Estonian as the authoring locale; fonts verified for õ/ä/ö/ü. The moment-to-moment loop must not require reading (§11 onboarding).
- Postgres schema changes go through versioned migrations from day one.

## 21. GM / admin tools

For Stages 0–3, the GM tool is **not an app**: ~8 admin-only server RPCs callable from a CLI script — create account / reset password / issue login link, give/remove item, set/clear world flag, arm/disarm boss event, recover player, disable account, disable content, adjust assist settings. Plus direct SQL for inspection.

`/apps/admin` is built at Stage 4 as exactly **one screen**: submission review (view drawing, crop preview, pick weapon family, set stars, map special to template, approve / request changes). The grand dashboard (players, world, economy, tools) accretes from that screen later, if ever.

## 22. Deployment & exposure

**Host (decided): KOCorp Unraid** — AMD Ryzen 5 7430U, 32 GB RAM, SSD-backed, gigabit Ethernet. It is the development, test and initial production host from Stage 0B onward. At ~10 accounts, ~4 typical concurrent players and a 10–20 client ceiling, KOCorp capacity is not expected to be the limiting factor: the children's devices render Babylon locally, and KOCorp only serves the client, runs Colyseus rooms and authoritative rules, holds PostgreSQL, runs encounter AI/pathfinding, handles auth, logs/telemetry, backups and uploaded drawing storage. The expected early constraints are mobile-browser lifecycle and network quality, not KOCorp compute.

```
kids' phones ──HTTPS/WSS──> cloudflared-adventure ──> [dedicated Docker net on KOCorp]
                                                    adventure-web    (static Vite/Babylon build, HTTP only)
                                                    adventure-server (Node + Colyseus: auth, rooms, rules, persistence, admin RPCs)
                                                    adventure-db     (PostgreSQL, dedicated DB + credentials)
                                                    adventure-backup (pg_dump + drawing/art backup + offsite copy)
parents' devices ──Tailscale──> admin RPCs / DB / Unraid UI
```

**Storage layout (paths may shift at deployment; isolation may not):**

```
/mnt/user/appdata/adventure/{server,postgres,backups}
/mnt/user/adventure-assets/{drawings,processed,characters,items}
```

**Isolation is mandatory — the game stack is untrusted relative to the rest of KOCorp:** dedicated Docker network, dedicated database and credentials, dedicated appdata/storage paths, **no** Docker socket, **no** host-network mode without explicit later justification, **no** broad `/mnt/user` mount, **no** access to unrelated KOCorp shares, appdata, services or databases. Public ingress reaches only `adventure-web` and the game port of `adventure-server`.

**Resource safety:** measure first, then limit. The containers get sensible CPU/RAM limits and reservations **after** real Stage 0B/Arena measurements exist, so that a runaway development bug cannot consume the whole host and disturb unrelated KOCorp workloads. Do not guess aggressive limits before there are numbers.

**Network test matrix (Stage 0B and Arena, against the real deployment — not a LAN-only stand-in):** home Wi-Fi → KOCorp via the public game URL; another household/network → KOCorp; LTE/mobile data → KOCorp; a Wi-Fi↔mobile-data transition where possible; 2, 4 and 6 players; 10 protocol-level bots. Record RTT/ping, reconnect time, cold-load time, connection stability, server CPU/RAM, Colyseus room behaviour, PostgreSQL load and Cloudflare Tunnel behaviour. A fast local `docker compose` loop remains the normal development inner loop; KOCorp is the integration and measurement target, so that "test on the real path" never means "wait for a deploy to try one change."

- **Cloudflare Tunnel** (domain already on Cloudflare): no open ports, home IP hidden, WebSockets carried fine, and any phone joins via a plain URL — friends' families never install anything. Measure tunnel RTT from an LTE phone in Stage 0; documented fallback is a direct 443 port-forward with Caddy if it measures poorly (> ~100 ms).
- **Never through the tunnel:** admin RPCs, Postgres, the Unraid UI — those are Tailscale-only, on the parents' own devices. DB and admin ports are not published on the host at all.
- Isolation: dedicated Docker network, dedicated DB + credentials, dedicated appdata/storage; no Docker socket, no host filesystem, no access to other services.
- No Redis, no Kubernetes, no queues — architecture theatre remains banned. Containerized so the whole stack can move to a VPS without changes.

## 23. Backups

The database is the history of the children's world — the restore is the product, not the backup:

- Nightly `pg_dump` from a dedicated backup container + uploaded drawings/assets.
- **Offsite copy** (Backblaze B2 via rclone, or a relative's NAS) — actually off-premises.
- Every backup run pings a dead-man's-switch monitor (healthchecks.io) so a silently broken job alerts within a day.
- **Monthly scripted restore drill**: spin up scratch Postgres, restore last night's dump, run sanity queries (account count, item-instance count, world flags), tear down. Automated so it actually happens.
- Server image tag + config backed up alongside the dump so a restore reproduces the same schema version. Source on GitHub; assets versioned.

## 24. Testing strategy

- **Vitest** for game-core rules and for real Colyseus room logic (Node end to end).
- **Headless bot clients** (colyseus.js in Node, under Vitest, against a docker-compose test stack) for every multiplayer correctness scenario — this harness is a Stage 0B/1 deliverable, not "eventually," and it is also the fast feedback loop the AI agents need.
- **Playwright** only for login, menus, HUD/inventory UI, and one canvas-boots smoke test on a mobile viewport. (Playwright's WebKit is not real iOS Safari, and real iOS can't be driven from Windows — real-device checks are manual on the actual phones, which we have.)

The correctness scenarios (all bot-harness, each in socket-drop AND page-reload variants where relevant):

| Test | Why |
|---|---|
| Two players grab the same item | exactly one succeeds |
| Disconnect during any transaction | rollback |
| Disconnect during boss | world survives; grace window holds the slot |
| Reconnect (socket) and rejoin (page reload) | state restored, same instance |
| Speed hack / teleport | clamped and logged |
| Attack faster than weapon allows | rejected server-side |
| Party wipe | recovery cache created exactly once |
| Third recovery failure | courier return, **never deletion** |
| Failed recovery attempt (socket-drop and page-reload variants too) | attempt counter decrements exactly once; an abandoned/disconnected run consumes none |
| World unlock, two parties simultaneously | exactly one world transition |
| Content version bump | existing items remain valid |
| Hunt/gift reward claimed | exactly once |
| Arena rack weapon carried out of the Arena | temporary gear never enters persistent inventory |
| PvP damage attempted outside the ring | rejected; safe areas are always safe |
| 10 bots roaming a test map | soak/load sanity |

Each scenario lands with the stage that ships its feature (the gift/hunt rows arrive with Stages 5–6); the harness itself exists from Stage 0B.

## 25. Telemetry & observability

When something breaks on a kid's phone at a friend's house, the only bug report will be "it doesn't work." The debug overlay ships with the Stage 0A toy; the server-side pieces ship with Stage 0B (the first server); Stage 2 verifies the whole chain end-to-end on the kids' real devices:

- Client errors POSTed to a server endpoint (with client version, device, session id).
- Structured server logs keyed by player/session id.
- A hidden in-game debug overlay (FPS, ping, client version) reachable by a secret tap sequence.
- Client-vs-server version logged to catch stale-cache clients after deploys.

**An in-page console is not optional on this project.** iOS Safari's Web Inspector requires macOS, and the development machine is Windows — so when the iPhone 13 mini misbehaves there is otherwise *no* way to see a console, a stack trace or a network error. Bundle a self-hosted in-page console (eruda or vConsole) behind the same hidden toggle as the debug overlay, from the Stage 0A toy onward. This is the difference between "the kid's phone shows a black screen" being a five-minute fix and a lost evening.

## 26. Performance & device baseline

Known weakest iPhone: **iPhone 13 mini** (A15 — a strong GPU; Safari's tab-memory limits, not the chip, will be the iOS constraint). The real floor is likely a friend's cheap Android — unknown until measured, which is why Stage 0A-2 measures instead of assuming. Test at least one friend's actual phone early rather than discovering a blocker at Stage 0B.

Targets: 30 FPS minimum / 60 desired; initial load aggressively minimized; assets streamed by region; fixed camera; aggressive culling; limited shadows and dynamic lights. **WebGL2 is the default path**; WebGPU (now shipped in iOS Safari 26 and Android Chrome) is a measured opt-in only.

**Stages 0A-2 and 0B together produce a written baseline report from the worst available devices** (device measurements in 0A-2, deliberately after Kid Test 0; the two network items — tunnel RTT on LTE, 4G cold-load — in 0B, once the tunnel exists). Do **not** spend Stage 0A trying to discover Safari's exact tab-kill memory ceiling; it is noisy and OS-dependent. Use a representative stress ladder instead:

**From Stage 1 the Arena (§14a) is the standard benchmark scene** — a real game environment with developer controls for entity count, particles, shadows and lights beats a synthetic one, and it keeps measuring the thing the children actually load. Until it exists, use the stress ladder below in the Stage 0A toy:

The stress-ladder scene is a **synthetic measurement scene and is explicitly exempt from Stage 0A's one-character/one-enemy gameplay scope** — it exists to produce numbers, is never shown to a child, and its entities need no AI or combat behaviour.

1. **Normal target scene:** ~6 animated rigs, ~10 enemies, representative environment, textures and a small amount of VFX.
2. **2× stress:** approximately double the visible dynamic load/assets.
3. **3× stress:** intentionally excessive load to observe degradation and failure mode.

Record median FPS + frame-time spikes, approximate memory behaviour, thermal/Low Power Mode effects, shadows on/off, WebGL2 vs measured WebGPU, dual-thumb multitouch + edge-swipe conflicts, Safari tab vs installed PWA, audio unlock/resume, wake-lock behaviour, KTX2→ASTC transcode, and add-to-home-screen flow. Lock/background testing (10 s/60 s/10 min) remains part of the lifecycle report. In Stage 0B add RTT on LTE via the tunnel vs Wi-Fi and 4G cold-load. **Set asset/draw-call budgets conservatively from the normal and 2× scene; never budget to the last megabyte before a browser kill.**

## 27. Audio

Sound carries a large share of game feel for children, and the §11 timing mechanics want audio cues (as reinforcement — never as the sole precision channel; mobile browser audio latency is too variable). Plan: CC0/paid SFX + music packs; Babylon/WebAudio with the unlock-on-first-gesture pattern; audio resume wired into the §6 lifecycle handler; mute-switch behavior checked in Stage 0A.

## 28. Sustainability & absence-proofing

Solo hobby projects hit motivation gaps; the kids' world must survive them:

- The stack runs untouched for months: pinned image versions, auto-renewing certs (tunnel handles TLS), log rotation, the §23 backup alerting.
- A living `CLAUDE.md` + short architecture-decision records aimed at future-me and AI agents — the "resume development after 3 months" document, updated each stage.
- Bias to boring dependencies; few recurring costs (domain, Backblaze cents, Claude usage) — known and listed.
- **World-reset covenant, told to the kids:** before Stage 3 the world may be wiped as we build; from Stage 3 onward it never resets.

**Stall detection (the real risk is drift, not overrun).** With no deadline, the failure mode is silence, and stage reports only surface at stage boundaries that can be ten weekends apart. So: a fixed weekly slot, and **if two consecutive weeks pass with no commit, write one line in the stage log saying why.** That converts a stall into visible data instead of an unexamined gap, and the line itself is usually enough to restart.

**Written now, while thinking clearly — what would end this project.** Not a prediction, a pre-commitment, so the decision is never made at 23:00 during a bad week: if Kid Test 0 fails twice and a changed core premise fails once, the *game* premise is wrong. If the children stop asking about it for a full season while it is playable and reachable, the *audience* has answered. If neither is true, a three-month gap is a pause, not an ending — the world keeps running (§22–§23) and the resume document (above) exists precisely for that.

## 29. Explicitly deferred (ideas kept, design postponed)

Deferred until after real kids have played the Stage 2 slice — each currently exists as one line of intent, on purpose:

- **Chronicle / echo bosses** — deferred until a kid actually misses a canonical event and is sad (that will be the requirements document). §12's arming system prevents most of the problem anyway.
- **Player-to-player trading** — GM gifting covers the need at this scale (§18).
- **Treasure hunts / hiding anchors** — Stage 6; reward escrow rule already decided: the reward item moves out of the creator's inventory into the hunt at creation (hunts must not mint items).
- **Generalized boss state-machine engine** — after boss #3 (§12).
- **Admin dashboard UI** — CLI + RPCs until Stage 4's single review screen (§21).
- **Exact balance math** (star formulas, drawback refund values) — tuned when the first real drawings arrive.
- **Pets** — architected for (schema slots exist), built later; pets never suffer from absence, and grant small exploration utility, never meaningful combat power (protects the §16 narrow power band).
- **Auction house** — never, probably.
- **Movement abilities — sprint, dash, jump.** Wanted; deliberately not designed yet. Three notes so they are not treated as "just more buttons" when the time comes:
  - **Sprint** is the cheapest. On a phone it probably needs no button at all — pushing the stick to the rim is the usual answer, which protects the small control set §11 depends on — while keyboard and controller get a real one. It is the natural first consumer of the stamina already on the player model (§5). **Gotcha:** the server's displacement check (§4) and `MOVEMENT.maxSpeedMetresPerSecond` must both know sprint exists, or honest sprinting reads as speed-hacking.
  - **Dash** is **decided to be separate from dodge** (ADR 0007): a dash is traversal — a quick sprint burst with no invulnerability and no combat role — whereas dodge is part of the fighting loop. If dash ships it belongs with sprint. It must stay *distinguishable to a child* from dodge: its own cue, its own cost, and ideally not competing for the same thumb at the same moment. Being a long discrete displacement, it must resolve through `traceMovement`, not a single `clampMovement`, or it tunnels through walls (the bug found at 0A.5).
  - **Jump is not another button; it is a change to the world model.** The grid (§7) is 2D walkability plus one fixed elevation per tile — the simulation has no vertical axis, no gravity and no airborne state, and the server model (§5) carries elevation but no Y velocity. Jump also has to answer questions the grid currently cannot ("can I land there?", "am I over a wall?"), and a 55° camera (ADR 0005) reads vertical motion poorly. **Spike it before committing to it.**
  - Across all three: watch the **button budget**. §11's Stage 0A set is move + attack + dodge; adding these could reach five or six actions, which works against "fair for the youngest" (§1). The youngest may want a reduced set, or auto-sprint.
- **Competitive PvP** — rankings, scores, tournaments, PvP rewards or currency, and full matchmaking stay out (§14a). Arena PvP means "I hit you with the ridiculous hammer," never "I farm another child for progression."
- **Player-created Arena maps and extra Arena modes** (Monster Rush, Duel, 2v2, Free-for-All, Boss Practice, courses) — the Arena is permanent and grows by accretion; none of these are Stage 1 requirements.

## 30. Development stages (resequenced)

Timeboxes assume 5–10 h/week; overrun ⇒ cut scope, never extend silently.

**Every gate carries an iteration budget.** A gate that returns ITERATE may be retried at most **twice, at ≤ 2 weekends each**. After the second failed iteration the response is not a third attempt: either accept a reduced target and move on, or change the design premise the gate is testing. Unbounded ITERATE is how hobby projects die without anyone ever deciding to stop, and no gate below is exempt.

**Stage 0A-1 — Combat-feel toy** *(~3–4 weekends)*
Purely offline, no server, no accounts, no loot, no persistence and no networking. The goal is the earliest possible honest answer to "is this fun?", so this half deliberately stops short of polish:

- one small Babylon test area with floor + a few representative walls/trees/rocks;
- the fixed §2 camera;
- a shared-rig character — **the full §10 rig gate may be deferred to 0A-2; a rough rigged pack humanoid or even a capsule with a visible weapon is acceptable here** if the rig fights back, because the kid test needs readable motion, not final art;
- one hammer with the §11 charge bands;
- one enemy with one clear wind-up attack: pursue → telegraph → attack → death;
- left-thumb movement; right-thumb attack + dodge;
- the §11 **assist toggle** (build constant + `?assist=1`);
- enough hit feedback to be honest: hit stop, impact sound, damage flash, a small screen shake;
- FPS/debug overlay **including the in-page console** (§25).

**No abilities, inventory, village, database, accounts or multiplayer may enter this stage.**

**Publish it to a static URL, not only LAN.** A Vite build is static files; Cloudflare Pages (or equivalent) hosts them free with no server, no tunnel and no Stage 0B infrastructure. This matters for two reasons: the kids can return to it on their own devices any day, which is the only way to measure the retention question below, and it keeps them attached to the project during the months between Kid Test 0 and the first adventure.

**Pre-agreed cut list, in order, if 0A-1 overruns:** the second visual variant → the elevation example in the test area → screen shake and particles (keep hit stop and sound) → the real GLB rig (fall back to a capsule and move the rig gate wholly into 0A-2).

**Kid Test 0 — mandatory gate before Stage 0B** *(two sittings, days apart)*
At least one younger child and one older child try the toy with almost no explanation beyond **"try playing this."**

Method matters as much as the observations, because this is the highest-consequence gate in the project and the sample is two children being tested by their own parent:

- **Test the youngest first, and each child separately**, before they teach each other.
- Do not introduce it as "the game I'm making" — a child answering their parent's hopes is not data.
- Run each child **once with assist on and once off**, and note which one produced the fun.
- **Sitting two, two to seven days later, is the real gate: do they ask to play again, unprompted?** The first sitting measures novelty; the second measures whether anything was actually built. This is why the toy lives at a URL.
- Write the observations down the same evening.

Observe: can they move without fighting the camera or browser; do they discover attack and dodge; do they read the enemy wind-up; do they grasp that timing the hammer improves the result; are controls hidden by their fingers or too small; do browser gestures fire accidentally; does the younger player need assist; after the enemy dies, **do they want another fight?**

**GO** — both children can play (the younger one may need assist), and at least one returns to it unprompted in sitting two. **ITERATE** — the idea reads as fun but input, readability or timing confuses them; back to 0A-1 under the iteration budget above. **STOP** — they understand the controls and are simply not interested: do not start networking to rescue unfun combat, and do not begin a third redesign; at that point the honest move is to change the core mechanic premise (a different weapon feel, a different enemy, exploration rather than combat) and re-test once, or to reconsider the concept.

**Stage 0A-2 — Rig pipeline & device baseline** *(~2–3 weekends, after a GO)*
The work that Kid Test 0 did not need and should not have waited for: the full §10 rig gate (real GLB → shared skeleton → walk/attack/dodge → named hand socket → attached hammer → a second texture variant), then the §26 stress ladder and the written device baseline across the 13 mini, the Androids, a tablet and a PC browser. If the chosen asset is awkward enough that every future animation will need manual repair, replace it **here**, before anything is built on it.

**Stage 0B — Networking proof, on KOCorp** *(~4 weekends)*
Colyseus + Postgres + Cloudflare Tunnel **deployed on KOCorp** (§22), not a LAN stand-in: email login → join the shared test room → four coloured characters move and see each other from different networks (Wi-Fi + LTE) → disconnect/reconnect in both variants (§6) → grace window works → admin-issued login link/QR recovers a "wiped device" → the §22 network test matrix is run and recorded, completing the §26 baseline. Also live by exit: the bot-client harness in CI, the §25 error-POST endpoint + structured server logs, and the §23 backup pipeline (backup container, offsite copy, dead-man's-switch ping) — backups exist from the first day Postgres does, and one manual restore is performed before the stage closes.
**The 0B test room is authored as the empty Arena shell** (§14a), not a throwaway room — Stage 1 fills it in rather than replacing it.

**Stage 1 — The Arena / Training Grounds** *(~6–8 weekends; see the v1/v2 split in §14a)*
Bring Stage 0A combat online inside a permanent, real place instead of an abstract test harness: server-owned health/damage/cooldowns, timing-grade clamping, dodge, knockback, downed/revive, Arena death + respawn, party-size changes, assist settings wired, and the full §10 core animation set. Add the marked PvP ring (opt-in, consequence-free, with the three age-span protections in §14a), the temporary weapon rack, the admin monster spawn gate, and the hidden performance controls that make the Arena the standard benchmark scene.
**Scope discipline:** ship Arena **v1** only — spawn area, combat field, one PvP ring, dummy corner, rack with the hammer plus at most one second weapon, one enemy, spawn control. The archery lane, obstacle course, wave pit, boss-practice gate, extra modes and normalized-stat implementation are Arena v2+, added later precisely because the Arena is permanent.
Exit: the Arena runs on the real KOCorp public path; 4 real players join reliably and 6 has been tested (bots may stand in for missing children); 10 bots roam and fight without correctness failure; combat still feels as good as the offline toy; PvP works only in the ring and costs nothing; rack gear provably cannot leak into persistent inventory; a phone can lock/reload and come back correctly; server CPU/RAM on KOCorp is recorded.

**Kid Test 1 — mandatory gate before Stage 2** *(hours, not a development stage)*
Hand the children the Arena with minimal direction and **record what they do, not what they say**: do they fight each other or cooperate against monsters; which weapon do they pick; do they use dodge; do they try to revive; do they invent their own games and rules; do they spam the monster gate; do they ask for teams or more weapons; do they want to keep playing after the planned test ends; what confuses the youngest; what does the oldest exploit within a minute. This is the project's first look at emergent behaviour, and it should shape Stage 2 before a single adventure room is built.

**Stage 2 — Vertical slice** *(~10 weekends)*
Because the Arena already proved movement, camera, mobile controls, internet multiplayer, reconnect/rejoin, combat, damage authority, the timing mechanic, dodge, revive, death/respawn semantics, an enemy, weapon switching, KOCorp performance and the bot harness, Stage 2 answers only one question: **can these proven systems create a memorable cooperative adventure?** It must not re-invent the multiplayer or combat foundation.
One tiny adventure: village → forest → fight → riddle door (wordless) → boss (hard-coded) → loot → return. Four-player party, backpack, **wipe = the adventure fails and costs nothing** (the recovery cache, attempts and courier floor are Stage 3, §13), difficulty recompute on party-size change, wordless onboarding quest, ping/emote set, telemetry verified end-to-end on the kids' real devices. Exit criteria include the first scripted restore drill (§23).
Asset manifest (pack-sourced unless marked *make*): shared-rig clips for 2 weapon families, 2 enemy models (~3 clips each), 1 boss with per-phase clips, village + forest tile/prop sets, ~6 SFX + 2 music loops, simple hit/heal/revive particle VFX (*make*). Later stages get a one-line asset budget as they are scoped.
**Then: hand phones to the kids — is this actually fun?**

**Stage 3 — Persistent world**
World flags (idempotent), the unlockable bridge, one more region, storage/home room, world event history, **and the full §13 loss system now that loot matters**: checkpoint banking, recovery cache created exactly once, three attempts, the courier floor, protected categories. **The reset covenant flips: persistence becomes sacred; backups + restore drills already proven before this point.**

**Stage 4 — Creation**
The drawing pipeline spike (one real drawing, end-to-end, hours measured) → Tier 0 + Tier 1 live, five-star creator, effect-template mapping, the single admin review screen, creator attribution. The project's most important non-combat milestone.

**Stage 5 — Economy & social**: coins, vendors, gifting, ledger UI; trading with untradeable flags + reversal tool if actually wanted.

**Stage 6 — Player-created adventures**: notes, signs, hunts with escrowed rewards.

**Stage 7 — Living world**: pets, events, more bosses/regions/secrets, GM tools as needed.

## 31. Acceptance test (amended)

Before building a large world, one tiny version must prove all of this simultaneously:

Four children open a URL on four phones, on at least two different networks. They log in (no password typing needed — sessions held). They meet in the village. They enter an adventure. They fight; they dodge; one goes down; another revives them. They solve a wordless cooperative riddle. They defeat a boss. One loot item drops and cannot be duplicated. **One phone locks for 60 seconds mid-fight; that player reopens the browser and is back in the same fight within 30 seconds, automatically.** They return home; the loot persists; **one hard-coded flag persists to tomorrow** (full world flags are Stage 3). **The whole run fits in about 25 minutes, timed.** One player is deliberately yanked mid-boss: the others neither wipe hopelessly (difficulty recomputes) nor lose the loot they already picked up. They close their browsers. Tomorrow everything is still there — including after a restore drill from last night's backup.

If that is reliable and fun — for the youngest player too — the architecture works. Everything after that is expansion.

---

*Decision: APPROVED — build Stage 0A-1.*

*Approved early path: PREP → **0A-1** (offline combat toy, published to a URL) → **Kid Test 0** (two sittings) → **0A-2** (rig gate + device baseline) → **0B** (KOCorp multiplayer/ops proof) → **Stage 1** (permanent Arena) → **Kid Test 1** → **Stage 2** (first adventure vertical slice) → post-slice review driven by observed child behaviour → persistent-world expansion.*
