---
name: foldkit-dash
description: Use when building or changing a data dashboard with @opsydyn/foldkit-dash, Markdown pages whose ```plot fences hold foldkit-viz plot specs as JSON, fed by build-time data loaders, with ```input fences (select, radio, range, checkbox) that filter and change charts, charts a reader clicks to choose an input, page addresses that keep the inputs, built to static HTML that only ships JavaScript where a page has inputs. Covers starting a project, writing pages, specs, inputs and loaders (TypeScript, JavaScript, Python, shell or R; JSON, CSV or TSV; Parquet through DuckDB or Polars), filtering with where, the check, describe (per series, bars ranked, at any input values), build and dev loop, and the same commands as MCP tools.
---

# foldkit-dash

A dashboard is a folder: Markdown pages in `pages/`, data in `data/`. Each
```` ```plot ```` fence in a page holds one JSON plot spec (foldkit-viz's grammar of
marks); `foldkit-dash build` turns every page into static HTML with each chart drawn
as accessible SVG, with a summary and its data table. A page with an
```` ```input ```` fence also gets a small script, so readers can choose a region, a
measure or a range and see its charts change; a page without one ships no JavaScript.

You write Markdown and JSON, never chart code, and you verify your work in text:
`check` names every problem by file, line and spec path, and `describe` says what
each chart shows. Do not open a browser to find out whether a chart is right.

Requires Bun 1.4 or newer. `@opsydyn/foldkit-dash@0.1.0` is private to its repository
([ADR 0109](../../docs/adr/0109-build-agent-first-static-dashboards-with-foldkit-dash.md),
inputs and `dev` in [ADR 0110](../../docs/adr/0110-interactive-foldkit-dash-pages-from-input-fences.md),
the MCP server, loaders by extension and CSV in [ADR 0111](../../docs/adr/0111-foldkit-dash-mcp-server-loaders-in-any-language-and-csv.md));
in the repository, run it as `bun packages/foldkit-dash/src/bin.ts` instead of
`bunx foldkit-dash`.

## Start

```sh
bunx foldkit-dash new my-dashboard   # a page, a loader, AGENTS.md, plot-spec.schema.json
cd my-dashboard
bunx foldkit-dash check
```

`new` refuses a folder that is not empty. Replace its example page and loader with
your own; delete what you do not use.

## The loop

1. Write or change a page or a loader.
2. `bunx foldkit-dash check --json`. Fix every problem; exit 0 means none.
3. `bunx foldkit-dash describe`. Read what each chart shows and compare it with what
   the page says about it: the right number of series, the fields on each axis, the
   categories in the order you claim, the ranges you expect. A chart can compile and
   still show the wrong thing. Check the numbers in your prose against the data too:
   `describe` rounds (see [marks and scales](references/marks.md#what-describe-says)).
   Under a line, area, dot or bar chart it lists each series: its points, its low and
   high, and every `x` each is reached at (`- Wales: 26 points, low 259 at 2026-07-27
   and 2026-08-03, high 369 at 2026-10-12`), exact, so check claims about one series
   there; a low reached in two weeks names both. For bars, that is which category is
   highest and which lowest (`- revenue: 5 points, low 200560.5 at Scotland, high 509206.5
   at South East`), then every bar, highest first, up to 24 bars (`highest first: South
   East 509206.5, London 400000, ...`): check a ranking there. To claim a ranking or a
   total, chart it (a bar per category from a totals loader), so `describe` can confirm
   it. A chart drawing one series (no `stroke`, `fill` or `z` field) names it by its
   field and the `where` that chose its rows (`orders where region = Scotland`), so a
   page filtered to the wrong part shows it; a chart with a `stroke` field names each
   series by its value (`Scotland`), filtered or not. Series follow `color.domain` when the
   spec sets one. `describe` does not say what happens between the low and the high:
   for "dips in July, then climbs", look at the data. `describe --at region=North` (repeatable) describes charts with inputs set
   instead of their defaults.
4. `bunx foldkit-dash build`. Writes `dist/`, replacing what an earlier build wrote.

For a person watching, `bunx foldkit-dash dev` serves the site (on
`http://127.0.0.1:4400/`, `--port` to change), rebuilds when `pages/` or `data/` change,
reloads open pages, and prints problems as `check` does. An agent does not need it: the
loop above is the check.

Exit codes: 0 done, 1 problems found (a build still writes its pages, each problem
shown where its chart would be), 2 the command could not run (no `pages/` folder, a
bad flag, `new` into a folder in use, `--out` outside the project, a port in use, an
`--at` input no page has).

`--json` answers with a `foldkit-dash/v1` envelope on stdout:

```json
{
  "protocol": "foldkit-dash/v1",
  "command": "check",
  "status": "problems",
  "pages": ["pages/index.md"],
  "charts": [],
  "inputs": [],
  "problems": [
    {
      "kind": "spec",
      "file": "pages/index.md",
      "line": 6,
      "path": "marks[0].y",
      "message": "marks[0].y: field \"revenue\" is missing from the data"
    }
  ],
  "written": []
}
```

`kind` is `json` (the fence is not one JSON object), `spec` (the plot grammar refused
it; `path` says where), `data` (no such file or loader, or a `where` that keeps no
rows), `loader` (it failed or ran past `--loader-timeout`, 60 s by default), `rows`
(the data is not an array of objects of plain values) or `input` (an input fence is
wrong, or a spec refers to no input). `line` is the fence's opening line. A problem that
only some choices of an input cause says which: `with region = "West": ...`.

`charts` lists every chart that drew, `{ file, line, summary, at, series }`, the
summary as `describe` prints it, drawn at `at`: its inputs' defaults, or the `--at`
values (`describe` prints them as `[region = "North"]`); `series` holds each series'
`name`, `count`, `low` and `high` (`{ y, x }`, `x` listing every place `y` is reached),
and for a bar chart of up to 24 bars `ranked` (`[{ x, y }]`, highest first); `selects`
is the input a reader sets by clicking the chart, or `null`. `inputs` lists every input,
`{ file, line, name, type, value, choices }`.

## Pages

- `pages/**/*.md` becomes `dist/**/*.html`; `pages/index.md` is the home page. A page's
  title is its first `#` heading. Files and folders starting with `.` are skipped.
- Link pages with their Markdown names, `[North](teams/north.md)`; links become
  `.html`. With two or more pages, every page lists them all at the top.
- Raw HTML in a page is shown as text, not run. Use Markdown.

## Plot fences

````md
```plot
{
  "width": 720,
  "height": 300,
  "data": "sales.json",
  "marks": [{ "mark": "line", "x": "week", "y": "sales", "stroke": "region" }]
}
```
````

- One JSON object per fence, the whole spec. [Marks and scales](references/marks.md)
  lists the marks a dashboard uses most, their channels, and how axes are ordered;
  the project's `plot-spec.schema.json` (written by `new`) is the plot grammar's whole
  contract. `where`, `select` and `{ "input": ... }` are foldkit-dash's, not the grammar's: they are
  removed or filled in before a spec reaches it, so an editor validating a fence against
  that schema flags them, and `check` is the judge.
- `"data"` is a name in `data/` (`"sales.json"`), or the rows themselves.
- A channel is a field name, or `{ "value": ... }` for a constant.
- Scales are inferred: numbers give linear axes, strings bands, ISO dates time axes.
  A band axis keeps the order categories first appear in the rows; set its `domain`
  to choose the order, and `color.domain` to order a legend.
- There is no number format for ticks: put units in the axis `label`.
- Keep `width` about 720 for a full-width chart; the page scales it down on phones.
- `"where"` keeps the rows a chart draws: `{ "region": "North" }` keeps rows whose
  `region` is `"North"`, `{ "sales": { "min": 100, "max": 500 } }` rows from 100 to 500,
  both included (either end may be left out). Every condition must hold. Filtered rows
  are gone, not blank: a line joins across the weeks a filter drops, so draw dots or
  bars when a filter can leave gaps. It works on any page, so one
  loader can feed a chart per part: `"where": { "region": "Wales" }` on a Wales page.

## Inputs

An ```` ```input ```` fence puts a control on the page; a plot spec refers to its value
with `{ "input": "name" }`, anywhere: in `where`, as a field to plot, in a title.

````md
```input
{ "type": "select", "name": "region", "label": "Region",
  "options": { "data": "sales.json", "field": "region" }, "all": "All regions" }
```

```plot
{
  "width": 720,
  "height": 300,
  "data": "sales.json",
  "where": { "region": { "input": "region" } },
  "color": { "domain": ["North", "South", "East", "West"] },
  "marks": [{ "mark": "line", "x": "week", "y": "sales", "stroke": "region" }]
}
```
````

- `select` and `radio`: `options` lists the choices, or takes every value of a `field`
  in a `data` file (in the order they first appear). A choice is shown as it is written:
  there is no separate label, so write readable values (`"Revenue (£)"`). `all` adds a first choice, labelled
  with its text, whose value is `null`: in `where`, a `null` condition keeps every row.
  `value` is the default: the first option, or `all` when there is one.
- `range`: `min`, `max`, `step` (default 1) and `value` (default `min`); use it in
  `where` as `{ "min": { "input": "floor" } }`.
- `checkbox`: `value` true or false (default false); use it to filter a boolean field,
  or as a value in the spec.
- Names start with a letter and are unique on a page; `label` is what readers see
  (default: the name). Inputs belong to their page.
- When a filter changes which series a chart shows, its colours are reassigned: set
  `color.domain` to every series so each keeps its colour, as above. With a fixed
  `color.domain`, the summary (`describe`, and what a screen reader hears) says which
  groups are drawn: `Colour shows region (1 of 5 groups drawn: Wales)`.
- `where` filters fixed fields: an input can choose a value, not which field is
  filtered. For one threshold on whichever measure is shown, make the data long in the
  loader (`{ week, measure, value }`, a row per measure) and filter `value`, with the
  range's `min` and `max` covering every measure; or put each measure's threshold on its
  own input. A threshold suits measures on similar scales: otherwise give each its own.
- `check` draws every chart at each choice of each input it uses, one input at a time,
  the others at their defaults: every option of a select or radio, `all`, both states
  of a checkbox, and a range's `min`, `max` and default (not every step;
  `inputs[].choices` counts what it tries). It reports a choice that breaks a chart or
  keeps no rows. Combinations are not tried: Scotland with a high threshold can still
  keep nothing. Then the reader sees a note where the chart would be (`Chart at line 57:
  where ... keeps no rows`), not an empty chart; say so in the prose if it is likely.
- `describe` describes charts at the defaults, or at the values `--at` names
  (`--at region=West --at floor=300`; `all` for a select's `all`): that is how to look
  at a combination `check` does not try. It writes `all` for what the JSON gives as
  `null`.
- `"select": "region"` on a plot spec lets a reader click the chart to choose: a press
  on a bar (any category on the chart's axis of categories) sets the `region` select or
  radio to that category, and pressing it again goes back to `all` when the input has
  one. The chosen bar stands out; the others dim. Put `select` on a chart of the
  categories themselves (totals per region) and `where` with the input on the charts it
  should filter; a chart that selects usually does not filter itself, or it would show
  one bar. `check` requires the input to be a select or radio on the page, and every
  category the chart shows at the defaults to be one of its choices: list the same
  values (`"options": { "data": "totals.json", "field": "region" }` does that). The
  select stays on the page: it is the keyboard's way to choose.
- A page's inputs live in its address: choosing North and 300 makes it
  `sales.html?region=North&floor=300`, and that link opens the page with them. Values
  a page cannot take are ignored. Prose can link to a view of any page, its own
  included: `[North in detail](sales.md?region=North)`. A link cannot hold a space:
  write `South%20East` (the page writes `South+East`; both work).
- A page with inputs carries its charts' rows in the page, so readers' choices need no
  server: keep a page's data to what its charts need (summarise in the loader). For
  scale, 260 rows of six fields made a 91 KB page; aim for thousands of rows, not
  hundreds of thousands. Its
  script works from a folder (`file://`) as well as a host. Without JavaScript the
  page shows the defaults.

## Data and loaders

- A data name's extension says how it is read: `.csv` and `.tsv` as a header row and
  records (each value a number, `true`/`false`, `null` when empty, or a string), anything
  else as JSON (an array of objects of numbers, strings, booleans or null). ISO date
  strings become time axes.
- A loader is `data/<name>.<ext>`, making `<name>`: `data/sales.json.ts` makes
  `sales.json`, `data/sales.csv.py` makes `sales.csv`. It runs from the project folder
  with the program its extension names: `.ts` and `.js` with Bun (top-level `await` and
  Bun's APIs work), `.py` with `python3`, `.sh` with `sh`, `.R` with `Rscript`; it
  prints the data to stdout. It may read files anywhere (`../export.csv`). Read a
  database, an API, a CSV or a Parquet file there, and keep the rows the page needs:
  summarise in the loader (totals, rankings), not in the chart. One loader per shape of
  data; several fences can share one. [Loader recipes](references/loaders.md) has DuckDB
  and Polars over Parquet.
- Two loaders for one name (`sales.json.ts` and `sales.json.py`) are a problem; so is a
  loader whose program is not installed. The machine that builds needs every language
  the loaders use.
- For a chart of part of the data, filter with `where` rather than writing a loader per
  part. When loaders share reading code, put it in a module and import it
  (`import { loadRows } from '../lib/rows.ts'`): imports resolve from the loader's file,
  any `.ts` beside it in `data/` is only a loader if a fence names it, and `Bun.file`
  paths resolve from the project folder. In Python, keep shared modules in `lib/`
  (outside `data/`) and add it to the path from the loader's own file:
  `sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))`. Paths
  built from `__file__` work whatever the working folder.
- A loader's output is cached in `node_modules/.cache/foldkit-dash/` until the loader
  changes. `--fresh` runs every loader again: use it when the data behind a loader, or
  a module it imports, changed but the loader did not.
- A data file of the same name wins over a loader. Names cannot leave `data/`.
- A deleted loader's cached output stays in the cache, unused; it does no harm.
- Loaders run arbitrary code at build time. Treat `data/` as code.

## As MCP tools

`foldkit-dash mcp` serves the same commands over stdio to an agent that calls tools:
`dash_new { dir }`, `dash_check { root }`, `dash_describe { root, at? }`,
`dash_build { root, out? }`, each answering with the `--json` envelope, and
`dash_preview { root, file, line, at? }`, one chart (by the line its fence opens on) as
a standalone SVG with its summary and series. `at` is an object of input values:
`{ "region": "North", "floor": 300 }`, `null` for `all`. A call that cannot be done
answers as an error with the reason. In this repository, `.mcp.json` registers it as
`foldkit-dash`.

## Not yet

No hover read-outs, no brushing a range, no clicking lines, dots or legend entries
(`select` works on categories), no Parquet or database reading without a loader, and no
streaming loaders. `dev` watches
`pages/` and `data/` only: when a loader's source (a CSV elsewhere) changes, run with
`--fresh`.
