import { Effect, Schema } from 'effect';
import { HttpClient, HttpClientResponse } from 'effect/http';
import { Command, Http } from 'foldkit';

import { postLive } from '../stateflow/live';
import { Message } from './message';
import { Point } from './model';

export const FetchMetrics = Command.define('FetchMetrics', {
  messages: [Message.LoadedMetrics, Message.FailedLoad],
  interrupt: true,
  execute: Effect.provide(
    Effect.gen(function* () {
      const response = yield* HttpClient.get('/api/request-diagnostics');
      const points = yield* HttpClientResponse.schemaBodyJson(Schema.Array(Point))(response);
      return Message.LoadedMetrics({ points });
    }).pipe(
      Effect.match({
        onSuccess: (message) => message,
        onFailure: (error) => Message.FailedLoad({ error: String(error) }),
      }),
    ),
    Http.layer,
  ),
});

const encodeMessage = Schema.encodeSync(Schema.fromJsonString(Message));

/**
 * Reports a message the explorer's Machine took to any Stateflow Observatory listening in
 * another tab, which replays it live. With none open the message goes nowhere.
 */
export const ReportToObservatory = Command.define('ReportToObservatory', {
  args: { message: Message },
  messages: [Message.CompletedReportToObservatory],
  execute: ({ message }) =>
    Effect.sync(() => {
      postLive({ specimen: 'request-diagnostics', event: encodeMessage(message) });
      return Message.CompletedReportToObservatory();
    }),
});
