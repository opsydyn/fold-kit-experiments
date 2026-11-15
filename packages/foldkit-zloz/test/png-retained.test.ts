import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  captureSvgLayout,
  createEditor,
  createPngReview,
  resolvePngReview,
  updatePngReview,
  writeSvgExport,
  type ZlozGraph,
  type ZlozPngReviewContext,
} from '../src/index';
const graph: ZlozGraph = {
  nodes: [
    {
      id: 'a',
      label: 'A',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'b',
      label: 'B',
      position: { x: 400, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [
    {
      id: 'ab',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      label: 'Reads',
    },
  ],
};
function fixture() {
  const editor = {
    ...createEditor(graph),
    routes: [
      {
        id: 'ab',
        points: [
          { x: 100, y: 40 },
          { x: 200, y: 180 },
          { x: 400, y: 40 },
        ],
        label: { position: { x: 250, y: -100 }, size: { width: 240, height: 40 } },
      },
    ],
  };
  const context: ZlozPngReviewContext = {
    scope: 'png/1',
    sourceRevision: 0,
    snapshot: editor,
    title: 'Retained PNG',
    theme: { colorScheme: 'light' },
    renderers: { nodes: 'built-in', edges: 'built-in' },
    layout: { snapshot: captureSvgLayout(editor, 'labels-v1'), renderKey: 'labels-v1' },
  };
  const state = createPngReview(context.scope),
    view = resolvePngReview(state, context);
  const accepted = updatePngReview(state, context, {
    ...view.identity,
    type: 'PngLossAcceptanceChanged',
    accepted: true,
  }).state;
  const started = updatePngReview(accepted, context, {
    ...view.identity,
    type: 'PngRenderRequested',
  });
  return { editor, context, view, started };
}
test('queued retained PNG input keeps reviewed geometry when caller-owned routes or label bounds change', () => {
  const { editor, context, started } = fixture();
  assert(started.payload && context.layout);
  const input = started.payload.input;
  expect(input.svg.layout).not.toBe(context.layout);
  expect(input.svg.layout?.snapshot.routes).not.toBe(context.layout.snapshot.routes);
  expect(input.svg.layout?.snapshot.routes[0]?.label?.position).toEqual({ x: 250, y: -100 });
  Object.assign(context.layout.snapshot.routes[0]?.points[0] ?? {}, { x: 900 });
  Object.assign(context.layout.snapshot.routes[0]?.label?.position ?? {}, { y: 900 });
  const rebuilt = writeSvgExport(input.snapshot, input.svg, input.writing);
  assert(rebuilt.type === 'written');
  assert(input.expectedSvg !== undefined);
  expect(rebuilt.svg).toBe(input.expectedSvg);
  expect(input.svg.layout?.snapshot.routes[0]?.points[0]?.x).toBe(100);
  expect(editor.routes[0]?.points[0]?.x).toBe(100);
  expect(editor.past).toEqual([]);
});
test('retained bounds face the same pixel/dimension budget before rendering; explicit crops stay fixed', () => {
  const { context } = fixture();
  const state = createPngReview(context.scope);
  const canonical = resolvePngReview(state, {
    ...context,
    layout: undefined,
    png: { maxPixels: 100000 },
  });
  expect(canonical.plan?.type).toBe('ready');
  const retained = resolvePngReview(state, { ...context, png: { maxPixels: 100000 } });
  expect(retained.plan?.width).toBe(548);
  expect(retained.plan?.height).toBe(348);
  expect(retained.plan?.type).toBe('blocked');
  expect(retained.findings.find((f) => f.code === 'png-size-limit')?.severity).toBe('unsupported');
  expect(
    updatePngReview(
      state,
      { ...context, png: { maxPixels: 100000 } },
      { ...retained.identity, type: 'PngRenderRequested' },
    ).payload,
  ).toBeNull();
  const crop = resolvePngReview(state, {
    ...context,
    regions: [
      {
        id: 'model',
        label: 'Crop',
        value: { type: 'bounds', bounds: { x: 0, y: 0, width: 100, height: 60 } },
      },
    ],
    png: { maxPixels: 6000 },
  });
  expect(crop.plan?.type).toBe('ready');
  expect(crop.plan?.width).toBe(100);
  expect(crop.plan?.height).toBe(60);
});
test('changed retained data, render key, source or live policy cannot publish old pixels or download them', () => {
  const { context, view, started } = fixture();
  assert(started.payload && context.layout);
  const artifact = {
    width: started.payload.plan.width,
    height: started.payload.plan.height,
    byteLength: 33,
    dataUrl: 'data:image/png;base64,iVBORw0KGgo',
  };
  const settled = {
    ...view.identity,
    type: 'PngRenderSettled' as const,
    run: started.payload.run,
    result: { type: 'rendered' as const, artifact },
  };
  const changed: ZlozPngReviewContext[] = [
    {
      ...context,
      layout: {
        ...context.layout,
        snapshot: {
          ...context.layout.snapshot,
          routes: context.layout.snapshot.routes.map((r) => ({
            ...r,
            label: { position: { x: 250, y: -200 }, size: { width: 240, height: 40 } },
          })),
        },
      },
    },
    { ...context, layout: { ...context.layout, renderKey: 'labels-v2' } },
    { ...context, sourceRevision: 1 },
    { ...context, canDownload: () => 'Protected now' },
  ];
  const ready = updatePngReview(started.state, context, settled).state;
  expect(resolvePngReview(ready, context).artifact).not.toBeNull();
  for (const next of changed) {
    const reviewed = resolvePngReview(ready, next);
    if (next.canDownload) {
      expect(reviewed.artifact).toEqual(artifact);
      expect(reviewed.downloadReason).toBe('Protected now');
    } else expect(reviewed.artifact).toBeNull();
    expect(
      updatePngReview(ready, next, { ...view.identity, type: 'PngDownloadRequested' }).download,
    ).toBeNull();
    const outcome = updatePngReview(started.state, next, settled);
    expect(resolvePngReview(outcome.state, next).artifact).toBeNull();
    expect(
      updatePngReview(outcome.state, next, { ...view.identity, type: 'PngDownloadRequested' })
        .download,
    ).toBeNull();
  }
  const cancelled = updatePngReview(started.state, context, {
    ...view.identity,
    type: 'PngRenderCancelled',
  }).state;
  expect(updatePngReview(cancelled, context, settled).state).toBe(cancelled);
});
