import type { ZlozGraph } from '@opsydyn/foldkit-zloz';
import { exportMermaid } from '@opsydyn/foldkit-zloz-mermaid';
import { Option, Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import { defineTaggedUnion } from 'foldkit/schema';

export const Format = Schema.Literals(['source', 'bundle']);
const details = {
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

export function prepare(graph: ZlozGraph, version: number): Review {
  const projection = exportMermaid(graph, { lossPolicy: 'report' });
  const review = { version, diagnostics: projection.diagnostics };
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
  const current = availability === 'current';
  const downloads = review._tag === 'Ready';
  const allowDownload =
    current && downloads && (review.accepted || review.diagnostics.length === 0);
  return h.div(
    [
      h.Id('board-mermaid'),
      h.Class('board-mermaid'),
      h.Role('region'),
      h.AriaLabel('Mermaid export preview'),
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
            [h.h2([], ['Mermaid export']), h.p([], [`Confirmed version ${review.version}`])],
          ),
          button('Close Mermaid preview', actions.close),
        ],
      ),
      h.div(
        [h.Class('mermaid-review-body')],
        [
          h.p(
            [h.Role('status')],
            [
              availability === 'offline'
                ? 'Reconnect to review or download Mermaid.'
                : availability === 'newer'
                  ? 'A newer confirmed version is available.'
                  : downloads
                    ? review.diagnostics.length
                      ? `${review.diagnostics.length} reported conversion losses.`
                      : 'No reported conversion losses.'
                    : 'The SDK could not convert this version.',
            ],
          ),
          ...(availability === 'newer' ? [button('Review latest version', actions.refresh)] : []),
          ...(review.diagnostics.length
            ? [
                h.h3([], ['Conversion diagnostics']),
                h.ul(
                  [h.AriaLabel('Mermaid conversion diagnostics')],
                  review.diagnostics.map((item, index) =>
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
                h.h3([], ['Mermaid source']),
                h.p([], ['The bundle includes Zloz identifiers and conversion diagnostics.']),
                h.pre([h.AriaLabel('Mermaid source'), h.Tabindex(0)], [review.source]),
              ]
            : []),
        ],
      ),
      ...(downloads
        ? [
            h.div(
              [h.Class('mermaid-review-footer')],
              [
                ...(review.diagnostics.length
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
                    button('Download Mermaid source', actions.download('source'), !allowDownload),
                    button('Download Mermaid bundle', actions.download('bundle'), !allowDownload),
                  ],
                ),
                ...(current && review.download !== 'idle'
                  ? [
                      h.p(
                        [h.Role('status')],
                        [
                          review.download === 'started'
                            ? 'Download started.'
                            : 'Could not start the Mermaid download. Try again.',
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
