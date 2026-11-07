import type { Html, HtmlBuilder } from 'foldkit/html';

import type { FlowEdgeEndpointChoice, FlowEdgeReconnectionContext } from './edge-reconnection';
import type { EditorEvent } from './types';

export type FlowEdgeEndpointOptions = Readonly<{
  /** Supply distinct prefixes when rendering multiple controls for the same edge end. */
  idPrefix?: string;
  /** Native options are text. Custom widgets can consume the headless entries directly. */
  optionLabel?: (choice: FlowEdgeEndpointChoice) => string;
}>;

function identity(context: FlowEdgeReconnectionContext, options: FlowEdgeEndpointOptions) {
  return `${options.idPrefix ?? 'flow-endpoint'}-${encodeURIComponent(context.edge.id)}-${context.end}`;
}

function reasons(context: FlowEdgeReconnectionContext) {
  return [
    ...(context.reason ? [context.reason] : []),
    ...(context.emptyReason ? [context.emptyReason] : []),
    ...context.entries
      .filter(({ reason }) => reason !== null && reason !== context.reason)
      .map(({ label, reason }) => `${label}: ${reason}`),
  ];
}

/** Native chooser. Compose with flowEdgeEndpointReasons using the same options. */
export function flowEdgeEndpointSelect<M>(
  h: HtmlBuilder<M>,
  context: FlowEdgeReconnectionContext,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
  options: FlowEdgeEndpointOptions = {},
): Html {
  const id = identity(context, options);
  return h.select(
    [
      ...attributes,
      h.Key(id),
      h.Id(`${id}-select`),
      h.AriaLabel(context.label),
      h.Disabled(context.reason !== null),
      ...(reasons(context).length ? [h.AriaDescribedBy(`${id}-reasons`)] : []),
      h.OnChange((value) =>
        onEvent(
          context.entries.find((choice) => choice.value === value)?.event ?? {
            type: 'EdgeReconnected',
            id: context.edge.id,
            end: context.end,
            endpoint: context.edge[context.end],
          },
        ),
      ),
    ],
    context.entries.map((choice) =>
      h.option(
        [
          h.Key(choice.value),
          h.Value(choice.value),
          h.Selected(choice.current),
          h.Disabled(choice.reason !== null),
        ],
        [
          options.optionLabel?.(choice) ??
            `${choice.label}${choice.hidden ? ' (hidden)' : ''}${choice.reason ? ' — unavailable' : ''}`,
        ],
      ),
    ),
  );
}

/** Protection explanations remain visible independently of optional diagnostics. */
export function flowEdgeEndpointReasons<M>(
  h: HtmlBuilder<M>,
  context: FlowEdgeReconnectionContext,
  attributes: Parameters<HtmlBuilder<M>['div']>[0] = [],
  options: FlowEdgeEndpointOptions = {},
): Html {
  const messages = reasons(context);
  return h.div(
    [...attributes, h.Id(`${identity(context, options)}-reasons`)],
    messages.map((reason) => h.p([], [reason])),
  );
}

/** Unstyled labeled chooser with visible protection reasons. */
export function flowEdgeEndpointField<M>(
  h: HtmlBuilder<M>,
  context: FlowEdgeReconnectionContext,
  onEvent: (event: EditorEvent) => M,
  options: FlowEdgeEndpointOptions = {},
): Html {
  return h.div(
    [h.Key(identity(context, options))],
    [
      h.label([h.For(`${identity(context, options)}-select`)], [context.label]),
      flowEdgeEndpointSelect(h, context, onEvent, [], options),
      flowEdgeEndpointReasons(h, context, [], options),
    ],
  );
}
