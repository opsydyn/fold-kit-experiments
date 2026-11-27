import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Option } from 'effect';

import { EffectThreeStage, unlabelledSceneMount } from '../effect-ui-scene';
import { Message } from './message';
import type { CubeSize, Model } from './model';
import { sceneFor } from './scene';

const liveStage = (model: Model, h: Html.H<Message>) =>
  EffectThreeStage(h)
    .class('e3-stage')
    .on('scene-click', ({ key }) => Message.ClickedCube({ key }))
    .on('scene-pointer-enter', ({ key }) => Message.HoveredCube({ key }))
    .on('scene-pointer-leave', ({ key }) => Message.LeftCube({ key }))
    .onMount(
      Mount.map(unlabelledSceneMount({ scene: sceneFor(model) }), (lifecycle) =>
        Message.ReceivedSceneLifecycle({ lifecycle }),
      ),
    )
    .children();

const placeholder = (h: Html.H<Message>) =>
  h.div
    .class('e3-stage e3-stage-placeholder')
    .children('Scene unmounted: its renderer, WebGL context and GPU resources are released.');

const sizeLabel = { small: 'Grow cubes', large: 'Shrink cubes' } satisfies Record<CubeSize, string>;

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

export const view = (h: Html.H<Message>, model: Model) =>
  h.div
    .class('e3-sample')
    .children(
      model.showScene ? liveStage(model, h) : placeholder(h),
      h.div
        .class('e3-controls')
        .children(
          button(h, sizeLabel[model.size], Message.ClickedToggleSize()),
          button(
            h,
            model.showSecondCube ? 'Remove right cube' : 'Add right cube',
            Message.ClickedToggleSecondCube(),
          ),
          button(
            h,
            model.showScene ? 'Unmount scene' : 'Mount scene',
            Message.ClickedToggleScene(),
          ),
        ),
      h.p
        .class('e3-note')
        .children(
          `Scene ${model.status}. Clicks: ${model.clicks}. Hovering: ${Option.getOrElse(model.hovered, () => 'nothing')}. `,
          'Click a cube to repaint the shared material: both cubes change.',
        ),
    );
