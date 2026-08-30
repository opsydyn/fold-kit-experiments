# FoldKit 0.155 Migration Design

**Status:** Draft for review
**Date:** 2026-08-30

## Goal

Move the monorepo from its current FoldKit 0.148-era contracts to
`foldkit@0.155.0` while keeping the boundaries between the Astro integration,
the pure visualization package, and the demo application explicit.

The migration includes the cumulative breaking changes from FoldKit 0.149,
0.151, 0.153, and 0.155. It is one coordinated public migration with
separately reviewable implementation commits and no intermediate public
releases.

## Context

The current checkout still contains the older contracts:

- `foldkit@^0.148.0`, Effect `4.0.0-rc.109`, and the older Vite plugin line.
- `m(...)` message declarations in the demo application.
- `r(...)` route declarations and `ts(...)` tagged-state declarations.
- Tuple-shaped `init`, `update`, component, and test-harness results.
- Five positional/currying `Mount.define` declarations in chart primitives.
- `Match.tagsExhaustive` handlers for values that will become FoldKit-owned
  message, route, or tagged unions.
- Astro public types and fixtures that still describe tuple-shaped runtime
  results.

FoldKit's relevant release notes are:

- [0.149.0](https://github.com/foldkit/foldkit/releases/tag/foldkit@0.149.0):
  replaces `m` with `defineMessageUnion`.
- [0.151.0](https://github.com/foldkit/foldkit/releases/tag/foldkit@0.151.0):
  changes runtime and update results from tuples to records.
- [0.152.0](https://github.com/foldkit/foldkit/releases/tag/foldkit@0.152.0):
  requires Effect `4.0.0-rc.112`.
- [0.153.0](https://github.com/foldkit/foldkit/releases/tag/foldkit@0.153.0):
  replaces `r` and `ts` with namespace-owned union helpers and updates union
  constructor linting.
- [0.155.0](https://github.com/foldkit/foldkit/releases/tag/foldkit@0.155.0):
  changes `Mount.define` and `Mount.defineStream` to named configuration
  objects and adds mount element-use linting.

## Decisions

### Dependency and package contract

The workspace targets:

- `foldkit@0.155.0`.
- Effect `4.0.0-rc.112` and the matching
  `@effect/platform-browser` release.
- A `@foldkit/vite-plugin` release whose peer metadata accepts FoldKit 0.155
  and Effect `rc.112`; the currently identified line is `^0.19.0` and will be
  verified during installation.
- A 0.155-compatible `@foldkit/oxlint-plugin` line; the currently identified
  registry line is `^0.9.0` and will be verified during installation.

Package release floors are:

- `@opsydyn/astro-foldkit` `0.7.0`, with
  `foldkit >=0.155.0 <0.156.0` as its tested peer range. Its public
  `AppConfig` result contract changes, so this is a package minor in the
  repository's pre-1.0 release policy.
- `@opsydyn/foldkit-viz` `0.9.0`, with FoldKit and Effect compatibility ranges
  raised to the new floor. Its published visualization source remains
  framework-free and has no new FoldKit runtime dependency.

The exact dependency metadata and lockfile are resolved before source
migration. Unsupported combinations must fail at package installation or
typecheck rather than being accepted by a compatibility shim.

### Message, tagged, and route unions

Each message module defines one namespace-owned message union:

```ts
export const Message = defineMessageUnion({
  ClickedReload: {},
  SettledMetrics: { result: Schema.Unknown },
});

export type Message = typeof Message.Type;
```

Call sites use `Message.ClickedReload()` and
`Message.SettledMetrics({ result })`. A no-field constructor receives no
argument; the declaration still uses `{}` to describe its fields.

Domain states use `defineTaggedUnion`, for example
`ExplorerState.Loading()` and `HealthState.Loaded({ data, elapsedMs,
sinceLabel })`.

URL-facing route variants use `defineRouteUnion`. The request-diagnostics
URL parser remains separate from the normalized application route union:

- the parser owns `Index`, `NotFound`, and `Path`;
- the normalized application route owns `Index` and `Document`.

This prevents a normalized `Document` value from being incorrectly treated as
a route-parser variant that can be printed without a defined URL mapping.

FoldKit-owned unions are matched through their own exhaustive `.match` method.
Effect `Match` remains available for non-FoldKit unions and partial matches.
The migration removes the obsolete
`foldkit/message-binding-matches-tag` rule and enables the 0.155 mount rule.

Existing nested APIs are consumed through their 0.153 namespaces, including
`Navigation.UrlRequest.Internal` and
`Interruptible.Outcome.Interrupted`.

### Runtime records and Astro boundary

All application and component producers return records:

```ts
return { model: nextModel };

return {
  model: nextModel,
  commands: [FetchMetrics()],
};
```

`commands` is omitted when no commands are statically produced. Computed
command collections remain present even when they are empty. Literal
`commands: []` is not used.

Consumers retain the complete result and access `.model` and
`.commands ?? []`. Record destructuring is not used as a replacement for
tuple destructuring. `Update.combine` and `Update.foldChild` are used when
dependent child operations need to compose their results.

`Machine.step` remains in request-diagnostics because the application needs
the distinction between `Transitioned` and `Ignored`. Any `Machine.transition`
consumer uses its record result directly.

Carousel's optional third tuple slot becomes the 0.155
`Update.ReturnWithOutMessage` record. Parent code explicitly preserves or
handles `outMessage`; it must not silently discard it.

`@opsydyn/astro-foldkit` changes its public `AppConfigShape` and `AppConfig`
types to the record contract. Client model inference uses
`ReturnType<Config['init']>['model']`, and server/client adapters pass the
record result through without reintroducing tuple assumptions. The public
root, `define-app`, `define-page`, and `server` exports remain stable.

### Mount migration

The five existing chart measurement mounts migrate from the positional form:

```ts
Mount.define('CaptureChartBounds', RecordedChartBounds)(element =>
  Effect.sync(() => RecordedChartBounds(readBounds(element))),
);
```

to the 0.155 named form:

```ts
Mount.define('CaptureChartBounds', {
  messages: [Message.RecordedChartBounds],
  execute: ({ element }) =>
    Effect.sync(() => Message.RecordedChartBounds(readBounds(element))),
});
```

Every mount must read or pass its `element` to the effect that performs the
DOM work. The `foldkit/mount-factory-must-use-element` rule verifies this
boundary. No mount abstraction is added to either published package; the
mounts belong to the demo application's chart UI layer.

### Package boundaries

`@opsydyn/astro-foldkit` continues to own Astro lifecycle, client islands,
server rendering, hydration, and public AppConfig typing. The 0.155 renderer
metadata caching improvements are consumed as an upstream implementation
benefit; this migration does not add a second Astro rendering abstraction.

`@opsydyn/foldkit-viz` remains pure geometry and chart primitives. Its source
does not import FoldKit or Astro. Its test harness and compatibility fixtures
may describe FoldKit record results, but the package does not gain Commands,
server rendering, request context, or `experimental/machine` runtime logic.

The request-diagnostics cancellation policy remains app-owned. Astro supplies
lifecycle facts only; the app owns interrupt keys, cancellation intent, and
state-machine behavior.

## Scope

The implementation covers:

- workspace dependency and peer-range updates;
- all demo-app message declarations and constructor imports;
- FoldKit domain and route union declarations;
- FoldKit union `.match` migration where current handlers use
  `Match.tagsExhaustive`;
- the five chart `Mount.define` sites;
- application, component, carousel, Storybook, and test-harness record returns;
- Astro public types, client/server adapters, package fixtures, and packed
  import smoke tests;
- request-diagnostics cancellation regression coverage;
- FoldKit-viz compatibility tests and package documentation;
- current READMEs, `AGENTS.md`, roadmap guidance, and release notes.

Historical migration specs and plans remain historical records and are not
rewritten.

## Out of scope

The following 0.155 changes have no current usage in this repository and are
deferred:

- `FieldValidation.match` adoption;
- `ChildAttribute` support in `CustomElement.define`;
- `CustomElement.define` migration itself;
- `Dom.closeDialog` result handling;
- `expectOutMessages` scene assertion migration;
- adopting `@foldkit/ui` or adding new UI components;
- adopting FoldKit's upstream Node 26, TypeScript 7, or Happy DOM development
  versions unless the package or CI compatibility check requires it.

No new server-side data-loading behavior, HTTP abstraction, or Machine-based
visualization API is introduced by this migration.

## Migration order

1. Establish the current typecheck, lint, and test baseline without modifying
   user changes.
2. Raise dependency and peer floors to FoldKit 0.155 and Effect `rc.112`,
   install the compatible tooling, and update the lockfile.
3. Convert message declarations and their constructors, then replace
   FoldKit message matching with `Message.match`.
4. Convert tagged domain and route unions, including normalized route mapping
   and nested Navigation/Interruptible constructors.
5. Convert the five chart mounts to the named 0.155 configuration.
6. Convert runtime records across the demo app, carousel, Astro package, viz
   harness, Storybook fixtures, and tests.
7. Add or update focused tests, docs, packed-package checks, and SSR smoke or
   performance evidence.
8. Run release verification, update package versions and release metadata, and
   publish only after all required gates pass.

Each step should leave a coherent, reviewable commit. Automated transforms may
be used for repetitive namespace changes, but they must be followed by
TypeScript, lint, and targeted test inspection. Tuple-shaped numeric/chart
data is not part of this migration and must not be changed by broad text
replacement.

## Verification

### Contract checks

- No production imports or declarations remain for the removed `m`, `r`, or
  `ts` helpers.
- No old positional `Mount.define` or `Mount.defineStream` call remains.
- No no-field FoldKit constructor is called with `{}`.
- FoldKit union values are matched through their own `.match` method where the
  union owns the declaration.
- No published `foldkit-viz` source file imports FoldKit or Astro.
- Workspace and packed package entrypoints resolve the same public types.

### Behavioral tests

- Message and domain union constructors produce the expected `_tag` values.
- URL route parsing, fallback, normalization, and mapping retain current
  behavior.
- Record returns omit or include `commands` according to static/computed
  production rules.
- Carousel `outMessage` is preserved through child composition.
- Request-diagnostics exit during loading interrupts the active metrics
  request exactly once and does not start a replacement request.
- Exit after metrics completion does not interrupt.
- Retained-island stayed navigation does not count as a route exit.
- Astro root, `define-app`, `define-page`, and `server` package imports resolve
  from a packed artifact.
- Astro SSR output and client hydration smoke tests remain valid.

### Required gates

Run the repository-defined commands:

```sh
bun run check
bun typecheck
bun test
```

The final report distinguishes any pre-existing repository lint baseline from
migration-specific diagnostics. A release is not declared green while a
migration-specific error remains, even if unrelated warnings are known.

## Release policy

The coordinated release publishes:

- `@opsydyn/astro-foldkit@0.7.0`;
- `@opsydyn/foldkit-viz@0.9.0`.

The demo app is validated against the packed package artifacts before release.
No compatibility shim or intermediate 0.149/0.151/0.153 public release is
published from this migration branch.

## Risks and mitigations

- **Large message and constructor surface:** migrate one module family at a
  time and use compiler errors plus targeted searches to find stale imports.
- **Tuple-shaped data collisions:** change only FoldKit result contracts and
  explicit harness types; leave chart domains, ranges, and coordinate tuples
  untouched.
- **OutMessage loss during record conversion:** test carousel composition and
  inspect every child-result consumer rather than only changing producers.
- **Route/parser ambiguity:** keep URL parser routes and normalized application
  routes as separate unions.
- **Dependency metadata drift:** verify published peer metadata and packed
  exports after installation instead of relying on workspace resolution.
- **SSR confidence overstatement:** treat upstream renderer improvements as
  smoke/performance evidence, not as proof of deployment behavior.
