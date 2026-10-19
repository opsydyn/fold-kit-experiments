import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from './environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const toggle = (h: HtmlBuilder<Message>, label: string, on: boolean, message: Message): Html =>
  h.button(
    [h.Class('e3-button'), h.Type('button'), h.AriaPressed(String(on)), h.OnClick(message)],
    [label],
  );

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Curves — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage e3-stage-tall e3-stage-night',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onPointerDown: ({ key, ray }) =>
            Message.PressedHandle({ key, origin: ray.origin, direction: ray.direction }),
          onDrag: ({ key, ray }) =>
            Message.DraggedHandle({ key, origin: ray.origin, direction: ray.direction }),
          onDragEnd: () => Message.DroppedHandle(),
        },
        h,
      ),
      h.p(
        [h.Class('e3-readout'), h.AriaLive('polite')],
        ['Drag a handle to reshape the curve; the comet follows the new path at once.'],
      ),
      h.div(
        [h.Class('e3-controls')],
        [
          toggle(h, 'Dashed curve', model.dashed, Message.ClickedDashes()),
          toggle(h, 'Glitter', model.glitter, Message.ClickedGlitter()),
          button(h, 'Reset the handles', Message.ClickedReset()),
        ],
      ),
    ],
  ),
});
