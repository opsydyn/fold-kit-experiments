import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { ZlozReviewPacketDiagnostic } from './review-packet';
import type {
  ZlozReviewPacketControlsContext,
  ZlozReviewPacketRequest,
} from './review-packet-controls';

type Request<M> = (request: ZlozReviewPacketRequest) => M;
type Part<M> = View.Content<M> | null;
type RenderPart<M> = (
  context: ZlozReviewPacketControlsContext,
  h: Html.H<M>,
  request: Request<M>,
) => Part<M> | undefined;

export type ReviewPacketParts<M> = Readonly<{
  scope: Part<M>;
  diagnostics: readonly View.Content<M>[];
  consent: Part<M>;
  download: Part<M>;
  reason: Part<M>;
  status: Part<M>;
}>;
export type ReviewPacketOptions<M> = Readonly<{
  attributes?: Readonly<Record<string, string>>;
  label?: string;
  showStatus?: boolean;
  showCounts?: boolean;
  scopeHeading?: string;
  scopeLabel?: string;
  diagnosticsDisclosure?: string;
  diagnosticsLabel?: string;
  consentLabel?: string;
  downloadLabel?: string;
  reasonLabel?: string;
  statusLabel?: string;
  renderScope?: RenderPart<M>;
  renderConsent?: RenderPart<M>;
  renderDownload?: RenderPart<M>;
  renderReason?: RenderPart<M>;
  renderStatus?: RenderPart<M>;
  renderDiagnostic?: (item: ZlozReviewPacketDiagnostic, h: Html.H<M>) => Part<M> | undefined;
  renderLayout?: (
    parts: ReviewPacketParts<M>,
    context: ZlozReviewPacketControlsContext,
    h: Html.H<M>,
  ) => readonly (View.Content<M> | string | null | undefined)[];
}>;

export function reviewPacketConsent<M>(
  h: Html.H<M>,
  { key, reason, requiresConsent, consented }: ZlozReviewPacketControlsContext,
  request: Request<M>,
  label = 'Allow reported projection losses for this packet',
) {
  return h.input
    .attr('type', 'checkbox')
    .attr('aria-label', label)
    .attr('aria-description', reason ?? undefined)
    .checked(consented)
    .disabled(!requiresConsent || reason !== null || key === null)
    .on('change', ({ checked }) =>
      requiresConsent && key !== null && reason === null
        ? request({ type: 'ConsentChanged', key, accepted: checked })
        : undefined,
    );
}

export function reviewPacketDownload<M>(
  h: Html.H<M>,
  { key, downloadReason }: ZlozReviewPacketControlsContext,
  request: Request<M>,
  label = 'Download review packet',
) {
  return h.button
    .attr('type', 'button')
    .attr('aria-description', downloadReason ?? undefined)
    .attr('title', downloadReason ?? undefined)
    .disabled(downloadReason !== null || key === null)
    .on('click', () =>
      key !== null && downloadReason === null
        ? request({ type: 'DownloadClicked', key })
        : undefined,
    )
    .children(label);
}

/** Render a portable review export. The host owns consent validation and downloading. */
export function reviewPacket<M>(
  h: Html.H<M>,
  context: ZlozReviewPacketControlsContext,
  request: Request<M>,
  options: ReviewPacketOptions<M> = {},
) {
  const { reason, downloadReason, requiresConsent } = context;
  const consentLabel = options.consentLabel ?? 'Allow reported projection losses for this packet';
  const part = (render: RenderPart<M> | undefined, fallback: Part<M>) => {
    const custom = render?.(context, h, request);
    return custom === undefined ? fallback : custom;
  };
  const losses = context.diagnostics.filter((item) => item.severity === 'loss').length;
  const status = requiresConsent
    ? options.showCounts === false
      ? 'Mermaid projections have reported losses.'
      : `${losses} reported projection losses.`
    : 'No reported projection losses.';
  const parts: ReviewPacketParts<M> = {
    scope: part(
      options.renderScope,
      h.div.children(
        options.scopeHeading ? h.strong.children(options.scopeHeading) : null,
        h.p
          .attr('aria-label', options.scopeLabel ?? 'Review packet scope')
          .children(context.scopeText),
      ),
    ),
    status: part(
      options.renderStatus,
      options.showStatus === false
        ? null
        : h.p
            .attr('role', 'status')
            .attr('aria-live', 'polite')
            .attr('aria-label', options.statusLabel ?? 'Review packet status')
            .children(reason ?? status),
    ),
    diagnostics: context.diagnostics.flatMap((item) => {
      const custom = options.renderDiagnostic?.(item, h);
      if (custom === null) return [];
      const subject = item.subject ? `${item.subject}: ` : '';
      return [
        custom ?? h.li.children(`${item.side} · ${item.severity}: ${subject}${item.message}`),
      ];
    }),
    consent: part(
      options.renderConsent,
      requiresConsent
        ? h.label.children(reviewPacketConsent(h, context, request, consentLabel), consentLabel)
        : null,
    ),
    reason: part(
      options.renderReason,
      downloadReason
        ? h.p
            .attr('aria-label', options.reasonLabel ?? 'Review packet availability')
            .children(downloadReason)
        : null,
    ),
    download: part(
      options.renderDownload,
      reviewPacketDownload(h, context, request, options.downloadLabel),
    ),
  };
  const list = parts.diagnostics.length
    ? h.ul
        .attr('aria-label', options.diagnosticsLabel ?? 'Review packet diagnostics')
        .children(...parts.diagnostics)
    : null;
  const diagnostics =
    list && options.diagnosticsDisclosure
      ? h.details.children(
          h.summary.children(options.diagnosticsDisclosure),
          list.style({ maxHeight: '220px', overflow: 'auto', padding: '0', margin: '8px 0' }),
        )
      : list;
  return h.section
    .attrs(options.attributes ?? {})
    .attr('aria-label', options.label ?? 'Review packet export')
    .children(
      ...(options.renderLayout?.(parts, context, h) ?? [
        parts.scope,
        parts.status,
        diagnostics,
        parts.consent,
        parts.reason,
        parts.download,
      ]),
    );
}
