import type { Html } from '@effect/ui/html';
import { type ZlozPngReviewControls, type ZlozSvgReviewControls } from '@opsydyn/foldkit-zloz';
import { pngReview, svgReview } from '@opsydyn/foldkit-zloz/effect-ui';
import type { ZlozDiagnostics } from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';

import { historyAllowsMessage } from './history';
import { Message as WorkbenchMessage } from './message';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';

type Review = Readonly<{
  diagnostics: ZlozDiagnostics;
  custom: boolean;
  retained: boolean;
  hasRoutes: boolean;
  downloadProtected: boolean;
  reviewing: boolean;
}> &
  (
    | Readonly<{ kind: 'svg'; controls: ZlozSvgReviewControls }>
    | Readonly<{ kind: 'png'; controls: ZlozPngReviewControls }>
  );

const ReviewRequest = Schema.Union([
  WorkbenchMessage.cases.ObservedSvgReviewInput,
  WorkbenchMessage.cases.ObservedPngReviewInput,
  WorkbenchMessage.cases.ClickedRetainedSvgLayout,
  WorkbenchMessage.cases.ClickedRetainedPngLayout,
  WorkbenchMessage.cases.ClickedSvgDownloadProtection,
  WorkbenchMessage.cases.ClickedPngProtection,
  WorkbenchMessage.cases.ClickedCustomSvgReview,
  WorkbenchMessage.cases.ClickedCustomPngReview,
]);
const customDownload = 'native-export-custom-download';

const reviewSettings = {
  svg: {
    format: 'SVG',
    retained: WorkbenchMessage.ClickedRetainedSvgLayout(),
    protect: WorkbenchMessage.ClickedSvgDownloadProtection(),
    customize: WorkbenchMessage.ClickedCustomSvgReview(),
    protectionLabel: 'Protect SVG downloads',
    canonical: 'Canonical SVG geometry is selected.',
    routed: 'Retained routes are included. Label artwork remains subject to fidelity findings.',
  },
  png: {
    format: 'PNG',
    retained: WorkbenchMessage.ClickedRetainedPngLayout(),
    protect: WorkbenchMessage.ClickedPngProtection(),
    customize: WorkbenchMessage.ClickedCustomPngReview(),
    protectionLabel: 'Protect PNG exports',
    canonical: 'Canonical PNG geometry is selected. SVG has its own setting.',
    routed: 'Retained routes are included. PNG still flattens vector and label artwork.',
  },
} as const;

function exportArtworkReview<M>(
  h: Html.H<M>,
  review: Review,
  requestMessage: (message: WorkbenchMessage) => M,
) {
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
}

const renderPanel = architectureNativePanel<Review>(
  'ArchitectureExportReview',
  Schema.is(ReviewRequest),
  (h, review, request) => {
    const settings = reviewSettings[review.kind];
    const unavailable = (message: WorkbenchMessage) =>
      review.reviewing && !historyAllowsMessage(message);
    const layoutNote = !review.retained
      ? settings.canonical
      : review.hasRoutes
        ? settings.routed
        : 'Arrange with ELK before reviewing retained routes.';
    return h.div.children(
      review.kind === 'svg'
        ? h.p.children('Canonical model artwork, with visible portability and fidelity findings.')
        : null,
      h.label.children(
        settingCheckbox(
          h,
          review.retained,
          request(settings.retained),
          unavailable(settings.retained),
        ),
        `Use retained layout in ${settings.format}`,
      ),
      h.p.children(layoutNote),
      h.label.children(
        settingCheckbox(
          h,
          review.downloadProtected,
          request(settings.protect),
          unavailable(settings.protect),
        ),
        settings.protectionLabel,
      ),
      h.button
        .attr('type', 'button')
        .style({ padding: '10px 16px', cursor: 'pointer' })
        .disabled(unavailable(settings.customize))
        .on('click', request(settings.customize))
        .children(`Use ${review.custom ? 'native' : 'custom'} ${settings.format} controls`),
      exportArtworkReview(h, review, request),
    );
  },
);

export function exportReviewPanel(h: HtmlBuilder<WorkbenchMessage>, review: Review) {
  return renderPanel(h, review, 'architecture-effect-ui-review', review.kind);
}
