import { Option, Schema } from 'effect';

import type { Model } from './model';
import { DatasetQuery, status } from './query';

export const SourceName = Schema.Literals([
  'source-line-core.ts',
  'highlighting-core.ts',
  'highlighting-engine.ts',
  'highlighting-browser.ts',
  'highlighting-assets.d.ts',
  'highlighting.css',
  'command.ts',
  'data.ts',
  'query.ts',
  'model.ts',
  'message.ts',
  'update.ts',
  'chart.ts',
  'frame.ts',
  'measurement.ts',
  'view.ts',
  'main.ts',
  'source.ts',
  'source-view.ts',
  'explorer.css',
  'snapshot.json',
]);
export type SourceName = typeof SourceName.Type;
export const Source = Schema.Struct({ name: SourceName, content: Schema.String });

export const sourceContent = (model: Model): string => {
  if (model.activeFile !== 'snapshot.json') {
    return model.sources.find((source) => source.name === model.activeFile)?.content ?? '';
  }
  const data = DatasetQuery.read(model.datasets, {
    source: model.transport,
    dataset: model.selected,
  });
  return Option.match(Option.fromNullishOr(data.snapshot), {
    onNone: () => JSON.stringify({ state: status(data), dataset: model.selected }, null, 2),
    onSome: (snapshot) => JSON.stringify(snapshot, null, 2),
  });
};
