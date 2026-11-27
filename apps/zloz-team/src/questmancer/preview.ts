import { UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { updateEditor, type EditorState } from '@opsydyn/foldkit-zloz';
import { BrowserInput, graphSurface, zlozDarkTheme } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { boardEditor, fit, sceneHeight, sceneWidth } from './board-state';
import { initialScene } from './contracts';

const Props = Schema.Struct({ backdrop: Schema.String, pip: Schema.String });
const Message = UiSchema.TaggedEnum({
  ObservedBoardInput: { input: BrowserInput },
  ClickedFitScene: {},
  ClickedZoomIn: {},
  ClickedZoomOut: {},
});
type Message = typeof Message.Type;
// SAFETY: The hydration snapshot contains only JSON editor state from boardEditor.
const Editor = Schema.fromJsonString(Schema.Unknown) as Schema.Codec<EditorState, string>;
const Model = Schema.Struct({ editor: Editor, art: Props });
const title = 'The Moonwell Observatory';
const instructions = 'Drag the scene to pan. Scroll or use the zoom buttons to zoom.';
const instructionsId = 'moonwell-preview-instructions';

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

function update(model: EditorState, message: Message): EditorState {
  return Message.match(message, {
    ObservedBoardInput: ({ input }) => {
      const editor = updateEditor(model, input);
      return input.type === 'SurfaceMeasured' ? fit(editor, input.size) : editor;
    },
    ClickedFitScene: () => fit(model, model.surface),
    ClickedZoomIn: () => zoom(model, 1.25),
    ClickedZoomOut: () => zoom(model, 0.8),
  });
}

export const QuestmancerPreview = Html.component({
  name: 'QuestmancerPreview',
  props: Props,
  model: Model,
  message: Message,
}).make({
  init: ({ props }) => ({ editor: boardEditor(initialScene, true), art: props }),
  update: ($, message) =>
    $.set({ editor: update($.model.editor, message), art: $.model.art }).run(),
  view: (h, { editor, art: { backdrop, pip } }) =>
    h.main.class('tabletop').children(
      h.header
        .class('scene-header')
        .children(
          h.div.children(h.p.class('brand').children('Read-only preview'), h.h1.children(title)),
          h.div
            .class('scene-actions')
            .children(
              h.button
                .attr('type', 'button')
                .on('click', Message.ClickedZoomOut())
                .children('Zoom out'),
              h.button
                .attr('type', 'button')
                .on('click', Message.ClickedZoomIn())
                .children('Zoom in'),
              h.button
                .attr('type', 'button')
                .on('click', Message.ClickedFitScene())
                .children('Fit scene'),
            ),
        ),
      h.div.class('scene-board', 'preview-board').children(
        graphSurface(h, editor, {
          id: 'moonwell-preview-board',
          label: title + ' tabletop',
          descriptionId: instructionsId,
          theme: zlozDarkTheme,
          pinchZoom: true,
          wheelNavigation: 'zoom',
          onInput: (input) => Message.ObservedBoardInput({ input }),
          background: {
            type: 'custom',
            render: ({ viewport }, canvas) =>
              canvas.img
                .class('scene-art')
                .attrs({ src: backdrop, alt: '' })
                .style({
                  width: sceneWidth + 'px',
                  height: sceneHeight + 'px',
                  transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                }),
          },
          renderNodeShell: ({ node }, canvas) => ({
            className: 'sprite-node',
            outline: false,
            title: {
              className: 'sprite-token',
              content: canvas.span.style({ display: 'contents' }).children(
                canvas.img.class('sprite-art').attrs({
                  src: node.id === 'pip' ? pip : '/questmancer-art/' + node.id + '.png',
                  alt: '',
                }),
                canvas.span.class('sprite-name').children(node.label),
              ),
            },
          }),
        }),
      ),
      h.footer.class('scene-footer').children(h.p.id(instructionsId).children(instructions)),
    ),
});
