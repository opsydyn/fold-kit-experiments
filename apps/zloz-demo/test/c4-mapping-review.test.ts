import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { captureEdition, createHistoryReview } from '@opsydyn/foldkit-zloz';
import { reviewReaderForScope } from '@opsydyn/foldkit-zloz-mermaid';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { expect, test } from 'vitest';

import { workbenchC4MappingReview, updateC4MappingReview } from '../src/editor/c4-mapping-review';
import { c4MappingReviewPanel } from '../src/editor/c4-mapping-review-view';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
function ready(): Model {
  const model = update(
    init().model,
    Message.SelectedExample({ example: 'event-storming-workshop' }),
  ).model;
  return { ...model, sidebarSection: 'c4mapping' as const };
}
test('C4 review exposes package ambiguity and complete provenance without editor or Undo changes', () => {
  const model = ready(),
    context = workbenchC4MappingReview(model);
  expect(context.preview.nodes.find((n) => n.nodeId === 'provider')?.type).toBe('ambiguous');
  expect(context.preview.provenance.document.snapshot.graph).toEqual(model.editor.graph);
  expect(context.preview.provenance.document.editions).toEqual(model.editions);
  const selected = updateC4MappingReview(model, {
    ...context.scope,
    type: 'ItemSelected',
    key: 'node:request',
  });
  expect(workbenchC4MappingReview(selected).selected?.key).toBe('node:request');
  expect(selected.editor).toBe(model.editor);
  expect(selected.editor.past).toBe(model.editor.past);
});
function select(model: Model, key: string) {
  return update(
    model,
    Message.SelectedC4ReviewItem({ ...workbenchC4MappingReview(model).scope, key }),
  ).model;
}
function field(model: Model, name: 'role' | 'name' | 'scope' | 'technology', value: string) {
  const context = workbenchC4MappingReview(model);
  return update(
    model,
    Message.ChangedC4ReviewForm({
      ...context.scope,
      key: context.selected?.key ?? '',
      field: name,
      value,
    }),
  ).model;
}
function action(model: Model, value: 'preview' | 'retain' | 'clear' | 'reset') {
  const context = workbenchC4MappingReview(model);
  return update(
    model,
    Message.ClickedC4ReviewAction({
      ...context.scope,
      key: context.selected?.key ?? '',
      action: value,
    }),
  ).model;
}
test('draft fields require explicit Preview; form changes revoke the prior choice and do not alter graph or history', () => {
  const original = ready();
  let model = select(original, 'node:request');
  model = field(model, 'role', 'container');
  model = field(model, 'name', 'Payments API');
  model = field(model, 'technology', 'HTTP');
  expect(workbenchC4MappingReview(model).selected?.decision.type).toBe('unmapped');
  model = action(model, 'preview');
  expect(workbenchC4MappingReview(model).selected?.decision).toMatchObject({
    type: 'proposed',
    label: 'Payments API',
    architecture: { family: 'c4', role: 'container', technology: 'HTTP' },
  });
  expect(
    workbenchC4MappingReview(model).preview.disclosures.some(
      (d) => d.code === 'workshop-meaning-replaced',
    ),
  ).toBe(true);
  model = field(model, 'name', '');
  expect(workbenchC4MappingReview(model).selected?.decision.type).toBe('unmapped');
  expect(workbenchC4MappingReview(model).previewReason).toContain('Enter');
  expect(action(model, 'preview')).toBe(model);
  expect(model.editor).toBe(original.editor);
  expect(model.editions).toBe(original.editions);
});
test('node, scope and relationship choices compose through core; blocked communication becomes proposed after explicit endpoints', () => {
  let model = select(ready(), 'edge:provider-handles');
  model = action(field(model, 'name', 'Authorizes payment'), 'preview');
  expect(workbenchC4MappingReview(model).selected?.decision).toMatchObject({
    type: 'blocked',
    code: 'endpoint-not-c4',
  });
  model = select(model, 'node:request');
  model = action(field(model, 'role', 'container'), 'preview');
  model = select(model, 'node:provider');
  model = field(model, 'role', 'software-system');
  expect(workbenchC4MappingReview(model).form.scope).toBe('');
  model = action(field(model, 'scope', 'external'), 'preview');
  expect(
    workbenchC4MappingReview(model).preview.edges.find((e) => e.edgeId === 'provider-handles')
      ?.type,
  ).toBe('proposed');
  expect(workbenchC4MappingReview(model).selected?.decision).toMatchObject({
    architecture: { scope: 'external' },
  });
  const cleared = action(model, 'clear');
  expect(workbenchC4MappingReview(cleared).selected?.decision.type).toBe('ambiguous');
  expect(
    workbenchC4MappingReview(cleared).preview.edges.find((e) => e.edgeId === 'provider-handles')
      ?.type,
  ).toBe('blocked');
  const retained = action(cleared, 'retain');
  expect(workbenchC4MappingReview(retained).selected?.decision.type).toBe('retained');
  expect(workbenchC4MappingReview(action(retained, 'reset')).preview.disclosures).toEqual([]);
});
test('kind restrictions, stale scope, hidden panel and foreign or stale-selection requests fail closed', () => {
  const model = select(ready(), 'node:workshop-lane');
  expect(
    workbenchC4MappingReview(model)
      .roles.filter((r) => r.disabled)
      .map((r) => r.value),
  ).toEqual(['person', 'component']);
  expect(field(model, 'role', 'person')).toBe(model);
  expect(field(model, 'scope', '__proto__')).toBe(model);
  const context = workbenchC4MappingReview(model);
  const request = Message.ChangedC4ReviewForm({
    ...context.scope,
    key: context.selected?.key ?? '',
    field: 'role',
    value: 'container',
  });
  for (const other of [
    { ...model, modelEpoch: model.modelEpoch + 1 },
    { ...model, modelIdentity: { ...model.modelIdentity, id: 'other' } },
    { ...model, sidebarSection: 'diagram' as const },
    { ...model, sidebarCollapsed: true },
    select(model, 'node:provider'),
  ]) {
    expect(updateC4MappingReview(other, { ...request, type: 'FormChanged' })).toBe(other);
    expect(update(other, request).model.editor).toBe(other.editor);
  }
  const reopened = update(
    model,
    Message.SelectedExample({ example: 'event-storming-workshop' }),
  ).model;
  expect(reopened.c4MappingReview).toBeNull();
  expect(
    update({ ...reopened, sidebarSection: 'c4mapping' }, request).model.c4MappingReview,
  ).toBeNull();
});

test('historical and busy sources protect choices while permitting item inspection', () => {
  const original = ready();
  const edition = captureEdition({
    id: 'discovery',
    name: 'Discovery',
    snapshot: { graph: original.editor.graph },
  });
  const historical = {
    ...original,
    editions: [edition],
    historyReview: createHistoryReview(edition, original.editor),
  };
  const inspected = select(historical, 'node:retry-question');
  expect(workbenchC4MappingReview(inspected).sourceLabel).toBe('Edition · Discovery');
  expect(workbenchC4MappingReview(inspected).preview.provenance.sessionId).toMatch(/:discovery$/);
  expect(workbenchC4MappingReview(inspected).reason).toContain('Return to the working model');
  expect(field(inspected, 'role', 'component')).toBe(inspected);
  expect(action(inspected, 'retain')).toBe(inspected);
  expect(inspected.editor).toBe(original.editor);
  expect(inspected.historyReview).toBe(historical.historyReview);
  const busy = {
    ...select(original, 'node:provider'),
    importing: { id: 1, revision: original.editor.revision },
  };
  expect(workbenchC4MappingReview(busy).reason).toContain('Finish active');
  expect(field(busy, 'role', 'software-system')).toBe(busy);
});
async function render(model: Model) {
  return (
    await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model }),
          view: (current, h: HtmlBuilder<Message>) => ({
            title: 'C4 review',
            body: c4MappingReviewPanel(current, h),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    )
  ).html;
}
test('native panel exposes status loss, source provenance and reasons independently of numeric diagnostics', async () => {
  const original = ready();
  let model = select(original, 'node:retry-question');
  model = action(field(model, 'role', 'component'), 'preview');
  const html = await render({ ...model, minimalMode: true, diagnosticsEnabled: false });
  expect(html).toContain('Authored hotspot status: open');
  expect(html).toContain('authored open status would be replaced');
  expect(html).toContain('C4 source provenance');
  expect(html).toContain('Prospective C4 semantic losses');
  expect(html).toContain('aria-label="C4 semantic losses"');
  expect(html).toContain('aria-label="C4 structural name"');
  expect(html).not.toContain('C4 source identifiers');
  expect(html).not.toContain('Apply DDD conversion');
  expect(html).not.toContain('Acknowledge plan losses');
  const edition = captureEdition({
    id: 'past',
    name: 'Earlier discovery',
    snapshot: { graph: original.editor.graph },
  });
  const readonly = await render({
    ...model,
    historyReview: createHistoryReview(edition, original.editor),
  });
  expect(readonly).toMatch(/<select\b(?=[^>]*aria-label="C4 role")(?=[^>]*disabled)[^>]*>/u);
  expect(readonly).toContain('Return to the working model');
  expect(readonly).toContain('aria-describedby="c4-review-reason"');
});
test('camera navigation keeps semantic choices while graph/revision changes clear them', () => {
  let model = select(ready(), 'node:provider');
  model = action(field(model, 'role', 'software-system'), 'preview');
  const camera = { ...model, editor: { ...model.editor, viewport: { x: 80, y: 90, zoom: 0.6 } } };
  expect(workbenchC4MappingReview(camera).selected?.decision.type).toBe('proposed');
  expect(workbenchC4MappingReview(camera).preview.provenance.document.snapshot.viewport).toEqual(
    camera.editor.viewport,
  );
  const changed = update(
    model,
    Message.ObservedZlozInput({
      message: { type: 'NodeLabelChanged', id: 'provider', label: 'Renamed provider' },
    }),
  ).model;
  expect(changed.c4MappingReview).toBeNull();
});

test('Domain and review-packet inspection expose protection reasons without depending on a rendered preview', async () => {
  const original = ready();
  const domainText = readFileSync(
    new URL('../src/editor/alchemy-example.json', import.meta.url),
    'utf8',
  );
  const domain = update(
    update(
      update(original, Message.SelectedWorkbenchSection({ section: 'alchemy' })).model,
      Message.ChangedAlchemyText({ text: domainText }),
    ).model,
    Message.ClickedAlchemyReview(),
  ).model;
  expect(workbenchC4MappingReview(domain).reason).toContain('Close Domain review');
  const packetText = readFileSync(
    new URL(
      '../../../packages/foldkit-zloz-mermaid/test/fixtures/review-packet-v1.json',
      import.meta.url,
    ),
    'utf8',
  );
  const source = { ...original, sidebarSection: 'review' as const };
  const scope = reviewReaderForScope(
    source.packetReader,
    `${source.modelIdentity.id}/${source.modelEpoch}`,
  ).scope;
  const started = update(
    source,
    Message.ChoseReviewPacketFiles({ scope, files: [new File([packetText], 'review.json')] }),
  );
  const command = started.commands?.[0];
  assert(command, 'Expected bounded packet read command');
  const opened = update(started.model, await Effect.runPromise(command.effect)).model;
  const withoutProjection = {
    ...opened,
    packetPreview: null,
    sidebarSection: 'c4mapping' as const,
  };
  expect(workbenchC4MappingReview(withoutProjection).reason).toContain('Close the review packet');
  expect(action(withoutProjection, 'retain')).toBe(withoutProjection);
  expect(withoutProjection.editor).toBe(original.editor);
  const provider = select(original, 'node:provider');
  expect(field(provider, 'technology', 'Hidden input')).toBe(provider);
});
