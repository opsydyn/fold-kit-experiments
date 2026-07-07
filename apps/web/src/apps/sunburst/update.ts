import { Match } from 'effect';

import * as SunburstChart from '../../ui/sunburst-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotSunburstMessage: ({ message }) => {
        const [sunburst] = SunburstChart.update(model.sunburst, message);
        return [{ ...model, sunburst }, []];
      },
    }),
  );
