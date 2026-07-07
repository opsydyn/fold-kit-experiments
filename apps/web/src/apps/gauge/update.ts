import { Match } from 'effect';

import * as GaugeChart from '../../ui/gauge-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotGaugeMessage: ({ message }) => {
        const [gauge] = GaugeChart.update(model.gauge, message as GaugeChart.Message);
        return [{ ...model, gauge }, []];
      },
    }),
  );
