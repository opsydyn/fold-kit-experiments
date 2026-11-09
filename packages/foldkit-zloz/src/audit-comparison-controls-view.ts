import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  ZlozAuditComparisonControlsContext,
  ZlozAuditComparisonRequest,
  ZlozAuditEditionControl,
  ZlozAuditFindingEntry,
  ZlozAuditFindingFilter,
  ZlozAuditFindingKind,
} from './audit-comparison-controls';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];
type OnRequest<M> = (request: ZlozAuditComparisonRequest) => M;
export type ZlozAuditComparisonParts = Readonly<{
  baseline: Html | null;
  target: Html | null;
  filters: readonly Html[];
  entries: readonly Html[];
  status: Html | null;
  reason: Html | null;
}>;
export type ZlozAuditComparisonViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  listLabel?: string;
  statusLabel?: string;
  reasonLabel?: string;
  /** Hides numeric counts in the default filters and status, without changing preferences or findings. */
  showCounts?: boolean;
  filters?: readonly ZlozAuditFindingKind[];
  /** Undefined keeps the native default; null omits the part. Custom entries own their list-item semantics. */
  renderBaseline?: (
    control: ZlozAuditEditionControl,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderTarget?: (
    control: ZlozAuditEditionControl,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderFilter?: (
    control: ZlozAuditFindingFilter,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderEntry?: (
    entry: ZlozAuditFindingEntry,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderStatus?: (
    context: ZlozAuditComparisonControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderReason?: (
    context: ZlozAuditComparisonControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozAuditComparisonParts,
    context: ZlozAuditComparisonControlsContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
export function zlozAuditEditionSelect<M>(
  h: HtmlBuilder<M>,
  control: ZlozAuditEditionControl,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
): Html {
  const missing =
    control.value !== null && !control.choices.some((choice) => choice.id === control.value);
  return h.select(
    [
      ...attributes,
      h.AriaLabel(control.label),
      h.Value(control.value ?? ''),
      h.Disabled(control.reason !== null),
      ...(control.reason ? [h.AriaDescription(control.reason), h.Title(control.reason)] : []),
      h.OnChange((editionId) =>
        onRequest({
          type: control.part === 'baseline' ? 'BaselineSelected' : 'TargetSelected',
          editionId: editionId || null,
        }),
      ),
    ],
    [
      h.option([h.Value(''), h.Selected(control.value === null)], [control.noneLabel]),
      ...(missing
        ? [
            h.option(
              [h.Value(control.value ?? ''), h.Selected(true), h.Disabled(true)],
              [`Unavailable edition: ${control.value}`],
            ),
          ]
        : []),
      ...control.choices.map((choice) =>
        h.option(
          [h.Key(choice.id), h.Value(choice.id), h.Selected(control.value === choice.id)],
          [choice.label],
        ),
      ),
    ],
  );
}
export function zlozAuditFindingFilter<M>(
  h: HtmlBuilder<M>,
  control: ZlozAuditFindingFilter,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['input']>[0] = [],
): Html {
  return h.input([
    ...attributes,
    h.Type('checkbox'),
    h.AriaLabel(control.label),
    h.Checked(control.checked),
    h.OnClick(onRequest({ type: 'FilterToggled', kind: control.kind })),
  ]);
}
/** Explicit navigation only; no DOM focus, graph mutation or history restoration is implied. */
export function zlozAuditFindingButton<M>(
  h: HtmlBuilder<M>,
  entry: ZlozAuditFindingEntry,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Children<M> = [`${entry.kind}: ${entry.label}`],
  label?: string,
): Html {
  const source = entry.source.kind === 'current' ? 'current graph' : entry.source.name;
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.AriaLabel(label?.trim() || `View ${entry.kind} finding: ${entry.label} in ${source}`),
      h.Disabled(entry.reason !== null),
      ...(entry.reason ? [h.AriaDescription(entry.reason), h.Title(entry.reason)] : []),
      h.OnClick(onRequest(entry.request)),
    ],
    children,
  );
}
export function zlozAuditComparisonStatus<M>(
  h: HtmlBuilder<M>,
  context: ZlozAuditComparisonControlsContext,
  attributes: Attributes<M> = [],
  children: Children<M> = [context.statusText],
  label = 'Audit comparison status',
): Html {
  return h.p([...attributes, h.Role('status'), h.AriaLive('polite'), h.AriaLabel(label)], children);
}
export function zlozAuditComparisonReason<M>(
  h: HtmlBuilder<M>,
  context: ZlozAuditComparisonControlsContext,
  attributes: Attributes<M> = [],
  children?: Children<M>,
  label = 'Audit comparison availability',
): Html | null {
  return context.reason === null
    ? null
    : h.p([...attributes, h.AriaLabel(label)], children ?? [context.reason]);
}
/** Unstyled optional composition. The host owns state, policies, camera and diagnostics preferences. */
export function zlozAuditComparisonControls<M>(
  h: HtmlBuilder<M>,
  context: ZlozAuditComparisonControlsContext,
  onRequest: OnRequest<M>,
  options: ZlozAuditComparisonViewOptions<M> = {},
): Html {
  function selector(
    control: ZlozAuditEditionControl,
    render: ZlozAuditComparisonViewOptions<M>['renderBaseline'],
  ): Html | null {
    const custom = render?.(control, h, onRequest);
    return custom === undefined
      ? h.label([], [control.label, zlozAuditEditionSelect(h, control, onRequest)])
      : custom;
  }
  function filter(kind: ZlozAuditFindingKind): readonly Html[] {
    const control = context.filters[kind],
      custom = options.renderFilter?.(control, h, onRequest);
    const result =
      custom === undefined
        ? h.label(
            [h.Key(kind)],
            [
              zlozAuditFindingFilter(h, control, onRequest),
              options.showCounts === false ? control.label : `${control.label} (${control.count})`,
            ],
          )
        : custom;
    return result === null ? [] : [result];
  }
  function entry(item: ZlozAuditFindingEntry): readonly Html[] {
    const custom = options.renderEntry?.(item, h, onRequest);
    const result =
      custom === undefined
        ? h.li(
            [h.Key(`${item.kind}:${item.finding.edgeId}:${item.finding.code}`)],
            [
              zlozAuditFindingButton(h, item, onRequest),
              h.p([], [item.finding.message]),
              ...(item.reason ? [h.p([], [item.reason])] : []),
            ],
          )
        : custom;
    return result === null ? [] : [result];
  }
  const status = options.renderStatus?.(context, h),
    reason = options.renderReason?.(context, h);
  const statusText =
    options.showCounts === false && context.comparison && context.entries.length > 0
      ? context.comparison.status === 'regressed'
        ? 'New causal findings introduced.'
        : 'No new findings; existing findings may persist.'
      : context.statusText;
  const parts: ZlozAuditComparisonParts = {
    baseline: selector(context.baseline, options.renderBaseline),
    target: selector(context.target, options.renderTarget),
    filters: [
      ...new Set(options.filters ?? (['introduced', 'resolved', 'persisting'] as const)),
    ].flatMap(filter),
    entries: context.entries.flatMap(entry),
    status:
      status === undefined
        ? zlozAuditComparisonStatus(h, context, [], [statusText], options.statusLabel)
        : status,
    reason:
      reason === undefined
        ? zlozAuditComparisonReason(h, context, [], undefined, options.reasonLabel)
        : reason,
  };
  return h.div(
    [
      ...(options.attributes ?? []),
      h.Role('group'),
      h.AriaLabel(options.label?.trim() || 'Causal audit comparison'),
    ],
    options.renderLayout
      ? options.renderLayout(parts, context, h)
      : [
          ...(parts.baseline ? [parts.baseline] : []),
          ...(parts.target ? [parts.target] : []),
          ...parts.filters,
          ...(parts.status ? [parts.status] : []),
          h.ul([h.AriaLabel(options.listLabel?.trim() || 'Causal audit findings')], parts.entries),
          ...(parts.reason ? [parts.reason] : []),
        ],
  );
}
