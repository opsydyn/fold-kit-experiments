import { Option, Schema } from 'effect';
import { getData } from 'foldkit/asyncData';

import type { Model } from './model';
import { DatasetQuery } from './query';

export const SourceName = Schema.Literals([
  'source-lines.ts',
  'highlighting.ts',
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
    revision: model.nextRevision,
    profile: 'normal',
    fail: false,
  });
  return Option.match(getData(data), {
    onNone: () => JSON.stringify({ state: data._tag, dataset: model.selected }, null, 2),
    onSome: (snapshot) => JSON.stringify(snapshot, null, 2),
  });
};
