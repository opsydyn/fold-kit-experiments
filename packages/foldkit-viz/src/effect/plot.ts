import {
  Data,
  JsonSchema,
  Predicate,
  Result,
  Schema,
  SchemaIssue,
  SchemaRepresentation,
} from 'effect';

import jsonSchema from '../../schema/plot-spec.schema.json' with { type: 'json' };
import { PlotCompileError } from '../plot/channels.js';
import { compilePlot } from '../plot/compile.js';
import type {
  DotMark,
  LineMark,
  MarkSpec,
  PlotGeometry,
  PlotSpec,
  Row,
  RuleMark,
  Value,
} from '../plot/types.js';

type WireData =
  | ReadonlyArray<Row>
  | Readonly<{
      length: number;
      columns: Readonly<Record<string, ReadonlyArray<Value>>>;
    }>;
type WireMark<M extends MarkSpec> = M extends MarkSpec
  ? Omit<M, 'data'> & Readonly<{ data?: WireData }>
  : never;

/** The portable form of PlotSpec. Numeric buffers belong to the in-memory spec. */
export type WirePlotSpec = Omit<PlotSpec, 'data' | 'marks'> &
  Readonly<{
    data?: WireData;
    marks: ReadonlyArray<WireMark<MarkSpec>>;
  }>;

export class PlotIssue extends Data.TaggedError('PlotIssue')<{
  readonly code: 'InvalidSpec' | 'InvalidPlot' | 'MissingField';
  readonly path: string | null;
  readonly message: string;
  readonly field?: string;
}> {}

const imported = SchemaRepresentation.fromJsonSchemaDocument(
  JsonSchema.fromSchemaDraft07(jsonSchema),
);
// The imported schema is generated from PlotSpec, with columns represented as JSON arrays.
export const PlotSpecSchema = Schema.make<Schema.Codec<WirePlotSpec>>(imported.ast);
const decode = Schema.decodeUnknownResult(PlotSpecSchema, { onExcessProperty: 'error' });
const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1();

const formatPath = (path: ReadonlyArray<PropertyKey>): string | null =>
  path.reduce<string>(
    (prefix, key) =>
      Predicate.isNumber(key) ? `${prefix}[${key}]` : `${prefix}${prefix ? '.' : ''}${String(key)}`,
    '',
  ) || null;

/** Decode an unknown JSON value before checking it against the plot data. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Callers pass untrusted JSON directly to the runtime codec.
export const decodePlot = (input: unknown): Result.Result<WirePlotSpec, PlotIssue> =>
  Result.mapError(decode(input), (error) => {
    const first = formatIssue(error.issue).issues[0];
    const path = formatPath(
      first?.path
        ?.map((part) => (Predicate.isObject(part) ? part.key : part))
        .filter(Predicate.isPropertyKey) ?? [],
    );
    const detail = first?.message ?? error.message;
    return new PlotIssue({
      code: 'InvalidSpec',
      path,
      message: path === null ? detail : `${path}: ${detail}`,
    });
  });

/** Compile trusted or decoded input. Unexpected exceptions propagate as defects. */
export const compileChecked = (spec: PlotSpec): Result.Result<PlotGeometry, PlotIssue> =>
  Result.try({
    try: () => compilePlot(spec),
    catch: (cause) => {
      if (!(cause instanceof PlotCompileError)) throw cause;
      const { path, message, field } = cause;
      if (field === undefined) return new PlotIssue({ code: 'InvalidPlot', path, message });
      return new PlotIssue({ code: 'MissingField', path, message, field });
    },
  });

type Field<T> = Extract<keyof T, string>;
type Channel<T> = Field<T> | Readonly<{ value: Value }>;

type DotOptions<T> = Omit<
  DotMark,
  'mark' | 'x' | 'y' | 'r' | 'fill' | 'stroke' | 'title' | 'symbol' | 'key'
> &
  Readonly<{
    x: Channel<T>;
    y: Channel<T>;
    r?: Channel<T>;
    fill?: Channel<T>;
    stroke?: Channel<T>;
    title?: Channel<T>;
    symbol?: Channel<T>;
    key?: Field<T>;
  }>;

type LineOptions<T> = Omit<LineMark, 'mark' | 'x' | 'y' | 'stroke' | 'title' | 'z' | 'key'> &
  Readonly<{
    x: Channel<T>;
    y: Channel<T>;
    stroke?: Channel<T>;
    title?: Channel<T>;
    z?: Field<T>;
    key?: Field<T>;
  }>;

/** Constructors for reusable marks whose field names come from a domain row. */
export const marksFor = <T>() => ({
  dot: (options: DotOptions<T>): DotMark => ({ ...options, mark: 'dot' }),
  line: (options: LineOptions<T>): LineMark => ({ ...options, mark: 'line' }),
  ruleY: (value: Value): RuleMark => ({ mark: 'rule', y: { value } }),
});

/** Add marks in drawing order, retaining the plot's data, scales and dimensions. */
export const addMarks =
  (...marks: ReadonlyArray<MarkSpec>) =>
  (spec: PlotSpec): PlotSpec =>
    marks.length === 0 ? spec : { ...spec, marks: [...spec.marks, ...marks] };
