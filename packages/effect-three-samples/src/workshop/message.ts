import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Clip } from './model';

export const Message = defineMessageUnion({
  // What the scene heard about the assets it asks for.
  LoadedAsset: {
    id: Schema.String,
    parts: Schema.Array(Schema.String),
    clips: Schema.Array(Schema.String),
  },
  FailedAsset: { id: Schema.String, reason: Schema.String },
  ClickedClip: { clip: Schema.NullOr(Clip) },
  ChangedSpeed: { speed: Schema.Number },
  ClickedPart: { part: Schema.String },
  ClickedUnload: {},
  ClickedReload: {},
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
