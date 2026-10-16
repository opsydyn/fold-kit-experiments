import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from './environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

const readout = (model: Model): string =>
  `${model.toys.length} toys, ${model.bumps} bumps. Click a toy to kick it; drag around them to orbit.`;

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Toybox — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onClick: ({ key, ray }) => Message.ClickedToy({ key, direction: ray.direction }),
          onCollision: () => Message.Bumped(),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
        },
        h,
      ),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model)]),
      h.div(
        [h.Class('e3-controls')],
        [
          button(h, 'Drop a toy', Message.ClickedDrop()),
          button(h, 'Tidy up', Message.ClickedTidy()),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'Each toy is a mesh with a dynamic body; Rapier owns where it is. The Model keeps ',
          'where it was dropped and its kicks, each with a new id, applied once.',
        ],
      ),
    ],
  ),
});
