# Videvikumaa — the Arena

GLB export of the home-biome arena. Y up, metres, origin at the centre of the fight floor.
Fight floor y=0 (r=8 m), rim step y=+0.2, village ground y=+0.4.

## What glTF could not carry

glTF has no sprite and no light in the base spec, so rebuild these in engine:

### Dynamic lights (only three — keep it that way)

| name             | type                 | colour                       | intensity              | distance | position    |
| ---------------- | -------------------- | ---------------------------- | ---------------------- | -------- | ----------- |
| twilight_ambient | hemisphere           | sky #7A6AA8 / ground #3A4A5C | 1.35                   | –        | –           |
| hearth_light     | point (casts shadow) | #F2913D                      | 90 (120 during a wave) | 30       | 0, 3.2, 0   |
| gate_light       | point                | #E06AA8                      | 45 (60 during a wave)  | 14       | 9.6, 2.2, 0 |
| moon_rim         | directional          | #6EA8C8                      | 0.7                    | –        | -8, 12, -6  |

Fog: exponential, #241E44, density 0.009. Tone mapping: ACES filmic, exposure 1.35.

### Additive sprites (props/glow_sprite.png, props/flame_sprite.png)

Every other glow in the board is a billboard sprite with additive blending and depth-write off —
brazier flames, ruin lanterns on the tall pillars, gate spill, shrine glow, grove glow, the ground
light pools, and the ember particles (90 points, drifting up from y 0.4 to 3.6, then looping).

### Colour law

Warm #F2913D / #FFD24E = safe and interactive. Pink #E06AA8 = spawn/arcane. Green #4EE08A = secret.
Red #FF3B30 is reserved for danger telegraphs only (the wave-active ring).

## Camera

Game camera: position (-9, 13.5, 11), target (0, 0.4, 0) — ortho-steep, roofs and heads stay readable.

## Textures

64 px, nearest-neighbour filtering, mipmaps off, seamless wrap. They are embedded in the GLB and also
included loose under textures/ for engine-side reimport at your own compression settings.
