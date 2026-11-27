/** @module MermaidEffectUI */
import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { MermaidDiagnostic } from './export-mermaid';
import type {
  ZlozGroupMermaidReviewControlsV3,
  ZlozGroupMermaidReviewRequestV3,
} from './group-review-v3';

const directions = ['LR', 'RL', 'TB', 'BT'] as const;

export type GroupMermaidParts<M> = Readonly<{
  direction: View.Content<M> | null;
  source: View.Content<M> | null;
  findings: readonly View.Content<M>[];
  consent: View.Content<M> | null;
  download: View.Content<M> | null;
  reason: View.Content<M> | null;
  status: View.Content<M> | null;
}>;
export type GroupMermaidReviewOptions<M = never> = Readonly<{
  id: string;
  label?: string;
  minimalMode?: boolean;
  findingLabel?: (finding: MermaidDiagnostic) => string | null;
  attributes?: Readonly<Record<string, string>>;
  diagnostics?: boolean;
  renderPart?: (
    part: Exclude<keyof GroupMermaidParts<M>, 'findings'>,
    controls: ZlozGroupMermaidReviewControlsV3,
    h: Html.H<M>,
    onRequest: (request: ZlozGroupMermaidReviewRequestV3) => M,
  ) => View.Content<M> | null | undefined;
  renderFinding?: (finding: MermaidDiagnostic, h: Html.H<M>) => View.Content<M> | null | undefined;
  renderLayout?: (
    parts: GroupMermaidParts<M>,
    controls: ZlozGroupMermaidReviewControlsV3,
    h: Html.H<M>,
  ) => readonly (View.Content<M> | string | null | undefined)[];
}>;

/** Native Effect UI controls. The host handles requests through the headless review reducer. */
export function groupMermaidReviewV3<Message>(
  h: Html.H<Message>,
  controls: ZlozGroupMermaidReviewControlsV3,
  onRequest: (request: ZlozGroupMermaidReviewRequestV3) => Message,
  options: GroupMermaidReviewOptions<Message>,
) {
  const { identity, direction, findings, downloadReason } = controls;
  const selectId = `${options.id}-direction`;
  const reasonId = `${options.id}-reason`;
  const preview = controls.result.status === 'converted' ? controls.result.value.source : null;
  const part = (
    name: Exclude<keyof GroupMermaidParts<Message>, 'findings'>,
    fallback: View.Content<Message> | null,
  ) => {
    const rendered = options.renderPart?.(name, controls, h, onRequest);
    return rendered === undefined ? fallback : rendered;
  };
  const items = findings.flatMap((finding) => {
    const custom = options.renderFinding?.(finding, h);
    if (custom === null) return [];
    const subject = options.findingLabel ? options.findingLabel(finding) : finding.subject;
    return [
      custom ??
        h.li
          .attr('data-zloz-mermaid-finding', finding.code)
          .attr('title', finding.subject ?? finding.code)
          .children(`${finding.severity}: ${subject ? subject + ': ' : ''}${finding.message}`),
    ];
  });
  const parts: GroupMermaidParts<Message> = {
    direction: part(
      'direction',
      h.div(
        h.label.attr('for', selectId).children('Mermaid direction'),
        h.select
          .id(selectId)
          .on('change', ({ value }) => {
            const chosen = directions.find((item) => item === value);
            return chosen
              ? onRequest({ ...identity, type: 'MermaidDirectionChanged', direction: chosen })
              : undefined;
          })
          .children(
            ...directions.map((value) =>
              h.option
                .attr('value', value)
                .selected(direction === value)
                .children(value),
            ),
          ),
      ),
    ),
    source: part(
      'source',
      preview === null
        ? null
        : h.pre
            .attr('aria-label', 'Mermaid source preview')
            .attr('tabindex', '0')
            .style({
              overflow: 'auto',
              maxHeight: '280px',
              fontSize: '12px',
              padding: '12px',
              border: '1px solid var(--flow-node-border, #94a3b8)',
              borderRadius: '6px',
              background: 'var(--flow-node-background, transparent)',
            })
            .children(
              h.code.class('language-mermaid').children(
                ...preview.split(/("[^"]*"|\bflowchart\b|\bsubgraph\b|\bend\b)/g).map((token) =>
                  token.startsWith('"')
                    ? h.span.style({ color: 'var(--flow-input-port, #0f766e)' }).children(token)
                    : ['flowchart', 'subgraph', 'end'].includes(token)
                      ? h.span
                          .style({
                            color: 'var(--flow-output-port, #2563eb)',
                            fontWeight: '600',
                          })
                          .children(token)
                      : token,
                ),
              ),
            ),
    ),
    status: part(
      'status',
      options.minimalMode || options.diagnostics === false
        ? null
        : h.p
            .attr('role', 'status')
            .children(
              controls.reason ??
                (controls.accepted
                  ? 'Exact Mermaid output accepted.'
                  : 'Review Mermaid source and fidelity findings.'),
            ),
    ),
    findings: items,
    consent: part(
      'consent',
      controls.hasLosses
        ? h.label(
            h.input
              .attr('type', 'checkbox')
              .attr('aria-label', 'Accept the reported Mermaid losses')
              .checked(controls.accepted)
              .disabled(controls.reason !== null || controls.busy)
              .on(
                'click',
                onRequest({
                  ...identity,
                  type: 'MermaidLossAcceptanceChanged',
                  accepted: !controls.accepted,
                }),
              ),
            'Accept the reported Mermaid losses',
          )
        : null,
    ),
    reason: part(
      'reason',
      downloadReason
        ? h.p
            .id(reasonId)
            .attr('aria-label', 'Mermaid export availability')
            .children(downloadReason)
        : null,
    ),
    download: part(
      'download',
      h.button
        .attr('type', 'button')
        .attr('aria-describedby', downloadReason ? reasonId : undefined)
        .disabled(downloadReason !== null)
        .on('click', onRequest({ ...identity, type: 'MermaidDownloadRequested' }))
        .children('Download Mermaid bundle'),
    ),
  };
  return h.section
    .attrs(options.attributes ?? {})
    .id(options.id)
    .attr('aria-label', options.label ?? 'Native v3 Mermaid export review')
    .attr('data-zloz-mermaid-generation', String(identity.generation))
    .children(
      ...(options.renderLayout?.(parts, controls, h) ?? [
        parts.direction,
        parts.source,
        parts.status,
        items.length > 0
          ? h.ul.attr('aria-label', 'Mermaid fidelity findings').children(...items)
          : null,
        parts.consent,
        parts.reason,
        parts.download,
      ]),
    );
}

export { reviewPacket, reviewPacketConsent, reviewPacketDownload } from './effect-ui-review-packet';
export type { ReviewPacketOptions, ReviewPacketParts } from './effect-ui-review-packet';
export { reviewReader } from './effect-ui-review-reader';
export type { ReviewReaderOptions, ReviewReaderParts } from './effect-ui-review-reader';
