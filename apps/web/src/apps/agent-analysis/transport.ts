import { runHttpRequest, transformHttpEventStream } from '@ag-ui/client';
import type { RunAgentInput } from '@ag-ui/core';
import { Effect, Queue, Stream } from 'effect';

import { THREAD_ID } from './contract';
import type { RunRequest } from './contract';
import { Message } from './message';

export interface AgentTransportOptions {
  readonly endpoint: string;
  readonly fetch: typeof globalThis.fetch;
}

export const toRunInput = (request: RunRequest): RunAgentInput => ({
  threadId: THREAD_ID,
  runId: request.runId,
  state: { services: [] },
  messages: [],
  tools: [],
  context: [],
  forwardedProps: { scenario: request.scenario },
});

export const agentStream = (
  request: RunRequest,
  options: AgentTransportOptions = { endpoint: '/api/agent-analysis', fetch: globalThis.fetch },
): Stream.Stream<Message> =>
  Stream.callback<Message>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const controller = new AbortController();
        const failed = (error: string) => {
          Queue.offerUnsafe(queue, Message.FailedStream({ runId: request.runId, error }));
          Queue.endUnsafe(queue);
        };
        const http = runHttpRequest(() =>
          options.fetch(options.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify(toRunInput(request)),
            signal: controller.signal,
          }),
        );
        const subscription = transformHttpEventStream(http).subscribe({
          next: (event) => {
            Queue.offerUnsafe(queue, Message.ReceivedAgentEvent({ runId: request.runId, event }));
          },
          error: (error: unknown) => failed(error instanceof Error ? error.message : String(error)),
          // No duplicated terminal state: the reducer ignores this after valid completion.
          complete: () => failed('Agent stream closed'),
        });
        return { controller, subscription };
      }),
      ({ controller, subscription }) =>
        Effect.sync(() => {
          controller.abort();
          subscription.unsubscribe();
        }),
    ).pipe(
      // Queue completion or runtime interruption closes the acquireRelease scope.
      // oxlint-disable-next-line linteffect/no-effect-never
      Effect.flatMap(() => Effect.never),
    ),
  );
