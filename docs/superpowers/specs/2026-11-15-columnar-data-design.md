# Columnar data for the plot grammar — design

**Status:** design for the first two items of the roadmap's "Viz: Polars and Arrow
data". Follows the [Polars assessment](2026-11-14-polars-assessment.md).

## Problem

`compilePlot` takes `data` as row objects. Data held in Polars, DuckDB or any
Arrow source is columnar, so plotting it means first building one object per row:
246 ms for a million rows from Arrow in the spike, against 9 ms to reach
JavaScript as Arrow. The grammar then reads each channel back out of those rows
(`rows.map((row) => row[field])`), which is the rest of the cost.

## Decision

`data`, on the plot or on a mark, also accepts a **column table**:

```ts
type Column = ReadonlyArray<Value> | Float64Array | Float32Array | Int32Array | …;
type ColumnTable = Readonly<{ length: number; columns: Readonly<Record<string, Column>> }>;
```

- `columnTable(columns)` builds one and checks every column has the same length.
- `fromArrow(table)` adapts an Arrow table structurally (`numRows`,
  `schema.fields`, `getChild(name).toArray()`), so flechette and apache-arrow
  tables plot without foldkit-viz depending on either. 64-bit integers become
  numbers, and dates become epoch milliseconds, as specs hold JSON values only.
- The table stays plain data, so a spec with columns of plain arrays is still JSON.

Inside `compilePlot`, a mark's rows become a `Rows` value: row objects, or the
column table. The channel readers (`read`, colour, size, highlight) read a column
directly. Everything else that needs row objects (facet filtering, transforms,
keys and titles, the network, geo and statistical marks, `plotTable`) asks
`rowsOf`, which builds them once per table and keeps them.

So a **dense dot mark over a column table never builds a row**: its positions,
colours, sizes and highlight come from the columns. Other marks give the same
geometry from columns as from rows, at roughly the cost of rows today.

`highlightPoints(geometry, mark, data, highlight)` takes either form, and reads
only the highlight's field.

## Equivalence

The contract is that a column table and the same data as rows compile to equal
geometry, for every mark, facet and transform. The tests check this directly
(including random tables), and check that a missing field fails with the same
message either way.

## Not in this slice

- Facets and transforms over columns without materialising: they build rows once.
- A JSON Schema for `PlotSpec`, the summary-route example, and translating
  transforms into engine queries: later items on the roadmap.

## Tables are immutable

What the compiler derives from a table (row objects, plain copies of typed
columns) is kept per table object, as rows are compared by identity elsewhere.
To plot changed data, make a new table: `columnTable` wraps existing arrays
without copying them, so a streaming buffer costs nothing to re-wrap.

`rowsOf(data)` is exported for apps that look a row up, such as the plot
panel's inspection; it returns rows unchanged and builds them once for a table.

## Results

The exit measure, on a 2024 laptop: a million-row Polars frame (`nodejs-polars`
0.24, flechette 2.8) drawn as a dense scatter on a log x axis, best of three.

| Path                                                | Out of Polars | Compile | Total  |
| --------------------------------------------------- | ------------- | ------- | ------ |
| Rows: `df.toRecords()`                              | 139 ms        | 109 ms  | 248 ms |
| Columns: `writeIPC` and flechette, then `fromArrow` | 2 ms          | 84 ms   | 86 ms  |

From plain typed arrays the same scatter compiles in 58 ms from a fresh column
table against 71–93 ms from rows. Building the row objects themselves is cheap
in Bun (5 ms); the cost was Polars' and Arrow's own row conversion and the
compiler's per-row reads.

Found while building it:

- `Array.from(typedArray)` takes 8 ms per million values, against 0.6 ms for a
  loop into a sized array, so typed columns are copied by loop, once per table.
- A dense mark over a column table builds no rows: a test watches the table's
  column list, which building rows must enumerate.

The test suite checks equivalence (`test/plot-columns.test.ts`, including random
dense tables) and a time budget for a million-row column table
(`test/performance.test.ts`).
