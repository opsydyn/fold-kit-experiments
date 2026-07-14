# Astro Production Boundary Design

**Status:** Approved

**Goal:** Make `@opsydyn/astro-foldkit` a typed, lifecycle-safe Astro host for FoldKit applications before extending it with route transitions or additional chart APIs.

## Context

The current integration mounts a loaded application through `Runtime.makeApplication` and disposes it on `astro:unmount`. The public config in `src/types.ts` uses `any` for `update` and `view`, while `src/server.ts` returns an empty string from `renderToStaticMarkup`. This makes the package usable for a client-only demo but leaves the SSR contract implicit and weakens consumer type checking.

## Design

### Public application contract

`defineApp` remains the consumer entry point. Its generic parameters describe Astro props, Model, and Message. The loader returns a typed `AppConfig` containing `init`, `update`, and `view`; the integration does not own application state or runtime provisioning.

The public type boundary must not use `any`. Where FoldKit's upstream application type cannot be imported without coupling to an unstable internal type, the package will define the smallest structural contract needed by `Runtime.makeApplication` and preserve the generic types through that contract.

### Server boundary

The Astro renderer will return stable server markup that identifies the FoldKit island and provides a documented loading shell. It will not attempt to execute browser-only FoldKit runtime code during SSR. The output must be deterministic and must not depend on `document`, `window`, or runtime embedding.

The exact shell remains intentionally minimal: the package owns the island boundary, while the consumer owns application-specific loading content through Astro markup or props. The renderer must continue to recognize only values produced by `defineApp`.

### Client lifecycle

The client renderer will load the app once per island instance, embed one runtime handle, and dispose that handle exactly once on `astro:unmount`. Initialization continues to receive Astro props so server-provided data can seed the Model. The package will not add a second application state store.

### Verification

Tests cover the public marker, generic config shape at compile time, renderer recognition, deterministic SSR output, one-time client setup, and disposal. The existing packed-import smoke test remains the consumer boundary check.

## Out of Scope

- FoldKit route transition APIs
- Astro View Transition state preservation
- New `foldkit-viz` primitives
- Runtime dependency injection abstractions
- Broad lint cleanup outside the touched package

## Success Criteria

- `@opsydyn/astro-foldkit` exposes no public `any` in its app contract.
- SSR no longer returns an undocumented empty string.
- The client lifecycle has explicit tests for setup and teardown.
- `bun typecheck`, the focused Astro tests, and the packed import smoke test pass.
