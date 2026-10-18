import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { Message } from './message';
import { type Model, noteLimit } from './model';
import { plaques } from './plaques';
import { sceneFor } from './scene';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

/** The plaque a hit names: its group is the plaque, whichever part was hit. */
const plaqueOf = (key: string): string => key.split(':')[0] ?? key;

const isPlaque = (id: string): boolean =>
  id === 'note' || plaques.some((plaque) => plaque.id === id);

const width = (model: Model, key: string): string => {
  const block = model.layouts[key];
  return block === undefined
    ? '…'
    : `${(block[2] - block[0]).toFixed(2)} × ${(block[3] - block[1]).toFixed(2)}`;
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Type gallery — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage e3-stage-tall',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onClick: ({ key }) =>
            isPlaque(plaqueOf(key))
              ? Message.ClickedPlaque({ id: plaqueOf(key) })
              : Message.ClickedAway(),
          onPointerMissed: () => Message.ClickedAway(),
          onLabelMeasured: (measured) => Message.MeasuredLabel({ measured }),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
        },
        h,
      ),
      h.div(
        [h.Class('e3-controls')],
        [
          h.label(
            [h.Class('e3-note')],
            [
              'Write on the wall ',
              h.input([
                h.Class('e3-text'),
                h.Type('text'),
                h.Maxlength(noteLimit),
                h.Value(model.note),
                h.OnInput((note) => Message.ChangedNote({ note })),
              ]),
            ],
          ),
          button(h, model.lit ? 'Lights off' : 'Lights on', Message.ToggledLights()),
        ],
      ),
      h.p(
        [h.Class('e3-readout'), h.AriaLive('polite')],
        [`Your note is laid out ${width(model, 'note:text')} units; its panel follows.`],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'Every word here is a troika label described as data. The title follows the wall’s curve, ',
          'the code is coloured by colour ranges, and with the lights on the labels take a lit ',
          'material. Each panel is sized from its label’s measured layout, reported back as a ',
          'Message. Click a plaque to walk up to it; drag to look around.',
        ],
      ),
    ],
  ),
});
