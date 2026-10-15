import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Match, Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { Message } from './message';
import type { CubeSize, Model } from './model';
import { sceneFor } from './scene';

const liveStage = (model: Model, h: HtmlBuilder<Message>): Html =>
  EffectThreeFoldkit.view(
    {
      scene: sceneFor(model),
      mount: sceneMount,
      className: 'e3-stage',
      onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
      onClick: ({ key }) => Message.ClickedCube({ key }),
      onPointerEnter: ({ key }) => Message.HoveredCube({ key }),
      onPointerLeave: ({ key }) => Message.LeftCube({ key }),
    },
    h,
  );

const placeholder = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('e3-stage e3-stage-placeholder')],
    ['Scene unmounted: its renderer, WebGL context and GPU resources are released.'],
  );

const stage = (model: Model, h: HtmlBuilder<Message>): Html =>
  Option.liftPredicate(model, (candidate: Model) => candidate.showScene).pipe(
    Option.match({ onSome: (shown) => liveStage(shown, h), onNone: () => placeholder(h) }),
  );

const sizeLabel = { small: 'Grow cubes', large: 'Shrink cubes' } satisfies Record<CubeSize, string>;

/** The label for a toggle that is currently on or off. */
const toggleLabel = (on: boolean, whenOn: string, whenOff: string): string =>
  Match.value(on).pipe(
    Match.when(true, () => whenOn),
    Match.orElse(() => whenOff),
  );

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Shared resources — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      stage(model, h),
      h.div(
        [h.Class('e3-controls')],
        [
          button(h, sizeLabel[model.size], Message.ClickedToggleSize()),
          button(
            h,
            toggleLabel(model.showSecondCube, 'Remove right cube', 'Add right cube'),
            Message.ClickedToggleSecondCube(),
          ),
          button(
            h,
            toggleLabel(model.showScene, 'Unmount scene', 'Mount scene'),
            Message.ClickedToggleScene(),
          ),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          `Scene ${model.status}. Clicks: ${model.clicks}. Hovering: ${Option.getOrElse(model.hovered, () => 'nothing')}. `,
          'Click a cube to repaint the shared material: both cubes change.',
        ],
      ),
    ],
  ),
});
