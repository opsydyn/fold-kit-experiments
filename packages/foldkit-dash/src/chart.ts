/**
 * One chart from its spec: inputs filled in, rows chosen by `where`, then compiled by
 * foldkit-viz. Pure and browser-safe, so the build and the page's script draw a chart
 * the same way.
 * @module Chart
 */
import { compilePlot, type PlotGeometry, type PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Result, Schema } from 'effect';

import { filterRows, type Values, withValues } from './inputs';
import { type Json, type JsonObject, Rows } from './rows';

/** Why a chart did not draw: its data, or its spec (with the path at fault when known). */
export type ChartProblem = {
  readonly kind: 'data' | 'spec';
  readonly path: string | null;
  readonly message: string;
};

/** A chart drawn: its spec as compiled, and its geometry. */
export type Drawn = { readonly plot: PlotSpec; readonly geometry: PlotGeometry };

/** The spec path at the start of a `compilePlot` message, such as `marks[0].y`. */
export const specPathOf = (message: string): string | null =>
  /^((?:[A-Za-z_$][\w$]*|\[\d+\])(?:\.[A-Za-z_$][\w$]*|\[\d+\])*):\s/.exec(message)?.[1] ?? null;

const problem = (kind: ChartProblem['kind'], message: string): ChartProblem => ({
  kind,
  path: kind === 'spec' ? specPathOf(message) : null,
  message,
});

const isText = Schema.is(Schema.String);
const decodeRows = Schema.decodeUnknownResult(Rows);

/** The rows a spec plots: its named data, or rows written in the spec. */
const rowsOf = (
  spec: JsonObject,
  data: ReadonlyMap<string, Rows>,
): Result.Result<Rows, ChartProblem> => {
  const named = spec['data'] ?? [];
  if (isText(named)) {
    const rows = data.get(named);
    return rows === undefined
      ? Result.fail(problem('data', `no data named "${named}"`))
      : Result.succeed(rows);
  }
  return Result.mapError(decodeRows(named), (error) =>
    problem('data', `data: inline rows must be objects of plain values: ${error.message}`),
  );
};

/** `where`, written for messages. */
const whereText = (where: Json): string => JSON.stringify(where);

/**
 * Draws a spec at `values`: references filled in, rows kept by `where` (an error when it
 * keeps none), and compiled. `data` holds the rows of every name the spec may use.
 */
export const drawSpec = (
  spec: JsonObject,
  data: ReadonlyMap<string, Rows>,
  values: Values,
): Result.Result<Drawn, ChartProblem> => {
  const filled = withValues(spec, values);
  // SAFETY: filling in values maps an object to an object of the same keys.
  const resolved = filled as JsonObject;
  return Result.flatMap(rowsOf(resolved, data), (rows) => {
    const where = resolved['where'] ?? null;
    const kept = filterRows(rows, where);
    if (Result.isFailure(kept)) return Result.fail(problem('spec', kept.failure));
    if (kept.success.length === 0 && rows.length > 0) {
      return Result.fail(problem('data', `where ${whereText(where)} keeps no rows`));
    }
    const { where: _, ...rest } = resolved;
    return Result.try({
      try: () => {
        const spec: JsonObject = { ...rest, data: kept.success };
        // SAFETY: compilePlot validates the whole spec and throws a RangeError naming the
        // path at fault, which becomes a `spec` problem; nothing reads it unchecked.
        const plot = spec as PlotSpec;
        return { plot, geometry: compilePlot(plot) };
      },
      catch: (error) => problem('spec', error instanceof Error ? error.message : String(error)),
    });
  });
};
