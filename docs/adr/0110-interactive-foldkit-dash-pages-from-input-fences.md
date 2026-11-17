# ADR 0110: Interactive foldkit-dash pages from input fences, and a dev server

## Status

**Accepted**, 2026-11-17, for stage 2 of
[ADR 0109](0109-build-agent-first-static-dashboards-with-foldkit-dash.md).

## Context

Stage 1 builds static pages: Markdown, JSON plot specs and build-time loaders, no
JavaScript, checked in text. Its acceptance runs left two gaps: showing part of the
data took a loader per part, and nothing on a page responded to a reader. The
[assessment](../assessments/2026-11-16-foldkit-static-dashboards.md) proposed stage 2 as
"a page names a Foldkit app, prerendered by `@foldkit/vite-plugin` and hydrated", and a
`dev` command with reload.

An app per page means an agent writes a Model, Messages and a view for every filter: the
TypeScript that stage 1 kept out of pages, and a Vite toolchain in every project. Most
dashboard interaction is narrower: choose a region, a metric, a range, and see the charts
change.

## Decision

1. **Inputs are fences too.** An ` ```input ` fence holds one JSON input: a
   `select` or `radio` (options listed, or every value of a data field; an optional
   `all` choice that means "no filter"), a `range` (`min`, `max`, `step`) or a
   `checkbox`. Each has a page-unique `name`, a `label` and a default `value`.
2. **Specs refer to inputs; `where` filters rows.** In a plot spec, `{ "input": "name" }`
   anywhere stands for that input's current value (a field to plot, a scale domain, a
   title). A spec's `where` keeps the rows whose fields equal a value, or fall between
   `{ "min", "max" }`, where either may be an input; an `all` choice drops its condition.
   foldkit-dash removes `where` before `compilePlot`. `where` works on static pages as
   well, so one loader can feed a chart per part.
3. **A page with an input is a Foldkit app, prerendered and hydrated.** Its Flags carry
   the prose (as HTML), the specs, the inputs and the rows its charts use; its Model is
   the inputs' values; a Message is an input changed; the view draws each chart with
   foldkit-viz's `plotChart`. The build renders it with `renderToString` (Foldkit's
   experimental server API) and the page's script hydrates it, so the HTML is the
   default state and readable without JavaScript. A page without inputs is built as in
   stage 1, with no JavaScript.
4. **One client script per build, no bundler in the project.** foldkit-dash bundles its
   own client entry with `Bun.build` into `dist/_dash/client-<hash>.js`, minified, as a
   classic deferred script so built pages also work from `file://`. The content hash is
   the Foldkit build id: the server stamps it, and the client reads it from its own
   file name, so a page only hydrates with the script it was built for.
5. **`dev` serves and rebuilds.** `foldkit-dash dev` builds to memory, serves it, and
   rebuilds when `pages/` or `data/` change, telling open pages to reload through a
   server-sent event; only `dev` adds that script. Problems print to the terminal as
   `check` prints them and show on the page where the chart would be.
6. **Checks cover every choice.** `check` reports input problems (kind `input`: a bad
   input fence, a duplicate name, a reference to no input, a default that is not a
   choice, an options field missing from the data). It compiles each chart at its
   inputs' defaults, and again at every choice of each input it uses (one input at a
   time, the others at their defaults, up to 200 compiles a chart), naming the choice in
   the message: a filter that leaves no rows is a problem, not a blank chart. `describe`
   describes charts at the defaults, and every envelope lists the inputs.

## Consequences

- An agent adds interaction by writing two more kinds of JSON, checked like the rest;
  no app code, no Vite.
- Interactive pages carry their charts' rows in the page. That suits dashboards of
  summaries (thousands of rows); a page over a large table should summarise in its
  loader, as the skill already says.
- The client script holds Foldkit, Effect and foldkit-viz's plot layer: 472 KB minified,
  159 KB gzipped, bundled in about 90 ms. That is the price of interaction, paid once
  per site and only by pages with inputs.
- `renderToString` and `hydrate` are experimental in Foldkit 0.170; a Foldkit upgrade
  re-qualifies this path (the browser test hydrates and interacts).
- Checking every choice multiplies compile time by the number of choices; the cap keeps
  a large select from stalling `check`.

## Options considered

- **A Foldkit app per page** (the assessment's plan). Kept as a later escape hatch:
  the most power, but it brings back application code and a bundler.
- **Embedding instead of hydrating** (as astro-foldkit's islands do). Simpler, but the
  client would replace the server's DOM; hydration adopts it, and Foldkit verifies the
  build id before it does.
- **A module script.** Blocked on `file://` pages by the browser; the classic script
  works from a folder and from a host alike.

## Not in stage 2

Cross-filtering by clicking a chart, inputs kept in the URL, a custom app per page, a
per-series summary in `describe`, and the MCP server (stage 3).
