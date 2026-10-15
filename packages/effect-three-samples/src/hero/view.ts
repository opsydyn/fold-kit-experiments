import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { cubeIndex, Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'effect-three',
  body: EffectThreeFoldkit.view(
    {
      scene: sceneFor(model),
      mount: sceneMount,
      className: 'e3-stage e3-stage-hero',
      onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
      onClick: ({ key }) => Message.ClickedCube({ index: cubeIndex(key) }),
      onPointerEnter: ({ key }) => Message.HoveredCube({ index: cubeIndex(key) }),
      onPointerLeave: ({ key }) => Message.LeftCube({ index: cubeIndex(key) }),
    },
    h,
  ),
});
