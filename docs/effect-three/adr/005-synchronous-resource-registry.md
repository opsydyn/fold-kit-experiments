# ADR-005: The shared resource registry is a synchronous kernel store, not `RcMap`

- Status: Accepted (2026-10-14). Amends PLAN decision D5.
- Evidence: `packages/effect-three/src/kernel/resources.ts`, Phase 1 property tests

## Context

D5 planned an app-level `ResourceRegistry` Layer backed by Effect's `RcMap`, which provides keyed, reference-counted, scoped resources with an optional idle time-to-live.

In Phase 1 the applier had to be synchronous:

- Foldkit hands the adapter a new description on every render.
- Applying a diff must not interleave with frame rendering.
- The kernel cannot import `effect` (ADR-003).

`RcMap.get` returns an `Effect` that requires a `Scope`, so every acquisition inside a diff would need to run an Effect mid-apply.

## Decision

- Shared and owned GPU resources are managed by the kernel's synchronous `ResourceStore`: reference counts, in-place shared material updates, shared geometry replacement events, exactly-once disposal.
- The runtime's `ResourceRegistry` service is a scoped Layer that creates one store and disposes it when the Layer's scope closes. Several scene runtimes using the same Layer share one store.
- `RcMap` is not used.

## Consequences

- Acquisition and release are allocation-light and synchronous, and they are covered by the kernel property tests (resource balance after every step, zero live resources after dispose).
- **No idle time-to-live:** a shared resource is disposed as soon as its last user releases it. Remounting the last user re-creates it. If remount churn shows up in Phase 4 measurements, a TTL can be added to the store, driven by the frame loop rather than by Effect timers.
- Ownership semantics are unchanged from D5: Owned, Shared, and (later) Borrowed.
