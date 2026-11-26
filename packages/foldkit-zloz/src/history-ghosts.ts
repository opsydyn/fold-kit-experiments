import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozHistoryChange, ZlozHistoryComparison } from './history';
import { drawHistoryGhosts, type HistoryGhostComparison } from './history-ghost-drawing';
import type { ZlozEdge, ZlozNode } from './types';

export type ZlozHistoryGhostOptions<M> = Readonly<{
  enabled?: boolean;
  nodes?: boolean;
  edges?: boolean;
  movements?: boolean;
  /** Inert SVG content. Undefined keeps the default; null omits the mark. */
  renderNode?: (change: ZlozHistoryChange<ZlozNode>, h: HtmlBuilder<M>) => Html | null | undefined;
  renderEdge?: (change: ZlozHistoryChange<ZlozEdge>, h: HtmlBuilder<M>) => Html | null | undefined;
  renderMovement?: (
    change: ZlozHistoryChange<ZlozNode>,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
}>;
/** Compose explicitly inside renderWorldOverlay. No editor nodes, sockets, hit targets or history entries are created.
 * The SVG is visual-only: expose comparison meaning through the host's accessible legend/list.
 * Custom renderers must remain inert SVG content; keep editing controls outside this layer. */
export function zlozHistoryGhosts<M>(
  h: HtmlBuilder<M>,
  comparison: ZlozHistoryComparison,
  options: ZlozHistoryGhostOptions<M> = {},
): Html | null {
  return renderHistoryGraphGhosts(h, comparison, options);
}

/** Internal graph-only drawing shared by explicit versioned presentation adapters. */
export function renderHistoryGraphGhosts<M>(
  h: HtmlBuilder<M>,
  comparison: HistoryGhostComparison,
  options: ZlozHistoryGhostOptions<M> = {},
  previousLabel = 'Previous',
  displaySide: 'baseline' | 'selected' = 'selected',
): Html | null {
  const { renderNode, renderEdge, renderMovement, ...visibility } = options;
  return drawHistoryGhosts<Html>(
    (tag, attributes, children, style) => {
      const props = Object.entries(attributes).map(([name, value]) => h.Attribute(name, value));
      return h[tag](style ? [...props, h.Style(style)] : props, children);
    },
    comparison,
    {
      ...visibility,
      renderNode: renderNode && ((change) => renderNode(change, h)),
      renderEdge: renderEdge && ((change) => renderEdge(change, h)),
      renderMovement: renderMovement && ((change) => renderMovement(change, h)),
    },
    previousLabel,
    displaySide,
  );
}
