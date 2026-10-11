import type { BaseEvent } from '@ag-ui/core';
import { RunAgentInputSchema } from '@ag-ui/core/schemas';
import { EventEncoder } from '@ag-ui/encoder';
import { Effect, Schema } from 'effect';

import { Scenario, THREAD_ID } from '../../apps/agent-analysis/contract';
import { fixtureEvents, type FixtureInput } from './fixtures';

export type ResponseObservation =
  | { readonly _tag: 'Emitted'; readonly eventType: BaseEvent['type'] }
  | { readonly _tag: 'Disposed'; readonly cause: 'Completed' | 'Aborted' | 'Cancelled' };
export type ResponseObserver = (observation: ResponseObservation) => void;

export function createFixtureResponse(
  input: FixtureInput,
  signal: AbortSignal,
  observe?: ResponseObserver,
): Response {
  const events = fixtureEvents(input);
  const encoder = new EventEncoder();
  const bytes = new TextEncoder();
  let cancelProducer = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let cursor = 0;
      let disposed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const dispose = (cause: Extract<ResponseObservation, { _tag: 'Disposed' }>['cause']) => {
        if (disposed) return;
        disposed = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        // Cancellation already closes the stream; abort/completion must close it here.
        if (cause !== 'Cancelled') controller.close();
        observe?.({ _tag: 'Disposed', cause });
      };
      const abort = () => dispose('Aborted');
      const schedule = () => {
        if (disposed) return;
        const next = events[cursor];
        if (!next) {
          dispose('Completed');
          return;
        }
        timer = setTimeout(() => {
          if (disposed) return;
          controller.enqueue(bytes.encode(encoder.encode(next.event)));
          cursor++;
          observe?.({ _tag: 'Emitted', eventType: next.event.type });
          schedule();
        }, next.delayMs);
      };
      cancelProducer = () => dispose('Cancelled');
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      else schedule();
    },
    cancel() {
      cancelProducer();
    },
  });
  return new Response(body, {
    headers: { 'Content-Type': encoder.getContentType(), 'Cache-Control': 'no-cache' },
  });
}

async function readBoundedBody(request: Request): Promise<string | Response> {
  if (!request.body) return new Response('Missing request body', { status: 400 });
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
        return new Response('Request body exceeds 16384 bytes', { status: 413 });
      }
      chunks.push(chunk.value);
    }
    if (request.signal.aborted) return new Response('Request aborted', { status: 400 });
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    request.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

const ForwardedProps = Schema.Struct({ scenario: Scenario });

export function serveAgentAnalysis(request: Request, observe?: ResponseObserver) {
  return Effect.tryPromise({
    try: async () => {
      const body = await readBoundedBody(request);
      if (body instanceof Response) return body;
      const parsed = RunAgentInputSchema.safeParse(JSON.parse(body));
      if (!parsed.success || parsed.data.threadId !== THREAD_ID) {
        return new Response('Invalid RunAgentInput', { status: 400 });
      }
      const { scenario } = Schema.decodeUnknownSync(ForwardedProps)(parsed.data.forwardedProps);
      return createFixtureResponse(
        { runId: parsed.data.runId, threadId: THREAD_ID, scenario },
        request.signal,
        observe,
      );
    },
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => new Response('Invalid request body', { status: 400 })));
}
