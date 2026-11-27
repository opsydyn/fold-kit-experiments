import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { ZlozModellingPatchChange, ZlozModellingPatchFinding } from './modelling-patch';
import type {
  ZlozModellingPatchReview,
  ZlozModellingPatchReviewRequest,
} from './modelling-patch-apply';
import type { ZlozModellingPatchReviewV3 } from './modelling-patch-v3-apply';

type Review = ZlozModellingPatchReview | ZlozModellingPatchReviewV3;
type Send<M> = (event: ZlozModellingPatchReviewRequest) => M;
type Slot<M> = View.Content<M> | null | undefined;
type Decorate<M, Tag extends 'div' | 'input' | 'button'> = (
  element: Html.H<M>[Tag],
) => ReturnType<Html.H<M>[Tag]['class']>;

export type ZlozModellingPatchReviewParts<M> = Readonly<{
  summary: View.Content<M> | null;
  findings: View.Content<M>;
  changes: View.Content<M>;
  acknowledgement: View.Content<M> | null;
  apply: View.Content<M> | null;
  status: View.Content<M>;
}>;

export type ZlozModellingPatchReviewViewOptions<
  M,
  C extends Review = ZlozModellingPatchReview,
> = Readonly<{
  decorate?: Decorate<M, 'div'>;
  showCounts?: boolean;
  instructions?: boolean;
  renderSummary?: (context: C, h: Html.H<M>) => Slot<M>;
  renderFinding?: (finding: ZlozModellingPatchFinding, h: Html.H<M>) => Slot<M>;
  renderChange?: (change: ZlozModellingPatchChange, h: Html.H<M>) => Slot<M>;
  renderLayout?: (parts: ZlozModellingPatchReviewParts<M>, h: Html.H<M>) => View.Input<M>;
}>;

export function modellingPatchAcknowledgement<M>(
  h: Html.H<M>,
  { key, reason, acknowledged }: Review,
  request: Send<M>,
  decorate?: Decorate<M, 'input'>,
) {
  return (decorate?.(h.input) ?? h.input)
    .attr('type', 'checkbox')
    .checked(acknowledged)
    .disabled(reason !== null || key === null)
    .on(
      'click',
      request({ type: 'AcknowledgementChanged', key: key ?? '', accepted: !acknowledged }),
    );
}

export function modellingPatchApply<M>(
  h: Html.H<M>,
  { key, canApply }: Review,
  request: Send<M>,
  decorate?: Decorate<M, 'button'>,
  children: View.Children<M, never> = ['Apply reviewed patch'],
) {
  return (decorate?.(h.button) ?? h.button)
    .attr('type', 'button')
    .disabled(!canApply)
    .on('click', request({ type: 'ApplyClicked', key: key ?? '' }))
    .children(children);
}

/** Submit consent for the preview's exact identity. Apply remains a core transaction. */
export function modellingPatchReview<M, C extends Review>(
  h: Html.H<M>,
  context: C,
  request: Send<M>,
  options: ZlozModellingPatchReviewViewOptions<M, C> = {},
) {
  const { preview, key, reason, acknowledged } = context;
  const customSummary = options.renderSummary?.(context, h);
  const summary =
    customSummary !== undefined
      ? customSummary
      : preview.type === 'rejected'
        ? null
        : h.div(
            h.strong(preview.patch.id),
            h.details(
              h.summary('Source identity'),
              h.p(`${preview.patch.source.modelId} · ${preview.patch.source.sessionId}`),
            ),
            h.p(
              `${preview.patch.provenance.actor.kind}: ${preview.patch.provenance.actor.id} · ${preview.patch.provenance.reason}`,
            ),
            options.showCounts === false
              ? null
              : h.p
                  .attr('data-patch-counts', '')
                  .children(
                    `${preview.changes.length} changes · ${preview.losses.length} loss disclosures · source revision ${preview.patch.source.revision}`,
                  ),
          );

  const status = h.p
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .children(
      reason ??
        (acknowledged
          ? 'Exact changes acknowledged. Apply rechecks current source and protection.'
          : 'Review and acknowledge the exact proposed changes and losses before Apply.'),
    );
  const findings = h.ul.attr('aria-label', 'Patch findings').children(
    preview.findings.map((finding) => {
      const custom = options.renderFinding?.(finding, h);
      return custom === undefined ? h.li(`${finding.code}: ${finding.message}`) : custom;
    }),
  );
  const changes = h.div.attr('aria-label', 'Proposed patch changes').children(
    preview.type === 'rejected'
      ? []
      : preview.changes.map((change) => {
          const custom = options.renderChange?.(change, h);
          return custom === undefined
            ? h.details(
                h.summary(`${change.entity} ${change.id} · ${change.operationId}`),
                h.pre(JSON.stringify({ before: change.before, after: change.after }, null, 2)),
              )
            : custom;
        }),
  );
  const acknowledgement = key
    ? h.label(
        modellingPatchAcknowledgement(h, context, request),
        'I reviewed the proposed changes and accept the disclosed losses.',
      )
    : null;
  const apply = key ? modellingPatchApply(h, context, request) : null;
  const parts = { summary, status, findings, changes, acknowledgement, apply };
  return (options.decorate?.(h.div) ?? h.div)
    .attr('data-patch-review', '')
    .children(
      options.instructions === false
        ? null
        : h.p('Inspect before/after values and findings. Apply is atomic and adds one Undo.'),
      options.renderLayout
        ? options.renderLayout(parts, h)
        : [summary, status, findings, changes, acknowledgement, apply],
    );
}
