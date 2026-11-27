# @opsydyn/web

Demo app for [`@opsydyn/astro-effect-ui`](../../packages/astro-effect-ui/). It hosts Astro integration examples and interactive chart demos.

## Apps

**Chart comparison** (`/comparison`) composes up to four
scatter/histogram panels with stable IDs. Reorder preserves child state; removed
IDs ignore late Messages. The parent owns linked range inspection and derived
overlays, while each chart keeps its own local active point. Scoped Mounts report
width and pointer facts; Commands restore focus after reorder. No comparison
runtime or async API is added to either public package. The same workbench is
available in Storybook as `Charts/Comparison` and in the promo with source and
project exports. See the [qualification record](../../docs/superpowers/specs/2026-10-08-keyed-chart-comparison-qualification.md)
for browser acceptance still outstanding.

**Dataset explorer** (`/dataset-explorer`) hosts the private shared
`@opsydyn/dataset-explorer` app: experimental KeyedQuery caches, retained refresh
data, failure recovery and stale-response rejection. The same app powers the
promo's `/examples/datasets/`; request policy stays outside Viz and Astro.

**Counter** (`/`) — increment/decrement with particle burst animations driven by a scoped animation-frame subscription.

**Health dashboard** (`/health`) — polls `/api/health` via Effect HTTP, renders a live uptime timer that ticks on every animation frame once data loads, and uses a shimmer skeleton during the initial fetch to prevent layout shift.

**Greeting** (`/greeting`) — validates a branded name at the Astro boundary and
reflects its locale in the hydrated page metadata to switch
between English left-to-right and Arabic right-to-left presentation.

**Request diagnostics** (`/request-diagnostics`) — loads latency/error-rate points through Effect HTTP, renders `@opsydyn/foldkit-viz` histogram and scatter primitives, and guards brush filtering with a state machine.

/request-diagnostics demonstrates app-owned interruption. Define an
interruptible command with a key that identifies the remote resource, record
why it is being cancelled in the model or machine state, then return only the
interrupt command. Handle its outcome in a later update turn: a reload starts
a replacement request, while Navigated({ phase: 'exited' }) finishes without
one. Do not return interruption and replacement commands in the same batch.

Use the same shape for remote filter, brush, or zoom loads. Keep their command
keys, cancellation policy, and result handling in the consuming Effect UI app;
@opsydyn/foldkit-viz receives only data and chart-local messages.

The shared Astro layout serves `lang="en" dir="ltr"` on first paint. On the
standalone Greeting route, `SelectedLocale` updates browser metadata through an Effect UI command. Astro owns document metadata for the embedded chart islands.

## Running

From the repo root:

```sh
bun install
bun dev
```

Or from this directory:

```sh
bun dev      # dev server at http://localhost:4321
bun build    # production build → dist/
bun preview  # preview the production build
bun run test # Vitest tests in this workspace
bun typecheck  # astro check
```

## Structure

```text
apps/web/
├── src/
│   ├── apps/
│   │   ├── counter/   — counter app (model, update, view, commands, subscriptions)
│   │   ├── greeting/  — locale-aware Document metadata reference app
│   │   └── health/    — health dashboard app
│   ├── layouts/       — shared Astro layout
│   └── pages/
│       ├── index.astro
│       ├── health.astro
│       └── api/
│           └── health.ts  — SSR API route (uptime, timestamps)
├── public/
├── astro.config.ts
└── package.json
```

App modules separate state, messages, rendering and effects: `model.ts`, `message.ts`, `update.ts`, `view.ts`, `command.ts`, `subscription.ts`, `main.ts`, `app.ts`. Each island registers its Effect UI component with `astroComponent` from `@opsydyn/astro-effect-ui/component`.
