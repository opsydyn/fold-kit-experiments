import { Match } from 'effect';
import * as SunburstChart from '../../ui/sunburst-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotSunburstMessage: ({ inner }) => {
        const [sunburst] = SunburstChart.update(model.sunburst, inner);
        return [{ ...model, sunburst }, []];
      },
    }),
  );
