# ADR 0109: Build agent-first static dashboards with foldkit-dash

## Status

**Accepted**, 2026-11-16, for stage 1 of the
[static dashboards assessment](../assessments/2026-11-16-foldkit-static-dashboards.md).
The [spike](../../experiments/foldkit-dash/README.md) is its evidence; stages 2 and 3
need ADRs of their own.

## Context

Observable Framework shows a fast way to publish data: Markdown pages, charts in them,
and data loaders that run at build time so a page ships a snapshot, not a query. We
want the same for Foldkit, made for coding agents first, so that "spin up a dashboard
of X" is a prompt rather than a project.

The parts are already here (see the assessment): foldkit-viz's plot grammar is JSON a
model can write (ADR 0037), with a published JSON Schema and errors that name the path
at fault; `describePlot` says what a chart draws; `plotHtml` renders an accessible
figure without a DOM; and the spike built a page from Markdown, two plot fences and a
data loader in about 40 ms, with no JavaScript on the page. What is missing is a tool
that does this for any project, and checks that an agent can run in a loop.

## Decision

1. **A new package, `@opsydyn/foldkit-dash`, with a `foldkit-dash` executable.** Private
   until stage 1 is qualified, then published as 0.x with literal dependency versions
   equal to the catalog's. It depends on foldkit-viz and Effect, not on Astro or a
   Foldkit runtime: stage 1 pages are static. Commands are built with `effect/cli`, as
   the Zloz CLI is (ADR 0016), and run on Bun (Bun's built-in Markdown renderer and
   process spawning); Node support waits until someone needs it.
2. **One page format: Markdown with plot fences.** A page is `pages/**/*.md`; its first
   `#` heading is its title. A ` ```plot ` fence holds one plot spec as JSON,
   which may carry `$schema` for editors and models. `"data": "name.json"` names a file
   in `data/` or a loader's output; inline rows are also allowed. Raw HTML in Markdown is
   escaped, so a page cannot run script.
3. **Data loaders run at build time, cached.** `data/name.json.ts` is run with Bun; its
   stdout, decoded as rows of plain values, is `name.json`. Output is cached under
   `node_modules/.cache/foldkit-dash/` (ignored wherever `node_modules` is) and reused until the loader file changes, or `--fresh` is
   given; a loader that fails or exceeds its time limit (default 60 s) is a problem, not
   a crash. Stage 1 loaders are TypeScript and JSON only.
4. **Four commands, each usable by an agent without a browser.**
   - `new <dir>`: a project with one page, one loader, the skill's instructions
     (`AGENTS.md`) and the plot spec schema path.
   - `build`: every page to `dist/` as static HTML: each fence as `plotHtml`'s figure
     (SVG, legend, summary, data table), a navigation list of pages, one inline
     stylesheet with light and dark themes, and no JavaScript. Output is deterministic:
     no timestamps or random ids, so a rebuild with the same inputs is byte-identical
     and a change reviews as a diff.
   - `check`: builds nothing and reports every problem: invalid JSON, a spec error with
     its path (from `compilePlot`), missing data, a loader that fails, rows that do not
     decode. With `--json`, a versioned `foldkit-dash/v1` envelope on stdout, each
     problem with file, line, spec path when known, and message.
   - `describe`: each chart's `describePlot` summary, by page and line, so an agent can
     confirm a chart says what the prose around it claims.
     Exit 0 means success, 1 means problems found, 2 means an invalid invocation.
5. **The skill is part of the deliverable.** `skills/foldkit-dash/SKILL.md` teaches the
   format, the loop (write, `check --json`, fix, `describe`, `build`) and the plot
   grammar's marks, with examples pinned to the catalog's versions and checked by
   `tools/check-skills.ts` like the other package skills.

## Consequences

- An agent writes Markdown and JSON, never chart code, and verifies its work in text.
  A person gets the same pages and the same errors.
- Pages are fully static: fast, cacheable, readable without JavaScript, and accessible
  through each figure's summary and data table. Nothing on a page responds to input
  until stage 2.
- Loaders run arbitrary code at build time, as Observable's do. Projects must treat
  `data/` as code; the CLI never runs loaders from a page or from the network.
- Bun-only in stage 1 limits who can run it; the format does not depend on Bun, so a
  Node runtime can come later without changing pages.
- A new published package adds release work: API report, changelog, provenance.

## Options considered

- **An Astro starter** (astro-foldkit, MDX, Astro's content loaders). Faster to a full
  site, but not Foldkit only, and an agent must then know Astro too. Kept as a
  documented alternative, not built.
- **Reactive cells, as Observable's runtime.** Rejected for stage 1: static pages need
  no runtime, and interaction in Foldkit is a Model and Messages, which stage 2 brings
  through Foldkit's own server build, prerender and hydration.
- **MDX or components in pages.** Rejected: a closed format an agent can learn whole
  (Markdown and JSON against a schema) checks better than arbitrary components.
- **Guidance only** (a skill showing `plotHtml` in a script). Rejected: every project
  would rebuild the loader cache, the checks and the page shell.

## Qualification

Stage 1 is done when:

- unit tests cover fence parsing and line numbers, the loader cache and `--fresh`,
  problem reporting for every kind above, and deterministic output (two builds
  byte-identical);
- an end-to-end test runs `new`, `check`, `describe` and `build` on the starter and
  opens the built page in Chromium: charts present, no script, no console errors, and
  the page usable at phone width;
- a fresh agent session, given only the skill and a prompt ("a dashboard of this CSV's
  weekly sales by region"), produces a page that passes `check` and whose `describe`
  output matches the prompt, recorded in the assessment;
- `bun run check`, the package's typecheck and API report pass.

## Outcome

Stage 1 is built and qualified (2026-11-16): the unit, command-line and Chromium tests
pass, and two fresh agent sessions given only the skill built dashboards that passed
`check` first time with `describe` matching their text (the second a six-page site with
a page per region). What they had to guess became the skill and `new`'s starter; see the
[assessment](../assessments/2026-11-16-foldkit-static-dashboards.md#stage-1-acceptance-2026-11-16).
Two gaps stay open: `describe` gives one range per axis, not each series' own or where a
peak falls, and showing part of the data on a page takes a loader per part.

## Follow-up work

- ✅ A per-series summary in `describe`, and `--at` for other input values (stage 3).
- ✅ A filter on a fence: `where`, in stage 2.
- ✅ Stage 2 ([ADR 0110](0110-interactive-foldkit-dash-pages-from-input-fences.md)):
  `dev` with reload, and interactive pages from input fences, rendered by Foldkit's
  server renderer and hydrated, without `@foldkit/vite-plugin` or app code.
- ✅ Stage 3 ([ADR 0111](0111-foldkit-dash-mcp-server-loaders-in-any-language-and-csv.md)):
  the MCP server (`check`, `describe`, `preview`, `build`, `new`), loaders by extension,
  CSV and TSV, and Parquet through DuckDB or Polars in loaders.
- ✅ Stage 4 ([ADR 0116](0116-foldkit-dash-charts-that-choose-inputs-and-inputs-in-the-url.md)):
  clicking a chart's category to choose an input, inputs in the page's address, and
  `describe` ranking every bar.
- ✅ Stage 5 ([ADR 0117](0117-foldkit-dash-several-values-choosing-series-and-how-series-move.md)):
  a `checkboxes` input of several values, clicking a series to choose it, and each
  series' largest fall and rise in `describe`.

## Review date

Review when stage 1 qualifies, or by 2026-12-16.
