import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { EffectThreeStage } from '../effect-ui-scene';
import { sceneMount } from './command';
import { Message, type Mode } from './message';
import { type Model, PlantKind } from './model';
import { sceneFor } from './scene';

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

const kindButton = (model: Model, h: Html.H<Message>, kind: PlantKind) =>
  h.button
    .class('e3-button')
    .attr('type', 'button')
    .attr('aria-pressed', String(model.kind === kind))
    .on('click', Message.ChoseKind({ kind }))
    .children(kind);

/** The way in, for each mode the browser can present, or the way out. */
const sessionButtons = (model: Model, h: Html.H<Message>) => {
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
  const others =
    model.others.length === 0
      ? ''
      : ` ${model.others.length} other ${model.others.length === 1 ? 'player is' : 'players are'} in the room.`;
  return `${plants}. Click the floor to plant, a plant to take it away; drag to look around.${others}${found}${xr}`;
};

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage', 'e3-stage-tall')
      .on('scene-click', ({ key, point }) => clicked(key, point))
      .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
      .on('scene-xr', ({ mode }) => Message.ChangedSession({ mode }))
      .on('scene-xr-surface', (surface) => Message.SelectedSurface({ surface }))
      .on('scene-xr-planes', (detected) => Message.DetectedPlanes({ detected }))
      .on('scene-xr-meshes', (detected) => Message.DetectedMeshes({ detected }))
      .on('scene-xr-moved', (moved) => Message.Glided({ moved }))
      .on('scene-xr-teleported', (teleported) => Message.Teleported({ teleported }))
      .on('scene-xr-poses', (poses) => Message.ReportedPoses({ poses }))
      .onMount(
        Mount.map(sceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    h.p
      .class('e3-readout')
      .attr('aria-live', 'polite')
      .children(
        model.sceneFailure === null
          ? readout(model)
          : `Could not start the room (${model.sceneFailure}).`,
      ),
    h.div
      .class('e3-controls')
      .children(
        ...PlantKind.literals.map((kind) => kindButton(model, h, kind)),
        ...sessionButtons(model, h),
        button(h, 'Clear plants', Message.ClickedClear()),
      ),
    h.p
      .class('e3-note')
      .children(
        'In VR the sticks glide you around the room and a tips label rides your left hand. In AR ',
        'the furniture goes and your room shows through. Each plant you place is a WebXR anchor. ',
        'On the page, click the floor to plant. Other pages presenting the room in this browser ',
        'or through a relay (?relay=ws://…) show as avatars where their players stand.',
      ),
  );
