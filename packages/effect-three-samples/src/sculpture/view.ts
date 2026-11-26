import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { EffectThreeStage, unlabelledSceneMount } from '../effect-ui-scene';
import { type Paint, paintCss, paints } from '../palette';
import { Message } from './message';
import { type Model, type Piece, pieces } from './model';
import { sceneFor } from './scene';

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

const swatch = (model: Model, h: Html.H<Message>, paint: Paint) =>
  h.button
    .class('e3-button')
    .attr('type', 'button')
    .attr('aria-pressed', String(model.paint === paint))
    .on('click', Message.ClickedPaint({ paint }))
    .children(
      h.span
        .class('e3-swatch')
        .style({ background: paintCss(paint) })
        .children(),
      paint,
    );

const piecePicker = (model: Model, h: Html.H<Message>, piece: Piece) =>
  h.button
    .class('e3-button')
    .attr('type', 'button')
    .attr('aria-pressed', String(model.piece === piece))
    .on('click', Message.ClickedPiece({ piece }))
    .children(piece);

const history = (model: Model, h: Html.H<Message>) =>
  h.div.class('e3-controls').children(
    button(h, 'Undo', Message.ClickedUndo()),
    h.input
      .class('e3-range')
      .attr('type', 'range')
      .attr('min', '0')
      .attr('max', String(model.blocks.length))
      .value(String(model.shown))
      .attr('aria-label', 'Build history')
      .on('input', ({ value }) =>
        Message.ChangedHistory({ shown: Number.parseInt(value, 10) || 0 }),
      ),
    button(h, 'Redo', Message.ClickedRedo()),
    button(h, 'Clear', Message.ClickedClear()),
  );

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage')
      .on('scene-click', ({ key, point }) =>
        Message.ClickedSurface({ key, x: point[0], z: point[2] }),
      )
      .onMount(
        Mount.map(unlabelledSceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    h.div.class('e3-controls').children(...paints.map((paint) => swatch(model, h, paint))),
    h.div
      .class('e3-controls')
      .attr('aria-label', 'Piece')
      .children(...pieces.map((piece) => piecePicker(model, h, piece))),
    history(model, h),
    h.p
      .class('e3-note')
      .children(
        `Showing ${model.shown} of ${model.blocks.length} pieces. Click the ground or a piece to stack a block, ball or drum. `,
        'The scene is a pure function of the model, so the history slider replays the build exactly.',
      ),
  );
