import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

import { initialSettings } from './settings';
import { Source, SourceName } from './source';

export { SourceName } from './source';

export const Group = Schema.Literals(['all', 'a', 'b']);
export const Axis = Schema.Literals(['xMax', 'yMax']);
export const Settings = Schema.Struct({
  group: Group,
  xMax: Schema.Number,
  yMax: Schema.Number,
  selectedPoint: Schema.NullOr(Schema.String),
});
export const Action = Schema.Literals(['copy', 'download', 'playground']);
export const ActionStatus = defineTaggedUnion({
  Ready: {},
  Pending: { action: Action },
  Succeeded: { action: Action },
  Failed: { error: Schema.String },
});
export const Props = Schema.Struct({
  sources: Schema.Array(Source),
  templateUrl: Schema.NullOr(Schema.String),
});
export const Model = Schema.Struct({
  chartWidth: Schema.Number,
  settings: Settings,
  sources: Schema.Array(Source),
  activeFile: SourceName,
  templateUrl: Schema.NullOr(Schema.String),
  actionStatus: ActionStatus,
});
export type Model = typeof Model.Type;
export type Props = typeof Props.Type;
export interface InitReturn {
  readonly model: Model;
}
export const init = (props: Props): InitReturn => ({
  model: {
    ...Schema.decodeUnknownSync(Props)(props),
    chartWidth: 560,
    settings: initialSettings,
    activeFile: 'settings.ts' as const,
    actionStatus: ActionStatus.Ready(),
  },
});
export const sourceFor = (model: Model, name: SourceName): string =>
  model.sources.find((source) => source.name === name)?.content ?? '';
