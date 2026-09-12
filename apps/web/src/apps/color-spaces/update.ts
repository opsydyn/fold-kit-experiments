import type { Return as UpdateReturn } from 'foldkit/update';

import * as ColorSpaces from '../../ui/color-spaces-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotColorSpacesMessage: ({ message }) => {
      const { model: chart } = ColorSpaces.update(model.chart, message as ColorSpaces.Message);
      return { model: { ...model, chart } };
    },
  });
