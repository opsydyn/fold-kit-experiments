import { Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  FlowConnectionCreationChoice,
  FlowConnectionCreationContext,
  FlowConnectionCreationFieldContext,
} from './connection-creation';
import type { EditorEvent } from './types';

export type FlowConnectionCreationViewOptions = Readonly<{
  /** Distinct prefixes are required for simultaneous creation widgets. */
  idPrefix?: string;
  optionLabel?: (choice: FlowConnectionCreationChoice) => string;
}>;

const identity = (
  context: FlowConnectionCreationFieldContext,
  options: FlowConnectionCreationViewOptions,
) => `${options.idPrefix ?? 'flow-create'}-${context.end}`;
function reasons(context: FlowConnectionCreationFieldContext) {
  return [
    ...(context.reason ? [context.reason] : []),
    ...(context.hint ? [context.hint] : []),
    ...context.entries
      .filter(
        ({ reason }) => reason !== null && reason !== context.reason && reason !== context.hint,
      )
      .map(({ label, reason }) => `${label}: ${reason}`),
  ];
}

/** Native selection and Escape cancellation; compose with reasons using the same prefix. */
export function flowConnectionCreationSelect<M>(
  h: HtmlBuilder<M>,
  context: FlowConnectionCreationFieldContext,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
  options: FlowConnectionCreationViewOptions = {},
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
      ...context.entries.map((choice) =>
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
    ],
  );
}

/** Required policy descriptions and optional-state hints, independent of diagnostics switches. */
export function flowConnectionCreationReasons<M>(
  h: HtmlBuilder<M>,
  context: FlowConnectionCreationFieldContext,
  attributes: Parameters<HtmlBuilder<M>['div']>[0] = [],
  options: FlowConnectionCreationViewOptions = {},
): Html {
  return h.div(
    [...attributes, h.Id(`${identity(context, options)}-reasons`)],
    reasons(context).map((reason) => h.p([], [reason])),
  );
}

/** Unstyled field; use select and reasons separately for custom arrangements. */
export function flowConnectionCreationField<M>(
  h: HtmlBuilder<M>,
  context: FlowConnectionCreationFieldContext,
  onEvent: (event: EditorEvent) => M,
  options: FlowConnectionCreationViewOptions = {},
): Html {
  return h.div(
    [h.Key(identity(context, options))],
    [
      h.label([h.For(`${identity(context, options)}-select`)], [context.label]),
      flowConnectionCreationSelect(h, context, onEvent, [], options),
      flowConnectionCreationReasons(h, context, [], options),
    ],
  );
}

export function flowConnectionCreationCancel<M>(
  h: HtmlBuilder<M>,
  context: FlowConnectionCreationContext,
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

/** Default native creation panel; opt in through FlowViewOptions.connectionCreation or compose it directly. */
export function flowConnectionCreation<M>(
  h: HtmlBuilder<M>,
  context: FlowConnectionCreationContext,
  onEvent: (event: EditorEvent) => M,
  options: FlowConnectionCreationViewOptions = {},
): Html {
  return h.div(
    [h.Role('group'), h.AriaLabel('Create a connection')],
    [
      flowConnectionCreationField(h, context.source, onEvent, options),
      flowConnectionCreationField(h, context.target, onEvent, options),
      flowConnectionCreationCancel(h, context, onEvent),
    ],
  );
}
