import { updateEditor, type EditorEvent, type EditorState } from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';
import { Runtime } from 'foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';

import { boardView, fit, boardEditor } from './board';
import { initialScene } from './contracts';

const Message = defineMessageUnion({
  ObservedBoardInput: { input: Schema.Unknown },
  ClickedFitScene: {},
  ClickedZoomIn: {},
  ClickedZoomOut: {},
});
type Message = typeof Message.Type;
// SAFETY: The runtime stores editor state created locally by boardEditor.
const Model = Schema.Unknown as Schema.Codec<EditorState>;
const title = 'The Moonwell Observatory';
const instructions = 'Drag the scene to pan. Scroll or use the zoom buttons to zoom.';
const init = () => ({ model: boardEditor(initialScene, true) });

function zoom(editor: EditorState, factor: number): EditorState {
  if (!editor.surface) return editor;
  const { viewport, surface } = editor;
  const next = Math.max(0.1, Math.min(3, viewport.zoom * factor));
  const ratio = next / viewport.zoom;
  const x = surface.width / 2;
  const y = surface.height / 2;
  return updateEditor(editor, {
    type: 'ViewportChanged',
    viewport: { x: x + (viewport.x - x) * ratio, y: y + (viewport.y - y) * ratio, zoom: next },
  });
}

function update(model: EditorState, message: Message) {
  return Message.match(message, {
    ObservedBoardInput: ({ input }) => {
      // SAFETY: boardView sends EditorEvent values directly through onEvent.
      const event = input as EditorEvent;
      const editor = updateEditor(model, event);
      return { model: event.type === 'SurfaceMeasured' ? fit(editor, event.size) : editor };
    },
    ClickedFitScene: () => ({ model: fit(model, model.surface) }),
    ClickedZoomIn: () => ({ model: zoom(model, 1.25) }),
    ClickedZoomOut: () => ({ model: zoom(model, 0.8) }),
  });
}

function view(backdrop: string, pip: string) {
  return (editor: EditorState, h: HtmlBuilder<Message>): Document => ({
    title: title + ' · Questmancer preview',
    body: h.main(
      [h.Class('tabletop')],
      [
        h.header(
          [h.Class('scene-header')],
          [
            h.div([], [h.p([h.Class('brand')], ['Read-only preview']), h.h1([], [title])]),
            h.div(
              [h.Class('scene-actions')],
              [
                h.button([h.Type('button'), h.OnClick(Message.ClickedZoomOut())], ['Zoom out']),
                h.button([h.Type('button'), h.OnClick(Message.ClickedZoomIn())], ['Zoom in']),
                h.button([h.Type('button'), h.OnClick(Message.ClickedFitScene())], ['Fit scene']),
              ],
            ),
          ],
        ),
        boardView(h, editor, {
          id: 'moonwell-preview-board',
          title,
          backdrop,
          instructions,
          onEvent: (input) => Message.ObservedBoardInput({ input }),
          artFor: (id) => (id === 'pip' ? pip : '/questmancer-art/' + id + '.png'),
        }),
        h.footer([h.Class('scene-footer')], [h.p([], [instructions])]),
      ],
    ),
  });
}

const container = document.getElementById('questmancer-preview');
const backdrop = container?.dataset.backdrop;
const pip = container?.dataset.pip;
if (container && backdrop && pip)
  Runtime.run(
    Runtime.makeApplication({ container, Model, init, update, view: view(backdrop, pip) }),
  );
