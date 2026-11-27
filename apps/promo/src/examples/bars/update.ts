import { Match, Struct } from 'effect';

import { Message } from './message';
import type { Model } from './model';

const resize = (model: Model, width: number): Model =>
  Match.value(width).pipe(
    Match.when(
      (next) => Number.isFinite(next) && next >= 220 && next !== model.width,
      (width) => Struct.assign(model, { width }),
    ),
    Match.orElse(() => model),
  );

const inspect = (model: Model, key: string): Model =>
  Match.value(key).pipe(
    Match.when(
      (next) => next !== model.activeKey && model.data.some((datum) => datum.id === next),
      (activeKey) => Struct.assign(model, { activeKey }),
    ),
    Match.orElse(() => model),
  );

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    SelectedMode: ({ mode }) => Struct.assign(model, { mode }),
    SelectedOrientation: ({ orientation }) => Struct.assign(model, { orientation }),
    SelectedPaint: ({ paint }) => Struct.assign(model, { paint }),
    RecordedWidth: ({ width }) => resize(model, width),
    InspectedBar: ({ key }) => inspect(model, key),
    ClickedReset: () =>
      Struct.assign(model, {
        mode: 'grouped',
        orientation: 'vertical',
        activeKey: null,
        paint: 'solid',
      } as const),
  });
