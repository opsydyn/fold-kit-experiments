import { contextMenu, type ZlozContextMenuContext } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { Message } from './message';
import { architectureNativePanel } from './native-panel';

type ContextMenu = Readonly<{
  context: ZlozContextMenuContext;
  design: 'standard' | 'panel';
  modelId: string;
  epoch: number;
}>;

export const nativeContextMenu = architectureNativePanel<ContextMenu>(
  'ArchitectureContextMenu',
  Schema.is(Message.cases.ObservedModelInput),
  (h, { context, design, modelId, epoch }, request) =>
    contextMenu(h, context, {
      id: 'workbench-context-menu',
      design,
      onEvent: (message) => request(Message.ObservedModelInput({ modelId, epoch, message })),
    }),
);
