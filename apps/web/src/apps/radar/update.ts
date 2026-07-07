import { Match } from 'effect';

import * as RadarChart from '../../ui/radar-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotRadarMessage: ({ message }) => {
        const [radar] = RadarChart.update(model.radar, message as RadarChart.Message);
        return [{ ...model, radar }, []];
      },
    }),
  );
