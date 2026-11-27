import { Command } from '@effect/ui';
import { Effect, Schema } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientResponse } from 'effect/http';

import { postLive } from '../stateflow/live';
import { CancellationOutcome, Message } from './message';
import { Point } from './model';

// The request decoder runs under the browser lifetime transport supplied below.
// oxlint-disable-next-line linteffect/no-effect-wrapper-alias
const getMetrics = Effect.gen(function* () {
  const response = yield* HttpClient.get('/api/request-diagnostics');
  const points = yield* HttpClientResponse.schemaBodyJson(Schema.Array(Point))(response);
  return Message.LoadedMetrics({ points });
}).pipe(
  Effect.provide(FetchHttpClient.layer),
  Effect.match({
    onSuccess: (message) => message,
    onFailure: (error) => Message.FailedLoad({ error: String(error) }),
  }),
);

const pageLifetime = Effect.sync(() => {
  const page = globalThis.window;
  const controller = new AbortController();
  const abort = () => controller.abort();
  page?.addEventListener('pagehide', abort, { once: true });
  return { signal: controller.signal, release: () => page?.removeEventListener('pagehide', abort) };
});

export const FetchMetrics = Command.make('FetchMetrics', { args: {}, mode: 'switch' }, () =>
  Effect.gen(function* () {
    const lifetime = yield* Effect.acquireRelease(pageLifetime, ({ release }) =>
      Effect.sync(release),
    );
    const fetch = yield* FetchHttpClient.Fetch;
    const scopedFetch = Object.assign(
      (input: RequestInfo | URL, options?: RequestInit) =>
        fetch(input, {
          ...options,
          signal: options?.signal
            ? AbortSignal.any([options.signal, lifetime.signal])
            : lifetime.signal,
        }),
      fetch,
    );
    return yield* Effect.provideService(getMetrics, FetchHttpClient.Fetch, scopedFetch);
  }).pipe(Effect.scoped),
);

// The runtime interrupts the current command before this fact advances the machine.
// A replacement `switch` request waits for the previous request's scope to close.
export const CancelMetrics = Command.make(
  'FetchMetrics.Interrupt',
  { args: { outcome: CancellationOutcome } },
  ({ outcome }) => Effect.succeed(Message.CompletedCancelFetchMetrics({ outcome })),
);

const encodeMessage = Schema.encodeSync(Schema.fromJsonString(Message));

export function reportDiagnostics(message: Message): void {
  postLive({ specimen: 'request-diagnostics', event: encodeMessage(message) });
}

/** Reports the machine's own events to the observatory on the same origin. */
export const ReportToObservatory = Command.make(
  'ReportToObservatory',
  { args: { message: Message } },
  ({ message }) =>
    Effect.sync(() => {
      reportDiagnostics(message);
      return Message.CompletedReportToObservatory();
    }),
);
