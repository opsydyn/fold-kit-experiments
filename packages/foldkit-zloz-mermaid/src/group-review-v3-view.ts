import {
  resolveZlozDiagnostics,
  zlozThemeStyle,
  type ZlozDiagnosticOptions,
  type ZlozTheme,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type { MermaidDiagnostic } from './export-mermaid';
import type {
  ZlozGroupMermaidReviewControlsV3,
  ZlozGroupMermaidReviewRequestV3,
} from './group-review-v3';
type OnRequest<M> = (request: ZlozGroupMermaidReviewRequestV3) => M;
export type ZlozGroupMermaidReviewPartsV3 = Readonly<{
  direction: Html | null;
  source: Html | null;
  findings: readonly Html[];
  consent: Html | null;
  download: Html | null;
  reason: Html | null;
  status: Html | null;
}>;
export type ZlozGroupMermaidReviewViewOptionsV3<M> = ZlozDiagnosticOptions &
  Readonly<{
    id: string;
    label?: string;
    theme?: ZlozTheme;
    attributes?: Parameters<HtmlBuilder<M>['section']>[0];
    /** Undefined retains the default; null removes the part. The host owns explanations in replacements. */
    renderPart?: (
      part: Exclude<keyof ZlozGroupMermaidReviewPartsV3, 'findings'>,
      controls: ZlozGroupMermaidReviewControlsV3,
      h: HtmlBuilder<M>,
      onRequest: OnRequest<M>,
    ) => Html | null | undefined;
    renderFinding?: (finding: MermaidDiagnostic, h: HtmlBuilder<M>) => Html | null | undefined;
    renderLayout?: (
      parts: ZlozGroupMermaidReviewPartsV3,
      controls: ZlozGroupMermaidReviewControlsV3,
      h: HtmlBuilder<M>,
    ) => readonly Html[];
  }>;
export function zlozGroupMermaidConsentV3<M>(
  h: HtmlBuilder<M>,
  controls: ZlozGroupMermaidReviewControlsV3,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['input']>[0] = [],
): Html {
  return h.input([
    ...attributes,
    h.Type('checkbox'),
    h.AriaLabel('Accept the reported Mermaid losses'),
    h.Checked(controls.accepted),
    h.Disabled(controls.reason !== null || !controls.hasLosses || controls.busy),
    h.OnClick(
      onRequest({
        ...controls.identity,
        type: 'MermaidLossAcceptanceChanged',
        accepted: !controls.accepted,
      }),
    ),
  ]);
}
export function zlozGroupMermaidDownloadV3<M>(
  h: HtmlBuilder<M>,
  controls: ZlozGroupMermaidReviewControlsV3,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Parameters<HtmlBuilder<M>['button']>[1] = ['Download Mermaid bundle'],
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.Disabled(controls.downloadReason !== null),
      h.Title(controls.downloadReason ?? 'Download the reviewed native bundle'),
      h.OnClick(onRequest({ ...controls.identity, type: 'MermaidDownloadRequested' })),
    ],
    children,
  );
}
/** Optional source review only. No Mermaid renderer, executable markup or DOM IO enters the product. */
export function zlozGroupMermaidReviewV3<M>(
  h: HtmlBuilder<M>,
  controls: ZlozGroupMermaidReviewControlsV3,
  onRequest: OnRequest<M>,
  options: ZlozGroupMermaidReviewViewOptionsV3<M>,
): Html {
  const diagnostics = resolveZlozDiagnostics(options),
    choose = options.id + '-direction';
  const part = (
    name: Exclude<keyof ZlozGroupMermaidReviewPartsV3, 'findings'>,
    fallback: () => Html | null,
  ) => {
    const custom = options.renderPart?.(name, controls, h, onRequest);
    return custom === undefined ? fallback() : custom;
  };
  const parts: ZlozGroupMermaidReviewPartsV3 = {
    direction: part('direction', () =>
      h.div(
        [],
        [
          h.label([h.For(choose)], ['Mermaid direction']),
          h.select(
            [
              h.Id(choose),
              h.Value(controls.direction),
              h.OnChange((value) =>
                onRequest({
                  ...controls.identity,
                  type: 'MermaidDirectionChanged',
                  direction:
                    value === 'TB' ? 'TB' : value === 'RL' ? 'RL' : value === 'BT' ? 'BT' : 'LR',
                }),
              ),
            ],
            (['LR', 'RL', 'TB', 'BT'] as const).map((value) => h.option([h.Value(value)], [value])),
          ),
        ],
      ),
    ),
    source: part('source', () =>
      controls.result.status === 'converted'
        ? h.pre(
            [
              h.AriaLabel('Mermaid source preview'),
              h.Tabindex(0),
              h.Style({
                overflow: 'auto',
                'max-height': '280px',
                'font-size': '12px',
                padding: '12px',
                border: '1px solid var(--flow-node-border, #94a3b8)',
                'border-radius': '6px',
                background: 'var(--flow-node-background, transparent)',
              }),
            ],
            [
              h.code(
                [h.Class('language-mermaid')],
                controls.result.value.source
                  .split(/("[^"]*"|\bflowchart\b|\bsubgraph\b|\bend\b)/g)
                  .map((token) =>
                    token.startsWith('"')
                      ? h.span([h.Style({ color: 'var(--flow-input-port, #0f766e)' })], [token])
                      : ['flowchart', 'subgraph', 'end'].includes(token)
                        ? h.span(
                            [
                              h.Style({
                                color: 'var(--flow-output-port, #2563eb)',
                                'font-weight': '600',
                              }),
                            ],
                            [token],
                          )
                        : token,
                  ),
              ),
            ],
          )
        : null,
    ),
    findings: controls.findings.flatMap((finding) => {
      const custom = options.renderFinding?.(finding, h),
        node =
          custom === undefined
            ? h.li(
                [h.DataAttribute('zloz-mermaid-finding', finding.code)],
                [
                  `${finding.severity}: ${finding.subject ? finding.subject + ': ' : ''}${finding.message}`,
                ],
              )
            : custom;
      return node === null ? [] : [node];
    }),
    consent: part('consent', () =>
      controls.hasLosses
        ? h.label(
            [h.Style({ display: 'flex', 'align-items': 'center', gap: '8px' })],
            [
              zlozGroupMermaidConsentV3(h, controls, onRequest, [
                h.Style({ display: 'inline-block', width: 'auto', 'margin-right': '8px' }),
              ]),
              'Accept the reported Mermaid losses',
            ],
          )
        : null,
    ),
    download: part('download', () => zlozGroupMermaidDownloadV3(h, controls, onRequest)),
    reason: part('reason', () =>
      controls.downloadReason
        ? h.p([h.AriaLabel('Mermaid export availability')], [controls.downloadReason])
        : null,
    ),
    status: part('status', () =>
      diagnostics.status
        ? h.p(
            [h.Role('status'), h.AriaLive('polite')],
            [
              controls.reason ??
                (controls.accepted
                  ? 'Exact Mermaid output accepted.'
                  : 'Review Mermaid source and fidelity findings.'),
            ],
          )
        : null,
    ),
  };
  const content = options.renderLayout?.(parts, controls, h) ?? [
    ...[parts.direction, parts.source, parts.status].filter((item): item is Html => item !== null),
    ...(parts.findings.length
      ? [h.ul([h.AriaLabel('Mermaid fidelity findings')], parts.findings)]
      : []),
    ...[parts.consent, parts.reason, parts.download].filter((item): item is Html => item !== null),
  ];
  return h.section(
    [
      ...(options.attributes ?? []),
      h.AriaLabel(options.label ?? 'Native v3 Mermaid export review'),
      h.DataAttribute('zloz-mermaid-generation', String(controls.identity.generation)),
      h.Style({ ...zlozThemeStyle(options.theme ?? {}), color: 'var(--flow-node-color, inherit)' }),
    ],
    content,
  );
}
