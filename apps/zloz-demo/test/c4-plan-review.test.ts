import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { captureEdition, createHistoryReview } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import { workbenchC4MappingReview } from '../src/editor/c4-mapping-review';
import { c4MappingReviewPanel } from '../src/editor/c4-mapping-review-view';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
function selected(model: Model, key: string) {
  return update(
    model,
    Message.SelectedC4ReviewItem({ ...workbenchC4MappingReview(model).scope, key }),
  ).model;
}
function action(model: Model, action: 'preview' | 'retain') {
  const context = workbenchC4MappingReview(model);
  return update(
    model,
    Message.ClickedC4ReviewAction({ ...context.scope, key: context.selected?.key ?? '', action }),
  ).model;
}
function ready(): Model {
  let model: Model = {
    ...update(init().model, Message.SelectedExample({ example: 'event-storming-workshop' })).model,
    sidebarSection: 'c4mapping' as const,
  };
  model = selected(model, 'node:request');
  model = update(
    model,
    Message.ChangedC4ReviewForm({
      ...workbenchC4MappingReview(model).scope,
      key: 'node:request',
      field: 'role',
      value: 'container',
    }),
  ).model;
  model = action(model, 'preview');
  for (const item of workbenchC4MappingReview(model).items.filter(
    (item) => item.key !== 'node:request',
  ))
    model = action(selected(model, item.key), 'retain');
  return model;
}
test('complete mapping choices still require explicit placement before exact loss acknowledgement', () => {
  const model = ready(),
    context = workbenchC4MappingReview(model);
  expect(context.conversion?.type).toBe('blocked');
  expect(model.editor.past).toHaveLength(0);
});
function placementField(model: Model, field: 'type' | 'parentId', value: string) {
  const context = workbenchC4MappingReview(model);
  return update(
    model,
    Message.ChangedC4PlacementForm({
      ...context.scope,
      nodeId: context.member?.nodeId ?? '',
      field,
      value,
    }),
  ).model;
}
function reviewPlacement(model: Model) {
  const context = workbenchC4MappingReview(model);
  return update(
    model,
    Message.ClickedC4PlacementReview({ ...context.scope, nodeId: context.member?.nodeId ?? '' }),
  ).model;
}
function acknowledgement(model: Model, accepted: boolean) {
  const context = workbenchC4MappingReview(model);
  return Message.ClickedC4PlanAcknowledgement({
    ...context.scope,
    generation: model.c4PlanRun,
    planKey: context.plan.key,
    accepted,
  });
}
function reviewable() {
  return reviewPlacement(placementField(ready(), 'type', 'organization'));
}
test('placement is staged, losses are package-owned and acknowledgement is explicit/revocable without editor commands', () => {
  const before = ready(),
    staged = placementField(before, 'type', 'organization');
  expect(workbenchC4MappingReview(staged).conversion.type).toBe('blocked');
  const chosen = reviewPlacement(staged),
    context = workbenchC4MappingReview(chosen);
  expect(context.conversion.type).toBe('consent-required');
  expect(context.plan.disclosures.map((d) => d.code)).toEqual(['workshop-meaning-replaced']);
  expect(context.plan.memberships[0]).toMatchObject({
    type: 'resolved',
    placement: { type: 'organization' },
  });
  const result = update(chosen, acknowledgement(chosen, true));
  expect(result.commands).toBeUndefined();
  expect(workbenchC4MappingReview(result.model).conversion.type).toBe('consented');
  expect(result.model.editor).toBe(before.editor);
  expect(result.model.editions).toBe(before.editions);
  expect(result.model.modelIdentity).toBe(before.modelIdentity);
  const old = acknowledgement(chosen, true);
  const withdrawn = update(result.model, acknowledgement(result.model, false)).model;
  expect(withdrawn.c4PlanConsent).toBeNull();
  expect(update(withdrawn, old).model.c4PlanConsent).toBeNull();
  expect(withdrawn.c4PlanRun).toBeGreaterThan(chosen.c4PlanRun);
});
test('source camera round trips cannot resurrect acknowledgement even when the exact plan key returns', () => {
  const source = reviewable(),
    original = workbenchC4MappingReview(source),
    old = acknowledgement(source, true);
  let model = update(source, old).model;
  model = update(
    model,
    Message.ObservedZlozInput({
      message: { type: 'ViewportChanged', viewport: { x: 80, y: 90, zoom: 0.6 } },
    }),
  ).model;
  expect(model.c4PlanConsent).toBeNull();
  expect(workbenchC4MappingReview(model).stored.choices).toEqual(original.stored.choices);
  model = update(
    model,
    Message.ObservedZlozInput({
      message: { type: 'ViewportChanged', viewport: source.editor.viewport },
    }),
  ).model;
  expect(workbenchC4MappingReview(model).plan.key).toBe(original.plan.key);
  expect(update(model, old).model.c4PlanConsent).toBeNull();
});
test('hidden/collapsed, stale-generation and foreign plan callbacks fail closed', () => {
  const source = reviewable(),
    old = acknowledgement(source, true);
  expect(update({ ...source, sidebarCollapsed: true }, old).model.c4PlanConsent).toBeNull();
  const hidden = update(source, Message.SelectedWorkbenchSection({ section: 'diagram' })).model;
  expect(update(hidden, old).model.c4PlanConsent).toBeNull();
  const reopened = update(hidden, Message.SelectedWorkbenchSection({ section: 'c4mapping' })).model;
  expect(update(reopened, old).model.c4PlanConsent).toBeNull();
  for (const request of [
    { ...old, planKey: 'foreign' },
    { ...old, generation: -1 },
    { ...old, epoch: old.epoch + 1 },
  ])
    expect(update(source, request).model.c4PlanConsent).toBeNull();
  const blocked = ready();
  expect(update(blocked, acknowledgement(blocked, true)).model.c4PlanConsent).toBeNull();
});
test('placement and mapping changes revoke acknowledgement and obsolete member choices never resurrect', () => {
  const source = reviewable(),
    acknowledged = update(source, acknowledgement(source, true)).model;
  const cleared = update(
    acknowledged,
    Message.ClickedC4PlacementClear({
      ...workbenchC4MappingReview(acknowledged).scope,
      nodeId: 'request',
    }),
  ).model;
  expect(cleared.c4PlanConsent).toBeNull();
  expect(workbenchC4MappingReview(cleared).conversion.type).toBe('blocked');
  const retained = action(selected(acknowledged, 'node:request'), 'retain');
  expect(workbenchC4MappingReview(retained).plan.type).toBe('unchanged');
  expect(retained.c4MappingReview?.memberships).toEqual([]);
  expect(retained.c4PlanConsent).toBeNull();
  const reselected = selected(retained, 'node:request');
  const remapped = action(
    update(
      reselected,
      Message.ChangedC4ReviewForm({
        ...workbenchC4MappingReview(reselected).scope,
        key: 'node:request',
        field: 'role',
        value: 'container',
      }),
    ).model,
    'preview',
  );
  expect(workbenchC4MappingReview(remapped).member?.type).toBe('unresolved');
});
test('invalid containment reports package reasons without inventing a parent or changing source state', () => {
  const source = ready();
  let model = placementField(source, 'type', 'contained');
  expect(workbenchC4MappingReview(model).placementForm.parentId).toBe('');
  expect(reviewPlacement(model)).toBe(model);
  model = placementField(model, 'parentId', 'workshop-lane');
  model = reviewPlacement(model);
  expect(workbenchC4MappingReview(model).member).toMatchObject({
    type: 'blocked',
    code: 'parent-not-c4-boundary',
  });
  expect(workbenchC4MappingReview(model).acknowledgementReason).toContain('Resolve');
  expect(model.editor).toBe(source.editor);
  expect(placementField(model, 'parentId', 'missing')).toBe(model);
});
test('historical inspection protects placement and acknowledgement with visible reasons', () => {
  const source = reviewable(),
    edition = captureEdition({
      id: 'old',
      name: 'Past discovery',
      snapshot: { graph: source.editor.graph },
    });
  const historical = { ...source, historyReview: createHistoryReview(edition, source.editor) };
  expect(workbenchC4MappingReview(historical).acknowledgementReason).toContain('Return');
  expect(update(historical, acknowledgement(historical, true)).model.c4PlanConsent).toBeNull();
  const busy = { ...source, importing: { id: 1, revision: source.editor.revision } };
  expect(workbenchC4MappingReview(busy).placementReason).toContain('Finish active');
  expect(placementField(busy, 'type', 'root').editor).toBe(source.editor);
});
async function render(model: Model) {
  return (
    await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model }),
          view: (current, h: HtmlBuilder<Message>) => ({
            title: 'C4 plan',
            body: c4MappingReviewPanel(current, h),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    )
  ).html;
}
test('native exact-plan controls preserve semantic provenance/losses in Minimal mode without raw keys', async () => {
  const model = reviewable(),
    context = workbenchC4MappingReview(model);
  const html = await render({ ...model, minimalMode: true, diagnosticsEnabled: false });
  expect(html).toContain('C4 conversion plan review');
  expect(html).toContain('aria-label="Acknowledge exact C4 plan losses"');
  expect(html).toContain('aria-describedby="c4-plan-acknowledgement-reason"');
  expect(html).toContain('Full graph, camera, editions and fork ancestry');
  expect(html).toContain('C4 interpretation would replace');
  expect(html).not.toContain(context.plan.key);
  expect(html).not.toContain('Apply DDD conversion');
  expect(html).not.toContain('C4 source identifiers');
});

test('read-only open/close branches invalidate old acknowledgement even when returning to the same plan key', () => {
  const source = reviewable(),
    old = acknowledgement(source, true),
    originalKey = workbenchC4MappingReview(source).plan.key;
  let model = update(source, old).model;
  model = update(model, Message.SelectedWorkbenchSection({ section: 'alchemy' })).model;
  expect(model.c4PlanConsent).not.toBeNull();
  const text = readFileSync(new URL('../src/editor/alchemy-example.json', import.meta.url), 'utf8');
  model = update(model, Message.ChangedAlchemyText({ text })).model;
  model = update(model, Message.ClickedAlchemyReview()).model;
  expect(model.c4PlanConsent).toBeNull();
  model = update(model, Message.ClickedCloseAlchemyReview()).model;
  model = update(model, Message.SelectedWorkbenchSection({ section: 'c4mapping' })).model;
  expect(workbenchC4MappingReview(model).plan.key).toBe(originalKey);
  expect(update(model, old).model.c4PlanConsent).toBeNull();
  expect(model.editor).toBe(source.editor);
});
test('lane interpretation exposes all required members and explicit compatible containment resolves the complete plan', () => {
  const source = reviewable();
  let model = selected(source, 'node:workshop-lane');
  model = update(
    model,
    Message.ChangedC4ReviewForm({
      ...workbenchC4MappingReview(model).scope,
      key: 'node:workshop-lane',
      field: 'role',
      value: 'software-system',
    }),
  ).model;
  model = action(model, 'preview');
  expect(workbenchC4MappingReview(model).plan.memberships.map((m) => m.nodeId)).toEqual([
    'workshop-lane',
    'request',
    'provider',
    'accepted',
    'retry-question',
    'timeout-agreement',
  ]);
  expect(
    workbenchC4MappingReview(model).plan.memberships.find((m) => m.nodeId === 'request'),
  ).toMatchObject({ type: 'blocked', code: 'c4-parent-requires-containment' });
  for (const member of workbenchC4MappingReview(model).plan.memberships) {
    model = update(
      model,
      Message.SelectedC4PlacementMember({
        ...workbenchC4MappingReview(model).scope,
        nodeId: member.nodeId,
      }),
    ).model;
    model = placementField(model, 'type', member.nodeId === 'request' ? 'contained' : 'root');
    if (member.nodeId === 'request') model = placementField(model, 'parentId', 'workshop-lane');
    model = reviewPlacement(model);
  }
  expect(workbenchC4MappingReview(model).conversion.type).toBe('consent-required');
  expect(
    workbenchC4MappingReview(model).plan.disclosures.some((d) => d.code === 'containment-declared'),
  ).toBe(true);
  expect(model.editor).toBe(source.editor);
  expect(model.editions).toBe(source.editions);
});

function applyRequest(model: Model) {
  const context = workbenchC4MappingReview(model);
  return Message.ClickedC4ConversionApply({
    ...context.scope,
    planKey: context.plan.key,
    generation: model.c4PlanRun,
  });
}
function consented() {
  const model = { ...reviewable(), semanticRelationships: false };
  return update(model, acknowledgement(model, true)).model;
}
test('C4 Apply publishes editor and frozen record in one command-free update; Undo keeps the record', () => {
  const model = consented(),
    before = JSON.stringify(model.editor.graph);
  const result = update(model, applyRequest(model));
  expect(result.commands).toBeUndefined();
  expect(result.model.editor.revision).toBe(model.editor.revision + 1);
  expect(result.model.editor.past).toEqual([model.editor.graph]);
  expect(
    result.model.editor.graph.nodes.find((n) => n.id === 'request')?.architecture?.family,
  ).toBe('c4');
  expect(result.model.c4Conversions).toHaveLength(1);
  const retained = result.model.c4Conversions[0];
  expect(retained?.source.document.snapshot.graph).toEqual(model.editor.graph);
  expect(retained?.document.snapshot.graph).toEqual(result.model.editor.graph);
  expect(Object.isFrozen(retained)).toBe(true);
  expect(result.model.editions).toBe(model.editions);
  expect(result.model.modelIdentity).toBe(model.modelIdentity);
  expect(result.model.c4PlanConsent).toBeNull();
  expect(result.model.c4MappingReview).toBeNull();
  expect(JSON.stringify(model.editor.graph)).toBe(before);
  const undone = update(
    result.model,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(model.editor.graph);
  expect(undone.c4Conversions).toBe(result.model.c4Conversions);
  const redone = update(
    undone,
    Message.ObservedZlozInput({ message: { type: 'RedoPressed' } }),
  ).model;
  expect(redone.editor.graph).toEqual(result.model.editor.graph);
  expect(update(undone, applyRequest(model)).model.editor).toBe(undone.editor);
});
test('without consent, with withdrawn consent and with changed choices Apply cannot create a record', () => {
  const plain = reviewable(),
    model = consented(),
    old = applyRequest(model);
  const withdrawn = update(model, acknowledgement(model, false)).model;
  const edited = placementField(model, 'type', 'root');
  for (const current of [plain, withdrawn, edited]) {
    const result = update(current, old).model;
    expect(result.editor).toBe(current.editor);
    expect(result.c4Conversions).toHaveLength(0);
  }
});
test('hidden, foreign, stale-generation and replayed Apply callbacks are inert', () => {
  const model = consented(),
    request = applyRequest(model);
  for (const current of [
    { ...model, sidebarCollapsed: true },
    { ...model, sidebarSection: 'diagram' as const },
  ]) {
    expect(update(current, request).model.editor).toBe(current.editor);
    expect(update(current, request).model.c4Conversions).toHaveLength(0);
  }
  for (const message of [
    { ...request, planKey: 'foreign' },
    { ...request, generation: -1 },
    { ...request, epoch: request.epoch + 1 },
  ])
    expect(update(model, message).model.c4Conversions).toHaveLength(0);
  const applied = update(model, request).model;
  expect(update(applied, request).model.c4Conversions).toHaveLength(1);
  expect(update(applied, request).model.editor).toBe(applied.editor);
});
test('Apply rechecks live read-only, busy, Undo and host protection state and displays the reason', () => {
  const model = consented(),
    request = applyRequest(model);
  for (const editor of [
    { ...model.editor, readOnly: true },
    { ...model.editor, historyLimit: 0 },
    { ...model.editor, connection: { node: 'request', port: 'out' } },
  ]) {
    const current = { ...model, editor },
      result = update(current, request).model;
    expect(result.editor).toBe(editor);
    expect(result.c4Conversions).toHaveLength(0);
    expect(result.c4ApplyNotice.length).toBeGreaterThan(0);
  }
  const protectedModel = update(model, Message.ClickedC4ApplyProtection()).model;
  expect(protectedModel.protectC4Apply).toBe(true);
  expect(protectedModel.c4PlanConsent).toBeNull();
  expect(workbenchC4MappingReview(protectedModel).applyReason).toContain('protected');
  const restored = update(protectedModel, Message.ClickedC4ApplyProtection()).model;
  expect(restored.c4PlanConsent).toBeNull();
  expect(update(restored, request).model.c4Conversions).toHaveLength(0);
});
test('source camera round trips cannot replay Apply', () => {
  const model = consented(),
    request = applyRequest(model);
  let current = update(
    model,
    Message.ObservedZlozInput({
      message: { type: 'ViewportChanged', viewport: { x: 80, y: 90, zoom: 0.6 } },
    }),
  ).model;
  current = update(
    current,
    Message.ObservedZlozInput({
      message: { type: 'ViewportChanged', viewport: model.editor.viewport },
    }),
  ).model;
  expect(workbenchC4MappingReview(current).plan.key).toBe(request.planKey);
  expect(update(current, request).model.c4Conversions).toHaveLength(0);
});
test('records survive example changes and Minimal mode shows guarded Apply and provenance without raw plan keys', async () => {
  const model = consented(),
    result = update(model, applyRequest(model)).model;
  const next = update(result, Message.SelectedExample({ example: 'event-storming' })).model;
  expect(next.c4Conversions).toBe(result.c4Conversions);
  const html = await render({ ...result, minimalMode: true, diagnosticsEnabled: false });
  expect(html).toContain('Retained C4 conversions');
  expect(html).toContain('Request payment');
  expect(html).toContain('Source meaning');
  expect(html).toContain('Target meaning');
  expect(html).toContain('Apply C4 conversion');
  expect(html).not.toContain(applyRequest(model).planKey);
});

test('current final-graph semantic rules veto retained workshop links after endpoint reinterpretation', () => {
  const model = reviewable(),
    acknowledged = update(model, acknowledgement(model, true)).model;
  const context = workbenchC4MappingReview(acknowledged);
  assert(context.applyReason !== null);
  const result = update(acknowledged, applyRequest(acknowledged)).model;
  expect(result.editor).toBe(model.editor);
  expect(result.c4Conversions).toHaveLength(0);
  expect(result.c4ApplyNotice).toBe(context.applyReason);
});
