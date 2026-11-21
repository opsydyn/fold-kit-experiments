import { serializeGraph, upgradeGroupDocumentV3, type ZlozGraph } from '@opsydyn/foldkit-zloz';
import { exportMermaid } from '@opsydyn/foldkit-zloz-mermaid';
import { Option, Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import { defineTaggedUnion } from 'foldkit/schema';

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
export const Review = defineTaggedUnion({
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
  h: HtmlBuilder<M>,
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
    h.button([h.Type('button'), h.Disabled(disabled), h.OnClick(action)], [label]);
  const name = label(review.kind);
  const diagnostics = review._tag === 'Loading' ? [] : review.diagnostics;
  const current = availability === 'current';
  const downloads = review._tag === 'Ready';
  const allowDownload = current && downloads && (review.accepted || diagnostics.length === 0);
  return h.div(
    [
      h.Id('board-mermaid'),
      h.Class('board-mermaid'),
      h.Role('region'),
      h.AriaLabel(`${name} export preview`),
      h.Tabindex(-1),
      h.OnKeyDownPreventDefault((key) =>
        key === 'Escape' ? Option.some(actions.close) : Option.none(),
      ),
    ],
    [
      h.div(
        [h.Class('mermaid-review-header')],
        [
          h.div(
            [],
            [h.h2([], [`${name} export`]), h.p([], [`Confirmed version ${review.version}`])],
          ),
          button(`Close ${name} preview`, actions.close),
        ],
      ),
      h.div(
        [h.Class('mermaid-review-body')],
        [
          h.p(
            [h.Role('status')],
            [
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
            ],
          ),
          ...(availability === 'newer' ? [button('Review latest version', actions.refresh)] : []),
          ...(diagnostics.length
            ? [
                h.h3([], ['Conversion diagnostics']),
                h.ul(
                  [h.AriaLabel(`${name} conversion diagnostics`)],
                  diagnostics.map((item, index) =>
                    h.li(
                      [h.Key(String(index))],
                      [
                        `${item.severity === 'error' ? 'Error' : 'Loss'} · ${item.subject === null ? '' : `${item.subject} · `}${item.message}`,
                      ],
                    ),
                  ),
                ),
              ]
            : []),
          ...(downloads
            ? [
                h.h3([], [`${name} source`]),
                ...(review.kind === 'mermaid'
                  ? [h.p([], ['The bundle includes Zloz identifiers and conversion diagnostics.'])]
                  : [
                      h.p(
                        [],
                        [
                          'The LikeC4 file omits shared assessments, decisions and board appearance.',
                        ],
                      ),
                    ]),
                h.pre([h.AriaLabel(`${name} source`), h.Tabindex(0)], [review.source]),
              ]
            : []),
        ],
      ),
      ...(downloads
        ? [
            h.div(
              [h.Class('mermaid-review-footer')],
              [
                ...(diagnostics.length
                  ? [
                      h.label(
                        [h.Class('mermaid-consent')],
                        [
                          h.input([
                            h.Type('checkbox'),
                            h.Checked(current && review.accepted),
                            h.Disabled(!current),
                            h.OnClick(actions.accept(!review.accepted)),
                          ]),
                          'Allow reported conversion losses',
                        ],
                      ),
                    ]
                  : []),
                h.div(
                  [h.Class('mermaid-download-actions')],
                  [
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
                  ],
                ),
                ...(current && review.download !== 'idle'
                  ? [
                      h.p(
                        [h.Role('status')],
                        [
                          review.download === 'started'
                            ? 'Download started.'
                            : `Could not start the ${name} download. Try again.`,
                        ],
                      ),
                    ]
                  : []),
              ],
            ),
          ]
        : []),
    ],
  );
}
