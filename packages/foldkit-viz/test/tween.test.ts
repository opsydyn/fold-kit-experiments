import { describe, expect, it } from 'bun:test';
import {
  allTweensDone,
  easeInCubic,
  easeInOutCubic,
  easeLinear,
  easeOutBack,
  easeOutCubic,
  easeOutElastic,
  tweenCreate,
  tweenDone,
  tweenPath,
  tweenStep,
  tweenValue,
} from '../src/math/tween';
import { assertApprox } from './chart-harness';

describe('tweenCreate', () => {
  it('starts at progress=0, elapsed=0', () => {
    const t = tweenCreate(500);
    expect(t.progress).toBe(0);
    expect(t.elapsed).toBe(0);
    expect(t.duration).toBe(500);
  });

  it('accepts a custom easing function', () => {
    const t = tweenCreate(200, easeLinear);
    expect(t.ease).toBe(easeLinear);
  });
});

describe('tweenStep', () => {
  it('advances elapsed by dt', () => {
    const t = tweenStep(tweenCreate(500), 100);
    expect(t.elapsed).toBe(100);
  });

  it('clamps elapsed at duration', () => {
    const t = tweenStep(tweenCreate(200), 999);
    expect(t.elapsed).toBe(200);
    expect(t.progress).toBe(1);
  });

  it('progress is 0.5 at half duration with linear ease', () => {
    const t = tweenStep(tweenCreate(200, easeLinear), 100);
    assertApprox(t.progress, 0.5);
  });

  it('does not mutate the original tween', () => {
    const original = tweenCreate(400);
    tweenStep(original, 100);
    expect(original.elapsed).toBe(0);
  });
});

describe('tweenDone', () => {
  it('returns false before completion', () => {
    expect(tweenDone(tweenCreate(300))).toBe(false);
  });

  it('returns true when elapsed === duration', () => {
    const t = tweenStep(tweenCreate(100), 100);
    expect(tweenDone(t)).toBe(true);
  });

  it('returns true when elapsed > duration', () => {
    const t = tweenStep(tweenCreate(100), 200);
    expect(tweenDone(t)).toBe(true);
  });
});

describe('tweenValue', () => {
  it('returns from at progress=0', () => {
    const t = tweenCreate(100, easeLinear);
    assertApprox(tweenValue(10, 90, t), 10);
  });

  it('returns to at progress=1', () => {
    const t = tweenStep(tweenCreate(100, easeLinear), 100);
    assertApprox(tweenValue(10, 90, t), 90);
  });

  it('returns midpoint at progress=0.5 with linear ease', () => {
    const t = tweenStep(tweenCreate(100, easeLinear), 50);
    assertApprox(tweenValue(0, 100, t), 50, 0.01);
  });

  it('works with negative range', () => {
    const t = tweenStep(tweenCreate(100, easeLinear), 100);
    assertApprox(tweenValue(100, 0, t), 0);
  });
});

describe('allTweensDone', () => {
  it('returns true for all-done tweens', () => {
    const done = tweenStep(tweenCreate(100), 200);
    expect(allTweensDone([done, done])).toBe(true);
  });

  it('returns false if any tween is not done', () => {
    const done = tweenStep(tweenCreate(100), 200);
    const running = tweenCreate(100);
    expect(allTweensDone([done, running])).toBe(false);
  });

  it('returns true for an empty array', () => {
    expect(allTweensDone([])).toBe(true);
  });
});

describe('easing functions', () => {
  const ease = (fn: (t: number) => number) => {
    assertApprox(fn(0), 0, 0.001);
    assertApprox(fn(1), 1, 0.001);
  };

  it('easeLinear: 0→0, 1→1', () => ease(easeLinear));
  it('easeOutCubic: 0→0, 1→1', () => ease(easeOutCubic));
  it('easeInCubic: 0→0, 1→1', () => ease(easeInCubic));
  it('easeInOutCubic: 0→0, 1→1', () => ease(easeInOutCubic));
  it('easeOutElastic: 0→0, 1→1', () => ease(easeOutElastic));
  it('easeOutBack: 0→0, 1→1', () => ease(easeOutBack));

  it('easeOutCubic decelerates (progress at 0.5 > 0.5)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('easeInCubic accelerates (progress at 0.5 < 0.5)', () => {
    expect(easeInCubic(0.5)).toBeLessThan(0.5);
  });
});

describe('tweenPath', () => {
  it('returns to when progress=1', () => {
    const t = tweenStep(tweenCreate(100, easeLinear), 100);
    expect(tweenPath('M0,0 L10,20', 'M5,5 L20,40', t)).toBe('M5,5 L20,40');
  });

  it('returns from when progress=0', () => {
    const t = tweenCreate(100, easeLinear);
    expect(tweenPath('M0,0 L10,20', 'M5,5 L20,40', t)).toBe('M0,0 L10,20');
  });

  it('interpolates numeric values at midpoint', () => {
    const t = tweenStep(tweenCreate(100, easeLinear), 50);
    const result = tweenPath('M0,0', 'M10,20', t);
    // At 0.5, values should be ~5 and ~10
    expect(result).toContain('5');
  });
});
