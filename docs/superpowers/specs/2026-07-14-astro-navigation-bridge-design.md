# Astro Navigation Bridge Design

**Date:** 2026-07-14  
**Status:** Approved

## Goal

Make `@opsydyn/astro-foldkit` navigation-aware without adding a router or a second state store, so an embedded FoldKit app can observe Astro View Transition lifecycle events and apply its own route policy.

## Context

`@opsydyn/astro-foldkit` owns the Astro renderer, client hydration, and island disposal. The client currently creates an embedded FoldKit runtime and exposes only its lifecycle disposal internally. FoldKit 0.128.0 exposes inbound ports as the host-to-app boundary, while route transition helpers remain application-owned. Astro owns URL transitions, so the integration must not parse or interpret application routes itself.

## Chosen Architecture

Add a typed, opt-in navigation bridge to the Astro client boundary.

The bridge will:

1. Listen to Astro navigation lifecycle events for the mounted island.
2. Normalize each event into a small package-owned payload:
   - `coldLoad`
   - `entered`
   - `exited`
   - `stayed`
   - `path`
   - `previousPath`
3. Map that payload through an app-provided function into the value accepted by a declared FoldKit inbound port.
4. Send the mapped value through the embedded handle while the island is mounted.
5. Remove listeners and stop forwarding after `astro:unmount`.

The integration will not synthesize an application `Message` union. Each app owns its message naming, route parser, and policy for whether a phase should trigger loading. FoldKit route helpers such as `Route.isEntering` and `restString` remain in the app package where the route type is known.

## Public Contract

The client renderer will accept an optional navigation configuration alongside the loaded app config:

```ts
type NavigationPhase = 'coldLoad' | 'entered' | 'exited' | 'stayed';

type NavigationEvent = {
  readonly phase: NavigationPhase;
  readonly path: string;
  readonly previousPath: string | null;
};

type NavigationConfig<Value> = {
  readonly port: string;
  readonly map: (event: NavigationEvent) => Value;
};
```

The loaded FoldKit app remains responsible for declaring the inbound port named by `port`. The adapter will fail closed when the configured port is absent: the runtime remains mounted and the bridge logs one useful diagnostic rather than throwing during Astro navigation.

The first event emitted for an island is `coldLoad`. Subsequent events are derived from the Astro lifecycle and current URL. A same-document navigation that retains the island emits `stayed`; a navigation that removes it emits `exited` before disposal; a newly mounted island emits `entered` after hydration. The exact event ordering will be encoded in tests rather than inferred by consumers.

## Data Flow

```text
Astro lifecycle event
  -> bridge normalizes pathname and phase
  -> app map(event)
  -> embedded FoldKit inbound port
  -> app Subscription turns port value into Message
  -> update -> Model -> view
```

The bridge is host plumbing only. It does not call `update` directly, mutate the Model, or run Effects. The existing one-shot `astro:unmount` disposal remains the lifecycle boundary.

## Demo Slice

Extend `apps/web` with a route-aware diagnostics example based on the existing `request-diagnostics` app:

- declare a navigation inbound port with a Schema for the normalized event;
- turn port values into a `Navigated` Message through the existing subscription pattern;
- use FoldKit route parsing with a `restString` segment for a repository/document path;
- display the current normalized path, phase, and last transition in the existing diagnostics view;
- add a second route under the shared Astro layout so View Transition navigation can be exercised without leaving the app family.

The example must demonstrate state preservation across a retained island and a clean dispose/remount path when the island is left and re-entered.

## Testing

### Package unit tests

- Normalize initial load to `coldLoad`.
- Map pathname and previous pathname correctly, including a `restString`-style nested path.
- Forward mapped values to the configured inbound port.
- Ignore events after unmount.
- Dispose the runtime once and remove all navigation listeners.
- Leave the app mounted when the configured port is absent.

### Web tests

- Route parser accepts nested repository/document paths and preserves the rest segment.
- Navigation port values become `Navigated` messages.
- The update path records `entered`, `exited`, and `stayed` without replacing unrelated model state.
- Story/Scene coverage exercises cold load and retained-island navigation.

## Non-Goals

- No router implementation in `astro-foldkit`.
- No global navigation store.
- No automatic loading command from the integration.
- No direct runtime dispatch API bypassing FoldKit ports.
- No broad migration of every existing demo app in this slice.

## Acceptance Criteria

- Existing Astro package and web tests remain green.
- A consumer can opt into navigation with a typed mapper and inbound port.
- The route-aware demo visibly reports navigation phase and normalized path.
- Retained islands preserve their FoldKit model through Astro View Transitions.
- Leaving an island disposes its runtime and stops all bridge forwarding.
- `bun run check`, `bun typecheck`, and workspace-filtered tests pass.
