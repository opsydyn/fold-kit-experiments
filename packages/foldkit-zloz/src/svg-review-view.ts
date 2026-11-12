import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozDiagnostics } from './diagnostics';
import type { ZlozSvgReviewControls, ZlozSvgReviewRequest } from './svg-review';
import type { ZlozSvgWriteFinding } from './svg-writer';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type OnRequest<M> = (request: ZlozSvgReviewRequest) => M;
export type ZlozSvgReviewParts = Readonly<{
  settings: Html | null;
  preview: Html | null;
  findings: Html | null;
  acceptance: Html | null;
  download: Html | null;
  status: Html | null;
  readout: Html | null;
}>;
export type ZlozSvgReviewViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  idPrefix?: string;
  diagnostics?: Pick<ZlozDiagnostics, 'instructions' | 'measurements'>;
  renderPreview?:
    | ((context: ZlozSvgReviewControls, h: HtmlBuilder<M>) => Html | null | undefined)
    | undefined;
  renderSettings?:
    | ((
        context: ZlozSvgReviewControls,
        h: HtmlBuilder<M>,
        onRequest: OnRequest<M>,
      ) => Html | null | undefined)
    | undefined;
  renderFinding?:
    | ((finding: ZlozSvgWriteFinding, h: HtmlBuilder<M>) => Html | null | undefined)
    | undefined;
  renderFindings?:
    | ((context: ZlozSvgReviewControls, h: HtmlBuilder<M>) => Html | null | undefined)
    | undefined;
  renderAcceptance?:
    | ((
        context: ZlozSvgReviewControls,
        h: HtmlBuilder<M>,
        onRequest: OnRequest<M>,
      ) => Html | null | undefined)
    | undefined;
  renderDownload?:
    | ((
        context: ZlozSvgReviewControls,
        h: HtmlBuilder<M>,
        onRequest: OnRequest<M>,
      ) => Html | null | undefined)
    | undefined;
  renderStatus?:
    | ((context: ZlozSvgReviewControls, h: HtmlBuilder<M>) => Html | null | undefined)
    | undefined;
  renderReadout?:
    | ((context: ZlozSvgReviewControls, h: HtmlBuilder<M>) => Html | null | undefined)
    | undefined;
  renderLayout?: (
    parts: ZlozSvgReviewParts,
    context: ZlozSvgReviewControls,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
/** Controlled native choice; use the same request contract for custom settings. */
export function zlozSvgReviewSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozSvgReviewControls,
  field: 'regionId' | 'themeId' | 'backgroundId',
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
): Html {
  const entries =
    field === 'regionId'
      ? context.regions
      : field === 'themeId'
        ? context.themes
        : context.backgrounds;
  const selected = context.preferences[field];
  return h.select(
    [
      ...attributes,
      h.Value(selected),
      h.DataAttribute('zloz-svg-setting', field),
      h.OnChange((value) =>
        onRequest({
          ...context.identity,
          type: 'SvgSettingsChanged',
          preferences: { ...context.preferences, [field]: value },
        }),
      ),
    ],
    [
      ...(!entries.some((entry) => entry.id === selected)
        ? [h.option([h.Value(selected), h.Selected(true)], ['Unavailable — choose an option'])]
        : []),
      ...entries.map((entry) =>
        h.option([h.Value(entry.id), h.Selected(entry.id === selected)], [entry.label]),
      ),
    ],
  );
}
export function zlozSvgLossCheckbox<M>(
  h: HtmlBuilder<M>,
  context: ZlozSvgReviewControls,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['input']>[0] = [],
): Html {
  return h.input([
    ...attributes,
    h.Type('checkbox'),
    h.Checked(context.accepted),
    h.Disabled(!context.hasLosses || context.result?.type !== 'written' || context.busy),
    h.DataAttribute('zloz-svg-loss-acceptance', ''),
    h.OnClick(
      onRequest({
        ...context.identity,
        type: 'SvgLossAcceptanceChanged',
        accepted: !context.accepted,
      }),
    ),
  ]);
}
export function zlozSvgDownloadButton<M>(
  h: HtmlBuilder<M>,
  context: ZlozSvgReviewControls,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Parameters<HtmlBuilder<M>['button']>[1] = ['Download SVG'],
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.Disabled(context.downloadReason !== null),
      h.Title(context.downloadReason ?? `Download ${context.fileName}`),
      h.DataAttribute('zloz-svg-download', ''),
      h.OnClick(onRequest({ ...context.identity, type: 'SvgDownloadRequested' })),
    ],
    children,
  );
}
/** Inert image preview, with no raw markup inserted into the host DOM. */
export function zlozSvgReviewPreview<M>(
  h: HtmlBuilder<M>,
  context: ZlozSvgReviewControls,
  attributes: Parameters<HtmlBuilder<M>['img']>[0] = [],
): Html | null {
  return context.result?.type === 'written'
    ? h.img([
        h.Alt('SVG export preview'),
        h.Src(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(context.result.svg)}`),
        h.DataAttribute('zloz-svg-preview', ''),
        h.Style({
          display: 'block',
          width: '100%',
          height: 'auto',
          'max-height': '180px',
          'object-fit': 'contain',
          border: '1px solid var(--flow-node-border, #94a3b8)',
          background: 'var(--flow-background, #eef2f6)',
        }),
        ...attributes,
      ])
    : null;
}
/** Settings, reasons and losses remain functional independently of diagnostic readouts. */
export function zlozSvgReview<M>(
  h: HtmlBuilder<M>,
  context: ZlozSvgReviewControls,
  onRequest: OnRequest<M>,
  options: ZlozSvgReviewViewOptions<M> = {},
): Html {
  const prefix = options.idPrefix ?? 'zloz-svg-review';
  const part = (custom: Html | null | undefined, fallback: () => Html | null) =>
    custom === undefined ? fallback() : custom;
  const settings = part(options.renderSettings?.(context, h, onRequest), () =>
    h.div(
      [h.Style({ display: 'grid', gap: '8px' })],
      (['regionId', 'themeId', 'backgroundId'] as const).map((field) =>
        h.label(
          [h.For(`${prefix}-${field}`)],
          [
            field === 'regionId'
              ? 'SVG region'
              : field === 'themeId'
                ? 'SVG theme'
                : 'SVG background',
            zlozSvgReviewSelect(h, context, field, onRequest, [h.Id(`${prefix}-${field}`)]),
          ],
        ),
      ),
    ),
  );
  const preview = part(options.renderPreview?.(context, h), () => zlozSvgReviewPreview(h, context));
  const findings = part(options.renderFindings?.(context, h), () =>
    h.ul(
      [
        h.AriaLabel('SVG findings'),
        h.Style({ padding: '0 0 0 18px', 'overflow-wrap': 'anywhere' }),
      ],
      context.findings.flatMap((finding) => {
        const custom = options.renderFinding?.(finding, h);
        return custom === null
          ? []
          : [
              custom ??
                h.li(
                  [h.Style({ 'margin-bottom': '8px' })],
                  [
                    h.strong(
                      [],
                      [
                        `${finding.severity} · ${finding.target.kind}${'id' in finding.target ? ` ${finding.target.id}` : ''}: `,
                      ],
                    ),
                    finding.reason,
                  ],
                ),
            ];
      }),
    ),
  );
  const acceptance = part(options.renderAcceptance?.(context, h, onRequest), () =>
    context.hasLosses
      ? h.label(
          [h.For(`${prefix}-accept`)],
          [
            zlozSvgLossCheckbox(h, context, onRequest, [h.Id(`${prefix}-accept`)]),
            'Accept the reported SVG losses',
          ],
        )
      : null,
  );
  const download = part(options.renderDownload?.(context, h, onRequest), () =>
    zlozSvgDownloadButton(h, context, onRequest),
  );
  const status = part(options.renderStatus?.(context, h), () =>
    h.p(
      [h.Role('status'), h.AriaLive('polite')],
      [context.downloadReason ?? 'SVG is ready to download.'],
    ),
  );
  const readout =
    options.diagnostics?.measurements === false
      ? null
      : part(options.renderReadout?.(context, h), () =>
          h.p(
            [h.DataAttribute('zloz-svg-readout', '')],
            [
              context.result?.type === 'written'
                ? `${context.fileName} · ${context.result.plan.size.width} × ${context.result.plan.size.height} · ${context.findings.length} findings`
                : context.fileName,
            ],
          ),
        );
  const parts = { settings, preview, findings, acceptance, download, status, readout };
  const children =
    options.renderLayout?.(parts, context, h) ??
    [settings, preview, status, findings, acceptance, download, readout].flatMap((value) =>
      value === null ? [] : [value],
    );
  return h.div(
    [
      h.Role('group'),
      h.AriaLabel('SVG export review'),
      h.DataAttribute('zloz-svg-review', ''),
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
                'Review the canonical-model export and its findings. Loss acceptance applies only to this artifact.',
              ],
            ),
          ]),
      ...children,
    ],
  );
}
