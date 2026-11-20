import {
  createEditor,
  updateEditor,
  type EditorEvent,
  type EditorState,
  type Size,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';
import {
  zlozDarkTheme,
  zlozDragHandle,
  zlozNodeFrame,
  zlozView,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import type { Scene } from './contracts';

const width = 1536;
const height = 864;

export function graphFor(scene: Scene): ZlozGraph {
  return {
    nodes: scene.tokens.map((token) => ({
      id: token.id,
      label: token.label,
      position: { x: token.x, y: token.y },
      size: { width: 94, height: 117 },
      ports: [],
    })),
    edges: [],
  };
}

export const boardEditor = (scene: Scene, readOnly = false) =>
  createEditor(graphFor(scene), {
    readOnly,
    snapToGrid: false,
    zoomLimits: { minZoom: 0.1, maxZoom: 3 },
    viewport: { x: 0, y: 0, zoom: 0.5 },
  });

export function fit(editor: EditorState, surface: Size | null): EditorState {
  if (!surface || surface.width <= 0 || surface.height <= 0) return editor;
  const zoom = Math.max(0.1, Math.min(surface.width / width, surface.height / height));
  return updateEditor(editor, {
    type: 'ViewportChanged',
    viewport: {
      x: (surface.width - width * zoom) / 2,
      y: (surface.height - height * zoom) / 2,
      zoom,
    },
  });
}

type BoardOptions<Message> = Readonly<{
  id: string;
  title: string;
  backdrop: string | null;
  artFor: (id: string) => string;
  instructions: string;
  onEvent: (event: EditorEvent) => Message;
  canMoveNode?: (node: ZlozGraph['nodes'][number]) => string | null;
}>;

export function boardView<Message>(
  h: HtmlBuilder<Message>,
  editor: EditorState,
  options: BoardOptions<Message>,
) {
  return h.div(
    [h.Class('scene-board')],
    [
      zlozView(h, editor, {
        id: options.id,
        label: options.title + ' tabletop',
        height: 'fill',
        theme: zlozDarkTheme,
        diagnostics: false,
        pinchZoom: true,
        onEvent: options.onEvent,
        canMoveNode: options.canMoveNode,
        renderCanvasHelp: (_context, builder) => builder.span([], [options.instructions]),
        background: {
          type: 'custom',
          render: ({ viewport }, builder) => {
            const style = builder.Style({
              width: width + 'px',
              height: height + 'px',
              transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})`,
            });
            return options.backdrop === null
              ? builder.div(
                  [builder.Class('scene-art plain-backdrop'), style, builder.AriaHidden(true)],
                  [],
                )
              : builder.img([
                  builder.Class('scene-art'),
                  builder.Src(options.backdrop),
                  builder.Alt(''),
                  style,
                ]);
          },
        },
        renderNodeShell: (context, builder) =>
          zlozNodeFrame(
            builder,
            context,
            [builder.Class('sprite-node')],
            [
              zlozDragHandle(
                builder,
                context,
                [builder.Class('sprite-token')],
                [
                  builder.img([
                    builder.Src(options.artFor(context.node.id)),
                    builder.Alt(''),
                    builder.Class('sprite-art'),
                  ]),
                  builder.span([builder.Class('sprite-name')], [context.node.label]),
                ],
              ),
            ],
          ),
        renderLayout: ({ canvas, help }, builder) =>
          builder.div([builder.Class('board-layout')], [canvas, help]),
      }),
    ],
  );
}
