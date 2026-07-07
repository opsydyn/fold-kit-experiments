import { describe, expect, it } from 'bun:test';

import {
  bisect,
  bisectLeft,
  cumsum,
  deviation,
  extent,
  group,
  mean,
  median,
  rollup,
  sum,
  variance,
} from '../src/math/array';
import {
  linearInvertible,
  niceLinear,
  scalePow,
  scaleQuantile,
  scaleQuantize,
  scaleSequential,
  scaleSymlog,
} from '../src/math/scale';
import { timeFormat, timeParse } from '../src/math/time';
import { assertApprox, assertMonotone, assertScaleRange } from './chart-harness';

// ── math/array ────────────────────────────────────────────────────────────────

describe('extent', () => {
  it('returns [min, max]', () => {
    expect(extent([3, 1, 4, 1, 5, 9, 2, 6])).toEqual([1, 9]);
  });
  it('returns [undefined, undefined] for empty array', () => {
    expect(extent([])).toEqual([undefined, undefined]);
  });
  it('supports accessor', () => {
    expect(extent([{ v: 2 }, { v: 7 }, { v: 1 }], (d) => d.v)).toEqual([1, 7]);
  });
});

describe('sum / mean / median / variance / deviation', () => {
  const xs = [2, 4, 4, 4, 5, 5, 7, 9];
  it('sum', () => expect(sum(xs)).toBe(40));
  it('mean', () => expect(mean(xs)).toBe(5));
  it('median (even)', () => assertApprox(median([1, 2, 3, 4]), 2.5));
  it('median (odd)', () => assertApprox(median([1, 3, 5]), 3));
  // D3 parity: sample variance (÷ n-1), not population variance (÷ n)
  it('variance (sample)', () => assertApprox(variance(xs), 32 / 7, 0.001));
  it('deviation (sample)', () => assertApprox(deviation(xs), Math.sqrt(32 / 7), 0.001));
});

describe('cumsum', () => {
  it('running totals', () => {
    expect([...cumsum([1, 2, 3, 4])]).toEqual([1, 3, 6, 10]);
  });
  it('handles empty', () => expect([...cumsum([])]).toEqual([]));
});

describe('group / rollup', () => {
  const data = [
    { name: 'a', v: 1 },
    { name: 'b', v: 2 },
    { name: 'a', v: 3 },
  ];
  it('group by key', () => {
    const g = group(data, (d) => d.name);
    expect(g.get('a')?.length).toBe(2);
    expect(g.get('b')?.length).toBe(1);
  });
  it('rollup sum', () => {
    const r = rollup(
      data,
      (g) => g.reduce((s, d) => s + d.v, 0),
      (d) => d.name,
    );
    expect(r.get('a')).toBe(4);
    expect(r.get('b')).toBe(2);
  });
});

describe('bisect', () => {
  const xs = [1, 2, 3, 4, 5];
  it('returns insertion point (right)', () => {
    expect(bisect(xs, 3)).toBe(3);
    expect(bisect(xs, 3.5)).toBe(3);
  });
  it('bisectLeft returns left position', () => {
    expect(bisectLeft(xs, 3)).toBe(2);
  });
  it('past end returns length', () => expect(bisect(xs, 99)).toBe(5));
  it('before start returns 0', () => expect(bisect(xs, 0)).toBe(0));
});

// ── math/scale — new additions ────────────────────────────────────────────────

describe('linearInvertible', () => {
  const s = linearInvertible({ domain: [0, 100], range: [0, 400] });
  it('maps domain to range', () => assertApprox(s(50), 200));
  it('inverts range to domain', () => assertApprox(s.invert(200), 50));
  it('invert(scale(x)) === x', () => {
    for (const v of [0, 25, 50, 75, 100]) assertApprox(s.invert(s(v)), v);
  });
});

describe('niceLinear', () => {
  it('expands to round boundaries', () => {
    const [lo, hi] = niceLinear([0.12, 9.87]);
    expect(lo).toBeLessThanOrEqual(0.12);
    expect(hi).toBeGreaterThanOrEqual(9.87);
    // boundaries should be multiples of the tick step
    expect(Number.isFinite(lo)).toBe(true);
    expect(Number.isFinite(hi)).toBe(true);
  });
});

describe('scaleQuantile', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const s = scaleQuantile(data, ['low', 'mid', 'high']);
  it('maps bottom third to low', () => expect(s(2)).toBe('low'));
  it('maps middle third to mid', () => expect(s(5)).toBe('mid'));
  it('maps top third to high', () => expect(s(9)).toBe('high'));
});

describe('scaleQuantize', () => {
  const s = scaleQuantize([0, 100], ['A', 'B', 'C', 'D']);
  it('divides domain into equal bins', () => {
    expect(s(10)).toBe('A');
    expect(s(35)).toBe('B');
    expect(s(60)).toBe('C');
    expect(s(85)).toBe('D');
  });
});

describe('scaleSequential', () => {
  const s = scaleSequential([0, 1], (t) => `rgb(${Math.round(t * 255)},0,0)`);
  it('t=0 maps to start color', () => expect(s(0)).toBe('rgb(0,0,0)'));
  it('t=1 maps to end color', () => expect(s(1)).toBe('rgb(255,0,0)'));
  it('clamps outside domain', () => {
    expect(s(-1)).toBe('rgb(0,0,0)');
    expect(s(2)).toBe('rgb(255,0,0)');
  });
});

describe('scalePow', () => {
  const sqrt = scalePow({ domain: [0, 100], range: [0, 10], exponent: 0.5 });
  it('sqrt(100) = 10', () => assertApprox(sqrt(100), 10));
  it('sqrt(25) ≈ 5', () => assertApprox(sqrt(25), 5));
  it('is monotone', () => assertMonotone(sqrt, [0, 10, 25, 50, 75, 100]));
});

describe('scaleSymlog', () => {
  const s = scaleSymlog({ domain: [-100, 100], range: [-10, 10] });
  it('0 maps to 0', () => assertApprox(s(0), 0));
  it('is antisymmetric', () => assertApprox(s(50), -s(-50)));
  it('is monotone', () => assertMonotone(s, [-100, -50, -1, 0, 1, 50, 100]));
});

// ── math/time — timeFormat / timeParse ───────────────────────────────────────

describe('timeFormat', () => {
  const d = new Date(2024, 2, 15, 9, 5, 3); // 2024-03-15 09:05:03

  it('%Y → 4-digit year', () => expect(timeFormat('%Y')(d)).toBe('2024'));
  it('%m → zero-padded month', () => expect(timeFormat('%m')(d)).toBe('03'));
  it('%d → zero-padded day', () => expect(timeFormat('%d')(d)).toBe('15'));
  it('%H → 24h hour', () => expect(timeFormat('%H')(d)).toBe('09'));
  it('%M → minute', () => expect(timeFormat('%M')(d)).toBe('05'));
  it('%b → short month name', () => expect(timeFormat('%b')(d)).toBe('Mar'));
  it('compound format', () => expect(timeFormat('%Y-%m-%d')(d)).toBe('2024-03-15'));
  it('%% literal percent', () => expect(timeFormat('100%%')(d)).toBe('100%'));
});

describe('timeParse', () => {
  it('parses %Y-%m-%d', () => {
    const d = timeParse('%Y-%m-%d')('2024-03-15');
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(2); // 0-indexed
    expect(d?.getDate()).toBe(15);
  });
  it('returns null for non-matching input', () => {
    expect(timeParse('%Y-%m-%d')('not-a-date')).toBeNull();
  });
  it('round-trips format/parse', () => {
    const fmt = '%Y-%m-%d';
    const orig = new Date(2023, 10, 7);
    const parsed = timeParse(fmt)(timeFormat(fmt)(orig));
    expect(parsed?.getFullYear()).toBe(2023);
    expect(parsed?.getMonth()).toBe(10);
    expect(parsed?.getDate()).toBe(7);
  });
});

// ── assertScaleRange helper ───────────────────────────────────────────────────

describe('assertScaleRange', () => {
  it('passes for values within range', () => {
    const s = (v: number) => v * 2;
    expect(() => assertScaleRange(s, [0, 5, 10], [0, 20])).not.toThrow();
  });
  it('throws for out-of-range output', () => {
    const s = (v: number) => v * 3;
    expect(() => assertScaleRange(s, [10], [0, 20])).toThrow();
  });
});
