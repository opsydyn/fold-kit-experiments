import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { type Paint, paintCss, paints } from '../palette';
import { Message } from './message';
import { type Model, type Piece, pieces } from './model';
import { sceneFor } from './scene';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

const swatch = (model: Model, h: HtmlBuilder<Message>, paint: Paint): Html =>
  h.button(
    [
      h.Class('e3-button'),
      h.Type('button'),
      h.AriaPressed(String(model.paint === paint)),
      h.OnClick(Message.ClickedPaint({ paint })),
    ],
    [h.span([h.Class('e3-swatch'), h.Style({ background: paintCss(paint) })], []), paint],
  );

const piecePicker = (model: Model, h: HtmlBuilder<Message>, piece: Piece): Html =>
  h.button(
    [
      h.Class('e3-button'),
      h.Type('button'),
      h.AriaPressed(String(model.piece === piece)),
      h.OnClick(Message.ClickedPiece({ piece })),
    ],
    [piece],
  );

const history = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('e3-controls')],
    [
      button(h, 'Undo', Message.ClickedUndo()),
      h.input([
        h.Class('e3-range'),
        h.Type('range'),
        h.Min('0'),
        h.Max(String(model.blocks.length)),
        h.Value(String(model.shown)),
        h.AriaLabel('Build history'),
        h.OnInput((value) => Message.ChangedHistory({ shown: Number.parseInt(value, 10) || 0 })),
      ]),
      button(h, 'Redo', Message.ClickedRedo()),
      button(h, 'Clear', Message.ClickedClear()),
    ],
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Sculpture — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onClick: ({ key, point }) => Message.ClickedSurface({ key, x: point[0], z: point[2] }),
        },
        h,
      ),
      h.div(
        [h.Class('e3-controls')],
        paints.map((paint) => swatch(model, h, paint)),
      ),
      h.div(
        [h.Class('e3-controls'), h.AriaLabel('Piece')],
        pieces.map((piece) => piecePicker(model, h, piece)),
      ),
      history(model, h),
      h.p(
        [h.Class('e3-note')],
        [
          `Showing ${model.shown} of ${model.blocks.length} pieces. Click the ground or a piece to stack a block, ball or drum. `,
          'The scene is a pure function of the model, so the history slider replays the build exactly.',
        ],
      ),
    ],
  ),
});
