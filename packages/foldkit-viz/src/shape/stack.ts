// D3 parity: d3-shape/src/stack.js + offset/* + order/*
// Functional API — pass data + config, receive immutable StackSeries[].

// ── Types ─────────────────────────────────────────────────────────────────────

export type StackData = Readonly<Record<string, number>>;

/** One [y0, y1] band for a single data point in a single series. */
export interface StackBand {
  readonly y0: number;
  readonly y1: number;
  readonly data: StackData;
}

/** All bands for one key across the full dataset. */
export interface StackSeries {
  readonly key: string;
  /** Position in the render order after ordering + offsetting. */
  readonly index: number;
  readonly bands: ReadonlyArray<StackBand>;
}

export type StackOffset = 'none' | 'expand' | 'silhouette' | 'wiggle';
export type StackOrder = 'none' | 'ascending' | 'descending' | 'insideOut';

export interface StackConfig {
  readonly keys: ReadonlyArray<string>;
  /** Accessor for the numeric value of a key in a data row (default: `d[key] ?? 0`). */
  readonly value?: (d: StackData, key: string) => number;
  /** How to sort series before offsetting (default: 'none'). */
  readonly order?: StackOrder;
  /** How to compute baselines (default: 'none' = zero-baseline stacking). */
  readonly offset?: StackOffset;
}

// ── Internal mutable representation ─────────────────────────────────────────

interface MutablePt {
  y0: number;
  y1: number;
  readonly data: StackData;
}

interface MutableSeries extends Array<MutablePt> {
  key: string;
  index: number;
}

// ── Order algorithms ──────────────────────────────────────────────────────────

// D3 parity: d3-shape/src/order/none.js
function orderIdentity(series: MutableSeries[]): number[] {
  return Array.from({ length: series.length }, (_, i) => i);
}

// D3 parity: d3-shape/src/order/ascending.js
function seriesSum(s: MutableSeries): number {
  let total = 0;
  for (const pt of s) total += pt.y1 || 0;
  return total;
}

function orderAscending(series: MutableSeries[]): number[] {
  const sums = series.map(seriesSum);
  return orderIdentity(series).sort((a, b) => (sums[a] ?? 0) - (sums[b] ?? 0));
}

// D3 parity: d3-shape/src/order/appearance.js — sort by column of peak value
function orderAppearance(series: MutableSeries[]): number[] {
  const peaks = series.map((s) => {
    let maxJ = 0;
    let maxV = -Infinity;
    for (let i = 0; i < s.length; ++i) {
      const v = s[i]?.y1 ?? 0;
      if (v > maxV) { maxV = v; maxJ = i; }
    }
    return maxJ;
  });
  return orderIdentity(series).sort((a, b) => (peaks[a] ?? 0) - (peaks[b] ?? 0));
}

// D3 parity: d3-shape/src/order/insideOut.js — Havre-Heer-Agrawala layout
function orderInsideOut(series: MutableSeries[]): number[] {
  const n = series.length;
  const sums = series.map(seriesSum);
  const order = orderAppearance(series);
  let top = 0;
  let bottom = 0;
  const tops: number[] = [];
  const bottoms: number[] = [];
  for (let i = 0; i < n; ++i) {
    const j = order[i] ?? 0;
    if (top < bottom) {
      top += sums[j] ?? 0;
      tops.push(j);
    } else {
      bottom += sums[j] ?? 0;
      bottoms.push(j);
    }
  }
  return [...bottoms.reverse(), ...tops];
}

function computeOrder(series: MutableSeries[], mode: StackOrder): number[] {
  switch (mode) {
    case 'ascending': return orderAscending(series);
    case 'descending': return orderAscending(series).reverse();
    case 'insideOut': return orderInsideOut(series);
    default: return orderIdentity(series);
  }
}

// ── Offset algorithms ─────────────────────────────────────────────────────────

// D3 parity: d3-shape/src/offset/none.js — cumulative zero-baseline stacking
function applyOffsetNone(series: MutableSeries[], order: number[]): void {
  const n = series.length;
  if (n <= 1) return;
  const m = series[order[0] ?? 0]?.length ?? 0;
  for (let i = 1; i < n; ++i) {
    const s0 = series[order[i - 1] ?? 0];
    const s1 = series[order[i] ?? 0];
    if (!s0 || !s1) continue;
    for (let j = 0; j < m; ++j) {
      const prev = s0[j];
      const cur = s1[j];
      if (!prev || !cur) continue;
      const baseline = Number.isNaN(prev.y1) ? prev.y0 : prev.y1;
      cur.y0 = baseline;
      cur.y1 += baseline;
    }
  }
}

// D3 parity: d3-shape/src/offset/expand.js — normalise each column to [0,1]
function applyOffsetExpand(series: MutableSeries[], order: number[]): void {
  const n = series.length;
  if (n === 0) return;
  const m = series[0]?.length ?? 0;
  for (let j = 0; j < m; ++j) {
    let y = 0;
    for (let i = 0; i < n; ++i) y += series[i]?.[j]?.y1 || 0;
    if (y) {
      for (let i = 0; i < n; ++i) {
        const pt = series[i]?.[j];
        if (pt) pt.y1 /= y;
      }
    }
  }
  applyOffsetNone(series, order);
}

// D3 parity: d3-shape/src/offset/silhouette.js — centre the stack around y=0
function applyOffsetSilhouette(series: MutableSeries[], order: number[]): void {
  const n = series.length;
  if (n === 0) return;
  const s0 = series[order[0] ?? 0];
  if (!s0) return;
  const m = s0.length;
  for (let j = 0; j < m; ++j) {
    let y = 0;
    for (let i = 0; i < n; ++i) y += series[i]?.[j]?.y1 || 0;
    const pt = s0[j];
    if (!pt) continue;
    pt.y0 = -y / 2;
    pt.y1 += pt.y0;
  }
  applyOffsetNone(series, order);
}

// D3 parity: d3-shape/src/offset/wiggle.js — Tallarida-Murray weighted-slope baseline
function applyOffsetWiggle(series: MutableSeries[], order: number[]): void {
  const n = series.length;
  if (n === 0) return;
  const s0 = series[order[0] ?? 0];
  if (!s0) return;
  const m = s0.length;
  if (m === 0) return;

  let y = 0;
  for (let j = 1; j < m; ++j) {
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < n; ++i) {
      const si = series[order[i] ?? 0];
      if (!si) continue;
      const sij0 = si[j]?.y1 || 0;
      const sij1 = si[j - 1]?.y1 || 0;
      let s3 = (sij0 - sij1) / 2;
      for (let k = 0; k < i; ++k) {
        const sk = series[order[k] ?? 0];
        if (sk) s3 += (sk[j]?.y1 || 0) - (sk[j - 1]?.y1 || 0);
      }
      s1 += sij0;
      s2 += s3 * sij0;
    }
    const pt = s0[j - 1];
    if (pt) {
      pt.y0 = y;
      pt.y1 += y;
    }
    if (s1) y -= s2 / s1;
  }
  const last = s0[m - 1];
  if (last) {
    last.y0 = y;
    last.y1 += y;
  }
  applyOffsetNone(series, order);
}

function applyOffset(series: MutableSeries[], order: number[], mode: StackOffset): void {
  switch (mode) {
    case 'expand': applyOffsetExpand(series, order); break;
    case 'silhouette': applyOffsetSilhouette(series, order); break;
    case 'wiggle': applyOffsetWiggle(series, order); break;
    default: applyOffsetNone(series, order); break;
  }
}

// ── Public: stack ─────────────────────────────────────────────────────────────

// D3 parity: d3-shape/src/stack.js
export function stack(
  data: ReadonlyArray<StackData>,
  config: StackConfig,
): ReadonlyArray<StackSeries> {
  const {
    keys,
    value = (d, k) => d[k] ?? 0,
    order: orderMode = 'none',
    offset: offsetMode = 'none',
  } = config;

  const n = keys.length;

  // Build mutable internal series, one per key
  const series: MutableSeries[] = keys.map((key) => {
    const s = [] as unknown as MutableSeries;
    s.key = key;
    s.index = 0;
    return s;
  });

  // Populate raw [0, value] points
  for (const d of data) {
    for (let i = 0; i < n; ++i) {
      const key = keys[i];
      if (key === undefined) continue;
      series[i]?.push({ y0: 0, y1: Math.max(0, value(d, key)), data: d });
    }
  }

  // Order → assign index positions
  const order = computeOrder(series, orderMode);
  for (let i = 0; i < n; ++i) {
    const s = series[order[i] ?? 0];
    if (s) s.index = i;
  }

  // Offset → set y0/y1 baselines
  applyOffset(series, order, offsetMode);

  // Return immutable output
  return series.map(
    (s): StackSeries => ({
      key: s.key,
      index: s.index,
      bands: s.map((pt): StackBand => ({ y0: pt.y0, y1: pt.y1, data: pt.data })),
    }),
  );
}
