import { type ZlozPngReviewControls, type ZlozSvgReviewControls } from '@opsydyn/foldkit-zloz';
import { pngReview, svgReview } from '@opsydyn/foldkit-zloz/effect-ui';
import type { ZlozDiagnostics } from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';

import { Message as WorkbenchMessage } from './message';
import { architectureNativePanel } from './native-panel';

type Review = Readonly<{
  diagnostics: ZlozDiagnostics;
  custom: boolean;
}> &
  (
    | Readonly<{ kind: 'svg'; controls: ZlozSvgReviewControls }>
    | Readonly<{ kind: 'png'; controls: ZlozPngReviewControls }>
  );

const ReviewRequest = Schema.Union([
  WorkbenchMessage.cases.ObservedSvgReviewInput,
  WorkbenchMessage.cases.ObservedPngReviewInput,
]);
const customDownload = 'native-export-custom-download';
const renderPanel = architectureNativePanel<Review>(
  'ArchitectureExportReview',
  Schema.is(ReviewRequest),
  (h, review, requestMessage) => {
    const { diagnostics, custom } = review;
    if (review.kind === 'svg') {
      return svgReview(
        h,
        review.controls,
        (request) => requestMessage(WorkbenchMessage.ObservedSvgReviewInput({ request })),
        custom
          ? {
              idPrefix: 'zloz-svg-review',
              diagnostics,
              download: { label: '↓ Download reviewed SVG', className: customDownload },
              renderFinding: (finding, builder) =>
                builder.li
                  .class('svg-finding-card')
                  .children(
                    builder.strong(
                      `${finding.severity.toUpperCase()} · ${finding.target.kind}${'id' in finding.target ? ` ${finding.target.id}` : ''}`,
                    ),
                    builder.p(finding.reason),
                  ),
            }
          : { idPrefix: 'zloz-svg-review', diagnostics },
      );
    }
    return pngReview(
      h,
      review.controls,
      (request) => requestMessage(WorkbenchMessage.ObservedPngReviewInput({ request })),
      custom
        ? {
            idPrefix: 'zloz-png-review',
            diagnostics,
            download: { label: '↓ Save reviewed PNG', className: customDownload },
          }
        : { idPrefix: 'zloz-png-review', diagnostics },
    );
  },
);

export function exportReviewPanel(h: HtmlBuilder<WorkbenchMessage>, review: Review) {
  return renderPanel(h, review, 'architecture-effect-ui-review', review.kind);
}
