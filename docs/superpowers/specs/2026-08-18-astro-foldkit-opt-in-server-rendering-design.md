# Opt-In FoldKit Server Rendering for Astro

**Status:** Draft for review

## Goal

Add an opt-in SSG and request-SSR path to `@opsydyn/astro-foldkit` while preserving the existing client-only Astro island contract for `defineApp` and `lazyApp`.

## Context

The current integration registers an Astro renderer whose server entry emits a deterministic mount shell. The client entry lazily loads the application and starts a fresh FoldKit runtime. This is the correct behavior for embedded charts and existing applications, but it does not render FoldKit application HTML during Astro SSR.

FoldKit `0.148.x` provides the experimental `foldkit/experimental/server` handoff:

1. The server calls `Server.renderToString({ Flags, init, view }, { flags, buildId })`.
2. FoldKit emits one stamped application root and a serialized public Flags payload.
3. The browser calls `Runtime.hydrate(application, { buildId })` and adopts the matching DOM.
4. Commands, subscriptions, routing, and browser resources begin only after hydration.

The server API is experimental and must be pinned and tested as a compatibility boundary.

## Decisions

### Rendering scope

The first server upgrade supports both:

- SSG for routes with universal, build-time Flags.
- Request SSR for routes with request-derived Flags.

The first upgrade does not execute FoldKit Commands on the server or add a server data-loading abstraction.

### Public opt-in

`defineApp` and `lazyApp` retain their current semantics. A separate `definePage` marker opts an application into page ownership and server rendering.

```ts
import { definePage } from '@opsydyn/astro-foldkit/define-page';

export default definePage<Props, Flags>(() => import('./main'), {
  flags: ({ request, url, params, props }) => ({
    name: props.name,
    locale: url.searchParams.get('locale') === 'ar' ? 'ar' : 'en',
  }),
});
```

The Astro usage remains explicit:

```astro
<GreetingPage client:load name={name} />
```

`client:load` is required for an interactive `definePage`. The Astro directive remains the visible request for browser behavior; `definePage` controls whether the server emits a FoldKit handoff.

### Page configuration contract

The module loaded by `definePage` must export the FoldKit server/client configuration:

```ts
export { Flags, init, Message, Model, update, view };
```

`Flags` is the runtime Schema/value used by FoldKit to decode the serialized handoff. The Flags value must contain every input required to produce the first Model. `init` receives the same Flags-derived input on the server and in the browser.

`flags` is synchronous and must return JSON-serializable, public data. It may derive values from:

- `Request` headers and cookies.
- The request URL.
- Astro route parameters.
- Validated component props.

It must not return secrets, credentials, request bodies, or non-serializable runtime objects.

### Build identity

The integration accepts an explicit deployment identity:

```ts
foldkit({
  server: {
    buildId: process.env.FOLDKIT_BUILD_ID ?? 'development',
  },
});
```

Hydratable `definePage` output fails when the server configuration has no build ID. The same value is supplied to the FoldKit Vite plugin and the client/server module graphs. Production CI supplies a deployment-specific value; local development uses the explicit `development` value.

### Failure policy

Server rendering fails closed:

- An SSG rendering error fails the build.
- A request SSR error reaches Astro’s error response.
- The integration does not silently replace failed SSR with the current client-only shell.
- A hydration refusal leaves the page contained by FoldKit’s runtime rather than booting a different client Model over server HTML.

### Document ownership

A `definePage` application owns the FoldKit `Document` for its page. `Document.title`, `lang`, `dir`, `canonical`, and `ogUrl` are the authoritative page metadata. `noMeta` remains an island-only option for `defineApp`.

Astro’s renderer return value can provide component HTML and island attributes, but it cannot directly rewrite the outer `<html>` element. The integration therefore exposes a server-only document resolver for the existing Astro layout:

```astro
---
import { resolvePageDocument } from '@opsydyn/astro-foldkit/server';

const document = await resolvePageDocument(GreetingPage, {
  request: Astro.request,
  url: Astro.url,
  params: Astro.params,
  props: { name },
});
---

<Layout
  title={document.title}
  lang={document.lang}
  dir={document.dir}
  canonical={document.canonical}
  ogUrl={document.ogUrl}
>
  <GreetingPage client:load name={name} />
</Layout>
```

The resolver and renderer use the same pure Flags and view pipeline. The first implementation will evaluate that pipeline twice: once for the layout document and once for the Astro renderer. The contract requires deterministic output, and tests must prove the metadata and body output agree. No request-scoped global cache is introduced.

### Page ownership

Only one `definePage` application may own a document. The adapter rejects duplicate page owners in one Astro result and the client branch selects exactly one FoldKit stamped root. Existing chart pages remain `defineApp` client islands and are not migrated in this slice. A page-owner route will not combine multiple hydratable FoldKit roots.

## Architecture

### Package surface

`@opsydyn/astro-foldkit` owns all Astro/server integration behavior:

- `src/define-page.ts`: `definePage`, page marker, and public page types.
- `src/server.ts`: renderer dispatch and FoldKit server handoff.
- `src/server-document.ts`: `resolvePageDocument` and Document mapping.
- `src/client.ts`: fresh-runtime branch for `defineApp`; hydration branch for `definePage`.
- `src/types.ts`: separate props-based island types and Flags-based page types.
- `src/index.ts`: Astro integration and build ID/Vite plugin wiring.
- `package.json` exports: root, `./define-page`, and `./server`.

`@opsydyn/foldkit-viz` remains framework-free. It receives only the tested FoldKit peer-range update and later deterministic render/parse fixtures. It does not receive a server runtime, request context, or Astro dependency.

### Server flow

The Astro renderer receives its request-scoped result context through the renderer call. For a page marker it:

1. Loads the page module through its existing literal lazy loader.
2. Reads `request`, URL, and route parameters from the Astro result context.
3. Calls the page’s `flags` factory with the validated component props.
4. Calls `Server.renderToString({ Flags, init, view }, { flags, buildId })`.
5. Returns FoldKit’s single stamped root and Flags payload as the Astro island body.
6. Returns page identity attributes needed by the client bridge.

For an existing `defineApp`, the server renderer continues to return the current deterministic shell and does not load or execute the FoldKit application.

The server path does not run `update`, Commands, Subscriptions, or browser-only resources. Any remote data needed for a future SSR page must be explicitly represented in public Flags by a later design.

### Client flow

The client renderer identifies the marker type:

- `defineApp`: load config, call `Runtime.makeApplication`, and use the existing embed/fresh runtime path.
- `definePage`: locate the single FoldKit stamped root inside the Astro island, create the application with the loaded config, and call `Runtime.hydrate(application, { buildId })`.

The page branch does not provide a second client Flags producer. FoldKit reads and decodes the serialized server Flags. Astro navigation and lifecycle forwarding remain application-owned behavior after hydration.

### Metadata flow

`resolvePageDocument` loads the same page config and derives the same Flags used by the renderer. It returns the FoldKit Document fields required by the Astro layout. The layout remains responsible for structural HTML and static navigation; the page-owned FoldKit Document supplies dynamic page metadata.

## Compatibility and release policy

The migration targets FoldKit `0.148.x` and the matching `@foldkit/vite-plugin` line. `@opsydyn/astro-foldkit` narrows its tested peer range to that compatibility line for the server-capable release. The package is built and packed before the demo app consumes its new subpaths.

The existing client island contract is a compatibility requirement:

- Existing `defineApp` and `lazyApp` source requires no edits.
- Existing `client:load`, `client:only`, `noMeta`, and navigation behavior remains covered by existing tests.
- Existing chart routes remain client-only.
- The new server path is opt-in and cannot be enabled globally by accident.

## Verification

### Unit coverage

- `definePage` marker identity, loader preservation, and type-level Flags contract.
- Server renderer dispatch between `defineApp` and `definePage`.
- Request, URL, params, and props passed to the Flags factory.
- Client dispatch between fresh runtime and hydration.
- Build ID passed consistently to server and client paths.
- Missing build ID, invalid Flags, invalid markers, duplicate roots, and duplicate page owners fail closed.
- Document resolver returns FoldKit metadata without changing existing island metadata behavior.

### Integration and packed-consumer coverage

- Packed package imports for the root, `./define-page`, and `./server` exports.
- No server-only export is reachable from the browser client bundle.
- Astro SSR output contains one FoldKit root, one build marker, and one Flags payload.
- Astro SSG output contains the same handoff markers and universal Flags.
- The built package resolves correctly before the web app typecheck and build.

### Demo app proof

The greeting app is the first page owner:

- One SSR route derives locale from the request URL.
- One SSG route uses fixed universal Flags.
- The server response contains greeting text before JavaScript executes.
- The outer layout receives title, language, direction, and optional social metadata from the FoldKit Document.
- Browser reload hydrates the existing DOM and a locale interaction proves the live update loop.
- Existing chart and diagnostics routes remain on the current client-only path.

### Required gates

```sh
bun run check
bun typecheck
bun test
bun run build
```

The focused package tests and packed-consumer test must pass before the full repository gates. Browser evidence is required for the final hydration claim; static test output alone is not sufficient.

## Rollout sequence

1. Upgrade and pin FoldKit/Vite compatibility.
2. Add `definePage`, page types, and package exports.
3. Implement server rendering and build-ID handoff.
4. Implement the `Runtime.hydrate` client branch.
5. Implement the server document resolver and layout inputs.
6. Add the SSR and SSG greeting routes.
7. Add packed-consumer, browser, and full repository verification.
8. Update README, changelog, and release metadata.
9. Release `@opsydyn/astro-foldkit` as a minor version without changing existing islands.

## Out of scope

- Server execution of FoldKit Commands or Subscriptions.
- A generalized server data-loading/cache API.
- Automatic migration of existing `client:load` applications.
- Making every chart hydratable or page-owning.
- Adding Astro or request dependencies to `@opsydyn/foldkit-viz`.
- Replacing Astro’s adapter or Cloudflare deployment host.
- A fallback mode that hides SSR failures.
