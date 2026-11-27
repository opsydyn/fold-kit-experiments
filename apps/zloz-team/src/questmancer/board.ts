import type { EditorEvent, EditorState, ZlozGraph } from '@opsydyn/foldkit-zloz';
import {
  zlozDarkTheme,
  zlozDragHandle,
  zlozNodeFrame,
  zlozView,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import { sceneHeight, sceneWidth } from './board-state';

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
              width: sceneWidth + 'px',
              height: sceneHeight + 'px',
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
