import { Message } from './message';
import type { Model } from './model';

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    HighlightedSeries: ({ key }) => ({ ...model, highlighted: key }),
    ChoseCurve: ({ curve }) => ({ ...model, curve }),
  });
