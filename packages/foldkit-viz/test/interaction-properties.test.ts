import { describe, expect, it } from 'bun:test';

import fc from 'fast-check';

import {
  SELECTION_NONE,
  clampSelection,
  intervalSelection,
  keySelection,
} from '../src/interaction/selection';
import { panDomain, zoomDomain } from '../src/interaction/viewport';
import { compilePlot, highlightPoints, invertAxis, pointerToPlot } from '../src/plot';
import type { PlotSpec, PositionScaleSpec } from '../src/plot';

/**
 * Properties of the interaction layer: pixels and data convert both ways on
 * every axis type, viewports never leave their bounds, selections clamp and
 * clear consistently, and a linked highlight restyles exactly as compiling it
 * would.
 */

const RUNS = { numRuns: 200 };
const closeTo = (actual: number, expected: number, relative = 1e-6) =>
  Math.abs(actual - expected) <= relative * Math.max(1, Math.abs(expected));

/** An increasing [lo, hi] pair, with room between the ends. */
const domainIn = (min: number, max: number) =>
  fc
    .tuple(fc.double({ min, max, noNaN: true }), fc.double({ min, max, noNaN: true }))
    .filter(([a, b]) => Math.abs(a - b) > (max - min) * 1e-3)
    .map(([a, b]): readonly [number, number] => [Math.min(a, b), Math.max(a, b)]);

describe('domain conversion', () => {
  const axes: ReadonlyArray<readonly [string, PositionScaleSpec, number, number]> = [
    ['linear', { type: 'linear' }, -1e6, 1e6],
    ['log', { type: 'log' }, 1e-3, 1e9],
    ['pow', { type: 'pow', exponent: 0.5 }, 0, 1e6],
    ['symlog', { type: 'symlog' }, -1e5, 1e5],
    ['time', { type: 'time' }, Date.UTC(1990, 0, 1), Date.UTC(2040, 0, 1)],
  ];

  it.each(axes)('inverts a %s axis back to the value it placed', (_, scale, min, max) => {
    fc.assert(
      fc.property(domainIn(min, max), fc.double({ min: 0, max: 1, noNaN: true }), (domain, at) => {
        const value =
          scale.type === 'log'
            ? Math.exp(Math.log(domain[0]) + at * (Math.log(domain[1]) - Math.log(domain[0])))
            : domain[0] + at * (domain[1] - domain[0]);
        const plot = compilePlot({
          width: 400,
          height: 200,
          x: { ...scale, domain },
          data: [{ x: value, y: 1 }],
          marks: [{ mark: 'dot', x: 'x', y: 'y' }],
        });
        const [dot] = plot.facets[0]?.marks[0]?.graphics ?? [];
        const axis = plot.facets[0]?.x;
        if (dot?.kind !== 'circle' || axis === null || axis === undefined) return false;
        return closeTo(Number(invertAxis(axis, dot.cx)), value, 1e-6);
      }),
      RUNS,
    );
  });

  it('converts a pointer through any rendered box back to its plot pixel', () => {
    fc.assert(
      fc.property(
        fc.record({
          left: fc.double({ min: -2000, max: 2000, noNaN: true }),
          top: fc.double({ min: -2000, max: 2000, noNaN: true }),
          scale: fc.double({ min: 0.1, max: 4, noNaN: true }),
          px: fc.double({ min: 0, max: 720, noNaN: true }),
          py: fc.double({ min: 0, max: 420, noNaN: true }),
        }),
        ({ left, top, scale, px, py }) => {
          const rect = { left, top, width: 720 * scale, height: 420 * scale };
          const back = pointerToPlot({ x: left + px * scale, y: top + py * scale }, rect, {
            width: 720,
            height: 420,
          });
          return closeTo(back.x, px, 1e-9) && closeTo(back.y, py, 1e-9);
        },
      ),
      RUNS,
    );
  });
});

describe('viewport clamping', () => {
  const viewport = domainIn(-1e6, 1e6).chain((bounds) => {
    const span = bounds[1] - bounds[0];
    return fc.record({
      bounds: fc.constant(bounds),
      domain: domainIn(bounds[0], bounds[1]),
      minSpan: fc.double({ min: span * 1e-4, max: span, noNaN: true }),
    });
  });

  it('keeps every zoom inside its bounds and at least the minimum span', () => {
    fc.assert(
      fc.property(
        viewport,
        fc.double({ min: 0.05, max: 20, noNaN: true }),
        fc.double({ min: -2e6, max: 2e6, noNaN: true }),
        ({ bounds, domain, minSpan }, factor, anchor) => {
          const [lo, hi] = zoomDomain(domain, factor, anchor, bounds, minSpan);
          return lo >= bounds[0] && hi <= bounds[1] && hi - lo >= minSpan * (1 - 1e-9);
        },
      ),
      RUNS,
    );
  });

  it('keeps every pan inside its bounds without changing an allowed span', () => {
    fc.assert(
      fc.property(viewport, fc.double({ min: -3e6, max: 3e6, noNaN: true }), (view, delta) => {
        const { bounds, domain, minSpan } = view;
        const [lo, hi] = panDomain(domain, delta, bounds, minSpan);
        const span = Math.max(domain[1] - domain[0], minSpan);
        return lo >= bounds[0] && hi <= bounds[1] && closeTo(hi - lo, span, 1e-9);
      }),
      RUNS,
    );
  });
});

describe('selection clamping and clearing', () => {
  it('clamps an interval inside its bounds, or clears it when nothing is left', () => {
    fc.assert(
      fc.property(domainIn(-1e3, 1e3), domainIn(-1e3, 1e3), (domain, bounds) => {
        const clamped = clampSelection(intervalSelection('x', domain), bounds);
        if (clamped._tag === 'None') return domain[1] <= bounds[0] || domain[0] >= bounds[1];
        if (clamped._tag !== 'Interval') return false;
        const [lo, hi] = clamped.domain;
        return lo >= bounds[0] && hi <= bounds[1] && lo >= domain[0] && hi <= domain[1];
      }),
      RUNS,
    );
  });

  it('clears an interval of no width and a selection of no keys', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (value) => {
        return intervalSelection('y', [value, value]) === SELECTION_NONE;
      }),
      RUNS,
    );
    expect(keySelection([])).toBe(SELECTION_NONE);
  });
});

describe('linked updates', () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({
    x: (i * 37) % 101,
    y: (i * 53) % 97,
    g: i % 3 === 0 ? 'a' : 'b',
  }));
  const spec: PlotSpec = {
    width: 400,
    height: 300,
    data: rows,
    facet: { x: 'g' },
    marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
  };
  const plain = compilePlot(spec);

  it('restyles a dense mark exactly as compiling the highlight would', () => {
    fc.assert(
      fc.property(domainIn(-10, 110), (range) => {
        const highlight = { field: 'x', range };
        const restyled = highlightPoints(plain, 0, rows, highlight);
        const compiled = compilePlot({
          ...spec,
          marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true, highlight }],
        });
        expect(restyled).toEqual(compiled);
        return true;
      }),
      { numRuns: 40 },
    );
  });

  it('returns to the plain geometry when the highlight clears, after any highlight', () => {
    fc.assert(
      fc.property(domainIn(0, 100), (range) => {
        const restyled = highlightPoints(plain, 0, rows, { field: 'y', range });
        expect(highlightPoints(restyled, 0, rows, undefined)).toEqual(plain);
        return true;
      }),
      { numRuns: 40 },
    );
  });
});
