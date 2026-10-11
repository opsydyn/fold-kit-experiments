import type { Return } from 'foldkit/update';

import { MeasureWords } from './command';
import { initialSettings } from './domain';
import type { Settings } from './domain';
import { Message } from './message';
import { Measurement } from './model';
import type { Model } from './model';
const remeasure = (model: Model, settings: Settings): Return<Model, Message> => {
  const revision = model.revision + 1;
  return {
    model: { ...model, settings, revision, activeKey: null, measurement: Measurement.Loading() },
    commands: [MeasureWords({ revision, words: model.words, settings })],
  };
};
export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    SucceededMeasurement: ({ revision, measurements }) => ({
      model:
        revision === model.revision
          ? { ...model, measurement: Measurement.Ready({ words: measurements }) }
          : model,
    }),
    FailedMeasurement: ({ revision, error }) => ({
      model:
        revision === model.revision
          ? { ...model, measurement: Measurement.Failed({ error }) }
          : model,
    }),
    SelectedSpiral: ({ spiral }) => ({
      model: { ...model, settings: { ...model.settings, spiral }, activeKey: null },
    }),
    SelectedRotation: ({ rotate }) => ({
      model: { ...model, settings: { ...model.settings, rotate }, activeKey: null },
    }),
    SelectedFont: ({ font }) =>
      font === model.settings.font ? { model } : remeasure(model, { ...model.settings, font }),
    ChangedPadding: ({ value }) => {
      const padding = Number(value);
      return value.trim() && Number.isInteger(padding) && padding >= 0 && padding <= 12
        ? { model: { ...model, settings: { ...model.settings, padding }, activeKey: null } }
        : { model };
    },
    ChangedSize: ({ value }) => {
      const size = Number(value);
      return value.trim() && Number.isInteger(size) && size >= 24 && size <= 80
        ? remeasure(model, { ...model.settings, size })
        : { model };
    },
    RecordedWidth: ({ width }) => ({
      model: Number.isFinite(width) && width >= 220 ? { ...model, width, activeKey: null } : model,
    }),
    InspectedWord: ({ key }) => ({
      model: model.words.some((d) => d.id === key) ? { ...model, activeKey: key } : model,
    }),
    ClickedRetry: () => remeasure(model, model.settings),
    ClickedReset: () => remeasure(model, initialSettings),
  });
