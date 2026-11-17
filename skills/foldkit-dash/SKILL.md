---
name: foldkit-dash
description: Use when building or changing a data dashboard with @opsydyn/foldkit-dash, Markdown pages whose ```plot fences hold foldkit-viz plot specs as JSON, fed by build-time data loaders, with ```input fences (select, radio, range, checkbox) that filter and change charts, built to static HTML that only ships JavaScript where a page has inputs. Covers starting a project, writing pages, specs, inputs and loaders, filtering with where, and the check, describe, build and dev loop. Non-TypeScript loaders and an MCP server are not part of it yet.
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
inputs and `dev` in [ADR 0110](../../docs/adr/0110-interactive-foldkit-dash-pages-from-input-fences.md));
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
   It gives each axis's range and, for a colour, its groups, but not where a peak or a
   dip falls or what each series' own range is: check a claim such as "every region dips
   in July" against the data with a script, or make one chart per series.
4. `bunx foldkit-dash build`. Writes `dist/`, replacing what an earlier build wrote.

For a person watching, `bunx foldkit-dash dev` serves the site (on
`http://127.0.0.1:4400/`, `--port` to change), rebuilds when `pages/` or `data/` change,
reloads open pages, and prints problems as `check` does. An agent does not need it: the
loop above is the check.

Exit codes: 0 done, 1 problems found (a build still writes its pages, each problem
shown where its chart would be), 2 the command could not run (no `pages/` folder, a
bad flag, `new` into a folder in use, `--out` outside the project, a port in use).

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

`charts` lists every chart that drew, `{ file, line, summary, at }`, the summary as
`describe` prints it, drawn at `at`: its inputs' defaults (`describe` prints them as
`[region = "North"]`). `inputs` lists every input, `{ file, line, name, type, value,
choices }`.

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
  contract. `where` and `{ "input": ... }` are foldkit-dash's, not the grammar's: they are
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
  `color.domain`, `describe` names every group in it, drawn or not.
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
- `describe` describes charts at the defaults only: to describe another choice, change
  the default, check, and change it back. It writes `all` for what the JSON gives as
  `null`.
- A page with inputs carries its charts' rows in the page, so readers' choices need no
  server: keep a page's data to what its charts need (summarise in the loader). For
  scale, 260 rows of six fields made a 91 KB page; aim for thousands of rows, not
  hundreds of thousands. Its
  script works from a folder (`file://`) as well as a host. Without JavaScript the
  page shows the defaults.

## Data and loaders

- A data file is JSON: an array of objects whose values are numbers, strings,
  booleans or null. ISO date strings become time axes.
- A loader is `data/<name>.ts`, making `<name>`: `data/sales.json.ts` makes
  `sales.json`. It is a program Bun runs from the project folder, printing that JSON
  to stdout. Top-level `await` and Bun's APIs work, and it may read files anywhere
  (`await Bun.file('../export.csv').text()`). Read a database, an API or a CSV there,
  and keep the rows the page needs: summarise in the loader (totals, rankings), not in
  the chart. One loader per shape of data; several fences can share one.
- For a chart of part of the data, filter with `where` rather than writing a loader per
  part. When loaders share reading code, put it in a module and import it
  (`import { loadRows } from '../lib/rows.ts'`): imports resolve from the loader's file,
  any `.ts` beside it in `data/` is only a loader if a fence names it, and `Bun.file`
  paths resolve from the project folder.
- A loader's output is cached in `node_modules/.cache/foldkit-dash/` until the loader
  changes. `--fresh` runs every loader again: use it when the data behind a loader
  changed but the loader did not.
- A data file of the same name wins over a loader. Names cannot leave `data/`.
- A deleted loader's cached output stays in the cache, unused; it does no harm.
- Loaders run arbitrary code at build time. Treat `data/` as code.

## Not yet

No hover or clicking a chart to filter others, no inputs kept in the page's URL, and
loaders are TypeScript only. `dev` watches `pages/` and `data/` only: when a loader's
source (a CSV elsewhere) changes, run with `--fresh`. Stage 3 of ADR 0109 adds an MCP
server and loaders in other languages.
