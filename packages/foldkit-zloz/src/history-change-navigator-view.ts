import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  ZlozHistoryChangeEntry,
  ZlozHistoryChangeFilter,
  ZlozHistoryChangeKind,
  ZlozHistoryChangeFocusRequest,
  ZlozHistoryChangeNavigatorContext,
} from './history-change-navigator';
import type { ZlozHistoryComparisonTextOptions } from './history-comparison-controls-view';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];
export type ZlozHistoryChangeNavigatorHandlers<M> = Readonly<{
  onFilter: (kind: ZlozHistoryChangeKind) => M;
  onFocus: (request: ZlozHistoryChangeFocusRequest) => M;
}>;
export type ZlozHistoryChangeNavigatorParts = Readonly<{
  filters: readonly Html[];
  entries: readonly Html[];
  status: Html | null;
  reason: Html | null;
}>;
export type ZlozHistoryChangeNavigatorViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  listLabel?: string;
  statusLabel?: string;
  reasonLabel?: string;
  /** Ordered visible filter controls. This does not change the host's filtering preferences. */
  filters?: readonly ZlozHistoryChangeKind[];
  /** Undefined retains a default; null omits the part. Custom entries own their list-item semantics. */
  renderFilter?: (
    control: ZlozHistoryChangeFilter,
    h: HtmlBuilder<M>,
    onFilter: ZlozHistoryChangeNavigatorHandlers<M>['onFilter'],
  ) => Html | null | undefined;
  renderEntry?: (
    entry: ZlozHistoryChangeEntry,
    h: HtmlBuilder<M>,
    onFocus: ZlozHistoryChangeNavigatorHandlers<M>['onFocus'],
  ) => Html | null | undefined;
  renderStatus?: (
    context: ZlozHistoryChangeNavigatorContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderReason?: (
    context: ZlozHistoryChangeNavigatorContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozHistoryChangeNavigatorParts,
    context: ZlozHistoryChangeNavigatorContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
/** Native checkbox emits a toggle fact; the host updates its current filter preferences. */
export function zlozHistoryChangeFilter<M>(
  h: HtmlBuilder<M>,
  control: ZlozHistoryChangeFilter,
  onFilter: ZlozHistoryChangeNavigatorHandlers<M>['onFilter'],
  attributes: Parameters<HtmlBuilder<M>['input']>[0] = [],
): Html {
  return h.input([
    h.Key(control.kind),
    ...attributes,
    h.Type('checkbox'),
    h.AriaLabel(control.label),
    h.Checked(control.checked),
    h.OnClick(onFilter(control.kind)),
  ]);
}
/** Camera focus is explicit. The native button retains keyboard focus; no DOM focus or graph edits are implied. */
export function zlozHistoryChangeButton<M>(
  h: HtmlBuilder<M>,
  entry: ZlozHistoryChangeEntry,
  onFocus: ZlozHistoryChangeNavigatorHandlers<M>['onFocus'],
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Children<M> = [entry.summary],
  options: ZlozHistoryComparisonTextOptions = {},
): Html {
  return h.button(
    [
      h.Key(`${entry.entity}:${entry.id}`),
      ...attributes,
      h.Type('button'),
      h.AriaLabel(options.label?.trim() || `View ${entry.summary}`),
      h.Disabled(entry.reason !== null),
      ...(entry.reason ? [h.AriaDescription(entry.reason), h.Title(entry.reason)] : []),
      h.OnClick(onFocus(entry.request)),
    ],
    children,
  );
}
/** Polite result summary with customizable name and content. */
export function zlozHistoryChangeStatus<M>(
  h: HtmlBuilder<M>,
  context: ZlozHistoryChangeNavigatorContext,
  attributes: Attributes<M> = [],
  children: Children<M> = [context.statusText],
  options: ZlozHistoryComparisonTextOptions = {},
): Html {
  return h.p(
    [
      ...attributes,
      h.Role('status'),
      h.AriaLive('polite'),
      h.AriaLabel(options.label?.trim() || 'History changes status'),
    ],
    children,
  );
}
/** Overall unavailable reason; per-entry reasons remain visible in the default list. */
export function zlozHistoryChangeReason<M>(
  h: HtmlBuilder<M>,
  context: ZlozHistoryChangeNavigatorContext,
  attributes: Attributes<M> = [],
  children?: Children<M>,
  options: ZlozHistoryComparisonTextOptions = {},
): Html | null {
  return context.reason === null
    ? null
    : h.p(
        [...attributes, h.AriaLabel(options.label?.trim() || 'History changes availability')],
        children ?? [context.reason],
      );
}
/** Unstyled native filter/list composition with no owned state, IDs, timer or side effects. */
export function zlozHistoryChangeNavigator<M>(
  h: HtmlBuilder<M>,
  context: ZlozHistoryChangeNavigatorContext,
  handlers: ZlozHistoryChangeNavigatorHandlers<M>,
  options: ZlozHistoryChangeNavigatorViewOptions<M> = {},
): Html {
  function filter(kind: ZlozHistoryChangeKind): readonly Html[] {
    const control = context.filters[kind];
    const custom = options.renderFilter?.(control, h, handlers.onFilter);
    const result =
      custom === undefined
        ? h.label(
            [h.Key(kind)],
            [zlozHistoryChangeFilter(h, control, handlers.onFilter), control.label],
          )
        : custom;
    return result === null ? [] : [result];
  }
  function entry(item: ZlozHistoryChangeEntry): readonly Html[] {
    const custom = options.renderEntry?.(item, h, handlers.onFocus);
    const result =
      custom === undefined
        ? h.li(
            [h.Key(`${item.entity}:${item.id}`)],
            [
              zlozHistoryChangeButton(h, item, handlers.onFocus),
              ...(item.reason ? [h.span([], [item.reason])] : []),
            ],
          )
        : custom;
    return result === null ? [] : [result];
  }
  const status = options.renderStatus?.(context, h);
  const reason = options.renderReason?.(context, h);
  const parts: ZlozHistoryChangeNavigatorParts = {
    filters: [...new Set(options.filters ?? (['added', 'removed', 'changed'] as const))].flatMap(
      filter,
    ),
    entries: context.entries.flatMap(entry),
    status:
      status === undefined
        ? zlozHistoryChangeStatus(h, context, [], [context.statusText], {
            label: options.statusLabel ?? 'History changes status',
          })
        : status,
    reason:
      reason === undefined
        ? zlozHistoryChangeReason(h, context, [], undefined, {
            label: options.reasonLabel ?? 'History changes availability',
          })
        : reason,
  };
  return h.div(
    [
      ...(options.attributes ?? []),
      h.Role('group'),
      h.AriaLabel(options.label?.trim() || 'History change navigator'),
    ],
    options.renderLayout
      ? options.renderLayout(parts, context, h)
      : [
          ...parts.filters,
          ...(parts.status ? [parts.status] : []),
          h.ul([h.AriaLabel(options.listLabel?.trim() || 'History changes')], parts.entries),
          ...(parts.reason ? [parts.reason] : []),
        ],
  );
}
