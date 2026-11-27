import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Match, Option } from 'effect';

import { defineLabelledSceneMount, EffectThreeStage } from '../effect-ui-scene';
import { Message } from './message';
import { type Clip, clips, type Model, type RobotInfo } from './model';
import { sceneFor } from './scene';

const SceneMount = defineLabelledSceneMount();
const clipLabel = { wave: 'Wave', roll: 'Roll' } satisfies Record<Clip, string>;

const clipButton = (model: Model, h: Html.H<Message>, clip: Clip | null) =>
  h.button
    .class('e3-button')
    .attr('type', 'button')
    .attr('aria-pressed', String(model.clip === clip))
    .on('click', Message.ClickedClip({ clip }))
    .children(clip === null ? 'Still' : clipLabel[clip]);

const detailOf = (info: RobotInfo): string => (info.final ? 'Loaded' : 'Low detail, sharpening');

const loaded = (model: Model, info: RobotInfo): string =>
  Option.match(model.part, {
    onNone: () =>
      `${detailOf(info)}: ${info.parts.length} named parts and the clips ${info.clips.join(' and ')}. Click a part to name it.`,
    onSome: (part) => `You clicked the ${part}.`,
  });

const readout = (model: Model): string =>
  Match.value(model.robot).pipe(
    Match.tagsExhaustive({
      Idle: () => 'Unloaded: the model, texture and sign font are gone.',
      Loading: () => 'Loading the robot…',
      Failure: ({ error }) => error,
      Success: ({ data }) => loaded(model, data),
    }),
  );

const loadButton = (model: Model, h: Html.H<Message>) => {
  const reloading = model.robot._tag === 'Idle' || model.robot._tag === 'Failure';
  return h.button
    .class('e3-button')
    .attr('type', 'button')
    .disabled(model.sceneStatus?._tag === 'FailedScene')
    .on('click', reloading ? Message.ClickedReload() : Message.ClickedUnload())
    .children(reloading ? 'Reload' : 'Unload');
};

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage')
      .on('scene-click', ({ part }) => Message.ClickedPart({ part: part ?? 'robot' }))
      .on('scene-asset-loaded', ({ id, final, parts, clips }) =>
        Message.LoadedAsset({ id, final, parts, clips }),
      )
      .on('scene-asset-failed', ({ id, reason }) => Message.FailedAsset({ id, reason }))
      .onMount(
        Mount.map(SceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    h.p
      .class('e3-readout')
      .attr('aria-live', 'polite')
      .children(
        model.sceneStatus?._tag === 'FailedScene'
          ? `Could not start the workshop (${model.sceneStatus.reason}).`
          : readout(model),
      ),
    h.div
      .class('e3-controls')
      .attr('aria-label', 'Animation')
      .children(...clips.map((clip) => clipButton(model, h, clip)), clipButton(model, h, null)),
    h.div.class('e3-controls').children(
      h.label.class('e3-note').children(
        'Speed ',
        h.input
          .class('e3-range')
          .attr('type', 'range')
          .attr('min', '-2')
          .attr('max', '2')
          .attr('step', '0.25')
          .value(String(model.speed))
          .on('input', ({ value }) =>
            Message.ChangedSpeed({ speed: Number.parseFloat(value) || 0 }),
          ),
      ),
      loadButton(model, h),
    ),
    h.p
      .class('e3-note')
      .children(
        'The scene asks for the robot, floor texture and sign font. Unloading cancels pending requests and releases assets that have arrived. The robot follows its animation clip as the scene advances.',
      ),
  );
