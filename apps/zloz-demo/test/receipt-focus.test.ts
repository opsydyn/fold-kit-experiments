import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  applyEventStormingDddConversion,
  captureModelDocument,
  createArchitectureNode,
  createEditor,
  createEventStormingDddConversionPlan,
  serializeEventStormingDddConversion,
  updateEditor,
} from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { receiptChangeNavigation, receiptReviewPanel } from '../src/editor/receipt-review';
import { update } from '../src/editor/update';
async function ready() {
  const graph = {
    nodes: [
      createArchitectureNode({
        id: 'root',
        label: 'Order aggregate',
        position: { x: 0, y: 0 },
        size: { width: 200, height: 120 },
        ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
        architecture: { family: 'ddd', role: 'aggregate-root' },
      }),
      createArchitectureNode({
        id: 'event',
        label: 'Order placed',
        position: { x: 900, y: 400 },
        size: { width: 240, height: 160 },
        ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
        architecture: { family: 'event-storming', role: 'domain-event' },
      }),
    ],
    edges: [
      {
        id: 'emits',
        label: 'Emits',
        source: { node: 'root', port: 'out' },
        target: { node: 'event', port: 'in' },
        pathStyle: 'straight' as const,
        architecture: { family: 'event-storming' as const, role: 'emits' as const },
      },
    ],
  };
  const viewport = { x: 17, y: 29, zoom: 0.8 };
  const source = {
    document: captureModelDocument({
      id: 'foreign',
      name: 'Imported Orders',
      snapshot: { graph, viewport },
      editions: [],
      origin: null,
    }),
    sessionId: 'foreign-session',
    revision: 0,
  };
  const plan = createEventStormingDddConversionPlan(source);
  const result = applyEventStormingDddConversion(createEditor(graph, { viewport }), source, {
    consent: { planKey: plan.key, accepted: true },
  });
  assert(result.type === 'applied');
  const start = init().model;
  const model = {
    ...start,
    editor: updateEditor(start.editor, {
      type: 'NodeLabelChanged',
      id: 'source',
      label: 'Existing working edit',
    }),
  };
  const pending = update(
    model,
    Message.ChoseConversionReceiptFiles({
      files: [new File([serializeEventStormingDddConversion(result.conversion)], 'orders.json')],
    }),
  );
  assert(pending.commands?.[0]);
  const opened = update(pending.model, await Effect.runPromise(pending.commands[0].effect)).model;
  assert(opened.receiptReview);
  return update(
    opened,
    Message.ObservedReceiptInput({
      id: opened.receiptReview.id,
      side: 'after',
      message: { type: 'SurfaceMeasured', size: { width: 1000, height: 600 } },
    }),
  ).model;
}
function request(model: Model, side: 'before' | 'after', entity: 'node' | 'edge', id: string) {
  const review = model.receiptReview;
  assert(review);
  const entry = receiptChangeNavigation(model, side).entries.find(
    (item) => item.entity === entity && item.id === id,
  );
  assert(entry);
  return Message.ClickedReceiptChange({ reviewId: review.id, side, ...entry.request });
}
function preserved(before: Model, after: Model) {
  for (const key of [
    'editor',
    'modelIdentity',
    'editions',
    'savedModels',
    'mappingReceipts',
    'mappingLossConsent',
    'historyReview',
  ] as const)
    expect(after[key]).toBe(before[key]);
  expect(after.receiptReview?.receipt).toBe(before.receiptReview?.receipt);
  expect(after.receiptReview?.editor.readOnly).toBe(true);
  expect(after.receiptReview?.editor.past).toEqual([]);
}
test('node focus frames the requested before/after geometry while preserving working Undo and immutable provenance', async () => {
  const model = await ready();
  for (const side of ['before', 'after'] as const) {
    const result = update(model, request(model, side, 'node', 'event'));
    expect(result.commands ?? []).toEqual([]);
    const review = result.model.receiptReview;
    assert(review);
    expect(review.side).toBe(side);
    expect(review.focusedChange).toEqual({ entity: 'node', id: 'event' });
    expect(review.editor.graph.nodes[1]?.architecture?.family).toBe(
      side === 'before' ? 'event-storming' : 'ddd',
    );
    expect(review.editor.viewport.x + 1020 * review.editor.viewport.zoom).toBeCloseTo(500);
    expect(review.editor.viewport.y + 480 * review.editor.viewport.zoom).toBeCloseTo(300);
    expect(review.editor.viewport.zoom).toBeLessThanOrEqual(0.8);
    expect(result.model.receiptReviewNotice).toContain(
      side === 'before' ? 'before conversion' : 'after conversion',
    );
    preserved(model, result.model);
    expect(result.model.editor.past).toHaveLength(1);
  }
});
test('connection focus frames both endpoints on either side with no source or receipt mutation', async () => {
  const model = await ready();
  for (const side of ['before', 'after'] as const) {
    const focused = update(model, request(model, side, 'edge', 'emits')).model;
    const review = focused.receiptReview;
    assert(review);
    expect(review.focusedChange).toEqual({ entity: 'edge', id: 'emits' });
    expect(review.editor.viewport.x + 570 * review.editor.viewport.zoom).toBeCloseTo(500);
    expect(review.editor.viewport.y + 280 * review.editor.viewport.zoom).toBeCloseTo(300);
    expect(review.editor.graph.edges[0]?.architecture?.family).toBe(
      side === 'before' ? 'event-storming' : 'ddd',
    );
    preserved(model, focused);
  }
});
test('stale scopes, unknown changes, hidden controls, loading, missing measurements and gestures cannot move either camera', async () => {
  const model = await ready(),
    message = request(model, 'after', 'node', 'event');
  for (const altered of [
    { ...message, reviewId: message.reviewId - 1 },
    { ...message, selectedId: 'old' },
    { ...message, id: 'root' },
    { ...message, entity: 'edge' as const },
    { ...message, side: 'before' as const },
  ])
    expect(update(model, altered).model).toBe(model);
  assert(model.receiptReview);
  for (const changed of [
    { ...model, sidebarCollapsed: true },
    { ...model, sidebarSection: 'diagnostics' as const },
    {
      ...model,
      receiptRead: { id: 999, modelId: model.modelIdentity.id, epoch: model.modelEpoch },
    },
    {
      ...model,
      receiptReview: {
        ...model.receiptReview,
        editor: { ...model.receiptReview.editor, surface: null },
      },
    },
    {
      ...model,
      receiptReview: {
        ...model.receiptReview,
        editor: updateEditor(model.receiptReview.editor, {
          type: 'PanStarted',
          pointer: 1,
          point: { x: 20, y: 20 },
        }),
      },
    },
  ]) {
    const next = update(changed, message).model;
    expect(next.receiptReview).toBe(changed.receiptReview);
    preserved(changed, next);
  }
  const closed = update(model, Message.ClickedCloseReceiptReview()).model;
  expect(update(closed, message).model).toBe(closed);
});
test('side reset and manual navigation clear the focus marker; measurement callbacks retain it', async () => {
  const model = await ready(),
    focused = update(model, request(model, 'after', 'node', 'event')).model;
  const review = focused.receiptReview;
  assert(review);
  const measured = update(
    focused,
    Message.ObservedReceiptInput({
      id: review.id,
      side: 'after',
      message: { type: 'SurfaceMeasured', size: { width: 1000, height: 600 } },
    }),
  ).model;
  expect(measured.receiptReview?.focusedChange).toEqual({ entity: 'node', id: 'event' });
  const panned = update(
    measured,
    Message.ObservedReceiptInput({
      id: review.id,
      side: 'after',
      message: { type: 'ViewportNudged', delta: { x: 20, y: 0 } },
    }),
  ).model;
  expect(panned.receiptReview?.focusedChange).toBeNull();
  preserved(model, panned);
  const reset = update(
    focused,
    Message.SelectedReceiptSide({ id: review.id, side: 'before' }),
  ).model;
  expect(reset.receiptReview?.focusedChange).toBeNull();
  preserved(model, reset);
});
test('native focus controls and unavailable reasons remain visible with minimal diagnostics', async () => {
  const source = await ready();
  assert(source.receiptReview);
  const model = {
    ...source,
    minimalMode: true,
    diagnosticsEnabled: false,
    receiptReview: {
      ...source.receiptReview,
      editor: { ...source.receiptReview.editor, surface: null },
    },
  };
  const html = (
    await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model }),
          view: (current, h: HtmlBuilder<Message>) => ({
            title: 'Focus',
            body: receiptReviewPanel(current, h),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    )
  ).html;
  expect(html).toContain('Focus node Order placed before conversion');
  expect(html).toContain('Focus connection Emits after conversion');
  expect(html).toContain('Waiting for the receipt canvas measurement');
  expect(html).toMatch(
    /<button\b(?=[^>]*aria-label="Focus node Order placed before conversion")(?=[^>]*disabled)[^>]*>/u,
  );
});
test('a fresh canvas binding cancels stale capture without clearing an idle focus marker', async () => {
  const model = await ready(),
    focused = update(model, request(model, 'before', 'node', 'event')).model;
  const review = focused.receiptReview;
  assert(review);
  const rebound = update(
    focused,
    Message.ObservedReceiptInput({
      id: review.id,
      side: 'before',
      message: { type: 'GestureCancelled' },
    }),
  ).model;
  expect(rebound.receiptReview?.focusedChange).toEqual({ entity: 'node', id: 'event' });
  expect(rebound.receiptReview?.editor.viewport).toEqual(review.editor.viewport);
  preserved(model, rebound);
});
