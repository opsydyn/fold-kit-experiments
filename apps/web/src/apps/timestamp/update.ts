import { Message } from './message';
import type { Model } from './model';

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    FormattedStart: ({ label }) => ({ ...model, localStart: label }),
    Ticked: ({ deltaTimeMs }) => ({ ...model, elapsedMs: model.elapsedMs + deltaTimeMs }),
  });
