import type { Html, HtmlBuilder } from 'foldkit/html';

import { renderHistoryGraphGhosts } from './history-ghosts';
import type { ZlozHistoryGhostOptions } from './history-ghosts';
import type { ZlozHistoryPresentationContextV2 } from './history-presentation-v2';

export type ZlozHistoryPresentationPartsV2 = Readonly<{
  summary: Html | null;
  mode: Html | null;
}>;
export type ZlozHistoryPresentationViewOptionsV2<M> = Readonly<{
  attributes?: Parameters<HtmlBuilder<M>['div']>[0];
  label?: string;
  /** Undefined retains default text; null omits the part. */
  renderSummary?: (
    context: ZlozHistoryPresentationContextV2,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderMode?: (
    context: ZlozHistoryPresentationContextV2,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozHistoryPresentationPartsV2,
    context: ZlozHistoryPresentationContextV2,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
/** Inert SVG marks only; visibility comes from the resolved presentation context. */
export type ZlozHistoryGhostOptionsV2<M> = Pick<
  ZlozHistoryGhostOptions<M>,
  'renderNode' | 'renderEdge' | 'renderMovement'
>;

/** Optional unstyled live status. Custom hosts retain responsibility for accessible comparison meaning. */
export function zlozHistoryComparisonPresentationV2<M>(
  h: HtmlBuilder<M>,
  context: ZlozHistoryPresentationContextV2,
  options: ZlozHistoryPresentationViewOptionsV2<M> = {},
): Html {
  const summary = options.renderSummary?.(context, h);
  const mode = options.renderMode?.(context, h);
  const parts: ZlozHistoryPresentationPartsV2 = {
    summary:
      summary === undefined
        ? h.span([h.DataAttribute('zloz-history-summary', '')], [context.summaryText])
        : summary,
    mode:
      mode === undefined
        ? h.span(
            [h.DataAttribute('zloz-history-mode', context.comparison.modeChange.kind)],
            [context.modeText],
          )
        : mode,
  };
  return h.div(
    [
      ...(options.attributes ?? []),
      h.Role('status'),
      h.AriaLive('polite'),
      h.AriaLabel(options.label?.trim() || 'History comparison'),
    ],
    options.renderLayout
      ? options.renderLayout(parts, context, h)
      : [
          ...(parts.summary ? [parts.summary] : []),
          ...(parts.summary && parts.mode ? [' '] : []),
          ...(parts.mode ? [parts.mode] : []),
        ],
  );
}

/** Compose in renderWorldOverlay; no sockets, hit targets, editor writes or mode-derived fake marks. */
export function zlozHistoryGhostsV2<M>(
  h: HtmlBuilder<M>,
  context: ZlozHistoryPresentationContextV2,
  options: ZlozHistoryGhostOptionsV2<M> = {},
): Html | null {
  return renderHistoryGraphGhosts(
    h,
    context.comparison,
    { ...options, ...context.effectiveGhosts },
    context.displaySide === 'baseline' ? 'Compared' : 'Previous',
    context.displaySide,
  );
}
