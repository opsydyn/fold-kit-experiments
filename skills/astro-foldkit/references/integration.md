# Integration Details

## Runnable baseline

Copy `assets/counter/` from this skill into a separate project directory. From
that directory run `bun install`, `bun run check`, `bun run test`, and
`bun run build`. Run `bun run dev` for browser checks. The example pins its
dependencies and uses only public package imports. It is a starting point, not
a reason to replace an existing consumer's scripts or deployment configuration.

`src/apps/counter/main.ts` supplies complete runtime schemas and record returns.
`app.ts` registers an island; `page.ts` registers a page owner through
`page-main.ts`. Only that page module exports `Flags`. The same pure application
can use either path without changing its update loop. Exporting `Flags` from the
island's loaded module makes FoldKit expect a Flags Effect that the props-based
island path does not provide; it can pass typecheck/build yet fail to mount.
The loader returns the module namespace itself, not a nested `config` export.
Flags live in a small separate module so the page entry can validate them without
eagerly importing the application it is meant to load lazily.

## Installation in an existing project

Declare packages that application code imports directly: `@opsydyn/astro-foldkit`,
`foldkit`, `effect`, and `astro`, using a compatible version set. Register the
default `foldkit()` integration in `astro.config.ts` or `astro.config.mjs`.
The integration already installs the FoldKit Vite plugin; do not add a second
plugin or enable a separate FoldKit `ssr.build` pipeline.

The example uses Astro's strict tsconfig. Do not resolve package errors by
weakening typechecking or adding source-path aliases.

## Islands and page owners

For typed islands, include reserved props such as `noMeta?: boolean | ''` in the
`lazyApp<Props>` type when they are used. Validate serialized application props
in `init`. The no-JavaScript response is a mount shell, not the app's content;
provide truthful fallback content when the task needs it.

For page owners, the `flags` callback receives `{ request, url, params, props }`
and returns public Flags synchronously. Validate those values with Effect Schema.
Load request-specific data in the Astro/server layer before the handoff when
needed; do not turn the Flags factory into an async loader. A server render does
not execute application Commands or Subscriptions.

Resolve metadata using the same page entry and props that the component receives.
Astro applies the resolved title, lang, dir, canonical and ogUrl to the outer
document as appropriate. Canonical URL policy belongs in the page view; it is not
inferred from the request. Keep the `/server` resolver out of client imports.

The example is SSG. For request SSR, install/configure the deployment's Astro
adapter and set `export const prerender = false` on the route. Verify actual
requests in that adapter; a static build is not request-SSR qualification.

Hydration must reuse the emitted root and Flags. Do not call `Runtime.run`,
`embed`, or `hydrate` yourself inside an Astro-managed component. The integration
coordinates the generated client/server build identity. Use `server.buildId` or
`FOLDKIT_BUILD_ID` only for an intentional, consistent deployment override, never
a hardcoded production value such as `development`.

## Client-island navigation

Export an inbound port and `navigation` mapper from the loaded app configuration:

```ts
import type { NavigationEvent } from '@opsydyn/astro-foldkit';
import { Schema } from 'effect';
import { Port } from 'foldkit';

export const ports = { inbound: { navigation: Port.inbound(Schema.Unknown) } };
export const navigation = {
  port: 'navigation',
  map: (event: NavigationEvent) => ({ _tag: 'Navigated' as const, ...event }),
};
```

Add the corresponding `Navigated` variant to the application's Message schema
and handle it in `update`. Events contain `phase`, `path`, and `previousPath`:

- `coldLoad`: initial mount of an island identity.
- `entered`: re-entry/remount or a qualifying later page load.
- `stayed`: the same island identity is retained across a swap; not an exit and
  not followed by an extra `entered` for that retained navigation.
- `exited`: unmount; the integration also disposes the island runtime.

For an active request on exit, record route-exit intent and issue its keyed
interrupt only. Do not reload from the interrupt outcome after exit; distinguish
that from user-requested replacement. Correlate outcomes and ignore stale results.
Do not depend on an interrupt completion being processed before unmount disposal.

These guarantees describe the island bridge in version 0.8.1. Its page-owner
hydration path does not attach that same explicit bridge/disposal handler. Verify
the installed implementation before promising retained-page lifecycle support.

## Troubleshooting

| Symptom                                   | Check                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Cannot resolve `/server` or package entry | Installed version, export map, declarations and built `dist`; in a source workspace build the package before loading Astro config |
| Blank app after hydration                 | Real Model/Message schemas, `client:load`, console errors, root/Flags/build identity; do not replace schemas with casts           |
| Browser imports Node-only modules         | Trace imports from client entry; keep resolver, credentials and server loaders in Astro frontmatter/server modules                |
| Page title changes unexpectedly           | Island `noMeta` and ownership; it does not suppress lang/dir                                                                      |
| Navigation reloads after exit             | App-owned cancellation intent, correlation and outcome policy                                                                     |

Run a clean consumer install when workspace resolution could hide a missing
dependency. Report lint, types, build, initial-HTML and browser results separately.

Package documentation: https://github.com/opsydyn/fold-kit-experiments/tree/main/packages/astro-foldkit
Use the installed release's README/declarations when repository main is newer.
