import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';
import { Paint } from '../palette';
import { Piece } from './model';

export const Message = UiSchema.TaggedEnum({
  ClickedSurface: { key: Schema.String, x: Schema.Number, z: Schema.Number },
  ClickedPaint: { paint: Paint },
  ClickedPiece: { piece: Piece },
  ChangedHistory: { shown: Schema.Int },
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedClear: {},
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
