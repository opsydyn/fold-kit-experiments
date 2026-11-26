import { Mount, type View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import { minimapInput } from './effect-ui-input';
import type { ZlozHistoryChangeKind } from './history-change-navigator';
import type {
  ZlozHistoryChangeFocusRequestV2,
  ZlozHistoryChangeNavigatorContextV2,
} from './history-change-navigator-v2';
import { drawHistoryGhosts } from './history-ghost-drawing';
import type { ZlozHistoryPresentationContextV2 } from './history-presentation-v2';
import { minimapContext } from './minimap-context';
import type { EditorEvent, EditorState, Point, Size } from './types';

export function historyComparisonV2<M>(h: Html.H<M>, context: ZlozHistoryPresentationContextV2) {
  return h.div
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .attr('aria-label', 'History comparison')
    .children(
      h.span.attr('data-zloz-history-summary', '').children(context.summaryText),
      ' ',
      h.span
        .attr('data-zloz-history-mode', context.comparison.modeChange.kind)
        .children(context.modeText),
    );
}

/** Inert world-space marks use the same geometry and visibility as the FoldKit view. */
export function historyGhostsV2<M>(context: ZlozHistoryPresentationContextV2) {
  return drawHistoryGhosts<View.Content<M>>(
    (tag, attributes, children, style) => {
      const element = Object.entries(attributes).reduce(
        (node, [name, value]) => node.attr(name, value),
        new Html.Element<M>(tag),
      );
      return (style ? element.style(style) : element).children(children);
    },
    context.comparison,
    context.effectiveGhosts,
    context.displaySide === 'baseline' ? 'Compared' : 'Previous',
    context.displaySide,
  );
}

const changeKinds = ['added', 'removed', 'changed'] as const;

export function historyChangeNavigatorV2<M>(
  h: Html.H<M>,
  context: ZlozHistoryChangeNavigatorContextV2,
  handlers: {
    onFilter: (kind: ZlozHistoryChangeKind) => M;
    onFocus: (request: ZlozHistoryChangeFocusRequestV2) => M;
  },
  options: { className?: string; hideStatus?: boolean } = {},
) {
  return h.div
    .class(options.className ?? '')
    .attr('role', 'group')
    .attr('aria-label', 'History change navigator')
    .children(
      ...changeKinds.map((kind) =>
        h.label
          .key(kind)
          .children(
            h.input
              .attr('type', 'checkbox')
              .attr('aria-label', context.filters[kind].label)
              .checked(context.filters[kind].checked)
              .on('click', handlers.onFilter(kind)),
            context.filters[kind].label,
          ),
      ),
      options.hideStatus
        ? null
        : h.p
            .attr('role', 'status')
            .attr('aria-live', 'polite')
            .attr('aria-label', 'History changes status')
            .children(context.statusText),
      h.ul.attr('aria-label', 'History changes').children(
        ...context.entries.map((entry) =>
          h.li.key(entry.entity === 'mode' ? 'mode' : `${entry.entity}:${entry.id}`).children(
            h.button
              .attr('type', 'button')
              .attr('data-zloz-history-change-v2', entry.entity)
              .attr('aria-label', `View ${entry.summary}`)
              .attr('aria-description', entry.reason ?? undefined)
              .attr('title', entry.reason ?? undefined)
              .disabled(entry.reason !== null)
              .on('click', handlers.onFocus(entry.request))
              .children(entry.summary),
            entry.reason ? h.span(entry.reason) : null,
          ),
        ),
      ),
      context.reason
        ? h.p.attr('aria-label', 'History changes availability').children(context.reason)
        : null,
    );
}

const arrowDirections = new Map<string, Point>([
  ['ArrowLeft', { x: 1, y: 0 }],
  ['ArrowRight', { x: -1, y: 0 }],
  ['ArrowUp', { x: 0, y: 1 }],
  ['ArrowDown', { x: 0, y: -1 }],
]);

export function historyMinimap<M>(
  h: Html.H<M>,
  state: EditorState,
  onEvent: (event: EditorEvent) => M,
) {
  const context = minimapContext(state);
  if (!context) return null;
  const { geometry, nodes } = context;
  const rect = (position: Point, size: Size) =>
    new Html.Element<M>('rect')
      .attr('x', String(position.x))
      .attr('y', String(position.y))
      .attr('width', String(size.width))
      .attr('height', String(size.height));

  return h.button
    .key('minimap')
    .attr('type', 'button')
    .attr('aria-label', 'Diagram overview')
    .attr('title', 'Arrow keys pan; Shift accelerates; Home fits; Enter or Space centers')
    .attr('data-flow-minimap-frame', '')
    .style({
      width: '100%',
      height: '150px',
      padding: '0',
      background: 'var(--flow-node-background, #fff)',
      cursor: 'crosshair',
    })
    .disabled(state.gesture.type !== 'idle')
    .onMount(Mount.map(minimapInput(), onEvent))
    .on(
      'keydown',
      ({ key, shift }) => {
        if (key === 'Home') return onEvent({ type: 'FitViewClicked' });
        const direction = arrowDirections.get(key);
        if (!direction) return undefined;
        const step = shift ? 80 : 20;
        return onEvent({
          type: 'ViewportNudged',
          delta: { x: direction.x * step, y: direction.y * step },
        });
      },
      { preventDefault: true },
    )
    .children(
      new Html.Element<M>('svg')
        .attr('data-flow-minimap', '')
        .attr('aria-hidden', 'true')
        .attr('preserveAspectRatio', 'none')
        .attr('viewBox', `${geometry.x} ${geometry.y} ${geometry.width} ${geometry.height}`)
        .attr('width', '100%')
        .attr('height', '100%')
        .style({ display: 'block' })
        .children(
          ...nodes.map((node) =>
            rect(node.position, node.size)
              .key(node.id)
              .attr(
                'fill',
                node.kind === 'group'
                  ? 'var(--flow-group-background, #cbd5e1)'
                  : 'var(--flow-node-border, #64748b)',
              ),
          ),
          rect(geometry.visible, geometry.visible)
            .attr('data-flow-minimap-viewport', '')
            .attr('fill', 'none')
            .attr('stroke', 'var(--flow-selection, #2563eb)')
            .attr('vector-effect', 'non-scaling-stroke'),
        ),
    );
}
