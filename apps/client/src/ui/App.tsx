import type { EnemyState, Region } from '@adventure/game-core';
import { useEffect, useState } from 'preact/hooks';

import { createTapSequence } from '../debug/tapSequence';
import { toggleInPageConsole } from '../debug/inPageConsole';
import type { Diagnostics, LiveDiagnostics } from '../game/diagnostics';
import type { Enemy } from '../game/enemy';
import type { Player, PlayerSnapshot } from '../game/player';
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

export interface AppProps {
  readonly region: Region;
  readonly player: Player;
  readonly enemy: Enemy;
  readonly input: GameInput;
  readonly diagnostics: Diagnostics;
  readonly assist: boolean;
}

/**
 * The HTML overlay above the Babylon canvas.
 *
 * What a child sees is only the game: health, the joystick, the two action
 * buttons and the charge meter. Everything diagnostic hides behind the corner
 * tap.
 */
export function App({ region, player, enemy, input, diagnostics, assist }: AppProps) {
  const isPortrait = usePortrait();
  const [debugVisible, toggleDebug] = useDebugVisible();
  const { snapshot, reading, enemyState, live } = useReadout(
    player,
    enemy,
    input,
    diagnostics,
    debugVisible,
  );

  const [taps] = useState(() => createTapSequence(DEBUG_TAPS));

  return (
    <div class="ui-layer">
      {/*
        The secret handle. A real element rather than a canvas gesture, so its
        taps are swallowed here and never reach the joystick underneath.
      */}
      <div
        class="ui-debug-handle"
        onPointerDown={() => {
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

      <Hearts current={snapshot.health.current} max={snapshot.health.max} />

      {debugVisible ? (
        <DebugPanel
          region={region}
          snapshot={snapshot}
          reading={reading}
          enemyState={enemyState}
          diagnostics={diagnostics}
          live={live}
          assist={assist}
          onToggleConsole={() => {
            void toggleInPageConsole();
          }}
        />
      ) : null}

      {isPortrait ? (
        <div class="ui-orientation-notice">{t('orientation.rotateToLandscape')}</div>
      ) : null}
    </div>
  );
}
