# Asset attribution

Every external asset that enters this repository gets an entry here, **added in the
same commit as the asset**. Licences differ per pack, mixing sources creates
obligations, and none of it can be reconstructed from memory a year later.

No external assets have been added yet. The art direction is deliberately not
chosen (PLAN §2 selects CC0/low-cost low-poly packs; the representative pack is
picked in PREP-04 when the rig pipeline work in 0A-2 needs it).

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
