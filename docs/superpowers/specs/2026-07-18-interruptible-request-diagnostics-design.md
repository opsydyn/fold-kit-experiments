# Interruptible Request Diagnostics Design

## Goal

Use FoldKit 0.129's interruptible Commands in the request diagnostics demo so a reload replaces an in-flight metrics request without allowing stale results to update the application.

## Scope

This slice changes only `apps/web/src/apps/request-diagnostics/`. It demonstrates app-owned cancellation with the existing `foldkit/http` API client and does not add an Astro integration API, remote chart-data API, or new query controls.

## Command Boundary

`FetchMetrics` becomes `Command.Interruptible.define`. Its key is a fixed diagnostics-dataset identity because every invocation loads the same `/api/request-diagnostics` resource. The command remains responsible only for HTTP work and maps its success and failure results to the existing `LoadedMetrics` and `FailedLoad` Messages.

The application owns interruption. `FetchMetrics.Interrupt` is dispatched from the update layer, not from the Astro integration or chart primitives.

## Message Flow

1. Initialisation dispatches `FetchMetrics()` and the runtime registers that invocation under the diagnostics key.
2. A `ClickedReload` Message in `Loading`, `Ready`, `Filtered`, or `Failed` transitions the explorer to `Loading` and returns only `FetchMetrics.Interrupt`.
3. The interrupt command dispatches a new past-tense fact carrying its outcome.
4. The update handler for that fact dispatches `FetchMetrics()` as the replacement request.
5. A successfully interrupted request cannot dispatch `LoadedMetrics` or `FailedLoad`; the replacement result completes the usual state-machine transition.

The update must never return the interrupt command and its replacement in the same batch because command execution order inside a batch is not guaranteed.

## State and UI

No new explorer state is required. The existing `Loading` state represents both the cancellation window and the replacement request. The existing reload control stays enabled so a user can replace an in-flight request.

## Error Handling

The existing HTTP failure mapping remains unchanged. The interrupt outcome is observational: both `Interrupted` and `NotFound` start the requested replacement load. `NotFound` means the old request had already completed or was no longer registered; it is not an application error.

## Tests

- Command test: `FetchMetrics` still decodes the Astro API response when provided a fetch client.
- Update tests: reload during loading returns only the interrupt command, and the interrupt outcome returns the replacement fetch command.
- Existing state-machine tests continue to prove the successful and failed request transitions.

## Non-Goals

- Query or typeahead controls.
- Cancelling work on Astro route exit.
- Any change to `@opsydyn/astro-foldkit` or `@opsydyn/foldkit-viz` public APIs.
