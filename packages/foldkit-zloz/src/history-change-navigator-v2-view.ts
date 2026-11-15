import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozHistoryChangeFilter, ZlozHistoryChangeKind } from './history-change-navigator';
import type {
  ZlozHistoryChangeEntryV2,
  ZlozHistoryChangeFocusRequestV2,
  ZlozHistoryChangeNavigatorContextV2,
} from './history-change-navigator-v2';
import { zlozHistoryChangeFilter } from './history-change-navigator-view';
import type { ZlozHistoryComparisonTextOptions } from './history-comparison-controls-view';

type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];
export type ZlozHistoryChangeNavigatorHandlersV2<M> = Readonly<{
  onFilter: (kind: ZlozHistoryChangeKind) => M;
  onFocus: (request: ZlozHistoryChangeFocusRequestV2) => M;
}>;
export type ZlozHistoryChangeNavigatorPartsV2 = Readonly<{
  filters: readonly Html[];
  entries: readonly Html[];
  status: Html | null;
  reason: Html | null;
}>;
export type ZlozHistoryChangeNavigatorViewOptionsV2<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  listLabel?: string;
  statusLabel?: string;
  reasonLabel?: string;
  /** Only controls presentation; host options own the actual filter values. */
  filters?: readonly ZlozHistoryChangeKind[];
  /** Undefined retains defaults; null omits a part. Custom entries own list-item semantics. */
  renderFilter?: (
    control: ZlozHistoryChangeFilter,
    h: HtmlBuilder<M>,
    onFilter: ZlozHistoryChangeNavigatorHandlersV2<M>['onFilter'],
  ) => Html | null | undefined;
  renderEntry?: (
    entry: ZlozHistoryChangeEntryV2,
    h: HtmlBuilder<M>,
    onFocus: ZlozHistoryChangeNavigatorHandlersV2<M>['onFocus'],
  ) => Html | null | undefined;
  renderStatus?: (
    context: ZlozHistoryChangeNavigatorContextV2,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderReason?: (
    context: ZlozHistoryChangeNavigatorContextV2,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozHistoryChangeNavigatorPartsV2,
    context: ZlozHistoryChangeNavigatorContextV2,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;

/** Mode entries request inspection only. The host resolves every request against its current side. */
export function zlozHistoryChangeButtonV2<M>(
  h: HtmlBuilder<M>,
  entry: ZlozHistoryChangeEntryV2,
  onFocus: ZlozHistoryChangeNavigatorHandlersV2<M>['onFocus'],
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Children<M> = [entry.summary],
  options: ZlozHistoryComparisonTextOptions = {},
): Html {
  return h.button(
    [
      h.Key(entry.entity === 'mode' ? 'mode' : `${entry.entity}:${entry.id}`),
      ...attributes,
      h.Type('button'),
      h.DataAttribute('zloz-history-change-v2', entry.entity),
      h.AriaLabel(options.label?.trim() || `View ${entry.summary}`),
      h.Disabled(entry.reason !== null),
      ...(entry.reason ? [h.AriaDescription(entry.reason), h.Title(entry.reason)] : []),
      h.OnClick(onFocus(entry.request)),
    ],
    children,
  );
}

/** Optional native/custom filter and change list. No editor, cursor, side or lifecycle is owned here. */
export function zlozHistoryChangeNavigatorV2<M>(
  h: HtmlBuilder<M>,
  context: ZlozHistoryChangeNavigatorContextV2,
  handlers: ZlozHistoryChangeNavigatorHandlersV2<M>,
  options: ZlozHistoryChangeNavigatorViewOptionsV2<M> = {},
): Html {
  const filters = [
    ...new Set(options.filters ?? (['added', 'removed', 'changed'] as const)),
  ].flatMap((kind) => {
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
  });
  const entries = context.entries.flatMap((entry) => {
    const custom = options.renderEntry?.(entry, h, handlers.onFocus);
    const result =
      custom === undefined
        ? h.li(
            [h.Key(entry.entity === 'mode' ? 'mode' : `${entry.entity}:${entry.id}`)],
            [
              zlozHistoryChangeButtonV2(h, entry, handlers.onFocus),
              ...(entry.reason ? [h.span([], [entry.reason])] : []),
            ],
          )
        : custom;
    return result === null ? [] : [result];
  });
  const status = options.renderStatus?.(context, h);
  const reason = options.renderReason?.(context, h);
  const parts: ZlozHistoryChangeNavigatorPartsV2 = {
    filters,
    entries,
    status:
      status === undefined
        ? h.p(
            [
              h.Role('status'),
              h.AriaLive('polite'),
              h.AriaLabel(options.statusLabel?.trim() || 'History changes status'),
            ],
            [context.statusText],
          )
        : status,
    reason:
      reason === undefined
        ? context.reason === null
          ? null
          : h.p(
              [h.AriaLabel(options.reasonLabel?.trim() || 'History changes availability')],
              [context.reason],
            )
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
