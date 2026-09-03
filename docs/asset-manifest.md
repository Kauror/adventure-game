# Videvikumaa — asset handoff manifest

Generated 2026-09-03. World scale: **1 unit = 1 metre**, y-up. No scale factor is
needed — every model below was authored directly in metres.

Colour palette all art is locked to (from `Art Direction Board.dc.html`):
world base `#211D3D #33305C #45577A #5F8A8C #6E4A78 #8FA3B8` ·
light `#F2913D #FFD24E #4EE08A #4EC8E0 #E06AA8 #C4472F` ·
reserved signals `#FF3B30` (enemy telegraph/damage only) `#34E07A` (heal)
`#FFFFFF` (hit flash) `#3D9BFF` (party).

---

## 1. Source textures — `textures/` (21 files)

All authored by Claude (procedurally drawn to canvas in this project), original
work, no external source. **Licence: yours outright** — no third-party
attribution entry required for any file in this section.

All are indexed-look pixel art meant for `NEAREST` sampling with **mipmaps
off**. Scale convention: **64 px = 1 m** for ground and stone.

| filename                       | what it is                                        | px      | intended use                                     | tiling behaviour                                                                                                                    | provenance & licence       |
| ------------------------------ | ------------------------------------------------- | ------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| ground/flagstone_a.png         | Blue-grey slab floor, 3 brick-offset rows         | 64×64   | Arena fight floor, ~70% of cells                 | seamless both directions                                                                                                            | Claude-generated, original |
| ground/flagstone_b_cracked.png | Same slabs + 2 fracture lines                     | 64×64   | Scatter ~20% of floor cells                      | seamless both directions                                                                                                            | Claude-generated, original |
| ground/flagstone_teal.png      | Ruin-teal slab variant                            | 64×64   | Lit stone within ~2 m of braziers/torches        | seamless both directions                                                                                                            | Claude-generated, original |
| ground/flagstone_mossy.png     | Slabs with moss in the gaps                       | 64×64   | Outer 1 m ring of the arena floor, ~35%          | seamless both directions                                                                                                            | Claude-generated, original |
| ground/dirt.png                | Violet-toned dirt with pebbles                    | 64×64   | Missing-slab fill, village ground                | seamless both directions                                                                                                            | Claude-generated, original |
| ground/dirt_mossy.png          | Dirt with moss clumps                             | 64×64   | Village ground beyond the arena rim              | seamless both directions                                                                                                            | Claude-generated, original |
| ground/rim_step.png            | Two treads + risers, top-down                     | 64×64   | Arena rim steps; rotate to follow the ring       | seamless horizontally only                                                                                                          | Claude-generated, original |
| ground/pvp_inlay.png           | Ember-veined stone, dashed boundary               | 64×64   | PvP ring floor (the only red floor in the game)  | wraps, but has an intentional edge feature (dashed red boundary along the TOP edge — use as the boundary row, not as interior fill) | Claude-generated, original |
| stone/stone_block.png          | Brick course, 4 rows offset                       | 64×64   | Wall bodies, gate piers, plinths                 | seamless both directions                                                                                                            | Claude-generated, original |
| stone/stone_teal.png           | Teal ruin brick course                            | 64×64   | Accent blocks, lit wall faces                    | seamless both directions                                                                                                            | Claude-generated, original |
| stone/pillar_shaft.png         | 8 vertical flutes + drum joints                   | 64×64   | Pillar and column shafts (1 wrap = 8 faces)      | seamless both directions                                                                                                            | Claude-generated, original |
| stone/arch_stone.png           | Single dressed block face with chiselled borders  | 64×64   | One tile per voussoir / arch block               | per-face, not intended as fill                                                                                                      | Claude-generated, original |
| stone/stone_cap.png            | Worn horizontal cap surface                       | 64×64   | Cap stones, crowns, thresholds, plinth tops      | per-face, not intended as fill                                                                                                      | Claude-generated, original |
| stone/stone_broken.png         | Rough fracture face                               | 64×64   | Broken tops, rubble chunks, footings             | seamless both directions                                                                                                            | Claude-generated, original |
| stone/rune_disc.png            | Radial mosaic, sigil, ember core, dashed PvP ring | 256×256 | UV-mapped to the 9 m PvP inlay disc; 21.6% alpha | not tiling at all (UV-mapped, alpha)                                                                                                | Claude-generated, original |
| props/wood_plank.png           | 4 vertical planks, iron nails                     | 64×64   | Crates, weapon rack, torch handles               | seamless both directions                                                                                                            | Claude-generated, original |
| props/iron.png                 | Dark blue-grey metal with rivets                  | 64×64   | Brazier, bands, hooks, brackets                  | seamless both directions                                                                                                            | Claude-generated, original |
| props/coals.png                | Charred coals with hot embers                     | 64×64   | Brazier/torch fuel; also use as emissiveMap      | seamless both directions                                                                                                            | Claude-generated, original |
| props/puddle_decal.png         | Irregular water blob, soft reflections            | 128×128 | Ground decal, 48.9% alpha, depthWrite off        | not tiling at all (decal)                                                                                                           | Claude-generated, original |
| props/flame_sprite.png         | Teardrop flame, hot core, alpha edges             | 64×64   | Additive billboard for brazier + torch flames    | not tiling at all (sprite)                                                                                                          | Claude-generated, original |
| props/glow_sprite.png          | Soft radial light blob                            | 32×32   | Additive billboard standing in for a point light | not tiling at all (sprite)                                                                                                          | Claude-generated, original |

**Excluded from this package, as requested:** all 16 `preview_*_tiled.png`
(256×256) and `preview_arena_patch.png` (512×512) — documentation renders, not
source art.

---

## 2. Stone + prop models — GLB

Source: `meshes/stone-meshes.html`, built procedurally with three.js r184 and
exported through the stage toolbar's **Download GLB** (`GLTFExporter`,
`binary: true`).

### Textures: EMBEDDED

Every `.glb` here has its **texture bitmaps embedded in the binary chunk** —
three.js `GLTFExporter` in binary mode inlines all image data. There are **no
external texture references and no relative paths to ship**. Each file is
self-contained: drop it into Babylon and it arrives textured.

(This differs from the character models you mention — those reference textures
externally. These do not.)

### Origin

**Every model is base-origin**: the mesh sits on `y = 0`, so placing it at a
floor position works with no vertical offset. Two footnotes:

- `wall_torch` — origin is at the wall mount point, base of geometry at
  **y = +0.327 m**. This is deliberate: it is a wall-mounted prop, positioned at
  the bracket height, not stood on the floor.
- `pillar_stump` and `fallen_column` — the vertex-jitter pass ("roughen") pushes
  a few verts to **y = −0.054 m** and **−0.060 m**. Sub-6 cm below the floor
  plane, intentional so broken stone beds into the ground rather than floating.

Horizontal origin is centred on the main mass for all models. Four have
deliberately asymmetric dressing, so their bbox centre is offset from the
origin: `pillar_stump` (+0.16 m X, fallen chunk), `fallen_column` (−0.09 m X),
`wall_crumble_cap` (+0.17 X / +0.14 Z, rubble), `wall_torch` (−0.05 Z).

### Per-model table

Dimensions are **geometry-only bounding boxes in metres (X × Y × Z)**. The
brazier and torch also carry two additive sprites each; those inflate the
scene-graph bbox to 1.9 m and 1.2 m respectively but are **not exported** (see
the caveat below).

| filename             | what it is                                              | metres (X×Y×Z)     | intended use                                                         | tiling behaviour              | provenance & licence       |
| -------------------- | ------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- | ----------------------------- | -------------------------- |
| pillar_stump.glb     | Broken octagonal pillar, plinth, fallen chunk           | 1.24 × 1.38 × 0.99 | Arena rim ×6                                                         | not tiling at all (model)     | Claude-generated, original |
| fallen_column.glb    | Two column segments + capital + rubble                  | 2.81 × 0.76 × 0.95 | Outside the arena ring ×4                                            | not tiling at all (model)     | Claude-generated, original |
| wall_segment_2m.glb  | Wall body + cap, brick pattern in texture               | 2.06 × 1.58 × 0.60 | Arena wall, village edges; tiles end-to-end along X                  | not tiling at all (model)     | Claude-generated, original |
| wall_crumble_cap.glb | Wall end-piece, stepped break, 3 rubble chunks          | 1.33 × 1.39 × 0.88 | Caps every wall gap; rotate 180° to vary                             | not tiling at all (model)     | Claude-generated, original |
| gate_arch.glb        | 9-voussoir arch, gold keystone rune, pink emissive fill | 3.50 × 4.12 × 1.00 | Monster spawn gate (east); swap fill material for the adventure gate | not tiling at all (model)     | Claude-generated, original |
| brazier_bowl.glb     | Iron bowl on 3 legs, emissive coals                     | 0.77 × 0.86 × 0.77 | Arena ×4 on the diagonals                                            | not tiling at all (model)     | Claude-generated, original |
| wall_torch.glb       | Bracket, ring, wrapped handle, coals                    | 0.22 × 0.41 × 0.42 | Instanced along walls; wall-mounted origin                           | not tiling at all (model)     | Claude-generated, original |
| crate.glb            | Planked crate, corner posts, iron bands, lid            | 0.74 × 0.76 × 0.74 | Dressing outside the ring; rotate 90° to vary                        | not tiling at all (model)     | Claude-generated, original |
| weapon_rack.glb      | 4-slot rack, iron hooks, gold interact plaque           | 1.60 × 1.34 × 0.50 | Flanks the arena entrance                                            | not tiling at all (model)     | Claude-generated, original |
| puddle_decal.glb     | Alpha puddle plane (+ a flagstone reference plane)      | 2.20 × 0.01 × 2.20 | Ground decal, sits 1.2 cm above the floor                            | not tiling at all (decal)     | Claude-generated, original |
| rune_mosaic_disc.glb | Textured mosaic plane over a stone disc                 | 9.00 × 0.05 × 9.00 | PvP inlay at the arena centre                                        | not tiling at all (UV-mapped) | Claude-generated, original |

Triangle counts (geometry as exported): pillar 120 · column 120 · wall 36 ·
crumble 84 · gate 248 · brazier 404 · torch 264 · crate 96 · rack 636 · puddle 4
· rune disc 130.

### Two caveats on the GLB export

1. **Sprites do not export.** `brazier_bowl` and `wall_torch` each carry two
   `THREE.Sprite` billboards (flame + light blob) which glTF has no equivalent
   for — they are silently dropped. The `.glb` gives you the iron and coals
   geometry only. Rebuild the flame in Babylon from `props/flame_sprite.png` and
   `props/glow_sprite.png` as additive billboards; that was always the intended
   pipeline (it keeps both props off the dynamic-light budget).
2. **Emissive intensity is not carried.** The `coals`, gold and pink materials
   set `emissiveIntensity` in three.js; glTF stores only the emissive factor, so
   re-set intensity on the Babylon side.

---

## 3. Board exports — `export/boards/` (4 PNG, scale 1)

Element captures at their rendered native size, not the scrolling documents.

| filename                   | what it is                                                                         | px      | intended use                                              | tiling behaviour  | provenance & licence       |
| -------------------------- | ---------------------------------------------------------------------------------- | ------- | --------------------------------------------------------- | ----------------- | -------------------------- |
| arena_v2_map.png           | Arena v2 dressed top-down plan, 20 × 20 m                                          | 861×861 | Layout + dressing reference for building the arena scene  | not tiling at all | Claude-generated, original |
| art_direction_palette.png  | Full palette: world base, light & magic, reserved signals with hex codes           | 904×682 | The colour law all art is checked against                 | not tiling at all | Claude-generated, original |
| art_direction_lighting.png | "Light is the level designer" — warm/cool/magic/red meanings + mobile light budget | 904×671 | Lighting rules for scene setup                            | not tiling at all | Claude-generated, original |
| sade_figure_stage.png      | "Säde" character mockup, front 3/4                                                 | 400×470 | Colour and proportion target for restyling the player rig | not tiling at all | Claude-generated, original |

**Size note:** you asked for the arena map at ~900 × 900. Its CSS cap is 900 px
but it renders to fit the document column, so native at scale 1 came out
**861 × 861**. That is the true native size — it was captured, not upscaled. If
you need exactly 900, say so and I'll widen the preview and re-capture.

The palette section is one element containing all three colour groups; the
lighting law is a separate element, so it is two files rather than one.

---

## 4. Not included

- Home Biome / village layout, Player Figure Template — skipped as requested.
- `uploads/*.png` (13 files) — **your** reference images, pasted from
  Pinterest-style sources. **Provenance: unknown**, licence unknown. Per your
  own rule these cannot ship; they are excluded from every package here and
  should stay out of the repository. They were used as visual direction only —
  nothing in this handoff is traced, sampled, or derived from their pixels.
- No PDF, as requested.
- No `.gltf` + external-bin variant; GLB only.

## 5. What does not exist yet

So you don't go looking for it: there is no player/character model, no enemy
model, no UI art, no wall or prop texture beyond the 21 above, no normal maps
(the style is flat base colour + emissive only), no KTX2/Basis compressed
versions (PNG source only — the plan calls for KTX2 by Stage 2), and no
animation clips. The character work so far is 2D mockup only.
