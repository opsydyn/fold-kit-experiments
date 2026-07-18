# Astro Navigation Cancellation Design

## Goal

Extend the request-diagnostics reference application so a removed Astro island
cancels its active metrics request without scheduling a replacement request.
The application owns cancellation policy; `@opsydyn/astro-foldkit` continues to
deliver lifecycle facts and `@opsydyn/foldkit-viz` remains pure and synchronous.

## Scope

This slice changes the request-diagnostics application, focused unit tests, and
consumer documentation. It does not add an Astro integration API, alter Viz
exports, or add remote filtering controls.

## Route-Exit Policy

Only `Navigated({ phase: 'exited' })` requests cancellation. When the explorer
is `Loading`, the application returns only `FetchMetrics.Interrupt(...)`.
`coldLoad`, `entered`, and retained-island `stayed` events do not cancel work.

`stayed` remains metadata-only. It updates the route record while preserving
the active explorer state and existing chart models, so an in-flight request can
complete when the island remains mounted across a diagnostics URL change.

## Cancellation State

The application records cancellation intent in the machine's `Cancelling`
state as one of two reasons:

- `Reload`: a user requested replacement data.
- `RouteExit`: Astro removed the island and work is obsolete.

The fixed `FetchMetrics` interrupt key remains private to the application. The
machine does not infer cancellation policy from the command outcome or Astro
integration state.

## Interrupt Outcome

`CompletedCancelFetchMetrics` is the only event that can complete an interrupt
sequence:

- `Reload` transitions to `Loading` and returns `FetchMetrics()` as a new
  command batch.
- `RouteExit` transitions to `Idle` and returns no commands.

Both `Interrupted` and `NotFound` outcomes follow the recorded reason. This
preserves the existing rule that an interrupt and its replacement must never be
returned in the same update batch. `Idle` ignores late load-result messages.

## Verification

Tests are written before the implementation and cover:

1. `Loading` plus `Navigated(exited)` produces exactly one interrupt command.
2. Its interrupt outcome reaches `Idle` without a replacement fetch.
3. `Ready` plus `Navigated(exited)` produces no interrupt command.
4. `Loading` plus `Navigated(stayed)` preserves active work and chart identity.
5. The Astro client bridge forwards `exited` before disposing a removed island.

The full workspace check, typecheck, and test commands remain the completion
gate.

## Documentation

The web demo README documents the reusable pattern for remote filter, brush,
and zoom loads: use an app-owned interrupt key, record the reason before
interrupting, and schedule a replacement only from the outcome Message.
The Astro README reinforces lifecycle delivery as a facts-only boundary. The
Viz README keeps its existing pure/synchronous guarantee.
