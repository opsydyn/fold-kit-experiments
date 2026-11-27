import { Message, type Message as MessageType } from './message';
import { Model, type Model as ModelType, _elapsedMs } from './model';

export const update = (model: ModelType, message: MessageType): ModelType =>
  Message.match(message, {
    FetchedHealth: ({ status, uptimeSeconds, startedAt, timestamp }) =>
      Model.Loaded({
        data: { status, uptimeSeconds, startedAt, timestamp },
        elapsedMs: 0,
        sinceLabel: new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(
          new Date(startedAt),
        ),
      }),
    FetchFailed: ({ error }) => Model.Failed({ error }),
    TickedFrame: ({ deltaTimeMs }) => {
      if (!Model.is('Loaded')(model)) return model;
      return _elapsedMs.modify((ms) => ms + deltaTimeMs)(model);
    },
  });
