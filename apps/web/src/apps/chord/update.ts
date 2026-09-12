import type { Return as UpdateReturn } from 'foldkit/update';

import * as ChordChart from '../../ui/chord-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotChordMessage: ({ message }) => {
      const { model: chord } = ChordChart.update(model.chord, message as ChordChart.Message);
      return { model: { ...model, chord } };
    },
  });
