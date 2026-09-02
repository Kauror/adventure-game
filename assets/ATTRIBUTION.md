# Asset attribution

Every external asset that enters this repository gets an entry here, **added in the
same commit as the asset**. Licences differ per pack, mixing sources creates
obligations, and none of it can be reconstructed from memory a year later.

No external assets have been added yet. The art direction is deliberately not
chosen (PLAN §2 selects CC0/low-cost low-poly packs; the representative pack is
picked in PREP-04 when the rig pipeline work in 0A-2 needs it).

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
