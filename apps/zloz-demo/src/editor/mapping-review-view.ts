import type { HtmlBuilder } from 'foldkit/html';

import { workbenchMappingReview } from './mapping-review';
import { Message } from './message';
import type { Model } from './model';
import { receiptReviewPanel } from './receipt-review';

function conversionPlanPanel(
  model: Model,
  h: HtmlBuilder<Message>,
  context: ReturnType<typeof workbenchMappingReview>,
) {
  const { plan } = context.conversion;
  const document = plan.provenance.document;
  const status = {
    blocked: 'Resolve remaining mappings',
    unchanged: 'No conversion changes',
    'consent-required': 'Loss acknowledgement needed',
    consented: 'Losses acknowledged for this plan',
  }[context.conversion.type];
  return h.details(
    [h.Key('conversion-plan'), h.Id('mapping-conversion-plan'), h.Class('mapping-plan')],
    [
      h.summary([], ['Conversion plan review']),
      h.section(
        [h.AriaLabel('Conversion plan review')],
        [
          h.p(
            [
              h.Role('status'),
              h.AriaLabel('Conversion plan status'),
              h.Class('mapping-plan-status'),
            ],
            [status],
          ),
          h.h3([], ['Source provenance']),
          h.dl(
            [h.Class('mapping-provenance')],
            [
              h.dt([], ['Model']),
              h.dd([], [document.name]),
              h.dt([], ['Snapshot']),
              h.dd([], [context.sourceLabel]),
              h.dt([], ['Fork ancestry']),
              h.dd(
                [],
                [
                  document.origin
                    ? `${document.origin.modelName} · ${document.origin.edition.name}`
                    : 'Original model · no fork parent',
                ],
              ),
            ],
          ),
          h.p(
            [],
            [
              'Original source graph, camera, editions and ancestry are captured for this review. Previewing does not apply further changes.',
            ],
          ),
          h.details(
            [h.Class('mapping-source-details')],
            [
              h.summary([], ['Source identifiers']),
              h.p([], [`Model ID: ${document.id}`]),
              ...(model.historyReview
                ? [h.p([], [`Edition ID: ${model.historyReview.editionId}`])]
                : []),
            ],
          ),
          ...(plan.type === 'blocked'
            ? [
                h.h4([], ['Unresolved mappings']),
                h.ul(
                  [h.AriaLabel('Conversion plan blockers')],
                  plan.blockers.map((blocker) =>
                    h.li(
                      [h.Key(`${blocker.kind}:${blocker.id}`)],
                      [
                        `${context.items.find((item) => item.kind === blocker.kind && item.id === blocker.id)?.label ?? blocker.id}: ${blocker.reason}`,
                      ],
                    ),
                  ),
                ),
              ]
            : []),
          ...(plan.preview.disclosures.length
            ? [
                h.h4([], ['All prospective semantic losses']),
                h.ul(
                  [h.AriaLabel('Plan semantic losses')],
                  plan.preview.disclosures.map((loss) =>
                    h.li(
                      [h.Key(`${loss.kind}:${loss.id}`)],
                      [
                        h.strong(
                          [],
                          [
                            context.items.find(
                              (item) => item.kind === loss.kind && item.id === loss.id,
                            )?.label ?? loss.id,
                          ],
                        ),
                        h.p([], [loss.reason]),
                      ],
                    ),
                  ),
                ),
              ]
            : []),
          h.label(
            [h.Class('workbench-field mapping-acknowledgement')],
            [
              h.input([
                h.Type('checkbox'),
                h.AriaLabel('Acknowledge plan losses'),
                h.Checked(context.acknowledged),
                h.Disabled(context.acknowledgementReason !== null),
                h.AriaDescribedBy('mapping-plan-acknowledgement-reason'),
                h.OnClick(
                  Message.ClickedMappingLossAcknowledgement({
                    ...context.scope,
                    generation: model.mappingConsentRun,
                    planKey: plan.key,
                    accepted: !context.acknowledged,
                  }),
                ),
              ]),
              'I acknowledge all listed semantic losses for this plan',
            ],
          ),
          h.p(
            [h.Id('mapping-plan-acknowledgement-reason')],
            [
              context.acknowledgementReason ??
                'Acknowledgement records review only. The source model and Undo history are unchanged. Uncheck to withdraw it.',
            ],
          ),
          h.label(
            [h.Class('workbench-field')],
            [
              h.input([
                h.Type('checkbox'),
                h.Checked(model.protectMappingApply),
                h.Disabled(context.reason !== null),
                h.OnClick(Message.ClickedMappingApplyProtection()),
              ]),
              'Protect conversion Apply',
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.AriaLabel('Apply DDD conversion'),
              h.AriaDescribedBy('mapping-apply-reason'),
              h.Disabled(context.applyReason !== null),
              h.OnClick(
                Message.ClickedApplyMappingConversion({
                  ...context.scope,
                  generation: model.mappingConsentRun,
                  planKey: plan.key,
                }),
              ),
            ],
            ['Apply DDD conversion'],
          ),
          h.p(
            [h.Id('mapping-apply-reason')],
            [
              context.applyReason ??
                'Apply the reviewed meanings together as one Undo step and retain the full provenance receipt in this tab.',
            ],
          ),
        ],
      ),
    ],
  );
}

function retainedReceiptsPanel(
  model: Model,
  h: HtmlBuilder<Message>,
  context: ReturnType<typeof workbenchMappingReview>,
) {
  if (!context.receipts.length) return null;
  return h.section(
    [h.AriaLabel('Retained conversion receipts'), h.Class('mapping-receipts')],
    [
      h.h3([], ['Retained conversion receipts']),
      h.p(
        [],
        [
          'Retained in this tab, independent of Undo. Download receipts to keep provenance after closing the tab. Model-only JSON does not include them.',
        ],
      ),
      ...[...context.receipts].reverse().map((saved) =>
        h.details(
          [h.Key(saved.id)],
          [
            h.summary([], [`Receipt ${saved.sequence} · ${saved.conversion.source.document.name}`]),
            h.p(
              [],
              [
                'The complete original and converted documents, fork ancestry and reviewed mappings are retained. This is a historical receipt, not a claim about the current diagram.',
              ],
            ),
            h.button(
              [
                h.Type('button'),
                h.AriaLabel(`Download conversion receipt ${saved.sequence}`),
                h.OnClick(
                  Message.ClickedDownloadConversionReceipt({
                    modelId: model.modelIdentity.id,
                    epoch: model.modelEpoch,
                    receiptId: saved.id,
                  }),
                ),
              ],
              [`Download conversion receipt ${saved.sequence}`],
            ),
          ],
        ),
      ),
    ],
  );
}

export function mappingReviewPanel(model: Model, h: HtmlBuilder<Message>) {
  if (model.receiptReview) return receiptReviewPanel(model, h);
  const context = workbenchMappingReview(model),
    { selected, preview } = context;
  const diagnostics = model.diagnosticsEnabled && !model.minimalMode && model.diagnostics.status;
  const losses = selected
    ? preview.disclosures.filter((loss) => loss.kind === selected.kind && loss.id === selected.id)
    : [];
  const alreadyDdd =
    selected?.kind === 'edge' && selected.decision.sourceArchitecture?.family === 'ddd';
  const reason =
    context.reason ??
    (alreadyDdd
      ? 'Existing DDD relationships are inspected here. Workshop choices cannot replace their meaning.'
      : null);
  const states = {
    proposed: 'Proposed',
    ambiguous: 'Needs a choice',
    unmapped: 'Unmapped',
    retained: 'Retained',
    blocked: 'Incompatible',
  };
  return h.section(
    [h.AriaLabel('Workshop mapping preview'), h.Class('mapping-review')],
    [
      h.p(
        [h.Class('mapping-review-intro')],
        [
          'Review workshop intent before modelling it as DDD. Preview choices leave the canvas unchanged; acknowledged Apply commits one Undo step.',
        ],
      ),
      ...(diagnostics
        ? [
            h.div(
              [h.Class('mapping-summary'), h.AriaLabel('Mapping summary')],
              [
                h.span(
                  [],
                  [
                    `${context.items.filter((item) => item.decision.type === 'proposed').length} proposed`,
                  ],
                ),
                h.span(
                  [],
                  [
                    `${context.items.filter((item) => item.decision.type === 'ambiguous' || item.decision.type === 'unmapped' || item.decision.type === 'blocked').length} unresolved`,
                  ],
                ),
                h.span([], [`${preview.disclosures.length} prospective losses`]),
              ],
            ),
          ]
        : []),
      ...(context.items.length
        ? [
            h.label(
              [h.Class('workbench-field')],
              [
                'Review mapping',
                h.select(
                  [
                    h.AriaLabel('Review mapping'),
                    h.OnChange((key) =>
                      Message.SelectedMappingReviewItem({ ...context.scope, key }),
                    ),
                  ],
                  context.items.map((item) =>
                    h.option(
                      [h.Key(item.key), h.Value(item.key), h.Selected(selected?.key === item.key)],
                      [
                        `${item.kind === 'node' ? 'Node' : 'Connection'} · ${item.label} · ${states[item.decision.type]}`,
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ]
        : [
            h.p(
              [],
              [
                'No EventStorming notes in this source. Open the workshop example to explore proposed mappings.',
              ],
            ),
            h.button(
              [
                h.Type('button'),
                h.Disabled(model.historyReview !== null),
                h.OnClick(Message.SelectedExample({ example: 'event-storming' })),
              ],
              ['Open event-storming example'],
            ),
          ]),
      ...(selected
        ? [
            h.div(
              [
                h.Key(selected.key),
                h.Class('mapping-decision'),
                h.DataAttribute('mapping-state', selected.decision.type),
                h.AriaLabel('Mapping decision'),
              ],
              [
                h.span([h.Class('mapping-status')], [states[selected.decision.type]]),
                h.h3([], [selected.label]),
                h.p(
                  [h.Class('mapping-source')],
                  [
                    `Source: ${selected.decision.sourceArchitecture?.family ?? 'untyped'} · ${selected.decision.sourceArchitecture?.role ?? 'connection'}`,
                  ],
                ),
                h.label(
                  [h.Class('workbench-field')],
                  [
                    'Preview choice',
                    h.select(
                      [
                        h.AriaLabel('Preview choice'),
                        h.Disabled(reason !== null),
                        h.AriaDescribedBy('mapping-choice-reason'),
                        h.OnChange((value) =>
                          Message.SelectedMappingReviewChoice({
                            ...context.scope,
                            key: selected.key,
                            value,
                          }),
                        ),
                      ],
                      context.choices.map((choice) =>
                        h.option(
                          [
                            h.Key(choice.value),
                            h.Value(choice.value),
                            h.Selected(context.value === choice.value),
                          ],
                          [choice.label],
                        ),
                      ),
                    ),
                  ],
                ),
                ...(selected.decision.type === 'proposed'
                  ? [
                      h.p(
                        [h.Class('mapping-target')],
                        [
                          `Proposed: DDD · ${selected.decision.architecture.role} (${selected.decision.origin})`,
                        ],
                      ),
                    ]
                  : []),
                ...(selected.decision.type === 'ambiguous'
                  ? [
                      h.p(
                        [],
                        [
                          `Suggested interpretations: ${selected.decision.candidates.map((candidate) => candidate.role).join(', ')}. You can choose another supported DDD role or keep the workshop note.`,
                        ],
                      ),
                    ]
                  : []),
                h.p([h.AriaLabel('Mapping reason')], [selected.decision.reason]),
                h.p(
                  [h.Id('mapping-choice-reason'), h.Class('mapping-choice-reason')],
                  [
                    reason ??
                      'Temporary review choice only. Conversion requires separate freshness, policy and loss-consent checks.',
                  ],
                ),
                ...losses.map((loss) =>
                  h.div(
                    [
                      h.Key(`${loss.kind}:${loss.id}`),
                      h.Class('mapping-loss'),
                      h.AriaLabel('Selected mapping loss'),
                    ],
                    [h.h4([], ['Loss if converted']), h.p([], [loss.reason])],
                  ),
                ),
              ],
            ),
          ]
        : []),
      receiptReviewPanel(model, h),
      ...(!model.receiptReview ? [conversionPlanPanel(model, h, context)] : []),
      ...(context.receipts.length ? [retainedReceiptsPanel(model, h, context)] : []),
      h.p(
        [h.Class('mapping-review-footer')],
        [
          'Preview choices do not apply changes. Use the guarded Apply control to publish a reviewed conversion and retain its receipt.',
        ],
      ),
      ...(context.items.length
        ? [
            h.button(
              [
                h.Type('button'),
                h.Disabled(context.reason !== null || context.stored.choices.length === 0),
                h.OnClick(Message.ClickedResetMappingReview(context.scope)),
              ],
              ['Reset preview choices'],
            ),
          ]
        : []),
      ...(model.mappingReviewNotice
        ? [
            h.p(
              [h.Role('status'), h.AriaLabel('Mapping review feedback')],
              [model.mappingReviewNotice],
            ),
          ]
        : []),
    ],
  );
}
