# Opt-In Astro FoldKit Server Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `definePage` path to `@opsydyn/astro-foldkit` that renders FoldKit HTML during Astro SSG/request SSR and hydrates that exact handoff in the browser, while leaving `defineApp` and `lazyApp` client islands unchanged.

**Architecture:** Keep Astro responsible for request and island lifecycle facts. Keep the page marker, synchronous public Flags factory, build identity, server render handoff, metadata resolver, and hydration dispatch inside `@opsydyn/astro-foldkit`. Use FoldKit `0.148.x` `Server.renderToString` on the server and `Runtime.hydrate` in the browser. Keep `@opsydyn/foldkit-viz` framework-free and change only its FoldKit peer compatibility and deterministic fixtures.

**Tech Stack:** Bun workspaces, Astro 7.1.1, TypeScript 6, FoldKit 0.148.x, `@foldkit/vite-plugin` 0.16.x, Effect V4 beta, Astro Cloudflare adapter, Vitest/Bun tests, Oxlint, Oxfmt, release-please.

**Spec:** `docs/superpowers/specs/2026-08-18-astro-foldkit-opt-in-server-rendering-design.md`

## Global Constraints

- `defineApp` and `lazyApp` retain their current marker shape, client-only server shell, `noMeta`, navigation, and one-shot disposal behavior.
- `definePage` is a separate opt-in. Do not make existing Astro components hydratable or server-rendered by changing the default integration behavior.
- The page Flags factory is synchronous and returns public JSON-serializable data. It must not run FoldKit Commands, subscriptions, remote loads, or browser resources on the server.
- Use static imports for package-owned runtime dependencies. The only lazy module loading allowed is the existing user-declared literal `() => import('./main')` loader contract on an app/page marker.
- Pass one explicit build ID through the FoldKit Vite plugin, server render, and client hydrate paths. Missing or mismatched identity must fail closed.
- Do not add Astro, `Request`, or Effect runtime ownership to `@opsydyn/foldkit-viz`.
- Keep server-only exports out of the client entry and do not import `@opsydyn/astro-foldkit/server` from browser code.
- Do not hand-edit generated changelogs or release versions; use the repository's release-please flow after the package manifests and documentation are correct.

---

## Task 1: Pin the compatibility and build surfaces

**Files:** `packages/astro-foldkit/package.json`, `packages/astro-foldkit/tsdown.config.ts`, `packages/foldkit-viz/package.json`, `apps/web/package.json`, `bun.lock`

- [ ] Update `packages/astro-foldkit` to `foldkit: ^0.148.0`, `@foldkit/vite-plugin: ^0.16.0`, and a direct `effect` runtime dependency matching the repository's Effect V4 beta (`4.0.0-beta.102` at the current checkout).
- [ ] Narrow `@opsydyn/astro-foldkit`'s FoldKit peer range to `>=0.148.0 <0.149.0`; retain the existing Astro peer range.
- [ ] Update `@opsydyn/foldkit-viz`'s dev dependency and peer range from the `0.136.x` line to `>=0.148.0 <0.149.0`, leaving its Effect peer policy and no-Astro boundary intact.
- [ ] Update the web app's direct `foldkit` and `@foldkit/vite-plugin` versions to the same compatibility line so the demo does not resolve a stale transitive plugin.
- [ ] Add `define-page` and a separate public server entry to `tsdown.config.ts`. Keep the Astro renderer output as `dist/server.mjs`; emit the public `./server` API from a different source entry so the package export never points consumers at Astro's renderer module.
- [ ] Add package exports and `typesVersions` entries for `./define-page` and `./server`, with `./server` mapped to the public resolver entry and not to the renderer entry.
- [ ] Run `bun install` and inspect the lockfile to confirm one FoldKit 0.148.x line and one matching Vite plugin line are selected.
- [ ] Verify the package builds before any web-app consumer command: `bun run --filter @opsydyn/astro-foldkit build`.

## Task 2: Add the explicit `definePage` marker and types

**Files:** `packages/astro-foldkit/src/define-page.ts`, `packages/astro-foldkit/src/types.ts`, `packages/astro-foldkit/src/define-app.ts`, `packages/astro-foldkit/test/unit/define-page.test.ts`

- [ ] Define `PageFlagsContext<Props>` with `request: Request`, `url: URL`, `params: Readonly<Record<string, string | undefined>>`, and validated `props: Props`.
- [ ] Define a page configuration type that exposes the FoldKit server/client contract: `Flags` Schema value, `init(flags)`, `update`, and `view(model, h)`. Keep `Flags` required because FoldKit uses it to decode the serialized handoff.
- [ ] Implement `definePage<Props, Flags>(load, { flags })` with the same literal loader shape as the existing app marker and a distinct marker discriminant such as `__foldkitPage: true`. Preserve the loader without invoking it at marker-construction time.
- [ ] Keep `defineApp`/`lazyApp` implementation and exported types independent from page types. Do not widen the existing app marker into a union that would let client-only apps accidentally enter the server path.
- [ ] Export `definePage` and its public types from `./define-page`; export only server-safe resolver types/functions from `./server`.
- [ ] Add unit coverage for marker identity, loader preservation, synchronous Flags factory typing, and rejection of a page configuration without a Flags codec.

## Task 3: Implement the FoldKit server handoff and build identity

**Files:** `packages/astro-foldkit/src/build-id.ts`, `packages/astro-foldkit/src/server-render.ts`, `packages/astro-foldkit/src/server.ts`, `packages/astro-foldkit/src/index.ts`, `packages/astro-foldkit/tsdown.config.ts`, `packages/astro-foldkit/test/unit/server.test.ts`, `packages/astro-foldkit/test/unit/server-render.test.ts`

- [ ] Add one internal build-ID reader that consumes the Vite-injected `import.meta.env.FOLDKIT_BUILD_ID`, rejects an absent/empty value, and exposes the same value to server and client entry code. Keep the default `development` value in integration configuration, not as a hidden renderer fallback.
- [ ] Add a shared server render helper that statically imports `Effect` and `renderToString` from `foldkit/experimental/server`, calls `renderToString({ Flags, init, view }, { flags, buildId })`, and unwraps the Effect with `Effect.runPromise`.
- [ ] Extend the Astro renderer's `check` to accept either the existing `__foldkit` marker or the new `__foldkitPage` marker.
- [ ] For `definePage`, read `request`, `url`, `params`, and component props from Astro's renderer result, call the synchronous Flags factory, load the page module, and return the FoldKit-rendered HTML. Do not call `update`, `Command`, `Subscription`, or the existing client shell path.
- [ ] Preserve the current deterministic `<div data-foldkit-island="true"></div>` result for `defineApp` and all invalid/non-FoldKit components.
- [ ] Track page ownership per Astro result so a single document cannot render two page-owner markers. Reject the second owner before emitting HTML; do not introduce a request-scoped render cache.
- [ ] Update `foldkit()` integration options to accept `{ server: { buildId: string } }` and pass that value to `foldkitVitePlugin({ buildId })`. Keep Astro's host SSR configuration in charge; do not enable the Vite plugin's standalone server mode.
- [ ] Add tests for marker dispatch, request context forwarding, HTML handoff markers, missing build ID, invalid Flags, duplicate page owners, and unchanged `defineApp` shell output.

## Task 4: Expose the server document resolver

**Files:** `packages/astro-foldkit/src/server-document.ts`, `packages/astro-foldkit/src/server-public.ts`, `packages/astro-foldkit/test/unit/server-document.test.ts`, `packages/astro-foldkit/package.json`, `packages/astro-foldkit/tsdown.config.ts`

- [ ] Implement `resolvePageDocument(page, { request, url, params, props })` as the public server-only API. It must load the page module, derive Flags with the same context and factory used by the renderer, execute the same deterministic FoldKit render pipeline, and return `RenderedApplication` metadata (`title`, optional `lang`, `dir`, `canonical`, `ogUrl`).
- [ ] Keep the public resolver call to two user-facing arguments; obtain the configured build ID through the package's internal build-ID module rather than requiring layouts to repeat deployment configuration.
- [ ] Export `resolvePageDocument` from `@opsydyn/astro-foldkit/server` through the public server entry. Ensure its emitted module is not reachable through `dist/client.mjs` or the root browser renderer import.
- [ ] Make metadata mapping preserve FoldKit's `dir` values (`ltr`, `rtl`, `auto`) and distinguish absent optional fields from empty values.
- [ ] Add tests proving the resolver passes request/URL/params/props to Flags, returns the page Document metadata, uses the same build ID, and does not alter the existing `noMeta` island behavior.

## Task 5: Add the page-owner hydration branch

**Files:** `packages/astro-foldkit/src/client.ts`, `packages/astro-foldkit/src/client-helpers.ts`, `packages/astro-foldkit/test/unit/client.test.ts`, `packages/astro-foldkit/test/unit/client-helpers.test.ts`

- [ ] Extend the client marker type and island test doubles with the DOM query operation needed to locate stamped FoldKit roots.
- [ ] Keep the existing `defineApp` branch on `Runtime.makeApplication` plus `Runtime.embed`, including its props-to-init override, navigation ports, `noMeta` handling, and one-shot dispose on `astro:unmount`.
- [ ] For `definePage`, load the module, call `Runtime.makeApplication` with the page config unchanged so FoldKit owns Flags decoding, require exactly one stamped FoldKit root inside the Astro island, and call `Runtime.hydrate(application, { buildId })`.
- [ ] Do not call `Runtime.embed`, create a second application, or install the `defineApp` disposal path for a page owner. Let hydration refusal surface without falling back to a fresh client Model over server HTML.
- [ ] Keep static imports for `Runtime` and build identity. Do not add a runtime module-name lookup or dynamic import of the package's server API.
- [ ] Test app/page dispatch, exact `hydrate` arguments, root-count failure, build-ID forwarding, and the unchanged navigation/disposal expectations for existing app islands.

## Task 6: Migrate the greeting example to prove request SSR and SSG

**Files:** `apps/web/src/apps/greeting/page.ts`, `apps/web/src/apps/greeting/main.ts`, `apps/web/src/apps/greeting/model.ts`, `apps/web/src/apps/greeting/view.ts`, `apps/web/src/pages/greeting.astro`, `apps/web/src/pages/greeting-static.astro`, `apps/web/src/layouts/Layout.astro`, `apps/web/astro.config.ts`

- [ ] Add a `GreetingPage` marker using `definePage` and a literal loader. Its Flags factory must derive `name` from validated props and `locale` from the request URL, accepting only the existing `en`/`ar` values and defaulting safely to `en`.
- [ ] Export a `Flags` Schema/value from the greeting module and change `init` to consume Flags directly. Keep `update` and the FoldKit view pure; do not move request parsing into the app update loop.
- [ ] Change the greeting Document metadata to use lowercase FoldKit direction values and provide deterministic `title`, `lang`, `dir`, and optional canonical/Open Graph URL fields.
- [ ] Update `greeting.astro` to call `resolvePageDocument` with `Astro.request`, `Astro.url`, `Astro.params`, and the same props passed to `GreetingPage`, then render `<GreetingPage client:load ... />` inside the layout. Keep it request-rendered.
- [ ] Add `greeting-static.astro` with `export const prerender = true` and fixed universal props/Flags to prove the SSG path without request-only inputs.
- [ ] Extend `Layout.astro` to accept resolver metadata and own only the outer HTML structure; render `lang`, `dir`, title, canonical, and Open Graph tags from the resolver values.
- [ ] Pass `{ server: { buildId: process.env.FOLDKIT_BUILD_ID ?? 'development' } }` in `apps/web/astro.config.ts` and leave existing chart/diagnostics routes on `defineApp`.
- [ ] Ensure the app's build/typecheck scripts continue to build `@opsydyn/astro-foldkit` before Astro evaluates the package exports.

## Task 7: Prove package exports, Astro output, and browser hydration

**Files:** `packages/astro-foldkit/test/integration/package-import-smoke.test.ts`, `packages/astro-foldkit/test/integration/astro-page-smoke.test.ts`, `packages/astro-foldkit/test/fixtures/page-app/`, `apps/web/test/`, `packages/foldkit-viz/test/`

- [ ] Extend the packed-consumer fixture to import the root, `./define-app`, `./define-page`, and `./server` exports under both Bun and Node, and compile a consumer that uses `definePage` and `resolvePageDocument` types.
- [ ] Add a built Astro fixture that renders one request-SSR page and one prerendered page. Assert that each response contains greeting text, exactly one FoldKit stamped root, the build marker, and the serialized Flags handoff before JavaScript runs.
- [ ] Assert that a page Document's metadata reaches the outer layout while existing `defineApp` output remains the client-only shell.
- [ ] Add a browser smoke test for reload/hydration: observe the existing server DOM being adopted, then perform one locale interaction and verify the live FoldKit update loop. Treat static output as insufficient evidence for this claim.
- [ ] Add negative fixture coverage for missing build identity, duplicate page owners, non-serializable Flags, and a page configured without a server Flags codec.
- [ ] Add one deterministic FoldKit 0.148-compatible fixture to `@opsydyn/foldkit-viz` tests without adding Astro or server runtime imports; retain D3 parity assertions for any changed chart math.

## Task 8: Update documentation and release metadata

**Files:** `packages/astro-foldkit/README.md`, `packages/foldkit-viz/README.md`, `README.md`, `.release-please-manifest.json`, `release-please-config.json`

- [ ] Document the distinction between `defineApp`/`lazyApp` client islands and opt-in `definePage` page owners.
- [ ] Add the complete `definePage`, `Flags`, Astro `client:load`, `foldkit({ server: { buildId } })`, and `resolvePageDocument` examples, including the rule that server Flags are public and synchronous.
- [ ] Document the SSG/request SSR failure policy, one-page-owner constraint, hydration boundary, and explicit exclusion of server Commands/data loading.
- [ ] Update the FoldKit compatibility tables and viz package notes to `0.148.x`. Do not claim server rendering support for `@opsydyn/foldkit-viz`.
- [ ] Keep CHANGELOG edits release-please-owned; use a conventional package-scoped commit and confirm the release configuration will produce a minor `@opsydyn/astro-foldkit` release for the new opt-in API.

## Task 9: Run the release gates and review the diff

**Files:** repository-wide verification only; no additional source files

- [ ] Run focused tests first: `bun run --filter @opsydyn/astro-foldkit test:unit`, `bun run --filter @opsydyn/astro-foldkit test:integration`, and `bun run --filter @opsydyn/foldkit-viz test`.
- [ ] Run `bun run check` and resolve all Oxlint errors and Oxfmt changes without suppressions or Biome commands.
- [ ] Run `bun typecheck` and confirm the package build ordering resolves `@opsydyn/astro-foldkit` before `@opsydyn/web` Astro config loading.
- [ ] Run `bun test` and `bun run build`, then inspect the generated package tarball with the packed-consumer fixture.
- [ ] Run the browser smoke against the built Astro app and record the route, build ID, server HTML, and hydration interaction as direct evidence.
- [ ] Review `git diff --check`, package export maps, generated `dist` entries, and the release-please diff before committing implementation work.

## Completion Criteria

- Existing `defineApp`/`lazyApp` routes and tests retain their current behavior.
- A `definePage` route emits FoldKit HTML plus serialized Flags during both request SSR and SSG.
- The browser calls `Runtime.hydrate` against the existing stamped root with the same build ID; it does not start a replacement app.
- FoldKit Document metadata reaches Astro's outer document through the explicit server resolver.
- Packed Bun/Node consumers resolve every new public subpath, and the full check/typecheck/test/build gates pass.
- The release notes describe the opt-in boundary and the package is ready for the release-please minor release.
