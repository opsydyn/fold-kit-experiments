import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { notice, sceneMount } from '../labelledEnvironment';
import { rendererNote } from '../notice';
import { Message, type Mode } from './message';
import { type Model, PlantKind } from './model';
import { sceneFor } from './scene';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

const kindButton = (model: Model, h: HtmlBuilder<Message>, kind: PlantKind): Html =>
  h.button(
    [
      h.Class('e3-button'),
      h.Type('button'),
      h.AriaPressed(String(model.kind === kind)),
      h.OnClick(Message.ChoseKind({ kind })),
    ],
    [kind],
  );

/** The way in, for each mode the browser can present, or the way out. */
const sessionButtons = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  if (model.session === 'entering') return [button(h, 'Entering…', Message.ClickedExit())];
  if (model.session !== 'none') return [button(h, 'Exit', Message.ClickedExit())];
  const offers: ReadonlyArray<readonly [Mode, string, Model['vr']]> = [
    ['immersive-vr', 'Enter VR', model.vr],
    ['immersive-ar', 'Enter AR', model.ar],
  ];
  return offers
    .filter(([, , support]) => support === 'ready')
    .map(([mode, label]) => button(h, label, Message.ClickedEnter({ mode })));
};

/** The plant a hit names: its pot or leaves are `<plant>:<part>`. */
const plantOf = (key: string): string | undefined =>
  key.startsWith('plant-') ? key.split(':')[0] : undefined;

const clicked = (key: string, point: readonly [number, number, number]): Message => {
  const plant = plantOf(key);
  if (plant !== undefined) return Message.ClickedPlant({ id: plant });
  return Message.ClickedFloor({ point });
};

const readout = (model: Model): string => {
  const plants = `${model.plants.length} plant${model.plants.length === 1 ? '' : 's'}`;
  const found =
    model.session === 'immersive-ar'
      ? ` The session has found ${model.planes.length} planes and ${model.meshes.length} meshes.`
      : '';
  const xr =
    model.vr === 'ready' || model.ar === 'ready'
      ? ''
      : ' This browser has no headset to present to: the room works here as it is.';
  return `${plants}. Click the floor to plant, a plant to take it away; drag to look around.${found}${xr}`;
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'XR room — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage e3-stage-tall',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onClick: ({ key, point }) => clicked(key, point),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
          onXRSession: ({ mode }) => Message.ChangedSession({ mode }),
          onXRSurface: (surface) => Message.SelectedSurface({ surface }),
          onXRPlanes: (detected) => Message.DetectedPlanes({ detected }),
          onXRMeshes: (detected) => Message.DetectedMeshes({ detected }),
          onXRMoved: (moved) => Message.Glided({ moved }),
        },
        h,
      ),
      ...rendererNote(h, notice),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model)]),
      h.div(
        [h.Class('e3-controls')],
        [
          ...PlantKind.literals.map((kind) => kindButton(model, h, kind)),
          ...sessionButtons(model, h),
          button(h, 'Clear plants', Message.ClickedClear()),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'In VR the sticks glide you round the room and a tips label rides your left hand. In AR ',
          'the furniture goes and your room shows through: each plant you place is a WebXR anchor, ',
          'and the planes and meshes the device detects are drawn from Messages, each by a group ',
          'following its tracked space. On the page, click the floor to plant. In development an ',
          'agent can arrange the room too: the Foldkit DevTools MCP server sends it PlacedPlant.',
        ],
      ),
    ],
  ),
});
