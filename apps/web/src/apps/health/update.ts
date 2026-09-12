import type { Return as UpdateReturn } from 'foldkit/update';

import { Message, type Message as MessageType } from './message';
import { Model, type Model as ModelType, _elapsedMs } from './model';

type Return = UpdateReturn<ModelType, MessageType>;

export const update = (model: ModelType, message: MessageType): Return =>
  Message.match(message, {
    FetchedHealth: ({ status, uptimeSeconds, startedAt, timestamp }) => ({
      model: Model.Loaded({
        data: { status, uptimeSeconds, startedAt, timestamp },
        elapsedMs: 0,
        sinceLabel: new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(
          new Date(startedAt),
        ),
      }),
    }),
    FetchFailed: ({ error }) => ({ model: Model.Failed({ error }) }),
    TickedFrame: ({ deltaTimeMs }) => {
      if (model._tag !== 'Loaded') return { model: model };
      return { model: _elapsedMs.modify((ms) => ms + deltaTimeMs)(model) };
    },
  });
