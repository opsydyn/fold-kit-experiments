import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from './environment';
import { Message } from './message';
import { limits, type Model } from './model';
import { encode, verdict } from './replay';
import { sceneFor } from './scene';
import { frames, score } from './score';

const button = (h: HtmlBuilder<Message>, label: string, message: Message, disabled = false): Html =>
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
    racking: `Frame ${frame}. The pins are settling…`,
    aiming: `Frame ${frame}. ${model.standing.length} pins standing: aim and roll.`,
    rolling: 'Rolling…',
    settling: 'Through to the pit; letting the pins settle…',
    over: `Game over: ${score(model.rolls)}.`,
  }[model.phase];
  const impact = model.impact > 0 ? ` Hardest hit ${model.impact.toFixed(0)} N.` : '';
  return `${replayStatus(model)}${phase}${impact}`;
};

/** How a replay is going: rolling its record, or how it compared once done. */
const replayStatus = (model: Model): string => {
  if (model.replay === null) return '';
  const { shots, rolls, rolled } = model.replay;
  const check = verdict(rolls, model.rolls);
  const progress = `Replaying roll ${Math.min(rolled, shots.length)} of ${shots.length}. `;
  if (check._tag === 'Differs') {
    return `${progress}Roll ${check.roll} knocked ${check.got}, not the ${check.expected} recorded. `;
  }
  const done = rolled === shots.length && model.rolls.length >= rolls.length;
  return done
    ? `Replayed ${shots.length} rolls: every one knocked down the same pins as recorded. `
    : progress;
};

const replaying = (model: Model): boolean =>
  model.replay !== null && model.replay.rolled < model.replay.shots.length;

/** A link that replays this game: its rolls' inputs and outcomes, in the address. */
const shareLink = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  model.shots.length === 0 || model.rolls.length === 0
    ? []
    : [
        h.a(
          [
            h.Class('e3-button'),
            h.Href(encode({ shots: model.shots.slice(0, model.rolls.length), rolls: model.rolls })),
          ],
          ['Link to this game'],
        ),
      ];

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
          onContactForce: ({ totalForceMagnitude }) =>
            Message.Struck({ force: totalForceMagnitude }),
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
          button(h, 'Roll', Message.ClickedRoll(), model.phase !== 'aiming' || replaying(model)),
          button(h, 'New game', Message.ClickedNewGame()),
          button(h, 'Replay this game', Message.ClickedReplay(), model.shots.length === 0),
          ...shareLink(model, h),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'The ball and pins are Rapier bodies. Each pin’s spot is a sensor collider named for it, ',
          'so a pin’s head leaving its spot says that pin is down; a sensor in the pit says the ball ',
          'has gone through, and a Command gives the pins a moment to settle before they are counted. ',
          'The scoreboard is a troika label, its panel sized from its measured layout. Each roll ',
          'records only what you did; a replay rolls those inputs again from a resting rack, ',
          'and the simulation knocks down the same pins (the replay checks it, roll by roll).',
        ],
      ),
    ],
  ),
});
