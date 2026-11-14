# Can foldkit-viz plot data that lives in Polars? — assessment

**Status:** assessment, 2026-11-14. Feeds the "Arrow and DuckDB column input"
item under Later on the
[data-science release track](../../roadmap.md#viz-data-science-release-track--2026-11-13).

## Answer

Yes, today, on the server. Polars runs in Bun through `nodejs-polars`, and its
output plots through `compilePlot` with no library changes. Two library changes
would make it fast at scale:

- a columnar data input, so Arrow or Polars columns reach the compiler without
  becoming a million row objects;
- a published JSON Schema for plot specs, so Rust and Python programs using
  Polars can emit specs that are checked before they reach a browser.

Polars in the browser is not ready to build on.

## Where Polars runs

| Runtime         | Package                             | State                                                        |
| --------------- | ----------------------------------- | ------------------------------------------------------------ |
| Rust            | `polars` crate                      | The engine itself.                                           |
| Python          | `polars`                            | Mature; Arrow out without copying.                           |
| Bun, Node, Deno | `nodejs-polars` 0.24.1 (March 2026) | Server side only; native binary per platform; Bun supported. |
| Browser         | `@pola-rs/browser` 0.0.1-alpha      | Experimental: large WASM binary, must run in a worker.       |

DuckDB-Wasm is the mature choice for querying in the browser, and it speaks
Arrow too.

## What the spike measured

Bun 1.4 on an Apple-silicon Mac, one million rows of latency and payload (the
`/explore` data's shape), `nodejs-polars` 0.24.1 and `@uwdata/flechette` 2.8 for
Arrow.

| Path                   | Step                                                               | Time   |
| ---------------------- | ------------------------------------------------------------------ | ------ |
| 1. Rows                | `df.toRecords()`, a million row objects across the native boundary | 246 ms |
|                        | `compilePlot`, dense scatter from those rows                       | 138 ms |
|                        | `compilePlot`, our bin transform, histogram                        | 43 ms  |
| 2. Aggregate in Polars | `group_by` histogram (35 bins)                                     | 14 ms  |
|                        | `compilePlot` from the 35-row summary                              | 0.6 ms |
| 3. Arrow IPC           | `df.writeIPC()` (16 MB)                                            | 7.8 ms |
|                        | `tableFromIPC` and the columns as `Float64Array`                   | 0.8 ms |
| 4. Columns to rows     | Row objects built from the Arrow columns                           | 6 ms   |
|                        | `compilePlot`, dense scatter from those rows                       | 127 ms |

What it shows:

- **Arrow is the boundary.** Arrow IPC beats `toRecords()` by about 15 times
  getting a million rows out of Polars (9 ms against 246 ms), and it gives typed
  columns.
- **Aggregation belongs in Polars.** A histogram summarised in Polars and
  plotted from 35 rows takes 15 ms in all, and sends 35 rows to a browser
  instead of a million.
- **The grammar's row objects are now the cost.** Once the data is in columns,
  the compiler's own per-row reads dominate a dense scatter (127 ms). The
  compiler reads every channel through one function, `read(rows, channel)`, so a
  columnar source can plug in there. The saving from reading typed columns
  directly is estimated, not yet measured.

## Ways to put them together

1. **Polars on the server, specs to the page.** A Bun or Astro endpoint queries
   Polars, aggregates where it can, and compiles a spec on the server, so the
   page ships rendered SVG or packed points. This works now.
2. **Arrow to the browser.** The server sends Arrow IPC. The page reads it with
   flechette (a 16 MB IPC for a million rows of two columns parses in about a
   millisecond) and compiles there, so hover and zoom stay local, as on
   `/explore`. This needs the columnar input to stay fast.
3. **Rust or Python emits specs.** Plot specs are JSON, so a Rust service using
   `polars` and `serde`, or a Python notebook, can write them. This needs a JSON
   Schema to be safe, and is the base the planned Jupyter widget needs.
4. **Polars in the browser.** Not yet: the WASM build is an alpha.

## Recommended work

1. **Columnar data input.**
   - `data` accepts a column table as well as rows: column names to typed
     arrays or plain arrays, plus a length.
   - `read` gets a column path. Dense marks read typed columns directly.
   - Transforms that write new rows keep doing so; their outputs are small.
   - A small structural adapter takes an Arrow table (flechette or apache-arrow,
     both `getChild(name).toArray()` and `numRows`) without depending on either
     library.
2. **JSON Schema for `PlotSpec`.**
   - Generate it from the types, and publish it with the package.
   - Test that every example spec in the repo validates against it.
3. **An example of the summary pattern.**
   - A server route that aggregates a large Polars frame and plots the result,
     beside `/explore`'s client-side million points.
   - It shows when to push work to the data engine.

Not recommended now:

- **Translating our transforms into Polars queries automatically.** This would
  make bin, stack and density run in the engine, as VegaFusion does for Vega
  with DataFusion. It is worth revisiting once the columnar input exists.
- **Any dependency on Polars or Arrow inside foldkit-viz.**

## Sources

- [nodejs-polars on npm](https://npmjs.com/package/nodejs-polars) and its
  [documentation](https://pola-rs.github.io/nodejs-polars)
- [js-polars, the WASM bindings](https://github.com/pola-rs/js-polars) and
  [`@pola-rs/browser`](https://www.npmjs.com/package/@pola-rs/browser)
- [Polars and Arrow](https://docs.pola.rs/user-guide/misc/arrow/)
- [Flechette](https://idl.uw.edu/flechette/)
- [DuckDB-Wasm](https://duckdb.org/docs/1.4/clients/wasm/overview)
