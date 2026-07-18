# @opsydyn/web

Demo app for [`@opsydyn/astro-foldkit`](../../packages/astro-foldkit/). It hosts the Astro integration reference apps and the `foldkit/http` example alongside the chart demos.

## Apps

**Counter** (`/`) — increment/decrement with particle burst animations driven by `Subscription.animationFrame`.

**Health dashboard** (`/health`) — polls `/api/health` via `foldkit/http`, renders a live uptime timer that ticks on every animation frame once data loads, and uses a shimmer skeleton during the initial fetch to prevent layout shift.

**Request diagnostics** (`/request-diagnostics`) — loads latency/error-rate points through `foldkit/http`, renders `@opsydyn/foldkit-viz` histogram and scatter primitives, and uses `foldkit/experimental/machine` for guarded brush filtering.

/request-diagnostics demonstrates app-owned interruption. Define an
interruptible command with a key that identifies the remote resource, record
why it is being cancelled in the model or machine state, then return only the
interrupt command. Handle its outcome in a later update turn: a reload starts
a replacement request, while Navigated({ phase: 'exited' }) finishes without
one. Do not return interruption and replacement commands in the same batch.

Use the same shape for remote filter, brush, or zoom loads. Keep their command
keys, cancellation policy, and result handling in the consuming FoldKit app;
@opsydyn/foldkit-viz receives only data and chart-local messages.

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
bun test     # vitest unit tests
bun typecheck  # astro check
```

## Structure

```text
apps/web/
├── src/
│   ├── apps/
│   │   ├── counter/   — counter app (model, update, view, commands, subscriptions)
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

Each app follows the FoldKit module split: `model.ts`, `message.ts`, `update.ts`, `view.ts`, `command.ts`, `subscription.ts`, `main.ts`, `app.ts`. The `app.ts` for each registers with FoldKit via `defineApp` from `@opsydyn/astro-foldkit/define-app`.
