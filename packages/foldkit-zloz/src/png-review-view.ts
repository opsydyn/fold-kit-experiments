import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozDiagnostics } from './diagnostics';
import type { ZlozPngReviewControls, ZlozPngReviewRequest } from './png-export';
import { zlozSvgReviewSelect } from './svg-review-view';
type OnRequest<M> = (request: ZlozPngReviewRequest) => M;
export type ZlozPngReviewParts = Readonly<
  Record<
    | 'settings'
    | 'preview'
    | 'findings'
    | 'acceptance'
    | 'render'
    | 'download'
    | 'status'
    | 'readout',
    Html | null
  >
>;
type Slot<M> = (
  context: ZlozPngReviewControls,
  h: HtmlBuilder<M>,
  onRequest: OnRequest<M>,
) => Html | null | undefined;
export type ZlozPngReviewViewOptions<M> = Readonly<{
  attributes?: Parameters<HtmlBuilder<M>['div']>[0];
  idPrefix?: string;
  diagnostics?: Pick<ZlozDiagnostics, 'instructions' | 'measurements'>;
  renderSettings?: Slot<M> | undefined;
  renderPreview?: Slot<M> | undefined;
  renderFindings?: Slot<M> | undefined;
  renderAcceptance?: Slot<M> | undefined;
  renderAction?: Slot<M> | undefined;
  renderDownload?: Slot<M> | undefined;
  renderStatus?: Slot<M> | undefined;
  renderReadout?: Slot<M> | undefined;
  renderLayout?: (
    parts: ZlozPngReviewParts,
    context: ZlozPngReviewControls,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
/** Controlled render/cancel/download actions, with live protection reasons and custom content. */
export function zlozPngAction<M>(
  h: HtmlBuilder<M>,
  context: ZlozPngReviewControls,
  action: 'render' | 'cancel' | 'download',
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children?: Parameters<HtmlBuilder<M>['button']>[1],
): Html {
  const reason =
    action === 'download'
      ? context.downloadReason
      : action === 'cancel'
        ? context.busy
          ? null
          : 'No PNG render is pending.'
        : context.renderReason;
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.Disabled(reason !== null),
      h.Title(reason ?? `PNG ${action}`),
      h.DataAttribute('zloz-png-action', action),
      h.OnClick(
        onRequest({
          ...context.identity,
          type:
            action === 'render'
              ? 'PngRenderRequested'
              : action === 'cancel'
                ? 'PngRenderCancelled'
                : 'PngDownloadRequested',
        }),
      ),
    ],
    children ?? [
      action === 'render'
        ? 'Render PNG'
        : action === 'cancel'
          ? 'Cancel PNG render'
          : 'Download PNG',
    ],
  );
}
/** Actual encoded PNG, never an SVG surrogate. */
export function zlozPngPreview<M>(
  h: HtmlBuilder<M>,
  context: ZlozPngReviewControls,
  attributes: Parameters<HtmlBuilder<M>['img']>[0] = [],
): Html | null {
  return context.artifact
    ? h.img([
        h.Alt('PNG export preview'),
        h.Src(context.artifact.dataUrl),
        h.DataAttribute('zloz-png-preview', ''),
        h.Style({
          display: 'block',
          width: '100%',
          height: 'auto',
          'max-height': '200px',
          'object-fit': 'contain',
          border: '1px solid var(--rule, #94a3b8)',
        }),
        ...attributes,
      ])
    : null;
}
/** Every part is replaceable or removable; diagnostics never hide loss/protection reasons. */
export function zlozPngReview<M>(
  h: HtmlBuilder<M>,
  context: ZlozPngReviewControls,
  onRequest: OnRequest<M>,
  options: ZlozPngReviewViewOptions<M> = {},
): Html {
  const prefix = options.idPrefix ?? 'zloz-png-review';
  const part = (slot: Slot<M> | undefined, fallback: () => Html | null) => {
    const custom = slot?.(context, h, onRequest);
    return custom === undefined ? fallback() : custom;
  };
  const settings = part(options.renderSettings, () =>
    h.div(
      [h.Style({ display: 'grid', gap: '8px' })],
      [
        ...(['regionId', 'themeId', 'backgroundId'] as const).map((field) =>
          h.label(
            [h.For(`${prefix}-${field}`)],
            [
              field === 'regionId'
                ? 'PNG region'
                : field === 'themeId'
                  ? 'PNG theme'
                  : 'PNG background',
              zlozSvgReviewSelect(
                h,
                context.svg,
                field,
                (request) =>
                  onRequest({
                    ...context.identity,
                    type: 'PngSettingsChanged',
                    preferences:
                      request.type === 'SvgSettingsChanged'
                        ? request.preferences
                        : context.svg.preferences,
                  }),
                [h.Id(`${prefix}-${field}`)],
              ),
            ],
          ),
        ),
        h.label(
          [h.For(`${prefix}-scale`)],
          [
            'PNG scale',
            h.select(
              [
                h.Id(`${prefix}-scale`),
                h.Value(String(context.svg.preferences.scale)),
                h.OnChange((value) =>
                  onRequest({
                    ...context.identity,
                    type: 'PngSettingsChanged',
                    preferences: { ...context.svg.preferences, scale: Number(value) },
                  }),
                ),
              ],
              [...new Set([1, 2, 3, context.svg.preferences.scale])].map((scale) =>
                h.option(
                  [h.Value(String(scale)), h.Selected(scale === context.svg.preferences.scale)],
                  [`${scale}×`],
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  );
  const preview = part(options.renderPreview, () => zlozPngPreview(h, context));
  const findings = part(options.renderFindings, () =>
    h.ul(
      [
        h.AriaLabel('PNG findings'),
        h.Style({ padding: '0 0 0 18px', 'overflow-wrap': 'anywhere' }),
      ],
      context.findings.map((f) =>
        h.li(
          [h.Style({ 'margin-bottom': '8px' })],
          [h.strong([], [`${f.severity} · ${f.target.kind}: `]), f.reason],
        ),
      ),
    ),
  );
  const acceptance = part(options.renderAcceptance, () =>
    h.label(
      [h.For(`${prefix}-accept`)],
      [
        h.input([
          h.Id(`${prefix}-accept`),
          h.Type('checkbox'),
          h.Checked(context.accepted),
          h.Disabled(context.plan?.type !== 'ready' || context.busy),
          h.OnClick(
            onRequest({
              ...context.identity,
              type: 'PngLossAcceptanceChanged',
              accepted: !context.accepted,
            }),
          ),
        ]),
        'Accept the reported PNG losses',
      ],
    ),
  );
  const render = part(options.renderAction, () =>
    context.busy
      ? zlozPngAction(h, context, 'cancel', onRequest)
      : zlozPngAction(h, context, 'render', onRequest),
  );
  const download = part(options.renderDownload, () =>
    zlozPngAction(h, context, 'download', onRequest),
  );
  const status = part(options.renderStatus, () =>
    h.p(
      [h.Role('status'), h.AriaLive('polite')],
      [context.busy ? 'Rendering PNG…' : (context.downloadReason ?? 'PNG is ready to download.')],
    ),
  );
  const readout =
    options.diagnostics?.measurements === false
      ? null
      : part(options.renderReadout, () =>
          h.p(
            [h.DataAttribute('zloz-png-readout', '')],
            [
              context.plan
                ? `${context.plan.width} × ${context.plan.height}${context.artifact ? ` · ${context.artifact.byteLength} bytes` : ''}`
                : context.fileName,
            ],
          ),
        );
  const parts = { settings, preview, findings, acceptance, render, download, status, readout };
  return h.div(
    [
      h.Role('group'),
      h.AriaLabel('PNG export review'),
      h.DataAttribute('zloz-png-review', ''),
      h.DataAttribute('zloz-png-generation', String(context.identity.generation)),
      h.Style({ display: 'grid', gap: '8px' }),
      ...(options.attributes ?? []),
    ],
    [
      ...(options.diagnostics?.instructions === false
        ? []
        : [
            h.p(
              [],
              [
                'Render canonical model artwork, review the actual PNG, then download the same bytes.',
              ],
            ),
          ]),
      ...(options.renderLayout?.(parts, context, h) ??
        [settings, preview, status, findings, acceptance, render, download, readout].flatMap((p) =>
          p === null ? [] : [p],
        )),
    ],
  );
}
