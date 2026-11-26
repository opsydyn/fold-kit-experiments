import type { Html } from '@effect/ui/html';

import type {
  ZlozModellingPatchReview,
  ZlozModellingPatchReviewRequest,
} from './modelling-patch-apply';
import type { ZlozModellingPatchReviewV3 } from './modelling-patch-v3-apply';

/** Render the preview and submit consent for its exact source identity. Apply remains a core transaction. */
export function modellingPatchReview<M>(
  h: Html.H<M>,
  context: ZlozModellingPatchReview | ZlozModellingPatchReviewV3,
  request: (event: ZlozModellingPatchReviewRequest) => M,
) {
  const { preview, key, reason, acknowledged, canApply } = context;
  const summary =
    preview.type === 'rejected'
      ? []
      : [
          h.div(
            h.strong(preview.patch.id),
            h.details(
              h.summary('Source identity'),
              h.p(`${preview.patch.source.modelId} · ${preview.patch.source.sessionId}`),
            ),
            h.p(
              `${preview.patch.provenance.actor.kind}: ${preview.patch.provenance.actor.id} · ${preview.patch.provenance.reason}`,
            ),
            h.p
              .attr('data-patch-counts', '')
              .children(
                `${preview.changes.length} changes · ${preview.losses.length} loss disclosures · source revision ${preview.patch.source.revision}`,
              ),
          ),
        ];
  return h.div.attr('data-patch-review', '').children(
    h.p('Inspect before/after values and findings. Apply is atomic and adds one Undo.'),
    ...summary,
    h.p
      .attr('role', 'status')
      .children(
        reason ??
          (acknowledged
            ? 'Exact changes acknowledged. Apply rechecks current source and protection.'
            : 'Review and acknowledge the exact proposed changes and losses before Apply.'),
      ),
    h.ul
      .attr('aria-label', 'Patch findings')
      .children(...preview.findings.map((f) => h.li(`${f.code}: ${f.message}`))),
    h.div
      .attr('aria-label', 'Proposed patch changes')
      .children(
        ...(preview.type === 'rejected'
          ? []
          : preview.changes.map((change) =>
              h.details(
                h.summary(`${change.entity} ${change.id} · ${change.operationId}`),
                h.pre(JSON.stringify({ before: change.before, after: change.after }, null, 2)),
              ),
            )),
      ),
    ...(key
      ? [
          h.label(
            h.input
              .attr('type', 'checkbox')
              .checked(acknowledged)
              .disabled(reason !== null)
              .on(
                'click',
                request({ type: 'AcknowledgementChanged', key, accepted: !acknowledged }),
              ),
            'I reviewed the proposed changes and accept the disclosed losses.',
          ),
          h.button
            .attr('type', 'button')
            .disabled(!canApply)
            .on('click', request({ type: 'ApplyClicked', key }))
            .children('Apply reviewed patch'),
        ]
      : []),
  );
}
