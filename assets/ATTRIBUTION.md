# Asset attribution

Every external asset that enters this repository gets an entry here, **added in the
same commit as the asset**. Licences differ per pack, mixing sources creates
obligations, and none of it can be reconstructed from memory a year later.

No external assets have been added yet. The art direction is deliberately not
chosen (PLAN §2 selects CC0/low-cost low-poly packs; the representative pack is
picked in PREP-04 when the rig pipeline work in 0A-2 needs it).

### character_kid01 — the player character

- **Author:** the front and back are **a child's drawing** — one of the children
  this game is being made for. The sides, top and underside were invented to
  complete the box, and the pixel translation and rig were generated in this
  project's design canvas.
- **Licence:** family's own. Nothing here is traced or sampled from any external
  image, and the drawing is not to be published outside the game.
- **Files:** `apps/client/public/models/kid01.glb` (rig and embedded textures),
  `assets/characters/kid01/` (the 23 face textures and the turnaround sheet, kept
  as source art so the skin can be re-edited later).
- **Shape:** 0.75 × 1.30 × 0.50 m, base origin, 1 unit = 1 m, textures embedded.
  **1.30 m is deliberate — it is a child**, and the game uses it at that height
  rather than stretching it to adult size.
- **Rig:** `hip_L/R → leg_L/R`, `torso`, `shoulder_L/R → arm_L/R`, `neck → head`,
  and `shoulder_R → hand_R`, an empty node at the hand which the hammer hangs
  from.
- **No animation clips.** The rig is posed in code instead — see
  `game/rigAnimator.ts`. That is a better fit than baked clips here: a swing
  lasts exactly as long as the hammer's recovery and a walk runs at the speed
  the player is actually moving, neither of which a fixed clip can promise.

This is PLAN §19 arriving early: a child's drawing became a character in the
game they play. Treat it accordingly.

---

### Videvikumaa art set — arena surfaces and props

- **Author:** generated in this project's own Claude Design canvas
- **Source:** internal. Not downloaded, not sampled, not derived from third-party
  images. The handoff manifest states this explicitly per file.
- **Licence:** the project's own. No third-party attribution obligation.
- **Files:** `apps/client/public/textures/{ground,stone,props}/` (21 PNG),
  `apps/client/public/models/props/` (11 GLB).
- **Conventions that must not be broken:** 1 unit = 1 metre and y-up, matching
  ADR 0002. 64 px = 1 m for ground and stone. Pixel art, so **NEAREST sampling
  with mipmaps off** — filtering it turns crisp slabs into mush. Models are
  base-origin, so a prop placed at a floor position needs no vertical offset,
  and their textures are **embedded** in the GLB rather than referenced beside
  it.
- **Known gaps, from the manifest:** the brazier and torch flames were
  `THREE.Sprite` billboards, which glTF cannot carry — the GLBs hold only the
  iron and coals geometry, and the flames must be rebuilt in Babylon from
  `props/flame_sprite.png` and `props/glow_sprite.png`. Emissive _intensity_ is
  also not carried by glTF and has to be re-set on this side.
- **Deliberately excluded:** the reference images the art was directed from are
  of unknown provenance and were never shipped. Nothing here is traced or
  sampled from them.

---

### Kenney — Blocky Characters 2.0

- **Author:** Kenney (Kenney Vleugels)
- **Source:** <https://kenney.nl/assets/blocky-characters>
- **Licence:** CC0-1.0 (Creative Commons Zero). No attribution obligation; this
  entry exists because the project keeps one anyway, and because a year from now
  nobody will remember where these came from.
- **Files:** `apps/client/public/models/hero.glb` (pack's `character-a`),
  `apps/client/public/models/foe.glb` (pack's `character-r`). ~110 kB each.
- **Why this pack:** it was the only Kenney character set that ships **GLB**, and
  the one with the animations the pipeline actually needs. The older "Animated
  Characters" packs are FBX-only with just idle/jump/run — no attack, and no
  format Babylon can load without a conversion toolchain.
- **What it is for:** the Stage 0A-2 rig pipeline test (roadmap 0A.3). A test
  asset, not the protagonist. Both files carry the identical node rig and the
  same 27 animation clips and differ only in their embedded texture, which is
  what makes them the "second visual variant on the same rig" the gate asks for.

---

The other binary in the repository is original and owes nobody anything:
`apps/client/public/apple-touch-icon.png`, a 180×180 hammer generated from a
script in the commit that added it. It exists so an "Add to Home Screen" install
gets an icon rather than a screenshot of a dark canvas — the only way to lose
Safari's URL bar on iOS. Replace it when real art exists.

## Required format

One block per asset or asset pack:

```markdown
### <asset or pack name>

- **Author:** <person or studio>
- **Source:** <pack / site / marketplace name>
- **Licence:** <e.g. CC0-1.0, CC-BY-4.0, proprietary — with the attribution string if one is required>
- **URL:** <canonical link>
- **Obtained:** <YYYY-MM-DD>
- **Files:** <paths in this repository>
- **Modifications:** <none | retextured | rig retargeted | scaled to metres | ...>
```

## Rules

- **Licence before download.** If the licence is unclear, the asset does not enter the repository.
- **Record modifications.** Several licences require stating that a work was changed.
- **Attribution-required assets** must also have their required credit string recorded here verbatim, so the in-game credits screen can be generated from this file later.
- **Binary assets go to Git LFS** — see `.gitattributes` and `docs/decisions/0001-foundation-stack.md`.
- Children's own drawings are **not** external assets and are not listed here; their provenance lives in the database (`item_design`, PLAN §19).

## Videvikumaa — the Arena (`arena.glb`)

|         |                                                                                          |
| ------- | ---------------------------------------------------------------------------------------- |
| Source  | Built for this project with Claude Design; exported by `THREE.GLTFExporter r184`.        |
| Files   | `apps/client/public/models/arena/arena.glb`, source zip and manifest in `assets/world/`. |
| Licence | The family's own work. No third-party asset is included.                                 |
| Scale   | 1 unit = 1 m, Y up, origin at the centre of the fight floor.                             |

Fight floor y=0 (r=8 m), rim step +0.2, village ground +0.4; walls enclose a
24 m square. The walkability grid in `packages/content/regions/test-arena.json`
is **generated from this model's own geometry**, which is the only reason the
two can be trusted to agree.

`assets/world/videvikumaa-arena-handoff.md` is the artist's manifest and is
load-bearing: glTF carries neither sprites nor lights, so the exporter dropped
the flames, the glows and all four lights. The model keeps named empty nodes
where each sprite belongs (`flame`, `brazier_glow`, `torch_glow`, `gate_spill`,
`secret_spill`, `shrine_glow`, `grove_glow`) and the manifest lists the lights.
