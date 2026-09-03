# character_kid01 — import notes

**Model:** character_kid01.glb (export it from the viewer's "Download GLB" button — see below), 6 meshes,
base origin, 1 unit = 1 m, 0.75 × 1.30 × 0.50 m arms-down. Textures are EMBEDDED in the GLB.

**Node hierarchy (for the shared rig):**

- hip_L / hip_R → leg_L / leg_R (pivot at hip, y = 0.36)
- torso
- shoulder_L / shoulder_R → arm_L / arm_R (pivot at shoulder, y = 0.77)
  - shoulder_R → hand_R (empty socket for the hammer, at the hand)
- neck → head (pivot at neck, y = 0.80)

**Textures (this folder):** 23 face PNGs — only needed if you want to rebuild or edit the skin;
the GLB already carries them. Sample with NEAREST, mipmaps off.

- head_* 8 × 8 (front, back, right, left, top, bottom)
- torso_* 8 × 7 front/back · 4 × 7 side · 8 × 4 top/bottom
- arm_* 3 × 7 front/back/outer/inner · 3 × 3 top/bottom
- leg_* 4 × 6 front/back/outer/inner · 4 × 4 top/bottom
- turnaround_sheet.png 804 × 288 — reference only, not a game texture

Front and back come from the child's drawing; right, left, top and underside are invented.
Provenance: drawing © the child (family); pixel translation generated in this project — original.
