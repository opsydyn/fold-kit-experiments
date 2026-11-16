import { expect, test } from 'bun:test';

import {
  captureGroupDocumentV3,
  captureGroupSvgLayoutV3,
  portPosition,
  type ZlozSvgPrimitive,
  writeGroupSvgExportV3,
  planGroupPngExportV3,
  createPngReview,
  resolveGroupPngReviewV3,
  updateGroupPngReviewV3,
  type ZlozGroupPngExportInputV3,
  type ZlozGroupPngReviewContextV3,
} from '../src/index';
import wire from './fixtures/group-document-v3-ported.json';
import { fontBytes } from './helpers/font-cmap';
const document = captureGroupDocumentV3(wire);
const input: ZlozGroupPngExportInputV3 = {
  document,
  svg: {
    title: 'Native PNG',
    region: { type: 'model', padding: 40 },
    theme: { colorScheme: 'light' },
    background: { type: 'theme' },
    font: { family: 'sans-serif', size: 14, weight: 400 },
    renderers: { nodes: 'built-in', edges: 'built-in' },
  },
};
const context: ZlozGroupPngReviewContextV3 = {
  scope: 'native/png',
  sourceRevision: 0,
  document,
  title: input.svg.title,
  theme: input.svg.theme,
  renderers: input.svg.renderers,
};
test('native PNG planning uses the exact native SVG and retains findings/source without allocating pixels', () => {
  const svg = writeGroupSvgExportV3(document, input.svg),
    plan = planGroupPngExportV3(input);
  expect(plan.version).toBe(3);
  expect(plan.document).toEqual(document);
  expect(plan.type).toBe('ready');
  if (plan.type !== 'ready' || svg.type !== 'written') throw new Error('Expected ready');
  expect(plan.svg).toBe(svg.svg);
  expect(plan.findings.slice(0, svg.findings.length)).toEqual([...svg.findings]);
  expect(plan.findings.some((f) => f.code === 'rasterization-loss' && f.severity === 'loss')).toBe(
    true,
  );
  expect(planGroupPngExportV3({ ...input, png: { maxPixels: 1 } }).type).toBe('blocked');
});
test('native PNG review requires its own consent and owns a complete capability-aware deferred job', () => {
  const state = createPngReview(context.scope),
    view = resolveGroupPngReviewV3(state, context);
  expect(
    updateGroupPngReviewV3(state, context, { ...view.identity, type: 'PngRenderRequested' })
      .payload,
  ).toBeNull();
  const accepted = updateGroupPngReviewV3(state, context, {
    ...view.identity,
    type: 'PngLossAcceptanceChanged',
    accepted: true,
  }).state;
  const started = updateGroupPngReviewV3(accepted, context, {
    ...view.identity,
    type: 'PngRenderRequested',
  });
  expect(started.payload?.input.document).toEqual(document);
  expect(started.payload?.input.document).not.toBe(document);
  expect(Object.isFrozen(started.payload?.input.document.graph.nodes)).toBe(true);
  expect(started.payload?.input.expectedSvg).toBe(started.payload?.plan.svg);
  expect(started.payload?.input.expectedSvg).toContain('data-zloz-group-ports="true"');
  expect(Object.hasOwn(started.payload?.input ?? {}, 'snapshot')).toBe(false);
});
const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';
const cropContext: ZlozGroupPngReviewContextV3 = {
  ...context,
  regions: [
    {
      id: 'model',
      label: 'Explicit pixel fixture',
      value: { type: 'bounds', bounds: { x: 0, y: 0, width: 1, height: 1 } },
    },
  ],
};
const pixelArtifact = { dataUrl: pixel, byteLength: 68, width: 1, height: 1 };
function started(ctx: ZlozGroupPngReviewContextV3 = cropContext) {
  const initial = createPngReview(ctx.scope),
    view = resolveGroupPngReviewV3(initial, ctx);
  const accepted = updateGroupPngReviewV3(initial, ctx, {
    ...view.identity,
    type: 'PngLossAcceptanceChanged',
    accepted: true,
  }).state;
  const result = updateGroupPngReviewV3(accepted, ctx, {
    ...view.identity,
    type: 'PngRenderRequested',
  });
  if (!result.payload) throw new Error('Expected native job');
  return { state: result.state, job: result.payload, identity: view.identity };
}
test('native PNG settlement binds real PNG data, current consent and plan; download reuses the exact artifact', () => {
  const run = started(),
    reply = {
      ...run.identity,
      type: 'PngRenderSettled',
      run: run.job.run,
      result: { type: 'rendered', artifact: pixelArtifact },
    } as const;
  const ready = updateGroupPngReviewV3(run.state, cropContext, reply);
  expect(resolveGroupPngReviewV3(ready.state, cropContext).artifact).toEqual(pixelArtifact);
  const download = updateGroupPngReviewV3(ready.state, cropContext, {
    ...run.identity,
    type: 'PngDownloadRequested',
  });
  expect(download.download?.artifact).toBe(
    resolveGroupPngReviewV3(ready.state, cropContext).artifact!,
  );
  expect(download.download?.artifact.dataUrl).toBe(pixel);
  expect(Object.isFrozen(download.download?.artifact)).toBe(true);
  for (const artifact of [
    { ...pixelArtifact, byteLength: 67 },
    { ...pixelArtifact, width: 2 },
    { ...pixelArtifact, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
    { ...pixelArtifact, dataUrl: pixel.replace('AAAAEAAAAB', 'AAAAIAAAAB') },
  ])
    expect(
      updateGroupPngReviewV3(run.state, cropContext, {
        ...reply,
        result: { type: 'rendered', artifact },
      }).notice,
    ).toContain('artifact checks');
});
test('cancel, newer runs, source/mode/camera changes and live protections cannot publish an obsolete native PNG', () => {
  const run = started(),
    reply = {
      ...run.identity,
      type: 'PngRenderSettled',
      run: run.job.run,
      result: { type: 'rendered', artifact: pixelArtifact },
    } as const;
  const cancelled = updateGroupPngReviewV3(run.state, cropContext, {
    ...run.identity,
    type: 'PngRenderCancelled',
  }).state;
  expect(updateGroupPngReviewV3(cancelled, cropContext, reply).state).toBe(cancelled);
  const retry = updateGroupPngReviewV3(cancelled, cropContext, {
    ...run.identity,
    type: 'PngRenderRequested',
  });
  expect(retry.payload?.run).toBe(run.job.run + 1);
  expect(updateGroupPngReviewV3(retry.state, cropContext, reply).state).toBe(retry.state);
  for (const changed of [
    { ...cropContext, document: captureGroupDocumentV3({ ...document, connectionMode: 'loose' }) },
    {
      ...cropContext,
      document: captureGroupDocumentV3({ ...document, viewport: { x: 1, y: 2, zoom: 2 } }),
    },
    { ...cropContext, sourceRevision: 1 },
    { ...cropContext, canDownload: () => 'Export paused now.' },
  ]) {
    const rejected = updateGroupPngReviewV3(run.state, changed, reply);
    expect(resolveGroupPngReviewV3(rejected.state, changed).artifact).toBeNull();
    expect(
      updateGroupPngReviewV3(run.state, changed, { ...run.identity, type: 'PngDownloadRequested' })
        .download,
    ).toBeNull();
  }
  expect(
    updateGroupPngReviewV3(run.state, { ...cropContext, scope: 'replacement' }, reply).state,
  ).toBe(run.state);
  const failed = updateGroupPngReviewV3(run.state, cropContext, {
    ...reply,
    result: { type: 'failed', code: 'decode-failed', reason: 'Native decode failed.' },
  });
  expect(failed.notice).toContain('decode-failed');
  expect(resolveGroupPngReviewV3(failed.state, cropContext).artifact).toBeNull();
});
test('native PNG settings and blocked vector findings retain their meaning and reset raster consent', () => {
  const run = started();
  const changed = updateGroupPngReviewV3(run.state, cropContext, {
    ...run.identity,
    type: 'PngSettingsChanged',
    preferences: { ...resolveGroupPngReviewV3(run.state, cropContext).svg.preferences, scale: 2 },
  });
  const next = resolveGroupPngReviewV3(changed.state, cropContext);
  expect(next.accepted).toBe(false);
  expect(next.plan?.width).toBe(2);
  expect(next.busy).toBe(false);
  for (const configured of [
    { ...input, svg: { ...input.svg, renderers: { nodes: 'unknown', edges: 'built-in' } } },
    { ...input, png: { maxDimension: 1 } },
    { ...input, png: { maxPixels: 1 } },
  ] as const)
    expect(planGroupPngExportV3(configured).type).toBe('blocked');
  expect(() => planGroupPngExportV3({ ...input, png: { maxBytes: 0 } })).toThrow();
  const scaled = planGroupPngExportV3({
    ...input,
    svg: {
      ...input.svg,
      region: { type: 'bounds', bounds: { x: 0, y: 0, width: 10.25, height: 7.25 } },
      scale: 1.1,
    },
  });
  expect(scaled.width).toBe(12);
  expect(scaled.height).toBe(8);
});
test('native deferred layout, options, renderer records and font bytes are detached from caller mutation', () => {
  const edge = document.graph.edges[0]!;
  const points = [edge.source, edge.target].map((e) =>
    portPosition(document.graph.nodes.find((n) => n.id === e.node)!, e.port),
  );
  const layout = captureGroupSvgLayoutV3(document, [{ id: edge.id, points }], 'native-png');
  const font = new Uint8Array(fontBytes);
  const adapters = [
    {
      id: 'unused',
      version: '1',
      render: (): readonly ZlozSvgPrimitive[] => [
        { type: 'text', position: { x: 0, y: 0 }, text: 'Stable' },
      ],
    },
  ];
  const manifest = { nodes: 'built-in', edges: 'built-in' } as const;
  const ctx: ZlozGroupPngReviewContextV3 = {
    ...context,
    renderers: manifest,
    font: { family: 'Inter', size: 14, weight: 400, assetId: 'inter' },
    assets: [{ id: 'inter', kind: 'font', availability: 'embedded' }],
    layout: { snapshot: layout, renderKey: 'native-png' },
    writing: { adapters, fontResources: [{ assetId: 'inter', format: 'truetype', bytes: font }] },
  };
  const run = started(ctx),
    job = run.job.input;
  const expected = job.expectedSvg;
  if (expected === undefined) throw new Error('Expected reviewed native SVG bytes');
  const before = writeGroupSvgExportV3(job.document, job.svg, job.writing);
  expect(before.type).toBe('written');
  if (before.type === 'written') expect(before.svg).toBe(expected);
  expect(job.svg.layout?.snapshot.document).toEqual(document);
  expect(Object.isFrozen(job.svg.layout?.snapshot.routes[0]?.points)).toBe(true);
  Object.assign(manifest, { nodes: 'unknown' });
  font.fill(0);
  adapters[0]!.version = '2';
  expect(job.svg.renderers.nodes).toBe('built-in');
  expect(job.writing?.fontResources?.[0]?.bytes).toEqual(fontBytes);
  expect(job.writing?.adapters?.[0]?.version).toBe('1');
  const after = writeGroupSvgExportV3(job.document, job.svg, job.writing);
  if (after.type !== 'written') throw new Error('Expected detached SVG');
  expect(after.svg).toBe(expected);
});
