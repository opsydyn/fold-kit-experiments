import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEditor,
  layoutRequest,
  applyLayout,
  applyPreviewLayout,
  updateEditor,
  resolveLayoutGroupHeader,
  serializeGraph,
  type LayoutGroupHeader,
  type LayoutResult,
  type ZlozGraph,
} from '../src/index';
const graph: ZlozGraph = {
  nodes: [
    {
      id: 'g',
      kind: 'group',
      label: 'Context',
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      ports: [],
    },
    {
      id: 'a',
      parentId: 'g',
      label: 'Child',
      position: { x: 24, y: 180 },
      size: { width: 100, height: 80 },
      ports: [],
    },
  ],
  edges: [],
};
const header: LayoutGroupHeader = {
  id: 'g',
  size: { width: 600, height: 100 },
  padding: { top: 16, right: 20, bottom: 20, left: 24 },
  gap: 12,
};
test('explicit header bounds are detached, validated and resolve the same world rectangle for layout and rendering', () => {
  const state = createEditor(graph);
  const mutable = { ...header, size: { ...header.size }, padding: { ...header.padding } };
  const request = layoutRequest(state, 'header:1', { groupHeaders: [mutable] });
  mutable.size.width = 1;
  mutable.padding.left = 0;
  expect(request.groupHeaders).toEqual([header]);
  expect('groupHeaders' in layoutRequest(state, 'legacy')).toBe(false);
  const group = graph.nodes[0];
  assert(group);
  expect(resolveLayoutGroupHeader(group, header)).toEqual({
    position: { x: 24, y: 16 },
    size: { width: 600, height: 100 },
    minimumSize: { width: 644, height: 148 },
    contentPadding: { top: 128, right: 20, bottom: 20, left: 24 },
  });
  for (const groupHeaders of [
    [{ ...header, id: 'missing' }],
    [{ ...header, id: 'a' }],
    [header, header],
    [{ ...header, size: { width: 0, height: 100 } }],
    [{ ...header, gap: -1 }],
    [{ ...header, padding: { ...header.padding, left: NaN } }],
    [
      {
        ...header,
        size: { width: Number.MAX_VALUE, height: 100 },
        padding: { ...header.padding, left: Number.MAX_VALUE },
      },
    ],
  ])
    expect(() => layoutRequest(state, 'bad', { groupHeaders })).toThrow();
});
test('header space is validated atomically before publication; normal layout remains one Undo and previews preserve history', () => {
  const state = createEditor(graph),
    request = layoutRequest(state, 'header:1', { groupHeaders: [header] });
  const result: LayoutResult = {
    requestId: request.requestId,
    revision: request.revision,
    positions: [
      { id: 'g', x: 0, y: 0, size: { width: 700, height: 300 } },
      { id: 'a', x: 24, y: 128 },
    ],
    routes: [],
  };
  const next = applyLayout(state, request, result);
  expect(next.past).toHaveLength(1);
  expect(updateEditor(next, { type: 'UndoPressed' }).graph).toEqual(state.graph);
  expect(serializeGraph(next.graph)).not.toContain('groupHeaders');
  expect(next.graph.edges).toBe(state.graph.edges);
  for (const positions of [
    [
      { id: 'g', x: 0, y: 0, size: { width: 640, height: 300 } },
      { id: 'a', x: 24, y: 128 },
    ],
    [
      { id: 'g', x: 0, y: 0, size: { width: 700, height: 300 } },
      { id: 'a', x: 24, y: 127 },
    ],
    [
      { id: 'g', x: 0, y: 0, size: { width: 700, height: 300 } },
      { id: 'a', x: 23, y: 128 },
    ],
    [
      { id: 'g', x: 0, y: 0, size: { width: 700, height: 200 } },
      { id: 'a', x: 24, y: 128 },
    ],
  ])
    expect(() => applyLayout(state, request, { ...result, positions })).toThrow();
  const preview = createEditor(graph, { readOnly: true });
  const applied = applyPreviewLayout(preview, request, result);
  expect(applied.past).toBe(preview.past);
  expect(applied.future).toBe(preview.future);
  expect(
    applyPreviewLayout({ ...preview, revision: 1 }, request, { ...result, positions: [] }),
  ).toEqual({ ...preview, revision: 1 });
});
