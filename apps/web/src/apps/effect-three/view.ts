import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from './environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

import * as styles from './effect-three.css';

const sceneView = (model: Model, h: HtmlBuilder<Message>): Html =>
  model.showScene
    ? EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: styles.scene,
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onClick: ({ key }) => Message.ClickedCube({ key }),
          onPointerEnter: ({ key }) => Message.HoveredCube({ key }),
          onPointerLeave: ({ key }) => Message.LeftCube({ key }),
        },
        h,
      )
    : h.div([h.Class(styles.placeholder)], ['Scene unmounted: its GPU resources are released.']);

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Type('button'), h.OnClick(message)], [label]);

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'effect-three: declarative Three.js for Foldkit',
  body: h.div(
    [],
    [
      sceneView(model, h),
      h.div(
        [h.Class(styles.controls)],
        [
          button(
            h,
            model.size === 'small' ? 'Grow cubes' : 'Shrink cubes',
            Message.ClickedToggleSize(),
          ),
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
        ],
      ),
      h.p(
        [h.Class(styles.status)],
        [
          `Scene ${model.status}. Clicks: ${model.clicks}. Hovering: ${Option.getOrElse(model.hovered, () => 'nothing')}. `,
          'Click a cube to repaint the shared material; both cubes change.',
        ],
      ),
    ],
  ),
});
