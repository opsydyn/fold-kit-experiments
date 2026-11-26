import type { Column, ColumnTable, PlotData, Row, Value } from './types.js';

/**
 * Column tables: data as named columns of equal length, as Polars, DuckDB and
 * Arrow hold it. The grammar reads a channel's column directly, and builds row
 * objects only for the paths that need them (see rowsOf).
 *
 * A table is immutable, as rows are: what is derived from it (row objects,
 * plain copies of typed columns) is kept per table. To plot changed data, make a
 * new table; `columnTable` wraps existing arrays without copying them.
 */

const fail = (message: string): never => {
  throw new RangeError(message);
};

/** A mark's data inside the compiler: row objects or a column table. */
export type Rows = PlotData;

export const isColumnTable = (data: unknown): data is ColumnTable =>
  typeof data === 'object' &&
  data !== null &&
  !Array.isArray(data) &&
  'columns' in data &&
  'length' in data;

/** A column table from named columns, which must all have the same length. */
export function columnTable(columns: Readonly<Record<string, Column>>): ColumnTable {
  const entries = Object.entries(columns);
  const [first] = entries;
  for (const [name, column] of entries)
    if (first !== undefined && column.length !== first[1].length)
      fail(`column "${name}" has ${column.length} values; "${first[0]}" has ${first[1].length}`);
  return { length: first?.[1].length ?? 0, columns };
}

const materialised = new WeakMap<ColumnTable, ReadonlyArray<Row>>();

/**
 * Data as row objects. A column table builds them once and keeps them, for the
 * paths that work on rows: facets, transforms, keys and titles, the marks that
 * read whole records, and apps that look a row up.
 */
export function rowsOf(rows: PlotData): ReadonlyArray<Row> {
  if (!isColumnTable(rows)) return rows;
  const kept = materialised.get(rows);
  if (kept !== undefined) return kept;
  const names = Object.keys(rows.columns);
  const columns = names.map((name) => rows.columns[name]);
  const built: ReadonlyArray<Row> = Array.from({ length: rows.length }, (_, i) =>
    Object.fromEntries(names.map((name, c) => [name, columns[c]?.[i] ?? null])),
  );
  materialised.set(rows, built);
  return built;
}

const plain = new WeakMap<ColumnTable, Map<string, ReadonlyArray<Value>>>();

/**
 * A typed column as a plain array, copied by loop (Array.from is several times
 * slower) and kept for the table, so one compile copies each column once.
 */
function plainOf(table: ColumnTable, field: string, column: Column): ReadonlyArray<Value> {
  if (Array.isArray(column)) return column;
  const copies = plain.get(table) ?? new Map<string, ReadonlyArray<Value>>();
  plain.set(table, copies);
  const kept = copies.get(field);
  if (kept !== undefined) return kept;
  const copy = new Array<Value>(column.length);
  for (let i = 0; i < column.length; i += 1) copy[i] = column[i] ?? null;
  copies.set(field, copy);
  return copy;
}

/**
 * A field's values for every row, or undefined when the data has rows and none
 * of them has the field. A typed column is copied into a plain array once.
 */
export function columnOf(rows: Rows, field: string): ReadonlyArray<Value> | undefined {
  if (isColumnTable(rows)) {
    const column = rows.columns[field];
    if (column === undefined) return rows.length > 0 ? undefined : [];
    return plainOf(rows, field, column);
  }
  if (rows.length > 0 && !rows.some((row) => Object.hasOwn(row, field))) return undefined;
  return rows.map((row) => row[field] ?? null);
}

/** One value per row. */
export const fillRows = <A>(rows: Rows, value: A): ReadonlyArray<A> =>
  Array.from({ length: rows.length }, () => value);

// ── Arrow ─────────────────────────────────────────────────────────────────────

/**
 * An Arrow table as flechette and apache-arrow present one, typed structurally
 * so foldkit-viz depends on neither.
 */
export interface ArrowTable {
  readonly numRows: number;
  readonly schema: { readonly fields: ReadonlyArray<{ readonly name: string }> };
  getChild(name: string): {
    toArray(): ArrayLike<unknown>;
    readonly nullCount?: number;
    [Symbol.iterator]?(): Iterator<unknown>;
  } | null;
}

const FLOAT_ARRAYS = [Float64Array, Float32Array, Int32Array, Int16Array, Int8Array] as const;
const UNSIGNED_ARRAYS = [Uint32Array, Uint16Array, Uint8Array, Uint8ClampedArray] as const;

const isNumericArray = (values: ArrayLike<unknown>): values is Column =>
  [...FLOAT_ARRAYS, ...UNSIGNED_ARRAYS].some((kind) => values instanceof kind);

/** A JSON value, as a spec holds: a number, string, boolean or null. */
const isValue = (value: unknown): value is Value =>
  value === null ||
  typeof value === 'number' ||
  typeof value === 'string' ||
  typeof value === 'boolean';
const isBigInt = (value: unknown): value is bigint => typeof value === 'bigint';

export type ColumnConversionOptions = Readonly<{
  /** Preserve BigInt values in these fields as decimal strings, including across chunks. */
  bigIntAsText?: ReadonlyArray<string>;
}>;

function numberFromBigInt(value: bigint, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    return fail(
      `column "${field}" contains a BigInt outside the safe number range. Use bigIntAsText for exact values.`,
    );
  return number;
}

/** Values as JSON values, with exactness checked before coercing a BigInt. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Arrow and DuckDB supply untyped values to this boundary parser.
const valueOf = (value: unknown, field: string, asText: boolean): Value => {
  if (isValue(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (isBigInt(value)) return asText ? String(value) : numberFromBigInt(value, field);
  return value === undefined ? null : String(value);
};

/** A column table over an Arrow table's columns, typed arrays kept as they are. */
export function fromArrow(table: ArrowTable, options: ColumnConversionOptions = {}): ColumnTable {
  const columns = Object.fromEntries(
    table.schema.fields.map(({ name }) => {
      const asText = options.bigIntAsText?.includes(name) ?? false;
      const vector = table.getChild(name);
      const iterate = vector?.[Symbol.iterator];
      if (vector !== null && (vector.nullCount ?? 0) > 0 && iterate !== undefined) {
        // Arrow numeric buffers do not encode validity. Iteration reads the bitmap.
        return [
          name,
          Array.from({ [Symbol.iterator]: iterate.bind(vector) }, (value) =>
            valueOf(value, name, asText),
          ),
        ];
      }
      const values = vector?.toArray() ?? [];
      if (isNumericArray(values)) return [name, values];
      if (!asText && (values instanceof BigInt64Array || values instanceof BigUint64Array))
        return [name, Float64Array.from(values, (value) => numberFromBigInt(value, name))];
      return [name, Array.from(values, (value) => valueOf(value, name, asText))];
    }),
  );
  return { length: table.numRows, columns };
}

// ── DuckDB ────────────────────────────────────────────────────────────────────

/**
 * A DuckDB result read into memory, as @duckdb/node-api's DuckDBResultReader
 * presents one (from runAndReadAll), typed structurally so foldkit-viz does not
 * depend on DuckDB.
 */
export interface DuckDBReader {
  columnNames(): ReadonlyArray<string>;
  getColumnsJS(): ReadonlyArray<ReadonlyArray<unknown>>;
}

/** A value DuckDB's JS conversion gives for a numeric, temporal or 64-bit column. */
const isNumberLike = (value: unknown): value is number | bigint | Date | null =>
  value === null || typeof value === 'number' || isBigInt(value) || value instanceof Date;

/** A numeric column as a Float64Array: nulls become NaN, dates epoch milliseconds. */
function numericColumn(
  values: ReadonlyArray<number | bigint | Date | null>,
  field: string,
): Float64Array {
  const column = new Float64Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] ?? null;
    column[i] =
      value === null
        ? Number.NaN
        : value instanceof Date
          ? value.getTime()
          : isBigInt(value)
            ? numberFromBigInt(value, field)
            : value;
  }
  return column;
}

const isNumberLikeColumn = (
  values: ReadonlyArray<unknown>,
): values is ReadonlyArray<number | bigint | Date | null> =>
  values.some((value) => value !== null) && values.every(isNumberLike);

/**
 * A column table from DuckDB columns already converted to JS values: a whole
 * result's `reader.getColumnsJS()`, or one streamed chunk's
 * `chunk.convertColumns(JSDuckDBValueConverter)`. Numeric, temporal and
 * safe numeric BigInt columns become Float64Arrays. Nulls are NaN and dates are
 * epoch milliseconds in numeric columns. Use `bigIntAsText` for exact BigInts.
 */
export function duckdbColumns(
  names: ReadonlyArray<string>,
  columns: ReadonlyArray<ReadonlyArray<unknown>>,
  options: ColumnConversionOptions = {},
): ColumnTable {
  if (names.length !== columns.length)
    fail(
      `${names.length} column name${names.length === 1 ? '' : 's'} for ${columns.length} columns`,
    );
  return columnTable(
    Object.fromEntries(
      names.map((name, i) => {
        const values = columns[i] ?? [];
        const asText = options.bigIntAsText?.includes(name) ?? false;
        if (!asText && isNumberLikeColumn(values)) return [name, numericColumn(values, name)];
        return [name, values.map((value) => valueOf(value, name, asText))];
      }),
    ),
  );
}

/** A column table over a DuckDB result read into memory, such as `await connection.runAndReadAll(sql)`. */
export const fromDuckDB = (reader: DuckDBReader, options?: ColumnConversionOptions): ColumnTable =>
  duckdbColumns(reader.columnNames(), reader.getColumnsJS(), options);
