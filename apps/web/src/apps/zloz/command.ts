import { Command } from '@effect/ui';
import { parseGraph, serializeGraph } from '@opsydyn/foldkit-zloz';
import { createElkLayout } from '@opsydyn/foldkit-zloz-elk';
import { Effect, Schema } from 'effect';

import { Message } from './message';

export const ArrangeFlow = Command.make(
  'ArrangeFlow',
  {
    args: { json: Schema.String, requestId: Schema.String, revision: Schema.Number },
    mode: 'switch',
  },
  ({ json, requestId, revision }) =>
    Effect.tryPromise(() =>
      createElkLayout()({ requestId, revision, graph: parseGraph(json) }),
    ).pipe(
      Effect.match({
        onSuccess: (result) => Message.SucceededLayout({ result }),
        onFailure: () => Message.FailedLayout({ requestId }),
      }),
    ),
);
export const SaveZloz = Command.make('SaveZloz', { args: { json: Schema.String } }, ({ json }) =>
  Effect.try(() => globalThis.localStorage.setItem('opsydyn.foldkit-flow.demo.v1', json)).pipe(
    Effect.match({
      onSuccess: () => Message.SucceededSave(),
      onFailure: () => Message.FailedStorage(),
    }),
  ),
);
export const LoadZloz = Command.make('LoadZloz', { args: {} }, () =>
  Effect.try(() =>
    serializeGraph(
      parseGraph(globalThis.localStorage.getItem('opsydyn.foldkit-flow.demo.v1') ?? 'null'),
    ),
  ).pipe(
    Effect.match({
      onSuccess: (json) => Message.SucceededLoad({ json }),
      onFailure: () => Message.FailedStorage(),
    }),
  ),
);
