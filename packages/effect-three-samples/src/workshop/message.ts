import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { type Result, Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Clip, type RobotInfo } from './model';

export const Message = defineMessageUnion({
  SettledRobot: { result: Schema.Unknown },
  SettledFloor: { result: Schema.Unknown },
  CompletedUnload: {},
  ClickedClip: { clip: Schema.NullOr(Clip) },
  ChangedSpeed: { speed: Schema.Number },
  ClickedPart: { part: Schema.String },
  ClickedUnload: {},
  ClickedReload: {},
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type SettledRobot = Omit<typeof Message.SettledRobot.Type, 'result'> & {
  readonly result: Result.Result<RobotInfo, string>;
};
export type SettledFloor = Omit<typeof Message.SettledFloor.Type, 'result'> & {
  readonly result: Result.Result<string, string>;
};
export type Message = typeof Message.Type;
