import { Command } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import { readFile } from './effects';
import { initialState, Message, Model, Props, ReadFileArgs, transition } from './state';
import { view } from './view';

const ReadLikeC4File = Command.make('ReadLikeC4File', { args: ReadFileArgs }, readFile);
const CreateLikeC4Diagram = Command.make(
  'CreateLikeC4Diagram',
  { args: { teamId: Schema.String, creationId: Schema.String, body: Schema.String } },
  ({ teamId, creationId, body }) =>
    Effect.tryPromise(async (signal) => {
      const path = `/zloz/diagrams/${encodeURIComponent(teamId)}/${encodeURIComponent(creationId)}`;
      const response = await fetch('/api' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      });
      if (response.ok) {
        window.location.assign(
          `/app/${encodeURIComponent(teamId)}/diagrams/${encodeURIComponent(creationId)}`,
        );
        return Message.SettledApply({ retry: false, notice: 'Diagram created.' });
      }
      if (response.status === 401 || response.status === 403)
        return Message.SettledApply({
          retry: false,
          notice: 'Your current session or role cannot create diagrams.',
        });
      if (response.status === 409)
        return Message.SettledApply({
          retry: true,
          notice:
            'Creation conflicts with an existing request. Return to the team to check your diagrams.',
        });
      if (response.status === 400 || response.status === 413)
        return Message.SettledApply({
          retry: false,
          notice: 'Teams rejected the diagram or its request size.',
        });
      return Message.SettledApply({
        retry: true,
        notice: 'Creation is unconfirmed. Retry this exact diagram.',
      });
    }).pipe(
      Effect.orElseSucceed(() =>
        Message.SettledApply({
          retry: true,
          notice: 'Creation is unconfirmed. Retry this exact diagram.',
        }),
      ),
    ),
);

export const DiagramImport = Html.component({
  name: 'TeamsDiagramImport',
  model: Model,
  message: Message,
  props: Props,
}).make({
  init: ({ props }) => initialState(props),
  update: ($, message) => {
    const { model, work } = transition($.model, message);
    const step = $.set(model);
    if (!work) return step;
    return work._tag === 'ReadFile'
      ? step.run(ReadLikeC4File.make({ file: work.file, epoch: work.epoch }))
      : step.run(
          CreateLikeC4Diagram.make({
            teamId: work.teamId,
            creationId: work.creationId,
            body: work.body,
          }),
        );
  },
  view,
});
