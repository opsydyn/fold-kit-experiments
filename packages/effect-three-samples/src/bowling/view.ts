import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { EffectThreeStage } from '../effect-ui-scene';
import { sceneMount } from './environment';
import { Message } from './message';
import { limits, type Model } from './model';
import { encode, verdict } from './replay';
import { sceneFor } from './scene';
import { frames, score } from './score';

const button = (h: Html.H<Message>, label: string, message: Message, disabled = false) =>
  h.button
    .class('e3-button')
    .attr('type', 'button')
    .disabled(disabled)
    .on('click', message)
    .children(label);

const slider = (
  h: Html.H<Message>,
  name: string,
  value: number,
  range: { readonly min: number; readonly max: number },
  step: number,
  toMessage: (value: number) => Message,
) =>
  h.label.class('e3-note').children(
    `${name} `,
    h.input
      .class('e3-range')
      .attr('type', 'range')
      .attr('min', String(range.min))
      .attr('max', String(range.max))
      .attr('step', String(step))
      .value(String(value))
      .on('input', ({ value }) => toMessage(Number.parseFloat(value) || 0)),
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
const shareLink = (model: Model, h: Html.H<Message>) =>
  model.shots.length === 0 || model.rolls.length === 0
    ? null
    : h.a
        .class('e3-button')
        .attr(
          'href',
          encode({
            shots: model.shots.slice(0, model.rolls.length),
            rolls: model.rolls,
          }),
        )
        .children('Link to this game');

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage', 'e3-stage-tall')
      .on('scene-collision', (collision) => Message.Collided({ collision }))
      .on('scene-contact-force', ({ totalForceMagnitude }) =>
        Message.Struck({ force: totalForceMagnitude }),
      )
      .on('scene-label-measured', (measured) => Message.MeasuredScoreboard({ measured }))
      .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
      .onMount(
        Mount.map(sceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    model.sceneStatus?._tag !== 'FailedScene'
      ? null
      : h.p
          .attr('role', 'status')
          .children(`Could not start the bowling lane (${model.sceneStatus.reason}).`),
    h.p.class('e3-readout').attr('aria-live', 'polite').children(status(model)),
    h.div.class('e3-controls').children(
      slider(h, 'Start', model.aim, limits.aim, 0.02, (aim) => Message.ChangedAim({ aim })),
      slider(h, 'Line', model.angle, limits.angle, 0.1, (angle) => Message.ChangedAngle({ angle })),
      slider(h, 'Speed', model.speed, limits.speed, 0.25, (speed) =>
        Message.ChangedSpeed({ speed }),
      ),
    ),
    h.div
      .class('e3-controls')
      .children(
        button(h, 'Roll', Message.ClickedRoll(), model.phase !== 'aiming' || replaying(model)),
        button(h, 'New game', Message.ClickedNewGame(), model.sceneStatus?._tag !== 'StartedScene'),
        button(h, 'Replay this game', Message.ClickedReplay(), model.shots.length === 0),
        shareLink(model, h),
      ),
    h.p
      .class('e3-note')
      .children(
        'The ball and pins are Rapier bodies. Each pin’s spot is a sensor collider named for it, ',
        'so a pin’s head leaving its spot says that pin is down; a sensor in the pit says the ball ',
        'has gone through, and a Command gives the pins a moment to settle before they are counted. ',
        'The scoreboard is a troika label, its panel sized from its measured layout. Each roll ',
        'records only what you did; a replay rolls those inputs again from a resting rack, ',
        'and the simulation knocks down the same pins (the replay checks it, roll by roll).',
      ),
  );
