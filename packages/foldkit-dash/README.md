# @opsydyn/foldkit-dash

Agent-first static dashboards: Markdown pages whose ` ```plot ` fences hold
[foldkit-viz](../foldkit-viz/README.md) plot specs as JSON, fed by data loaders that run
at build time, built to HTML with no JavaScript. In the manner of Observable Framework,
made for coding agents first: the format is Markdown and JSON, and every check answers
in text. Stage 1 of [ADR 0109](../../docs/adr/0109-build-agent-first-static-dashboards-with-foldkit-dash.md),
with inputs and `dev` from [ADR 0110](../../docs/adr/0110-interactive-foldkit-dash-pages-from-input-fences.md).

Private. Runs on Bun 1.4+.

```sh
foldkit-dash new my-dashboard        # a page, a data loader, AGENTS.md
foldkit-dash check   [-C dir] [--json] [--fresh] [--loader-timeout 60]
foldkit-dash describe [-C dir] [--json]
foldkit-dash build   [-C dir] [--out dist] [--json] [--fresh]
foldkit-dash dev     [-C dir] [--port 4400] [--host 127.0.0.1] [--fresh]
```

In this repository: `bun packages/foldkit-dash/src/bin.ts <command>`.

- **Pages:** `pages/**/*.md` → `dist/**/*.html`, linked to one another, titled by their
  first heading. Raw HTML in Markdown is escaped.
- **Charts:** a ` ```plot ` fence holds one JSON plot spec; `"data": "name.json"`
  reads `data/name.json` or the output of the loader `data/name.json.ts`.
- **Inputs:** an ` ```input ` fence (`select`, `radio`, `range`, `checkbox`) is a
  control; a spec uses its value as `{ "input": "name" }`, and `"where"` keeps the rows a
  chart draws (with or without inputs). A page with inputs is a Foldkit app: the build
  renders it to HTML, and `dist/_dash/client-<hash>.js` hydrates it.
- **Loaders** print JSON rows; their output is cached under
  `node_modules/.cache/foldkit-dash/` until the loader changes (`--fresh` reruns).
- **Output** is deterministic: the same inputs build byte-identical pages and script.
- **`dev`** serves the site from memory, rebuilds when `pages/` or `data/` change, and
  reloads open pages.
- **Exit codes:** 0 done, 1 problems (reported by file, line and spec path), 2 the
  command could not run. `--json` answers with a `foldkit-dash/v1` envelope.

The agent guidance is the [foldkit-dash skill](../../skills/foldkit-dash/SKILL.md).

```sh
bun run --filter @opsydyn/foldkit-dash test       # unit and CLI tests
bun run --filter @opsydyn/foldkit-dash test:e2e   # the built starter in Chromium
```
