# Character art pipeline

How a character gets from a file into the game, and what to check when the asset
is replaced — which the roadmap expects to happen (0A.3's stop condition is
_replace the asset if it fights you_).

This is Stage 0A-2 work. The asset in the repository is a **pipeline test
asset**, not the protagonist.

## The pipeline

```
GLB  ──►  fitted to a height  ──►  clips asked for by meaning  ──►  hand socket  ──►  hammer
                                                                       │
                                                    second texture ─────┘  (same rig, same clips)
```

Three files, and nothing else knows the asset exists:

| File                                       | Job                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `apps/client/src/game/characterClips.ts`   | The only place a clip's real name appears. Everything else asks for `walk`, not `"walk"`. |
| `apps/client/src/game/character.ts`        | Loads, fits, animates, exposes the socket.                                                |
| `apps/client/tests/characterAsset.test.ts` | Reads the shipped GLBs and fails if they no longer contain what the game asks for.        |

## The current asset

**Kenney — Blocky Characters 2.0**, CC0. See `assets/ATTRIBUTION.md`.

- `apps/client/public/models/hero.glb` — the pack's `character-a`
- `apps/client/public/models/foe.glb` — the pack's `character-r`
- `apps/client/public/models/Textures/` — **required**: these GLBs do _not_
  embed their textures, they reference files beside them. Shipping the model
  without them gives an untextured character and no error.

Both files carry the identical rig and the same 27 clips and differ only in the
texture. That is the roadmap's "second visual variant uses the same rig and
animations", and it is asserted in the test rather than eyeballed.

Chosen because it was the only Kenney character set shipping **GLB** with the
clips the game needs. The older _Animated Characters_ packs are FBX-only with
just idle/jump/run — no attack, and no format Babylon can load without dragging
in a conversion toolchain.

### The rig

Not a skinned mesh. Six body parts animated by transform:

```
character-a
└── root
    ├── leg-left, leg-right
    └── torso
        ├── arm-left, arm-right   ← the hand socket
        └── head
```

Cheap on a phone — no skinning, no bone matrices — and it makes the socket an
ordinary node, so anything parented to `arm-right` inherits the swing for free.

## Two things measured, never assumed

Both exist because the asset _will_ be swapped, and both are the kind of thing
that silently looks wrong rather than failing.

**Height and standing position.** The loader measures the model's bounding box
and scales it to the metres the game wants, then shifts it so its feet sit at
the node's origin. Placement code says "stand here on the ground" and means it,
whatever the asset thought its own origin and units were.

**Where a held object goes.** The socket is a whole arm — its origin is the
_shoulder_, and a hammer pivoted there floats above the character's head, which
is exactly what happened first time. The grip is computed as the bottom-centre
of the socket's bounding box. A prop authored in metres also has to divide out
the fitting scale (`character.fittedScale`), or it arrives shrunk into the
asset's own units.

## Which way does it face?

The one thing that cannot be reasoned out reliably. glTF is right-handed and
Babylon is not, so the loader inserts a `__root__` with a mirrored Z — which
also means the node named `arm-right` may appear on the visually opposite side.
Do not trust the arm names, and do not trust a screenshot from a 55° camera,
where mostly what you see is the top of the head.

**Measure it instead.** Face the character north and play the melee clip:

```js
const root = scene.transformNodes.filter((n) => n.name === 'character')[0];
root.rotation.y = 0; // north, +Z
const g = scene.animationGroups.find((a) => a.name === 'attack-melee-right');
const arm = scene.meshes.filter((m) => m.name === 'arm-right')[0];

g.stop();
g.reset();
g.start(false, 1);
for (let i = 0; i <= 10; i++) {
  g.goToFrame(g.from + ((g.to - g.from) * i) / 10);
  root.computeWorldMatrix(true);
  arm.computeWorldMatrix(true);
  console.log(i, +(arm.getAbsolutePosition().z - root.position.z).toFixed(3));
}
```

A punch travels forward. If the largest excursion is **positive**,
`MODEL_FORWARD_OFFSET` is right; if negative, it is wrong by π. For the current
asset it reaches +0.43 m forward against a 0.34 m backswing, hence `Math.PI`.

## Swapping the asset

1. Drop the new GLB (and any textures it references) into
   `apps/client/public/models/`.
2. Update `CLIP_NAMES` in `characterClips.ts` to the new clip names.
3. Run `pnpm --filter @adventure/client test` — `characterAsset.test.ts` fails
   loudly if a clip or the socket node is missing, or if a referenced texture
   was not copied across.
4. Re-run the facing measurement above.
5. Update `assets/ATTRIBUTION.md` **in the same commit**.

Nothing else should need touching. If it does, that is the signal the roadmap's
stop condition is talking about.

## What is deliberately not here yet

No LOD, no texture atlasing, no draw-call batching, no shadow tuning, no
animation blending. Those are measurements for 0A.12 and decisions for later —
guessing at them before there are numbers from a real phone is how a project
acquires optimisations it cannot justify.
