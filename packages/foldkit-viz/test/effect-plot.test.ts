import { describe, expect, it } from 'bun:test';

import { Effect, Option, Result } from 'effect';
import { revalidateOrLoad, settle, succeed } from 'foldkit/asyncData';

import { compileChecked, decodePlot, marksFor, addMarks } from '../src/effect/plot.js';
import { compilePlot } from '../src/plot/index.js';
import type { PlotSpec } from '../src/plot/index.js';

const frame = { width: 400, height: 260 };
const data = [
  { minute: 0, latency: 3 },
  { minute: 1, latency: 7 },
];
const marks = marksFor<(typeof data)[number]>();

describe('Effect plot', () => {
  it('rejects malformed shapes and mark options with a path', () => {
    const decodeIssue = (mark: null | Readonly<Record<string, string | number>>) =>
      Result.flip(decodePlot({ ...frame, marks: [mark] })).pipe(Result.getOrThrow);
    expect(decodeIssue(null)).toMatchObject({ code: 'InvalidSpec', path: 'marks[0]' });
    expect(decodeIssue({ mark: 'dot', x: 'minute' })).toMatchObject({
      code: 'InvalidSpec',
      path: 'marks[0].y',
    });
    expect(decodeIssue({ mark: 'dot', x: 'minute', y: 'latency', bandwidth: 2 })).toMatchObject({
      code: 'InvalidSpec',
      path: 'marks[0].bandwidth',
    });
  });

  it('retains the missing field path when lifted into an Effect', () => {
    const parsed = Result.getOrThrow(
      decodePlot({
        ...frame,
        data,
        marks: [{ mark: 'line', x: 'minute', y: 'duration' }],
      }),
    );
    const result = compileChecked(parsed);
    const effect = Effect.fromResult(result);
    const failure = Effect.flip(effect);
    const issue = Effect.runSync(failure);
    expect(issue).toMatchObject({ code: 'MissingField', path: 'marks[0].y', field: 'duration' });
  });

  it('composes a reusable series and rule with the same order and geometry as wire input', () => {
    const base = { ...frame, data, marks: [] } satisfies PlotSpec;
    const line = marks.line({ x: 'minute', y: 'latency' });
    const rule = marks.ruleY(5);
    const composed = addMarks(line, rule)(base);
    const wire = Result.getOrThrow(decodePlot(JSON.parse(JSON.stringify(composed))));
    expect(composed.marks.map((mark) => mark.mark)).toEqual(['line', 'rule']);
    expect(addMarks(rule)(addMarks(line)(base))).toEqual(composed);
    expect(Result.getOrThrow(compileChecked(wire))).toEqual(compilePlot(composed));
  });

  it('accepts wire arrays and rejects in-memory typed columns at the decoding boundary', () => {
    const spec = { ...frame, marks: [marks.dot({ x: 'minute', y: 'latency' })] };
    expect(
      Result.isSuccess(
        decodePlot({
          ...spec,
          data: { length: 1, columns: { minute: [0], latency: [3] } },
        }),
      ),
    ).toBe(true);
    expect(
      Result.isFailure(
        decodePlot({
          ...spec,
          data: { length: 1, columns: { minute: Float64Array.of(0), latency: [3] } },
        }),
      ),
    ).toBe(true);
  });

  it('reports invalid tick counts as chart input errors', () => {
    const plot = {
      ...frame,
      data,
      x: { ticks: 1 },
      marks: [marks.line({ x: 'minute', y: 'latency' })],
    };
    expect(Result.getOrThrow(Result.flip(compileChecked(plot)))).toMatchObject({
      code: 'InvalidPlot',
      path: 'x.ticks',
    });
  });

  it('keeps the last drawn chart when a refresh has an invalid field', () => {
    const previous = compilePlot({
      ...frame,
      data,
      marks: [marks.line({ x: 'minute', y: 'latency' })],
    });
    const refreshing = Option.getOrThrow(revalidateOrLoad(succeed(previous)));
    const fetched = decodePlot({
      ...frame,
      data,
      marks: [{ mark: 'line', x: 'minute', y: 'duration' }],
    });
    const failure = Result.flatMap(fetched, compileChecked);
    const chart = settle(refreshing, failure);
    expect(chart).toMatchObject({
      _tag: 'Stale',
      data: previous,
      error: { code: 'MissingField', path: 'marks[0].y' },
    });
  });

  // @ts-expect-error The domain row has no field named latncy.
  marks.line({ x: 'minute', y: 'latncy' });
});
