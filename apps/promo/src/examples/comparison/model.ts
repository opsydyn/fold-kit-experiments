import { UiSchema } from '@effect/ui';
import { HighlightedSource, SourceKey } from '@opsydyn/dataset-explorer/highlighting-core';
import { Schema } from 'effect';

import * as Workbench from '../../../../web/src/apps/comparison/workbench-state';
import { settingsPath } from './project';

export const Source = Schema.Struct({ name: Schema.String, content: Schema.String });
export const Action = Schema.Literals(['copy', 'download', 'playground']);
export const ActionStatus = UiSchema.TaggedEnum({
  Ready: {},
  Pending: { action: Action },
  Succeeded: { action: Action },
  Failed: { error: Schema.String },
});
export const Props = Schema.Struct({
  sources: Schema.Array(Source),
  templateUrl: Schema.NullOr(Schema.String),
});
export type Props = typeof Props.Type;

export const Model = Schema.Struct({
  requestedSource: Schema.optional(SourceKey),
  highlightedSource: Schema.optional(HighlightedSource),
  workbench: Workbench.Model,
  sources: Schema.Array(Source),
  activeFile: Schema.String,
  templateUrl: Schema.NullOr(Schema.String),
  actionStatus: ActionStatus,
});
export type Model = typeof Model.Type;

export function init(props: Props) {
  const decoded = Schema.decodeUnknownSync(Props)(props);
  return {
    model: {
      workbench: Workbench.init(),
      ...decoded,
      activeFile:
        decoded.sources.find(({ name }) => name === settingsPath)?.name ??
        decoded.sources[0]?.name ??
        '',
      actionStatus: ActionStatus.Ready(),
    } satisfies Model,
  };
}
