import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { ZlozReviewPacketDiagnostic } from './review-packet';
import {
  resolveReviewReader,
  type ZlozReviewReaderOptions,
  type ZlozReviewReaderRequest,
  type ZlozReviewReaderState,
} from './review-reader';

type Part<M> = View.Content<M> | null;
export type ReviewReaderParts<M> = Readonly<{
  open: Part<M>;
  status: Part<M>;
  summary: Part<M>;
  selection: Part<M>;
  findings: Part<M>;
  cancel: Part<M>;
  close: Part<M>;
}>;
export type ReviewReaderOptions<M> = Readonly<{
  attributes?: Readonly<Record<string, string>>;
  idPrefix?: string;
  instructions?: boolean;
  showCounts?: boolean;
  renderFinding?: (finding: ZlozReviewPacketDiagnostic, h: Html.H<M>) => Part<M> | undefined;
  renderSummary?: (state: ZlozReviewReaderState, h: Html.H<M>) => Part<M> | undefined;
  renderLayout?: (
    parts: ReviewReaderParts<M>,
    h: Html.H<M>,
  ) => readonly (View.Content<M> | string | null | undefined)[];
}>;

/** Inspect a detached packet. The host owns file IO and the read-only canvas. */
export function reviewReader<M>(
  h: Html.H<M>,
  state: ZlozReviewReaderState,
  onRequest: (request: ZlozReviewReaderRequest) => M,
  onFiles: (files: readonly File[]) => M,
  policy: ZlozReviewReaderOptions = {},
  options: ReviewReaderOptions<M> = {},
) {
  const context = resolveReviewReader(state, policy);
  const { scope, pending, review } = state;
  const fileId = `${options.idPrefix ?? 'zloz-review-reader'}-file`;
  const comparison = review?.packet.comparison;
  const customSummary = options.renderSummary?.(state, h);
  const parts: ReviewReaderParts<M> = {
    open: h.label.attr('for', fileId).children(
      'Open review packet',
      h.input
        .id(fileId)
        .attr('type', 'file')
        .attr('accept', '.json,application/json')
        .value('')
        .disabled(context.openReason !== null)
        .on('change', ({ files }) => (context.openReason === null ? onFiles(files) : undefined)),
    ),
    status: h.p
      .attr('role', 'status')
      .attr('aria-live', 'polite')
      .children(context.openReason ?? state.notice),
    cancel: pending
      ? h.button
          .attr('type', 'button')
          .on('click', onRequest({ scope, type: 'ReadCancelled', run: pending.run }))
          .children('Cancel packet read')
      : null,
    summary:
      customSummary !== undefined
        ? customSummary
        : review && comparison
          ? h.div.children(
              h.strong.children(review.packet.model.name),
              h.p.children('Read-only packet · ', review.name),
              h.p.children(`Audit: ${comparison.status}`),
              options.showCounts === false
                ? null
                : h.p
                    .attr('data-review-reader-counts', '')
                    .children(
                      `${comparison.summary.introduced} introduced · ${comparison.summary.resolved} resolved · ${comparison.summary.persisting} persisting`,
                    ),
            )
          : null,
    selection: review
      ? h.div
          .attr('role', 'group')
          .attr('aria-label', 'Packet snapshot')
          .children(
            ...(['baseline', 'selected'] as const).map((side) =>
              h.button
                .key(side)
                .attr('type', 'button')
                .attr('aria-pressed', String(review.side === side))
                .disabled(context.sideReason !== null)
                .on('click', onRequest({ scope, type: 'SideSelected', reviewId: review.id, side }))
                .children(
                  side === 'baseline'
                    ? `Baseline: ${review.packet.baseline.source.name}`
                    : `Selected: ${review.packet.selected.source.kind === 'current' ? 'Current graph' : review.packet.selected.source.name}`,
                ),
            ),
            context.sideReason ? h.p.children(context.sideReason) : null,
          )
      : null,
    close: review
      ? h.button
          .attr('type', 'button')
          .on('click', onRequest({ scope, type: 'ReviewClosed', reviewId: review.id }))
          .children('Close packet review')
      : null,
    findings:
      review && comparison
        ? h.div.attr('aria-label', 'Packet findings').children(
            ...comparison.introduced.map((item) =>
              h.p.children(`Introduced · ${item.edgeId}: ${item.message}`),
            ),
            ...comparison.resolved.map((item) =>
              h.p.children(`Resolved · ${item.edgeId}: ${item.message}`),
            ),
            ...comparison.persisting.map((item) =>
              h.p.children(`Persisting · ${item.after.edgeId}: ${item.after.message}`),
            ),
            h.ul.attr('aria-label', 'Packet projection findings').children(
              ...review.packet.diagnostics.flatMap((item) => {
                const rendered = options.renderFinding?.(item, h);
                return rendered === null
                  ? []
                  : [rendered ?? h.li.children(`${item.side} · ${item.code}: ${item.message}`)];
              }),
            ),
          )
        : null,
  };
  const reviewView =
    review && comparison
      ? h.div.children(parts.summary, parts.selection, parts.close, parts.findings)
      : null;
  return h.div
    .attrs(options.attributes ?? {})
    .attr('data-review-reader', '')
    .children(
      options.instructions === false
        ? null
        : h.p.children(
            'Open a portable packet for inspection. Reading never imports or edits your model.',
          ),
      ...(options.renderLayout?.(parts, h) ?? [parts.open, parts.status, parts.cancel, reviewView]),
    );
}
