import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  ClickedCube: { index: Schema.Int },
  HoveredCube: { index: Schema.Int },
  LeftCube: { index: Schema.Int },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;

/** Cube keys are `cube-<index>`; anything else is not a cube. */
export const cubeIndex = (key: string): number => Number.parseInt(key.replace('cube-', ''), 10);
