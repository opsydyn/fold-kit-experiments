import type { HtmlBuilder } from 'foldkit/html';

import type { workbenchC4MappingReview } from './c4-mapping-review';
import { Message } from './message';
import type { Model } from './model';

export function c4PlanReviewPanel(
  model: Model,
  h: HtmlBuilder<Message>,
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
  return h.details(
    [h.Id('c4-conversion-plan'), h.Class('mapping-plan'), h.Key('c4-plan-review')],
    [
      h.summary([], ['C4 conversion plan review']),
      h.section(
        [h.AriaLabel('C4 conversion plan review'), h.Class('c4-plan-review')],
        [
          h.p([h.Role('status'), h.AriaLabel('C4 conversion plan status')], [status]),
          h.p(
            [],
            [
              `Source: ${plan.provenance.document.name} · ${context.sourceLabel}. Full graph, camera, editions and fork ancestry are captured for this exact review.`,
            ],
          ),
          h.p(
            [],
            [
              'Placement records diagram intent without moving the source nodes. Acknowledgement is review only; Apply is deferred.',
            ],
          ),
          ...(member
            ? [
                h.label(
                  [h.Class('workbench-field')],
                  [
                    'Review C4 placement',
                    h.select(
                      [
                        h.AriaLabel('Review C4 placement'),
                        h.Value(member.nodeId),
                        h.OnChange((nodeId) =>
                          Message.SelectedC4PlacementMember({ ...context.scope, nodeId }),
                        ),
                      ],
                      plan.memberships.map((entry) =>
                        h.option(
                          [
                            h.Key(entry.nodeId),
                            h.Value(entry.nodeId),
                            h.Selected(entry.nodeId === member.nodeId),
                          ],
                          [`${label(entry.nodeId)} · ${membershipStatus[entry.type]}`],
                        ),
                      ),
                    ),
                  ],
                ),
                h.p([h.Role('status'), h.AriaLabel('C4 placement target')], [label(member.nodeId)]),
                h.p(
                  [h.Role('status'), h.AriaLabel('C4 placement decision')],
                  [membershipStatus[member.type]],
                ),
                h.p([], [member.reason]),
                h.p([], [`Current group: ${label(member.before.parentId)}`]),
                ...(member.type === 'resolved'
                  ? [h.p([], [`Reviewed group: ${label(member.after.parentId)}`])]
                  : []),
                h.label(
                  [h.Class('workbench-field'), h.Key(`placement-type:${key}`)],
                  [
                    'Placement kind',
                    h.select(
                      [
                        h.AriaLabel('Placement kind'),
                        h.Value(context.placementForm.type),
                        h.Disabled(context.reason !== null),
                        h.AriaDescribedBy('c4-placement-reason'),
                        h.OnChange((value) =>
                          Message.ChangedC4PlacementForm({ ...identity, field: 'type', value }),
                        ),
                      ],
                      [
                        ['', 'Choose placement'],
                        ['root', 'Diagram root'],
                        ['organization', 'Keep organizational grouping'],
                        ['contained', 'Declare C4 containment'],
                      ].map(([value, title]) =>
                        h.option(
                          [h.Value(value ?? ''), h.Selected(value === context.placementForm.type)],
                          [title ?? ''],
                        ),
                      ),
                    ),
                  ],
                ),
                ...(context.placementForm.type === 'contained'
                  ? [
                      h.label(
                        [h.Class('workbench-field'), h.Key(`placement-parent:${key}`)],
                        [
                          'Placement parent',
                          h.select(
                            [
                              h.AriaLabel('Placement parent'),
                              h.Value(context.placementForm.parentId),
                              h.Disabled(context.reason !== null),
                              h.AriaDescribedBy('c4-placement-reason'),
                              h.OnChange((value) =>
                                Message.ChangedC4PlacementForm({
                                  ...identity,
                                  field: 'parentId',
                                  value,
                                }),
                              ),
                            ],
                            [
                              h.option([h.Value('')], ['Choose an existing group']),
                              ...context.parents.map((parent) =>
                                h.option(
                                  [
                                    h.Key(parent.id),
                                    h.Value(parent.id),
                                    h.Selected(context.placementForm.parentId === parent.id),
                                  ],
                                  [parent.label],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      h.p(
                        [],
                        [
                          'Existing groups are shown; the package checks C4 roles, group kind and cycles. No owner is selected automatically.',
                        ],
                      ),
                    ]
                  : []),
                h.p(
                  [h.Id('c4-placement-reason')],
                  [
                    context.placementReason ??
                      'Review this explicit placement to see package compatibility and loss findings.',
                  ],
                ),
                h.div(
                  [h.Key(`placement-actions:${key}`), h.Class('workbench-actions')],
                  [
                    h.button(
                      [
                        h.Type('button'),
                        h.Key(`placement-review:${key}`),
                        h.AriaLabel('Review C4 placement'),
                        h.Disabled(context.placementReason !== null),
                        h.AriaDescribedBy('c4-placement-reason'),
                        h.OnClick(Message.ClickedC4PlacementReview(identity)),
                      ],
                      ['Review C4 placement'],
                    ),
                    h.button(
                      [
                        h.Type('button'),
                        h.Key(`placement-clear:${key}`),
                        h.AriaLabel('Clear C4 placement'),
                        h.Disabled(context.reason !== null),
                        h.OnClick(Message.ClickedC4PlacementClear(identity)),
                      ],
                      ['Clear placement'],
                    ),
                  ],
                ),
              ]
            : [
                h.p(
                  [],
                  [
                    'No placement decisions are required yet. Make explicit node choices above or retain workshop meaning.',
                  ],
                ),
              ]),
          ...(plan.type === 'blocked'
            ? [
                h.details(
                  [],
                  [
                    h.summary([], ['C4 plan blockers']),
                    h.ul(
                      [h.AriaLabel('C4 plan blockers')],
                      plan.blockers.map((blocker) =>
                        h.li(
                          [h.Key(`${blocker.kind}:${blocker.id}`)],
                          [
                            `${blocker.kind === 'edge' ? (graph.edges.find((edge) => edge.id === blocker.id)?.label ?? blocker.id) : label(blocker.id)}: ${blocker.reason}`,
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ]
            : []),
          h.h3([], ['Exact C4 plan losses']),
          ...(plan.disclosures.length
            ? [
                h.ul(
                  [h.AriaLabel('C4 plan losses')],
                  plan.disclosures.map((loss) =>
                    h.li(
                      [h.Key(`${loss.kind}:${loss.id}:${loss.code}`)],
                      [
                        h.strong(
                          [],
                          [
                            loss.kind === 'edge'
                              ? (graph.edges.find((edge) => edge.id === loss.id)?.label ?? loss.id)
                              : label(loss.id),
                          ],
                        ),
                        h.p([], [loss.reason]),
                      ],
                    ),
                  ),
                ),
              ]
            : [h.p([], ['No semantic replacements are proposed.'])]),
          h.label(
            [h.Key('c4-plan-acknowledgement'), h.Class('workbench-field mapping-acknowledgement')],
            [
              h.input([
                h.Type('checkbox'),
                h.AriaLabel('Acknowledge exact C4 plan losses'),
                h.Checked(context.acknowledged),
                h.Disabled(context.acknowledgementReason !== null),
                h.AriaDescribedBy('c4-plan-acknowledgement-reason'),
                h.OnClick(
                  Message.ClickedC4PlanAcknowledgement({
                    ...context.scope,
                    generation: model.c4PlanRun,
                    planKey: plan.key,
                    accepted: !context.acknowledged,
                  }),
                ),
              ]),
              'I acknowledge every listed loss for this exact C4 plan',
            ],
          ),
          h.p(
            [h.Id('c4-plan-acknowledgement-reason'), h.Role('status')],
            [
              context.acknowledgementReason ??
                'Acknowledgement applies only to the current source and choices. Uncheck to withdraw it. No model changes or Apply permission are created.',
            ],
          ),
        ],
      ),
    ],
  );
}
