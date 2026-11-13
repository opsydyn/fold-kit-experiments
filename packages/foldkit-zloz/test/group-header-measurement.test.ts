import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEditor,
  startGroupHeaderMeasurement,
  updateGroupHeaderMeasurements,
  resolveGroupHeaderMeasurements,
  type LayoutGroupHeader,
  type ZlozGroupHeaderMeasurementResult,
} from '../src/index';
const editor = createEditor(
  {
    nodes: [
      {
        id: 'g',
        kind: 'group',
        label: 'Group',
        position: { x: 0, y: 0 },
        size: { width: 600, height: 400 },
        ports: [],
      },
      {
        id: 'nested',
        kind: 'group',
        parentId: 'g',
        label: 'Nested',
        position: { x: 30, y: 200 },
        size: { width: 200, height: 100 },
        ports: [],
      },
      {
        id: 'leaf',
        label: 'Leaf',
        position: { x: 800, y: 0 },
        size: { width: 100, height: 80 },
        ports: [],
      },
    ],
    edges: [],
  },
  { readOnly: true },
);
const header: LayoutGroupHeader = {
  id: 'g',
  size: { width: 640, height: 112 },
  padding: { top: 24, right: 24, bottom: 24, left: 24 },
  gap: 24,
};
test('measured group headings resolve complete detached layout declarations with original padding and gap', () => {
  const input = { id: header.id, gap: header.gap, padding: { ...header.padding } };
  const state = startGroupHeaderMeasurement(editor, 'heading:1', 'theme:light', [input]);
  assert(state.type === 'pending');
  input.padding.top = 0;
  const headers = [{ id: 'g', size: { width: 413.75, height: 94.5 } }];
  const result: ZlozGroupHeaderMeasurementResult = {
    type: 'measured',
    requestId: 'heading:1',
    revision: 0,
    renderKey: 'theme:light',
    headers,
  };
  const next = updateGroupHeaderMeasurements(editor, state, 'theme:light', result);
  expect(next.type).toBe('ready');
  assert(headers[0]);
  headers[0].size.width = 1;
  expect(resolveGroupHeaderMeasurements(editor, next, 'theme:light')).toEqual({
    type: 'ready',
    groupHeaders: [{ ...header, size: { width: 413.75, height: 94.5 } }],
  });
  expect(editor.past).toHaveLength(0);
  for (const bounds of [
    [],
    [{ id: 'leaf', size: { width: 10, height: 10 } }],
    [{ id: 'g', size: { width: NaN, height: 10 } }],
    [{ id: 'g', size: { width: 10, height: 0 } }],
    [headers[0], headers[0]],
  ])
    expect(
      updateGroupHeaderMeasurements(editor, state, 'theme:light', { ...result, headers: bounds })
        .type,
    ).toBe('failed');
});
test('superseded, cancelled, source/revision/theme and collapsed-visibility changes cannot publish or reuse heading sizes', () => {
  const state = startGroupHeaderMeasurement(editor, 'heading:1', 'theme:light', [header]);
  const result: ZlozGroupHeaderMeasurementResult = {
    type: 'measured',
    requestId: 'heading:1',
    revision: 0,
    renderKey: 'theme:light',
    headers: [{ id: 'g', size: { width: 400, height: 80 } }],
  };
  const ready = updateGroupHeaderMeasurements(editor, state, 'theme:light', result);
  for (const changed of [
    { ...editor, revision: 1 },
    { ...editor, collapsedGroups: ['g'] },
    { ...editor, collapsedGroups: ['nested'] },
    {
      ...editor,
      graph: {
        ...editor.graph,
        nodes: editor.graph.nodes.map((n) => ({ ...n, label: 'Changed' })),
      },
    },
  ]) {
    expect(updateGroupHeaderMeasurements(changed, state, 'theme:light', result)).toBe(state);
    expect(resolveGroupHeaderMeasurements(changed, ready, 'theme:light').type).toBe('unavailable');
  }
  expect(updateGroupHeaderMeasurements(editor, state, 'theme:dark', result)).toBe(state);
  expect(resolveGroupHeaderMeasurements(editor, ready, 'theme:dark').type).toBe('unavailable');
  const sameVisibility = startGroupHeaderMeasurement(
    { ...editor, collapsedGroups: ['nested', 'nested'] },
    'heading:1',
    'theme:light',
    [header],
  );
  const sameReady = updateGroupHeaderMeasurements(
    { ...editor, collapsedGroups: ['nested'] },
    sameVisibility,
    'theme:light',
    result,
  );
  expect(sameReady.type).toBe('ready');
  const replaced = startGroupHeaderMeasurement(editor, 'heading:2', 'theme:light', [header]);
  expect(updateGroupHeaderMeasurements(editor, replaced, 'theme:light', result)).toBe(replaced);
  const idle = { type: 'idle' } as const;
  expect(updateGroupHeaderMeasurements(editor, idle, 'theme:light', result)).toBe(idle);
  expect(() =>
    startGroupHeaderMeasurement({ ...editor, collapsedGroups: ['g'] }, 'bad', 'key', [
      { ...header, id: 'nested' },
    ]),
  ).toThrow();
  expect(() =>
    startGroupHeaderMeasurement(editor, 'bad', 'key', [{ ...header, id: 'leaf' }]),
  ).toThrow();
  expect(() => startGroupHeaderMeasurement(editor, 'bad', 'key', [header, header])).toThrow();
  expect(
    updateGroupHeaderMeasurements(editor, state, 'theme:light', {
      type: 'failed',
      requestId: 'heading:1',
      revision: 0,
      renderKey: 'theme:light',
      reason: 'Timed out',
    }),
  ).toMatchObject({ type: 'failed', reason: 'Timed out' });
});

test('measured sizes that overflow spacing fail atomically and old result identities are ignored', () => {
  const spec = {
    ...header,
    size: { width: 1, height: 1 },
    padding: { top: 0, left: Number.MAX_VALUE, right: 0, bottom: 0 },
  };
  const pending = startGroupHeaderMeasurement(editor, 'overflow', 'key', [spec]);
  const result: ZlozGroupHeaderMeasurementResult = {
    type: 'measured',
    requestId: 'overflow',
    revision: 0,
    renderKey: 'key',
    headers: [{ id: 'g', size: { width: Number.MAX_VALUE, height: 10 } }],
  };
  expect(updateGroupHeaderMeasurements(editor, pending, 'key', result).type).toBe('failed');
  expect(updateGroupHeaderMeasurements(editor, pending, 'key', { ...result, revision: 5 })).toBe(
    pending,
  );
  expect(
    updateGroupHeaderMeasurements(editor, pending, 'key', { ...result, renderKey: 'old' }),
  ).toBe(pending);
});
