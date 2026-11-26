import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { ZlozDiagnostics } from './diagnostics';
import type { ZlozPngReviewControls, ZlozPngReviewRequest } from './png-export';
import type { ZlozSvgReviewControls, ZlozSvgReviewRequest } from './svg-review';

type Settings = ZlozSvgReviewControls['preferences'];
type Finding = Pick<ZlozSvgReviewControls['findings'][number], 'severity' | 'target' | 'reason'>;
type Options<M> = Readonly<{
  idPrefix: string;
  diagnostics?: Pick<ZlozDiagnostics, 'instructions' | 'measurements'>;
  download?: Readonly<{ label: string; className: string }>;
  renderFinding?: (finding: Finding, h: Html.H<M>) => View.Content<M>;
}>;

const fields = [
  { key: 'regionId', label: 'region', entries: 'regions' },
  { key: 'themeId', label: 'theme', entries: 'themes' },
  { key: 'backgroundId', label: 'background', entries: 'backgrounds' },
] as const;

function settings<M>(
  h: Html.H<M>,
  prefix: string,
  kind: 'SVG' | 'PNG',
  svg: ZlozSvgReviewControls,
  change: (preferences: Settings) => M,
) {
  return fields.map(({ key, label, entries }) => {
    const id = `${prefix}-${key}`;
    const selected = svg.preferences[key];
    const choices = svg[entries];
    return h.div(
      h.label.attr('for', id).children(`${kind} ${label}`),
      h.select
        .id(id)
        .attr('data-zloz-svg-setting', key)
        .on('change', ({ value }) => change({ ...svg.preferences, [key]: value }))
        .children(
          ...(choices.some((entry) => entry.id === selected)
            ? []
            : [
                h.option
                  .attr('value', selected)
                  .selected(true)
                  .children('Unavailable — choose an option'),
              ]),
          ...choices.map(({ id, label }) =>
            h.option
              .attr('value', id)
              .selected(id === selected)
              .children(label),
          ),
        ),
    );
  });
}

function reviewImage<M>(h: Html.H<M>, kind: 'SVG' | 'PNG', src: string) {
  return h.img
    .attr('alt', `${kind} export preview`)
    .attr('src', src)
    .attr(`data-zloz-${kind.toLowerCase()}-preview`, '')
    .style({
      display: 'block',
      width: '100%',
      height: 'auto',
      maxHeight: '200px',
      objectFit: 'contain',
      border: '1px solid var(--rule, #94a3b8)',
    });
}

function reviewFindings<M>(
  h: Html.H<M>,
  kind: 'SVG' | 'PNG',
  findings: ReadonlyArray<Finding>,
  renderFinding: Options<M>['renderFinding'],
) {
  return h.ul
    .attr('aria-label', `${kind} findings`)
    .style({ paddingLeft: '18px', overflowWrap: 'anywhere' })
    .children(
      ...findings.map((finding) =>
        renderFinding
          ? renderFinding(finding, h)
          : h.li
              .style({ marginBottom: '8px' })
              .children(
                h.strong(
                  `${finding.severity} · ${finding.target.kind}${'id' in finding.target ? ` ${finding.target.id}` : ''}: `,
                ),
                finding.reason,
              ),
      ),
    );
}

function acknowledgement<M>(
  h: Html.H<M>,
  kind: 'SVG' | 'PNG',
  accepted: boolean,
  disabled: boolean,
  change: (accepted: boolean) => M,
) {
  return h.label(
    h.input
      .attr('type', 'checkbox')
      .checked(accepted)
      .disabled(disabled)
      .attr(`data-zloz-${kind.toLowerCase()}-loss-acceptance`, '')
      .on('change', ({ checked }) => change(checked)),
    `Accept the reported ${kind} losses`,
  );
}

/** Review an inert image and send source-bound requests through the existing SVG controller. */
export function svgReview<M>(
  h: Html.H<M>,
  context: ZlozSvgReviewControls,
  request: (event: ZlozSvgReviewRequest) => M,
  options: Options<M>,
) {
  const { identity, result, findings, downloadReason } = context;
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'SVG export review')
    .attr('data-zloz-svg-review', '')
    .style({ display: 'grid', gap: '8px' })
    .children(
      ...(options.diagnostics?.instructions === false
        ? []
        : [
            h.p(
              'Review the canonical-model export and its findings. Loss acceptance applies only to this artifact.',
            ),
          ]),
      ...settings(h, options.idPrefix, 'SVG', context, (preferences) =>
        request({ ...identity, type: 'SvgSettingsChanged', preferences }),
      ),
      ...(result?.type === 'written'
        ? [
            reviewImage(
              h,
              'SVG',
              `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`,
            ),
          ]
        : []),
      h.p.attr('role', 'status').children(downloadReason ?? 'SVG is ready to download.'),
      reviewFindings(h, 'SVG', findings, options.renderFinding),
      ...(context.hasLosses
        ? [
            acknowledgement(
              h,
              'SVG',
              context.accepted,
              result?.type !== 'written' || context.busy,
              (accepted) => request({ ...identity, type: 'SvgLossAcceptanceChanged', accepted }),
            ),
          ]
        : []),
      h.button
        .attr('type', 'button')
        .attr('data-zloz-svg-download', '')
        .class(options.download?.className ?? '')
        .attr('title', downloadReason ?? `Download ${context.fileName}`)
        .disabled(downloadReason !== null)
        .on('click', request({ ...identity, type: 'SvgDownloadRequested' }))
        .children(options.download?.label ?? 'Download SVG'),
      ...(options.diagnostics?.measurements === false
        ? []
        : [
            h.p
              .attr('data-zloz-svg-readout', '')
              .children(
                result?.type === 'written'
                  ? `${context.fileName} · ${result.plan.size.width} × ${result.plan.size.height} · ${findings.length} findings`
                  : context.fileName,
              ),
          ]),
    );
}

/** Review the actual rendered PNG. The host owns rendering and downloading the reviewed bytes. */
export function pngReview<M>(
  h: Html.H<M>,
  context: ZlozPngReviewControls,
  request: (event: ZlozPngReviewRequest) => M,
  options: Options<M>,
) {
  const { identity, svg, plan, artifact, busy, downloadReason } = context;
  const scaleId = `${options.idPrefix}-scale`;
  const change = (preferences: Settings) =>
    request({ ...identity, type: 'PngSettingsChanged', preferences });
  const action = (label: string, kind: string, message: M, reason: string | null) =>
    h.button
      .attr('type', 'button')
      .attr('data-zloz-png-action', kind)
      .class(kind === 'download' ? (options.download?.className ?? '') : '')
      .attr('title', reason ?? label)
      .disabled(reason !== null)
      .on('click', message)
      .children(label);
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'PNG export review')
    .attr('data-zloz-png-review', '')
    .attr('data-zloz-png-generation', String(identity.generation))
    .style({ display: 'grid', gap: '8px' })
    .children(
      ...(options.diagnostics?.instructions === false
        ? []
        : [
            h.p(
              'Render canonical model artwork, review the actual PNG, then download the same bytes.',
            ),
          ]),
      ...settings(h, options.idPrefix, 'PNG', svg, change),
      h.div(
        h.label.attr('for', scaleId).children('PNG scale'),
        h.select
          .id(scaleId)
          .on('change', ({ value }) => change({ ...svg.preferences, scale: Number(value) }))
          .children(
            ...Array.from(new Set([1, 2, 3, svg.preferences.scale]), (scale) =>
              h.option
                .attr('value', String(scale))
                .selected(scale === svg.preferences.scale)
                .children(`${scale}×`),
            ),
          ),
      ),
      ...(artifact ? [reviewImage(h, 'PNG', artifact.dataUrl)] : []),
      h.p
        .attr('role', 'status')
        .children(busy ? 'Rendering PNG…' : (downloadReason ?? 'PNG is ready to download.')),
      reviewFindings(h, 'PNG', context.findings, options.renderFinding),
      acknowledgement(h, 'PNG', context.accepted, plan?.type !== 'ready' || busy, (accepted) =>
        request({ ...identity, type: 'PngLossAcceptanceChanged', accepted }),
      ),
      busy
        ? action(
            'Cancel PNG render',
            'cancel',
            request({ ...identity, type: 'PngRenderCancelled' }),
            null,
          )
        : action(
            'Render PNG',
            'render',
            request({ ...identity, type: 'PngRenderRequested' }),
            context.renderReason,
          ),
      action(
        options.download?.label ?? 'Download PNG',
        'download',
        request({ ...identity, type: 'PngDownloadRequested' }),
        downloadReason,
      ),
      ...(options.diagnostics?.measurements === false
        ? []
        : [
            h.p
              .attr('data-zloz-png-readout', '')
              .children(
                plan
                  ? `${plan.width} × ${plan.height}${artifact ? ` · ${artifact.byteLength} bytes` : ''}`
                  : context.fileName,
              ),
          ]),
    );
}
