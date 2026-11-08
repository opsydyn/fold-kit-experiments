import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozEdgeEndpointChoice, ZlozEdgeReconnectionContext } from './edge-reconnection';
import {
  resolveEndpointChoices,
  type ZlozEndpointSearchOptions,
  type ZlozEndpointChoiceGroup,
} from './endpoint-search';
import { endpointChoiceOptions } from './endpoint-search-view';
import type { EditorEvent } from './types';

export type ZlozEdgeEndpointOptions = ZlozEndpointSearchOptions &
  Readonly<{
    /** Supply distinct prefixes when rendering multiple controls for the same edge end. */
    idPrefix?: string;
    /** Native node groups; flat options remain the default. */
    groupByNode?: boolean;
    groupLabel?: (group: ZlozEndpointChoiceGroup<ZlozEdgeEndpointChoice>) => string;
    /** Native options are text. Custom widgets can consume the headless entries directly. */
    optionLabel?: (choice: ZlozEdgeEndpointChoice) => string;
  }>;

function identity(context: ZlozEdgeReconnectionContext, options: ZlozEdgeEndpointOptions) {
  return `${options.idPrefix ?? 'flow-endpoint'}-${encodeURIComponent(context.edge.id)}-${context.end}`;
}

function reasons(context: ZlozEdgeReconnectionContext, options: ZlozEdgeEndpointOptions) {
  const choices = resolveEndpointChoices(context.entries, options);
  return [
    ...(context.reason ? [context.reason] : []),
    ...(context.emptyReason ? [context.emptyReason] : []),
    ...(choices.emptyReason ? [choices.emptyReason] : []),
    ...choices.entries
      .filter(({ reason }) => reason !== null && reason !== context.reason)
      .map(({ label, reason }) => `${label}: ${reason}`),
  ];
}

/** Native chooser. Compose with zlozEdgeEndpointReasons using the same options. */
export function zlozEdgeEndpointSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozEdgeReconnectionContext,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
  options: ZlozEdgeEndpointOptions = {},
): Html {
  const id = identity(context, options);
  const choices = resolveEndpointChoices(context.entries, options);
  return h.select(
    [
      ...attributes,
      h.Key(id),
      h.Id(`${id}-select`),
      h.AriaLabel(context.label),
      h.Disabled(context.reason !== null),
      ...(reasons(context, options).length ? [h.AriaDescribedBy(`${id}-reasons`)] : []),
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
    endpointChoiceOptions(
      h,
      choices,
      options.groupByNode,
      (choice) =>
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
      options.groupLabel,
    ),
  );
}

/** Protection explanations remain visible independently of optional diagnostics. */
export function zlozEdgeEndpointReasons<M>(
  h: HtmlBuilder<M>,
  context: ZlozEdgeReconnectionContext,
  attributes: Parameters<HtmlBuilder<M>['div']>[0] = [],
  options: ZlozEdgeEndpointOptions = {},
): Html {
  const messages = reasons(context, options);
  return h.div(
    [...attributes, h.Id(`${identity(context, options)}-reasons`)],
    messages.map((reason) => h.p([], [reason])),
  );
}

/** Unstyled labeled chooser with visible protection reasons. */
export function zlozEdgeEndpointField<M>(
  h: HtmlBuilder<M>,
  context: ZlozEdgeReconnectionContext,
  onEvent: (event: EditorEvent) => M,
  options: ZlozEdgeEndpointOptions = {},
): Html {
  return h.div(
    [h.Key(identity(context, options))],
    [
      h.label([h.For(`${identity(context, options)}-select`)], [context.label]),
      zlozEdgeEndpointSelect(h, context, onEvent, [], options),
      zlozEdgeEndpointReasons(h, context, [], options),
    ],
  );
}
