import { edgeToolbarContent, type ZlozEdgeToolbarContext } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { Message } from './message';
import type { EdgeToolbarDesign } from './model';
import { architectureNativePanel } from './native-panel';

type Toolbar = Readonly<{
  context: ZlozEdgeToolbarContext;
  design: EdgeToolbarDesign;
  modelId: string;
  epoch: number;
}>;

export const nativeEdgeToolbar = architectureNativePanel<Toolbar>(
  'ArchitectureEdgeToolbar',
  Schema.is(Message.cases.ObservedModelInput),
  (h, { context, design, modelId, epoch }, request) =>
    edgeToolbarContent(h, context, {
      design,
      onEvent: (message) => request(Message.ObservedModelInput({ modelId, epoch, message })),
    }),
);
