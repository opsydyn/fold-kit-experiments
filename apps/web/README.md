# @opsydyn/web

Demo app for [`@opsydyn/astro-foldkit`](../../packages/astro-foldkit/). It shows two FoldKit apps running inside Astro pages with `client:load`.

## Apps

**Counter** (`/`) — increment/decrement with particle burst animations driven by `Subscription.animationFrame`.

**Health dashboard** (`/health`) — polls `/api/health` via Effect `HttpClient`, renders a live uptime timer that ticks on every animation frame once data loads, and uses a shimmer skeleton during the initial fetch to prevent layout shift.

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
