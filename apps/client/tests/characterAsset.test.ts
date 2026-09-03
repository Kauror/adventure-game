import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CLIP_NAMES, clipFor, isLooping } from '../src/game/characterClips';

/**
 * The shipped character assets, checked against what the game asks of them.
 *
 * Reads the GLB files directly and parses their glTF header — no Babylon, no
 * GPU, no network. That is the point: the roadmap's stop condition for 0A.3 is
 * *replace the asset if it fights you*, so an asset will be swapped sooner or
 * later, and the failure mode when it is swapped badly is silent. A character
 * that simply never plays its attack animation looks like a rendering problem,
 * or like nothing at all, and would be found by a child rather than by CI.
 */

const MODELS = join(import.meta.dirname, '..', 'public', 'models');

/** The JSON chunk of a binary glTF. */
function gltfHeader(file: string): Record<string, unknown> {
  const data = readFileSync(join(MODELS, file));
  expect(data.subarray(0, 4).toString('ascii')).toBe('glTF');

  const jsonLength = data.readUInt32LE(12);
  const chunkType = data.subarray(16, 20).toString('ascii');
  expect(chunkType).toBe('JSON');

  return JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8')) as Record<string, unknown>;
}

const files = ['hero.glb', 'foe.glb'];

describe.each(files)('%s', (file) => {
  const gltf = gltfHeader(file);
  const animations = (gltf.animations as { name?: string }[] | undefined) ?? [];
  const nodes = (gltf.nodes as { name?: string }[] | undefined) ?? [];
  const names = new Set(animations.map((a) => a.name));

  it('contains every clip the game asks for by name', () => {
    for (const clip of Object.values(CLIP_NAMES)) {
      expect(names).toContain(clip);
    }
  });

  it('has the hand socket the hammer is attached to', () => {
    // If this node is renamed, the hammer silently detaches and floats.
    expect(nodes.map((n) => n.name)).toContain('arm-right');
  });

  it('is a node rig rather than a skinned mesh, which is what makes it cheap', () => {
    expect(gltf.skins ?? []).toHaveLength(0);
  });

  it('ships every texture it references', () => {
    // These GLBs do not embed their textures — they point at files beside them.
    // Shipping the model without them gives an untextured character and no
    // error, which is exactly the kind of thing that reaches a phone unnoticed.
    const images = (gltf.images as { uri?: string }[] | undefined) ?? [];
    expect(images.length).toBeGreaterThan(0);

    for (const image of images) {
      expect(image.uri).toBeDefined();
      expect(existsSync(join(MODELS, decodeURIComponent(image.uri!)))).toBe(true);
    }
  });
});

describe('the two variants are the same rig', () => {
  it('shares an identical node hierarchy and animation set', () => {
    // This is the roadmap's "a second visual variant uses the same rig and
    // animations" acceptance, asserted rather than eyeballed.
    const [hero, foe] = files.map(gltfHeader);
    const shape = (gltf: Record<string, unknown>) => ({
      // The outermost node carries the pack's own name for the character, so it
      // differs by design. Everything below it is the rig, and that must match.
      rig: ((gltf.nodes as { name?: string }[] | undefined) ?? []).slice(1).map((n) => n.name),
      clips: ((gltf.animations as { name?: string }[] | undefined) ?? []).map((a) => a.name).sort(),
    });

    expect(shape(hero!)).toEqual(shape(foe!));
  });

  it('differs in its texture, or it is not a variant at all', () => {
    const [hero, foe] = files.map(gltfHeader);
    const texture = (gltf: Record<string, unknown>) =>
      ((gltf.images as { name?: string }[] | undefined) ?? []).map((i) => i.name);

    expect(texture(hero!)).not.toEqual(texture(foe!));
  });
});

describe('choosing a clip', () => {
  const still = { defeated: false, swinging: false, charging: false, moving: false };

  it('stands idle when nothing is happening', () => {
    expect(clipFor(still)).toBe('idle');
  });

  it('walks when moving', () => {
    expect(clipFor({ ...still, moving: true })).toBe('walk');
  });

  it('holds the weapon up while charging, even while walking', () => {
    // The wind-up has to be visible on the body, not only on the hammer.
    expect(clipFor({ ...still, charging: true, moving: true })).toBe('carry');
  });

  it('lets the swing beat the charge', () => {
    expect(clipFor({ ...still, swinging: true, charging: true, moving: true })).toBe('attack');
  });

  it('lets defeat beat everything', () => {
    expect(clipFor({ defeated: true, swinging: true, charging: true, moving: true })).toBe(
      'defeated',
    );
  });

  it('loops the standing clips and plays the others once', () => {
    expect(isLooping('idle')).toBe(true);
    expect(isLooping('walk')).toBe(true);
    expect(isLooping('carry')).toBe(true);
    // A swing that looped would never end, and a corpse that looped would get
    // up and die again forever.
    expect(isLooping('attack')).toBe(false);
    expect(isLooping('defeated')).toBe(false);
  });
});
