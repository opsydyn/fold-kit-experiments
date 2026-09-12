import type { Return as UpdateReturn } from 'foldkit/update';

import * as DensityContour from '../../ui/density-contour-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotDensityContourMessage: ({ message }) => {
      const { model: chart } = DensityContour.update(
        model.chart,
        message as DensityContour.Message,
      );
      return { model: { ...model, chart } };
    },
  });
