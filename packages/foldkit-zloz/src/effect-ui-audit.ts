import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type {
  ZlozAuditComparisonControlsContext,
  ZlozAuditComparisonRequest,
  ZlozAuditEditionControl,
  ZlozAuditFindingEntry,
  ZlozAuditFindingFilter,
  ZlozAuditFindingKind,
} from './audit-comparison-controls';
import type {
  ZlozDddAuditControlsContext,
  ZlozDddAuditFindingEntry,
  ZlozDddAuditRequest,
} from './ddd-audit-controls';

type SelectionRequest = Exclude<ZlozAuditComparisonRequest, { type: 'FindingFocused' }>;

export type AuditParts<M> = Readonly<{
  baseline: View.Content<M> | null;
  target: View.Content<M> | null;
  filters: readonly View.Content<M>[];
  entries: readonly View.Content<M>[];
  status: View.Content<M> | null;
  reason: View.Content<M> | null;
}>;

type RenderPart<M, Value, Request> = (
  value: Value,
  h: Html.H<M>,
  onRequest: (request: Request) => M,
) => View.Content<M> | null | undefined;

type AuditViewOptions<M, Context, Entry, Request> = Readonly<{
  className?: string;
  label?: string;
  listLabel?: string;
  statusLabel?: string;
  reasonLabel?: string;
  showCounts?: boolean;
  filters?: readonly ZlozAuditFindingKind[];
  /** Undefined keeps the default and null omits a part. */
  renderBaseline?: RenderPart<M, ZlozAuditEditionControl, Request>;
  renderTarget?: RenderPart<M, ZlozAuditEditionControl, Request>;
  renderFilter?: RenderPart<M, ZlozAuditFindingFilter, Request>;
  renderEntry?: RenderPart<M, Entry, Request>;
  renderStatus?: (context: Context, h: Html.H<M>) => View.Content<M> | null | undefined;
  renderReason?: (context: Context, h: Html.H<M>) => View.Content<M> | null | undefined;
  renderLayout?: (
    parts: AuditParts<M>,
    context: Context,
    h: Html.H<M>,
  ) => readonly View.Content<M>[];
}>;

export type ZlozAuditComparisonViewOptions<M> = AuditViewOptions<
  M,
  ZlozAuditComparisonControlsContext,
  ZlozAuditFindingEntry,
  ZlozAuditComparisonRequest
>;
export type ZlozDddAuditViewOptions<M> = AuditViewOptions<
  M,
  ZlozDddAuditControlsContext,
  ZlozDddAuditFindingEntry,
  ZlozDddAuditRequest
>;

export function auditEditionSelect<M>(
  h: Html.H<M>,
  control: ZlozAuditEditionControl,
  onRequest: (request: SelectionRequest) => M,
) {
  const missing =
    control.value !== null && !control.choices.some((choice) => choice.id === control.value);
  return h.select
    .attr('aria-label', control.label)
    .attr('aria-description', control.reason ?? undefined)
    .attr('title', control.reason ?? undefined)
    .disabled(control.reason !== null)
    .value(control.value ?? '')
    .on('change', ({ value }) =>
      onRequest({
        type: control.part === 'baseline' ? 'BaselineSelected' : 'TargetSelected',
        editionId: value || null,
      }),
    )
    .children(
      h.option
        .attr('value', '')
        .selected(control.value === null)
        .children(control.noneLabel),
      missing
        ? h.option
            .attr('value', control.value ?? '')
            .disabled(true)
            .selected(true)
            .children(`Unavailable edition: ${control.value}`)
        : null,
      ...control.choices.map(({ id, label }) =>
        h.option
          .key(id)
          .attr('value', id)
          .selected(id === control.value)
          .children(label),
      ),
    );
}

export function auditFindingFilter<M>(
  h: Html.H<M>,
  filter: ZlozAuditFindingFilter,
  onRequest: (request: SelectionRequest) => M,
) {
  return h.input
    .attr('type', 'checkbox')
    .attr('aria-label', filter.label)
    .checked(filter.checked)
    .on('click', onRequest({ type: 'FilterToggled', kind: filter.kind }));
}

type FindingButtonOptions<M> = Readonly<{
  label?: string;
  content?: string | View.Content<M>;
}>;

function findingButton<M>(
  h: Html.H<M>,
  entry: ZlozAuditFindingEntry | ZlozDddAuditFindingEntry,
  request: M,
  action: string,
  options: FindingButtonOptions<M>,
) {
  const source = entry.source.kind === 'current' ? 'current graph' : entry.source.name;
  return h.button
    .attr('type', 'button')
    .attr('aria-label', options.label?.trim() || `${action}: ${entry.label} in ${source}`)
    .attr('aria-description', entry.reason ?? undefined)
    .attr('title', entry.reason ?? undefined)
    .disabled(entry.reason !== null)
    .on('click', request)
    .children(options.content ?? `${entry.kind}: ${entry.label}`);
}

export function auditFindingButton<M>(
  h: Html.H<M>,
  entry: ZlozAuditFindingEntry,
  onRequest: (request: ZlozAuditComparisonRequest) => M,
  options: FindingButtonOptions<M> = {},
) {
  return findingButton(h, entry, onRequest(entry.request), `View ${entry.kind} finding`, options);
}

export function dddAuditFindingButton<M>(
  h: Html.H<M>,
  entry: ZlozDddAuditFindingEntry,
  onRequest: (request: ZlozDddAuditRequest) => M,
  options: FindingButtonOptions<M> & Readonly<{ subject?: 'edge' | 'source' | 'target' }> = {},
) {
  const subject = options.subject ?? 'edge';
  return findingButton(
    h,
    entry,
    onRequest({ ...entry.request, subject }),
    `View ${subject} for ${entry.kind} DDD finding`,
    options,
  );
}

type AuditContext<Entry> = Readonly<{
  baseline: ZlozAuditEditionControl;
  target: ZlozAuditEditionControl;
  entries: readonly Entry[];
  filters: Readonly<Record<ZlozAuditFindingKind, ZlozAuditFindingFilter>>;
  reason: string | null;
}>;

const filterKinds = ['introduced', 'resolved', 'persisting'] as const;

function auditPanel<M, Entry, Context extends AuditContext<Entry>, Request>(
  h: Html.H<M>,
  context: Context,
  onRequest: (request: SelectionRequest | Request) => M,
  options: AuditViewOptions<M, Context, Entry, SelectionRequest | Request>,
  label: string,
  listLabel: string,
  statusText: string,
  showFilters: boolean,
  statusLabel: string,
  reasonLabel: string,
  renderEntry: (entry: Entry) => View.Content<M>,
) {
  function selector(control: ZlozAuditEditionControl, render?: typeof options.renderBaseline) {
    const custom = render?.(control, h, onRequest);
    return custom === undefined
      ? h.label.children(control.label, auditEditionSelect(h, control, onRequest))
      : custom;
  }
  function filter(kind: ZlozAuditFindingKind) {
    const control = context.filters[kind];
    const custom = options.renderFilter?.(control, h, onRequest);
    if (custom === null) return [];
    return [
      custom ??
        h.label
          .key(kind)
          .children(
            auditFindingFilter(h, control, onRequest),
            options.showCounts === false ? control.label : `${control.label} (${control.count})`,
          ),
    ];
  }
  function entry(item: Entry) {
    const custom = options.renderEntry?.(item, h, onRequest);
    return custom === null ? [] : [custom ?? renderEntry(item)];
  }
  const status = options.renderStatus?.(context, h);
  const reason = options.renderReason?.(context, h);
  const parts: AuditParts<M> = {
    baseline: selector(context.baseline, options.renderBaseline),
    target: selector(context.target, options.renderTarget),
    filters: showFilters ? [...new Set(options.filters ?? filterKinds)].flatMap(filter) : [],
    entries: context.entries.flatMap(entry),
    status:
      status === undefined
        ? h.p
            .attr('role', 'status')
            .attr('aria-live', 'polite')
            .attr('aria-label', options.statusLabel ?? statusLabel)
            .children(statusText)
        : status,
    reason:
      reason === undefined
        ? context.reason !== null
          ? h.p.attr('aria-label', options.reasonLabel ?? reasonLabel).children(context.reason)
          : null
        : reason,
  };
  return h.div
    .class(options.className)
    .attr('role', 'group')
    .attr('aria-label', options.label?.trim() || label)
    .children(
      options.renderLayout?.(parts, context, h) ?? [
        parts.baseline,
        parts.target,
        ...parts.filters,
        parts.status,
        h.ul.attr('aria-label', options.listLabel?.trim() || listLabel).children(...parts.entries),
        parts.reason,
      ],
    );
}

export function auditComparisonControls<M>(
  h: Html.H<M>,
  context: ZlozAuditComparisonControlsContext,
  onRequest: (request: ZlozAuditComparisonRequest) => M,
  options: ZlozAuditComparisonViewOptions<M> = {},
) {
  const status =
    options.showCounts === false && context.comparison && context.entries.length
      ? context.comparison.status === 'regressed'
        ? 'New causal findings introduced.'
        : 'No new findings; existing findings may persist.'
      : context.statusText;
  return auditPanel(
    h,
    context,
    onRequest,
    options,
    'Causal audit comparison',
    'Causal audit findings',
    status,
    true,
    'Audit comparison status',
    'Audit comparison availability',
    (entry) =>
      h.li
        .key(`${entry.kind}:${entry.finding.edgeId}:${entry.finding.code}`)
        .children(
          auditFindingButton(h, entry, onRequest),
          h.p.children(entry.finding.message),
          entry.reason ? h.p.children(entry.reason) : null,
        ),
  );
}

export function dddAuditControls<M>(
  h: Html.H<M>,
  context: ZlozDddAuditControlsContext,
  onRequest: (request: ZlozDddAuditRequest) => M,
  options: ZlozDddAuditViewOptions<M> = {},
) {
  const status =
    options.showCounts === false && !context.comparison && context.audit
      ? context.audit.status === 'compatible'
        ? 'No blocked DDD findings under this convention.'
        : 'Blocked DDD findings available.'
      : options.showCounts === false && context.comparison && context.entries.length
        ? context.comparison.status === 'regressed'
          ? 'New DDD findings introduced.'
          : 'No new findings; existing findings may persist.'
        : context.statusText;
  return auditPanel(
    h,
    context,
    onRequest,
    options,
    'DDD audit review',
    'DDD audit findings',
    status,
    context.comparison !== null,
    'DDD audit status',
    'DDD audit availability',
    (entry) =>
      h.li
        .key(`${entry.kind}:${entry.finding.edgeId}:${entry.finding.code}`)
        .children(
          dddAuditFindingButton(h, entry, onRequest),
          h.p.children(entry.finding.message),
          h.small.children(entry.finding.relationshipKey),
          dddAuditFindingButton(h, entry, onRequest, { subject: 'source', content: 'View source' }),
          dddAuditFindingButton(h, entry, onRequest, { subject: 'target', content: 'View target' }),
          entry.reason ? h.p.children(entry.reason) : null,
        ),
  );
}
