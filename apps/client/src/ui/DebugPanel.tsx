import type { EnemyState, Region } from '@adventure/game-core';

import type { GameAudio } from '../audio/audio';
import { buildLabel } from '../config/buildInfo';
import { GAME_CAMERA } from '../game/camera';
import type { Diagnostics, LiveDiagnostics } from '../game/diagnostics';
import type { PlayerSnapshot } from '../game/player';
import type { InputReading } from '../input/createInput';
import { t, tContent } from '../i18n';
import type { TranslationKey } from '../i18n';

function metres(value: number): string {
  return `${value.toFixed(2)} m`;
}

function Row({ labelKey, value }: { labelKey: TranslationKey; value: string }) {
  return (
    <div class="ui-readout__row">
      <span class="ui-readout__label">{t(labelKey)}</span>
      <span class="ui-readout__value">{value}</span>
    </div>
  );
}

export interface DebugPanelProps {
  readonly region: Region;
  readonly snapshot: PlayerSnapshot;
  readonly reading: InputReading;
  readonly enemyState: EnemyState;
  readonly diagnostics: Diagnostics;
  readonly live: LiveDiagnostics;
  readonly audio: GameAudio;
  readonly assist: boolean;
  readonly onToggleConsole: () => void;
  readonly onToggleAssist: () => void;
}

/**
 * The development readout.
 *
 * Hidden by default, and that is the point: a child must see the *game*, not a
 * wall of numbers. It is reached by a secret tap sequence in the corner or with
 * `?debug=1`, so it can be opened on a phone that has no keyboard and no
 * developer tools.
 */
export function DebugPanel({
  region,
  snapshot,
  reading,
  enemyState,
  diagnostics,
  live,
  audio,
  assist,
  onToggleConsole,
  onToggleAssist,
}: DebugPanelProps) {
  const { device } = diagnostics;
  const sound = audio.diagnostics();

  return (
    <div class="ui-readout">
      <div class="ui-readout__title">{t('dev.stageLabel')}</div>

      {/*
        First line on purpose. When a bug report is "it doesn't work", the very
        first question is which build that phone is running — Safari is perfectly
        capable of serving a week-old bundle from cache.
      */}
      <Row labelKey="debug.build" value={buildLabel()} />
      <Row
        labelKey="debug.fps"
        value={`${live.fps}${live.targetFps > 0 ? ` / ${live.targetFps}` : ' / vaba'} (${live.frameMs.toFixed(1)} ms)`}
      />
      <Row labelKey="debug.viewport" value={`${live.viewport} → ${live.buffer}`} />
      <Row
        labelKey="debug.camera"
        value={`${GAME_CAMERA.tiltDegrees}° · ${GAME_CAMERA.verticalExtentMetres} m`}
      />
      <Row labelKey="debug.region" value={tContent(region.nameKey)} />
      <Row labelKey="debug.grid" value={`${region.width} × ${region.height}`} />
      <Row
        labelKey="debug.position"
        value={`${metres(snapshot.world.x)}, ${metres(snapshot.world.z)}`}
      />
      <Row labelKey="debug.tile" value={`${snapshot.tile.col}, ${snapshot.tile.row}`} />
      <Row labelKey="debug.elevation" value={metres(snapshot.elevation)} />
      <Row labelKey="debug.walkable" value={snapshot.walkable ? t('debug.yes') : t('debug.no')} />
      <Row labelKey="debug.input" value={reading.source} />
      <Row
        labelKey="debug.gamepad"
        value={reading.gamepadConnected ? t('debug.yes') : t('debug.no')}
      />
      <Row
        labelKey="debug.dodge"
        value={snapshot.invulnerable ? `${snapshot.dodge.phase} *` : snapshot.dodge.phase}
      />
      <Row
        labelKey="debug.charge"
        value={`${snapshot.attack.phase} ${(snapshot.chargeProgress * 100).toFixed(0)}%`}
      />
      <Row
        labelKey="debug.grade"
        value={
          snapshot.lastSwing === null
            ? '—'
            : snapshot.lastSwing.kind === 'heavy'
              ? `heavy ${snapshot.lastSwing.grade}`
              : `light ${snapshot.lastSwing.comboCount}`
        }
      />
      <Row labelKey="debug.combo" value={`${snapshot.attack.comboCount}`} />
      <Row
        labelKey="debug.health"
        value={`${snapshot.health.current}/${snapshot.health.max}${snapshot.protected ? ' *' : ''}`}
      />
      <Row
        labelKey="debug.enemy"
        value={`${enemyState.phase} ${Math.max(0, Math.round(enemyState.health.current))}`}
      />
      <Row labelKey="debug.assist" value={assist ? t('debug.yes') : t('debug.no')} />
      {/*
        Audio needs four facts, not one. "No sound on the iPhone" has completely
        different causes depending on whether a context exists, whether it is
        running, what unlocked it, and whether the iOS audio session could be
        moved off `ambient` — and only the last of those explains a context that
        says `running` while the ring/silent switch keeps the phone quiet.
      */}
      <Row
        labelKey="debug.audio"
        value={`${sound.contextState} · ${sound.unlocked ? t('debug.yes') : t('debug.no')} · ${sound.via} · ${sound.sessionType}`}
      />

      <div class="ui-readout__device">
        <div>{device.engine}</div>
        <div>{device.renderer}</div>
        <div>dpr {device.devicePixelRatio}×</div>
        <div class="ui-readout__probe">{device.platform}</div>
      </div>

      {/*
        The only way to change assist on the phone. The home-screen install has
        no URL bar, so `?assist=1` is unreachable there — and that install is
        how the children actually open the game. Behind the hidden gesture, so
        no child is ever told which setting they are on.
      */}
      <button type="button" class="ui-readout__button" onClick={onToggleAssist}>
        {`${t('debug.assistToggle')} → ${assist ? t('debug.no') : t('debug.yes')}`}
      </button>

      <button type="button" class="ui-readout__button" onClick={onToggleConsole}>
        {t('debug.console')}
      </button>

      <div class="ui-readout__probe">{t('dev.charsetProbe')}</div>
    </div>
  );
}
