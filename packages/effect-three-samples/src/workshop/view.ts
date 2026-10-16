import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Option } from 'effect';
import { match } from 'foldkit/asyncData';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { Message } from './message';
import { type Clip, clips, type Model, type RobotInfo } from './model';
import { sceneFor } from './scene';

const clipLabel = { wave: 'Wave', roll: 'Roll' } satisfies Record<Clip, string>;

const clipButton = (model: Model, h: HtmlBuilder<Message>, clip: Clip | null): Html =>
  h.button(
    [
      h.Class('e3-button'),
      h.Type('button'),
      h.AriaPressed(String(model.clip === clip)),
      h.OnClick(Message.ClickedClip({ clip })),
    ],
    [
      Option.match(Option.fromNullishOr(clip), {
        onNone: () => 'Still',
        onSome: (c) => clipLabel[c],
      }),
    ],
  );

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

const loaded = (model: Model, info: RobotInfo): string =>
  Option.match(model.part, {
    onNone: () =>
      `Loaded: ${info.parts.length} named parts and the clips ${info.clips.join(' and ')}. Click a part to name it.`,
    onSome: (part) => `You clicked the ${part}.`,
  });

const readout = (model: Model): string =>
  match(model.robot, {
    onIdle: () => 'Unloaded: the model, texture and sign font are gone.',
    onLoading: () => 'Loading the robot…',
    onRefreshing: (info) => loaded(model, info),
    onFailure: (error) => error,
    onStale: ({ error }) => error,
    onSuccess: (info) => loaded(model, info),
  });

/** The loading controls: unload when anything is loaded, reload when not. */
const loadButton = (model: Model, h: HtmlBuilder<Message>): Html =>
  match(model.robot, {
    onIdle: () => button(h, 'Reload', Message.ClickedReload()),
    onLoading: () => button(h, 'Unload', Message.ClickedUnload()),
    onRefreshing: () => button(h, 'Unload', Message.ClickedUnload()),
    onFailure: () => button(h, 'Reload', Message.ClickedReload()),
    onStale: () => button(h, 'Unload', Message.ClickedUnload()),
    onSuccess: () => button(h, 'Unload', Message.ClickedUnload()),
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Workshop — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onClick: ({ part }) => Message.ClickedPart({ part: part ?? 'robot' }),
        },
        h,
      ),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model)]),
      h.div(
        [h.Class('e3-controls'), h.AriaLabel('Animation')],
        [...clips.map((clip) => clipButton(model, h, clip)), clipButton(model, h, null)],
      ),
      h.div(
        [h.Class('e3-controls')],
        [
          h.label(
            [h.Class('e3-note')],
            [
              'Speed ',
              h.input([
                h.Class('e3-range'),
                h.Type('range'),
                h.Min('-2'),
                h.Max('2'),
                h.Step('0.25'),
                h.Value(String(model.speed)),
                h.OnInput((value) =>
                  Message.ChangedSpeed({ speed: Number.parseFloat(value) || 0 }),
                ),
              ]),
            ],
          ),
          loadButton(model, h),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'The robot is a glTF model we generate from three.js primitives; it loads through a ',
          'Foldkit Command and shows up through a borrowed node. Its clips are a function of scene ',
          'time, so they pause with the scene and rewind with DevTools time travel.',
        ],
      ),
    ],
  ),
});
