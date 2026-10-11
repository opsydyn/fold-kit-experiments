import type { BaseEvent } from '@ag-ui/core';
import { RunAgentInputSchema } from '@ag-ui/core/schemas';
import { EventEncoder } from '@ag-ui/encoder';
import { Data, Effect, Exit, Schema, Stream } from 'effect';

import { Scenario, THREAD_ID } from '../../apps/agent-analysis/contract';
import { fixtureEvents, type FixtureInput } from './fixtures';

export type ResponseObservation =
  | { readonly _tag: 'Emitted'; readonly eventType: BaseEvent['type'] }
  | { readonly _tag: 'Disposed'; readonly cause: 'Completed' | 'Aborted' | 'Cancelled' };
export type ResponseObserver = (observation: ResponseObservation) => void;

function fixtureProducer(
  input: FixtureInput,
  signal: AbortSignal,
  encoder: EventEncoder,
  observe?: ResponseObserver,
) {
  const scoped = Effect.gen(function* () {
    const bytes = new TextEncoder();
    let aborted = false;
    const listen = Effect.withFiberSucceed((fiber) => {
      const abort = () => {
        aborted = true;
        // Interrupt the bridge owner even while its downstream pull is backpressured.
        // This native callback must not start a second runtime or handler-owned fiber.
        fiber.interruptUnsafe();
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      return abort;
    });
    yield* Effect.acquireRelease(listen, (abort, exit) =>
      Effect.sync(() => {
        signal.removeEventListener('abort', abort);
        if (aborted) observe?.({ _tag: 'Disposed', cause: 'Aborted' });
        else if (Exit.isSuccess(exit)) observe?.({ _tag: 'Disposed', cause: 'Completed' });
        else if (Exit.hasInterrupts(exit)) observe?.({ _tag: 'Disposed', cause: 'Cancelled' });
      }),
    );
    return Stream.fromIterable(fixtureEvents(input)).pipe(
      Stream.mapEffect(({ delayMs, event }) => {
        const delay = Effect.sleep(delayMs);
        const encode = Effect.sync(() => {
          const encoded = bytes.encode(encoder.encode(event));
          observe?.({ _tag: 'Emitted', eventType: event.type });
          return encoded;
        });
        return Effect.andThen(delay, encode);
      }),
    );
  });
  return Stream.unwrap(scoped);
}

export function createFixtureResponse(
  input: FixtureInput,
  signal: AbortSignal,
  observe?: ResponseObserver,
) {
  return Effect.gen(function* () {
    const encoder = new EventEncoder();
    const producer = fixtureProducer(input, signal, encoder, observe);
    // The bridge captures the caller's context and owns its own producer scope.
    const body = yield* Stream.toReadableStreamEffect(producer, {
      strategy: { highWaterMark: 1 },
    });
    return new Response(body, {
      headers: { 'Content-Type': encoder.getContentType(), 'Cache-Control': 'no-cache' },
    });
  });
}

class InvalidRequest extends Data.TaggedError('InvalidRequest')<{
  readonly status: 400 | 413;
  readonly message: string;
}> {}

class BodyReadFailure extends Data.TaggedError('BodyReadFailure') {}

async function readBoundedBody(request: Request): Promise<string> {
  if (!request.body) throw new InvalidRequest({ status: 400, message: 'Missing request body' });
  const reader = request.body.getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  request.signal.addEventListener('abort', abort, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    if (request.signal.aborted) abort();
    while (!request.signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > 16384) {
        // Source cleanup must not delay the proven overflow; observe rejection without waiting.
        void reader.cancel().catch(() => {});
        throw new InvalidRequest({ status: 413, message: 'Request body exceeds 16384 bytes' });
      }
      chunks.push(chunk.value);
    }
    if (request.signal.aborted)
      throw new InvalidRequest({ status: 400, message: 'Request aborted' });
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new InvalidRequest({ status: 400, message: 'Invalid request body' });
    }
  } finally {
    request.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

const ForwardedProps = Schema.Struct({ scenario: Scenario });

export function serveAgentAnalysis(request: Request, observe?: ResponseObserver) {
  return Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: () => readBoundedBody(request),
      catch: (error) => {
        if (error instanceof InvalidRequest) return error;
        if (request.signal.aborted)
          return new InvalidRequest({ status: 400, message: 'Request aborted' });
        return new BodyReadFailure();
      },
    });
    const json = yield* Effect.try({
      try: () => JSON.parse(body),
      catch: () => new InvalidRequest({ status: 400, message: 'Invalid request body' }),
    });
    const parsed = RunAgentInputSchema.safeParse(json);
    if (!parsed.success || parsed.data.threadId !== THREAD_ID)
      return yield* Effect.fail(
        new InvalidRequest({ status: 400, message: 'Invalid RunAgentInput' }),
      );
    const { scenario } = yield* Schema.decodeUnknownEffect(ForwardedProps)(
      parsed.data.forwardedProps,
    ).pipe(
      Effect.mapError(() => new InvalidRequest({ status: 400, message: 'Invalid RunAgentInput' })),
    );
    return yield* createFixtureResponse(
      { runId: parsed.data.runId, threadId: THREAD_ID, scenario },
      request.signal,
      observe,
    );
  }).pipe(
    Effect.catchTag('InvalidRequest', (error) =>
      Effect.succeed(new Response(error.message, { status: error.status })),
    ),
    Effect.catchTag('BodyReadFailure', () =>
      Effect.succeed(new Response('Internal server error', { status: 500 })),
    ),
  );
}
