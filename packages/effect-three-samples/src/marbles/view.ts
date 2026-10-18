import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from './environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

const stat = (h: HtmlBuilder<Message>, term: string, value: string): Html =>
  h.div([h.Class('e3-stat')], [h.dt([], [term]), h.dd([], [value])]);

/** Marbles in the wrong bin: none, unless the grate let one through. */
const strays = (model: Model): number => model.goldBin.teal + model.tealBin.gold;

const direction = (model: Model): string => (model.wheelSpeed < 0 ? 'clockwise' : 'anticlockwise');

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Marble machine — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage e3-stage-tall',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onCollision: (collision) => Message.Collided({ collision }),
          onContactForce: ({ totalForceMagnitude }) =>
            Message.KnockedWheel({ force: totalForceMagnitude }),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
          onAutoRotated: (turned) => Message.AutoRotated({ turned }),
        },
        h,
      ),
      h.dl(
        [h.Class('e3-stats')],
        [
          stat(h, 'Gold binned', `${model.goldBin.gold} of ${model.poured.gold}`),
          stat(h, 'Teal binned', `${model.tealBin.teal} of ${model.poured.teal}`),
          stat(h, 'Strays', `${strays(model)}`),
          stat(h, 'Knocks', `${model.knocks}`),
          stat(h, 'Hardest', `${model.hardest.toFixed(1)} N`),
          stat(
            h,
            'Wheel',
            `${Math.abs(model.wheelSpeed).toFixed(1)} rad/s ${direction(model)}`,
          ),
        ],
      ),
      h.div(
        [h.Class('e3-controls')],
        [
          button(h, 'Pour gold', Message.ClickedPour({ colour: 'gold' })),
          button(h, 'Pour teal', Message.ClickedPour({ colour: 'teal' })),
          button(h, 'Faster', Message.ClickedFaster()),
          button(h, 'Slower', Message.ClickedSlower()),
          button(h, 'Reverse', Message.ClickedReverse()),
          button(h, 'Empty', Message.ClickedEmpty()),
          button(
            h,
            model.showColliders ? 'Hide colliders' : 'Show colliders',
            Message.ToggledColliders(),
          ),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'The wheel is hinged to its axle by a revolute joint whose motor speed is in the Model. ',
          'The grate’s collision groups admit teal marbles only, so gold ones fall through it. ',
          'Each bin is a named sensor collider, so collisions say which bin a marble entered, and ',
          'the wheel reports contact forces above a threshold. Reverse the wheel and it flings gold ',
          'marbles left, past the grate: watch the strays. The camera turns by itself until you ',
          'drag it, then carries on from where it was.',
        ],
      ),
    ],
  ),
});
