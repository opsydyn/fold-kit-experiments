import { expect, test } from 'bun:test';

import {
  captureSvgLayout,
  createEditor,
  createSvgReview,
  resolveSvgReview,
  updateSvgReview,
  writeSvgExport,
  type ZlozGraph,
  type ZlozSvgExportOptions,
  type ZlozSvgAdapterContext,
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
      label: 'Calls',
    },
  ],
};
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
const options: ZlozSvgExportOptions = {
  title: 'Retained',
  region: { type: 'model', padding: 10 },
  theme: { colorScheme: 'light' },
  background: { type: 'theme' },
  font: { family: 'sans-serif', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
  layout: { snapshot: captureSvgLayout(editor, 'v1'), renderKey: 'v1' },
};
test('retained writer shares native route and centred label anchors, with nominal bounds and unchanged model', () => {
  const before = JSON.stringify(editor);
  const result = writeSvgExport(editor, options);
  expect(result.type).toBe('written');
  if (result.type !== 'written') throw new Error('Expected retained SVG');
  expect(result.svg).toContain('d="M100,40 L200,180 L400,40"');
  expect(result.svg).toContain(
    '<text x="250" y="-100" text-anchor="middle" dominant-baseline="middle"',
  );
  expect(result.plan.contentBounds).toEqual({ x: 0, y: -120, width: 500, height: 300 });
  expect(result.findings.some((f) => f.code === 'layout-label-content-unverified')).toBe(true);
  expect(JSON.stringify(editor)).toBe(before);
  const canonical = writeSvgExport(editor, { ...options, layout: undefined });
  expect(canonical.type).toBe('written');
  if (canonical.type === 'written') expect(canonical.svg).not.toContain('L200,180');
});
test('adapters receive frozen effective route, label box and resolved geometry; authored style wins', () => {
  let seen: ZlozSvgAdapterContext | undefined;
  const custom: ZlozSvgExportOptions = {
    ...options,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'edge', id: 'ab' },
          renderer: {
            type: 'svg',
            id: 'badge',
            version: '1',
            bounds: { x: 0, y: -120, width: 500, height: 300 },
            fidelity: 'equivalent',
            reason: 'Own vector badge',
          },
        },
      ],
    },
  };
  const writing = {
    adapters: [
      {
        id: 'badge',
        version: '1',
        render: (context: ZlozSvgAdapterContext) => {
          seen = context;
          if (context.kind !== 'edge') throw new Error('Expected edge');
          expect(Object.isFrozen(context.layoutRoute?.points[0])).toBe(true);
          expect(Object.isFrozen(context.labelBox?.size)).toBe(true);
          expect(context.geometry.labelPosition).toEqual({ x: 250, y: -100 });
          return [
            {
              type: 'polyline' as const,
              points: context.layoutRoute?.points ?? [context.source, context.target],
            },
          ];
        },
      },
    ],
  };
  expect(writeSvgExport(editor, custom, writing).type).toBe('written');
  expect(seen?.kind).toBe('edge');
  const styled = {
    ...editor,
    graph: { ...graph, edges: graph.edges.map((e) => ({ ...e, pathStyle: 'straight' as const })) },
  };
  const styledResult = writeSvgExport(styled, {
    ...options,
    layout: { snapshot: captureSvgLayout(styled, 'v1'), renderKey: 'v1' },
  });
  if (styledResult.type !== 'written') throw new Error('Expected authored SVG');
  expect(styledResult.svg).toContain('d="M100,40 L400,40"');
  expect(styledResult.svg).not.toContain('dominant-baseline="middle"');
  const stale = writeSvgExport(editor, {
    ...options,
    layout: { ...options.layout!, renderKey: 'v2' },
  });
  expect(stale.type).toBe('blocked');
  expect('svg' in stale).toBe(false);
});
test('review layout participates in consent and captured download identity', () => {
  const context = {
    scope: 'review/1',
    sourceRevision: 0,
    snapshot: editor,
    title: 'Review',
    theme: options.theme,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'edge' as const, id: 'ab' },
          renderer: { type: 'fallback' as const, reason: 'Plain label replaces badge' },
        },
      ],
    },
    layout: options.layout,
  };
  const state = createSvgReview(context.scope),
    review = resolveSvgReview(state, context);
  expect(review.result?.type).toBe('written');
  expect(review.options?.layout).toEqual(options.layout);
  const accepted = updateSvgReview(state, context, {
    ...review.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  }).state;
  const ready = resolveSvgReview(accepted, context);
  expect(ready.accepted).toBe(true);
  const changed = {
    ...context,
    layout: {
      snapshot: {
        ...options.layout!.snapshot,
        routes: editor.routes.map((r) => ({
          ...r,
          label: { ...r.label, position: { x: 250, y: -200 } },
        })),
      },
      renderKey: 'v1',
    },
  };
  expect(resolveSvgReview(accepted, changed).accepted).toBe(false);
  expect(
    updateSvgReview(accepted, changed, { ...ready.identity, type: 'SvgDownloadRequested' }).payload,
  ).toBeNull();
});

test('retained multiline labels centre their block; invalid baseline adapters block atomically', () => {
  const multiline = {
    ...editor,
    graph: { ...graph, edges: graph.edges.map((e) => ({ ...e, label: 'Reads\nmodel' })) },
  };
  const result = writeSvgExport(multiline, {
    ...options,
    layout: { snapshot: captureSvgLayout(multiline, 'v1'), renderKey: 'v1' },
  });
  if (result.type !== 'written') throw new Error('Expected multiline SVG');
  expect(result.svg).toContain(
    '<text x="250" y="-108.75" text-anchor="middle" dominant-baseline="middle"',
  );
  const invalid = writeSvgExport(
    editor,
    {
      ...options,
      renderers: {
        ...options.renderers,
        overrides: [
          {
            target: { kind: 'edge', id: 'ab' },
            renderer: {
              type: 'svg',
              id: 'bad',
              version: '1',
              bounds: { x: 0, y: 0, width: 10, height: 10 },
              fidelity: 'equivalent',
              reason: 'Invalid adapter fixture',
            },
          },
        ],
      },
    },
    {
      adapters: [
        {
          id: 'bad',
          version: '1',
          render: () => [
            // @ts-expect-error Unknown baselines are rejected at the safe-vector boundary too.
            { type: 'text', text: 'Bad', position: { x: 0, y: 0 }, baseline: 'top' },
          ],
        },
      ],
    },
  );
  expect(invalid.type).toBe('blocked');
  expect('svg' in invalid).toBe(false);
  expect(invalid.findings.find((f) => f.code === 'adapter-failed')?.reason).toContain('baseline');
});
