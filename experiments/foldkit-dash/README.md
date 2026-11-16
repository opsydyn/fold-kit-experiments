# foldkit-dash spike

A static dashboard in the manner of Observable Framework, built with foldkit-viz and Bun
alone: markdown pages, JSON plot specs in ` ```plot ` fences, and data loaders that
run at build time. The assessment it informs is
[2026-11-16-foldkit-static-dashboards](../../docs/assessments/2026-11-16-foldkit-static-dashboards.md).

```sh
bun run --filter @opsydyn/foldkit-viz build   # once: the spike imports its dist/
cd experiments/foldkit-dash
bun build.ts           # pages/*.md → dist/*.html
bun build.ts --check   # writes nothing; problems as JSON, exit 1 if any
```

- `pages/index.md`: a page. A ` ```plot ` fence holds a plot spec (the grammar of
  marks, `packages/foldkit-viz/schema/plot-spec.schema.json`); `"data": "latency.json"`
  names a data file in `data/`, or a loader's output.
- `data/latency.json.ts`: a loader. It prints JSON; the build runs it and caches the
  output in `.cache/` until the loader changes.
- Each fence becomes a figure: SVG, legend, a summary and the data table. The pages ship
  no JavaScript.

Not built: a dev server, interactive inputs, islands, layout, navigation between pages.
