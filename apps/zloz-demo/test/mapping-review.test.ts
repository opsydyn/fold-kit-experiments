import { expect, test } from 'bun:test';

import { captureEdition, createHistoryReview, serializeGraph } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import { workbenchMappingReview } from '../src/editor/mapping-review';
import { mappingReviewPanel } from '../src/editor/mapping-review-view';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
function ready(): Model {
  return {
    ...update(init().model, Message.SelectedExample({ example: 'event-storming' })).model,
    sidebarSection: 'mapping',
  };
}
function choose(model: Model, key: string, value: string) {
  return Message.SelectedMappingReviewChoice({
    ...workbenchMappingReview(model).scope,
    key,
    value,
  });
}
test('workbench composes package proposals, ambiguity and losses while explicit choices leave the source and history intact', () => {
  const model = ready(),
    before = serializeGraph(model.editor.graph);
  const context = workbenchMappingReview(model);
  expect(context.preview.nodes.find((n) => n.nodeId === 'note:1')?.type).toBe('ambiguous');
  expect(context.preview.disclosures.map((d) => d.id)).toEqual(['note:3', 'step:2']);
  const changed = update(model, choose(model, 'node:note:1', 'domain-service')).model;
  expect(
    workbenchMappingReview(changed).preview.nodes.find((n) => n.nodeId === 'note:1'),
  ).toMatchObject({
    type: 'proposed',
    origin: 'explicit',
    architecture: { family: 'ddd', role: 'domain-service' },
  });
  expect(changed.editor).toBe(model.editor);
  expect(serializeGraph(changed.editor.graph)).toBe(before);
  expect(changed.editions).toBe(model.editions);
  expect(changed.modelIdentity).toBe(model.modelIdentity);
  const retained = update(changed, choose(changed, 'node:note:3', 'retain')).model;
  expect(
    workbenchMappingReview(retained).preview.edges.find((e) => e.edgeId === 'step:2'),
  ).toMatchObject({ type: 'blocked', code: 'unsupported-role' });
  const edge = update(retained, choose(retained, 'edge:step:2', 'retain')).model;
  expect(workbenchMappingReview(edge).preview.edges.find((e) => e.edgeId === 'step:2')?.type).toBe(
    'retained',
  );
  const reset = update(
    edge,
    Message.ClickedResetMappingReview(workbenchMappingReview(edge).scope),
  ).model;
  expect(workbenchMappingReview(reset).preview).toEqual(context.preview);
  expect(reset.editor).toBe(model.editor);
});
test('explicit incompatible relationships show package reasons; auto removes a choice and invalid values are ignored', () => {
  const model = ready();
  const changed = update(model, choose(model, 'edge:step:2', 'tactical:uses')).model;
  expect(
    workbenchMappingReview(changed).preview.edges.find((e) => e.edgeId === 'step:2'),
  ).toMatchObject({ type: 'blocked', code: 'incompatible-roles' });
  const automatic = update(changed, choose(changed, 'edge:step:2', '')).model;
  expect(
    workbenchMappingReview(automatic).preview.edges.find((e) => e.edgeId === 'step:2')?.type,
  ).toBe('proposed');
  for (const [key, value] of [
    ['node:note:1', 'aggregate'],
    ['missing', 'retain'],
    ['node:note:1', '__proto__'],
  ] as const)
    expect(update(model, choose(model, key, value)).model).toBe(model);
});
test('stale source/revision/model/epoch and hidden panel requests cannot change review choices', () => {
  const model = ready(),
    message = choose(model, 'node:note:1', 'domain-service');
  for (const other of [
    { ...model, modelEpoch: model.modelEpoch + 1 },
    { ...model, modelIdentity: { ...model.modelIdentity, id: 'other' } },
    { ...model, sidebarCollapsed: true },
    { ...model, sidebarSection: 'diagram' as const },
  ])
    expect(update(other, message).model).toBe(other);
  const sameRevision = {
    ...model,
    editor: {
      ...model.editor,
      graph: {
        ...model.editor.graph,
        nodes: model.editor.graph.nodes.map((node) => ({
          ...node,
          label: node.label + ' revised',
        })),
      },
    },
  };
  expect(update(sameRevision, message).model).toBe(sameRevision);
  const selected = update(model, message).model;
  const renamed = update(
    selected,
    Message.ObservedZlozInput({
      message: { type: 'NodeLabelChanged', id: 'note:1', label: 'New intent' },
    }),
  ).model;
  expect(renamed.mappingReview).toBeNull();
  expect(renamed.mappingReviewNotice).toContain('Source changed');
  expect(update(renamed, message).model).toBe(renamed);
  const undone = update(
    renamed,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(model.editor.graph);
  expect(
    workbenchMappingReview(undone).preview.nodes.find((n) => n.nodeId === 'note:1')?.type,
  ).toBe('ambiguous');
  expect(update(undone, message).model).toBe(undone);
  const reopened = update(selected, Message.SelectedExample({ example: 'event-storming' })).model;
  expect(reopened.mappingReview).toBeNull();
  expect(update(reopened, message).model).toBe(reopened);
});
test('historical and busy previews can be inspected but choices are protected; diagnostics never gate review', () => {
  const model = ready();
  const historical = {
    ...model,
    historyReview: createHistoryReview(
      captureEdition({ id: 'old', name: 'Old workshop', snapshot: { graph: model.editor.graph } }),
      model.editor,
    ),
  };
  expect(workbenchMappingReview(historical).reason).toContain('Return');
  expect(update(historical, choose(historical, 'node:note:1', 'domain-service')).model).toBe(
    historical,
  );
  const inspected = update(
    historical,
    Message.SelectedMappingReviewItem({
      ...workbenchMappingReview(historical).scope,
      key: 'edge:step:2',
    }),
  ).model;
  expect(workbenchMappingReview(inspected).selected?.key).toBe('edge:step:2');
  expect(inspected.editor).toBe(model.editor);
  expect(inspected.historyReview).toBe(historical.historyReview);
  const busy = { ...model, importing: { id: 1, revision: model.editor.revision } };
  expect(workbenchMappingReview(busy).reason).toContain('Finish');
  expect(update(busy, choose(busy, 'node:note:1', 'domain-service')).model).toBe(busy);
  const minimal = { ...model, minimalMode: true, diagnosticsEnabled: false };
  expect(
    workbenchMappingReview(
      update(minimal, choose(minimal, 'node:note:1', 'domain-service')).model,
    ).preview.nodes.find((n) => n.nodeId === 'note:1')?.type,
  ).toBe('proposed');
});

async function render(model: Model) {
  return (
    await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model }),
          view: (current, h: HtmlBuilder<Message>) => ({
            title: 'Mapping review',
            body: mappingReviewPanel(current, h),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    )
  ).html;
}
test('native review fields expose ambiguity, selected loss and history protection independently of diagnostics', async () => {
  const model = ready();
  const initial = await render(model);
  expect(initial).toContain('Needs a choice');
  expect(initial).toContain('aria-label="Review mapping"');
  expect(initial).toContain('All prospective semantic losses');
  const selected = update(
    model,
    Message.SelectedMappingReviewItem({
      ...workbenchMappingReview(model).scope,
      key: 'node:note:3',
    }),
  ).model;
  const minimal = await render({ ...selected, minimalMode: true, diagnosticsEnabled: false });
  expect(minimal).toContain('Loss if converted');
  expect(minimal).toContain('aria-label="Preview choice"');
  expect(minimal).not.toContain('aria-label="Mapping summary"');
  const historical = {
    ...selected,
    historyReview: createHistoryReview(
      captureEdition({ id: 'old', name: 'Old workshop', snapshot: { graph: model.editor.graph } }),
      model.editor,
    ),
  };
  const readonly = await render(historical);
  expect(readonly).toMatch(/<select\b(?=[^>]*aria-label="Preview choice")(?=[^>]*disabled)[^>]*>/u);
  expect(readonly).toContain('Return to the working model');
  expect(readonly).toContain('aria-describedby="mapping-choice-reason"');
});
