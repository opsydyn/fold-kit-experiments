import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type {
  ZlozHistoryChangeEntry,
  ZlozHistoryChangeFilter,
  ZlozHistoryChangeKind,
  ZlozHistoryChangeNavigatorContext,
} from './history-change-navigator';
import type {
  ZlozHistoryChangeEntryV2,
  ZlozHistoryChangeNavigatorContextV2,
} from './history-change-navigator-v2';

type Navigator = ZlozHistoryChangeNavigatorContext | ZlozHistoryChangeNavigatorContextV2;
type Entry<C extends Navigator> = C['entries'][number];
type ChangeEntry = ZlozHistoryChangeEntry | ZlozHistoryChangeEntryV2;
type Button<M> = Html.H<M>['button'];
type DecorateButton<M> = (button: Button<M>) => ReturnType<Button<M>['class']>;
type Slot<M> = View.Content<M> | null | undefined;

type Handlers<M, C extends Navigator> = Readonly<{
  onFilter: (kind: ZlozHistoryChangeKind) => M;
  onFocus: (request: Entry<C>['request']) => M;
}>;

export type ZlozHistoryChangeNavigatorHandlers<M> = Handlers<M, ZlozHistoryChangeNavigatorContext>;
export type ZlozHistoryChangeNavigatorHandlersV2<M> = Handlers<
  M,
  ZlozHistoryChangeNavigatorContextV2
>;
export type ZlozHistoryChangeNavigatorParts<M> = Readonly<{
  filters: readonly View.Content<M>[];
  entries: readonly View.Content<M>[];
  status: View.Content<M> | null;
  reason: View.Content<M> | null;
}>;
export type ZlozHistoryChangeNavigatorPartsV2<M> = ZlozHistoryChangeNavigatorParts<M>;

type Options<M, C extends Navigator> = Readonly<{
  className?: string;
  label?: string;
  listLabel?: string;
  statusLabel?: string;
  reasonLabel?: string;
  hideStatus?: boolean;
  filters?: readonly ZlozHistoryChangeKind[];
  renderFilter?: (
    control: ZlozHistoryChangeFilter,
    h: Html.H<M>,
    onFilter: Handlers<M, C>['onFilter'],
  ) => Slot<M>;
  renderEntry?: (entry: Entry<C>, h: Html.H<M>, onFocus: Handlers<M, C>['onFocus']) => Slot<M>;
  renderStatus?: (context: C, h: Html.H<M>) => Slot<M>;
  renderReason?: (context: C, h: Html.H<M>) => Slot<M>;
  renderLayout?: (
    parts: ZlozHistoryChangeNavigatorParts<M>,
    context: C,
    h: Html.H<M>,
  ) => View.Input<M>;
}>;
export type ZlozHistoryChangeNavigatorViewOptions<M> = Options<
  M,
  ZlozHistoryChangeNavigatorContext
>;
export type ZlozHistoryChangeNavigatorViewOptionsV2<M> = Options<
  M,
  ZlozHistoryChangeNavigatorContextV2
>;

function key(entry: ChangeEntry): string {
  return entry.entity === 'mode' ? 'mode' : `${entry.entity}:${entry.id}`;
}

export function historyChangeFilter<M>(
  h: Html.H<M>,
  control: ZlozHistoryChangeFilter,
  onFilter: (kind: ZlozHistoryChangeKind) => M,
) {
  return h.input
    .key(control.kind)
    .attr('type', 'checkbox')
    .attr('aria-label', control.label)
    .checked(control.checked)
    .on('click', onFilter(control.kind));
}

function changeButton<M, E extends ChangeEntry>(
  h: Html.H<M>,
  entry: E,
  onFocus: (request: E['request']) => M,
  versioned: boolean,
  decorate?: DecorateButton<M>,
  children: View.Children<M, never> = [entry.summary],
  label?: string,
) {
  return (decorate?.(h.button) ?? h.button)
    .key(key(entry))
    .attr('type', 'button')
    .attr('data-zloz-history-change-v2', versioned ? entry.entity : undefined)
    .attr('aria-label', label?.trim() || `View ${entry.summary}`)
    .attr('title', entry.reason ?? undefined)
    .attr('aria-description', entry.reason ?? undefined)
    .disabled(entry.reason !== null)
    .on('click', onFocus(entry.request))
    .children(children);
}

export function historyChangeButton<M>(
  h: Html.H<M>,
  entry: ZlozHistoryChangeEntry,
  onFocus: ZlozHistoryChangeNavigatorHandlers<M>['onFocus'],
  decorate?: DecorateButton<M>,
  children?: View.Children<M, never>,
  options?: Readonly<{ label?: string }>,
) {
  return changeButton(h, entry, onFocus, false, decorate, children, options?.label);
}

export function historyChangeButtonV2<M>(
  h: Html.H<M>,
  entry: ZlozHistoryChangeEntryV2,
  onFocus: ZlozHistoryChangeNavigatorHandlersV2<M>['onFocus'],
  decorate?: DecorateButton<M>,
  children?: View.Children<M, never>,
  options?: Readonly<{ label?: string }>,
) {
  return changeButton(h, entry, onFocus, true, decorate, children, options?.label);
}

export function historyChangeStatus<M>(
  h: Html.H<M>,
  context: Pick<Navigator, 'statusText'>,
  label = 'History changes status',
  children: View.Children<M, never> = [context.statusText],
) {
  return h.p
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .attr('aria-label', label)
    .children(children);
}

export function historyChangeReason<M>(
  h: Html.H<M>,
  context: Pick<Navigator, 'reason'>,
  label = 'History changes availability',
  children?: View.Children<M, never>,
) {
  return context.reason === null
    ? null
    : h.p.attr('aria-label', label).children(children ?? [context.reason]);
}

const changeKinds = ['added', 'removed', 'changed'] as const;

function renderNavigator<M, C extends Navigator>(
  h: Html.H<M>,
  context: C,
  handlers: Handlers<M, C>,
  options: Options<M, C>,
  versioned: boolean,
) {
  function filter(kind: ZlozHistoryChangeKind): Slot<M> {
    const control = context.filters[kind];
    const custom = options.renderFilter?.(control, h, handlers.onFilter);
    return custom === undefined
      ? h.label
          .key(kind)
          .children(historyChangeFilter(h, control, handlers.onFilter), control.label)
      : custom;
  }
  function entry(item: Entry<C>): Slot<M> {
    const custom = options.renderEntry?.(item, h, handlers.onFocus);
    return custom === undefined
      ? h.li
          .key(key(item))
          .children(
            changeButton(h, item, handlers.onFocus, versioned),
            item.reason === null ? null : h.span(item.reason),
          )
      : custom;
  }
  const filters = [...new Set(options.filters ?? changeKinds)]
    .map(filter)
    .filter((part) => part != null);
  const entries = context.entries.map(entry).filter((part) => part != null);
  const status = options.hideStatus ? null : options.renderStatus?.(context, h);
  const reason = options.renderReason?.(context, h);
  const parts = {
    filters,
    entries,
    status: status === undefined ? historyChangeStatus(h, context, options.statusLabel) : status,
    reason: reason === undefined ? historyChangeReason(h, context, options.reasonLabel) : reason,
  };
  return h.div
    .class(options.className ?? '')
    .attr('role', 'group')
    .attr('aria-label', options.label?.trim() || 'History change navigator')
    .children(
      options.renderLayout
        ? options.renderLayout(parts, context, h)
        : [
            ...parts.filters,
            parts.status,
            h.ul
              .attr('aria-label', options.listLabel?.trim() || 'History changes')
              .children(parts.entries),
            parts.reason,
          ],
    );
}

export function historyChangeNavigator<M>(
  h: Html.H<M>,
  context: ZlozHistoryChangeNavigatorContext,
  handlers: ZlozHistoryChangeNavigatorHandlers<M>,
  options: ZlozHistoryChangeNavigatorViewOptions<M> = {},
) {
  return renderNavigator(h, context, handlers, options, false);
}

export function historyChangeNavigatorV2<M>(
  h: Html.H<M>,
  context: ZlozHistoryChangeNavigatorContextV2,
  handlers: ZlozHistoryChangeNavigatorHandlersV2<M>,
  options: ZlozHistoryChangeNavigatorViewOptionsV2<M> = {},
) {
  return renderNavigator(h, context, handlers, options, true);
}
