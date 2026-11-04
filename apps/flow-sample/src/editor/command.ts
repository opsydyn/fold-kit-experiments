import { parseGraph, serializeGraph } from '@opsydyn/foldkit-flow';
import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { Message } from './message';

export const ArrangeFlow = Command.define('ArrangeFlow', {
  args: {
    json: Schema.String,
    requestId: Schema.String,
    revision: Schema.Number,
    direction: Schema.Literals(['RIGHT', 'DOWN']),
  },
  interrupt: true,
  messages: [Message.SucceededLayout, Message.FailedLayout],
  execute: ({ json, requestId, revision, direction }) =>
    Effect.tryPromise(() =>
      // Fetch the layout engine only when the user requests arrangement.
      // oxlint-disable-next-line linteffect/prevent-dynamic-imports
      import('@opsydyn/foldkit-flow-elk').then(({ createElkLayout }) =>
        createElkLayout({ direction, spacing: 32 })({
          requestId,
          revision,
          graph: parseGraph(json),
        }),
      ),
    ).pipe(
      Effect.match({
        onSuccess: (result) => Message.SucceededLayout({ result }),
        onFailure: () => Message.FailedLayout({ requestId }),
      }),
    ),
});
export const SaveFlow = Command.define('SaveFlow', {
  args: { json: Schema.String },
  messages: [Message.SucceededSave, Message.FailedStorage],
  execute: ({ json }) =>
    Effect.try(() =>
      globalThis.localStorage.setItem('opsydyn.foldkit-flow.release-sample.v1', json),
    ).pipe(
      Effect.match({
        onSuccess: () => Message.SucceededSave(),
        onFailure: () => Message.FailedStorage(),
      }),
    ),
});
export const LoadFlow = Command.define('LoadFlow', {
  messages: [Message.SucceededLoad, Message.FailedStorage],
  execute: Effect.try(() =>
    serializeGraph(
      parseGraph(
        globalThis.localStorage.getItem('opsydyn.foldkit-flow.release-sample.v1') ?? 'null',
      ),
    ),
  ).pipe(
    Effect.match({
      onSuccess: (json) => Message.SucceededLoad({ json }),
      onFailure: () => Message.FailedStorage(),
    }),
  ),
});
