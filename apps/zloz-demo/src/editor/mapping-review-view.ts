import type { Html } from '@effect/ui/html';

import { workbenchMappingReview } from './mapping-review';
import { Message } from './message';
import type { Model } from './model';
import { receiptReviewPanel } from './receipt-review';

function conversionPlanPanel<M>(
  model: Model,
  h: Html.H<M>,
  send: (message: Message) => M,
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
  return h.details
    .key('conversion-plan')
    .id('mapping-conversion-plan')
    .class('mapping-plan')
    .children(
      h.summary.children('Conversion plan review'),
      h.section.attr('aria-label', 'Conversion plan review').children(
        h.p
          .attr('role', 'status')
          .attr('aria-label', 'Conversion plan status')
          .class('mapping-plan-status')
          .children(status),
        h.h3.children('Source provenance'),
        h.dl
          .class('mapping-provenance')
          .children(
            h.dt.children('Model'),
            h.dd.children(document.name),
            h.dt.children('Snapshot'),
            h.dd.children(context.sourceLabel),
            h.dt.children('Fork ancestry'),
            h.dd.children(
              document.origin
                ? `${document.origin.modelName} · ${document.origin.edition.name}`
                : 'Original model · no fork parent',
            ),
          ),
        h.p.children(
          'Original source graph, camera, editions and ancestry are captured for this review. Previewing does not apply further changes.',
        ),
        h.details
          .class('mapping-source-details')
          .children(
            h.summary.children('Source identifiers'),
            h.p.children(`Model ID: ${document.id}`),
            ...(model.historyReview
              ? [h.p.children(`Edition ID: ${model.historyReview.editionId}`)]
              : []),
          ),
        ...(plan.type === 'blocked'
          ? [
              h.h4.children('Unresolved mappings'),
              h.ul
                .attr('aria-label', 'Conversion plan blockers')
                .children(
                  ...plan.blockers.map((blocker) =>
                    h.li
                      .key(`${blocker.kind}:${blocker.id}`)
                      .children(
                        `${context.items.find((item) => item.kind === blocker.kind && item.id === blocker.id)?.label ?? blocker.id}: ${blocker.reason}`,
                      ),
                  ),
                ),
            ]
          : []),
        ...(plan.preview.disclosures.length
          ? [
              h.h4.children('All prospective semantic losses'),
              h.ul
                .attr('aria-label', 'Plan semantic losses')
                .children(
                  ...plan.preview.disclosures.map((loss) =>
                    h.li
                      .key(`${loss.kind}:${loss.id}`)
                      .children(
                        h.strong.children(
                          context.items.find(
                            (item) => item.kind === loss.kind && item.id === loss.id,
                          )?.label ?? loss.id,
                        ),
                        h.p.children(loss.reason),
                      ),
                  ),
                ),
            ]
          : []),
        h.label.class('workbench-field mapping-acknowledgement').children(
          h.input
            .attr('type', 'checkbox')
            .attr('aria-label', 'Acknowledge plan losses')
            .checked(context.acknowledged)
            .disabled(context.acknowledgementReason !== null)
            .attr('aria-describedby', 'mapping-plan-acknowledgement-reason')
            .on(
              'click',
              send(
                Message.ClickedMappingLossAcknowledgement({
                  ...context.scope,
                  generation: model.mappingConsentRun,
                  planKey: plan.key,
                  accepted: !context.acknowledged,
                }),
              ),
            ),
          'I acknowledge all listed semantic losses for this plan',
        ),
        h.p
          .id('mapping-plan-acknowledgement-reason')
          .children(
            context.acknowledgementReason ??
              'Acknowledgement records review only. The source model and Undo history are unchanged. Uncheck to withdraw it.',
          ),
        h.label.class('workbench-field').children(
          h.input
            .attr('type', 'checkbox')
            .checked(model.protectMappingApply)
            .disabled(context.reason !== null)
            .on('click', send(Message.ClickedMappingApplyProtection())),
          'Protect conversion Apply',
        ),
        h.button
          .attr('type', 'button')
          .attr('aria-label', 'Apply DDD conversion')
          .attr('aria-describedby', 'mapping-apply-reason')
          .disabled(context.applyReason !== null)
          .on(
            'click',
            send(
              Message.ClickedApplyMappingConversion({
                ...context.scope,
                generation: model.mappingConsentRun,
                planKey: plan.key,
              }),
            ),
          )
          .children('Apply DDD conversion'),
        h.p
          .id('mapping-apply-reason')
          .children(
            context.applyReason ??
              'Apply the reviewed meanings together as one Undo step and retain the full provenance receipt in this tab.',
          ),
      ),
    );
}

function retainedReceiptsPanel<M>(
  model: Model,
  h: Html.H<M>,
  send: (message: Message) => M,
  context: ReturnType<typeof workbenchMappingReview>,
) {
  return h.section
    .attr('aria-label', 'Retained conversion receipts')
    .class('mapping-receipts')
    .children(
      h.h3.children('Retained conversion receipts'),
      h.p.children(
        'Retained in this tab, independent of Undo. Download receipts to keep provenance after closing the tab. Model-only JSON does not include them.',
      ),
      ...[...context.receipts].reverse().map((saved) =>
        h.details.key(saved.id).children(
          h.summary.children(
            `Receipt ${saved.sequence} · ${saved.conversion.source.document.name}`,
          ),
          h.p.children(
            'The complete original and converted documents, fork ancestry and reviewed mappings are retained. This is a historical receipt, not a claim about the current diagram.',
          ),
          h.button
            .attr('type', 'button')
            .attr('aria-label', `Download conversion receipt ${saved.sequence}`)
            .on(
              'click',
              send(
                Message.ClickedDownloadConversionReceipt({
                  modelId: model.modelIdentity.id,
                  epoch: model.modelEpoch,
                  receiptId: saved.id,
                }),
              ),
            )
            .children(`Download conversion receipt ${saved.sequence}`),
        ),
      ),
    );
}

export function mappingReviewPanel<M>(model: Model, h: Html.H<M>, send: (message: Message) => M) {
  if (model.receiptReview) return receiptReviewPanel(model, h, send);
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
  return h.section
    .attr('aria-label', 'Workshop mapping preview')
    .class('mapping-review')
    .children(
      h.p
        .class('mapping-review-intro')
        .children(
          'Review workshop intent before modelling it as DDD. Preview choices leave the canvas unchanged; acknowledged Apply commits one Undo step.',
        ),
      ...(diagnostics
        ? [
            h.div
              .class('mapping-summary')
              .attr('aria-label', 'Mapping summary')
              .children(
                h.span.children(
                  `${context.items.filter((item) => item.decision.type === 'proposed').length} proposed`,
                ),
                h.span.children(
                  `${context.items.filter((item) => item.decision.type === 'ambiguous' || item.decision.type === 'unmapped' || item.decision.type === 'blocked').length} unresolved`,
                ),
                h.span.children(`${preview.disclosures.length} prospective losses`),
              ),
          ]
        : []),
      ...(context.items.length
        ? [
            h.label.class('workbench-field').children(
              'Review mapping',
              h.select
                .attr('aria-label', 'Review mapping')
                .on('change', ({ value: key }) =>
                  send(Message.SelectedMappingReviewItem({ ...context.scope, key })),
                )
                .children(
                  ...context.items.map((item) =>
                    h.option
                      .key(item.key)
                      .attr('value', item.key)
                      .selected(selected?.key === item.key)
                      .children(
                        `${item.kind === 'node' ? 'Node' : 'Connection'} · ${item.label} · ${states[item.decision.type]}`,
                      ),
                  ),
                ),
            ),
          ]
        : [
            h.p.children(
              'No EventStorming notes in this source. Open the workshop example to explore proposed mappings.',
            ),
            h.button
              .attr('type', 'button')
              .disabled(model.historyReview !== null)
              .on('click', send(Message.SelectedExample({ example: 'event-storming' })))
              .children('Open event-storming example'),
          ]),
      ...(selected
        ? [
            h.div
              .key(selected.key)
              .class('mapping-decision')
              .attr('data-mapping-state', selected.decision.type)
              .attr('aria-label', 'Mapping decision')
              .children(
                h.span.class('mapping-status').children(states[selected.decision.type]),
                h.h3.children(selected.label),
                h.p
                  .class('mapping-source')
                  .children(
                    `Source: ${selected.decision.sourceArchitecture?.family ?? 'untyped'} · ${selected.decision.sourceArchitecture?.role ?? 'connection'}`,
                  ),
                h.label.class('workbench-field').children(
                  'Preview choice',
                  h.select
                    .attr('aria-label', 'Preview choice')
                    .disabled(reason !== null)
                    .attr('aria-describedby', 'mapping-choice-reason')
                    .on('change', ({ value }) =>
                      send(
                        Message.SelectedMappingReviewChoice({
                          ...context.scope,
                          key: selected.key,
                          value,
                        }),
                      ),
                    )
                    .children(
                      ...context.choices.map((choice) =>
                        h.option
                          .key(choice.value)
                          .attr('value', choice.value)
                          .selected(context.value === choice.value)
                          .children(choice.label),
                      ),
                    ),
                ),
                ...(selected.decision.type === 'proposed'
                  ? [
                      h.p
                        .class('mapping-target')
                        .children(
                          `Proposed: DDD · ${selected.decision.architecture.role} (${selected.decision.origin})`,
                        ),
                    ]
                  : []),
                ...(selected.decision.type === 'ambiguous'
                  ? [
                      h.p.children(
                        `Suggested interpretations: ${selected.decision.candidates.map((candidate) => candidate.role).join(', ')}. You can choose another supported DDD role or keep the workshop note.`,
                      ),
                    ]
                  : []),
                h.p.attr('aria-label', 'Mapping reason').children(selected.decision.reason),
                h.p
                  .id('mapping-choice-reason')
                  .class('mapping-choice-reason')
                  .children(
                    reason ??
                      'Temporary review choice only. Conversion requires separate freshness, policy and loss-consent checks.',
                  ),
                ...losses.map((loss) =>
                  h.div
                    .key(`${loss.kind}:${loss.id}`)
                    .class('mapping-loss')
                    .attr('aria-label', 'Selected mapping loss')
                    .children(h.h4.children('Loss if converted'), h.p.children(loss.reason)),
                ),
              ),
          ]
        : []),
      receiptReviewPanel(model, h, send),
      ...(!model.receiptReview ? [conversionPlanPanel(model, h, send, context)] : []),
      ...(context.receipts.length ? [retainedReceiptsPanel(model, h, send, context)] : []),
      h.p
        .class('mapping-review-footer')
        .children(
          'Preview choices do not apply changes. Use the guarded Apply control to publish a reviewed conversion and retain its receipt.',
        ),
      ...(context.items.length
        ? [
            h.button
              .attr('type', 'button')
              .disabled(context.reason !== null || context.stored.choices.length === 0)
              .on('click', send(Message.ClickedResetMappingReview(context.scope)))
              .children('Reset preview choices'),
          ]
        : []),
      ...(model.mappingReviewNotice
        ? [
            h.p
              .attr('role', 'status')
              .attr('aria-label', 'Mapping review feedback')
              .children(model.mappingReviewNotice),
          ]
        : []),
    );
}
