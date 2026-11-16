# Agent-first static dashboards with Foldkit — 2026-11-16

- **result:** feasible; recommended, in stages.
- **claim:** Everything a static, Observable Framework-style dashboard needs is already
  here except a thin build tool: foldkit-viz's plot grammar is JSON a model can write,
  validated with errors at a spec path, and renders to accessible SVG without a DOM, and
  Foldkit's own Vite plugin prerenders server-rendered pages. A spike built a dashboard
  page from markdown, two plot fences and a data loader in about 40 ms, with no
  JavaScript on the page and no dependencies beyond foldkit-viz and Bun.
- **evidence:** [`experiments/foldkit-dash`](../../experiments/foldkit-dash/README.md),
  run below; the repository's existing pieces, cited by path.
- **remaining uncertainty:** interactive pages (inputs, cross-filtering) are not spiked;
  Foldkit's server rendering is `foldkit/experimental/server`; the page format and CLI
  are unproven with agents beyond this session.
- **next:** stage 1 below, proposed in
  [ADR 0109](../adr/0109-build-agent-first-static-dashboards-with-foldkit-dash.md): a
  `foldkit-dash` package with `new`, `build`, `check` and `describe`, and a skill.

The article the question pointed to (`old.observablehq.com/blog/what-is-static-site-generator`)
could not be fetched from this environment, so the comparison below is with Observable
Framework as documented, not with that article.

## What Observable Framework does

- Pages are Markdown with JavaScript code blocks that run in the browser on a reactive
  runtime: a block re-runs when a value it reads changes, and inputs are values.
- **Data loaders** are programs in any language, named for the file they produce
  (`quakes.json.py`, `sales.csv.sh`). They run at build time, not in the reader's browser,
  and their output is cached, so a page ships a snapshot rather than a query.
- `npm create` scaffolds a project; a preview server reloads as files change; the build
  is static files for any host.

Its strength is the reactive page; its bet is that data is computed before the reader
arrives.

## What this repository already has

| Need                           | Here                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Charts as data an agent writes | foldkit-viz's plot grammar ([ADR 0037](../adr/0037-a-declarative-grammar-of-marks-for-foldkit-viz.md)): a spec holds no functions, has a published JSON Schema (`packages/foldkit-viz/schema/plot-spec.schema.json`), and `compilePlot` names errors by path (`marks[0].x: field "dosage" is missing from the data`).          |
| Checking a chart unseen        | `describePlot` and `plotTable`: a plain-language summary and the data table of what a chart draws.                                                                                                                                                                                                                             |
| Static rendering               | `plotSvg` and `plotHtml` (`@opsydyn/foldkit-viz/svg/plot`): strings, no Foldkit, Effect or DOM; also PNG and Jupyter.                                                                                                                                                                                                          |
| Server rendering, Foldkit only | `@foldkit/vite-plugin` 0.29: `foldkit({ ssr: { clientEntry, serverEntry, build: true, prerender: true } })` builds a server entry and prerenders the paths it exports (`prerenderPaths`); `Runtime.hydrate` adopts the HTML. `apps/polars-summary` renders plot pages on the server with `renderToString`, shipping no script. |
| Server rendering, with Astro   | `@opsydyn/astro-foldkit`: prerendered islands (no JavaScript, or hydrated on view or interaction) and `definePage` for SSG or request SSR.                                                                                                                                                                                     |
| Templates and agent guidance   | the promo's downloadable projects (`apps/promo/src/pages/downloads`), the package skills (`skills/foldkit-viz`, `skills/astro-foldkit`), and MCP tools that check and preview rather than hand over raw state (`bun run scene-mcp`).                                                                                           |

## The spike

`experiments/foldkit-dash/build.ts`, about 130 lines: pages are Markdown rendered by
Bun's built-in `Bun.markdown`; a ` ```plot ` fence is a JSON plot spec whose
`"data"` may name a data file or a loader's output; `data/latency.json.ts` is a loader
(it prints JSON; the build runs it and caches the output until the loader changes); each
fence becomes `plotHtml`'s figure (SVG, legend, summary, data table).

- **Output:** one 51 kB page, a line chart and a box plot of a week of latencies, no
  `<script>`.
- **Time (Bun 1.4.2, this container):** about 45–60 ms for a build that runs the loader,
  about 30 ms from the cache; the whole process under 0.1 s.
- **The agent loop:** `bun build.ts --check` writes nothing and prints problems as JSON,
  each with the file and line of its fence:

  ```json
  { "file": "pages/index.md", "line": 5, "message": "marks[0].y: field \"p99\" is missing from the data" }
  { "file": "pages/index.md", "line": 25, "message": "no data file or loader for \"errors.json\"" }
  { "file": "pages/index.md", "line": 29, "message": "Expected a valid JSON string" }
  ```

  Each is enough for a model to fix the fence without reading the build. To check what a
  chart says without seeing it, `describePlot` on the line chart gives: "Shows 3 lines.
  Time from 2026-11-09 to 2026-11-15; p95 from 51 to 213. Colour shows service (3
  groups: api, auth, search)."

Not spiked: interactivity, a dev server, layout and navigation, and Foldkit's prerender
path (the spike writes HTML strings; static charts need no runtime).

## Options

1. **A Foldkit-only tool (`foldkit-dash`), recommended.** A small CLI over the pieces
   above: Markdown pages with plot fences and data loaders, built to static HTML. Pages
   that need inputs become Foldkit apps through `@foldkit/vite-plugin`'s server build
   and prerender, hydrated in the browser: the reactive part is a Foldkit Model, not a
   cell runtime. No Astro, one runtime, and the format stays Markdown plus JSON.
2. **An Astro starter.** astro-foldkit, Markdown or MDX pages, Astro's content layer as
   data loaders. Astro already has a dev server, routing, layouts and loaders, so it is
   the faster way to a full site, but it is not Foldkit only, and an agent then has to
   know Astro as well.
3. **Guidance only.** A skill page showing `plotHtml` in a script. Cheapest, and leaves
   every project to rebuild the loader cache, the checks and the page shell.

## Recommendation: option 1, agent first, in stages

**Agent first** means the format and the tools are made for a model to write and verify
without a browser:

- **One format to learn.** Markdown, and plot specs as JSON against the published schema
  (handed to the agent with `$schema`), so a model writes a chart as data and never
  writes chart code.
- **Checks that point.** `foldkit-dash check --json` reports every problem with its file,
  line and spec path, as the spike does, plus loaders that fail and data that does not
  decode, and exits non-zero.
- **Verifying without seeing.** `foldkit-dash describe` prints `describePlot`'s summary of
  each chart (what it draws, ranges, groups), so an agent can confirm a chart says what
  the prose claims; `preview` writes one chart's SVG or PNG.
- **One command to start.** `bunx foldkit-dash new <dir>`: a page, a loader, and the
  agent's instructions (a skill) in the project.
- **Deterministic output.** No timestamps or random ids in the HTML, so a change reviews
  as a diff.
- **An MCP server** over `check`, `describe` and `preview`, as `scene-mcp` does for
  scenes.

**Stages:**

1. **S–M (2–3 days):** `packages/foldkit-dash`: `build`, `check`, `describe`, `new`; the
   loader cache; a page shell with navigation between pages; a skill
   (`skills/foldkit-dash/SKILL.md`) and a starter. Static charts only.
2. **M:** `dev` with reload (Vite), and interactive pages: a page names a Foldkit app (a
   fence or front matter), prerendered by `@foldkit/vite-plugin` and hydrated; inputs
   are its Messages. foldkit-viz's interactive charts work there as they do in the
   promo.
3. **S:** the MCP server, and loaders in other languages (run by their extension, as
   Observable does), DuckDB and Polars summaries among them
   (`apps/polars-summary` shows the pattern).

## Stage 1 acceptance (2026-11-16)

ADR 0109's bar: a fresh agent session, given only the
[foldkit-dash skill](../../skills/foldkit-dash/SKILL.md) and a prompt, produces a page
that passes `check` and whose `describe` output matches the prompt.

- **Run:** a fresh agent, told to read the skill and nothing else in the repository
  but the plot spec schema, was asked for "a dashboard of this CSV's weekly sales by
  region" (130 rows: five regions, 26 weeks, orders and revenue).
- **Result: passed.** It ran `new`, replaced the example with two loaders (weekly rows
  from the CSV, and totals per region ranked largest first) and one page of three
  charts, and its first `check` exited 0. `describe` matched the prose of all three
  charts; comparing `describe` and the data also caught a wrong claim in its own prose
  (a low it had dated to July was in early August), which it fixed. `build` exited 0:
  one page, three charts, no script.
- **What it had to guess, and what changed:**
  - The schema's documented paths did not exist in a new project (nothing installed,
    nothing published): `new` now writes `plot-spec.schema.json` into the project.
  - The skill sent it to a 61 KB schema for every channel: the skill now has a
    [marks and scales](../../skills/foldkit-dash/references/marks.md) reference.
  - Whether loaders may use top-level `await`, Bun's APIs, or read outside the
    project (they may), the order of a band axis (first appearance; `domain` sets it),
    and that ticks have no number format (units go in the label): now in the skill.
  - `describe` could not confirm "largest first": it counted a band axis's categories
    without naming them. `describePlot` now names up to six, in order (foldkit-viz).
    Earlier, it had also counted a box as three (whisker, box, median); fixed.
  - A passing `check --json` listed no charts; every envelope now lists them.
- **Not yet repeated** with those changes: a second fresh run stopped at a usage limit
  before it began. Rerun it before calling stage 1 qualified.

## Risks

- `foldkit/experimental/server` and the plugin's prerender options may change between
  Foldkit releases; stage 1 avoids both.
- Loaders run arbitrary code at build time, as Observable's do: fine for an author's own
  machine and CI, never for untrusted pages.
- Observable's reactive cells are its strength; a Model per interactive page is more
  structure. That suits agents (Messages are typed, the Model is inspectable through the
  Foldkit DevTools MCP server) but is more to write by hand.
- A new published package must keep literal dependency versions equal to the catalog's
  (`tools/check-catalog.ts`).
