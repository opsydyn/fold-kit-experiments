import { edgeLabelControls, type ZlozEdgeLabelContext } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { Message } from './message';
import { architectureNativePanel } from './native-panel';

type Label = Readonly<{
  context: ZlozEdgeLabelContext;
  draft?: string;
  modelId: string;
  epoch: number;
}>;

const isDraftEdit = Schema.is(
  Schema.Struct({
    type: Schema.Literal('EdgeLabelDraftChanged'),
    id: Schema.String,
    text: Schema.String,
  }),
);

export const nativeEdgeLabel = architectureNativePanel<Label>(
  'ArchitectureEdgeLabel',
  Schema.is(Message.cases.ObservedModelInput),
  (h, { context, draft, modelId, epoch }, request) =>
    edgeLabelControls(
      h,
      context,
      draft,
      (message) => request(Message.ObservedModelInput({ modelId, epoch, message })),
      {
        badgeClass: 'custom-edge-badge',
        editorClass: 'custom-edge-editor',
        icon: '↗',
        saveLabel: 'Apply label',
        cancelLabel: 'Discard',
      },
    ),
  {
    apply: (current, request) =>
      request._tag === 'ObservedModelInput' &&
      isDraftEdit(request.message) &&
      request.modelId === current.modelId &&
      request.epoch === current.epoch &&
      request.message.id === current.context.edge.id &&
      current.draft !== undefined
        ? { ...current, draft: request.message.text }
        : current,
    receive: (current, incoming) =>
      current.modelId === incoming.modelId &&
      current.epoch === incoming.epoch &&
      current.draft !== undefined &&
      incoming.draft !== undefined
        ? { ...incoming, draft: current.draft }
        : incoming,
  },
);
