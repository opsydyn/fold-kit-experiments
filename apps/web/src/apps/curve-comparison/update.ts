import type { Return as UpdateReturn } from 'foldkit/update';

import * as CurveComparison from '../../ui/curve-comparison-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedCurveMessage: ({ message }) => {
      const { model: chart } = CurveComparison.update(
        model.chart,
        // SAFETY: The app model and message contracts establish this value before the assertion.
        message as CurveComparison.Message,
      );
      return { model: { ...model, chart } };
    },
  });
