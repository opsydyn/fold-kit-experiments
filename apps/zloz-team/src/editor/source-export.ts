import { UiSchema } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { serializeGraph, upgradeGroupDocumentV3, type ZlozGraph } from '@opsydyn/foldkit-zloz';
import { exportMermaid } from '@opsydyn/foldkit-zloz-mermaid';
import { Schema } from 'effect';

export const Kind = Schema.Literals(['mermaid', 'likec4']);
export type Kind = typeof Kind.Type;
export const Format = Schema.Literals(['source', 'bundle']);
const details = {
  kind: Kind,
  version: Schema.Number,
  diagnostics: Schema.Array(
    Schema.Struct({
      severity: Schema.Literals(['loss', 'error']),
      message: Schema.String,
      subject: Schema.NullOr(Schema.String),
    }),
  ),
};
export const Review = UiSchema.TaggedEnum({
  Loading: { kind: Kind, version: Schema.Number, run: Schema.Number },
  Rejected: details,
  Ready: {
    ...details,
    source: Schema.String,
    bundle: Schema.String,
    accepted: Schema.Boolean,
    download: Schema.Literals(['idle', 'started', 'failed']),
  },
});
export type Review = typeof Review.Type;
export type Availability = 'current' | 'newer' | 'offline';

export function prepareMermaid(graph: ZlozGraph, version: number): Review {
  const projection = exportMermaid(graph, { lossPolicy: 'report' });
  const review = { kind: 'mermaid' as const, version, diagnostics: projection.diagnostics };
  return projection.status === 'rejected'
    ? Review.Rejected(review)
    : Review.Ready({
        ...review,
        source: projection.value.source,
        bundle: JSON.stringify(projection.value, null, 2),
        accepted: false,
        download: 'idle',
      });
}

export async function prepareLikeC4(graph: ZlozGraph, version: number): Promise<Review> {
  // oxlint-disable-next-line linteffect/prevent-dynamic-imports -- Load the generator only when a review is requested.
  const { exportLikeC4 } = await import('../likec4/export.mjs');
  const document = upgradeGroupDocumentV3(JSON.parse(serializeGraph(graph)));
  const projection = await exportLikeC4(document, { lossPolicy: 'report' });
  const review = { kind: 'likec4' as const, version };
  return projection.status === 'rejected'
    ? Review.Rejected({ ...review, diagnostics: projection.diagnostics })
    : Review.Ready({
        ...review,
        diagnostics: projection.value.diagnostics,
        source: projection.value.source,
        bundle: '',
        accepted: false,
        download: 'idle',
      });
}

export const launcherId = (kind: Kind) => `board-${kind}-open`;
export const label = (kind: Kind) => (kind === 'likec4' ? 'LikeC4' : 'Mermaid');

export function view<M>(
  h: Html.H<M>,
  review: Review,
  availability: Availability,
  actions: Readonly<{
    close: M;
    refresh: M;
    accept: (accepted: boolean) => M;
    download: (format: typeof Format.Type) => M;
  }>,
) {
  const button = (label: string, action: M, disabled = false) =>
    h.button.attr('type', 'button').disabled(disabled).on('click', action).children(label);
  const name = label(review.kind);
  const diagnostics = review._tag === 'Loading' ? [] : review.diagnostics;
  const current = availability === 'current';
  const downloads = review._tag === 'Ready';
  const allowDownload = current && downloads && (review.accepted || diagnostics.length === 0);
  return h.div
    .id('board-mermaid')
    .class('board-mermaid')
    .attr('role', 'region')
    .attr('aria-label', `${name} export preview`)
    .attr('tabindex', String(-1))
    .on('keydown', ({ key }) => (key === 'Escape' ? actions.close : undefined), {
      preventDefault: true,
    })
    .children(
      h.div
        .class('mermaid-review-header')
        .children(
          h.div.children(
            h.h2.children(`${name} export`),
            h.p.children(`Confirmed version ${review.version}`),
          ),
          button(`Close ${name} preview`, actions.close),
        ),
      h.div
        .class('mermaid-review-body')
        .children(
          h.p
            .attr('role', 'status')
            .children(
              availability === 'offline'
                ? `Reconnect to review or download ${name}.`
                : availability === 'newer'
                  ? 'A newer confirmed version is available.'
                  : downloads
                    ? diagnostics.length
                      ? `${diagnostics.length} reported conversion losses.`
                      : 'No reported conversion losses.'
                    : review._tag === 'Loading'
                      ? 'Preparing LikeC4 preview…'
                      : 'The converter could not export this version.',
            ),
          ...(availability === 'newer' ? [button('Review latest version', actions.refresh)] : []),
          ...(diagnostics.length
            ? [
                h.h3.children('Conversion diagnostics'),
                h.ul
                  .attr('aria-label', `${name} conversion diagnostics`)
                  .children(
                    diagnostics.map((item, index) =>
                      h.li
                        .key(String(index))
                        .children(
                          `${item.severity === 'error' ? 'Error' : 'Loss'} · ${item.subject === null ? '' : `${item.subject} · `}${item.message}`,
                        ),
                    ),
                  ),
              ]
            : []),
          ...(downloads
            ? [
                h.h3.children(`${name} source`),
                ...(review.kind === 'mermaid'
                  ? [
                      h.p.children(
                        'The bundle includes ZLOZ identifiers and conversion diagnostics.',
                      ),
                    ]
                  : [
                      h.p.children(
                        'The LikeC4 file omits shared assessments, decisions and board appearance.',
                      ),
                    ]),
                h.pre
                  .attr('aria-label', `${name} source`)
                  .attr('tabindex', String(0))
                  .children(review.source),
              ]
            : []),
        ),
      ...(downloads
        ? [
            h.div.class('mermaid-review-footer').children(
              ...(diagnostics.length
                ? [
                    h.label.class('mermaid-consent').children(
                      h.input
                        .attr('type', 'checkbox')
                        .checked(current && review.accepted)
                        .disabled(!current)
                        .on('click', actions.accept(!review.accepted)),
                      'Allow reported conversion losses',
                    ),
                  ]
                : []),
              h.div
                .class('mermaid-download-actions')
                .children(
                  button(`Download ${name} source`, actions.download('source'), !allowDownload),
                  ...(review.kind === 'mermaid'
                    ? [
                        button(
                          'Download Mermaid bundle',
                          actions.download('bundle'),
                          !allowDownload,
                        ),
                      ]
                    : []),
                ),
              ...(current && review.download !== 'idle'
                ? [
                    h.p
                      .attr('role', 'status')
                      .children(
                        review.download === 'started'
                          ? 'Download started.'
                          : `Could not start the ${name} download. Try again.`,
                      ),
                  ]
                : []),
            ),
          ]
        : []),
    );
}
