import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';
import { Clip } from './model';

export const Message = UiSchema.TaggedEnum({
  // What the scene heard about the assets it asks for.
  // A level of detail shown: `final` once it is the finest.
  LoadedAsset: {
    id: Schema.String,
    final: Schema.Boolean,
    parts: Schema.Array(Schema.String),
    clips: Schema.Array(Schema.String),
  },
  FailedAsset: { id: Schema.String, reason: Schema.String },
  ClickedClip: { clip: Schema.NullOr(Clip) },
  ChangedSpeed: { speed: Schema.Number },
  ClickedPart: { part: Schema.String },
  ClickedUnload: {},
  ClickedReload: {},
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
