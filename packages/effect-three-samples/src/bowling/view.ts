import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from './environment';
import { Message } from './message';
import { limits, type Model } from './model';
import { frames, score } from './score';
import { sceneFor } from './scene';

const button = (
  h: HtmlBuilder<Message>,
  label: string,
  message: Message,
  disabled = false,
): Html =>
  h.button(
    [h.Class('e3-button'), h.Type('button'), h.Disabled(disabled), h.OnClick(message)],
    [label],
  );

const slider = (
  h: HtmlBuilder<Message>,
  name: string,
  value: number,
  range: { readonly min: number; readonly max: number },
  step: number,
  toMessage: (value: number) => Message,
): Html =>
  h.label(
    [h.Class('e3-note')],
    [
      `${name} `,
      h.input([
        h.Class('e3-range'),
        h.Type('range'),
        h.Min(String(range.min)),
        h.Max(String(range.max)),
        h.Step(String(step)),
        h.Value(String(value)),
        h.OnInput((raw) => toMessage(Number.parseFloat(raw) || 0)),
      ]),
    ],
  );

const status = (model: Model): string => {
  const frame = Math.min(10, frames(model.rolls).filter((each) => each.total !== null).length + 1);
  const phase = {
    aiming: `Frame ${frame}. ${model.standing.length} pins standing: aim and roll.`,
    rolling: 'Rolling…',
    settling: 'Through to the pit; letting the pins settle…',
    over: `Game over: ${score(model.rolls)}.`,
  }[model.phase];
  const impact = model.impact > 0 ? ` Hardest hit ${model.impact.toFixed(0)} N.` : '';
  return `${phase}${impact}`;
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Bowling — effect-three',
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
          onContactForce: ({ totalForceMagnitude }) => Message.Struck({ force: totalForceMagnitude }),
          onLabelMeasured: (measured) => Message.MeasuredScoreboard({ measured }),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
        },
        h,
      ),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [status(model)]),
      h.div(
        [h.Class('e3-controls')],
        [
          slider(h, 'Start', model.aim, limits.aim, 0.02, (aim) => Message.ChangedAim({ aim })),
          slider(h, 'Line', model.angle, limits.angle, 0.1, (angle) =>
            Message.ChangedAngle({ angle }),
          ),
          slider(h, 'Speed', model.speed, limits.speed, 0.25, (speed) =>
            Message.ChangedSpeed({ speed }),
          ),
        ],
      ),
      h.div(
        [h.Class('e3-controls')],
        [
          button(h, 'Roll', Message.ClickedRoll(), model.phase !== 'aiming'),
          button(h, 'New game', Message.ClickedNewGame()),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'The ball and pins are Rapier bodies. Each pin’s spot is a sensor collider named for it, ',
          'so a pin’s head leaving its spot says that pin is down; a sensor in the pit says the ball ',
          'has gone through, and a Command gives the pins a moment to settle before they are counted. ',
          'The scoreboard is a troika label, its panel sized from its measured layout.',
        ],
      ),
    ],
  ),
});
