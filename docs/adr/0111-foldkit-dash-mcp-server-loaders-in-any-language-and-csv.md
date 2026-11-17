# ADR 0111: A foldkit-dash MCP server, loaders in any language, CSV, and per-series summaries

## Status

**Accepted**, 2026-11-17, for stage 3 of
[ADR 0109](0109-build-agent-first-static-dashboards-with-foldkit-dash.md), after stage 2
([ADR 0110](0110-interactive-foldkit-dash-pages-from-input-fences.md)).

## Context

Stage 3 was planned as "an MCP server over `check`, `describe` and a per-chart
`preview`; loaders in other languages by extension, CSV and Parquet data, DuckDB and
Polars summaries". The acceptance runs added two needs: `describe` gives one range per
axis, so an agent cannot confirm a claim about one series ("Scotland's low is in
August") from it; and it describes charts only at their inputs' defaults.

## Decision

1. **`describe` says what each series does, at any input values.** For a chart whose
   first mark draws series (`line`, `area` or `dot` with a `stroke`, `fill` or `z`
   field), `describe` adds a line per series: how many points, its lowest and highest
   value and the `x` where each falls. `--at name=value` (repeatable) describes charts
   with those inputs set instead of their defaults (`all` for a select's `all`). The
   envelope's charts gain `series`.
2. **`foldkit-dash mcp` is an MCP server over stdio**, for agents that call tools rather
   than run commands. Its tools take a project folder and answer with the same envelope
   as `--json`: `dash_check`, `dash_describe` (with `at`), `dash_build`, `dash_new`, and
   `dash_preview`, one chart as a standalone SVG at any input values, with its summary
   and series. It is the repository's `foldkit-dash` entry in `.mcp.json`.
3. **Loaders by extension.** `data/<name>.<ext>` runs with the program its extension
   names: `.ts` and `.js` with Bun, `.py` with `python3`, `.sh` with `sh`, `.R` with
   `Rscript`. Two loaders for one name are a problem, not a guess; a missing interpreter
   is a `loader` problem that names it.
4. **CSV and TSV data.** A name ending `.csv` or `.tsv` (a file, or a loader's output) is
   read as a header row and records: RFC 4180 quoting, and each value typed as d3-dsv's
   `autoType` types it (empty → `null`, `true`/`false`, numbers), except that dates stay
   ISO strings, which the plot grammar reads as time. Other extensions are JSON.
5. **Parquet, DuckDB and Polars stay in loaders.** foldkit-dash takes no database
   dependency: a loader queries Parquet with DuckDB or Polars (in Python, Bun or the
   DuckDB CLI) and prints the summary rows. The skill gives recipes; the ones run while
   writing this are marked as such.

## Consequences

- An agent can check a claim about one series, or about any choice, without a script
  or a browser; `check` still varies one input at a time, so `--at` is how to look at a
  combination.
- A project can mix languages, and needs their interpreters wherever it builds.
- The MCP server is a thin layer over the same pass `check` and `describe` run, so the
  two cannot disagree.
- CSV has no types: a column of codes such as `007` reads as the number 7, as in d3.
  Quote nothing differently; use JSON from a loader when that matters.

## Not in stage 3

Built-in Parquet reading, a database connection in the tool, Arrow output from loaders,
and loaders that stream. The open items of stage 2 (clicking a chart to filter others,
inputs in the URL) stay open.
