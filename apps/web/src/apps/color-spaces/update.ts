import { Match } from 'effect';
import * as ColorSpaces from '../../ui/color-spaces-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotColorSpacesMessage: ({ inner }) => {
        const [chart] = ColorSpaces.update(model.chart, inner as ColorSpaces.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
