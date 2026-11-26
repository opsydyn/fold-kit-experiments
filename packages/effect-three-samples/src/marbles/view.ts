import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { EffectThreeStage } from '../effect-ui-scene';
import { sceneMount } from './environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

const stat = (h: Html.H<Message>, term: string, value: string) =>
  h.div.class('e3-stat').children(h.dt(term), h.dd(value));

const strays = (model: Model): number => model.goldBin.teal + model.tealBin.gold;
const direction = (model: Model): string => (model.wheelSpeed < 0 ? 'clockwise' : 'anticlockwise');

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage', 'e3-stage-tall')
      .on('scene-collision', (collision) => Message.Collided({ collision }))
      .on('scene-contact-force', ({ totalForceMagnitude }) =>
        Message.KnockedWheel({ force: totalForceMagnitude }),
      )
      .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
      .on('scene-auto-rotated', (turned) => Message.AutoRotated({ turned }))
      .onMount(
        Mount.map(sceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    h.dl
      .class('e3-stats')
      .children(
        stat(h, 'Gold binned', `${model.goldBin.gold} of ${model.poured.gold}`),
        stat(h, 'Teal binned', `${model.tealBin.teal} of ${model.poured.teal}`),
        stat(h, 'Strays', String(strays(model))),
        stat(h, 'Knocks', String(model.knocks)),
        stat(h, 'Hardest', `${model.hardest.toFixed(1)} N`),
        stat(h, 'Wheel', `${Math.abs(model.wheelSpeed).toFixed(1)} rad/s ${direction(model)}`),
      ),
    h.div
      .class('e3-controls')
      .children(
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
      ),
    h.p
      .class('e3-note')
      .children(
        'The wheel is hinged to its axle by a revolute joint whose motor speed is in the Model. ',
        'The grate’s collision groups admit teal marbles only, so gold ones fall through it. ',
        'Each bin is a named sensor collider, so collisions say which bin a marble entered, and ',
        'the wheel reports contact forces above a threshold. Reverse the wheel and it flings gold ',
        'marbles left, past the grate. Watch the strays. The camera turns by itself until you ',
        'drag it, then carries on from where it was.',
      ),
  );
