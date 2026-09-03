/**
 * Procedural sound.
 *
 * Every sound here is synthesised with WebAudio rather than loaded from a file.
 * That is a deliberate choice for this stage, not a shortcut: no asset exists to
 * license or attribute yet (`assets/ATTRIBUTION.md` is still empty), nothing has
 * to download before the first hit lands, and a proving toy needs *timing*
 * feedback far more than it needs good samples. Real SFX replace these with the
 * art pass.
 *
 * Four mobile rules shape the implementation (PLAN §27, §6). The first is the
 * one that made the published build silent on a real iPhone:
 *
 *  - **iOS routes WebAudio through the "ambient" audio session by default, and
 *    the ring/silent switch mutes it.** The context reports `running`, every
 *    node plays, and nothing is heard — no error anywhere. Safari 16.4+ exposes
 *    `navigator.audioSession`; setting it to `playback` opts into the category
 *    that ignores the switch. This is the single most likely cause of "no audio
 *    on the iPhone" and it is invisible from any log.
 *  - the AudioContext may only be created and resumed **inside a user gesture**,
 *    or iOS leaves it suspended forever — and note that a *gamepad* button is
 *    not a gesture in any browser, so a controller-only player needs coaxing
 *    (`tryUnlock`) or they get a silent game with no error to explain it;
 *  - older iOS additionally wants a buffer actually *played* inside that
 *    gesture before it believes the context is in use, so the unlock plays a
 *    silent one-sample source;
 *  - it must be resumed again whenever the page comes back, because a phone
 *    locking mid-session is the normal case, not an edge case.
 *
 * Audio is reinforcement only. PLAN §11 forbids it being the sole channel for
 * anything precise, because mobile audio latency is too variable to trust.
 */

export type SwingSound = 'light' | 'lightFinisher' | 'heavyGood' | 'heavyGreat' | 'heavyPerfect';

/**
 * What the hidden debug overlay shows about audio.
 *
 * Exists because the iPhone failure mode is silent in every sense: no error, no
 * console entry, a context that claims to be running. Without a readout on the
 * device there is no way to tell "the context never started" from "the context
 * is fine and the mute switch is on" — which need completely different fixes.
 */
export interface AudioDiagnostics {
  /** `none` before anything has been created. */
  readonly contextState: AudioContextState | 'none';
  /** True once a context exists and is running. */
  readonly unlocked: boolean;
  /** Which event actually unlocked it, or `-` if nothing has yet. */
  readonly via: string;
  /** Whether the iOS audio-session category could be set away from `ambient`. */
  readonly sessionType: string;
}

export interface GameAudio {
  /** True once the browser has actually let us make noise. */
  readonly isReady: () => boolean;
  readonly diagnostics: () => AudioDiagnostics;
  /**
   * Nudges a suspended context awake. Safe and cheap to call every frame: it
   * throttles itself and does nothing once audio is running.
   *
   * Exists for controller players, whose button presses never count as user
   * activation and so never trigger the listeners below.
   */
  readonly tryUnlock: () => void;
  readonly swing: (sound: SwingSound) => void;
  readonly playerHurt: () => void;
  readonly dodge: () => void;
  readonly enemyDeath: () => void;
  /** Starts the rising charge tone. */
  readonly chargeStart: () => void;
  /** Tracks the charge; chimes once when the sweet spot is entered. */
  readonly chargeUpdate: (progress: number, inSweetSpot: boolean) => void;
  readonly chargeStop: () => void;
  readonly dispose: () => void;
}

interface Voices {
  readonly context: AudioContext;
  readonly master: GainNode;
  readonly noise: AudioBuffer;
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.4);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Opts iOS out of the "ambient" audio session, whose defining property is that
 * the hardware ring/silent switch mutes it.
 *
 * Safari 16.4+ only, and absent everywhere else, so every failure here is
 * expected and ignored — the game simply keeps whatever category it had.
 * Returns what the category ended up as, for the debug overlay.
 */
function claimPlaybackSession(): string {
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session === undefined) {
    return 'unsupported';
  }
  try {
    session.type = 'playback';
    return session.type;
  } catch {
    return 'refused';
  }
}

/** Events that count as a user gesture, in the order they tend to arrive. */
const GESTURES = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown'] as const;

export function createAudio(): GameAudio {
  let voices: Voices | null = null;
  let chargeOscillator: OscillatorNode | null = null;
  let chargeGain: GainNode | null = null;
  let sweetSpotChimed = false;
  let unlockedVia = '-';
  let sessionType = 'not attempted';

  const start = (): void => {
    if (voices !== null) {
      return;
    }

    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) {
      return; // No WebAudio: the game is still perfectly playable in silence.
    }

    try {
      // Before the context exists, so the category applies to it from birth.
      sessionType = claimPlaybackSession();

      const context = new Ctor();
      const master = context.createGain();
      // Comfortably below full scale: this is a game children hold to their face.
      master.gain.value = 0.25;
      master.connect(context.destination);
      voices = { context, master, noise: createNoiseBuffer(context) };
    } catch {
      voices = null;
    }
  };

  /**
   * Plays one silent sample.
   *
   * Older iOS will not treat a context as genuinely unlocked until something
   * has been *played* inside the gesture, regardless of what `state` says.
   * Silent, so it costs nothing where it is unnecessary.
   */
  const primeSilently = (): void => {
    if (voices === null) {
      return;
    }
    try {
      const { context } = voices;
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      source.connect(context.destination);
      source.start(0);
    } catch {
      // A browser that refuses this is one where it was not needed.
    }
  };

  const resume = (): void => {
    start();
    if (voices !== null && voices.context.state !== 'running') {
      void voices.context.resume();
    }
  };

  /**
   * Unlocks from inside a real user gesture.
   *
   * Registered in the **capture** phase on `window`: the action buttons and the
   * joystick sit above the canvas and any one of them could stop propagation,
   * and an unlock that depends on which element was touched is an unlock that
   * eventually fails on the one device nobody can debug.
   */
  const unlock = (event: Event): void => {
    const first = voices === null;
    resume();
    primeSilently();
    if (first || unlockedVia === '-') {
      unlockedVia = event.type;
    }
  };

  for (const type of GESTURES) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }

  // A controller being plugged in is at least a hint that someone is there.
  const onGamepadConnected = (): void => {
    resume();
  };
  window.addEventListener('gamepadconnected', onGamepadConnected);

  // Coming back from a locked phone leaves the context suspended (PLAN §6).
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      resume();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  // A bfcache restore — the back button, or switching apps on iOS — can hand
  // back a suspended context without ever firing `visibilitychange`.
  const onPageShow = (): void => {
    resume();
  };
  window.addEventListener('pageshow', onPageShow);

  /** A shaped tone. `sweepTo` bends the pitch, which is most of the character. */
  const tone = (
    frequency: number,
    seconds: number,
    {
      type = 'sine' as OscillatorType,
      gain = 1,
      sweepTo,
      delay = 0,
    }: { type?: OscillatorType; gain?: number; sweepTo?: number; delay?: number } = {},
  ): void => {
    if (voices === null) {
      return;
    }
    const { context, master } = voices;
    const at = context.currentTime + delay;

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (sweepTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), at + seconds);
    }

    // A quick attack and an exponential tail: percussive without clicking.
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds);

    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(at);
    oscillator.stop(at + seconds + 0.02);
  };

  /** Filtered noise — the body of an impact. */
  const thump = (seconds: number, cutoffHz: number, gain: number): void => {
    if (voices === null) {
      return;
    }
    const { context, master, noise } = voices;
    const at = context.currentTime;

    const source = context.createBufferSource();
    source.buffer = noise;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, at);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(at);
    source.stop(at + seconds + 0.02);
  };

  let lastUnlockAttemptMs = Number.NEGATIVE_INFINITY;

  return {
    isReady: () => voices !== null && voices.context.state === 'running',

    diagnostics: () => ({
      contextState: voices === null ? 'none' : voices.context.state,
      unlocked: voices !== null && voices.context.state === 'running',
      via: unlockedVia,
      sessionType,
    }),

    tryUnlock: () => {
      if (voices !== null && voices.context.state === 'running') {
        return;
      }
      // Retrying every frame would queue a resume() promise per frame while the
      // browser keeps refusing; once a second is plenty to catch the moment
      // permission is granted.
      const now = performance.now();
      if (now - lastUnlockAttemptMs < 1000) {
        return;
      }
      lastUnlockAttemptMs = now;
      resume();
    },

    swing: (sound) => {
      resume();
      switch (sound) {
        case 'light':
          tone(420, 0.09, { type: 'square', gain: 0.18, sweepTo: 260 });
          thump(0.07, 1600, 0.16);
          break;
        case 'lightFinisher':
          tone(330, 0.16, { type: 'square', gain: 0.26, sweepTo: 180 });
          thump(0.12, 1300, 0.3);
          break;
        case 'heavyGood':
          tone(180, 0.18, { type: 'triangle', gain: 0.3, sweepTo: 90 });
          thump(0.14, 900, 0.34);
          break;
        case 'heavyGreat':
          tone(160, 0.24, { type: 'triangle', gain: 0.38, sweepTo: 70 });
          thump(0.18, 800, 0.44);
          tone(760, 0.1, { type: 'sine', gain: 0.16, delay: 0.02 });
          break;
        case 'heavyPerfect':
          // Distinctly brighter and longer, so PERFECT is unmistakable by ear.
          tone(140, 0.32, { type: 'triangle', gain: 0.45, sweepTo: 55 });
          thump(0.22, 700, 0.5);
          tone(1050, 0.16, { type: 'sine', gain: 0.22, delay: 0.02 });
          tone(1570, 0.12, { type: 'sine', gain: 0.14, delay: 0.05 });
          break;
      }
    },

    playerHurt: () => {
      resume();
      tone(220, 0.22, { type: 'sawtooth', gain: 0.3, sweepTo: 110 });
      thump(0.16, 500, 0.3);
    },

    dodge: () => {
      resume();
      // Airy and upward: nothing like an impact, so it never reads as a hit.
      tone(700, 0.14, { type: 'sine', gain: 0.14, sweepTo: 1300 });
    },

    enemyDeath: () => {
      resume();
      tone(300, 0.5, { type: 'sawtooth', gain: 0.32, sweepTo: 60 });
      thump(0.35, 600, 0.4);
    },

    chargeStart: () => {
      resume();
      if (voices === null || chargeOscillator !== null) {
        return;
      }
      const { context, master } = voices;

      chargeOscillator = context.createOscillator();
      chargeGain = context.createGain();
      chargeOscillator.type = 'sawtooth';
      chargeOscillator.frequency.setValueAtTime(120, context.currentTime);
      chargeGain.gain.setValueAtTime(0.0001, context.currentTime);
      chargeGain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.05);

      chargeOscillator.connect(chargeGain);
      chargeGain.connect(master);
      chargeOscillator.start();
      sweetSpotChimed = false;
    },

    chargeUpdate: (progress, inSweetSpot) => {
      if (voices === null || chargeOscillator === null) {
        return;
      }
      // Rising pitch tracks the meter, so the sweet spot can be *heard*
      // approaching while the child is watching the enemy instead of the HUD.
      chargeOscillator.frequency.setTargetAtTime(
        120 + progress * 260,
        voices.context.currentTime,
        0.03,
      );

      if (inSweetSpot && !sweetSpotChimed) {
        sweetSpotChimed = true;
        tone(1320, 0.09, { type: 'sine', gain: 0.16 });
      }
    },

    chargeStop: () => {
      if (voices === null || chargeOscillator === null || chargeGain === null) {
        return;
      }
      const { context } = voices;
      chargeGain.gain.cancelScheduledValues(context.currentTime);
      chargeGain.gain.setValueAtTime(chargeGain.gain.value, context.currentTime);
      chargeGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.05);
      chargeOscillator.stop(context.currentTime + 0.08);

      chargeOscillator = null;
      chargeGain = null;
      sweetSpotChimed = false;
    },

    dispose: () => {
      for (const type of GESTURES) {
        window.removeEventListener(type, unlock, { capture: true });
      }
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
      if (voices !== null) {
        void voices.context.close();
        voices = null;
      }
    },
  };
}
