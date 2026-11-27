import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { defineLabelledSceneMount, EffectThreeStage } from '../effect-ui-scene';
import { Message } from './message';
import { type Model, noteLimit } from './model';
import { plaques } from './plaques';
import { sceneFor } from './scene';

const SceneMount = defineLabelledSceneMount();

const plaqueOf = (key: string): string => key.split(':')[0] ?? key;

const clicked = ({ key }: { readonly key: string }): Message => {
  const id = plaqueOf(key);
  return id === 'note' || plaques.some((plaque) => plaque.id === id)
    ? Message.ClickedPlaque({ id })
    : Message.ClickedAway();
};

const width = (model: Model, key: string): string => {
  const block = model.layouts[key];
  return block === undefined
    ? '…'
    : `${(block[2] - block[0]).toFixed(2)} × ${(block[3] - block[1]).toFixed(2)}`;
};

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage', 'e3-stage-tall')
      .on('scene-click', clicked)
      .on('scene-pointer-missed', Message.ClickedAway())
      .on('scene-label-measured', (measured) => Message.MeasuredLabel({ measured }))
      .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
      .onMount(
        Mount.map(SceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    model.sceneFailure === null
      ? null
      : h.p.attr('role', 'status').children(`Could not start the gallery (${model.sceneFailure}).`),
    h.div.class('e3-controls').children(
      h.label.class('e3-note').children(
        'Write on the wall ',
        h.input
          .class('e3-text')
          .attr('type', 'text')
          .attr('maxlength', String(noteLimit))
          .value(model.note)
          .on('input', ({ value }) => Message.ChangedNote({ note: value })),
      ),
      h.button
        .class('e3-button')
        .attr('type', 'button')
        .on('click', Message.ToggledLights())
        .children(model.lit ? 'Lights off' : 'Lights on'),
    ),
    h.p
      .class('e3-readout')
      .attr('aria-live', 'polite')
      .children(`Your note is laid out ${width(model, 'note:text')} units; its panel follows.`),
    h.p
      .class('e3-note')
      .children(
        'Every word here is a troika label described as data. The title follows the wall’s curve, ',
        'the code is coloured by colour ranges, and with the lights on the labels take a lit ',
        'material. Each panel is sized from its label’s measured layout, reported back as a ',
        'Message. Click a plaque to walk up to it; drag to look around.',
      ),
  );
