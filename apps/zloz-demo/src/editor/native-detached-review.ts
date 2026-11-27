import type { EditorEvent, EditorState } from '@opsydyn/foldkit-zloz';
import { graphSurface } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { Message } from './message';
import { architectureNativePanel } from './native-panel';
import { workbenchThemes } from './theme';

type DetachedReview = Readonly<{
  id: string;
  label: string;
  editor: EditorState;
  scheme: keyof typeof workbenchThemes;
  onEvent: (event: EditorEvent) => Message;
}>;

export const nativeDetachedReview = architectureNativePanel<DetachedReview>(
  'ArchitectureDetachedReview',
  Schema.is(
    Schema.Union([Message.cases.ObservedPacketCanvasInput, Message.cases.ObservedReceiptInput]),
  ),
  (h, { id, label, editor, scheme, onEvent }, request) =>
    graphSurface(h, editor, {
      id,
      label,
      theme: workbenchThemes[scheme],
      background: { type: 'dots' },
      architectureNotation: true,
      wheelNavigation: 'zoom',
      pinchZoom: false,
      onInput: (event) => request(onEvent(event)),
    }),
);
