import { describe, expect, it } from 'vitest';

import { SPIKE_FACTOR, createFrameStats } from '../src/stress/frameStats';

/**
 * The measurement itself, checked against distributions whose answers are known.
 *
 * Worth testing carefully rather than trusting: these numbers are the entire
 * output of 0A.12, and a statistic that is quietly wrong does not look wrong —
 * it looks like a device that is faster or slower than it really is, and the
 * decisions that follow (budgets, whether the 13 mini is viable at all) are made
 * on it.
 */

/** Feeds `count` frames of exactly `ms`. */
function steady(stats: ReturnType<typeof createFrameStats>, ms: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    stats.record(ms);
  }
}

describe('a steady frame rate', () => {
  it('reports the rate it was given', () => {
    const stats = createFrameStats();
    steady(stats, 1000 / 30, 600);

    const { medianFps, samples } = stats.summary();
    expect(samples).toBe(600);
    // Bucketed to 0.5 ms, so exact equality is not on offer — but it must be
    // right to well within a frame.
    expect(medianFps).toBeGreaterThan(29);
    expect(medianFps).toBeLessThan(31);
  });

  it('counts no spikes when nothing spiked', () => {
    const stats = createFrameStats();
    steady(stats, 16.7, 500);
    expect(stats.summary().spikes).toBe(0);
  });
});

describe('a median is used precisely because a mean would lie', () => {
  it('ignores one enormous hitch', () => {
    const stats = createFrameStats();
    steady(stats, 1000 / 60, 1000);
    // One 400 ms stall: a texture upload, a garbage collection, a phone
    // deciding to do something else.
    stats.record(400);

    const { medianFps, worstMs, spikes } = stats.summary();
    // The mean here would be ~17.1 ms and would read as 58 fps, quietly
    // blaming the device for a single stumble.
    expect(medianFps).toBeGreaterThan(59);
    expect(worstMs).toBe(400);
    // The stall is not lost — it is reported separately, which is the point.
    expect(spikes).toBe(1);
  });

  it('separates how it usually runs from how often it stumbles', () => {
    const stats = createFrameStats();
    steady(stats, 16.7, 900);
    steady(stats, 50, 100);

    const { medianFps, spikes, p95Ms } = stats.summary();
    expect(medianFps).toBeGreaterThan(58);
    expect(spikes).toBe(100);
    // The slow tail shows up where it belongs.
    expect(p95Ms).toBeGreaterThan(30);
  });
});

describe('spikes', () => {
  it('counts frames beyond the multiple of the median', () => {
    const stats = createFrameStats();
    steady(stats, 10, 100);

    const justUnder = 10 * SPIKE_FACTOR - 1;
    stats.record(justUnder);
    expect(stats.summary().spikes).toBe(0);

    stats.record(10 * SPIKE_FACTOR + 5);
    expect(stats.summary().spikes).toBe(1);
  });

  it('reports none before any frames, rather than treating zero as the median', () => {
    expect(createFrameStats().summary().spikes).toBe(0);
  });
});

describe('watching a device throttle', () => {
  it('separates the recent rate from the session rate', () => {
    // The shape of thermal throttling: fine for a while, then slower. This is
    // exactly what a thirty-minute run is looking for, and it has to be visible
    // while it happens rather than only in hindsight.
    const stats = createFrameStats();
    steady(stats, 1000 / 60, 3000);
    steady(stats, 1000 / 30, 400);

    const { medianFps, recentMedianFps } = stats.summary();
    expect(medianFps).toBeGreaterThan(50);
    expect(recentMedianFps).toBeGreaterThan(29);
    expect(recentMedianFps).toBeLessThan(32);
    expect(medianFps - recentMedianFps).toBeGreaterThan(15);
  });

  it('has nothing to say before it has seen anything', () => {
    const summary = createFrameStats().summary();
    expect(summary.samples).toBe(0);
    expect(summary.medianFps).toBe(0);
    expect(summary.recentMedianFps).toBe(0);
  });
});

describe('robustness', () => {
  it('ignores impossible frame times rather than poisoning the numbers', () => {
    const stats = createFrameStats();
    steady(stats, 16.7, 100);
    stats.record(0);
    stats.record(-5);
    stats.record(Number.NaN);
    stats.record(Number.POSITIVE_INFINITY);

    expect(stats.summary().samples).toBe(100);
  });

  it('does not grow with the length of the run', () => {
    // Half an hour at 30 fps is 54,000 frames. The measurement must not become
    // the reason the device stutters.
    const stats = createFrameStats();
    steady(stats, 33.3, 60_000);
    expect(stats.summary().samples).toBe(60_000);
    expect(stats.summary().medianFps).toBeGreaterThan(29);
  });

  it('clears completely on reset', () => {
    const stats = createFrameStats();
    steady(stats, 33.3, 500);
    stats.reset();

    const summary = stats.summary();
    expect(summary.samples).toBe(0);
    expect(summary.worstMs).toBe(0);
    expect(summary.medianFps).toBe(0);
  });
});
