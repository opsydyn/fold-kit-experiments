import { serializeModelDocument } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { expect, test } from 'vitest';

import { workbenchMappingReview } from '../src/editor/mapping-review';
import { mappingReviewPanel } from '../src/editor/mapping-review-view';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { workbenchDocument } from '../src/editor/model-sessions';
import { update } from '../src/editor/update';
function opened(): Model {
  return {
    ...update(init().model, Message.SelectedExample({ example: 'event-storming' })).model,
    sidebarSection: 'mapping',
  };
}
function choose(model: Model, key: string, value: string) {
  return update(
    model,
    Message.SelectedMappingReviewChoice({ ...workbenchMappingReview(model).scope, key, value }),
  ).model;
}
function reviewable(): Model {
  let model = opened();
  for (const id of ['note:0', 'note:1', 'note:4', 'note:5'])
    model = choose(model, `node:${id}`, 'retain');
  for (const id of ['step:0', 'step:1', 'step:3', 'step:4'])
    model = choose(model, `edge:${id}`, 'retain');
  return model;
}
function acknowledge(model: Model, accepted = true) {
  const context = workbenchMappingReview(model);
  return Message.ClickedMappingLossAcknowledgement({
    ...context.scope,
    generation: model.mappingConsentRun,
    planKey: context.conversion.plan.key,
    accepted,
  });
}
test('blocked plans cannot be acknowledged; reviewable plans expose source provenance and record only temporary exact-plan consent', () => {
  const blocked = opened();
  expect(workbenchMappingReview(blocked).conversion.type).toBe('blocked');
  expect(update(blocked, acknowledge(blocked)).model).toBe(blocked);
  const model = reviewable(),
    before = serializeModelDocument(workbenchDocument(model));
  const context = workbenchMappingReview(model);
  expect(context.conversion.type).toBe('consent-required');
  expect(context.conversion.plan.provenance.document).toEqual(workbenchDocument(model));
  expect(context.conversion.plan.provenance.sessionId).toContain(model.modelNamespace);
  expect(context.conversion.plan.preview.disclosures.map((loss) => loss.id)).toEqual([
    'note:3',
    'step:2',
  ]);
  const recorded = update(model, acknowledge(model)).model;
  expect(workbenchMappingReview(recorded).conversion.type).toBe('consented');
  expect(recorded.editor).toBe(model.editor);
  expect(recorded.editions).toBe(model.editions);
  expect(recorded.modelIdentity).toBe(model.modelIdentity);
  expect(serializeModelDocument(workbenchDocument(recorded))).toBe(before);
  expect(recorded.editor.past).toEqual([]);
});
test('revocation and changed-then-restored camera cannot replay an old checked callback', () => {
  const model = reviewable(),
    old = acknowledge(model),
    accepted = update(model, old).model;
  const revoked = update(accepted, acknowledge(accepted, false)).model;
  expect(revoked.mappingLossConsent).toBeNull();
  expect(update(revoked, old).model).toBe(revoked);
  const restoredAcceptance = update(revoked, acknowledge(revoked)).model;
  const viewport = restoredAcceptance.editor.viewport;
  const moved = update(
    restoredAcceptance,
    Message.ObservedZlozInput({
      message: { type: 'ViewportChanged', viewport: { ...viewport, x: viewport.x + 20 } },
    }),
  ).model;
  expect(moved.mappingLossConsent).toBeNull();
  const returned = update(
    moved,
    Message.ObservedZlozInput({ message: { type: 'ViewportChanged', viewport } }),
  ).model;
  expect(workbenchMappingReview(returned).conversion.plan.key).toBe(
    workbenchMappingReview(model).conversion.plan.key,
  );
  expect(update(returned, old).model).toBe(returned);
  expect(update(returned, acknowledge(returned)).model.mappingLossConsent).not.toBeNull();
});
test('choices, reset, edition capture and source replacement clear acknowledgement without changing the source graph', () => {
  const model = reviewable(),
    accepted = update(model, acknowledge(model)).model;
  const changed = choose(accepted, 'node:note:1', 'domain-service');
  expect(changed.mappingLossConsent).toBeNull();
  expect(changed.editor).toBe(accepted.editor);
  const reset = update(
    accepted,
    Message.ClickedResetMappingReview(workbenchMappingReview(accepted).scope),
  ).model;
  expect(reset.mappingLossConsent).toBeNull();
  const named = update(accepted, Message.ChangedEditionName({ name: 'Reviewed source' })).model;
  const captured = update(named, Message.ClickedCaptureEdition()).model;
  expect(captured.mappingLossConsent).toBeNull();
  expect(captured.editor).toBe(accepted.editor);
  const fresh = update(captured, acknowledge(captured)).model;
  const historical = update(
    fresh,
    Message.SelectedHistoryEdition({ id: fresh.editions[0]?.id ?? '' }),
  ).model;
  expect(historical.mappingLossConsent).toBeNull();
  expect(workbenchMappingReview(historical).sourceLabel).toContain('Reviewed source');
  expect(workbenchMappingReview(historical).acknowledgementReason).toContain('Return');
  expect(update(historical, acknowledge(historical)).model).toBe(historical);
  const reopened = update(accepted, Message.SelectedExample({ example: 'event-storming' })).model;
  expect(reopened.mappingLossConsent).toBeNull();
  expect(update(reopened, acknowledge(accepted)).model).toBe(reopened);
});
test('stale plan, generation, scope and hidden/busy panel callbacks cannot record acceptance', () => {
  const model = reviewable(),
    message = acknowledge(model);
  for (const request of [
    { ...message, planKey: 'obsolete' },
    { ...message, generation: message.generation - 1 },
    { ...message, modelId: 'other' },
    { ...message, epoch: message.epoch + 1 },
  ])
    expect(update(model, request).model).toBe(model);
  for (const state of [
    { ...model, sidebarCollapsed: true },
    { ...model, sidebarSection: 'diagram' as const },
    { ...model, importing: { id: 1, revision: model.editor.revision } },
  ])
    expect(update(state, message).model.mappingLossConsent).toBeNull();
  const accepted = update(model, message).model;
  const busy = update(accepted, Message.ClickedLoad()).model;
  expect(busy.mappingLossConsent).toBeNull();
  expect(workbenchMappingReview(busy).acknowledgementReason).toContain('Finish');
});
async function render(model: Model) {
  return (
    await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model }),
          view: (current, h: HtmlBuilder<Message>) => ({
            title: 'Plan review',
            body: mappingReviewPanel(current, h),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    )
  ).html;
}
test('native acknowledgement, provenance, losses and protection remain visible independently of diagnostics; keys never render', async () => {
  const model = reviewable(),
    context = workbenchMappingReview(model);
  const accepted = update(model, acknowledge(model)).model;
  const html = await render({ ...accepted, minimalMode: true, diagnosticsEnabled: false });
  expect(html).toContain('Source provenance');
  expect(html).toContain('Working model');
  expect(html).toContain('I acknowledge all listed semantic losses for this plan');
  expect(html).toMatch(
    /<input\b(?=[^>]*aria-label="Acknowledge plan losses")(?=[^>]*checked)[^>]*>/u,
  );
  expect(html).toContain('Losses acknowledged for this plan');
  expect(html).toContain('Original source graph, camera, editions and ancestry are captured');
  expect(html).not.toContain(context.conversion.plan.key);
  expect(html).not.toContain('&quot;provenance&quot;');
  expect(html).not.toContain('aria-label="Mapping summary"');
  const blocked = await render(opened());
  expect(blocked).toMatch(
    /<input\b(?=[^>]*aria-label="Acknowledge plan losses")(?=[^>]*disabled)[^>]*>/u,
  );
  expect(blocked).toContain('aria-describedby="mapping-plan-acknowledgement-reason"');
});
