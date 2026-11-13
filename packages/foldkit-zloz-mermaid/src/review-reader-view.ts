import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozReviewPacketDiagnostic } from './review-packet';
import {
  resolveReviewReader,
  type ZlozReviewReaderRequest,
  type ZlozReviewReaderState,
  type ZlozReviewReaderOptions,
} from './review-reader';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
export type ZlozReviewReaderParts = Readonly<{
  open: Html | null;
  status: Html | null;
  summary: Html | null;
  selection: Html | null;
  findings: Html | null;
  cancel: Html | null;
  close: Html | null;
}>;
export type ZlozReviewReaderViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  idPrefix?: string;
  instructions?: boolean;
  showCounts?: boolean;
  renderFinding?: (
    finding: ZlozReviewPacketDiagnostic,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderSummary?: (state: ZlozReviewReaderState, h: HtmlBuilder<M>) => Html | null | undefined;
  renderLayout?: (parts: ZlozReviewReaderParts, h: HtmlBuilder<M>) => readonly Html[];
}>;
/** Native/composable read-only reader controls; file IO and canvas ownership stay with the host. */
export function zlozReviewReader<M>(
  h: HtmlBuilder<M>,
  state: ZlozReviewReaderState,
  onRequest: (request: ZlozReviewReaderRequest) => M,
  onFiles: (files: readonly File[]) => M,
  policy: ZlozReviewReaderOptions = {},
  options: ZlozReviewReaderViewOptions<M> = {},
): Html {
  const context = resolveReviewReader(state, policy),
    id = options.idPrefix ?? 'zloz-review-reader';
  const open = h.label(
    [h.For(`${id}-file`)],
    [
      'Open review packet',
      h.input([
        h.Id(`${id}-file`),
        h.Type('file'),
        h.Accept('.json,application/json'),
        h.Disabled(context.openReason !== null),
        h.OnFileChange(onFiles),
      ]),
    ],
  );
  const status = h.p(
    [h.Role('status'), h.AriaLive('polite')],
    [context.openReason ?? state.notice],
  );
  const cancel = state.pending
    ? h.button(
        [
          h.Type('button'),
          h.OnClick(
            onRequest({ scope: state.scope, type: 'ReadCancelled', run: state.pending.run }),
          ),
        ],
        ['Cancel packet read'],
      )
    : null;
  const review = state.review;
  const customSummary = options.renderSummary?.(state, h);
  const summary =
    customSummary === undefined
      ? review
        ? h.div(
            [],
            [
              h.strong([], [review.packet.model.name]),
              h.p([], ['Read-only packet · ', review.name]),
              h.p([], [`Audit: ${review.packet.comparison.status}`]),
              ...(options.showCounts === false
                ? []
                : [
                    h.p(
                      [h.DataAttribute('review-reader-counts', '')],
                      [
                        `${review.packet.comparison.summary.introduced} introduced · ${review.packet.comparison.summary.resolved} resolved · ${review.packet.comparison.summary.persisting} persisting`,
                      ],
                    ),
                  ]),
            ],
          )
        : null
      : customSummary;
  const selection = review
    ? h.div(
        [h.Role('group'), h.AriaLabel('Packet snapshot')],
        [
          ...(['baseline', 'selected'] as const).map((side) =>
            h.button(
              [
                h.Type('button'),
                h.AriaPressed(String(review.side === side)),
                h.Disabled(context.sideReason !== null),
                h.OnClick(
                  onRequest({
                    scope: state.scope,
                    type: 'SideSelected',
                    reviewId: review.id,
                    side,
                  }),
                ),
              ],
              [
                side === 'baseline'
                  ? `Baseline: ${review.packet.baseline.source.name}`
                  : `Selected: ${review.packet.selected.source.kind === 'current' ? 'Current graph' : review.packet.selected.source.name}`,
              ],
            ),
          ),
          ...(context.sideReason ? [h.p([], [context.sideReason])] : []),
        ],
      )
    : null;
  const findings = review
    ? h.div(
        [h.AriaLabel('Packet findings')],
        [
          ...review.packet.comparison.introduced.map((f) =>
            h.p([], [`Introduced · ${f.edgeId}: ${f.message}`]),
          ),
          ...review.packet.comparison.resolved.map((f) =>
            h.p([], [`Resolved · ${f.edgeId}: ${f.message}`]),
          ),
          ...review.packet.comparison.persisting.map((f) =>
            h.p([], [`Persisting · ${f.after.edgeId}: ${f.after.message}`]),
          ),
          h.ul(
            [h.AriaLabel('Packet projection findings')],
            review.packet.diagnostics.flatMap((f) => {
              const custom = options.renderFinding?.(f, h);
              return custom === null
                ? []
                : [custom ?? h.li([], [`${f.side} · ${f.code}: ${f.message}`])];
            }),
          ),
        ],
      )
    : null;
  const close = review
    ? h.button(
        [
          h.Type('button'),
          h.OnClick(onRequest({ scope: state.scope, type: 'ReviewClosed', reviewId: review.id })),
        ],
        ['Close packet review'],
      )
    : null;
  const parts = { open, status, summary, selection, findings, cancel, close };
  return h.div(
    [h.DataAttribute('review-reader', ''), ...(options.attributes ?? [])],
    [
      ...(options.instructions === false
        ? []
        : [
            h.p(
              [],
              ['Open a portable packet for inspection. Reading never imports or edits your model.'],
            ),
          ]),
      ...(options.renderLayout?.(parts, h) ??
        [open, status, cancel, summary, selection, close, findings].flatMap((part) =>
          part === null ? [] : [part],
        )),
    ],
  );
}
