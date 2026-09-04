import './styles.css';

import {
  TILE_METRES,
  elevationAtWorld,
  parseRegion,
  spawnPoint,
  tileCentreToWorld,
} from '@adventure/game-core';
import { TEST_ARENA_ID, regions } from '@adventure/content';

import {
  ENEMY,
  HAMMER,
  isWithinMeleeArc,
  spawnPoint as findSpawn,
  timingBands,
} from '@adventure/game-core';
import type { AttackSwing } from '@adventure/game-core';

import { createAudio } from './audio/audio';
import type { SwingSound } from './audio/audio';
import { resolveAssist } from './config/assist';
import { buildLabel } from './config/buildInfo';
import { createGameCamera } from './game/camera';
import { loadCharacter } from './game/character';
import { ENEMY_HEIGHT_METRES, createEnemyActor } from './game/enemy';
import { createEngine } from './game/createEngine';
import { createFlames } from './game/flames';
import { createArenaScene, createArenaLighting } from './game/arenaScene';
import { createProps } from './game/props';
import { applyFrameCap, frameCapFromLocation } from './game/frameCap';
import { createDiagnostics } from './game/diagnostics';
import { createHitStop } from './game/hitStop';
import { createImpactBurst } from './game/impactBurst';
import { createImpactRing } from './game/impactRing';
import { PLAYER_HEIGHT_METRES, createPlayer } from './game/player';
import { createScene } from './game/createScene';
import { createInput } from './input/createInput';
import { preventBrowserZoom } from './input/preventZoom';
import type { JoystickOrigin } from './input/touchJoystick';
import { t } from './i18n';
import { createChargeMeter } from './ui/chargeMeter';
import { mountUi } from './ui/mountUi';

/**
 * Maps a swing to its voice. Heavier and better-timed swings sound bigger.
 *
 * Typed against `AttackSwing` rather than loose strings so that adding a grade
 * or a weapon kind — five weapon families are planned — fails to compile here
 * instead of silently falling through to the plainest sound.
 */
function swingSound(swing: AttackSwing): SwingSound {
  if (swing.kind === 'heavy') {
    if (swing.grade === 'perfect') {
      return 'heavyPerfect';
    }
    return swing.grade === 'great' ? 'heavyGreat' : 'heavyGood';
  }
  return swing.comboCount >= HAMMER.comboLength ? 'lightFinisher' : 'light';
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
}

/** `?joystick=fixed` to compare a fixed stick against the default dynamic one. */
function requestedJoystickOrigin(): JoystickOrigin {
  const params = new URLSearchParams(window.location.search);
  return params.get('joystick') === 'fixed' ? 'fixed' : 'dynamic';
}

/**
 * Boots the client: content -> engine -> scene -> player -> input -> camera ->
 * render loop -> UI. Returns a teardown function so the whole thing can be
 * disposed cleanly (used by Vite HMR in development).
 */
/**
 * The two character models.
 *
 * The player is the project's own character, built from a child's drawing. It
 * has a rig and no animation clips, so it is posed in code (see rigAnimator.ts).
 * The enemy is still a Kenney blocky character, which carries its own clips —
 * two different pipelines through one loader, which is the point of the loader.
 */
const HERO_MODEL = '/models/kid01.glb';
const FOE_MODEL = '/models/foe.glb';

/**
 * Which way each model faces, measured on the device.
 *
 * The child's character is authored facing north already; the Kenney foe is
 * built facing the other way. These were one constant until the hero walked
 * backwards with its head on the wrong way round — `head_front` sat half a
 * metre south of `head_back` while the game believed the character faced north.
 */
const HERO_FORWARD_RADIANS = 0;
const FOE_FORWARD_RADIANS = Math.PI;

/**
 * The device-baseline measurement scene, when asked for (roadmap 0A.12).
 *
 * Imported dynamically and gated behind a query parameter, so nothing about it —
 * including the shadow machinery the game does not otherwise use — reaches the
 * bundle a child downloads. It is a synthetic scene that produces numbers and is
 * never shown to a player.
 */
async function startStress(): Promise<() => void> {
  const canvas = requireElement<HTMLCanvasElement>('#game-canvas');
  const overlay = requireElement<HTMLElement>('#ui-root');
  const { runStressScene, stressOptionsFromLocation } = await import('./stress/stressScene');
  return runStressScene(canvas, overlay, stressOptionsFromLocation());
}

async function start(): Promise<() => void> {
  document.title = t('app.title');

  // Logged before anything can fail. The debug overlay shows this too, but the
  // overlay needs a booted game; a phone that renders nothing still has an
  // in-page console, and this is the line that says which build broke.
  console.info(`adventure build ${buildLabel()}`);

  // Content is data; game-core validates it. A malformed region fails loudly
  // here rather than producing a subtly wrong world.
  const region = parseRegion(regions[TEST_ARENA_ID]);

  const canvas = requireElement<HTMLCanvasElement>('#game-canvas');
  const uiRoot = requireElement<HTMLElement>('#ui-root');
  const joystickLayer = requireElement<HTMLElement>('#joystick-layer');

  // A mistap must never zoom the page: on a fixed layout there is nothing to
  // pinch back out with, and the only escape is rotating the phone twice.
  const restoreZoom = preventBrowserZoom(requireElement<HTMLElement>('#app'));

  const { engine, dispose: disposeEngine } = createEngine(canvas);
  const scene = createScene(engine, region);

  const assist = resolveAssist();

  const spawnAt = spawnPoint(region, 'player-spawn') ?? tileCentreToWorld(region, 0, 0);

  // Boot waits for the models. They are ~110 kB each and served from the same
  // origin, so this is a blink; a loading screen would be more machinery than
  // the wait deserves, and Stage 0A has nothing else to show during it.
  // A region either names an authored model or is dressed from its own data.
  // Both paths end with the same thing — somewhere to stand and a list of
  // places that should be on fire.
  const [heroModel, foeModel, scenery] = await Promise.all([
    loadCharacter(scene, HERO_MODEL, {
      heightMetres: PLAYER_HEIGHT_METRES,
      forwardOffsetRadians: HERO_FORWARD_RADIANS,
    }),
    loadCharacter(scene, FOE_MODEL, {
      heightMetres: ENEMY_HEIGHT_METRES,
      forwardOffsetRadians: FOE_FORWARD_RADIANS,
    }),
    region.sceneModel === undefined
      ? createProps(scene, region)
      : createArenaScene(scene, region.sceneModel, {
          x: (region.width * TILE_METRES) / 2,
          z: (region.height * TILE_METRES) / 2,
        }),
  ]);

  const lighting =
    region.sceneModel === undefined
      ? null
      : createArenaLighting(scene, {
          x: (region.width * TILE_METRES) / 2,
          z: (region.height * TILE_METRES) / 2,
        });

  // The braziers and torches came out of glTF without their fire; sprites have
  // no equivalent in the format and were dropped on export. The authored arena
  // leaves named empty nodes where each one belongs, so the positions come out
  // of the model rather than out of this file.
  const flames = createFlames(
    scene,
    scenery.firePoints,
    'glowPoints' in scenery ? scenery.glowPoints : [],
  );

  const player = createPlayer(scene, region, spawnAt, assist, heroModel);

  // One enemy, at the region's enemy spawn. Falls back near the player so the
  // toy is never empty if a region forgets to place one.
  const enemySpawn = findSpawn(region, 'enemy-spawn') ?? { x: spawnAt.x + 4, z: spawnAt.z };
  const enemy = createEnemyActor(scene, region, enemySpawn, foeModel);

  const input = createInput(canvas, joystickLayer, requestedJoystickOrigin());
  const camera = createGameCamera(scene, engine, player.followTarget);

  // The meter draws the bands assist actually produces, so an assisted player
  // simply sees a bigger target rather than being told anything.
  const chargeMeter = createChargeMeter(joystickLayer, timingBands(assist));

  // Feel: the difference between a correct combat loop and one worth replaying.
  // Declared before the diagnostics that read it, and before the UI mounts.
  // As a `const` further down it was in its temporal dead zone when the first
  // render called `live()`, which threw `Cannot access 'D' before
  // initialization` in the production build and showed a blank screen.
  //
  // Capped rather than free-running: sixty frames of a fixed-camera scene with
  // six-box characters buys little on a phone and costs battery and heat.
  // `?fps=60` restores the uncapped behaviour for a side-by-side.
  const frames = applyFrameCap(engine, frameCapFromLocation());
  const diagnostics = createDiagnostics(engine, frames);
  const audio = createAudio();
  const hitStop = createHitStop();
  const impacts = createImpactBurst(scene);
  // Only heavy swings draw a ring, which is what makes one mean something.
  const rings = createImpactRing(scene);
  const bands = timingBands(assist);

  let chargingLastFrame = false;
  let enemyWasAlive = true;

  const updateObserver = scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    // Hit stop eats a few frames' worth of simulation time on impact. It is
    // client-side juice only — see hitStop.ts on why it must stay brief.
    const deltaSeconds = hitStop.advance(engine.getDeltaTime() / 1000);

    // Outside the hit stop: the shockwave should keep expanding through the
    // freeze, or the freeze looks like a dropped frame instead of an impact.
    rings.advance(engine.getDeltaTime() / 1000);

    // Edge detection happens once per frame, before anything reads input.
    input.update(now);
    const reading = input.read();

    // A controller press is not a user gesture in any browser, so a
    // controller-only player would otherwise never unlock audio at all.
    if (reading.source === 'gamepad') {
      audio.tryUnlock();
    }

    const frame = player.update(deltaSeconds, {
      direction: reading.direction,
      dodgeRequested: input.consumeDodge(now),
      attackHeld: reading.attackHeld,
      interrupted: input.consumeInterrupt(),
    });

    if (frame.dodgeStarted) {
      audio.dodge();
    }

    const playerAt = player.position();
    const { strikeLanded } = enemy.update(deltaSeconds, playerAt);

    // Resolve the fight, both directions.
    //
    // The player's swing lands if the enemy is in reach and in front — missing by
    // facing the wrong way is allowed, and is what makes aiming matter.
    if (frame.swing !== null) {
      const target = enemy.state();
      const connected =
        target.phase !== 'dead' &&
        isWithinMeleeArc(
          playerAt,
          player.facing(),
          target.position,
          HAMMER.reachMetres,
          HAMMER.swingHalfAngleRadians,
        );

      if (connected) {
        enemy.damage(HAMMER.baseDamage * frame.swing.power);
      }

      // A swing always makes a noise; only a landed one shakes the world.
      audio.swing(swingSound(frame.swing));

      if (connected) {
        // The grades were already differentiated, and the playtester still
        // could not tell them apart — every channel differed only by degree.
        // The spread is wider now, and the ring below differs in kind: a tap
        // draws none at all.
        const heavy = frame.swing.kind === 'heavy';
        const weight = heavy
          ? frame.swing.grade === 'perfect'
            ? 1
            : frame.swing.grade === 'great'
              ? 0.65
              : 0.4
          : frame.swing.comboCount >= HAMMER.comboLength
            ? 0.35
            : 0.18;

        hitStop.freeze(0.02 + weight * 0.11);
        camera.shake(0.04 + weight * 0.2);
        impacts.burst(target.position.x, enemy.impactHeight(), target.position.z, weight);
        rings.strike(
          target.position.x,
          elevationAtWorld(region, target.position.x, target.position.z),
          target.position.z,
          frame.swing,
        );
      }
    }

    // The enemy's swing already resolved range and arc; the player decides
    // whether it counts, because only the player knows about dodge
    // invulnerability and mercy frames. This is where dodging finally pays off.
    if (strikeLanded && player.takeDamage(ENEMY.damage)) {
      // Only a hit that actually landed gets feedback — a dodged swing must
      // feel like nothing happened, because nothing did.
      audio.playerHurt();
      hitStop.freeze(0.06);
      // Softened from 0.22: the screen-edge flash and the stagger now carry the
      // message, and shake large enough to notice is also large enough to
      // disturb steering with the other thumb.
      camera.shake(0.14);
      impacts.burst(playerAt.x, player.impactHeight(), playerAt.z, 0.5);
    }

    // Death is the one moment worth over-selling.
    const enemyNow = enemy.state();
    const enemyAlive = enemyNow.phase !== 'dead';
    if (enemyWasAlive && !enemyAlive) {
      audio.enemyDeath();
      hitStop.freeze(0.12);
      camera.shake(0.3);
      impacts.burst(enemyNow.position.x, enemy.impactHeight(), enemyNow.position.z, 1);
    }
    enemyWasAlive = enemyAlive;

    const snapshot = player.snapshot();
    // Only a real charge shows the meter; a tap is too brief to flash it.
    chargeMeter.update(snapshot.chargeProgress, snapshot.charging);

    // The charge tone rises with the meter and chimes at the sweet spot, so the
    // timing can be heard while the child is watching the enemy, not the HUD.
    if (snapshot.charging && !chargingLastFrame) {
      audio.chargeStart();
    } else if (!snapshot.charging && chargingLastFrame) {
      audio.chargeStop();
    }
    if (snapshot.charging) {
      const held = snapshot.attack.elapsedSeconds;
      audio.chargeUpdate(
        snapshot.chargeProgress,
        held >= bands.perfect.startSeconds && held <= bands.perfect.endSeconds,
      );
    }
    chargingLastFrame = snapshot.charging;
  });

  if (new URLSearchParams(window.location.search).has('debug')) {
    // A handle on the scene, behind the same flag as the readout.
    //
    // Not a leftover: this project cannot reliably see its own output — the
    // automation pane stops compositing, and the target device cannot be
    // inspected from a Windows machine at all. Twice now, "why is this not
    // drawing" has been answerable in one query and unanswerable by looking.
    (window as unknown as { __scene?: unknown }).__scene = scene;
  }

  const unmountUi = mountUi(uiRoot, {
    region,
    player,
    enemy,
    input,
    diagnostics,
    audio,
    assist,
  });

  // The engine enforces the cap itself, before it samples the clock. Skipping
  // renders from in here is what made the game run in slow motion — see
  // frameCap.ts.
  engine.runRenderLoop(() => {
    frames.recordFrame(performance.now());
    scene.render();
  });

  return () => {
    engine.stopRenderLoop();
    scene.onBeforeRenderObservable.remove(updateObserver);
    unmountUi();
    camera.dispose();
    audio.dispose();
    impacts.dispose();
    rings.dispose();
    flames.dispose();
    scenery.dispose();
    lighting?.dispose();
    enemy.dispose();
    chargeMeter.dispose();
    input.dispose();
    restoreZoom();
    player.dispose();
    scene.dispose();
    disposeEngine();
  };
}

/**
 * Puts a boot failure on the screen.
 *
 * Written in plain DOM on purpose: if `start()` threw, the Preact overlay never
 * mounted, so the HUD, the rotate notice and the corner that opens the in-page
 * console are all absent — and what a person sees is an empty grey rectangle
 * that looks identical whether the game crashed, the network failed, or the
 * phone is simply slow. That happened, and it cost two rounds of guessing at
 * the wrong cause.
 *
 * Deliberately ugly and unlocalised. It is not part of the game; nobody should
 * ever see it, and if they do the message matters more than the manners.
 */
function showStartupFailure(error: unknown): void {
  const panel = document.createElement('div');
  panel.setAttribute('role', 'alert');
  panel.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:9999',
    'padding:16px',
    'overflow:auto',
    'background:#140d0d',
    'color:#ffd9d9',
    'font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    '-webkit-user-select:text',
    'user-select:text',
  ].join(';');

  const detail =
    error instanceof Error
      ? `${error.message}

${error.stack ?? ''}`
      : String(error);
  panel.textContent = `Mäng ei käivitunud.

build ${buildLabel()}

${detail}`;
  document.body.appendChild(panel);
}

/**
 * Boot, and keep hold of the teardown for hot reloads.
 *
 * A promise now, because the characters have to load first. The failure path
 * matters more than it looks: a model that 404s would otherwise leave a black
 * screen and an unhandled rejection, which on a phone is indistinguishable from
 * the game simply not working. Logged loudly so the in-page console has
 * something to say.
 */
let teardown: (() => void) | null = null;

const measuring = new URLSearchParams(window.location.search).has('stress');

void (measuring ? startStress() : start())
  .then((dispose) => {
    teardown = dispose;
  })
  .catch((error: unknown) => {
    console.error('adventure failed to start', error);
    showStartupFailure(error);
  });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown?.();
  });
}
