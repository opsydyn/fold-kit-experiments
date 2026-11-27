import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { EffectThreeStage, unlabelledSceneMount } from '../effect-ui-scene';
import { cubeIndex, Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

export const view = (h: Html.H<Message>, model: Model) =>
  EffectThreeStage(h)
    .class('e3-stage', 'e3-stage-hero')
    .on('scene-click', ({ key }) => Message.ClickedCube({ index: cubeIndex(key) }))
    .on('scene-pointer-enter', ({ key }) => Message.HoveredCube({ index: cubeIndex(key) }))
    .on('scene-pointer-leave', ({ key }) => Message.LeftCube({ index: cubeIndex(key) }))
    .onMount(
      Mount.map(unlabelledSceneMount({ scene: sceneFor(model) }), (lifecycle) =>
        Message.ReceivedSceneLifecycle({ lifecycle }),
      ),
    )
    .children();
