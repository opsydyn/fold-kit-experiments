import type { Return } from 'foldkit/update';

import { OpenPlayground } from './command';
import { Message } from './message';
import { Status } from './model';
import type { Model } from './model';

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    ClickedPlayground: () =>
      Status.match(model.status, {
        Pending: () => ({ model }),
        Ready: () => open(model),
        Opened: () => open(model),
        Failed: () => open(model),
      }),
    SucceededPlayground: () => ({ model: { ...model, status: Status.Opened() } }),
    FailedPlayground: ({ error }) => ({ model: { ...model, status: Status.Failed({ error }) } }),
  });

const open = (model: Model): Return<Model, Message> => ({
  model: { ...model, status: Status.Pending() },
  commands: [OpenPlayground({ templateUrl: model.templateUrl })],
});
