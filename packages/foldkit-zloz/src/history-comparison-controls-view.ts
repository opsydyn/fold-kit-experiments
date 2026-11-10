import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  ZlozHistoryBaselineControl,
  ZlozHistoryGhostControl,
  ZlozHistoryGhostPart,
  ZlozHistoryComparisonRequest,
  ZlozHistoryComparisonControlsContext,
} from './history-comparison-controls';

type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];
export type ZlozHistoryComparisonTextOptions = Readonly<{ label?: string }>;
export type ZlozHistoryComparisonControlsParts = Readonly<{
  baseline: Html | null;
  ghosts: readonly Html[];
  status: Html | null;
  reason: Html | null;
}>;
export type ZlozHistoryComparisonControlsViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  statusLabel?: string;
  reasonLabel?: string;
  ghosts?: readonly ZlozHistoryGhostPart[];
  renderBaseline?: (
    control: ZlozHistoryBaselineControl,
    h: HtmlBuilder<M>,
    onRequest: (request: ZlozHistoryComparisonRequest) => M,
  ) => Html | null | undefined;
  renderGhost?: (
    control: ZlozHistoryGhostControl,
    h: HtmlBuilder<M>,
    onRequest: (request: ZlozHistoryComparisonRequest) => M,
  ) => Html | null | undefined;
  renderStatus?: (
    context: ZlozHistoryComparisonControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderReason?: (
    context: ZlozHistoryComparisonControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozHistoryComparisonControlsParts,
    context: ZlozHistoryComparisonControlsContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
/** Native select with model-derived identity, availability and a visible default label in the composition. */
export function zlozHistoryBaselineSelect<M>(
  h: HtmlBuilder<M>,
  control: ZlozHistoryBaselineControl,
  onRequest: (request: ZlozHistoryComparisonRequest) => M,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
): Html {
  return h.select(
    [
      ...attributes,
      h.AriaLabel(control.label),
      h.Value(control.value ?? ''),
      h.Disabled(control.reason !== null),
      ...(control.reason ? [h.AriaDescription(control.reason), h.Title(control.reason)] : []),
      h.OnChange((editionId) =>
        onRequest({ type: 'BaselineSelected', editionId: editionId || null }),
      ),
    ],
    [
      h.option([h.Value('')], [control.noneLabel]),
      ...control.choices.map((choice) =>
        h.option([h.Key(choice.editionId), h.Value(choice.editionId)], [choice.label]),
      ),
    ],
  );
}
/** Native checkbox emits a toggle fact; resolve it against fresh state rather than a captured value. */
export function zlozHistoryGhostToggle<M>(
  h: HtmlBuilder<M>,
  control: ZlozHistoryGhostControl,
  onRequest: (request: ZlozHistoryComparisonRequest) => M,
  attributes: Parameters<HtmlBuilder<M>['input']>[0] = [],
): Html {
  return h.input([
    h.Key(control.part),
    ...attributes,
    h.Type('checkbox'),
    h.AriaLabel(control.label),
    h.Checked(control.checked),
    h.Disabled(control.reason !== null),
    ...(control.reason ? [h.AriaDescription(control.reason), h.Title(control.reason)] : []),
    h.OnClick(onRequest(control.request)),
  ]);
}
/** Polite comparison status; custom content and names support host language and presentation. */
export function zlozHistoryComparisonStatus<M>(
  h: HtmlBuilder<M>,
  context: ZlozHistoryComparisonControlsContext,
  attributes: Attributes<M> = [],
  children: Children<M> = [context.statusText],
  options: ZlozHistoryComparisonTextOptions = {},
): Html {
  return h.p(
    [
      ...attributes,
      h.Role('status'),
      h.AriaLive('polite'),
      h.AriaLabel(options.label?.trim() || 'History comparison status'),
    ],
    children,
  );
}
/** Visible deduplicated availability reasons; absent when no reason applies. */
export function zlozHistoryComparisonReason<M>(
  h: HtmlBuilder<M>,
  context: ZlozHistoryComparisonControlsContext,
  attributes: Attributes<M> = [],
  children?: Children<M>,
  options: ZlozHistoryComparisonTextOptions = {},
): Html | null {
  return context.reasons.length
    ? h.p(
        [...attributes, h.AriaLabel(options.label?.trim() || 'History comparison availability')],
        children ?? [context.reasons.join(' ')],
      )
    : null;
}
/** Unstyled optional composition. Undefined keeps defaults, null omits parts; no owned state or lifecycle. */
export function zlozHistoryComparisonControls<M>(
  h: HtmlBuilder<M>,
  context: ZlozHistoryComparisonControlsContext,
  onRequest: (request: ZlozHistoryComparisonRequest) => M,
  options: ZlozHistoryComparisonControlsViewOptions<M> = {},
): Html {
  const customBaseline = options.renderBaseline?.(context.baseline, h, onRequest);
  const status = options.renderStatus?.(context, h);
  const reason = options.renderReason?.(context, h);
  function renderGhost(part: ZlozHistoryGhostPart): readonly Html[] {
    const control = context.ghosts[part];
    const custom = options.renderGhost?.(control, h, onRequest);
    const rendered =
      custom === undefined
        ? h.label([h.Key(part)], [zlozHistoryGhostToggle(h, control, onRequest), control.label])
        : custom;
    return rendered === null ? [] : [rendered];
  }
  const parts: ZlozHistoryComparisonControlsParts = {
    baseline:
      customBaseline === undefined
        ? h.label(
            [],
            [context.baseline.label, zlozHistoryBaselineSelect(h, context.baseline, onRequest)],
          )
        : customBaseline,
    ghosts: [
      ...new Set(options.ghosts ?? (['enabled', 'nodes', 'edges', 'movements'] as const)),
    ].flatMap(renderGhost),
    status:
      status === undefined
        ? zlozHistoryComparisonStatus(h, context, [], [context.statusText], {
            label: options.statusLabel ?? 'History comparison status',
          })
        : status,
    reason:
      reason === undefined
        ? zlozHistoryComparisonReason(h, context, [], undefined, {
            label: options.reasonLabel ?? 'History comparison availability',
          })
        : reason,
  };
  return h.div(
    [
      ...(options.attributes ?? []),
      h.Role('group'),
      h.AriaLabel(options.label?.trim() || 'History comparison controls'),
    ],
    options.renderLayout
      ? options.renderLayout(parts, context, h)
      : [
          ...(parts.baseline ? [parts.baseline] : []),
          ...parts.ghosts,
          ...(parts.status ? [parts.status] : []),
          ...(parts.reason ? [parts.reason] : []),
        ],
  );
}
