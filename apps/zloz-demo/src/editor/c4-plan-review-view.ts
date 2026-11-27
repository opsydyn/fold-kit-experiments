import type { Html } from '@effect/ui/html';

import type { workbenchC4MappingReview } from './c4-mapping-review';
import { Message } from './message';
import type { Model } from './model';

export function c4PlanReviewPanel<M>(
  model: Model,
  h: Html.H<M>,
  send: (message: Message) => M,
  context: ReturnType<typeof workbenchC4MappingReview>,
) {
  const { plan, member } = context;
  const membershipStatus = {
    unresolved: 'Placement choice needed',
    blocked: 'Placement blocked',
    resolved: 'Placement reviewed',
  };
  const graph = plan.provenance.document.snapshot.graph;
  const label = (id: string | null) =>
    id === null
      ? 'Diagram root · no parent'
      : (graph.nodes.find((node) => node.id === id)?.label ?? id);
  const identity = { ...context.scope, nodeId: member?.nodeId ?? '' };
  const key = `${context.scope.epoch}:${context.scope.revision}:${context.scope.editionId}:${member?.nodeId ?? ''}`;
  const status = {
    blocked: 'Resolve plan blockers',
    unchanged: 'No conversion changes',
    'consent-required': 'Loss acknowledgement needed',
    consented: 'Losses acknowledged for this plan',
  }[context.conversion.type];
  return h.details
    .id('c4-conversion-plan')
    .class('mapping-plan')
    .key('c4-plan-review')
    .children(
      h.summary.children('C4 conversion plan review'),
      h.section
        .attr('aria-label', 'C4 conversion plan review')
        .class('c4-plan-review')
        .children(
          h.p
            .attr('role', 'status')
            .attr('aria-label', 'C4 conversion plan status')
            .children(status),
          h.p.children(
            `Source: ${plan.provenance.document.name} · ${context.sourceLabel}. Full graph, camera, editions and fork ancestry are captured for this exact review.`,
          ),
          h.p.children(
            'Placement records diagram intent without moving the source nodes. Acknowledgement is review only; Apply is deferred.',
          ),
          ...(member
            ? [
                h.label.class('workbench-field').children(
                  'Review C4 placement',
                  h.select
                    .attr('aria-label', 'Review C4 placement')
                    .value(member.nodeId)
                    .on('change', ({ value: nodeId }) =>
                      send(Message.SelectedC4PlacementMember({ ...context.scope, nodeId })),
                    )
                    .children(
                      ...plan.memberships.map((entry) =>
                        h.option
                          .key(entry.nodeId)
                          .attr('value', entry.nodeId)
                          .selected(entry.nodeId === member.nodeId)
                          .children(`${label(entry.nodeId)} · ${membershipStatus[entry.type]}`),
                      ),
                    ),
                ),
                h.p
                  .attr('role', 'status')
                  .attr('aria-label', 'C4 placement target')
                  .children(label(member.nodeId)),
                h.p
                  .attr('role', 'status')
                  .attr('aria-label', 'C4 placement decision')
                  .children(membershipStatus[member.type]),
                h.p.children(member.reason),
                h.p.children(`Current group: ${label(member.before.parentId)}`),
                ...(member.type === 'resolved'
                  ? [h.p.children(`Reviewed group: ${label(member.after.parentId)}`)]
                  : []),
                h.label
                  .class('workbench-field')
                  .key(`placement-type:${key}`)
                  .children(
                    'Placement kind',
                    h.select
                      .attr('aria-label', 'Placement kind')
                      .value(context.placementForm.type)
                      .disabled(context.reason !== null)
                      .attr('aria-describedby', 'c4-placement-reason')
                      .on('change', ({ value }) =>
                        send(Message.ChangedC4PlacementForm({ ...identity, field: 'type', value })),
                      )
                      .children(
                        ...[
                          ['', 'Choose placement'],
                          ['root', 'Diagram root'],
                          ['organization', 'Keep organizational grouping'],
                          ['contained', 'Declare C4 containment'],
                        ].map(([value, title]) =>
                          h.option
                            .attr('value', value ?? '')
                            .selected(value === context.placementForm.type)
                            .children(title ?? ''),
                        ),
                      ),
                  ),
                ...(context.placementForm.type === 'contained'
                  ? [
                      h.label
                        .class('workbench-field')
                        .key(`placement-parent:${key}`)
                        .children(
                          'Placement parent',
                          h.select
                            .attr('aria-label', 'Placement parent')
                            .value(context.placementForm.parentId)
                            .disabled(context.reason !== null)
                            .attr('aria-describedby', 'c4-placement-reason')
                            .on('change', ({ value }) =>
                              send(
                                Message.ChangedC4PlacementForm({
                                  ...identity,
                                  field: 'parentId',
                                  value,
                                }),
                              ),
                            )
                            .children(
                              h.option.attr('value', '').children('Choose an existing group'),
                              ...context.parents.map((parent) =>
                                h.option
                                  .key(parent.id)
                                  .attr('value', parent.id)
                                  .selected(context.placementForm.parentId === parent.id)
                                  .children(parent.label),
                              ),
                            ),
                        ),
                      h.p.children(
                        'Existing groups are shown; the package checks C4 roles, group kind and cycles. No owner is selected automatically.',
                      ),
                    ]
                  : []),
                h.p
                  .id('c4-placement-reason')
                  .children(
                    context.placementReason ??
                      'Review this explicit placement to see package compatibility and loss findings.',
                  ),
                h.div
                  .key(`placement-actions:${key}`)
                  .class('workbench-actions')
                  .children(
                    h.button
                      .attr('type', 'button')
                      .key(`placement-review:${key}`)
                      .attr('aria-label', 'Review C4 placement')
                      .disabled(context.placementReason !== null)
                      .attr('aria-describedby', 'c4-placement-reason')
                      .on('click', send(Message.ClickedC4PlacementReview(identity)))
                      .children('Review C4 placement'),
                    h.button
                      .attr('type', 'button')
                      .key(`placement-clear:${key}`)
                      .attr('aria-label', 'Clear C4 placement')
                      .disabled(context.reason !== null)
                      .on('click', send(Message.ClickedC4PlacementClear(identity)))
                      .children('Clear placement'),
                  ),
              ]
            : [
                h.p.children(
                  'No placement decisions are required yet. Make explicit node choices above or retain workshop meaning.',
                ),
              ]),
          ...(plan.type === 'blocked'
            ? [
                h.details.children(
                  h.summary.children('C4 plan blockers'),
                  h.ul
                    .attr('aria-label', 'C4 plan blockers')
                    .children(
                      ...plan.blockers.map((blocker) =>
                        h.li
                          .key(`${blocker.kind}:${blocker.id}`)
                          .children(
                            `${blocker.kind === 'edge' ? (graph.edges.find((edge) => edge.id === blocker.id)?.label ?? blocker.id) : label(blocker.id)}: ${blocker.reason}`,
                          ),
                      ),
                    ),
                ),
              ]
            : []),
          h.h3.children('Exact C4 plan losses'),
          ...(plan.disclosures.length
            ? [
                h.ul
                  .attr('aria-label', 'C4 plan losses')
                  .children(
                    ...plan.disclosures.map((loss) =>
                      h.li
                        .key(`${loss.kind}:${loss.id}:${loss.code}`)
                        .children(
                          h.strong.children(
                            loss.kind === 'edge'
                              ? (graph.edges.find((edge) => edge.id === loss.id)?.label ?? loss.id)
                              : label(loss.id),
                          ),
                          h.p.children(loss.reason),
                        ),
                    ),
                  ),
              ]
            : [h.p.children('No semantic replacements are proposed.')]),
          h.label
            .class('workbench-field')
            .children(
              h.input
                .attr('type', 'checkbox')
                .attr('aria-label', 'Protect C4 conversion Apply')
                .checked(model.protectC4Apply)
                .on('click', send(Message.ClickedC4ApplyProtection())),
              'Protect C4 conversion Apply',
            ),
          h.label
            .key('c4-plan-acknowledgement')
            .class('workbench-field mapping-acknowledgement')
            .children(
              h.input
                .attr('type', 'checkbox')
                .attr('aria-label', 'Acknowledge exact C4 plan losses')
                .checked(context.acknowledged)
                .disabled(context.acknowledgementReason !== null)
                .attr('aria-describedby', 'c4-plan-acknowledgement-reason')
                .on(
                  'click',
                  send(
                    Message.ClickedC4PlanAcknowledgement({
                      ...context.scope,
                      generation: model.c4PlanRun,
                      planKey: plan.key,
                      accepted: !context.acknowledged,
                    }),
                  ),
                ),
              'I acknowledge every listed loss for this exact C4 plan',
            ),
          h.button
            .attr('type', 'button')
            .attr('aria-label', 'Apply C4 conversion')
            .disabled(context.applyReason !== null)
            .attr('aria-describedby', 'c4-apply-reason')
            .on(
              'click',
              send(
                Message.ClickedC4ConversionApply({
                  ...context.scope,
                  planKey: plan.key,
                  generation: model.c4PlanRun,
                }),
              ),
            )
            .children('Apply C4 conversion'),
          h.p
            .id('c4-apply-reason')
            .attr('role', 'status')
            .attr('aria-label', 'C4 Apply availability')
            .children(context.applyReason ?? 'Ready to apply this exact plan as one Undo step.'),
          h.p
            .attr('role', 'status')
            .attr('aria-label', 'C4 Apply result')
            .children(model.c4ApplyNotice),
          h.p
            .id('c4-plan-acknowledgement-reason')
            .attr('role', 'status')
            .children(
              context.acknowledgementReason ??
                'Acknowledgement applies only to the current source and choices. Uncheck to withdraw it. No model changes or Apply permission are created.',
            ),
        ),
    );
}
