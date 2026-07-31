# FoldKit 0.136 Migration Design

## Goal

Upgrade the workspace to FoldKit 0.136.0 and its required Effect peers while
adopting render-scoped HTML builders, the declarative Command API, and current
test-harness names. Demonstrate the new Document metadata capability in the
standalone Astro Greeting island.

## Scope

This work covers the three workspace packages and the web demo:

- `@opsydyn/astro-foldkit`: public view types, no-meta wrapper, client
  integration fixtures, and published-package compatibility.
- `@opsydyn/foldkit-viz`: compatible FoldKit and Effect peer ranges only. It
  remains framework-free and gains no HTML, Astro, Command, or async concerns.
- `@opsydyn/web`: render-scoped view migration, Command API migration,
  Story/Scene API migration, one subscription-driven scene assertion, and the
  Greeting metadata showcase.

The release combines upstream FoldKit 0.134.0, 0.135.0, and 0.136.0 changes.

## Non-Goals

- Add a new metadata API to `@opsydyn/astro-foldkit`.
- Move request cancellation, HTTP Layers, command keys, or machine policy out
  of `apps/web`.
- Add `Machine` requirements, `ManagedResource`, `CustomElement.emit`, or
  `withViewInputs` without a present local use case.
- Add rendering concerns to `@opsydyn/foldkit-viz`.
- Publish an intermediate package version with a FoldKit 0.136 dependency and
  an older API surface.

## Dependency Contract

All direct FoldKit consumers will use `foldkit@^0.136.0`. The web application
will use the release-required `effect@4.0.0-beta.102` and
`@effect/platform-browser@4.0.0-beta.102`; its FoldKit Vite plugin will move to
the compatible 0.11.2 release.

Published package peer contracts will reject pre-0.136 FoldKit consumers. The
peer range must be limited to the 0.136 minor line rather than retain the
current open-ended pre-1.0 lower bound. `foldkit-viz` retains an Effect peer
contract compatible with its existing public types, with the minimum raised to
beta.102.

The current uncommitted 0.130 dependency diff is superseded by this migration;
it is neither reverted nor committed as a separate release.

## Render-Scoped HtmlBuilder

FoldKit 0.134 removes `html<Message>()`. Every root view, shared view helper,
Submodel view, Storybook mount wrapper, and Scene fixture receives an
`HtmlBuilder<Message>` as its final render-frame argument. Callers pass that
same builder through; no module-level builder is created or retained.

`inertHtml` is allowed only for handler-free module-level attributes. It is not
a substitute for the supplied builder within a render.

`@opsydyn/astro-foldkit` derives its public view type from FoldKit runtime
types where possible, rather than duplicating the renderer signature. Its
`makeNoMetaView` accepts and forwards the builder, changes only the returned
title, and preserves `lang`, `dir`, and all other Document fields. The existing
Astro lifecycle and navigation bridge remain unchanged.

## Command Migration

FoldKit 0.136 replaces positional command definitions and removes
`Command.Interruptible.define`. The following definitions use the object form:

- `FetchHealth`
- `SaveUsername`
- `LoadSlides`
- `SpawnParticle`
- `FetchMetrics`

`FetchMetrics` becomes a normal `Command.define` with `interrupt: true`,
`messages: [LoadedMetrics, FailedLoad]`, and its existing provided HTTP Effect
in `execute`. It has one meaningful in-flight instance, so the command name is
the correct key. The `FetchMetrics.Interrupt(...)` constructor and
`CompletedCancelFetchMetrics` outcome handling remain unchanged.

`Http.layer` remains provided at the exported command Effect boundary. The
request-diagnostics machine continues to own the interrupt key, cancellation
intent, and reload-versus-route-exit policy.

## Test-Harness Migration

The counter test suite renames `Scene.with` and `Story.with` to `given` at all
call sites. Existing direct-message stories remain valid. One Scene test uses
`Subscription.emit(TickedFrame(...))` to identify the animation-frame message
as subscription-originated while exercising the same update and render path.

The request-diagnostics tests remain the regression boundary for a loading
request on route exit, completion after route exit, and retained-island stayed
navigation. The command migration must preserve their command identity and
interrupt outcome behaviour.

## Greeting Metadata Showcase

The existing standalone `/greeting` page is the demonstration surface. Its
model changes from a scalar name to a record containing `name` and `locale`.
It starts in English with `lang: "en"` and `dir: "ltr"`.

Two controls dispatch a past-tense `SelectedLocale` Message to choose English
LTR or Arabic RTL. The root FoldKit view returns the corresponding Document
`lang` and `dir` values with its body. The island does not use `noMeta`, because
this page deliberately owns its document metadata after hydration. Embedded
chart islands retain their existing `noMeta` policy.

The Astro page establishes English for SSR first paint. After `client:load`,
the Greeting app updates the browser document root in response to its own
Message. This boundary is documented: Astro controls the initial server HTML;
the hydrated FoldKit root view controls subsequent Document metadata.

## Delivery and Verification

The compatibility work is one atomic, green commit because the version bump
and all three upstream breaking API migrations must compile together. The
Greeting demonstration is a second, green commit built on that compatibility
base.

Each deliverable uses focused red-green tests before the workspace gates. The
release gate runs sequentially because package builds clean shared `dist`:

1. `bun run check`
2. `bun typecheck`
3. `bun run test`
4. `bun run build`
5. `bun run --filter @opsydyn/web build-storybook`
6. isolated packed-consumer smoke tests for both published packages
7. `git diff --check`

Raw `bun test` is not a release gate because it traverses the vendored
`foldkit-main` checkout.

## Acceptance Criteria

- No `html<Message>()`, `Command.Interruptible.define`, `Scene.with`, or
  `Story.with` remains in owned source.
- The Astro public AppConfig type and no-meta wrapper compile against the
  FoldKit 0.136 render signature.
- Route-exit cancellation still interrupts only the active metrics command and
  does not start a replacement request after exit.
- `/greeting` switches the hydrated document root between English/LTR and
  Arabic/RTL through FoldKit Messages.
- Workspace, production, Storybook, package-consumer, formatting, and diff
  gates pass.
