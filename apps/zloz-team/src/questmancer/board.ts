import type { Html } from '@effect/ui/html';
import type { EditorState, ZlozGraph } from '@opsydyn/foldkit-zloz';
import { graphSurface, zlozDarkTheme, type BrowserInput } from '@opsydyn/foldkit-zloz/effect-ui';

import { sceneHeight, sceneWidth } from './board-state';

type BoardOptions<Message> = Readonly<{
  id: string;
  title: string;
  backdrop: string | null;
  artFor: (id: string) => string;
  descriptionId: string;
  onInput: (event: BrowserInput) => Message;
  canMoveNode?: (node: ZlozGraph['nodes'][number]) => string | null;
}>;

export function boardView<Message>(
  h: Html.H<Message>,
  editor: EditorState,
  options: BoardOptions<Message>,
) {
  return h.div.class('scene-board').children(
    graphSurface(h, editor, {
      id: options.id,
      label: options.title + ' tabletop',
      descriptionId: options.descriptionId,
      theme: zlozDarkTheme,
      pinchZoom: true,
      wheelNavigation: 'zoom',
      onInput: options.onInput,
      policy: { canMoveNode: options.canMoveNode },
      background: {
        type: 'custom',
        render: ({ viewport }, canvas) => {
          const style = {
            width: sceneWidth + 'px',
            height: sceneHeight + 'px',
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          };
          return options.backdrop === null
            ? canvas.div.class('scene-art', 'plain-backdrop').style(style).children()
            : canvas.img.class('scene-art').attrs({ src: options.backdrop, alt: '' }).style(style);
        },
      },
      renderNodeShell: ({ node }, canvas) => ({
        className: 'sprite-node',
        outline: false,
        title: {
          className: 'sprite-token',
          content: canvas.span
            .style({ display: 'contents' })
            .children(
              canvas.img.class('sprite-art').attrs({ src: options.artFor(node.id), alt: '' }),
              canvas.span.class('sprite-name').children(node.label),
            ),
        },
      }),
    }),
  );
}
