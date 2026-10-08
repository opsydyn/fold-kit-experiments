import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';
import { foldChildInit } from 'foldkit/update';
import type { Return } from 'foldkit/update';

import * as Comparison from '../../../../web/src/apps/comparison/main';
import { Message } from './message';
import { settingsPath } from './project';

export const Source = Schema.Struct({ name: Schema.String, content: Schema.String });
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
export type Props = typeof Props.Type;
export const Model = Schema.Struct({
  // The maintained runtime schema is intentionally shallow for app-owned chart models.
  workbench: Schema.declare((value): value is Comparison.Model =>
    Schema.is(Comparison.Model)(value),
  ),
  sources: Schema.Array(Source),
  activeFile: Schema.String,
  templateUrl: Schema.NullOr(Schema.String),
  actionStatus: ActionStatus,
});
export type Model = typeof Model.Type;

export function init(props: Props): Return<Model, Message> {
  const decoded = Schema.decodeUnknownSync(Props)(props);
  return foldChildInit(Comparison.init(undefined), {
    toParentModel: (workbench): Model => ({
      workbench,
      ...decoded,
      activeFile:
        decoded.sources.find(({ name }) => name === settingsPath)?.name ??
        decoded.sources[0]?.name ??
        '',
      actionStatus: ActionStatus.Ready(),
    }),
    toParentMessage: (message) => Message.GotWorkbenchMessage({ message }),
  });
}
