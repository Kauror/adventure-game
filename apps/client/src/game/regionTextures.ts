import type { Region } from '@adventure/game-core';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Surfaces for the arena, drawn in code.
 *
 * Generated rather than loaded, for the same reason the sounds are synthesised
 * and the app icon is: the art direction is deliberately not chosen yet (PLAN
 * §2 picks a pack at PREP-04), and committing to a texture pack now would be
 * choosing it by accident. These cost no download, no licence and no
 * attribution, and they are trivially replaced by real art later.
 *
 * The floor grid is the part that earns its place. It repeats **exactly once
 * per tile**, so every line on the ground is a one-metre boundary — the same
 * metre the rules use (ADR 0002). That turns "how far is that enemy" and "will
 * this dodge clear it" into something a child can read off the floor instead of
 * estimating, and it makes a wrong scale anywhere in the pipeline obvious
 * rather than subtle.
 */

/** Small on purpose: these are flat stylised surfaces, not photographs. */
const TEXTURE_SIZE = 128;

export interface RegionTextures {
  readonly floor: DynamicTexture;
  readonly wall: DynamicTexture;
  readonly platform: DynamicTexture;
  readonly dispose: () => void;
}

/**
 * A small deterministic generator.
 *
 * Seeded so the speckle is identical on every load: a texture that reshuffles
 * itself each reload makes two screenshots impossible to compare, and this
 * project compares screenshots a lot.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function createSurface(
  scene: Scene,
  name: string,
  draw: (context: CanvasRenderingContext2D, size: number) => void,
): DynamicTexture {
  // Mipmaps on. Without them a one-metre tile minified to ~40 screen pixels
  // samples straight past a thin line and the grid simply is not there — which
  // is exactly what happened the first time.
  const texture = new DynamicTexture(
    name,
    { width: TEXTURE_SIZE, height: TEXTURE_SIZE },
    scene,
    true,
  );
  draw(texture.getContext() as unknown as CanvasRenderingContext2D, TEXTURE_SIZE);
  texture.update();

  // Repeat, not clamp. `DynamicTexture` defaults to CLAMP, so a surface with a
  // uScale above 1 samples the edge texel across its entire face — and since the
  // grid line is drawn *on* that edge, the floor rendered as one flat sheet of
  // line colour. It looked like a texture that had failed to draw, and was
  // actually a texture drawn perfectly and sampled wrong.
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

/** Flecks of light and dark, so a flat surface is not a flat colour. */
function speckle(
  context: CanvasRenderingContext2D,
  size: number,
  seed: number,
  count: number,
  alpha: number,
): void {
  const random = seededRandom(seed);
  for (let i = 0; i < count; i += 1) {
    const lighter = random() > 0.5;
    context.fillStyle = lighter ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    context.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3);
  }
}

export function createRegionTextures(scene: Scene, region: Region): RegionTextures {
  const floor = createSurface(scene, 'region-floor-texture', (context, size) => {
    context.fillStyle = '#222a25';
    context.fillRect(0, 0, size, size);
    speckle(context, size, 20260903, 220, 0.035);

    // The metre grid.
    //
    // Filled bars along two edges rather than a stroked rectangle: a stroke
    // straddles the boundary and half of it is clipped, and adjacent tiles then
    // draw the same line twice at half strength. Two edges means one crisp line
    // per boundary. Thick and bright enough to survive being minified to a
    // couple of screen pixels — the first attempt was a 2 px line that
    // mipmapping washed away entirely.
    // Wide and *high contrast*, not fine and subtle. At this camera a tile is
    // about forty screen pixels, so the texture is minified and mipmapped: a
    // line only slightly lighter than its background averages into the
    // background and the grid disappears completely. Measured from the texture
    // itself, the first attempt differed from the base by a factor of 1.4 and
    // read as flat colour. This is roughly 3x.
    const line = Math.round(size * 0.08);
    context.fillStyle = 'rgba(140,190,158,0.55)';
    context.fillRect(0, 0, size, line);
    context.fillRect(0, 0, line, size);

    // A softer half-metre cross, for judging short distances up close.
    context.fillStyle = 'rgba(140,190,158,0.16)';
    context.fillRect(size / 2 - line / 3, 0, (line * 2) / 3, size);
    context.fillRect(0, size / 2 - line / 3, size, (line * 2) / 3);
  });

  // One repeat per tile: every line on the floor is a one-metre boundary.
  floor.uScale = region.width;
  floor.vScale = region.height;

  const wall = createSurface(scene, 'region-wall-texture', (context, size) => {
    context.fillStyle = '#4a5163';
    context.fillRect(0, 0, size, size);
    speckle(context, size, 987654, 160, 0.06);

    // Blockwork, with the courses offset. Reads as built rather than extruded,
    // and gives the eye something to measure a wall's height against.
    const courses = 4;
    const courseHeight = size / courses;
    context.strokeStyle = 'rgba(0,0,0,0.28)';
    context.lineWidth = 2;
    for (let i = 0; i <= courses; i += 1) {
      const y = i * courseHeight;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(size, y);
      context.stroke();
    }
    for (let i = 0; i < courses; i += 1) {
      const offset = i % 2 === 0 ? 0 : size / 4;
      for (let x = offset; x < size; x += size / 2) {
        context.beginPath();
        context.moveTo(x, i * courseHeight);
        context.lineTo(x, (i + 1) * courseHeight);
        context.stroke();
      }
    }

    // A lit top edge, so the top of a wall separates from its face under a
    // single hemispheric light.
    context.fillStyle = 'rgba(255,255,255,0.10)';
    context.fillRect(0, 0, size, 4);
  });

  const platform = createSurface(scene, 'region-platform-texture', (context, size) => {
    context.fillStyle = '#3c5a44';
    context.fillRect(0, 0, size, size);
    speckle(context, size, 424242, 180, 0.06);

    // A bright rim: the platform is a metre up, and the edge is the thing a
    // player needs to see before stepping off it.
    context.strokeStyle = 'rgba(190,235,200,0.35)';
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, size - 3, size - 3);

    context.strokeStyle = 'rgba(190,235,200,0.12)';
    context.lineWidth = 1;
    context.strokeRect(size / 4, size / 4, size / 2, size / 2);
  });

  return {
    floor,
    wall,
    platform,
    dispose: () => {
      floor.dispose();
      wall.dispose();
      platform.dispose();
    },
  };
}
