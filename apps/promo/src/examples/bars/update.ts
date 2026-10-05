import type { Return } from 'foldkit/update';

import { Message } from './message';
import type { Model } from './model';
export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    SelectedMode: ({ mode }) => ({ model: { ...model, mode } }),
    SelectedOrientation: ({ orientation }) => ({ model: { ...model, orientation } }),
    SelectedPaint: ({ paint }) => ({ model: { ...model, paint } }),
    RecordedWidth: ({ width }) => ({
      model: Number.isFinite(width) && width >= 220 ? { ...model, width } : model,
    }),
    InspectedBar: ({ key }) => ({
      model: model.data.some((d) => d.id === key) ? { ...model, activeKey: key } : model,
    }),
    ClickedReset: (): Return<Model, Message> => ({
      model: {
        ...model,
        mode: 'grouped',
        orientation: 'vertical',
        activeKey: null,
        paint: 'solid',
      },
    }),
  });
