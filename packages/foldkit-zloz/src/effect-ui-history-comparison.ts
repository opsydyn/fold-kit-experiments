import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type {
  ZlozHistoryBaselineControl,
  ZlozHistoryComparisonControlsContext,
  ZlozHistoryComparisonRequest,
  ZlozHistoryGhostControl,
  ZlozHistoryGhostPart,
} from './history-comparison-controls';

type Decorate<M, Tag extends 'div' | 'select' | 'input' | 'p'> = (
  element: Html.H<M>[Tag],
) => ReturnType<Html.H<M>[Tag]['class']>;
type Send<M> = (request: ZlozHistoryComparisonRequest) => M;
type Slot<M> = View.Content<M> | null | undefined;

export type ZlozHistoryComparisonTextOptions = Readonly<{ label?: string }>;
export type ZlozHistoryComparisonControlsParts<M> = Readonly<{
  baseline: View.Content<M> | null;
  ghosts: readonly View.Content<M>[];
  status: View.Content<M> | null;
  reason: View.Content<M> | null;
}>;
export type ZlozHistoryComparisonControlsViewOptions<M> = Readonly<{
  decorate?: Decorate<M, 'div'>;
  label?: string;
  statusLabel?: string;
  reasonLabel?: string;
  ghosts?: readonly ZlozHistoryGhostPart[];
  renderBaseline?: (
    control: ZlozHistoryBaselineControl,
    h: Html.H<M>,
    onRequest: Send<M>,
  ) => Slot<M>;
  renderGhost?: (control: ZlozHistoryGhostControl, h: Html.H<M>, onRequest: Send<M>) => Slot<M>;
  renderStatus?: (context: ZlozHistoryComparisonControlsContext, h: Html.H<M>) => Slot<M>;
  renderReason?: (context: ZlozHistoryComparisonControlsContext, h: Html.H<M>) => Slot<M>;
  renderLayout?: (
    parts: ZlozHistoryComparisonControlsParts<M>,
    context: ZlozHistoryComparisonControlsContext,
    h: Html.H<M>,
  ) => View.Input<M>;
}>;

export function historyBaselineSelect<M>(
  h: Html.H<M>,
  control: ZlozHistoryBaselineControl,
  onRequest: Send<M>,
  decorate?: Decorate<M, 'select'>,
) {
  return (decorate?.(h.select) ?? h.select)
    .attr('aria-label', control.label)
    .value(control.value ?? '')
    .disabled(control.reason !== null)
    .attr('aria-description', control.reason ?? undefined)
    .attr('title', control.reason ?? undefined)
    .on('change', ({ value }) => onRequest({ type: 'BaselineSelected', editionId: value || null }))
    .children(
      h.option.attr('value', '').children(control.noneLabel),
      ...control.choices.map((choice) =>
        h.option.key(choice.editionId).attr('value', choice.editionId).children(choice.label),
      ),
    );
}

/** Emit a toggle fact so the host uses the current preference. */
export function historyGhostToggle<M>(
  h: Html.H<M>,
  control: ZlozHistoryGhostControl,
  onRequest: Send<M>,
  decorate?: Decorate<M, 'input'>,
) {
  return (decorate?.(h.input) ?? h.input)
    .key(control.part)
    .attr('type', 'checkbox')
    .attr('aria-label', control.label)
    .checked(control.checked)
    .disabled(control.reason !== null)
    .attr('aria-description', control.reason ?? undefined)
    .attr('title', control.reason ?? undefined)
    .on('click', onRequest(control.request));
}

export function historyComparisonStatus<M>(
  h: Html.H<M>,
  context: ZlozHistoryComparisonControlsContext,
  decorate?: Decorate<M, 'p'>,
  children: View.Children<M, never> = [context.statusText],
  options: ZlozHistoryComparisonTextOptions = {},
) {
  return (decorate?.(h.p) ?? h.p)
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .attr('aria-label', options.label?.trim() || 'History comparison status')
    .children(children);
}

export function historyComparisonReason<M>(
  h: Html.H<M>,
  context: ZlozHistoryComparisonControlsContext,
  decorate?: Decorate<M, 'p'>,
  children?: View.Children<M, never>,
  options: ZlozHistoryComparisonTextOptions = {},
) {
  return context.reasons.length === 0
    ? null
    : (decorate?.(h.p) ?? h.p)
        .attr('aria-label', options.label?.trim() || 'History comparison availability')
        .children(children ?? [context.reasons.join(' ')]);
}

const ghostParts = ['enabled', 'nodes', 'edges', 'movements'] as const;

/** Compose controls over the resolved comparison without owning preferences or lifecycle. */
export function historyComparisonControls<M>(
  h: Html.H<M>,
  context: ZlozHistoryComparisonControlsContext,
  onRequest: Send<M>,
  options: ZlozHistoryComparisonControlsViewOptions<M> = {},
) {
  function ghost(part: ZlozHistoryGhostPart): Slot<M> {
    const control = context.ghosts[part];
    const custom = options.renderGhost?.(control, h, onRequest);
    return custom === undefined
      ? h.label.key(part).children(historyGhostToggle(h, control, onRequest), control.label)
      : custom;
  }
  const baseline = options.renderBaseline?.(context.baseline, h, onRequest);
  const status = options.renderStatus?.(context, h);
  const reason = options.renderReason?.(context, h);
  const parts = {
    baseline:
      baseline === undefined
        ? h.label(context.baseline.label, historyBaselineSelect(h, context.baseline, onRequest))
        : baseline,
    ghosts: [...new Set(options.ghosts ?? ghostParts)].map(ghost).filter((part) => part != null),
    status:
      status === undefined
        ? historyComparisonStatus(h, context, undefined, undefined, {
            label: options.statusLabel ?? 'History comparison status',
          })
        : status,
    reason:
      reason === undefined
        ? historyComparisonReason(h, context, undefined, undefined, {
            label: options.reasonLabel ?? 'History comparison availability',
          })
        : reason,
  };
  return (options.decorate?.(h.div) ?? h.div)
    .attr('role', 'group')
    .attr('aria-label', options.label?.trim() || 'History comparison controls')
    .children(
      options.renderLayout
        ? options.renderLayout(parts, context, h)
        : [parts.baseline, ...parts.ghosts, parts.status, parts.reason],
    );
}
