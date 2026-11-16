---
name: foldkit-dash
description: Use when building or changing a static data dashboard with @opsydyn/foldkit-dash, Markdown pages whose ```plot fences hold foldkit-viz plot specs as JSON, fed by build-time data loaders, built to HTML with no JavaScript. Covers starting a project, writing pages, specs and loaders, and the check, describe and build loop. Interactive pages, a dev server and non-TypeScript loaders are not part of it yet.
---

# foldkit-dash

A dashboard is a folder: Markdown pages in `pages/`, data in `data/`. Each
```` ```plot ```` fence in a page holds one JSON plot spec (foldkit-viz's grammar of
marks); `foldkit-dash build` turns every page into static HTML with each chart drawn
as accessible SVG, with a summary and its data table, and ships no JavaScript.

You write Markdown and JSON, never chart code, and you verify your work in text:
`check` names every problem by file, line and spec path, and `describe` says what
each chart shows. Do not open a browser to find out whether a chart is right.

Requires Bun 1.4 or newer. `@opsydyn/foldkit-dash@0.1.0` is private to its repository
until stage 1 qualifies ([ADR 0109](../../docs/adr/0109-build-agent-first-static-dashboards-with-foldkit-dash.md));
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
4. `bunx foldkit-dash build`. Writes `dist/`, replacing what an earlier build wrote.

Exit codes: 0 done, 1 problems found (a build still writes its pages, each problem
shown where its chart would be), 2 the command could not run (no `pages/` folder, a
bad flag, `new` into a folder in use, `--out` outside the project).

`--json` answers with a `foldkit-dash/v1` envelope on stdout:

```json
{
  "protocol": "foldkit-dash/v1",
  "command": "check",
  "status": "problems",
  "pages": ["pages/index.md"],
  "charts": [],
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
it; `path` says where), `data` (no such file or loader), `loader` (it failed or ran
past `--loader-timeout`, 60 s by default) or `rows` (the data is not an array of
objects of plain values). `line` is the fence's opening line. `charts` lists every
chart that drew, `{ file, line, summary }`, the summary as `describe` prints it.

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
  the project's `plot-spec.schema.json` (written by `new`) is the whole contract.
- `"data"` is a name in `data/` (`"sales.json"`), or the rows themselves.
- A channel is a field name, or `{ "value": ... }` for a constant.
- Scales are inferred: numbers give linear axes, strings bands, ISO dates time axes.
  A band axis keeps the order categories first appear in the rows; set its `domain`
  to choose the order, and `color.domain` to order a legend.
- There is no number format for ticks: put units in the axis `label`.
- Keep `width` about 720 for a full-width chart; the page scales it down on phones.

## Data and loaders

- A data file is JSON: an array of objects whose values are numbers, strings,
  booleans or null. ISO date strings become time axes.
- A loader is `data/<name>.ts`, making `<name>`: `data/sales.json.ts` makes
  `sales.json`. It is a program Bun runs from the project folder, printing that JSON
  to stdout. Top-level `await` and Bun's APIs work, and it may read files anywhere
  (`await Bun.file('../export.csv').text()`). Read a database, an API or a CSV there,
  and keep the rows the page needs: summarise in the loader (totals, rankings), not in
  the chart. One loader per shape of data; several fences can share one.
- A loader's output is cached in `node_modules/.cache/foldkit-dash/` until the loader
  changes. `--fresh` runs every loader again: use it when the data behind a loader
  changed but the loader did not.
- A data file of the same name wins over a loader. Names cannot leave `data/`.
- A deleted loader's cached output stays in the cache, unused; it does no harm.
- Loaders run arbitrary code at build time. Treat `data/` as code.

## Not yet

Pages are static: no inputs, filters or hover. There is no dev server (run `build`
and open `dist/index.html`), and loaders are TypeScript only. Stages 2
and 3 of ADR 0109 add those.
