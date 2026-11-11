/** Optional, unstyled Foldkit composition; the root adapter remains headless. @module MermaidFoldkit */
import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozReviewPacketDiagnostic } from './review-packet';
import type {
  ZlozReviewPacketControlsContext,
  ZlozReviewPacketRequest,
} from './review-packet-controls';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];
type OnRequest<M> = (request: ZlozReviewPacketRequest) => M;
export type ZlozReviewPacketParts = Readonly<{
  scope: Html | null;
  diagnostics: readonly Html[];
  consent: Html | null;
  download: Html | null;
  reason: Html | null;
  status: Html | null;
}>;
export type ZlozReviewPacketViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  showCounts?: boolean;
  scopeLabel?: string;
  diagnosticsLabel?: string;
  consentLabel?: string;
  downloadLabel?: string;
  reasonLabel?: string;
  statusLabel?: string;
  renderScope?: (
    context: ZlozReviewPacketControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderDiagnostic?: (
    item: ZlozReviewPacketDiagnostic,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderConsent?: (
    context: ZlozReviewPacketControlsContext,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderDownload?: (
    context: ZlozReviewPacketControlsContext,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderReason?: (
    context: ZlozReviewPacketControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderStatus?: (
    context: ZlozReviewPacketControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozReviewPacketParts,
    context: ZlozReviewPacketControlsContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
export function zlozReviewPacketConsent<M>(
  h: HtmlBuilder<M>,
  context: ZlozReviewPacketControlsContext,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['input']>[0] = [],
  label = 'Allow reported projection losses for this packet',
): Html {
  return h.input([
    ...attributes,
    h.Type('checkbox'),
    h.AriaLabel(label),
    h.Checked(context.consented),
    h.Disabled(context.reason !== null || !context.requiresConsent || context.key === null),
    ...(context.reason ? [h.AriaDescription(context.reason)] : []),
    h.OnClick(
      onRequest({ type: 'ConsentChanged', key: context.key ?? '', accepted: !context.consented }),
    ),
  ]);
}
export function zlozReviewPacketDownload<M>(
  h: HtmlBuilder<M>,
  context: ZlozReviewPacketControlsContext,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Children<M> = ['Download review packet'],
  label = 'Download review packet',
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.AriaLabel(label),
      h.Disabled(context.downloadReason !== null || context.key === null),
      ...(context.downloadReason
        ? [h.AriaDescription(context.downloadReason), h.Title(context.downloadReason)]
        : []),
      h.OnClick(onRequest({ type: 'DownloadClicked', key: context.key ?? '' })),
    ],
    children,
  );
}
/** Nullable slots remove parts; undefined retains accessible native defaults. Custom diagnostics own list-item semantics. */
export function zlozReviewPacketControls<M>(
  h: HtmlBuilder<M>,
  context: ZlozReviewPacketControlsContext,
  onRequest: OnRequest<M>,
  options: ZlozReviewPacketViewOptions<M> = {},
): Html {
  const scope = options.renderScope?.(context, h),
    consent = options.renderConsent?.(context, h, onRequest),
    download = options.renderDownload?.(context, h, onRequest),
    reason = options.renderReason?.(context, h),
    status = options.renderStatus?.(context, h);
  const consentLabel = options.consentLabel ?? 'Allow reported projection losses for this packet';
  const parts: ZlozReviewPacketParts = {
    scope:
      scope === undefined
        ? h.p([h.AriaLabel(options.scopeLabel ?? 'Review packet scope')], [context.scopeText])
        : scope,
    diagnostics: context.diagnostics.flatMap((item) => {
      const custom = options.renderDiagnostic?.(item, h);
      const result =
        custom === undefined
          ? h.li(
              [],
              [
                `${item.side} · ${item.severity}: ${item.subject ? `${item.subject}: ` : ''}${item.message}`,
              ],
            )
          : custom;
      return result === null ? [] : [result];
    }),
    consent:
      consent === undefined
        ? context.requiresConsent
          ? h.label(
              [],
              [zlozReviewPacketConsent(h, context, onRequest, [], consentLabel), consentLabel],
            )
          : null
        : consent,
    download:
      download === undefined
        ? zlozReviewPacketDownload(
            h,
            context,
            onRequest,
            [],
            [options.downloadLabel ?? 'Download review packet'],
            options.downloadLabel,
          )
        : download,
    reason:
      reason === undefined
        ? context.downloadReason === null
          ? null
          : h.p(
              [h.AriaLabel(options.reasonLabel ?? 'Review packet availability')],
              [context.downloadReason],
            )
        : reason,
    status:
      status === undefined
        ? h.p(
            [
              h.Role('status'),
              h.AriaLive('polite'),
              h.AriaLabel(options.statusLabel ?? 'Review packet status'),
            ],
            [
              context.reason ??
                (context.requiresConsent
                  ? options.showCounts === false
                    ? 'Mermaid projections have reported losses.'
                    : `${context.diagnostics.filter((item) => item.severity === 'loss').length} reported projection losses.`
                  : 'No reported projection losses.'),
            ],
          )
        : status,
  };
  const content = options.renderLayout?.(parts, context, h) ?? [
    ...[parts.scope, parts.status].filter((item): item is Html => item !== null),
    ...(parts.diagnostics.length
      ? [
          h.ul(
            [h.AriaLabel(options.diagnosticsLabel ?? 'Review packet diagnostics')],
            parts.diagnostics,
          ),
        ]
      : []),
    ...[parts.consent, parts.reason, parts.download].filter((item): item is Html => item !== null),
  ];
  return h.section(
    [...(options.attributes ?? []), h.AriaLabel(options.label ?? 'Review packet export')],
    content,
  );
}
