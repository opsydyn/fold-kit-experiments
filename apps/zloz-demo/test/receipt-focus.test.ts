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
function stepRequest(model: Model, direction: 'previous' | 'next') {
  const review = model.receiptReview;
  assert(review);
  return Message.ClickedReceiptChangeStep({
    reviewId: review.id,
    side: review.side,
    from: review.focusedChange,
    direction,
  });
}
test('Previous/Next walks nodes and connections on the chosen side and stops at both ends', async () => {
  const initial = await ready();
  for (const side of ['before', 'after'] as const) {
    assert(initial.receiptReview);
    let model = update(
      initial,
      Message.SelectedReceiptSide({ id: initial.receiptReview.id, side }),
    ).model;
    assert(model.receiptReview);
    model = update(
      model,
      Message.ObservedReceiptInput({
        id: model.receiptReview.id,
        side,
        message: { type: 'SurfaceMeasured', size: { width: 1000, height: 600 } },
      }),
    ).model;
    const beforeStart = update(model, stepRequest(model, 'previous')).model;
    expect(beforeStart.receiptReview).toBe(model.receiptReview);
    const first = update(model, stepRequest(model, 'next')).model;
    expect(first.receiptReview?.side).toBe(side);
    expect(first.receiptReview?.focusedChange).toEqual({ entity: 'node', id: 'event' });
    expect(first.receiptReview?.editor.graph.nodes[1]?.architecture?.family).toBe(
      side === 'before' ? 'event-storming' : 'ddd',
    );
    const second = update(first, stepRequest(first, 'next')).model;
    expect(second.receiptReview?.side).toBe(side);
    expect(second.receiptReview?.focusedChange).toEqual({ entity: 'edge', id: 'emits' });
    expect(second.receiptReview?.editor.graph.edges[0]?.architecture?.family).toBe(
      side === 'before' ? 'event-storming' : 'ddd',
    );
    const afterEnd = update(second, stepRequest(second, 'next')).model;
    expect(afterEnd.receiptReview).toBe(second.receiptReview);
    expect(afterEnd.receiptReviewNotice).toContain('Last change');
    const back = update(second, stepRequest(second, 'previous')).model;
    expect(back.receiptReview?.focusedChange).toEqual({ entity: 'node', id: 'event' });
    expect(back.receiptReview?.side).toBe(side);
    for (const state of [first, second, back]) preserved(model, state);
  }
});
test('step clicks cannot replay from an old cursor, side or receipt, or bypass current navigation guards', async () => {
  const model = await ready(),
    message = stepRequest(model, 'next');
  const first = update(model, message).model;
  expect(update(first, message).model).toBe(first);
  for (const stale of [
    { ...message, reviewId: message.reviewId - 1 },
    { ...message, side: 'before' as const },
    { ...message, from: { entity: 'edge' as const, id: 'event' } },
  ])
    expect(update(model, stale).model).toBe(model);
  assert(model.receiptReview);
  for (const changed of [
    { ...model, sidebarCollapsed: true },
    { ...model, sidebarSection: 'diagnostics' as const },
    {
      ...model,
      receiptRead: { id: 1000, modelId: model.modelIdentity.id, epoch: model.modelEpoch },
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
});
test('minimal-mode transport exposes its position and native boundary reasons', async () => {
  const model = { ...(await ready()), minimalMode: true, diagnosticsEnabled: false };
  const render = async (state: Model) =>
    (
      await Effect.runPromise(
        renderToString(
          {
            Flags: Schema.Struct({}),
            init: () => ({ model: state }),
            view: (current, h: HtmlBuilder<Message>) => ({
              title: 'Steps',
              body: receiptReviewPanel(current, h),
            }),
          },
          { flags: {}, isHydratable: false },
        ),
      )
    ).html;
  const initial = await render(model);
  expect(initial).toContain('No change selected');
  expect(initial).toMatch(
    /<button\b(?=[^>]*aria-label="Previous receipt change")(?=[^>]*disabled)[^>]*>/u,
  );
  expect(initial).toContain('Choose a change before moving backwards.');
  const first = update(model, stepRequest(model, 'next')).model;
  expect(await render(first)).toContain('Change 1 of 2');
  const last = update(first, stepRequest(first, 'next')).model;
  const html = await render(last);
  expect(html).toContain('Change 2 of 2');
  expect(html).toContain('Last change reached.');
  expect(html).toMatch(
    /<button\b(?=[^>]*aria-label="Next receipt change")(?=[^>]*disabled)[^>]*>/u,
  );
});
