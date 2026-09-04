import type { EnemyState, Region } from '@adventure/game-core';
import { useEffect, useRef, useState } from 'preact/hooks';

import { rememberAssist } from '../config/assist';
import { createTapSequence } from '../debug/tapSequence';
import { toggleInPageConsole } from '../debug/inPageConsole';
import type { GameAudio } from '../audio/audio';
import type { Diagnostics, LiveDiagnostics } from '../game/diagnostics';
import type { Enemy } from '../game/enemy';
import type { Player, PlayerSnapshot, PlayerVitals } from '../game/player';
import type { GameInput, InputReading } from '../input/createInput';
import { tryCapturePointer, tryReleasePointer } from '../input/pointerCapture';
import { t } from '../i18n';
import { DebugPanel } from './DebugPanel';

const PORTRAIT_QUERY = '(orientation: portrait)';

/** How often the development readout refreshes, in milliseconds. */
const READOUT_INTERVAL_MS = 200;

/** Taps in the corner needed to reveal the debug tools. */
const DEBUG_TAPS = 4;

/**
 * Tracks portrait orientation.
 *
 * Deliberately listens to three signals rather than one: the media query's own
 * `change` event is the obvious source, but it does not fire reliably in every
 * browser and emulation context (verified during 0A.1), and mobile Safari has
 * a long history of quirks around rotation. `resize` and `orientationchange`
 * are cheap, and re-reading `matches` is idempotent — so extra events cost
 * nothing while a missed event leaves a wrong full-screen notice on the child's
 * screen.
 */
function usePortrait(): boolean {
  const [isPortrait, setIsPortrait] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(PORTRAIT_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(PORTRAIT_QUERY);
    const update = (): void => {
      setIsPortrait(window.matchMedia(PORTRAIT_QUERY).matches);
    };

    query.addEventListener('change', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    update();

    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return isPortrait;
}

/**
 * The browser's own page zoom, as a multiplier.
 *
 * On screen because three separate attempts to *prevent* accidental zoom have
 * now failed on a real iPhone, and every one of them was a guess: the number
 * that would have settled it has been available in the debug readout since
 * 0A.1 and was never read during a session that went wrong, because reaching
 * the debug readout means getting past the broken zoom first.
 *
 * So the game reports it itself, unprompted. A page at 1.00x says nothing; a
 * page that is zoomed says so, with the figure, which turns "the zoom is
 * broken" into a bug report that can be acted on.
 *
 * `visualViewport` is the only honest source — `devicePixelRatio` moves with
 * zoom on some browsers and not others, and `innerWidth` moves for several
 * unrelated reasons.
 */
function usePageZoom(): number {
  const [scale, setScale] = useState<number>(() => window.visualViewport?.scale ?? 1);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport === null || viewport === undefined) {
      return undefined;
    }

    const update = (): void => {
      setScale(viewport.scale);
    };

    // `resize` is the one that fires on a pinch; `scroll` catches the pan that
    // usually follows, where the scale can settle at a different value.
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    update();

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return scale;
}

/** Below this the page is not meaningfully zoomed and nothing is said. */
const ZOOM_NOTICE_THRESHOLD = 1.02;

/**
 * Whether the debug tools are showing.
 *
 * Off unless asked for: a child must see the game, not a wall of numbers.
 * `?debug=1` opens it directly, and a keyboard shortcut helps on a laptop — but
 * the tap sequence in the corner is the one that matters, because the phone
 * where things go wrong has neither a URL bar worth typing in nor a keyboard.
 */
function useDebugVisible(): [boolean, () => void] {
  const [visible, setVisible] = useState<boolean>(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === 'F8' || event.code === 'Backquote') {
        event.preventDefault();
        setVisible((was) => !was);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return [visible, () => setVisible((was) => !was)];
}

/**
 * Polls the development readout a few times a second.
 *
 * The player moves every frame, so subscribing to it would re-render the
 * overlay at 60 fps for numbers a human cannot read that fast. Five updates a
 * second is plenty to debug with — and while the panel is hidden it does not
 * poll at all.
 */
function useReadout(
  player: Player,
  enemy: Enemy,
  input: GameInput,
  diagnostics: Diagnostics,
  active: boolean,
): {
  snapshot: PlayerSnapshot;
  reading: InputReading;
  enemyState: EnemyState;
  live: LiveDiagnostics;
} {
  const [state, setState] = useState(() => ({
    snapshot: player.snapshot(),
    reading: input.read(),
    enemyState: enemy.state(),
    live: diagnostics.live(),
  }));

  useEffect(() => {
    if (!active) {
      return;
    }

    const handle = window.setInterval(() => {
      setState({
        snapshot: player.snapshot(),
        reading: input.read(),
        enemyState: enemy.state(),
        live: diagnostics.live(),
      });
    }, READOUT_INTERVAL_MS);

    return () => {
      window.clearInterval(handle);
    };
  }, [player, enemy, input, diagnostics, active]);

  return state;
}

/** How often the always-on HUD reads the player's health, in milliseconds. */
const VITALS_INTERVAL_MS = 100;

/**
 * The player's health, polled whether or not the debug overlay is open.
 *
 * This used to come from the development readout's poll, which only ran while
 * that overlay was visible — so in ordinary play the health pips never changed
 * at all. The adult playtest reported "could not tell I was losing health", and
 * that was not a presentation problem: the number on screen was frozen.
 */
function useVitals(player: Player): PlayerVitals {
  const [vitals, setVitals] = useState<PlayerVitals>(() => player.vitals());

  useEffect(() => {
    const handle = window.setInterval(() => {
      setVitals(player.vitals());
    }, VITALS_INTERVAL_MS);
    return () => {
      window.clearInterval(handle);
    };
  }, [player]);

  return vitals;
}

/**
 * Health as pips rather than a number.
 *
 * Countable at a glance and language-free — the five-year-olds cannot read yet
 * (PLAN §11), so the one thing that must never be text is how alive you are.
 */
function Hearts({ current, max }: { current: number; max: number }) {
  const pips = [];
  for (let i = 0; i < max; i += 1) {
    pips.push(<div class={`ui-heart${i < current ? '' : ' ui-heart--empty'}`} />);
  }
  return <div class="ui-hearts">{pips}</div>;
}

/**
 * The red flash at the screen edges when a hit lands.
 *
 * Retriggered by removing and re-adding the class, because a CSS animation only
 * restarts when the element actually changes — two hits in quick succession
 * would otherwise show one flash.
 */
function HurtFlash({ health }: { health: number }) {
  const element = useRef<HTMLDivElement>(null);
  const previous = useRef(health);

  useEffect(() => {
    if (health < previous.current && element.current !== null) {
      const node = element.current;
      node.classList.remove('ui-hurt--flash');
      // Reading a layout property is what forces the removal to take effect
      // before the class goes back on.
      void node.offsetWidth;
      node.classList.add('ui-hurt--flash');
    }
    previous.current = health;
  }, [health]);

  return <div class="ui-hurt" ref={element} />;
}

/**
 * Portrait: rotate the device.
 *
 * A diagram rather than a sentence, because most of the players cannot read.
 * Drawn inline — three rounded rectangles and an arrow are not worth a
 * dependency, and this must render before anything else has loaded.
 */
function RotateIcon() {
  return (
    <svg class="ui-orientation-notice__icon" viewBox="0 0 240 110" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round">
        <rect x="14" y="10" width="56" height="90" rx="8" />
        <rect x="150" y="27" width="90" height="56" rx="8" transform="translate(-8 0)" />
      </g>
      <circle cx="42" cy="90" r="3.5" fill="currentColor" />
      <circle cx="196" cy="55" r="3.5" fill="currentColor" />
      <path
        d="M92 42 a34 34 0 0 1 52 0"
        fill="none"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
      />
      <path d="M144 42 l-13 -4 l3 13 z" fill="currentColor" />
    </svg>
  );
}

export interface AppProps {
  readonly region: Region;
  readonly player: Player;
  readonly enemy: Enemy;
  readonly input: GameInput;
  readonly diagnostics: Diagnostics;
  readonly audio: GameAudio;
  readonly assist: boolean;
}

/**
 * The HTML overlay above the Babylon canvas.
 *
 * What a child sees is only the game: health, the joystick, the two action
 * buttons and the charge meter. Everything diagnostic hides behind the corner
 * tap.
 */
export function App({ region, player, enemy, input, diagnostics, audio, assist }: AppProps) {
  const isPortrait = usePortrait();
  const pageZoom = usePageZoom();
  const [debugVisible, toggleDebug] = useDebugVisible();
  const vitals = useVitals(player);
  const { snapshot, reading, enemyState, live } = useReadout(
    player,
    enemy,
    input,
    diagnostics,
    debugVisible,
  );

  const [taps] = useState(() => createTapSequence(DEBUG_TAPS));
  const debugHandle = useRef<HTMLDivElement>(null);

  return (
    <div class="ui-layer">
      {/*
        The secret handle. A real element rather than a canvas gesture, so its
        taps are swallowed here and never reach the joystick underneath.
      */}
      <div
        class="ui-debug-handle"
        ref={debugHandle}
        onPointerDown={() => {
          // Acknowledge the tap before anything else, so a missed target and a
          // dead handler stop looking identical.
          const node = debugHandle.current;
          if (node !== null) {
            node.classList.remove('ui-debug-handle--hit');
            void node.offsetWidth;
            node.classList.add('ui-debug-handle--hit');
          }
          if (taps.tap(performance.now())) {
            toggleDebug();
          }
        }}
      />

      {/*
        Right-thumb actions. Large, visible targets rather than gestures: a
        child has to be able to find them without being told, and the right-hand
        side is reserved for actions (ADR 0006).
      */}
      <button
        type="button"
        class="ui-action ui-action--attack"
        onPointerDown={(event) => {
          // State first, capture second: capture can throw, and it must never
          // abort the press itself (see pointerCapture.ts).
          input.setTouchAttack(true);
          tryCapturePointer(event.currentTarget, event.pointerId);
        }}
        onPointerUp={(event) => {
          input.setTouchAttack(false);
          tryReleasePointer(event.currentTarget, event.pointerId);
        }}
        onPointerCancel={(event) => {
          // Without this the hammer would stay charging forever when the
          // browser takes the pointer away.
          input.setTouchAttack(false);
          tryReleasePointer(event.currentTarget, event.pointerId);
        }}
        onLostPointerCapture={() => {
          input.setTouchAttack(false);
        }}
      >
        {t('action.attack')}
      </button>

      <button
        type="button"
        class="ui-action ui-action--dodge"
        onPointerDown={() => {
          input.pressDodge(performance.now());
        }}
      >
        {t('action.dodge')}
      </button>

      <Hearts current={vitals.health.current} max={vitals.health.max} />
      <HurtFlash health={vitals.health.current} />

      {debugVisible ? (
        <DebugPanel
          region={region}
          snapshot={snapshot}
          reading={reading}
          enemyState={enemyState}
          diagnostics={diagnostics}
          live={live}
          audio={audio}
          assist={assist}
          onToggleConsole={() => {
            void toggleInPageConsole();
          }}
          onToggleAssist={() => {
            // Assist is baked into the player, the hammer and the meter when
            // they are built, so flipping it means starting again. A reload is
            // honest and instant; rebuilding half the scene live would be a lot
            // of machinery for a setting changed twice per playtest.
            rememberAssist(!assist);
            const url = new URL(window.location.href);
            // A URL parameter outranks the remembered choice, so it has to go
            // or the button would appear to do nothing.
            url.searchParams.delete('assist');
            window.location.replace(url.toString());
          }}
        />
      ) : null}

      {isPortrait ? (
        <div class="ui-orientation-notice">
          <RotateIcon />
          <div>{t('orientation.rotateToLandscape')}</div>
        </div>
      ) : null}

      {pageZoom > ZOOM_NOTICE_THRESHOLD ? (
        <div class="ui-zoom-notice">
          <strong>
            {t('zoom.pageZoomed')} {pageZoom.toFixed(2)}×
          </strong>
          <div>{t('zoom.pinchToReset')}</div>
        </div>
      ) : null}
    </div>
  );
}
