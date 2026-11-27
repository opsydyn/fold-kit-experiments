import type {
  EdgePathStyle,
  EditorEvent,
  ZlozEdge,
  ZlozConnectionCreationContext,
  ZlozEdgeReconnectionContext,
} from '@opsydyn/foldkit-zloz';
import { endpointField } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { historyAllowsMessage } from './history';
import { Message } from './message';
import type { Model, PortChooserSearchField } from './model';
import { architectureNativePanel } from './native-panel';

type InputScope = Readonly<{
  modelId: string;
  epoch: number;
  queries: Model['portChooserQueries'];
}>;

const accepts = Schema.is(
  Schema.Union([Message.cases.ObservedModelInput, Message.cases.ChangedPortChooserSearch]),
);

// The mounted panel owns the live input while the workbench retains its last query between mounts.
const queryState = {
  apply: <A extends InputScope>(current: A, request: Message): A =>
    request._tag === 'ChangedPortChooserSearch'
      ? { ...current, queries: { ...current.queries, [request.field]: request.query } }
      : current,
  receive: <A extends InputScope>(current: A, incoming: A): A =>
    current.modelId === incoming.modelId && current.epoch === incoming.epoch
      ? { ...incoming, queries: current.queries }
      : incoming,
};

const searchLabels = {
  creationSource: 'Search new connection sources',
  creationTarget: 'Search new connection targets',
  reconnectSource: 'Search reconnection sources',
  reconnectTarget: 'Search reconnection targets',
} satisfies Record<PortChooserSearchField, string>;

function fieldOptions<M>(
  scope: InputScope,
  field: PortChooserSearchField,
  request: (message: Message) => M,
) {
  return {
    id: `workbench-${field}`,
    search: {
      label: searchLabels[field],
      query: scope.queries[field],
      onChange: (query: string) => request(Message.ChangedPortChooserSearch({ field, query })),
    },
    onEvent: (message: EditorEvent) =>
      request(Message.ObservedModelInput({ modelId: scope.modelId, epoch: scope.epoch, message })),
  };
}

export const nativeConnectionCreation = architectureNativePanel<
  InputScope & Readonly<{ context: ZlozConnectionCreationContext }>
>(
  'ArchitectureConnectionCreation',
  accepts,
  (h, { context, ...scope }, request) => {
    const source = fieldOptions(scope, 'creationSource', request);
    const target = fieldOptions(scope, 'creationTarget', request);
    return h.div
      .class('workbench-connection-creation')
      .attr('role', 'group')
      .attr('aria-label', 'Create a connection')
      .children(
        h.div.class('workbench-connection-creation-header').children(
          h.strong.children('New connection'),
          h.button
            .attr('type', 'button')
            .disabled(context.cancel.reason !== null)
            .on('click', source.onEvent(context.cancel.event))
            .children('Cancel choice'),
        ),
        h.div
          .class('workbench-connection-creation-fields')
          .children(
            endpointField(h, context.source, { ...source, heading: '↗ From' }),
            endpointField(h, context.target, { ...target, heading: '↘ To' }),
          ),
      );
  },
  queryState,
);

const edgePathOptions: readonly Readonly<{ label: string; style: EdgePathStyle | null }>[] = [
  { label: 'Automatic', style: null },
  { label: 'Straight', style: 'straight' },
  { label: 'Stepped', style: 'stepped' },
  { label: 'Smooth', style: 'smooth' },
];

export const nativeSelectedConnection = architectureNativePanel<
  InputScope &
    Readonly<{
      fields: readonly ZlozEdgeReconnectionContext[];
      edge: ZlozEdge;
      readOnly: boolean;
      reviewing: boolean;
    }>
>(
  'ArchitectureSelectedConnection',
  accepts,
  (h, { fields, edge, readOnly, reviewing, ...scope }, request) => {
    const observe = (message: EditorEvent) =>
      Message.ObservedModelInput({ modelId: scope.modelId, epoch: scope.epoch, message });
    const appearanceButton = (label: string, data: 'solid' | 'dashed') => {
      const message = observe({ type: 'EdgeDataChanged', id: edge.id, data });
      return h.button
        .attr('type', 'button')
        .style({ padding: '10px 16px', cursor: 'pointer' })
        .disabled(reviewing && !historyAllowsMessage(message))
        .on('click', request(message))
        .children(label);
    };
    return h.div
      .attr('role', 'group')
      .attr('aria-label', 'Selected connection')
      .children(
        fields.length
          ? h.div.children(
              ...fields.map((field) => {
                const source = field.end === 'source';
                return h.div
                  .key(field.end)
                  .class('workbench-endpoint-field')
                  .children(
                    endpointField(h, field, {
                      ...fieldOptions(
                        scope,
                        source ? 'reconnectSource' : 'reconnectTarget',
                        request,
                      ),
                      heading: source ? '↗ Source port' : '↘ Target port',
                    }),
                  );
              }),
            )
          : null,
        h.label.children(
          'Edge path',
          h.select
            .attr('aria-label', 'Edge path')
            .disabled(readOnly)
            .on('change', ({ value }) => {
              const option = edgePathOptions.find(({ style }) => (style ?? 'auto') === value);
              if (option)
                return request(
                  observe({ type: 'EdgePathStyleChanged', id: edge.id, pathStyle: option.style }),
                );
            })
            .children(
              ...edgePathOptions.map(({ label, style }) =>
                h.option
                  .key(style ?? 'auto')
                  .attr('value', style ?? 'auto')
                  .selected((edge.pathStyle ?? null) === style)
                  .children(label),
              ),
            ),
        ),
        appearanceButton('Solid edge', 'solid'),
        appearanceButton('Dashed edge', 'dashed'),
      );
  },
  queryState,
);
