import type { Return as UpdateReturn } from 'foldkit/update';

import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    HighlightedSeries: ({ key }) => ({ model: { ...model, highlighted: key } }),
    ChoseCurve: ({ curve }) => ({ model: { ...model, curve } }),
  });
