import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEditor,
  writeSvgExport,
  planPngExport,
  createPngReview,
  resolvePngReview,
  updatePngReview,
  type ZlozSvgExportOptions,
  type ZlozPngArtifact,
} from '../src/index';
const snapshot = createEditor({
  nodes: [
    {
      id: 'n',
      label: 'Hello',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 60 },
      ports: [],
    },
  ],
  edges: [],
});
const options: ZlozSvgExportOptions = {
  title: 'PNG',
  region: { type: 'model', padding: 0 },
  theme: { colorScheme: 'light' },
  background: { type: 'transparent' },
  font: { family: 'sans-serif', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
const context = {
  scope: 'model/1',
  sourceRevision: 0,
  snapshot,
  title: 'PNG',
  theme: options.theme,
  renderers: options.renderers,
};
test('PNG planning preserves vector findings and bounds integer output before allocation', () => {
  const svg = writeSvgExport(snapshot, options, { allowLosses: true }),
    plan = planPngExport(svg);
  assert(plan.type === 'ready');
  expect(plan.width).toBe(100);
  expect(plan.height).toBe(60);
  expect(plan.findings.some((f) => f.code === 'rasterization-loss')).toBe(true);
  expect(plan.findings.slice(0, svg.findings.length)).toEqual([...svg.findings]);
  expect(planPngExport(svg, { maxPixels: 100 }).type).toBe('blocked');
  expect(() => planPngExport(svg, { maxDimension: 16385 })).toThrow();
  expect(snapshot.past).toEqual([]);
  const fractional = writeSvgExport(snapshot, { ...options, scale: 1.005 }, { allowLosses: true });
  const scaled = planPngExport(fractional);
  assert(scaled.type === 'ready');
  expect(scaled.width).toBe(101);
  expect(scaled.height).toBe(61);
});
test('PNG review binds acceptance, generation, source and actual artifact; cancellation and stale replies cannot publish', () => {
  let state = createPngReview(context.scope);
  let view = resolvePngReview(state, context);
  expect(view.renderReason).toContain('Accept');
  state = updatePngReview(state, context, {
    ...view.identity,
    type: 'PngLossAcceptanceChanged',
    accepted: true,
  }).state;
  view = resolvePngReview(state, context);
  const started = updatePngReview(state, context, { ...view.identity, type: 'PngRenderRequested' });
  assert(started.payload);
  state = started.state;
  const artifact: ZlozPngArtifact = {
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    byteLength: 33,
    width: started.payload.plan.width,
    height: started.payload.plan.height,
  };
  const ready = updatePngReview(state, context, {
    ...view.identity,
    type: 'PngRenderSettled',
    run: started.payload.run,
    result: { type: 'rendered', artifact },
  }).state;
  expect(resolvePngReview(ready, context).artifact).toEqual(artifact);
  expect(Object.isFrozen(resolvePngReview(ready, context).artifact)).toBe(true);
  expect(resolvePngReview(ready, { ...context, sourceRevision: 1 }).artifact).toBeNull();
  const request = updatePngReview(ready, context, {
    ...view.identity,
    type: 'PngDownloadRequested',
  });
  expect(request.download?.artifact).toBe(resolvePngReview(ready, context).artifact ?? undefined);
  expect(
    updatePngReview(
      ready,
      { ...context, canDownload: () => '' },
      { ...view.identity, type: 'PngDownloadRequested' },
    ).download,
  ).toBeNull();
  const cancelled = updatePngReview(state, context, {
    ...view.identity,
    type: 'PngRenderCancelled',
  }).state;
  expect(
    updatePngReview(cancelled, context, {
      ...view.identity,
      type: 'PngRenderSettled',
      run: started.payload.run,
      result: { type: 'rendered', artifact },
    }).state,
  ).toBe(cancelled);
  const stale = updatePngReview(
    state,
    { ...context, sourceRevision: 1 },
    {
      ...view.identity,
      type: 'PngRenderSettled',
      run: started.payload.run,
      result: { type: 'rendered', artifact },
    },
  );
  expect(resolvePngReview(stale.state, { ...context, sourceRevision: 1 }).artifact).toBeNull();
});

test('PNG review invalidates settings, policy, scope and failed artifacts; detached payload protects the source', () => {
  const initial = createPngReview(context.scope);
  const view = resolvePngReview(initial, context);
  const accepted = updatePngReview(initial, context, {
    ...view.identity,
    type: 'PngLossAcceptanceChanged',
    accepted: true,
  }).state;
  const started = updatePngReview(accepted, context, {
    ...view.identity,
    type: 'PngRenderRequested',
  });
  assert(started.payload);
  expect(started.payload.input.snapshot).not.toBe(snapshot);
  expect(started.payload.input.expectedSvg).toBe(started.payload.plan.svg);
  const changed = updatePngReview(started.state, context, {
    ...view.identity,
    type: 'PngSettingsChanged',
    preferences: { ...view.svg.preferences, scale: 2 },
  }).state;
  expect(resolvePngReview(changed, context).accepted).toBe(false);
  expect(resolvePngReview(changed, context).busy).toBe(false);
  expect(
    updatePngReview(changed, context, { ...view.identity, type: 'PngDownloadRequested' }).download,
  ).toBeNull();
  const failed = updatePngReview(started.state, context, {
    ...view.identity,
    type: 'PngRenderSettled',
    run: started.payload.run,
    result: { type: 'failed', code: 'encoding-failed', reason: 'Native encoding failed.' },
  });
  expect(failed.notice).toContain('encoding-failed');
  expect(resolvePngReview(failed.state, context).artifact).toBeNull();
  const invalid = {
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    byteLength: 9000000,
    width: 1,
    height: 1,
  };
  expect(
    updatePngReview(started.state, context, {
      ...view.identity,
      type: 'PngRenderSettled',
      run: started.payload.run,
      result: { type: 'rendered', artifact: invalid },
    }).notice,
  ).toContain('artifact checks');
  const policy = updatePngReview(
    started.state,
    { ...context, canDownload: () => 'Protected now.' },
    {
      ...view.identity,
      type: 'PngRenderSettled',
      run: started.payload.run,
      result: { type: 'rendered', artifact: invalid },
    },
  );
  expect(resolvePngReview(policy.state, context).artifact).toBeNull();
  expect(
    updatePngReview(
      accepted,
      { ...context, scope: 'different' },
      { ...view.identity, type: 'PngRenderRequested' },
    ).payload,
  ).toBeNull();
  expect(snapshot.past).toEqual([]);
});
test('PNG planning keeps unsupported renderers blocked and validates all budgets', () => {
  const unsupported = writeSvgExport(
    snapshot,
    { ...options, renderers: { nodes: 'unknown', edges: 'built-in' } },
    { allowLosses: true },
  );
  expect(planPngExport(unsupported).findings).toEqual(
    expect.arrayContaining([...unsupported.findings]),
  );
  expect(planPngExport(unsupported).type).toBe('blocked');
  const huge = writeSvgExport(snapshot, { ...options, scale: 1000 }, { allowLosses: true });
  expect(planPngExport(huge).type).toBe('blocked');
  for (const invalid of [0, -1, NaN, Infinity, 1.2]) {
    expect(() => planPngExport(huge, { maxPixels: invalid })).toThrow();
    expect(() => planPngExport(huge, { maxBytes: invalid })).toThrow();
  }
});
