import { Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  ZlozConnectionCreationChoice,
  ZlozConnectionCreationContext,
  ZlozConnectionCreationFieldContext,
} from './connection-creation';
import {
  resolveEndpointChoices,
  type ZlozEndpointSearchOptions,
  type ZlozEndpointChoiceGroup,
} from './endpoint-search';
import { endpointChoiceOptions } from './endpoint-search-view';
import type { EditorEvent } from './types';

export type ZlozConnectionCreationViewOptions = ZlozEndpointSearchOptions &
  Readonly<{
    /** Distinct prefixes are required for simultaneous creation widgets. */
    idPrefix?: string;
    /** Native node groups; flat options remain the default. */
    groupByNode?: boolean;
    groupLabel?: (group: ZlozEndpointChoiceGroup<ZlozConnectionCreationChoice>) => string;
    optionLabel?: (choice: ZlozConnectionCreationChoice) => string;
  }>;

const identity = (
  context: ZlozConnectionCreationFieldContext,
  options: ZlozConnectionCreationViewOptions,
) => `${options.idPrefix ?? 'flow-create'}-${context.end}`;
function reasons(
  context: ZlozConnectionCreationFieldContext,
  options: ZlozConnectionCreationViewOptions,
) {
  const choices = resolveEndpointChoices(context.entries, options);
  return [
    ...(context.reason ? [context.reason] : []),
    ...(context.hint ? [context.hint] : []),
    ...(choices.emptyReason ? [choices.emptyReason] : []),
    ...choices.entries
      .filter(
        ({ reason }) => reason !== null && reason !== context.reason && reason !== context.hint,
      )
      .map(({ label, reason }) => `${label}: ${reason}`),
  ];
}

/** Native selection and Escape cancellation; compose with reasons using the same prefix. */
export function zlozConnectionCreationSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozConnectionCreationFieldContext,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
  options: ZlozConnectionCreationViewOptions = {},
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
          context.entries.find((choice) => choice.value === value)?.event ?? context.cancel.event,
        ),
      ),
      h.OnKeyDownPreventDefault((key) =>
        key === 'Escape' && context.cancel.reason === null
          ? Option.some(onEvent(context.cancel.event))
          : Option.none(),
      ),
    ],
    [
      h.option(
        [h.Key('placeholder'), h.Value(''), h.Selected(context.value === '')],
        [context.placeholder],
      ),
      ...endpointChoiceOptions(
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
    ],
  );
}

/** Required policy descriptions and optional-state hints, independent of diagnostics switches. */
export function zlozConnectionCreationReasons<M>(
  h: HtmlBuilder<M>,
  context: ZlozConnectionCreationFieldContext,
  attributes: Parameters<HtmlBuilder<M>['div']>[0] = [],
  options: ZlozConnectionCreationViewOptions = {},
): Html {
  return h.div(
    [...attributes, h.Id(`${identity(context, options)}-reasons`)],
    reasons(context, options).map((reason) => h.p([], [reason])),
  );
}

/** Unstyled field; use select and reasons separately for custom arrangements. */
export function zlozConnectionCreationField<M>(
  h: HtmlBuilder<M>,
  context: ZlozConnectionCreationFieldContext,
  onEvent: (event: EditorEvent) => M,
  options: ZlozConnectionCreationViewOptions = {},
): Html {
  return h.div(
    [h.Key(identity(context, options))],
    [
      h.label([h.For(`${identity(context, options)}-select`)], [context.label]),
      zlozConnectionCreationSelect(h, context, onEvent, [], options),
      zlozConnectionCreationReasons(h, context, [], options),
    ],
  );
}

export function zlozConnectionCreationCancel<M>(
  h: HtmlBuilder<M>,
  context: ZlozConnectionCreationContext,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Parameters<HtmlBuilder<M>['button']>[1] = ['Cancel connection'],
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.Disabled(context.cancel.reason !== null),
      h.OnClick(onEvent(context.cancel.event)),
    ],
    children,
  );
}

/** Default native creation panel; opt in through ZlozViewOptions.connectionCreation or compose it directly. */
export function zlozConnectionCreation<M>(
  h: HtmlBuilder<M>,
  context: ZlozConnectionCreationContext,
  onEvent: (event: EditorEvent) => M,
  options: ZlozConnectionCreationViewOptions = {},
): Html {
  return h.div(
    [h.Role('group'), h.AriaLabel('Create a connection')],
    [
      zlozConnectionCreationField(h, context.source, onEvent, options),
      zlozConnectionCreationField(h, context.target, onEvent, options),
      zlozConnectionCreationCancel(h, context, onEvent),
    ],
  );
}
