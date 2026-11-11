# Pre-Rendered FoldKit Islands for Astro

**Status:** Implemented

## Goal

Let a `lazyApp` island put its first paint in the HTML, without hydrating it and
without changing the island contract for apps that do not ask for it.

## Context

[`2026-08-18-astro-foldkit-opt-in-server-rendering-design.md`](./2026-08-18-astro-foldkit-opt-in-server-rendering-design.md)
added `definePage` and stated the client-only island contract as a
compatibility requirement: the server renderer emits a deterministic mount
shell and does not execute the application. That was the right scope for that
slice. This design reopens the island half of it, so it should say why.

Three findings from a report site that ports its charts and a data grid to
FoldKit under Astro:

1. **`client:visible` cannot work for a FoldKit island.** Astro's directive
   observes an island's _children_, because `astro-island` is
   `display: contents`:

   ```js
   // astro/dist/runtime/client/visible.js
   for (const child of el.children) io.observe(child);
   ```

   A FoldKit island's only child is the empty mount shell, which measures 0x0.
   A zero-area target never reports `isIntersecting`, so the callback never
   runs and the island silently never hydrates — no error, anywhere. Two
   islands on the pilot page were in this state and nobody noticed. An island
   that renders server markup has size, and the directive works.

2. **The markup is cheap where the data is not.** On the pilot page the three
   charts' island props are 3.1KB gzipped between them and the grid's are
   83.7KB. Pre-rendering all three charts costs 5,796 gzipped bytes. The
   question "should islands render on the server" is about a small number; the
   question "should an island carry its whole dataset" is about a large one.

3. **Nothing in FoldKit stands in the way.** `renderToString` has an overload
   taking a config with no `Flags`, and `makeApplication` sets
   `isFlagsRequired: false` for such a config, so hydration does not demand a
   payload either. The one-root limit lives in `assertSinglePageApplication`,
   which `findDocumentHydration` reaches only for hydratable output.
   `isHydratable: false` emits no root stamp, so it never applies.

## Decisions

### Opt-in, per island

```ts
export default lazyApp<Props>(() => import('./main'), { prerender: true });
```

Islands that do not pass it behave exactly as before, down to the byte: the
server emits the same empty mount. The option sits on `lazyApp` rather than on
the Astro usage because whether an island _can_ render on the server is a fact
about its `init`, which the module knows and the page does not.

### Static markup, not hydration

The render passes `isHydratable: false`. The markup carries no root stamp and
no Flags payload; nothing adopts it. The client renderer is untouched — `embed`
replaces the mount's contents on boot exactly as it replaced an empty mount.

This is what keeps the feature small and keeps it clear of the page contract:

- no Flags schema, because the props Astro already serialises for the client
  are the same values the server closes over;
- no build identity, because nothing compares one;
- no single-root rule, because that rule guards hydration;
- therefore any number of pre-rendered islands may share a document, unlike a
  `definePage` owner, of which a document may hold one.

Server and client run the same pure `init` and `view` over the same props, so
the replacement is the same markup and the swap is invisible. Verified by
sampling mark counts across boot: 200 `<circle>`, 4 `<path>`, 8 `<rect>` before
and after, unchanged.

### Failing closed

A pre-render that throws fails the render. It does not fall back to the empty
mount.

An island whose `init` touches a browser-only resource must leave the option
off, and the build error says so at the point of the mistake. A silent fallback
would ship a page that looks fine and has quietly lost the thing the author
asked for — the same failure mode as the `client:visible` finding above, which
is what this design is partly a response to.

### What this does not do

It does not hydrate islands. Adopting server markup per island would need
`findDocumentHydration` to scope its root query to the container and skip
`assertSinglePageApplication` for an embedded caller, which is a FoldKit
change, not an adapter change. That remains open, and the justification in
FoldKit's source — that each page-owning application rewrites document metadata
and installs document-wide navigation listeners — describes neither `noMeta`
islands nor the explicit `navigation` port bridge.

## Architecture

`src/types.ts` adds `DefineAppOptions` and an optional `prerender` on
`FoldkitApp`. `src/define-app.ts` takes the options and sets the marker.
`src/server-render.ts` adds `renderFoldkitIslandMarkup`, which closes the props
into `renderToString`'s no-Flags overload with `isHydratable: false`.
`src/server.ts` branches on the marker and wraps the result in the same mount
element the client resolves, because `findIslandMount` treats that element as
the runtime's container.

No client, integration, or build-id surface changes.

## Compatibility and release policy

Additive. The second argument is optional, `FoldkitApp.prerender` is optional,
and an island that omits it produces identical output. `definePage` is
untouched.

## Verification

`test/unit/server.test.ts` covers: the empty shell for an island that did not
opt in; markup inside the mount for one that did; per-props output, so two
islands differ; no `data-foldkit-app` or `data-foldkit-flags` stamp; no build
identity required; no Astro result required; no page-ownership claim, so
opted-in islands may repeat in one result; and the fail-closed path.

The package's unit suite, typecheck, lint and build are green.
