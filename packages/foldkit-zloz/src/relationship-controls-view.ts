import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  ZlozEventStormingRelationshipControlsContext,
  ZlozEventStormingRelationshipInference,
  ZlozEventStormingRelationshipRequest,
} from './relationship-controls';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];
export type ZlozRelationshipTextOptions = Readonly<{ label?: string }>;
export type ZlozEventStormingRelationshipControlsParts = Readonly<{
  select: Html | null;
  inference: Html | null;
  status: Html | null;
  reasons: Html | null;
}>;
export type ZlozEventStormingRelationshipControlsViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  statusLabel?: string;
  reasonsLabel?: string;
  /** Undefined keeps defaults; null omits a part. Use native helpers inside custom wrappers to retain semantics. */
  renderSelect?: (
    context: ZlozEventStormingRelationshipControlsContext,
    h: HtmlBuilder<M>,
    onRequest: (request: ZlozEventStormingRelationshipRequest) => M,
  ) => Html | null | undefined;
  renderInference?: (
    action: ZlozEventStormingRelationshipInference,
    h: HtmlBuilder<M>,
    onRequest: (request: ZlozEventStormingRelationshipRequest) => M,
  ) => Html | null | undefined;
  renderStatus?: (
    context: ZlozEventStormingRelationshipControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderReasons?: (
    context: ZlozEventStormingRelationshipControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozEventStormingRelationshipControlsParts,
    context: ZlozEventStormingRelationshipControlsContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
/** Controlled native select: it dispatches identity only, never a saved descriptor or policy decision. */
export function zlozEventStormingRelationshipSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozEventStormingRelationshipControlsContext,
  onRequest: (request: ZlozEventStormingRelationshipRequest) => M,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
): Html {
  const edge = context.edge;
  return h.select(
    [
      ...attributes,
      h.AriaLabel(context.label),
      h.Value(context.value ?? ''),
      h.Disabled(context.reason !== null),
      ...(context.reason ? [h.AriaDescription(context.reason), h.Title(context.reason)] : []),
      ...(edge
        ? [
            h.OnChange((key) =>
              onRequest({ type: 'RelationshipSelected', edgeId: edge.id, key: key || null }),
            ),
          ]
        : []),
    ],
    context.choices.map((choice) =>
      h.option(
        [
          h.Key(choice.key ?? 'untyped'),
          h.Value(choice.key ?? ''),
          h.Selected(choice.key === context.value),
          h.Disabled(choice.reason !== null),
          ...(choice.reason ? [h.Title(choice.reason)] : []),
        ],
        [choice.label],
      ),
    ),
  );
}
/** Native explicit inference action; unavailable inference remains named and explained. */
export function zlozEventStormingRelationshipInference<M>(
  h: HtmlBuilder<M>,
  action: ZlozEventStormingRelationshipInference,
  onRequest: (request: ZlozEventStormingRelationshipRequest) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Children<M> = [action.label],
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.AriaLabel(action.label),
      h.Disabled(action.reason !== null || action.request === null),
      ...(action.reason ? [h.AriaDescription(action.reason), h.Title(action.reason)] : []),
      ...(action.request ? [h.OnClick(onRequest(action.request))] : []),
    ],
    children,
  );
}
export function zlozEventStormingRelationshipStatus<M>(
  h: HtmlBuilder<M>,
  context: ZlozEventStormingRelationshipControlsContext,
  attributes: Attributes<M> = [],
  children: Children<M> = [context.statusText],
  options: ZlozRelationshipTextOptions = {},
): Html {
  return h.p(
    [
      ...attributes,
      h.Role('status'),
      h.AriaLive('polite'),
      h.AriaLabel(options.label?.trim() || 'Causal relationship status'),
    ],
    children,
  );
}
/** Visible compatibility and availability information; diagnostics never imply enforcement. */
export function zlozEventStormingRelationshipReasons<M>(
  h: HtmlBuilder<M>,
  context: ZlozEventStormingRelationshipControlsContext,
  attributes: Attributes<M> = [],
  options: ZlozRelationshipTextOptions = {},
): Html | null {
  const reasons = context.choices.map((choice) =>
    h.li(
      [h.Key(choice.key ?? 'untyped')],
      [`${choice.label}: ${choice.reason ?? choice.compatibilityReason ?? 'compatible'}`],
    ),
  );
  return context.reason === null && context.inference.reason === null && !reasons.length
    ? null
    : h.div(
        [
          ...attributes,
          h.Role('group'),
          h.AriaLabel(options.label?.trim() || 'Relationship compatibility'),
        ],
        [
          ...[
            ...new Set(
              [context.reason, context.inference.reason].filter(
                (reason): reason is string => reason !== null,
              ),
            ),
          ].map((reason) => h.p([], [reason])),
          ...(reasons.length ? [h.ul([], reasons)] : []),
        ],
      );
}
/** Optional unstyled composition; state, editor updates and callback lifetime stay with the host. */
export function zlozEventStormingRelationshipControls<M>(
  h: HtmlBuilder<M>,
  context: ZlozEventStormingRelationshipControlsContext,
  onRequest: (request: ZlozEventStormingRelationshipRequest) => M,
  options: ZlozEventStormingRelationshipControlsViewOptions<M> = {},
): Html {
  const select = options.renderSelect?.(context, h, onRequest);
  const inference = options.renderInference?.(context.inference, h, onRequest);
  const status = options.renderStatus?.(context, h);
  const reasons = options.renderReasons?.(context, h);
  const parts: ZlozEventStormingRelationshipControlsParts = {
    select:
      select === undefined
        ? h.label([], [context.label, zlozEventStormingRelationshipSelect(h, context, onRequest)])
        : select,
    inference:
      inference === undefined
        ? zlozEventStormingRelationshipInference(h, context.inference, onRequest)
        : inference,
    status:
      status === undefined
        ? zlozEventStormingRelationshipStatus(h, context, [], [context.statusText], {
            label: options.statusLabel ?? 'Causal relationship status',
          })
        : status,
    reasons:
      reasons === undefined
        ? zlozEventStormingRelationshipReasons(h, context, [], {
            label: options.reasonsLabel ?? 'Relationship compatibility',
          })
        : reasons,
  };
  return h.div(
    [
      ...(options.attributes ?? []),
      h.Role('group'),
      h.AriaLabel(options.label?.trim() || 'Causal relationship controls'),
    ],
    options.renderLayout
      ? options.renderLayout(parts, context, h)
      : [parts.select, parts.inference, parts.status, parts.reasons].filter(
          (part): part is Html => part !== null,
        ),
  );
}
