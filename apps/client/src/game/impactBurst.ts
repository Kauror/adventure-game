import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';

/**
 * A small spray of sparks where a blow lands.
 *
 * The texture is drawn in code rather than loaded, for the same reason the
 * sounds are synthesised: there is no asset to license yet, and a soft dot is
 * a soft dot. One pooled system handles every burst — spawning a particle
 * system per hit would be the kind of thing that quietly ruins a phone.
 */
export interface ImpactBurst {
  readonly burst: (x: number, y: number, z: number, strength: number) => void;
  readonly dispose: () => void;
}

function createSparkTexture(scene: Scene): DynamicTexture {
  const size = 32;
  const texture = new DynamicTexture('spark', { width: size, height: size }, scene, false);
  const context = texture.getContext();

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,235,190,0.85)');
  gradient.addColorStop(1, 'rgba(255,200,120,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  texture.update();

  return texture;
}

export function createImpactBurst(scene: Scene): ImpactBurst {
  // Babylon consumes `manualEmitCount` once per rendered frame, so two bursts
  // in the same frame would overwrite rather than combine — losing one of them
  // at exactly the dramatic moment when both matter (the killing blow landing
  // as the enemy connects). Counts accumulate within a frame and reset after it.
  let pendingCount = 0;
  let strongestSoFar = -1;

  const texture = createSparkTexture(scene);
  const system = new ParticleSystem('impact', 120, scene);

  system.particleTexture = texture;
  system.emitter = Vector3.Zero();
  system.minEmitBox = new Vector3(-0.08, -0.08, -0.08);
  system.maxEmitBox = new Vector3(0.08, 0.08, 0.08);

  system.color1 = new Color4(1, 0.85, 0.45, 1);
  system.color2 = new Color4(1, 0.55, 0.2, 1);
  system.colorDead = new Color4(0.6, 0.3, 0.1, 0);

  system.minSize = 0.08;
  system.maxSize = 0.22;
  system.minLifeTime = 0.12;
  system.maxLifeTime = 0.32;

  system.direction1 = new Vector3(-2.5, 1.5, -2.5);
  system.direction2 = new Vector3(2.5, 3.5, 2.5);
  system.gravity = new Vector3(0, -9, 0);
  system.minEmitPower = 1.5;
  system.maxEmitPower = 4;

  system.blendMode = ParticleSystem.BLENDMODE_ADD;
  // Manual bursts only: it never emits on its own.
  system.emitRate = 0;
  system.manualEmitCount = 0;
  system.targetStopDuration = 0;
  system.start();

  const frameObserver = scene.onAfterRenderObservable.add(() => {
    pendingCount = 0;
    strongestSoFar = -1;
  });

  return {
    burst: (x, y, z, strength) => {
      const clamped = Math.max(0, Math.min(1, strength));

      // The strongest impact of the frame owns the position; a single system
      // can only emit from one point, and the biggest hit is the one to show.
      if (clamped > strongestSoFar) {
        strongestSoFar = clamped;
        const emitter = system.emitter;
        if (emitter instanceof Vector3) {
          emitter.set(x, y, z);
        }
      }

      pendingCount += Math.round(6 + clamped * 26);
      system.manualEmitCount = pendingCount;
    },

    dispose: () => {
      scene.onAfterRenderObservable.remove(frameObserver);
      system.dispose();
      texture.dispose();
    },
  };
}
