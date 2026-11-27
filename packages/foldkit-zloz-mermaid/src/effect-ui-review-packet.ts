import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { ZlozReviewPacketDiagnostic } from './review-packet';
import type {
  ZlozReviewPacketControlsContext,
  ZlozReviewPacketRequest,
} from './review-packet-controls';

/** Render a portable review export. The host owns consent validation and downloading. */
export function reviewPacket<M>(
  h: Html.H<M>,
  context: ZlozReviewPacketControlsContext,
  onRequest: (request: ZlozReviewPacketRequest) => M,
  options: Readonly<{
    showStatus?: boolean;
    scopeHeading?: string;
    diagnosticsDisclosure?: string;
    renderDiagnostic?: (item: ZlozReviewPacketDiagnostic, h: Html.H<M>) => View.Content<M>;
  }> = {},
) {
  const { key, reason, downloadReason, requiresConsent } = context;
  const consentLabel = 'Allow reported projection losses for this packet';
  const diagnostics = context.diagnostics.length
    ? h.ul
        .attr('aria-label', 'Review packet diagnostics')
        .children(
          ...context.diagnostics.map(
            (item) =>
              options.renderDiagnostic?.(item, h) ??
              h.li.children(
                `${item.side} · ${item.severity}: ${item.subject ? `${item.subject}: ` : ''}${item.message}`,
              ),
          ),
        )
    : null;
  return h.section.attr('aria-label', 'Review packet export').children(
    h.div.children(
      options.scopeHeading ? h.strong.children(options.scopeHeading) : null,
      h.p.attr('aria-label', 'Review packet scope').children(context.scopeText),
    ),
    options.showStatus === false
      ? null
      : h.p
          .attr('role', 'status')
          .attr('aria-live', 'polite')
          .attr('aria-label', 'Review packet status')
          .children(
            reason ??
              (requiresConsent
                ? `${context.diagnostics.filter((item) => item.severity === 'loss').length} reported projection losses.`
                : 'No reported projection losses.'),
          ),
    diagnostics && options.diagnosticsDisclosure
      ? h.details.children(
          h.summary.children(options.diagnosticsDisclosure),
          diagnostics.style({
            maxHeight: '220px',
            overflow: 'auto',
            padding: '0',
            margin: '8px 0',
          }),
        )
      : diagnostics,
    requiresConsent
      ? h.label.children(
          h.input
            .attr('type', 'checkbox')
            .attr('aria-label', consentLabel)
            .attr('aria-description', reason ?? undefined)
            .checked(context.consented)
            .disabled(reason !== null || key === null)
            .on('change', ({ checked }) =>
              key !== null && reason === null
                ? onRequest({ type: 'ConsentChanged', key, accepted: checked })
                : undefined,
            ),
          consentLabel,
        )
      : null,
    downloadReason
      ? h.p.attr('aria-label', 'Review packet availability').children(downloadReason)
      : null,
    h.button
      .attr('type', 'button')
      .attr('aria-description', downloadReason ?? undefined)
      .attr('title', downloadReason ?? undefined)
      .disabled(downloadReason !== null || key === null)
      .on('click', () =>
        key !== null && downloadReason === null
          ? onRequest({ type: 'DownloadClicked', key })
          : undefined,
      )
      .children('Download review packet'),
  );
}
