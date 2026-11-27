import { Mount, type View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import { minimapInput } from './effect-ui-input';
import type { ZlozHistoryGhostVisibility } from './history-comparison-controls';
import {
  drawHistoryGhosts,
  type HistoryGhostComparison,
  type HistoryGhostOptions,
} from './history-ghost-drawing';
import type { ZlozHistoryPresentationContextV2 } from './history-presentation-v2';
import { minimapContext } from './minimap-context';
import type { EditorEvent, EditorState, Point, Size } from './types';

export type ZlozHistoryPresentationPartsV2<M> = Readonly<{
  summary: View.Content<M> | null;
  mode: View.Content<M> | null;
}>;
export type ZlozHistoryPresentationViewOptionsV2<M> = Readonly<{
  className?: string;
  label?: string;
  renderSummary?: (
    context: ZlozHistoryPresentationContextV2,
    h: Html.H<M>,
  ) => View.Content<M> | null | undefined;
  renderMode?: (
    context: ZlozHistoryPresentationContextV2,
    h: Html.H<M>,
  ) => View.Content<M> | null | undefined;
  renderLayout?: (
    parts: ZlozHistoryPresentationPartsV2<M>,
    context: ZlozHistoryPresentationContextV2,
    h: Html.H<M>,
  ) => View.Input<M>;
}>;

export function historyComparisonV2<M>(
  h: Html.H<M>,
  context: ZlozHistoryPresentationContextV2,
  options: ZlozHistoryPresentationViewOptionsV2<M> = {},
) {
  const summary = options.renderSummary?.(context, h);
  const mode = options.renderMode?.(context, h);
  const parts = {
    summary:
      summary === undefined
        ? h.span.attr('data-zloz-history-summary', '').children(context.summaryText)
        : summary,
    mode:
      mode === undefined
        ? h.span
            .attr('data-zloz-history-mode', context.comparison.modeChange.kind)
            .children(context.modeText)
        : mode,
  };
  return h.div
    .class(options.className ?? '')
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .attr('aria-label', options.label?.trim() || 'History comparison')
    .children(
      options.renderLayout
        ? options.renderLayout(parts, context, h)
        : [parts.summary, parts.summary && parts.mode ? ' ' : null, parts.mode],
    );
}

export type NativeHistoryGhostArtwork<M> = Pick<
  HistoryGhostOptions<View.Content<M>>,
  'renderNode' | 'renderEdge' | 'renderMovement'
>;

/** Inert world-space marks use the same geometry and visibility on the inspected checkpoint. */
export function historyGhosts<M>(
  comparison: HistoryGhostComparison,
  visibility: Partial<ZlozHistoryGhostVisibility> = {},
  displaySide: 'baseline' | 'selected' = 'selected',
  artwork?: NativeHistoryGhostArtwork<M>,
) {
  return drawHistoryGhosts<View.Content<M>>(
    (tag, attributes, children, style) => {
      const element = Object.entries(attributes).reduce(
        (node, [name, value]) => node.attr(name, value),
        new Html.Element<M>(tag),
      );
      return (style ? element.style(style) : element).children(children);
    },
    comparison,
    {
      ...visibility,
      renderNode: artwork?.renderNode,
      renderEdge: artwork?.renderEdge,
      renderMovement: artwork?.renderMovement,
    },
    displaySide === 'baseline' ? 'Compared' : 'Previous',
    displaySide,
  );
}

export type ZlozHistoryGhostOptionsV2<M> = NativeHistoryGhostArtwork<M>;

export function historyGhostsV2<M>(
  context: ZlozHistoryPresentationContextV2,
  artwork?: ZlozHistoryGhostOptionsV2<M>,
) {
  return historyGhosts<M>(
    context.comparison,
    context.effectiveGhosts,
    context.displaySide,
    artwork,
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
  options?: Readonly<{ compact?: boolean; onEscape?: M }>,
) {
  const compact = options?.compact === true;
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
    .style(
      compact
        ? {
            width: '100%',
            height: '130px',
            padding: '12px',
            border: '3px solid #38bdf8',
            borderRadius: '18px',
            background: 'light-dark(#f0f9ff, #152b3c)',
            cursor: 'crosshair',
          }
        : {
            width: '100%',
            height: '150px',
            padding: '0',
            background: 'var(--flow-node-background, #fff)',
            cursor: 'crosshair',
          },
    )
    .disabled(state.gesture.type !== 'idle')
    .onMount(Mount.map(minimapInput(), onEvent))
    .on(
      'keydown',
      ({ key, shift }) => {
        if (key === 'Escape') return options?.onEscape;
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
              .attr('rx', compact ? '20' : undefined)
              .attr(
                'fill',
                compact
                  ? node.kind === 'group' && !state.collapsedGroups.includes(node.id)
                    ? '#bae6fd'
                    : '#0369a1'
                  : node.kind === 'group'
                    ? 'var(--flow-group-background, #cbd5e1)'
                    : 'var(--flow-node-border, #64748b)',
              ),
          ),
          rect(geometry.visible, geometry.visible)
            .attr('data-flow-minimap-viewport', '')
            .attr('fill', 'none')
            .attr('stroke', compact ? '#ea580c' : 'var(--flow-selection, #2563eb)')
            .attr('vector-effect', 'non-scaling-stroke'),
        ),
    );
}
