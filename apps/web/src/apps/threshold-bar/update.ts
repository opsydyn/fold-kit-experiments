import { Match } from 'effect';
import * as ThresholdBar from '../../ui/threshold-bar-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotThresholdBarMessage: ({ message }) => {
        const [chart] = ThresholdBar.update(model.chart, message as ThresholdBar.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
