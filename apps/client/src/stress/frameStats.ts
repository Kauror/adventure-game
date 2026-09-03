/**
 * Frame-time statistics for the device baseline (roadmap 0A.12).
 *
 * The roadmap asks for a median rather than an average, and it is right to: one
 * 400 ms hitch while a texture uploads drags a mean down and says the device is
 * slow, when what actually happened is that it stumbled once. A median says how
 * the game normally runs, and the spike count says how often it does not — two
 * numbers that answer different questions and should never be blended into one.
 *
 * Session figures come from a **histogram** rather than a list of samples: half
 * an hour at 30 fps is 54,000 frames, and this has to keep running while the
 * thing it measures is trying to hold a frame budget on a phone. Bucketed
 * counts make the median O(buckets) and the memory constant, which matters when
 * the measurement must not become the thing that causes the stutter.
 *
 * A short ring of recent frames sits alongside it, because thermal throttling is
 * the whole point of a thirty-minute run: a session median that slowly separates
 * from the recent median *is* the throttling, visible while it happens rather
 * than inferred afterwards.
 */

/** Width of a histogram bucket, in milliseconds. */
const BUCKET_MS = 0.5;
/** Frames slower than this are counted in the top bucket. */
const MAX_TRACKED_MS = 250;
const BUCKETS = Math.ceil(MAX_TRACKED_MS / BUCKET_MS);

/** A frame this many times the median counts as a spike. */
export const SPIKE_FACTOR = 2;

/** How many recent frames feed the drift figure — about ten seconds at 30 fps. */
const RECENT_FRAMES = 300;

export interface FrameSummary {
  readonly samples: number;
  readonly elapsedSeconds: number;
  /** Median frame time over the whole session. */
  readonly medianMs: number;
  readonly medianFps: number;
  /** The slow tail: 95% of frames were at least this quick. */
  readonly p95Ms: number;
  readonly worstMs: number;
  /** Frames taking more than `SPIKE_FACTOR` times the median. */
  readonly spikes: number;
  /** Median over the last few seconds, for watching a device throttle. */
  readonly recentMedianFps: number;
}

export interface FrameStats {
  readonly record: (frameMs: number) => void;
  readonly summary: () => FrameSummary;
  readonly reset: () => void;
}

function median(sorted: readonly number[]): number {
  if (sorted.length === 0) {
    return 0;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

export function createFrameStats(): FrameStats {
  let buckets = new Uint32Array(BUCKETS);
  let samples = 0;
  let totalMs = 0;
  let worstMs = 0;

  const recent = new Float64Array(RECENT_FRAMES);
  let recentCount = 0;
  let recentIndex = 0;

  /** The frame time at a given position through the sorted distribution. */
  const quantile = (fraction: number): number => {
    if (samples === 0) {
      return 0;
    }
    const target = Math.min(samples - 1, Math.floor(samples * fraction));
    let seen = 0;
    for (let i = 0; i < BUCKETS; i += 1) {
      seen += buckets[i]!;
      if (seen > target) {
        // The middle of the bucket: the samples inside it are indistinguishable.
        return (i + 0.5) * BUCKET_MS;
      }
    }
    return MAX_TRACKED_MS;
  };

  const countSlowerThan = (thresholdMs: number): number => {
    const from = Math.min(BUCKETS - 1, Math.ceil(thresholdMs / BUCKET_MS));
    let count = 0;
    for (let i = from; i < BUCKETS; i += 1) {
      count += buckets[i]!;
    }
    return count;
  };

  return {
    record: (frameMs) => {
      if (!Number.isFinite(frameMs) || frameMs <= 0) {
        return;
      }

      samples += 1;
      totalMs += frameMs;
      worstMs = Math.max(worstMs, frameMs);

      const bucket = Math.min(BUCKETS - 1, Math.floor(frameMs / BUCKET_MS));
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;

      recent[recentIndex] = frameMs;
      recentIndex = (recentIndex + 1) % RECENT_FRAMES;
      recentCount = Math.min(RECENT_FRAMES, recentCount + 1);
    },

    summary: () => {
      const medianMs = quantile(0.5);
      const recentSorted = Array.from(recent.subarray(0, recentCount)).sort((a, b) => a - b);
      const recentMedianMs = median(recentSorted);

      return {
        samples,
        elapsedSeconds: totalMs / 1000,
        medianMs,
        medianFps: medianMs > 0 ? 1000 / medianMs : 0,
        p95Ms: quantile(0.95),
        worstMs,
        // Guarded: before any frames the median is 0, and everything would count
        // as a spike.
        spikes: medianMs > 0 ? countSlowerThan(medianMs * SPIKE_FACTOR) : 0,
        recentMedianFps: recentMedianMs > 0 ? 1000 / recentMedianMs : 0,
      };
    },

    reset: () => {
      buckets = new Uint32Array(BUCKETS);
      samples = 0;
      totalMs = 0;
      worstMs = 0;
      recentCount = 0;
      recentIndex = 0;
    },
  };
}
