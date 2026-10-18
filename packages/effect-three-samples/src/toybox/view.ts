import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from './environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

/** Shown only where the browser can present VR; in VR, the way back out. */
const vrButtons = {
  checking: () => [],
  unavailable: () => [],
  ready: (h: HtmlBuilder<Message>) => [button(h, 'Enter VR', Message.ClickedEnterVr())],
  entering: (h: HtmlBuilder<Message>) => [button(h, 'Entering VR…', Message.ClickedExitVr())],
  presenting: (h: HtmlBuilder<Message>) => [button(h, 'Exit VR', Message.ClickedExitVr())],
} satisfies Record<Model['vr'], (h: HtmlBuilder<Message>) => ReadonlyArray<Html>>;

const vrButton = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  vrButtons[model.vr](h);

const readout = (model: Model): string =>
  `${model.toys.length} toys, ${model.marbles} marbles, ${model.bumps} bumps. Click a toy to kick it; drag around them to orbit.`;

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
          onCollision: ({ started, aInstance, bInstance }) =>
            Message.Bumped({ started, marble: aInstance !== undefined || bInstance !== undefined }),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
          onXRSession: ({ mode }) => Message.ChangedVrSession({ presenting: mode !== null }),
          onXRStick: (stick) => Message.PushedStick({ stick }),
        },
        h,
      ),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model)]),
      h.div(
        [h.Class('e3-controls')],
        [
          button(h, 'Drop a toy', Message.ClickedDrop()),
          button(h, 'Pour marbles', Message.ClickedPour()),
          button(h, 'Tidy up', Message.ClickedTidy()),
          button(
            h,
            model.showColliders ? 'Hide colliders' : 'Show colliders',
            Message.ToggledColliders(),
          ),
          ...vrButton(model, h),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'Each toy is a mesh with a dynamic body; Rapier owns where it is. The Model keeps ',
          'where it was dropped and its kicks, each with a new id, applied once. The marbles ',
          'are one instanced mesh with a body per instance; the chain is links held by ',
          'spherical joints.',
        ],
      ),
    ],
  ),
});
